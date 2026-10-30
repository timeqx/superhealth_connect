alter table public.services
  add column opening_time time not null default '08:00',
  add column closing_time time not null default '17:00',
  add column daily_capacity integer not null default 10 check (daily_capacity between 1 and 500),
  add column weekdays integer[] not null default array[1,2,3,4,5],
  add constraint service_hours_valid check (opening_time < closing_time),
  add constraint service_weekdays_valid check (weekdays <@ array[0,1,2,3,4,5,6] and array_position(weekdays,null) is null);

alter table public.service_slots
  add column schedule_date date,
  add column schedule_override boolean not null default false,
  add constraint service_schedule_date_unique unique(service_id,schedule_date);

-- Materialize a rolling 30-day window on authenticated booking/staff visits.
-- Existing dates, including closed overrides, are never regenerated.
create function private.ensure_service_sessions(p_service uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.services; d date; today date := (now() at time zone 'Asia/Manila')::date;
begin
  perform private.require_actor();
  if p_service is null then perform private.require_admin(); end if;
  for c in select * from public.services
    where (p_service is null or id=p_service) and is_published and is_bookable
    order by id for update
  loop
    for offset_day in 0..30 loop
      d := today + offset_day;
      if extract(dow from d)::integer = any(c.weekdays)
        and (d+c.opening_time) at time zone 'Asia/Manila' > now()
        and not exists(select 1 from public.service_slots s where s.service_id=c.id
          and (s.starts_at at time zone 'Asia/Manila')::date=d)
      then
        insert into public.service_slots(service_id,starts_at,ends_at,capacity,is_open,schedule_date)
        values(c.id,(d+c.opening_time) at time zone 'Asia/Manila',
          (d+c.closing_time) at time zone 'Asia/Manila',c.daily_capacity,true,d)
        on conflict do nothing;
      end if;
    end loop;
  end loop;
end $$;

create function public.ensure_service_sessions(p_service uuid) returns void
language sql security invoker set search_path='' as $$
  select private.ensure_service_sessions(p_service)
$$;

create function private.save_service_schedule(p_service uuid,p_open time,p_close time,p_capacity integer,p_days integer[],p_expected timestamptz,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.services; s public.service_slots; payload jsonb; result jsonb; new_start timestamptz;
begin
  perform private.require_admin();
  payload:=jsonb_build_object('action','service_schedule','service',p_service,'open',p_open,'close',p_close,'capacity',p_capacity,'days',p_days,'expected',p_expected);
  result:=private.replay(p_key,payload); if result is not null then return result; end if;
  if p_open is null or p_close is null or p_open>=p_close or p_capacity is null or p_capacity not between 1 and 500
    or p_days is null or not (p_days <@ array[0,1,2,3,4,5,6]) or array_position(p_days,null) is not null then raise exception 'VALIDATION_ERROR'; end if;
  select * into c from public.services where id=p_service for update;
  if not found or p_expected is null or c.updated_at<>p_expected then raise exception 'CONFLICT'; end if;
  update public.services set opening_time=p_open,closing_time=p_close,daily_capacity=p_capacity,weekdays=p_days where id=c.id;
  for s in select * from public.service_slots where service_id=c.id and schedule_date is not null
    and not schedule_override and starts_at>now() order by id for update
  loop
    -- Preserve every referenced session, even cancelled or suggested visits.
    if exists(select 1 from public.appointments a where a.slot_id=s.id or a.original_slot_id=s.id or a.suggested_slot_id=s.id) then continue; end if;
    new_start := (s.schedule_date+p_open) at time zone 'Asia/Manila';
    if new_start <= now() or exists(select 1 from public.service_slots other where other.service_id=c.id and other.starts_at=new_start and other.id<>s.id) then continue; end if;
    update public.service_slots set starts_at=new_start,ends_at=(s.schedule_date+p_close) at time zone 'Asia/Manila',
      capacity=p_capacity,is_open=extract(dow from s.schedule_date)::integer=any(p_days) where id=s.id;
  end loop;
  perform private.ensure_service_sessions(c.id);
  insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(auth.uid(),'save_service_schedule','service',c.id);
  return private.receipt(p_key,payload,jsonb_build_object('id',c.id));
end $$;

create function public.save_service_schedule(p_service uuid,p_open time,p_close time,p_capacity integer,p_days integer[],p_expected timestamptz,p_key uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select private.save_service_schedule(p_service,p_open,p_close,p_capacity,p_days,p_expected,p_key)
$$;

-- Keep date-specific staff edits when the recurring schedule changes.
create or replace function public.save_slot(p_id uuid,p_service uuid,p_start timestamptz,p_end timestamptz,p_capacity integer,p_open boolean,p_expected timestamptz,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.service_slots; v_payload jsonb; v_result jsonb;
begin
  perform private.require_admin();
  v_payload=jsonb_build_object('action','save_slot','id',p_id,'service',p_service,'start',p_start,'end',p_end,'capacity',p_capacity,'open',p_open,'expected',p_expected);
  v_result=private.replay(p_key,v_payload); if v_result is not null then return v_result; end if;
  if p_start is null or p_end is null or p_start>=p_end or p_capacity is null or p_capacity not between 1 and 500 or p_open is null then raise exception 'VALIDATION_ERROR'; end if;
  -- Same lock order as recurring schedule edits.
  perform 1 from public.services where id=p_service for update;
  if p_id is null then
    if p_start<=now() then raise exception 'SLOT_CLOSED'; end if;
    insert into public.service_slots(service_id,starts_at,ends_at,capacity,is_open) values(p_service,p_start,p_end,p_capacity,p_open) returning * into s;
  else
    select * into s from public.service_slots where id=p_id for update;
    if not found or p_expected is null or s.updated_at<>p_expected then raise exception 'CONFLICT'; end if;
    if s.service_id<>p_service then raise exception 'VALIDATION_ERROR'; end if;
    if s.starts_at<>p_start or s.ends_at<>p_end then
      if p_start<=now() or s.starts_at<=now() then raise exception 'SLOT_CLOSED'; end if;
      if exists(select 1 from public.appointments a where a.slot_id=s.id or a.original_slot_id=s.id or a.suggested_slot_id=s.id) then raise exception 'SESSION_HAS_APPOINTMENTS'; end if;
      if s.schedule_date is not null and (p_start at time zone 'Asia/Manila')::date<>s.schedule_date then raise exception 'VALIDATION_ERROR'; end if;
    end if;
    if p_capacity<private.reserved(s.id) then raise exception 'SLOT_FULL'; end if;
    update public.service_slots set starts_at=p_start,ends_at=p_end,capacity=p_capacity,is_open=p_open,schedule_override=true where id=s.id returning * into s;
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(auth.uid(),'save_slot','slot',s.id);
  return private.receipt(p_key,v_payload,to_jsonb(s));
end $$;

revoke all on function private.ensure_service_sessions(uuid),public.ensure_service_sessions(uuid),
 private.save_service_schedule(uuid,time,time,integer,integer[],timestamptz,uuid),
 public.save_service_schedule(uuid,time,time,integer,integer[],timestamptz,uuid) from public,anon;
grant execute on function private.ensure_service_sessions(uuid),public.ensure_service_sessions(uuid),
 private.save_service_schedule(uuid,time,time,integer,integer[],timestamptz,uuid),
 public.save_service_schedule(uuid,time,time,integer,integer[],timestamptz,uuid) to authenticated;
