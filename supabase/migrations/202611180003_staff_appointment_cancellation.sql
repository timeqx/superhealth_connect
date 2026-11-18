-- Allow staff to cancel approved appointments with a recorded, patient-visible reason.
create or replace function public.change_appointment(
  p_id uuid,p_action text,p_key uuid,p_expected timestamptz,
  p_reason text default null,p_target uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.appointments; s public.service_slots; v_old_slot uuid; v_session uuid;
  v_payload jsonb; v_result jsonb; v_from public.appointment_state; v_to public.appointment_state;
begin
  perform private.require_actor();
  if p_action not in ('approve','reject','cancel','reschedule','no_show') or p_action is null then raise exception 'VALIDATION_ERROR'; end if;
  if p_action in ('approve','reject') then perform private.require_staff();
  elsif p_action='no_show' or (p_action='reschedule' and private.is_staff() and not private.is_admin()) then perform private.require_admin(); end if;
  v_payload=jsonb_build_object('action',p_action,'id',p_id,'expected',p_expected,'reason',p_reason,'target',p_target);
  v_result=private.replay(p_key,v_payload); if v_result is not null then return v_result; end if;
  select slot_id into v_old_slot from public.appointments where id=p_id and (patient_id=auth.uid() or private.is_admin() or (p_action in ('approve','reject','cancel') and private.is_staff()));
  if not found then raise exception 'FORBIDDEN'; end if;
  perform id from public.service_slots where id in (v_old_slot,p_target) order by id for update;
  select queue_session_id into v_session from public.queue_tickets where appointment_id=p_id;
  if v_session is not null then perform id from public.queue_sessions where id=v_session for update; end if;
  select * into a from public.appointments where id=p_id for update;
  if a.slot_id<>v_old_slot or p_expected is null or a.updated_at<>p_expected then raise exception 'CONFLICT'; end if;
  if a.patient_id<>auth.uid() and not private.is_admin() and not (p_action in ('approve','reject','cancel') and private.is_staff()) then raise exception 'FORBIDDEN'; end if;
  -- Limited staff can cancel approved visits only; existing admin and patient rules remain.
  if p_action='cancel' and private.is_staff() and not private.is_admin() and a.status<>'scheduled'
    then raise exception 'FORBIDDEN'; end if;
  if p_reason is not null and length(p_reason)>1000 then raise exception 'VALIDATION_ERROR'; end if;
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
