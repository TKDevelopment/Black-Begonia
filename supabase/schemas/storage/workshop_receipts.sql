insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workshop-receipts',
  'workshop-receipts',
  false,
  10485760,
  array['image/jpeg','image/png','application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "internal users read workshop receipts"
on storage.objects for select to authenticated
using (bucket_id = 'workshop-receipts' and public.is_internal_crm_user());

create policy "internal users upload workshop receipts"
on storage.objects for insert to authenticated
with check (bucket_id = 'workshop-receipts' and public.is_internal_crm_user());
