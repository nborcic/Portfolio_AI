-- Storage bucket for documents (admin uploads)
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 5242880)
on conflict (id) do nothing;

-- Only admins can upload; authenticated users can read (via app, not direct URL)
create policy "documents_admin_upload" on storage.objects
  for insert with check (
    bucket_id = 'documents' and
    exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

create policy "documents_admin_delete" on storage.objects
  for delete using (
    bucket_id = 'documents' and
    exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );
