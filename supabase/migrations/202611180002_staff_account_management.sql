-- GoTrue creates auth.users, applies app metadata, and confirms email within
-- one transaction. Support metadata supplied at INSERT or at its later UPDATE.
-- Only Auth Admin can supply app metadata; user metadata never grants a role.
create function private.provision_staff_account(p_user uuid,p_provision jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare
  provision jsonb := p_provision;
  operator_id uuid;
  operator_role public.user_roles;
  target public.user_roles;
  account_role text;
  v_first text;
  v_last text;
  v_employee text;
begin
  if provision is null or jsonb_typeof(provision)<>'object'
    or coalesce(provision->>'actor_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then raise exception 'VALIDATION_ERROR'; end if;
  operator_id=(provision->>'actor_id')::uuid;
  account_role=provision->>'role';
  v_first=trim(provision->>'first_name');
  v_last=trim(provision->>'last_name');
  v_employee=nullif(trim(provision->>'employee_id'),'');
  if account_role is null or account_role not in ('staff','admin')
    or v_first is null or length(v_first) not between 1 and 80
    or v_last is null or length(v_last) not between 1 and 80
    or length(v_employee)>80 then raise exception 'VALIDATION_ERROR'; end if;

  -- Serialize portal provisioning and role changes, then lock and recheck the
  -- creator so a concurrent demotion cannot create another privileged account.
  perform pg_catalog.pg_advisory_xact_lock(20461118,2);
  select * into operator_role from public.user_roles where user_id=operator_id for update;
  if not found or operator_role.role<>'admin' or operator_role.disabled_at is not null
    then raise exception 'FORBIDDEN'; end if;
  select * into target from public.user_roles where user_id=p_user for update;
  if not found or target.role<>'patient' or target.provisioned_by<>'signup' or target.disabled_at is not null
    then raise exception 'FORBIDDEN'; end if;
  update public.profiles set first_name=v_first,last_name=v_last
    where id=p_user;
  update public.user_roles set role=account_role,employee_id=v_employee,
    provisioned_by=operator_id::text,provisioned_at=clock_timestamp() where user_id=p_user;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(operator_id,'create_staff_account','user_role',p_user,jsonb_build_object('role',account_role));
end $$;

create or replace function private.new_user() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id) values(new.id);
  insert into public.user_roles(user_id) values(new.id);
  if new.raw_app_meta_data->'staff_provisioning' is not null then
    perform private.provision_staff_account(new.id,new.raw_app_meta_data->'staff_provisioning');
  end if;
  return new;
end $$;

create function private.provision_staff_metadata() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Later Auth metadata updates must never restore an account's original role.
  if old.raw_app_meta_data->'staff_provisioning' is null
    and new.raw_app_meta_data->'staff_provisioning' is not null then
    perform private.provision_staff_account(new.id,new.raw_app_meta_data->'staff_provisioning');
  end if;
  return new;
end $$;
create trigger on_auth_staff_metadata after update of raw_app_meta_data on auth.users
  for each row execute function private.provision_staff_metadata();

-- Preflight before Auth Admin is called: an older database must fail before it
-- can accidentally create an ordinary patient for a staff-account request.
create function public.staff_management_ready() returns boolean
language plpgsql security definer set search_path='' as $$
begin
  perform private.require_admin();
  return true;
end $$;

-- Return only portal accounts and the directory fields needed by this screen.
-- Email addresses stay behind this administrator authorization check.
create function public.list_staff_accounts(p_offset integer default 0,p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path='' as $$
declare accounts jsonb; total bigint;
begin
  perform private.require_admin();
  if p_offset is null or p_offset<0 or p_offset>200000
    or p_limit is null or p_limit not between 1 and 100 then raise exception 'VALIDATION_ERROR'; end if;
  select count(*) into total from public.user_roles where role in ('staff','admin');
  select coalesce(jsonb_agg(to_jsonb(account)),'[]'::jsonb) into accounts from (
    select r.user_id as id,u.email,p.first_name,p.last_name,r.employee_id,
      r.role,r.disabled_at,r.provisioned_at
    from public.user_roles r
    join auth.users u on u.id=r.user_id
    join public.profiles p on p.id=r.user_id
    where r.role in ('staff','admin')
    order by r.provisioned_at desc,r.user_id
    offset p_offset limit p_limit
  ) account;
  return jsonb_build_object('accounts',accounts,'count',total);
end $$;

create function public.update_staff_role(p_user uuid,p_role text,p_expected timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare operator_id uuid; operator_role public.user_roles; target public.user_roles; previous_role text;
begin
  perform private.require_admin();
  if p_user is null or p_role is null or p_role not in ('staff','admin') or p_expected is null
    then raise exception 'VALIDATION_ERROR'; end if;
  perform pg_catalog.pg_advisory_xact_lock(20461118,2);
  operator_id=auth.uid();
  select * into operator_role from public.user_roles where user_id=operator_id for update;
  if not found or operator_role.role<>'admin' or operator_role.disabled_at is not null
    then raise exception 'FORBIDDEN'; end if;
  select * into target from public.user_roles where user_id=p_user for update;
  if not found or target.role not in ('staff','admin') or target.disabled_at is not null
    then raise exception 'FORBIDDEN'; end if;
  if target.provisioned_at<>p_expected then raise exception 'CONFLICT'; end if;
  if target.role='admin' and p_role='staff'
    and not exists(select 1 from public.user_roles where role='admin' and disabled_at is null and user_id<>target.user_id)
    then raise exception 'LAST_ADMIN'; end if;
  previous_role=target.role;
  if previous_role<>p_role then
    update public.user_roles set role=p_role,provisioned_at=clock_timestamp(),provisioned_by=operator_id::text
      where user_id=p_user returning * into target;
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
      values(operator_id,'update_staff_role','user_role',p_user,
        jsonb_build_object('previous_role',previous_role,'role',p_role));
  end if;
  return jsonb_build_object('id',target.user_id,'role',target.role,'provisioned_at',target.provisioned_at);
end $$;

revoke all on function private.new_user(),private.provision_staff_account(uuid,jsonb),
  private.provision_staff_metadata() from public,anon,authenticated;
revoke all on function public.staff_management_ready(),public.list_staff_accounts(integer,integer),
  public.update_staff_role(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.staff_management_ready(),public.list_staff_accounts(integer,integer),
  public.update_staff_role(uuid,text,timestamptz) to authenticated;
