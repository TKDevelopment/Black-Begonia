insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('floral-proposals', 'floral-proposals', false, 52428800, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "internal crm users upload project proposal pdfs"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'floral-proposals'
  and public.is_internal_crm_user()
);

create policy "internal crm users read project proposal pdfs"
on storage.objects for select to authenticated
using (
  bucket_id = 'floral-proposals'
  and public.is_internal_crm_user()
);

create policy "internal crm users update project proposal pdfs"
on storage.objects for update to authenticated
using (
  bucket_id = 'floral-proposals'
  and public.is_internal_crm_user()
)
with check (
  bucket_id = 'floral-proposals'
  and public.is_internal_crm_user()
);

create policy "internal crm users delete project proposal pdfs"
on storage.objects for delete to authenticated
using (
  bucket_id = 'floral-proposals'
  and public.is_internal_crm_user()
);
