-- Existing staff-portal accounts already have role='admin'. Preserve those roles
-- and provisioning details; only newly provisioned staff receive limited access.
alter table public.user_roles drop constraint user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role in ('patient','staff','admin'));

-- Staff and administrators share operational workflows. Administrative helpers
-- remain strict so service management, account reviews and audit access stay private.
create function private.is_staff() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.user_roles
    where user_id=auth.uid() and role in ('staff','admin') and disabled_at is null)
$$;
create function private.require_staff() returns uuid
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.require_actor();
  if not private.is_staff() then raise exception 'FORBIDDEN'; end if;
  return auth.uid();
end $$;
revoke all on function private.is_staff(),private.require_staff() from public,anon,authenticated;
grant execute on function private.is_staff() to anon,authenticated;

-- Read access needed by requests, queues, inquiries and report totals. Direct
-- writes still require the guarded RPCs. Verification files and audit logs retain
-- their existing administrator-only policies (and patient ownership access).
alter policy published_services on public.services using (is_published or private.is_staff());
alter policy visible_slots on public.service_slots using (
  private.is_staff() or exists(select 1 from public.services s where s.id=service_id and s.is_published)
  or exists(select 1 from public.appointments a where a.slot_id=service_slots.id and a.patient_id=auth.uid() and private.is_active())
);
alter policy own_profile on public.profiles using (private.is_active() and (id=auth.uid() or private.is_staff()));
alter policy own_appointments on public.appointments using (private.is_active() and (patient_id=auth.uid() or private.is_staff()));
alter policy staff_sessions on public.queue_sessions using (private.is_staff());
alter policy own_inquiries on public.inquiries using (private.is_active() and (patient_id=auth.uid() or private.is_staff()));
alter policy published_messages on public.inquiry_messages using (
  private.is_active() and (not is_draft or private.is_staff()) and exists(select 1 from public.inquiries i where i.id=inquiry_id)
);

-- Staff may decide pending requests. Cancellations, rescheduling and no-shows
-- remain patient ownership actions or administrator history operations.
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
  elsif p_action='no_show' or (private.is_staff() and not private.is_admin()) then perform private.require_admin(); end if;
  v_payload=jsonb_build_object('action',p_action,'id',p_id,'expected',p_expected,'reason',p_reason,'target',p_target);
  v_result=private.replay(p_key,v_payload); if v_result is not null then return v_result; end if;
  select slot_id into v_old_slot from public.appointments where id=p_id and (patient_id=auth.uid() or private.is_admin() or (p_action in ('approve','reject') and private.is_staff()));
  if not found then raise exception 'FORBIDDEN'; end if;
  perform id from public.service_slots where id in (v_old_slot,p_target) order by id for update;
  select queue_session_id into v_session from public.queue_tickets where appointment_id=p_id;
  if v_session is not null then perform id from public.queue_sessions where id=v_session for update; end if;
  select * into a from public.appointments where id=p_id for update;
  if a.slot_id<>v_old_slot or p_expected is null or a.updated_at<>p_expected then raise exception 'CONFLICT'; end if;
  if a.patient_id<>auth.uid() and not private.is_admin() and not (p_action in ('approve','reject') and private.is_staff()) then raise exception 'FORBIDDEN'; end if;
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

create or replace function public.check_in(p_id uuid,p_key uuid,p_override_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.appointments; s public.service_slots; q public.queue_sessions; t public.queue_tickets;
  v_old_slot uuid; v_payload jsonb; v_result jsonb; v_minutes integer;
begin
  perform private.require_staff();
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

create or replace function public.advance_queue(p_session uuid,p_action text,p_key uuid,p_ticket uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare q public.queue_sessions; t public.queue_tickets; a public.appointments; v_payload jsonb; v_result jsonb; v_from public.appointment_state;
begin
  perform private.require_staff();
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

create or replace function public.reply_inquiry(p_id uuid,p_body text,p_publish boolean,p_status text,p_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare i public.inquiries; m public.inquiry_messages; v_payload jsonb; v_result jsonb;
begin
  perform private.require_actor();
  v_payload=jsonb_build_object('action','reply','id',p_id,'body',p_body,'publish',p_publish,'status',p_status);
  v_result=private.replay(p_key,v_payload); if v_result is not null then return v_result; end if;
  select * into i from public.inquiries where id=p_id for update;
  if not found or (i.patient_id<>auth.uid() and not private.is_staff()) then raise exception 'FORBIDDEN'; end if;
  if not private.is_staff() and (p_publish is distinct from true or p_status<>'open') then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('open','in_progress','waiting_for_follow_up','resolved') or p_status is null or p_publish is null then raise exception 'VALIDATION_ERROR'; end if;
  insert into public.inquiry_messages(inquiry_id,author_id,body,is_draft,published_at,idempotency_key)
    values(i.id,auth.uid(),trim(p_body),not p_publish,case when p_publish then now() end,p_key) returning * into m;
  update public.inquiries set status=p_status,resolved_at=case when p_status='resolved' then now() end where id=i.id;
  if private.is_staff() and p_publish then
    perform private.notify(i.patient_id,'reply:'||m.id,'inquiry_reply','inquiry',i.id);
  end if;
  return private.receipt(p_key,v_payload,to_jsonb(m));
end $$;

create or replace function public.edit_inquiry_draft(p_id uuid,p_body text,p_publish boolean,p_status text,p_expected timestamptz,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.inquiry_messages; i public.inquiries; parent uuid; payload jsonb; result jsonb;
begin
  perform private.require_staff();
  if p_body is null or length(trim(p_body)) not between 1 and 4000 or p_publish is null or p_status is null or p_status not in ('open','in_progress','waiting_for_follow_up','resolved') then raise exception 'VALIDATION_ERROR'; end if;
  payload=jsonb_build_object('action','edit_draft','id',p_id,'body',p_body,'publish',p_publish,'status',p_status,'expected',p_expected);
  result=private.replay(p_key,payload); if result is not null then return result; end if;
  select inquiry_id into parent from public.inquiry_messages where id=p_id;
  select * into i from public.inquiries where id=parent for update;
  if not found then raise exception 'FORBIDDEN'; end if;
  select * into m from public.inquiry_messages where id=p_id for update;
  if not m.is_draft or p_expected is null or m.updated_at<>p_expected then raise exception 'CONFLICT'; end if;
  update public.inquiry_messages set body=trim(p_body),is_draft=not p_publish,published_at=case when p_publish then now() end where id=p_id returning * into m;
  update public.inquiries set status=p_status,resolved_at=case when p_status='resolved' then now() end where id=i.id;
  if p_publish then perform private.notify(i.patient_id,'reply:'||m.id,'inquiry_reply','inquiry',i.id); end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(auth.uid(),case when p_publish then 'publish_draft' else 'edit_draft' end,'inquiry',i.id);
  return private.receipt(p_key,payload,to_jsonb(m));
end $$;

create or replace function public.operational_durations(p_start timestamptz,p_end timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare decisions jsonb; waits jsonb;
begin
  perform private.require_staff();
  if p_start is null or p_end is null or p_end<=p_start or p_end-p_start>interval '93 days' then raise exception 'VALIDATION_ERROR'; end if;
  select jsonb_build_object('cohort',count(*),'samples',count(*) filter(where decided_at>=requested_at),
    'minutes',avg(extract(epoch from (decided_at-requested_at))/60) filter(where decided_at>=requested_at)) into decisions
    from public.appointments where requested_at>=p_start and requested_at<p_end;
  select jsonb_build_object('cohort',count(*),'wait_samples',count(*) filter(where service_started_at>=checked_in_at),
    'wait_minutes',avg(extract(epoch from (service_started_at-checked_in_at))/60) filter(where service_started_at>=checked_in_at),
    'service_samples',count(*) filter(where completed_at>=service_started_at),
    'service_minutes',avg(extract(epoch from (completed_at-service_started_at))/60) filter(where completed_at>=service_started_at)) into waits
    from public.queue_tickets where checked_in_at>=p_start and checked_in_at<p_end;
  return jsonb_build_object('decisions',decisions,'queue',waits);
end $$;
