-- Serialize deletion with role changes so the last active admin remains protected.
create function public.prepare_staff_deletion(p_user uuid,p_expected timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare target public.user_roles;
begin
  perform pg_catalog.pg_advisory_xact_lock(20461118,2);
  perform private.require_admin();
  if p_user=auth.uid() then raise exception 'SELF_DELETE'; end if;
  select * into target from public.user_roles where user_id=p_user for update;
  if not found or target.role not in ('staff','admin') then raise exception 'FORBIDDEN'; end if;
  if p_expected is null or target.provisioned_at<>p_expected then raise exception 'CONFLICT'; end if;
  if target.role='admin' and target.disabled_at is null and not exists(
    select 1 from public.user_roles where role='admin' and disabled_at is null and user_id<>p_user
  ) then raise exception 'LAST_ADMIN'; end if;
  update public.user_roles set disabled_at=coalesce(disabled_at,now()) where user_id=p_user;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id)
    values(auth.uid(),'delete_staff_account','user_role',p_user);
end $$;
revoke all on function public.prepare_staff_deletion(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.prepare_staff_deletion(uuid,timestamptz) to authenticated;

-- Auth Admin applies this metadata inside the same transaction as email/password
-- changes. Recheck current authorization and never place passwords in metadata.
create function private.edit_staff_metadata() returns trigger
language plpgsql security definer set search_path='' as $$
declare edit jsonb; operator_id uuid; target public.user_roles;
begin
  edit=new.raw_app_meta_data->'staff_edit';
  if edit is null or edit is not distinct from old.raw_app_meta_data->'staff_edit' then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(20461118,2);
  operator_id=(edit->>'actor_id')::uuid;
  perform user_id from public.user_roles where user_id=operator_id and role='admin' and disabled_at is null for update;
  if not found then raise exception 'FORBIDDEN'; end if;
  select * into target from public.user_roles where user_id=new.id for update;
  if not found or target.role not in ('staff','admin') or target.disabled_at is not null then raise exception 'FORBIDDEN'; end if;
  if (edit->>'expected') is null or target.provisioned_at<>(edit->>'expected')::timestamptz then raise exception 'CONFLICT'; end if;
  if edit->>'kind'='details' then
    if coalesce(length(trim(edit->>'first')),0) not between 1 and 80
      or coalesce(length(trim(edit->>'last')),0) not between 1 and 80
      or length(edit->>'employeeId')>80 then raise exception 'VALIDATION_ERROR'; end if;
    update public.profiles set first_name=trim(edit->>'first'),last_name=trim(edit->>'last') where id=new.id;
    update public.user_roles set employee_id=nullif(trim(edit->>'employeeId'),'') where user_id=new.id;
  elsif edit->>'kind' is distinct from 'password' then raise exception 'VALIDATION_ERROR'; end if;
  update public.user_roles set provisioned_at=clock_timestamp() where user_id=new.id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id)
    values(operator_id,case when edit->>'kind'='details' then 'edit_staff_details' else 'set_staff_password' end,'user_role',new.id);
  return new;
end $$;
create trigger on_auth_staff_edit after update of raw_app_meta_data on auth.users
  for each row execute function private.edit_staff_metadata();
revoke all on function private.edit_staff_metadata() from public,anon,authenticated;

create or replace function public.list_staff_accounts(p_offset integer default 0,p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path='' as $$
declare accounts jsonb; total bigint;
begin
  perform private.require_admin();
  if p_offset is null or p_offset<0 or p_offset>200000
    or p_limit is null or p_limit not between 1 and 100 then raise exception 'VALIDATION_ERROR'; end if;
  select count(*) into total from public.user_roles r join auth.users u on u.id=r.user_id where r.role in ('staff','admin') and to_jsonb(u)->>'deleted_at' is null;
  select coalesce(jsonb_agg(to_jsonb(account)),'[]'::jsonb) into accounts from (
    select r.user_id as id,u.email,p.first_name,p.last_name,r.employee_id,
      r.role,r.disabled_at,r.provisioned_at
    from public.user_roles r
    join auth.users u on u.id=r.user_id
    join public.profiles p on p.id=r.user_id
    where r.role in ('staff','admin') and to_jsonb(u)->>'deleted_at' is null
    order by r.provisioned_at desc,r.user_id
    offset p_offset limit p_limit
  ) account;
  return jsonb_build_object('accounts',accounts,'count',total);
end $$;


create function public.staff_editing_ready() returns boolean language plpgsql security definer set search_path='' as $$
begin perform private.require_admin(); return true; end $$;
revoke all on function public.staff_editing_ready() from public,anon,authenticated;
grant execute on function public.staff_editing_ready() to authenticated;
