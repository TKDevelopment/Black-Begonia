create or replace function public.workshop_public_series_slug(p_title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    pg_catalog.btrim(pg_catalog.left(
      pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.btrim(p_title)), '[^a-z0-9]+', '-', 'g'),
      80
    ), '-'),
    ''
  );
$$;

revoke all on function public.workshop_public_series_slug(text) from public;

create or replace function public.get_workshop_public_remaining_seats(
  p_workshop_occurrence_id uuid
) returns integer
language sql stable security definer set search_path = ''
as $$
  with facts as (
    select o.capacity,
      greatest(o.capacity - coalesce((
        select sum(h.quantity)
        from public.workshop_seat_holds h
        where h.workshop_occurrence_id = o.workshop_occurrence_id
          and (
            h.state = 'confirmed'
            or (h.state = 'active' and h.effective_expires_at > now())
          )
      ), 0), 0)::integer as remaining
    from public.workshop_occurrences o
    where o.workshop_occurrence_id = p_workshop_occurrence_id
  )
  select case
    when remaining > 0 and remaining * 2 <= capacity then remaining
    else null
  end
  from facts;
$$;

revoke all on function public.get_workshop_public_remaining_seats(uuid) from public;

create or replace function public.get_public_workshop_listing()
returns table (
  "slug" text, "seriesSlug" text, "workshopDate" text,
  "title" text, "advertisingLine" text, "theme" text,
  "heroImageUrl" text, "heroAltText" text, "startAt" timestamptz,
  "endAt" timestamptz, "timezone" text, "venueName" text,
  "locality" text, "region" text, "priceMinor" bigint, "currency" text,
  "availability" text, "remainingSeats" integer,
  "isFeatured" boolean, "featuredOrder" smallint,
  "updatedAt" timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select o.slug, public.workshop_public_series_slug(o.title_snapshot),
    o.local_start::date::text, o.title_snapshot, o.advertising_line_snapshot,
    d.theme, hero.public_url, hero.alt_text, o.start_at, o.end_at, o.timezone,
    o.venue_name, o.locality, o.region, o.price_minor, o.currency,
    public.get_workshop_public_availability(o.workshop_occurrence_id),
    public.get_workshop_public_remaining_seats(o.workshop_occurrence_id),
    o.is_featured, o.featured_order, o.updated_at
  from public.workshop_occurrences o
  join public.workshop_definitions d using (workshop_definition_id)
  join lateral (
    select wm.public_url, wm.alt_text
    from public.workshop_media wm
    where wm.is_public and wm.media_role = 'hero'
      and (
        wm.workshop_occurrence_id = o.workshop_occurrence_id
        or (
          wm.workshop_occurrence_id is null
          and wm.workshop_definition_id = o.workshop_definition_id
        )
      )
    order by (wm.workshop_occurrence_id is not null) desc
    limit 1
  ) hero on true
  where o.status = 'published_open'
    and o.end_at > now()
    and o.registration_closes_at > now()
  order by o.start_at, o.workshop_occurrence_id;
$$;

revoke all on function public.get_public_workshop_listing() from public;
grant execute on function public.get_public_workshop_listing() to anon, authenticated;
