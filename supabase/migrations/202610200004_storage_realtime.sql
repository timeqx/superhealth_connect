insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('verification','verification',false,5242880,array['image/jpeg','image/png','application/pdf']);
create policy verification_read on storage.objects for select to authenticated using (
  bucket_id='verification' and private.is_active() and exists(
    select 1 from public.verification_documents d where d.storage_path=name and d.deleted_at is null
    and (d.user_id=auth.uid() or private.is_admin())
  )
);
alter publication supabase_realtime add table public.notifications;
