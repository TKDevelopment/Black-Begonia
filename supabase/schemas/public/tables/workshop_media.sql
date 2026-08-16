create table public.workshop_media (
  workshop_media_id uuid primary key default gen_random_uuid(),
  workshop_definition_id uuid null references public.workshop_definitions(workshop_definition_id) on delete restrict,
  workshop_occurrence_id uuid null references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  media_role text not null check (media_role in ('hero','gallery')),
  storage_path text not null unique,
  public_url text not null,
  alt_text text not null default '',
  display_order smallint not null default 0 check (display_order >= 0),
  is_public boolean not null default false,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  byte_size integer not null check (byte_size > 0 and byte_size <= 10485760),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/avif')),
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workshop_media_one_owner check (
    (workshop_definition_id is not null)::integer + (workshop_occurrence_id is not null)::integer = 1
  ),
  constraint workshop_media_public_alt check (not is_public or char_length(btrim(alt_text)) > 0)
);
create unique index uq_workshop_media_definition_hero on public.workshop_media (workshop_definition_id)
where workshop_definition_id is not null and media_role = 'hero';
create unique index uq_workshop_media_occurrence_hero on public.workshop_media (workshop_occurrence_id)
where workshop_occurrence_id is not null and media_role = 'hero';
create index idx_workshop_media_definition_order on public.workshop_media (workshop_definition_id, media_role, display_order);
create index idx_workshop_media_occurrence_order on public.workshop_media (workshop_occurrence_id, media_role, display_order);
create trigger trg_workshop_media_updated_at before update on public.workshop_media
for each row execute function public.set_updated_at();
alter table public.workshop_media enable row level security;
create policy workshop_media_internal_select on public.workshop_media for select to authenticated using (public.is_internal_crm_user());
create policy workshop_media_internal_insert on public.workshop_media for insert to authenticated with check (public.is_internal_crm_user());
create policy workshop_media_internal_update on public.workshop_media for update to authenticated using (public.is_internal_crm_user()) with check (public.is_internal_crm_user());
create policy workshop_media_internal_delete on public.workshop_media for delete to authenticated using (public.is_internal_crm_user());
revoke all on public.workshop_media from anon;
grant select, insert, update, delete on public.workshop_media to authenticated;
