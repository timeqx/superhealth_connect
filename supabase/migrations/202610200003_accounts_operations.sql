create function public.save_profile(p_first text,p_middle text,p_last text,p_barangay text,p_other text,p_phone text)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.profiles;
begin
  perform private.require_actor();
  select * into p from public.profiles where id=auth.uid() for update;
  if p.review_status not in ('incomplete','rejected') then raise exception 'INVALID_TRANSITION'; end if;
  if length(trim(p_first)) not between 1 and 80 or length(trim(p_last)) not between 1 and 80
    or p_first is null or p_last is null or length(coalesce(p_middle,''))>80
    or p_barangay is null or p_barangay not in ('Bagong Silangan','Batasan Hills','Commonwealth','Holy Spirit','Payatas','Others')
    or (p_barangay='Others' and (p_other is null or length(trim(p_other)) not between 2 and 100))
    or p_phone is null or p_phone !~ '^\+639[0-9]{9}$'
    then raise exception 'VALIDATION_ERROR'; end if;
  update public.profiles set first_name=trim(p_first),middle_name=trim(coalesce(p_middle,'')),last_name=trim(p_last),
    barangay_code=p_barangay,other_barangay=case when p_barangay='Others' then trim(p_other) else null end,phone=p_phone where id=auth.uid();
end $$;
create function public.submit_verification(p_user uuid,p_document uuid,p_path text,p_mime text,p_size integer)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id=p_user for update;
  if not found or p.review_status not in ('incomplete','rejected') then raise exception 'INVALID_TRANSITION'; end if;
  if not exists(select 1 from public.user_roles where user_id=p_user and role='patient' and disabled_at is null)
    or not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null) then raise exception 'FORBIDDEN'; end if;
  if p.first_name='' or p.last_name='' or p.phone is null or p.barangay_code is null
    or p_path not like p_user::text || '/' || p_document::text || '.%' then raise exception 'VALIDATION_ERROR'; end if;
  insert into public.verification_documents(id,user_id,storage_path,mime_type,size_bytes,review_version)
    values(p_document,p_user,p_path,p_mime,p_size,p.review_version+1);
  update public.profiles set review_status='pending',submitted_at=now(),current_document_id=p_document,
    review_version=review_version+1,rejection_reason=null,reviewed_at=null,reviewed_by=null where id=p_user;
end $$;
create function public.review_account(p_user uuid,p_document uuid,p_decision text,p_reason text,p_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.profiles; v_payload jsonb; v_result jsonb;
begin
  perform private.require_admin();
  v_payload=jsonb_build_object('action','review','user',p_user,'document',p_document,'decision',p_decision,'reason',p_reason);
  v_result=private.replay(p_key,v_payload); if v_result is not null then return v_result; end if;
  select * into p from public.profiles where id=p_user for update;
  if not found or p.review_status<>'pending' or p.current_document_id is distinct from p_document then raise exception 'CONFLICT'; end if;
  if p_decision is null or p_decision not in ('approved','rejected')
    or (p_decision='rejected' and length(trim(coalesce(p_reason,'')))=0) then raise exception 'VALIDATION_ERROR'; end if;
  update public.profiles set review_status=p_decision::public.review_state,reviewed_by=auth.uid(),reviewed_at=now(),
    rejection_reason=case when p_decision='rejected' then trim(p_reason) else null end where id=p_user;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(auth.uid(),'account_'||p_decision,'profile',p_user,jsonb_build_object('document_id',p_document,'version',p.review_version));
  perform private.notify(p_user,'account:'||p_key,'account_'||p_decision,'profile',p_user);
  return private.receipt(p_key,v_payload,jsonb_build_object('status',p_decision));
end $$;

create function public.save_slot(p_id uuid,p_service uuid,p_start timestamptz,p_end timestamptz,p_capacity integer,p_open boolean,p_expected timestamptz,p_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.service_slots; v_payload jsonb; v_result jsonb;
begin
  perform private.require_admin();
  v_payload=jsonb_build_object('action','save_slot','id',p_id,'service',p_service,'start',p_start,'end',p_end,'capacity',p_capacity,'open',p_open,'expected',p_expected);
  v_result=private.replay(p_key,v_payload); if v_result is not null then return v_result; end if;
  if p_start is null or p_end is null or p_start>=p_end or p_capacity is null or p_capacity not between 1 and 500 or p_open is null then raise exception 'VALIDATION_ERROR'; end if;
  if p_id is null then
    if p_start<=now() then raise exception 'SLOT_CLOSED'; end if;
    insert into public.service_slots(service_id,starts_at,ends_at,capacity,is_open) values(p_service,p_start,p_end,p_capacity,p_open) returning * into s;
  else
    select * into s from public.service_slots where id=p_id for update;
    if not found or p_expected is null or s.updated_at<>p_expected then raise exception 'CONFLICT'; end if;
    if s.service_id<>p_service or s.starts_at<>p_start or s.ends_at<>p_end then raise exception 'VALIDATION_ERROR'; end if;
    if p_capacity<private.reserved(s.id) then raise exception 'SLOT_FULL'; end if;
    update public.service_slots set capacity=p_capacity,is_open=p_open where id=s.id returning * into s;
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(auth.uid(),'save_slot','slot',s.id);
  return private.receipt(p_key,v_payload,to_jsonb(s));
end $$;
create function public.update_service(p_id uuid,p_published boolean,p_bookable boolean,p_requirements text,p_arrival integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if length(trim(p_requirements)) not between 1 and 2000 or p_arrival not between 0 and 240 then raise exception 'VALIDATION_ERROR'; end if;
  update public.services set is_published=p_published,is_bookable=p_bookable,requirements=trim(p_requirements),arrival_minutes=p_arrival where id=p_id;
  if not found then raise exception 'VALIDATION_ERROR'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(auth.uid(),'update_service','service',p_id);
end $$;

create function public.create_inquiry(p_subject text,p_category text,p_body text,p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i public.inquiries; v_payload jsonb; v_result jsonb;
begin
  perform private.require_actor();
  v_payload=jsonb_build_object('action','inquiry','subject',p_subject,'category',p_category,'body',p_body);
  v_result=private.replay(p_key,v_payload); if v_result is not null then return v_result; end if;
  insert into public.inquiries(patient_id,subject,category,idempotency_key) values(auth.uid(),trim(p_subject),p_category,p_key) returning * into i;
  insert into public.inquiry_messages(inquiry_id,author_id,body,published_at,idempotency_key) values(i.id,auth.uid(),trim(p_body),now(),p_key);
  return private.receipt(p_key,v_payload,to_jsonb(i));
end $$;
create function public.reply_inquiry(p_id uuid,p_body text,p_publish boolean,p_status text,p_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare i public.inquiries; m public.inquiry_messages; v_payload jsonb; v_result jsonb;
begin
  perform private.require_actor();
  v_payload=jsonb_build_object('action','reply','id',p_id,'body',p_body,'publish',p_publish,'status',p_status);
  v_result=private.replay(p_key,v_payload); if v_result is not null then return v_result; end if;
  select * into i from public.inquiries where id=p_id for update;
  if not found or (i.patient_id<>auth.uid() and not private.is_admin()) then raise exception 'FORBIDDEN'; end if;
  if not private.is_admin() and (p_publish is distinct from true or p_status<>'open') then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('open','in_progress','waiting_for_follow_up','resolved') or p_status is null or p_publish is null then raise exception 'VALIDATION_ERROR'; end if;
  insert into public.inquiry_messages(inquiry_id,author_id,body,is_draft,published_at,idempotency_key)
    values(i.id,auth.uid(),trim(p_body),not p_publish,case when p_publish then now() end,p_key) returning * into m;
  update public.inquiries set status=p_status,resolved_at=case when p_status='resolved' then now() end where id=i.id;
  if private.is_admin() and p_publish then
    perform private.notify(i.patient_id,'reply:'||m.id,'inquiry_reply','inquiry',i.id);
  end if;
  return private.receipt(p_key,v_payload,to_jsonb(m));
end $$;
create function public.mark_notification_read(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_actor();
  update public.notifications set read_at=coalesce(read_at,now()) where id=p_id and recipient_id=auth.uid();
  if not found then raise exception 'FORBIDDEN'; end if;
end $$;

revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.slot_availability(uuid) to anon,authenticated;
grant execute on function public.request_appointment(uuid,uuid),public.change_appointment(uuid,text,uuid,timestamptz,text,uuid),
 public.check_in(uuid,uuid,text),public.advance_queue(uuid,text,uuid,uuid),public.my_queue(uuid),
 public.save_profile(text,text,text,text,text,text),public.review_account(uuid,uuid,text,text,uuid),
 public.save_slot(uuid,uuid,timestamptz,timestamptz,integer,boolean,timestamptz,uuid),
 public.update_service(uuid,boolean,boolean,text,integer),public.create_inquiry(text,text,text,uuid),
 public.reply_inquiry(uuid,text,boolean,text,uuid),public.mark_notification_read(uuid) to authenticated;
grant execute on function public.submit_verification(uuid,uuid,text,text,integer) to service_role;
