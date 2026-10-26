create function public.save_service_definition(p_id uuid,p_name text,p_slug text,p_description text,p_expected timestamptz,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.services; payload jsonb; result jsonb;
begin
  perform private.require_admin();
  if p_name is null or length(trim(p_name)) not between 2 and 120 or p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug)>100 or p_description is null or length(trim(p_description)) not between 1 and 2000 then raise exception 'VALIDATION_ERROR'; end if;
  payload=jsonb_build_object('action','service_definition','id',p_id,'name',p_name,'slug',p_slug,'description',p_description,'expected',p_expected);
  result=private.replay(p_key,payload); if result is not null then return result; end if;
  if p_id is null then
    insert into public.services(name,slug,description) values(trim(p_name),p_slug,trim(p_description)) returning * into s;
  else
    select * into s from public.services where id=p_id for update;
    if not found or p_expected is null or s.updated_at<>p_expected then raise exception 'CONFLICT'; end if;
    update public.services set name=trim(p_name),slug=p_slug,description=trim(p_description) where id=p_id returning * into s;
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(auth.uid(),'save_service_definition','service',s.id);
  return private.receipt(p_key,payload,to_jsonb(s));
end $$;

create function public.edit_inquiry_draft(p_id uuid,p_body text,p_publish boolean,p_status text,p_expected timestamptz,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.inquiry_messages; i public.inquiries; parent uuid; payload jsonb; result jsonb;
begin
  perform private.require_admin();
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
revoke all on function public.save_service_definition(uuid,text,text,text,timestamptz,uuid), public.edit_inquiry_draft(uuid,text,boolean,text,timestamptz,uuid) from public,anon;
grant execute on function public.save_service_definition(uuid,text,text,text,timestamptz,uuid), public.edit_inquiry_draft(uuid,text,boolean,text,timestamptz,uuid) to authenticated;

create function public.staff_request_appointment(p_patient uuid,p_slot uuid,p_reason text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.service_slots; a public.appointments; payload jsonb; result jsonb;
begin
  perform private.require_admin();
  if p_reason is null or length(trim(p_reason)) not between 1 and 1000 then raise exception 'VALIDATION_ERROR'; end if;
  payload=jsonb_build_object('action','staff_request','patient',p_patient,'slot',p_slot,'reason',p_reason);
  result=private.replay(p_key,payload); if result is not null then return result; end if;
  if not exists(select 1 from public.profiles p join auth.users u on u.id=p.id join public.user_roles r on r.user_id=p.id
    where p.id=p_patient and p.review_status='approved' and u.email_confirmed_at is not null and r.role='patient' and r.disabled_at is null) then raise exception 'FORBIDDEN'; end if;
  select * into s from public.service_slots where id=p_slot for update;
  if not found then raise exception 'VALIDATION_ERROR'; end if;
  if not s.is_open or s.starts_at<=now() or not exists(select 1 from public.services where id=s.service_id and is_published and is_bookable) then raise exception 'SLOT_CLOSED'; end if;
  if exists(select 1 from public.appointments where patient_id=p_patient and slot_id=p_slot and status in ('pending','scheduled','checked_in','in_service')) then raise exception 'DUPLICATE_REQUEST'; end if;
  if private.reserved(p_slot)>=s.capacity then raise exception 'SLOT_FULL'; end if;
  insert into public.appointments(patient_id,slot_id,original_slot_id,idempotency_key) values(p_patient,p_slot,p_slot,gen_random_uuid()) returning * into a;
  insert into public.appointment_events(appointment_id,actor_id,action,to_status,new_slot_id,reason) values(a.id,auth.uid(),'staff_request','pending',p_slot,trim(p_reason));
  insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(auth.uid(),'staff_request','appointment',a.id);
  perform private.notify(a.patient_id,'request:'||a.id,'appointment_requested','appointment',a.id);
  return private.receipt(p_key,payload,to_jsonb(a));
end $$;
revoke all on function public.staff_request_appointment(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.staff_request_appointment(uuid,uuid,text,uuid) to authenticated;
alter publication supabase_realtime add table public.appointments, public.queue_tickets, public.inquiries, public.inquiry_messages;

create index appointments_requested_at on public.appointments(requested_at);
create index queue_tickets_checked_in_at on public.queue_tickets(checked_in_at);
create function public.operational_durations(p_start timestamptz,p_end timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare decisions jsonb; waits jsonb;
begin
  perform private.require_admin();
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
revoke all on function public.operational_durations(timestamptz,timestamptz) from public,anon;
grant execute on function public.operational_durations(timestamptz,timestamptz) to authenticated;
