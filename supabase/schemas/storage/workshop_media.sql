insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workshop-media',
  'workshop-media',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public reads workshop media"
on storage.objects for select to public
using (bucket_id = 'workshop-media');

create policy "internal users upload workshop media"
on storage.objects for insert to authenticated
with check (bucket_id = 'workshop-media' and public.is_internal_crm_user());

create policy "internal users update workshop media"
on storage.objects for update to authenticated
using (bucket_id = 'workshop-media' and public.is_internal_crm_user())
with check (bucket_id = 'workshop-media' and public.is_internal_crm_user());

create policy "internal users delete workshop media"
on storage.objects for delete to authenticated
using (bucket_id = 'workshop-media' and public.is_internal_crm_user());
