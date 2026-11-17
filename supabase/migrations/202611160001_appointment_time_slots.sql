-- Recurring services may admit several patients in each appointment time slot.
-- Keep the existing full-day schedule and capacity until staff explicitly edits it.
alter table public.services
  add column slot_duration_minutes integer not null default 30 check (slot_duration_minutes between 1 and 1440),
  add column slot_capacity integer not null default 1 check (slot_capacity between 1 and 500);

update public.services
set slot_duration_minutes=greatest(1,floor(extract(epoch from (closing_time-opening_time))/60)::integer),
    slot_capacity=daily_capacity;

-- Several generated time slots now share a date. The existing unique start-time
-- constraint still makes generation idempotent.
alter table public.service_slots drop constraint service_schedule_date_unique;
create index service_slots_schedule_date on public.service_slots(service_id,schedule_date);

create or replace function private.ensure_service_sessions(p_service uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.services; d date; today date := (now() at time zone 'Asia/Manila')::date;
  slot_start timestamptz; day_end timestamptz; duration interval;
begin
  perform private.require_actor();
  if p_service is null then perform private.require_admin(); end if;
  for c in select * from public.services
    where (p_service is null or id=p_service) and is_published and is_bookable
    order by id for update
  loop
    duration := make_interval(mins=>c.slot_duration_minutes);
    for offset_day in 0..30 loop
      d := today + offset_day;
      -- Existing dates remain intact, including closures, booked dates, and
      -- manually configured sessions. Explicit schedule edits rebuild safe dates.
      if extract(dow from d)::integer = any(c.weekdays)
        and not exists(select 1 from public.service_slots s where s.service_id=c.id
          and (s.starts_at at time zone 'Asia/Manila')::date=d)
      then
        slot_start := (d+c.opening_time) at time zone 'Asia/Manila';
        day_end := (d+c.closing_time) at time zone 'Asia/Manila';
        while slot_start + duration <= day_end loop
          if slot_start > now() then
            insert into public.service_slots(service_id,starts_at,ends_at,capacity,is_open,schedule_date)
            values(c.id,slot_start,slot_start+duration,c.slot_capacity,true,d)
            on conflict(service_id,starts_at) do nothing;
          end if;
          slot_start := slot_start + duration;
        end loop;
      end if;
    end loop;
  end loop;
end $$;

-- Remove the old signatures so PostgREST has a single unambiguous RPC.
drop function public.save_service_schedule(uuid,time,time,integer,integer[],timestamptz,uuid);
drop function private.save_service_schedule(uuid,time,time,integer,integer[],timestamptz,uuid);

create function private.save_service_schedule(p_service uuid,p_open time,p_close time,
  p_slot_duration integer,p_slot_capacity integer,p_days integer[],p_expected timestamptz,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.services; d date; payload jsonb; result jsonb;
begin
  perform private.require_admin();
  payload:=jsonb_build_object('action','service_schedule','service',p_service,'open',p_open,'close',p_close,
    'slot_duration',p_slot_duration,'slot_capacity',p_slot_capacity,'days',p_days,'expected',p_expected);
  result:=private.replay(p_key,payload); if result is not null then return result; end if;
  if p_open is null or p_close is null or p_open>=p_close or p_close='24:00'::time
    or p_slot_duration is null or p_slot_duration not between 1 and 1440
    or make_interval(mins=>p_slot_duration)>p_close-p_open
    or p_slot_capacity is null or p_slot_capacity not between 1 and 500
    or p_days is null or not (p_days <@ array[0,1,2,3,4,5,6]) or array_position(p_days,null) is not null
    then raise exception 'VALIDATION_ERROR'; end if;
  select * into c from public.services where id=p_service for update;
  if not found or p_expected is null or c.updated_at<>p_expected then raise exception 'CONFLICT'; end if;

  update public.services set opening_time=p_open,closing_time=p_close,
    slot_duration_minutes=p_slot_duration,slot_capacity=p_slot_capacity,weekdays=p_days where id=c.id;

  -- Match appointment mutations' ordered slot locking before checking references.
  -- A concurrent request either completes first and protects its date, or sees a
  -- deleted/replaced slot and must refresh availability; capacity cannot be lost.
  perform id from public.service_slots where service_id=c.id
    and (starts_at at time zone 'Asia/Manila')::date >= (now() at time zone 'Asia/Manila')::date
    order by id for update;
  for d in select distinct schedule_date from public.service_slots
    where service_id=c.id and schedule_date >= (now() at time zone 'Asia/Manila')::date
    order by schedule_date
  loop
    -- Preserve the whole date so changed intervals never overlap retained visits.
    -- Event references also protect intermediate slots from past reschedules.
    if exists(select 1 from public.service_slots s where s.service_id=c.id
      and (s.starts_at at time zone 'Asia/Manila')::date=d
      and (s.schedule_override or s.schedule_date is null or s.starts_at<=now()
        or exists(select 1 from public.appointments a where a.slot_id=s.id or a.original_slot_id=s.id or a.suggested_slot_id=s.id)
        or exists(select 1 from public.appointment_events e where e.old_slot_id=s.id or e.new_slot_id=s.id)))
      then continue; end if;
    delete from public.service_slots where service_id=c.id and schedule_date=d;
  end loop;
  perform private.ensure_service_sessions(c.id);
  insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(auth.uid(),'save_service_schedule','service',c.id);
  return private.receipt(p_key,payload,jsonb_build_object('id',c.id));
end $$;

create function public.save_service_schedule(p_service uuid,p_open time,p_close time,
  p_slot_duration integer,p_slot_capacity integer,p_days integer[],p_expected timestamptz,p_key uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select private.save_service_schedule(p_service,p_open,p_close,p_slot_duration,p_slot_capacity,p_days,p_expected,p_key)
$$;

drop function public.save_service_definition(uuid,text,text,text,timestamptz,uuid);
create function public.save_service_definition(p_id uuid,p_name text,p_slug text,p_description text,
  p_expected timestamptz,p_key uuid,p_open time default null,p_close time default null,
  p_slot_duration integer default null,p_slot_capacity integer default null,p_days integer[] default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.services; payload jsonb; result jsonb;
begin
  perform private.require_admin();
  if p_name is null or length(trim(p_name)) not between 2 and 120 or p_slug is null
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug)>100
    or p_description is null or length(trim(p_description)) not between 1 and 2000 then raise exception 'VALIDATION_ERROR'; end if;
  payload:=jsonb_build_object('action','service_definition','id',p_id,'name',p_name,'slug',p_slug,
    'description',p_description,'expected',p_expected,'open',p_open,'close',p_close,
    'slot_duration',p_slot_duration,'slot_capacity',p_slot_capacity,'days',p_days);
  result:=private.replay(p_key,payload); if result is not null then return result; end if;
  if p_id is null then
    if p_open is null or p_close is null or p_open>=p_close or p_close='24:00'::time
      or p_slot_duration is null or p_slot_duration not between 1 and 1440
      or make_interval(mins=>p_slot_duration)>p_close-p_open
      or p_slot_capacity is null or p_slot_capacity not between 1 and 500
      or p_days is null or not (p_days <@ array[0,1,2,3,4,5,6]) or array_position(p_days,null) is not null
      then raise exception 'VALIDATION_ERROR'; end if;
    insert into public.services(name,slug,description,opening_time,closing_time,slot_duration_minutes,slot_capacity,weekdays)
      values(trim(p_name),p_slug,trim(p_description),p_open,p_close,p_slot_duration,p_slot_capacity,p_days)
      returning * into s;
  else
    -- Schedule changes use their own RPC, which safely rebuilds generated slots.
    if p_open is not null or p_close is not null or p_slot_duration is not null or p_slot_capacity is not null or p_days is not null
      then raise exception 'VALIDATION_ERROR'; end if;
    select * into s from public.services where id=p_id for update;
    if not found or p_expected is null or s.updated_at<>p_expected then raise exception 'CONFLICT'; end if;
    update public.services set name=trim(p_name),slug=p_slug,description=trim(p_description) where id=p_id returning * into s;
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(auth.uid(),'save_service_definition','service',s.id);
  return private.receipt(p_key,payload,to_jsonb(s));
end $$;

-- A month of appointment intervals can exceed the old 180 full-day-session cap.
-- Keep manually created future sessions visible as before.
create or replace function public.slot_availability(p_service uuid)
returns table(id uuid,starts_at timestamptz,ends_at timestamptz,remaining bigint)
language sql stable security definer set search_path='' as $$
  select s.id,s.starts_at,s.ends_at,greatest(0,s.capacity-private.reserved(s.id))
  from public.service_slots s join public.services c on c.id=s.service_id
  where c.id=p_service and c.is_published and c.is_bookable and s.is_open and s.starts_at>now()
  order by s.starts_at
$$;

revoke all on function private.save_service_schedule(uuid,time,time,integer,integer,integer[],timestamptz,uuid),
  public.save_service_schedule(uuid,time,time,integer,integer,integer[],timestamptz,uuid),
  public.save_service_definition(uuid,text,text,text,timestamptz,uuid,time,time,integer,integer,integer[]) from public,anon;
grant execute on function private.save_service_schedule(uuid,time,time,integer,integer,integer[],timestamptz,uuid),
  public.save_service_schedule(uuid,time,time,integer,integer,integer[],timestamptz,uuid),
  public.save_service_definition(uuid,text,text,text,timestamptz,uuid,time,time,integer,integer,integer[]) to authenticated;
