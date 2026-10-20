insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('verification','verification',false,5242880,array['image/jpeg','image/png','application/pdf']);
-- Uploads pass through the authenticated server's byte validation and a narrowly
-- scoped privileged client. There is deliberately no browser INSERT/UPDATE policy.
create policy verification_read on storage.objects for select to authenticated using (
  bucket_id='verification' and private.is_active() and exists(
    select 1 from public.verification_documents d where d.storage_path=name and d.deleted_at is null
    and (d.user_id=auth.uid() or private.is_admin())
  )
);
-- Patient subscriptions receive only their own RLS-visible notification rows.
-- Snapshot RPC supplies aggregate queue position; the complete queue is never broadcast.
alter publication supabase_realtime add table public.notifications;
