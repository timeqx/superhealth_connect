-- Keep each person's place in a conversation independently of notification reads.
create table public.inquiry_reads (
  user_id uuid not null references auth.users on delete cascade,
  inquiry_id uuid not null references public.inquiries on delete cascade,
  last_read_at timestamptz not null,
  primary key (user_id,inquiry_id)
);
alter table public.inquiry_reads enable row level security;
revoke all on public.inquiry_reads from public,anon,authenticated;
grant select on public.inquiry_reads to authenticated;
create policy own_inquiry_reads on public.inquiry_reads for select to authenticated
  using (user_id=auth.uid() and private.is_active());

create index inquiry_messages_unread on public.inquiry_messages
  (inquiry_id,(greatest(coalesce(published_at,created_at),updated_at))) where not is_draft;
create index notifications_unread_recipient on public.notifications(recipient_id) where read_at is null;
create index appointments_pending_review on public.appointments(id) where status='pending';
create index profiles_pending_review on public.profiles(id) where review_status='pending';

create function public.portal_badge_counts() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  viewer uuid;
  staff boolean;
  notification_count bigint;
  inquiry_count bigint;
  request_count bigint := 0;
  account_count bigint := 0;
begin
  viewer := private.require_actor();
  staff := private.is_staff();
  select count(*) into notification_count from public.notifications
    where recipient_id=viewer and read_at is null;
  select count(*) into inquiry_count
    from public.inquiries i
    left join public.inquiry_reads r on r.inquiry_id=i.id and r.user_id=viewer
    where (staff or i.patient_id=viewer) and exists (
      select 1 from public.inquiry_messages m
      where m.inquiry_id=i.id and not m.is_draft
        and m.author_id<>viewer
        and (not staff or m.author_id=i.patient_id)
        and greatest(coalesce(m.published_at,m.created_at),m.updated_at)>
          coalesce(r.last_read_at,'-infinity'::timestamptz)
    );
  if staff then
    select count(*) into request_count from public.appointments where status='pending';
  end if;
  if private.is_admin() then
    select count(*) into account_count from public.profiles where review_status='pending';
  end if;
  return jsonb_build_object('notifications',notification_count,'inquiries',inquiry_count,
    'requests',request_count,'accounts',account_count);
end $$;
revoke all on function public.portal_badge_counts() from public,anon,authenticated;
grant execute on function public.portal_badge_counts() to authenticated;

-- Only acknowledge the published incoming messages that the viewer actually saw.
-- Clamp the watermark to an existing message and never move it backwards, so a
-- stale dialog or a client timestamp in the future cannot consume later replies.
create function public.mark_inquiry_read(p_inquiry uuid,p_through timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare
  viewer uuid;
  staff boolean;
  patient uuid;
  through_message timestamptz;
begin
  viewer := private.require_actor();
  staff := private.is_staff();
  if p_through is null or not isfinite(p_through) then raise exception 'VALIDATION_ERROR'; end if;
  select patient_id into patient from public.inquiries where id=p_inquiry;
  if not found or (patient<>viewer and not staff) then raise exception 'FORBIDDEN'; end if;
  select max(greatest(coalesce(m.published_at,m.created_at),m.updated_at)) into through_message
    from public.inquiry_messages m
    where m.inquiry_id=p_inquiry and not m.is_draft and m.author_id<>viewer
      and (not staff or m.author_id=patient)
      and greatest(coalesce(m.published_at,m.created_at),m.updated_at)<=p_through;
  if through_message is null then return; end if;
  insert into public.inquiry_reads(user_id,inquiry_id,last_read_at)
    values(viewer,p_inquiry,through_message)
    on conflict (user_id,inquiry_id) do update
      set last_read_at=excluded.last_read_at
      where public.inquiry_reads.last_read_at<excluded.last_read_at;
  if not staff then
    update public.notifications n set read_at=now()
      where n.recipient_id=viewer and n.entity_type='inquiry' and n.entity_id=p_inquiry
        and n.read_at is null and exists (
          select 1 from public.inquiry_messages m
          where m.inquiry_id=p_inquiry and not m.is_draft and m.author_id<>viewer
            and n.event_key='reply:'||m.id::text
            and greatest(coalesce(m.published_at,m.created_at),m.updated_at)<=through_message
        );
  end if;
end $$;
revoke all on function public.mark_inquiry_read(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.mark_inquiry_read(uuid,timestamptz) to authenticated;

alter publication supabase_realtime add table public.inquiry_reads, public.profiles;
