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

drop function public.get_public_workshop_listing();
create function public.get_public_workshop_listing()
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

create or replace function public.get_public_workshop_occurrence(p_slug text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'slug', o.slug,
    'seriesSlug', public.workshop_public_series_slug(o.title_snapshot),
    'workshopDate', o.local_start::date::text,
    'title', o.title_snapshot,
    'advertisingLine', o.advertising_line_snapshot, 'theme', d.theme,
    'heroImageUrl', hero.public_url, 'heroAltText', hero.alt_text,
    'lifecycleStatus', o.status, 'description', o.description_snapshot,
    'includedMaterials', o.included_materials_snapshot,
    'accessibilityGuidance', d.accessibility_guidance,
    'contactGuidance', d.contact_guidance, 'terms', o.terms_snapshot,
    'termsVersion', o.terms_version, 'startAt', o.start_at, 'endAt', o.end_at,
    'timezone', o.timezone, 'venueName', o.venue_name,
    'addressLine1', o.address_line_1, 'addressLine2', o.address_line_2,
    'locality', o.locality, 'region', o.region, 'postalCode', o.postal_code,
    'country', o.country, 'priceMinor', o.price_minor, 'currency', o.currency,
    'perBookingLimit', o.per_booking_limit, 'stripeEnabled', o.stripe_enabled,
    'venmoEnabled', o.venmo_enabled, 'waitlistEligible', false,
    'availability', public.get_workshop_public_availability(
      o.workshop_occurrence_id
    ),
    'remainingSeats', public.get_workshop_public_remaining_seats(
      o.workshop_occurrence_id
    ),
    'isFeatured', o.is_featured, 'featuredOrder', o.featured_order,
    'updatedAt', o.updated_at,
    'seoStatus', case
      when o.status in ('cancelled','rescheduled') and o.status_page_expires_at <= now() then 'redirect'
      when o.status in ('cancelled','rescheduled') then 'noindex'
      else 'index'
    end,
    'replacementUrl', case when replacement.slug is not null
      then '/workshops/' || public.workshop_public_series_slug(replacement.title_snapshot)
        || '/' || replacement.local_start::date::text else null end,
    'replacementStartAt', replacement.start_at,
    'replacementEndAt', replacement.end_at,
    'redirectUrl', case when o.status_page_expires_at <= now()
      then coalesce(
        '/workshops/' || public.workshop_public_series_slug(replacement.title_snapshot)
          || '/' || replacement.local_start::date::text,
        '/workshops'
      ) else null end,
    'media', coalesce((
      select jsonb_agg(jsonb_build_object(
        'role', wm.media_role, 'url', wm.public_url, 'altText', wm.alt_text,
        'displayOrder', wm.display_order
      ) order by case wm.media_role when 'hero' then 0 else 1 end, wm.display_order)
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
    order by (wm.workshop_occurrence_id is not null) desc limit 1
  ) hero on true
  left join public.workshop_occurrences replacement
    on replacement.workshop_occurrence_id = o.replacement_occurrence_id
  where o.slug = p_slug
    and o.status in (
      'published_open','registration_closed','cancelled','rescheduled','completed'
    );
$$;

revoke all on function public.get_public_workshop_occurrence(text) from public;
grant execute on function public.get_public_workshop_occurrence(text) to anon, authenticated;
