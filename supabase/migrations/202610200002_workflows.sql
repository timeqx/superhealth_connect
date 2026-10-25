create function private.replay(p_key uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r private.operation_receipts;
begin
  if p_key is null then raise exception 'VALIDATION_ERROR'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_key::text,0));
  select * into r from private.operation_receipts where actor_id=auth.uid() and key=p_key;
  if found then
    if r.payload <> p_payload then raise exception 'CONFLICT'; end if;
    return r.result;
  end if;
  return null;
end $$;
create function private.receipt(p_key uuid,p_payload jsonb,p_result jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  insert into private.operation_receipts(actor_id,key,payload,result) values(auth.uid(),p_key,p_payload,p_result);
  return p_result;
end $$;
create function private.reserved(p_slot uuid) returns bigint language sql stable security definer set search_path = '' as $$
select count(*) from public.appointments where slot_id=p_slot and status in ('pending','scheduled','checked_in','in_service','completed')
$$;
create function private.require_approved() returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_actor();
  if not exists(select 1 from public.profiles p join auth.users u on u.id=p.id
    join public.user_roles r on r.user_id=p.id
    where p.id=auth.uid() and p.review_status='approved' and u.email_confirmed_at is not null and r.role='patient')
  then raise exception 'FORBIDDEN'; end if;
end $$;
create function public.slot_availability(p_service uuid) returns table(id uuid,starts_at timestamptz,ends_at timestamptz,remaining bigint)
language sql stable security definer set search_path = '' as $$
  select s.id,s.starts_at,s.ends_at,greatest(0,s.capacity-private.reserved(s.id)) from public.service_slots s
  join public.services c on c.id=s.service_id where c.id=p_service and c.is_published and c.is_bookable
  and s.is_open and s.starts_at>now() order by s.starts_at limit 180
$$;
create function public.request_appointment(p_slot uuid,p_key uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.service_slots; a public.appointments; v_payload jsonb; v_result jsonb;
begin
  perform private.require_approved();
  v_payload=jsonb_build_object('action','request','slot',p_slot);
  v_result=private.replay(p_key,v_payload);
  if v_result is not null then return v_result; end if;
  select * into s from public.service_slots where id=p_slot for update;
  if not found then raise exception 'VALIDATION_ERROR'; end if;
  if not s.is_open or s.starts_at<=now() or not exists(select 1 from public.services where id=s.service_id and is_published and is_bookable)
    then raise exception 'SLOT_CLOSED'; end if;
  if exists(select 1 from public.appointments where patient_id=auth.uid() and slot_id=p_slot and status in ('pending','scheduled','checked_in','in_service'))
    then raise exception 'DUPLICATE_REQUEST'; end if;
  if private.reserved(p_slot)>=s.capacity then raise exception 'SLOT_FULL'; end if;
  insert into public.appointments(patient_id,slot_id,original_slot_id,idempotency_key)
    values(auth.uid(),p_slot,p_slot,p_key) returning * into a;
  insert into public.appointment_events(appointment_id,actor_id,action,to_status,new_slot_id) values(a.id,auth.uid(),'request','pending',p_slot);
  perform private.notify(a.patient_id,'request:'||a.id,'appointment_requested','appointment',a.id,false);
  return private.receipt(p_key,v_payload,to_jsonb(a));
end $$;
create function public.change_appointment(
  p_id uuid,p_action text,p_key uuid,p_expected timestamptz,
  p_reason text default null,p_target uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.appointments; s public.service_slots; v_old_slot uuid; v_session uuid;
  v_payload jsonb; v_result jsonb; v_from public.appointment_state; v_to public.appointment_state;
begin
  perform private.require_actor();
  if p_action not in ('approve','reject','cancel','reschedule','no_show') or p_action is null then raise exception 'VALIDATION_ERROR'; end if;
  if p_action in ('approve','reject','no_show') then perform private.require_admin(); end if;
  v_payload=jsonb_build_object('action',p_action,'id',p_id,'expected',p_expected,'reason',p_reason,'target',p_target);
  v_result=private.replay(p_key,v_payload); if v_result is not null then return v_result; end if;
  select slot_id into v_old_slot from public.appointments where id=p_id and (patient_id=auth.uid() or private.is_admin());
  if not found then raise exception 'FORBIDDEN'; end if;
  perform id from public.service_slots where id in (v_old_slot,p_target) order by id for update;
  select queue_session_id into v_session from public.queue_tickets where appointment_id=p_id;
  if v_session is not null then perform id from public.queue_sessions where id=v_session for update; end if;
  select * into a from public.appointments where id=p_id for update;
  if a.slot_id<>v_old_slot or p_expected is null or a.updated_at<>p_expected then raise exception 'CONFLICT'; end if;
  if a.patient_id<>auth.uid() and not private.is_admin() then raise exception 'FORBIDDEN'; end if;
  v_from=a.status;
  if p_action in ('approve','reject') then
    if a.status<>'pending' then raise exception 'INVALID_TRANSITION'; end if;
    if p_action='reject' and length(trim(coalesce(p_reason,'')))=0 then raise exception 'VALIDATION_ERROR'; end if;
    if p_action='approve' and exists(select 1 from public.service_slots where id=a.slot_id and ends_at<=now()) then raise exception 'SLOT_CLOSED'; end if;
    v_to=case when p_action='approve' then 'scheduled'::public.appointment_state else 'rejected'::public.appointment_state end;
    if p_target is not null and not exists(select 1 from public.service_slots t join public.service_slots o on o.id=a.slot_id
      where t.id=p_target and t.service_id=o.service_id and t.is_open and t.starts_at>now()) then raise exception 'VALIDATION_ERROR'; end if;
    update public.appointments set status=v_to,decided_at=now(),decided_by=auth.uid(),decision_reason=nullif(trim(p_reason),''),
      suggested_slot_id=p_target where id=a.id returning * into a;
  elsif p_action='reschedule' then
    if a.status not in ('pending','scheduled') then raise exception 'INVALID_TRANSITION'; end if;
    if not private.is_admin() then perform private.require_approved(); end if;
    select * into s from public.service_slots where id=p_target;
    if not found or p_target=v_old_slot then raise exception 'VALIDATION_ERROR'; end if;
    if s.service_id<>(select service_id from public.service_slots where id=v_old_slot) then raise exception 'VALIDATION_ERROR'; end if;
    if not s.is_open or s.starts_at<=now() or not exists(select 1 from public.services where id=s.service_id and is_bookable and is_published)
      then raise exception 'SLOT_CLOSED'; end if;
    if private.reserved(p_target)>=s.capacity then raise exception 'SLOT_FULL'; end if;
    if exists(select 1 from public.appointments where patient_id=a.patient_id and slot_id=p_target and status in ('pending','scheduled','checked_in','in_service'))
      then raise exception 'DUPLICATE_REQUEST'; end if;
    update public.appointments set slot_id=p_target,status='pending',decided_at=null,decided_by=null,decision_reason=null,suggested_slot_id=null
      where id=a.id returning * into a;
  else
    if a.status not in ('pending','scheduled','checked_in') or (p_action='no_show' and a.status='pending')
      then raise exception 'INVALID_TRANSITION'; end if;
    if a.status='checked_in' and not private.is_admin() then raise exception 'FORBIDDEN'; end if;
    if length(trim(coalesce(p_reason,'')))=0 then raise exception 'VALIDATION_ERROR'; end if;
    v_to=case when p_action='cancel' then 'cancelled'::public.appointment_state else 'no_show'::public.appointment_state end;
    update public.appointments set status=v_to,decision_reason=trim(p_reason) where id=a.id returning * into a;
    update public.queue_tickets set status=v_to::text::public.ticket_state where appointment_id=a.id and status in ('waiting','called','skipped');
  end if;
  insert into public.appointment_events(appointment_id,actor_id,action,from_status,to_status,old_slot_id,new_slot_id,reason)
    values(a.id,auth.uid(),p_action,v_from,a.status,v_old_slot,a.slot_id,nullif(trim(p_reason),''));
  perform private.notify(a.patient_id,'change:'||p_key,'appointment_'||p_action,'appointment',a.id);
  return private.receipt(p_key,v_payload,to_jsonb(a));
end $$;

create function public.check_in(p_id uuid,p_key uuid,p_override_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.appointments; s public.service_slots; q public.queue_sessions; t public.queue_tickets;
  v_old_slot uuid; v_payload jsonb; v_result jsonb; v_minutes integer;
begin
  perform private.require_admin();
  v_payload=jsonb_build_object('action','check_in','id',p_id,'reason',p_override_reason);
  v_result=private.replay(p_key,v_payload); if v_result is not null then return v_result; end if;
  select slot_id into v_old_slot from public.appointments where id=p_id;
  if not found then raise exception 'VALIDATION_ERROR'; end if;
  select * into s from public.service_slots where id=v_old_slot for update;
  insert into public.queue_sessions(service_id,service_date) values(s.service_id,(s.starts_at at time zone 'Asia/Manila')::date)
    on conflict(service_id,service_date) do nothing;
  select * into q from public.queue_sessions where service_id=s.service_id and service_date=(s.starts_at at time zone 'Asia/Manila')::date for update;
  select * into a from public.appointments where id=p_id for update;
  if a.slot_id<>v_old_slot then raise exception 'CONFLICT'; end if;
  select * into t from public.queue_tickets where appointment_id=a.id;
  if found then return private.receipt(p_key,v_payload,to_jsonb(t)); end if;
  if a.status<>'scheduled' then raise exception 'INVALID_TRANSITION'; end if;
  if q.status<>'open' or q.service_date<>(now() at time zone 'Asia/Manila')::date then raise exception 'SLOT_CLOSED'; end if;
  select arrival_minutes into v_minutes from public.services where id=s.service_id;
  if (now()<s.starts_at-make_interval(mins=>v_minutes) or now()>s.ends_at) and length(trim(coalesce(p_override_reason,'')))=0
    then raise exception 'VALIDATION_ERROR'; end if;
  insert into public.queue_tickets(queue_session_id,appointment_id,ticket_number,order_sequence)
    values(q.id,a.id,q.next_ticket_number,q.next_order_sequence) returning * into t;
  update public.queue_sessions set next_ticket_number=next_ticket_number+1,next_order_sequence=next_order_sequence+1 where id=q.id;
  update public.appointments set status='checked_in' where id=a.id;
  insert into public.appointment_events(appointment_id,actor_id,action,from_status,to_status,reason)
    values(a.id,auth.uid(),'check_in','scheduled','checked_in',nullif(trim(p_override_reason),''));
  perform private.notify(a.patient_id,'check_in:'||a.id,'checked_in','appointment',a.id,false);
  return private.receipt(p_key,v_payload,to_jsonb(t));
end $$;

create function public.advance_queue(p_session uuid,p_action text,p_key uuid,p_ticket uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare q public.queue_sessions; t public.queue_tickets; a public.appointments; v_payload jsonb; v_result jsonb; v_from public.appointment_state;
begin
  perform private.require_admin();
  if p_action is null or p_action not in ('call_next','start','complete','skip','requeue','close') then raise exception 'VALIDATION_ERROR'; end if;
  v_payload=jsonb_build_object('action',p_action,'session',p_session,'ticket',p_ticket);
  v_result=private.replay(p_key,v_payload); if v_result is not null then return v_result; end if;
  select * into q from public.queue_sessions where id=p_session for update;
  if not found or q.status<>'open' then raise exception 'SLOT_CLOSED'; end if;
  if p_action='close' then
    if exists(select 1 from public.queue_tickets where queue_session_id=q.id and status in ('waiting','called','serving','skipped'))
      then raise exception 'CONFLICT'; end if;
    update public.queue_sessions set status='closed' where id=q.id returning * into q;
    insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(auth.uid(),'close_queue','queue_session',q.id);
    return private.receipt(p_key,v_payload,to_jsonb(q));
  end if;
  if q.service_date<>(now() at time zone 'Asia/Manila')::date then raise exception 'SLOT_CLOSED'; end if;
  if p_action='call_next' then
    if exists(select 1 from public.queue_tickets where queue_session_id=q.id and status in ('called','serving')) then raise exception 'CONFLICT'; end if;
    select * into t from public.queue_tickets where queue_session_id=q.id and status='waiting' order by order_sequence limit 1;
  else
    select * into t from public.queue_tickets where id=p_ticket and queue_session_id=q.id;
  end if;
  if t.id is null then raise exception 'INVALID_TRANSITION'; end if;
  select * into a from public.appointments where id=t.appointment_id for update;
  perform id from public.queue_tickets where id=t.id for update;
  v_from=a.status;
  if p_action='call_next' and a.status='checked_in' then
    update public.queue_tickets set status='called',called_at=now() where id=t.id;
  elsif p_action='start' and t.status='called' and a.status='checked_in' then
    update public.queue_tickets set status='serving',service_started_at=now() where id=t.id;
    update public.appointments set status='in_service' where id=a.id;
  elsif p_action='complete' and t.status='serving' and a.status='in_service' then
    update public.queue_tickets set status='completed',completed_at=now() where id=t.id;
    update public.appointments set status='completed' where id=a.id;
  elsif p_action='skip' and t.status='called' and a.status='checked_in' then
    update public.queue_tickets set status='skipped' where id=t.id;
  elsif p_action='requeue' and t.status='skipped' and a.status='checked_in' then
    update public.queue_tickets set status='waiting',order_sequence=q.next_order_sequence where id=t.id;
    update public.queue_sessions set next_order_sequence=next_order_sequence+1 where id=q.id;
  else raise exception 'INVALID_TRANSITION';
  end if;
  select * into t from public.queue_tickets where id=t.id;
  insert into public.appointment_events(appointment_id,actor_id,action,from_status,to_status)
    select a.id,auth.uid(),p_action,v_from,status from public.appointments where id=a.id;
  perform private.notify(a.patient_id,'queue:'||p_key,'queue_'||p_action,'appointment',a.id,false);
  return private.receipt(p_key,v_payload,to_jsonb(t));
end $$;
create function public.my_queue(p_appointment uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare t public.queue_tickets; v_ahead bigint; v_service text;
begin
  perform private.require_actor();
  if not exists(select 1 from public.appointments where id=p_appointment and patient_id=auth.uid()) then raise exception 'FORBIDDEN'; end if;
  select * into t from public.queue_tickets where appointment_id=p_appointment;
  if not found then return null; end if;
  select count(*) into v_ahead from public.queue_tickets where queue_session_id=t.queue_session_id
    and status in ('waiting','called','serving') and order_sequence<t.order_sequence;
  select s.name into v_service from public.queue_sessions q join public.services s on s.id=q.service_id where q.id=t.queue_session_id;
  return jsonb_build_object('ticket_number',t.ticket_number,'status',t.status,'people_ahead',
    case when t.status in ('waiting','called') then v_ahead else 0 end,
    'service',v_service,'updated_at',t.updated_at,'fetched_at',now());
end $$;
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.is_admin(),private.is_active() to anon,authenticated;
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.slot_availability(uuid) to anon,authenticated;
grant execute on function public.request_appointment(uuid,uuid),public.change_appointment(uuid,text,uuid,timestamptz,text,uuid),
  public.check_in(uuid,uuid,text),public.advance_queue(uuid,text,uuid,uuid),public.my_queue(uuid) to authenticated;
