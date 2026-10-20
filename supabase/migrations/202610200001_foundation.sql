-- No live policies/schedules are inferred from the prototype.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create type public.review_state as enum ('incomplete','pending','approved','rejected');
create type public.appointment_state as enum ('pending','scheduled','checked_in','in_service','completed','rejected','cancelled','no_show');
create type public.ticket_state as enum ('waiting','called','serving','skipped','completed','cancelled','no_show');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  first_name text not null default '', middle_name text not null default '', last_name text not null default '',
  barangay_code text check (barangay_code in ('Bagong Silangan','Batasan Hills','Commonwealth','Holy Spirit','Payatas','Others')),
  other_barangay text, phone text check (phone ~ '^\+639[0-9]{9}$'),
  review_status public.review_state not null default 'incomplete',
  submitted_at timestamptz, reviewed_by uuid references auth.users, reviewed_at timestamptz, rejection_reason text,
  current_document_id uuid, review_version integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_roles (
  user_id uuid primary key references auth.users on delete cascade,
  role text not null default 'patient' check (role in ('patient','admin')),
  employee_id text, disabled_at timestamptz,
  provisioned_at timestamptz not null default now(), provisioned_by text not null default 'signup'
);
create table public.verification_documents (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles,
  storage_path text not null unique, mime_type text not null check (mime_type in ('image/jpeg','image/png','application/pdf')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  review_version integer not null, uploaded_at timestamptz not null default now(), deleted_at timestamptz,
  unique(user_id, review_version)
);
alter table public.profiles add constraint profile_document_fk foreign key (current_document_id) references public.verification_documents;
create table public.services (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
  description text not null, requirements text not null default 'Requirements awaiting center confirmation.',
  queue_label text not null default 'Q', is_published boolean not null default false,
  is_bookable boolean not null default false, arrival_minutes integer not null default 30 check (arrival_minutes between 0 and 240),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (not is_bookable or is_published)
);
create table public.service_slots (
  id uuid primary key default gen_random_uuid(), service_id uuid not null references public.services,
  starts_at timestamptz not null, ends_at timestamptz not null, capacity integer not null check (capacity between 1 and 500),
  is_open boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(service_id, starts_at), check (ends_at > starts_at),
  check ((starts_at at time zone 'Asia/Manila')::date = (ends_at at time zone 'Asia/Manila')::date)
);
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  public_reference text not null unique default ('SHC-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  patient_id uuid not null references public.profiles, slot_id uuid not null references public.service_slots,
  original_slot_id uuid not null references public.service_slots,
  status public.appointment_state not null default 'pending', idempotency_key uuid not null,
  requested_at timestamptz not null default now(), decided_at timestamptz, decided_by uuid references auth.users,
  decision_reason text, suggested_slot_id uuid references public.service_slots,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(patient_id, idempotency_key)
);
create unique index one_active_booking_per_slot on public.appointments(patient_id,slot_id)
  where status in ('pending','scheduled','checked_in','in_service');
create index appointments_slot_capacity on public.appointments(slot_id,status);
create index appointments_patient on public.appointments(patient_id,created_at desc);
create table public.appointment_events (
  id uuid primary key default gen_random_uuid(), appointment_id uuid not null references public.appointments,
  actor_id uuid references auth.users, action text not null, from_status public.appointment_state, to_status public.appointment_state,
  old_slot_id uuid references public.service_slots, new_slot_id uuid references public.service_slots, reason text,
  created_at timestamptz not null default now()
);
create table public.queue_sessions (
  id uuid primary key default gen_random_uuid(), service_id uuid not null references public.services, service_date date not null,
  next_ticket_number integer not null default 1, next_order_sequence integer not null default 1,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(service_id,service_date)
);
create table public.queue_tickets (
  id uuid primary key default gen_random_uuid(), queue_session_id uuid not null references public.queue_sessions,
  appointment_id uuid not null unique references public.appointments, ticket_number integer not null, order_sequence integer not null,
  status public.ticket_state not null default 'waiting', checked_in_at timestamptz not null default now(),
  called_at timestamptz, service_started_at timestamptz, completed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(queue_session_id,ticket_number), unique(queue_session_id,order_sequence)
);
create unique index one_active_desk on public.queue_tickets(queue_session_id) where status in ('called','serving');
create table public.inquiries (
  id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.profiles,
  subject text not null check (length(subject) between 3 and 120), category text not null check (category in ('Appointments','Account','Services','General')),
  status text not null default 'open' check (status in ('open','in_progress','waiting_for_follow_up','resolved')),
  idempotency_key uuid not null, assigned_admin_id uuid references auth.users, resolved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(patient_id,idempotency_key)
);
create table public.inquiry_messages (
  id uuid primary key default gen_random_uuid(), inquiry_id uuid not null references public.inquiries,
  author_id uuid not null references auth.users, body text not null check (length(body) between 1 and 4000),
  is_draft boolean not null default false, published_at timestamptz, idempotency_key uuid not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(author_id,idempotency_key)
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), recipient_id uuid not null references public.profiles,
  event_key text not null unique, type text not null, entity_type text not null, entity_id uuid not null,
  read_at timestamptz, created_at timestamptz not null default now()
);
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(), notification_id uuid not null unique references public.notifications,
  state text not null default 'pending' check (state in ('pending','claimed','sent','failed')),
  attempt_count integer not null default 0, available_at timestamptz not null default now(),
  claimed_at timestamptz, sent_at timestamptz, provider_message_id text, last_error text
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users,
  action text not null, entity_type text not null, entity_id uuid not null, metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
-- Mutation receipts make retries safe even after a subsequent transition.
create table private.operation_receipts (
  actor_id uuid not null, key uuid not null, payload jsonb not null, result jsonb not null,
  created_at timestamptz not null default now(), primary key(actor_id,key)
);

create function private.is_active() returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.user_roles where user_id = auth.uid() and disabled_at is null) $$;
create function private.is_admin() returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'admin' and disabled_at is null) $$;
create function private.require_actor() returns uuid language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not private.is_active() then raise exception 'FORBIDDEN'; end if;
  return auth.uid();
end $$;
create function private.require_admin() returns uuid language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_actor();
  if not private.is_admin() then raise exception 'FORBIDDEN'; end if;
  return auth.uid();
end $$;
create function private.new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values (new.id);
  insert into public.user_roles(user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.new_user();
create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = clock_timestamp(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','services','service_slots','appointments','queue_sessions','queue_tickets','inquiries','inquiry_messages'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()',t);
  end loop;
  foreach t in array array['profiles','user_roles','verification_documents','services','service_slots','appointments','appointment_events','queue_sessions','queue_tickets','inquiries','inquiry_messages','notifications','email_outbox','audit_logs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
  end loop;
end $$;

grant select on public.services, public.service_slots to anon, authenticated;
grant select on public.profiles,public.user_roles,public.verification_documents,public.appointments,public.appointment_events,
 public.queue_sessions,public.queue_tickets,public.inquiries,public.inquiry_messages,public.notifications,public.audit_logs to authenticated;
create policy published_services on public.services for select using (is_published or private.is_admin());
create policy visible_slots on public.service_slots for select using (
  private.is_admin() or exists(select 1 from public.services s where s.id=service_id and s.is_published)
  or exists(select 1 from public.appointments a where a.slot_id=service_slots.id and a.patient_id=auth.uid() and private.is_active())
);
create policy own_profile on public.profiles for select to authenticated using (private.is_active() and (id=auth.uid() or private.is_admin()));
create policy own_role on public.user_roles for select to authenticated using (user_id=auth.uid());
create policy own_documents on public.verification_documents for select to authenticated using (private.is_active() and (user_id=auth.uid() or private.is_admin()));
create policy own_appointments on public.appointments for select to authenticated using (private.is_active() and (patient_id=auth.uid() or private.is_admin()));
create policy own_events on public.appointment_events for select to authenticated using (
  private.is_active() and exists(select 1 from public.appointments a where a.id=appointment_id)
);
create policy staff_sessions on public.queue_sessions for select to authenticated using (private.is_admin());
create policy own_tickets on public.queue_tickets for select to authenticated using (
  private.is_active() and exists(select 1 from public.appointments a where a.id=appointment_id)
);
create policy own_inquiries on public.inquiries for select to authenticated using (private.is_active() and (patient_id=auth.uid() or private.is_admin()));
create policy published_messages on public.inquiry_messages for select to authenticated using (
  private.is_active() and (not is_draft or private.is_admin()) and exists(select 1 from public.inquiries i where i.id=inquiry_id)
);
create policy own_notifications on public.notifications for select to authenticated using (recipient_id=auth.uid() and private.is_active());
create policy staff_audit on public.audit_logs for select to authenticated using (private.is_admin());
-- No user policies or grants for outbox, receipts, role writes, or direct domain writes.
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.is_admin(), private.is_active() to authenticated,anon;
grant usage on schema private to anon;

create function private.notify(p_user uuid,p_event text,p_type text,p_entity text,p_id uuid,p_email boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.notifications(recipient_id,event_key,type,entity_type,entity_id)
    values(p_user,p_event,p_type,p_entity,p_id) on conflict(event_key) do nothing returning id into v_id;
  if p_email and v_id is not null then insert into public.email_outbox(notification_id) values(v_id); end if;
end $$;
revoke all on function private.notify(uuid,text,text,text,uuid,boolean) from public,anon,authenticated;
