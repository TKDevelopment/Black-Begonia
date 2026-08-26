create table public.workshop_series (
  workshop_series_id uuid primary key default gen_random_uuid(),
  workshop_definition_id uuid not null references public.workshop_definitions(workshop_definition_id) on delete restrict,
  series_label text not null check (char_length(btrim(series_label)) between 1 and 160),
  default_capacity integer not null check (default_capacity > 0),
  default_price_minor bigint not null check (default_price_minor >= 0),
  default_currency text not null default 'USD' check (default_currency = 'USD'),
  default_venue_name text not null,
  default_address_line_1 text not null,
  default_address_line_2 text null,
  default_locality text not null,
  default_region text not null,
  default_postal_code text not null,
  default_country text not null default 'US',
  default_timezone text not null,
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_workshop_series_definition on public.workshop_series (workshop_definition_id);
create trigger trg_workshop_series_updated_at before update on public.workshop_series
for each row execute function public.set_updated_at();
alter table public.workshop_series enable row level security;
create policy workshop_series_internal_select on public.workshop_series for select to authenticated using (public.is_internal_crm_user());
create policy workshop_series_internal_insert on public.workshop_series for insert to authenticated with check (public.is_internal_crm_user());
create policy workshop_series_internal_update on public.workshop_series for update to authenticated using (public.is_internal_crm_user()) with check (public.is_internal_crm_user());
create policy workshop_series_internal_delete on public.workshop_series for delete to authenticated using (public.is_internal_crm_user());
revoke all on public.workshop_series from anon;
grant select, insert, update, delete on public.workshop_series to authenticated;
