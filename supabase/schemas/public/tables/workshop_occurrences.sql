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
    status <> 'published_open' or stripe_enabled
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
create trigger trg_workshop_occurrences_updated_at before update on public.workshop_occurrences
for each row execute function public.set_updated_at();
alter table public.workshop_occurrences enable row level security;
create policy workshop_occurrences_internal_select on public.workshop_occurrences for select to authenticated using (public.is_internal_crm_user());

create or replace function public.get_public_workshop_listing()
returns table (
  "slug" text,
  "title" text,
  "advertisingLine" text,
  "theme" text,
  "heroImageUrl" text,
  "heroAltText" text,
  "startAt" timestamptz,
  "endAt" timestamptz,
  "timezone" text,
  "venueName" text,
  "locality" text,
  "region" text,
  "priceMinor" bigint,
  "taxRegion" text,
  "taxRateBasisPoints" integer,
  "currency" text,
  "availability" text,
  "isFeatured" boolean,
  "featuredOrder" smallint,
  "updatedAt" timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select o.slug, o.title_snapshot, o.advertising_line_snapshot, d.theme,
    m.public_url, m.alt_text, o.start_at, o.end_at, o.timezone, o.venue_name,
    o.locality, o.region, o.price_minor, o.tax_region, o.tax_rate_basis_points, o.currency,
    case when o.registration_closes_at <= now() then 'closed' else 'available' end,
    o.is_featured, o.featured_order, o.updated_at
  from public.workshop_occurrences o
  join public.workshop_definitions d using (workshop_definition_id)
  join lateral (
    select wm.public_url, wm.alt_text
    from public.workshop_media wm
    where wm.is_public and wm.media_role = 'hero'
      and (
        wm.workshop_occurrence_id = o.workshop_occurrence_id
        or (wm.workshop_occurrence_id is null and wm.workshop_definition_id = o.workshop_definition_id)
      )
    order by (wm.workshop_occurrence_id is not null) desc
    limit 1
  ) m on true
  where o.status = 'published_open' and o.end_at > now()
  order by o.start_at;
$$;

create or replace function public.get_public_workshop_occurrence(p_slug text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'slug', o.slug,
    'title', o.title_snapshot,
    'advertisingLine', o.advertising_line_snapshot,
    'theme', d.theme,
    'description', o.description_snapshot,
    'includedMaterials', o.included_materials_snapshot,
    'accessibilityGuidance', d.accessibility_guidance,
    'contactGuidance', d.contact_guidance,
    'terms', o.terms_snapshot,
    'termsVersion', o.terms_version,
    'startAt', o.start_at,
    'endAt', o.end_at,
    'timezone', o.timezone,
    'venueName', o.venue_name,
    'addressLine1', o.address_line_1,
    'addressLine2', o.address_line_2,
    'locality', o.locality,
    'region', o.region,
    'postalCode', o.postal_code,
    'country', o.country,
    'priceMinor', o.price_minor,
    'taxRegion', o.tax_region,
    'taxRateBasisPoints', o.tax_rate_basis_points,
    'currency', o.currency,
    'perBookingLimit', o.per_booking_limit,
    'stripeEnabled', o.stripe_enabled,
    'venmoEnabled', o.venmo_enabled,
    'waitlistEligible', false,
    'availability', case when o.status <> 'published_open' or o.registration_closes_at <= now() then 'closed' else 'available' end,
    'isFeatured', o.is_featured,
    'featuredOrder', o.featured_order,
    'updatedAt', o.updated_at,
    'seoStatus', case
      when o.status in ('cancelled','rescheduled') and o.status_page_expires_at <= now() then 'redirect'
      when o.status = 'archived' then 'noindex'
      else 'index'
    end,
    'replacementUrl', r.slug,
    'redirectUrl', case when o.status_page_expires_at <= now() then '/workshops' else null end,
    'media', coalesce((
      select jsonb_agg(jsonb_build_object(
        'role', wm.media_role, 'url', wm.public_url, 'altText', wm.alt_text,
        'displayOrder', wm.display_order
      ) order by wm.media_role desc, wm.display_order)
      from public.workshop_media wm
      where wm.is_public and (
        wm.workshop_occurrence_id = o.workshop_occurrence_id
        or (
          wm.workshop_definition_id = o.workshop_definition_id
          and not exists (
            select 1 from public.workshop_media override_media
            where override_media.workshop_occurrence_id = o.workshop_occurrence_id
              and override_media.media_role = wm.media_role
          )
        )
      )
    ), '[]'::jsonb)
  )
  from public.workshop_occurrences o
  join public.workshop_definitions d using (workshop_definition_id)
  left join public.workshop_occurrences r
    on r.workshop_occurrence_id = o.replacement_occurrence_id
  where o.slug = p_slug
    and o.status in ('published_open','registration_closed','cancelled','rescheduled','completed');
$$;

revoke all on function public.get_public_workshop_listing() from public;
revoke all on function public.get_public_workshop_occurrence(text) from public;
grant execute on function public.get_public_workshop_listing() to anon, authenticated;
grant execute on function public.get_public_workshop_occurrence(text) to anon, authenticated;
revoke all on public.workshop_occurrences from anon;
grant select on public.workshop_occurrences to authenticated;
