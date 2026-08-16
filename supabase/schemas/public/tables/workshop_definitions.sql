create table public.workshop_definitions (
  workshop_definition_id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  theme text not null check (char_length(btrim(theme)) between 1 and 80),
  advertising_line text not null check (char_length(btrim(advertising_line)) between 1 and 240),
  description text not null check (char_length(btrim(description)) between 1 and 10000),
  included_materials text not null default '',
  accessibility_guidance text null,
  contact_guidance text null,
  default_terms text not null default '',
  default_terms_version integer not null default 1 check (default_terms_version > 0),
  default_currency text not null default 'USD' check (default_currency = 'USD'),
  is_reusable boolean not null default false,
  reusable_retired_at timestamptz null,
  stripe_product_id text null unique,
  stripe_catalog_state text not null default 'not_configured'
    check (stripe_catalog_state in ('not_configured','pending','ready','failed')),
  stripe_catalog_error text null,
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_workshop_definitions_title on public.workshop_definitions (title);
create trigger trg_workshop_definitions_updated_at before update on public.workshop_definitions
for each row execute function public.set_updated_at();
alter table public.workshop_definitions enable row level security;
create policy workshop_definitions_internal_select on public.workshop_definitions
for select to authenticated using (public.is_internal_crm_user());
create policy workshop_definitions_internal_insert on public.workshop_definitions
for insert to authenticated with check (public.is_internal_crm_user());
create policy workshop_definitions_internal_update on public.workshop_definitions
for update to authenticated using (public.is_internal_crm_user()) with check (public.is_internal_crm_user());
create policy workshop_definitions_internal_delete on public.workshop_definitions
for delete to authenticated using (public.is_internal_crm_user());
revoke all on public.workshop_definitions from anon;
grant select, insert, update, delete on public.workshop_definitions to authenticated;
