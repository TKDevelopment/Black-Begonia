create table public.workshop_occurrences (
  workshop_occurrence_id uuid primary key default gen_random_uuid(),
  workshop_definition_id uuid not null references public.workshop_definitions(workshop_definition_id) on delete restrict,
  workshop_series_id uuid null references public.workshop_series(workshop_series_id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'draft' check (status in (
    'draft','published_open','registration_closed','cancelled','rescheduled','completed','archived'
  )),
  title_snapshot text not null check (char_length(btrim(title_snapshot)) between 1 and 160),
  advertising_line_snapshot text not null check (char_length(btrim(advertising_line_snapshot)) between 1 and 240),
  description_snapshot text not null,
  included_materials_snapshot text not null,
  terms_snapshot text not null,
  terms_version integer not null check (terms_version > 0),
  venue_name text not null,
  address_line_1 text not null,
  address_line_2 text null,
  locality text not null,
  region text not null,
  postal_code text not null,
  country text not null default 'US',
  timezone text not null,
  local_start timestamp not null,
  local_end timestamp not null,
  utc_offset_minutes smallint not null check (utc_offset_minutes between -840 and 840),
  start_at timestamptz not null,
  end_at timestamptz not null,
  registration_opens_at timestamptz not null,
  registration_closes_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  per_booking_limit integer not null check (per_booking_limit > 0 and per_booking_limit <= capacity),
  price_minor bigint not null check (price_minor >= 0),
  tax_region text not null default 'RI' check (tax_region in ('RI','CT','MA')),
  tax_rate_basis_points integer not null default 700 check (tax_rate_basis_points in (700,635,625)),
  currency text not null default 'USD' check (currency = 'USD'),
  stripe_price_version_id uuid null references public.workshop_stripe_price_versions(workshop_stripe_price_version_id) on delete restrict,
  stripe_enabled boolean not null default false,
  external_checkout_url text null,
  constraint workshop_occurrences_external_checkout_url check (
    external_checkout_url is null or (
      char_length(external_checkout_url) between 1 and 2048
      and external_checkout_url ~* '^https://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]\\]*)?$'
    )
  ),
  constraint workshop_occurrences_external_checkout_mode check (
    external_checkout_url is null or (not stripe_enabled and not waitlist_enabled)
  ),
  venmo_enabled boolean not null default false,
  waitlist_enabled boolean not null default false,
  waitlist_offer_duration_minutes integer not null default 1440 check (waitlist_offer_duration_minutes between 60 and 4320),
  is_featured boolean not null default false,
  featured_order smallint null check (featured_order >= 0),
  published_at timestamptz null,
  completed_at timestamptz null,
  cancelled_at timestamptz null,
  archived_at timestamptz null,
  replacement_occurrence_id uuid null references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  status_page_expires_at timestamptz null,
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workshop_occurrences_time_order check (
    local_end > local_start and end_at > start_at
    and registration_closes_at > registration_opens_at
    and registration_closes_at <= start_at
  ),
  constraint workshop_occurrences_stripe_price check (
    not stripe_enabled or stripe_price_version_id is not null
  ),
  constraint workshop_occurrences_stripe_only check (
    not venmo_enabled
  ),
  constraint workshop_occurrences_open_requires_stripe check (
    status <> 'published_open' or stripe_enabled or external_checkout_url is not null
  ),
  constraint workshop_occurrences_tax_region_rate check (
    (tax_region = 'RI' and tax_rate_basis_points = 700)
    or (tax_region = 'CT' and tax_rate_basis_points = 635)
    or (tax_region = 'MA' and tax_rate_basis_points = 625)
  ),
  constraint workshop_occurrences_replacement check (
    replacement_occurrence_id is null or replacement_occurrence_id <> workshop_occurrence_id
  )
);
create index idx_workshop_occurrences_public on public.workshop_occurrences (status, start_at);
create index idx_workshop_occurrences_series on public.workshop_occurrences (workshop_series_id, start_at);
create index idx_workshop_occurrences_featured on public.workshop_occurrences (is_featured, featured_order, start_at);
create index crm_calendar_workshop_local_range on public.workshop_occurrences (local_start, local_end);
create trigger trg_workshop_occurrences_updated_at before update on public.workshop_occurrences
for each row execute function public.set_updated_at();
create trigger trg_crm_calendar_workshops after insert or update or delete on public.workshop_occurrences
  for each row execute function public.enqueue_crm_calendar_source_change();
alter table public.workshop_occurrences enable row level security;
create policy workshop_occurrences_internal_select on public.workshop_occurrences for select to authenticated using (public.is_internal_crm_user());

-- Public RPC definitions live in schemas/public/functions; keep this table
-- definition free of stale duplicate function signatures and return shapes.
revoke all on public.workshop_occurrences from anon;
grant select on public.workshop_occurrences to authenticated;
