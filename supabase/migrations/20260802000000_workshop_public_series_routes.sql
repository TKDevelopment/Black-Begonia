-- Present public workshops as title-driven series with date-specific occurrences.
-- This migration is additive to the workshop schema slices and preserves the
-- occurrence UUID/slug as the authoritative booking identifier.

create or replace function public.workshop_public_series_slug(p_title text)
returns text language sql immutable set search_path = '' as $$
  select nullif(
    pg_catalog.btrim(pg_catalog.left(
      pg_catalog.regexp_replace(
        pg_catalog.lower(pg_catalog.btrim(p_title)), '[^a-z0-9]+', '-', 'g'
      ),
      80
    ), '-'),
    ''
  );
$$;

revoke all on function public.workshop_public_series_slug(text) from public;

drop function public.get_public_workshop_listing();
create function public.get_public_workshop_listing()
returns table (
  "slug" text, "seriesSlug" text, "workshopDate" text,
  "title" text, "advertisingLine" text, "theme" text,
  "heroImageUrl" text, "heroAltText" text, "startAt" timestamptz,
  "endAt" timestamptz, "timezone" text, "venueName" text,
  "locality" text, "region" text, "priceMinor" bigint, "currency" text,
  "availability" text, "isFeatured" boolean, "featuredOrder" smallint,
  "updatedAt" timestamptz
)
language sql stable security definer set search_path = '' as $$
  select o.slug, public.workshop_public_series_slug(o.title_snapshot),
    o.local_start::date::text, o.title_snapshot, o.advertising_line_snapshot,
    d.theme, hero.public_url, hero.alt_text, o.start_at, o.end_at, o.timezone,
    o.venue_name, o.locality, o.region, o.price_minor, o.currency,
    public.get_workshop_public_availability(o.workshop_occurrence_id),
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

create or replace function public.get_public_workshop_occurrence_route(
  p_series_slug text,
  p_workshop_date text
) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.get_public_workshop_occurrence(o.slug) || jsonb_build_object(
    'seriesSlug', public.workshop_public_series_slug(o.title_snapshot),
    'workshopDate', o.local_start::date::text,
    'replacementUrl', case when replacement.slug is not null
      then '/workshops/' || public.workshop_public_series_slug(replacement.title_snapshot)
        || '/' || replacement.local_start::date::text else null end,
    'redirectUrl', case when o.status_page_expires_at <= now()
      then coalesce(
        '/workshops/' || public.workshop_public_series_slug(replacement.title_snapshot)
          || '/' || replacement.local_start::date::text,
        '/workshops'
      ) else null end
  )
  from public.workshop_occurrences o
  left join public.workshop_occurrences replacement
    on replacement.workshop_occurrence_id = o.replacement_occurrence_id
  where public.workshop_public_series_slug(o.title_snapshot) = p_series_slug
    and o.local_start::date::text = p_workshop_date
    and o.status in (
      'published_open','registration_closed','cancelled','rescheduled','completed'
    )
  order by o.start_at, o.workshop_occurrence_id
  limit 1;
$$;

revoke all on function public.get_public_workshop_occurrence_route(text,text) from public;
grant execute on function public.get_public_workshop_occurrence_route(text,text)
  to anon, authenticated;

create or replace function public.get_public_workshop_sitemap()
returns table (
  "slug" text, "lastmod" timestamptz,
  "lifecycleStatus" text, "seoStatus" text
)
language sql stable security definer set search_path = '' as $$
  with eligible as (
    select o.*,
      public.workshop_public_series_slug(o.title_snapshot) as series_slug,
      case when o.status in ('cancelled', 'rescheduled') then 'noindex' else 'index' end
        as seo_status
    from public.workshop_occurrences o
    where (
      o.status in ('published_open', 'registration_closed', 'completed')
      or (
        o.status in ('cancelled', 'rescheduled')
        and o.status_page_expires_at > now()
      )
    )
    and exists (
      select 1 from public.workshop_media wm
      where wm.is_public and wm.media_role = 'hero'
        and (
          wm.workshop_occurrence_id = o.workshop_occurrence_id
          or (
            wm.workshop_occurrence_id is null
            and wm.workshop_definition_id = o.workshop_definition_id
          )
        )
    )
  ), routes as (
    select e.series_slug as slug, max(e.updated_at) as lastmod,
      'series'::text as lifecycle_status, 'index'::text as seo_status
    from eligible e
    where e.status in ('published_open', 'registration_closed')
      and e.end_at > now()
    group by e.series_slug
    union all
    select e.series_slug || '/' || e.local_start::date::text,
      e.updated_at, e.status::text, e.seo_status
    from eligible e
  )
  select r.slug, r.lastmod, r.lifecycle_status, r.seo_status
  from routes r
  order by r.slug;
$$;

revoke all on function public.get_public_workshop_sitemap() from public;
grant execute on function public.get_public_workshop_sitemap() to anon, authenticated;

create or replace function public.get_workshop_booking_status(
  p_status_token_digest text
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_booking public.workshop_bookings;
  v_occurrence public.workshop_occurrences;
  v_attempt public.workshop_payment_attempts;
  v_response public.workshop_reschedule_responses;
  v_source public.workshop_occurrences;
  v_replacement public.workshop_occurrences;
begin
  if char_length(coalesce(p_status_token_digest, '')) < 43 then
    return jsonb_build_object('state', 'unavailable');
  end if;

  select * into v_booking from public.workshop_bookings
  where status_token_digest = p_status_token_digest
    and status_token_expires_at > now();
  if not found then return jsonb_build_object('state', 'unavailable'); end if;

  select * into v_occurrence from public.workshop_occurrences
  where workshop_occurrence_id = v_booking.workshop_occurrence_id;
  select * into v_attempt from public.workshop_payment_attempts
  where workshop_booking_id = v_booking.workshop_booking_id
  order by created_at desc limit 1;

  if v_booking.status in ('confirmed', 'checked_in', 'transferred')
    and v_booking.payment_state in ('paid', 'partially_refunded') then
    return jsonb_build_object(
      'state', 'confirmed',
      'publicWorkshopPath', '/workshops/'
        || public.workshop_public_series_slug(v_occurrence.title_snapshot)
        || '/' || v_occurrence.local_start::date::text
    );
  end if;
  if v_booking.payment_state = 'refunded' then
    return jsonb_build_object('state', 'refunded');
  end if;
  if v_booking.status = 'cancelled' then
    return jsonb_build_object('state', 'cancelled');
  end if;
  if v_booking.status = 'expired' then
    return jsonb_build_object('state', 'expired');
  end if;

  if v_booking.status = 'transfer_action_required' then
    select * into v_response from public.workshop_reschedule_responses
    where workshop_booking_id=v_booking.workshop_booking_id
      and response in('pending','expired')
    order by created_at desc limit 1;
    if found then
      select * into v_source from public.workshop_occurrences
      where workshop_occurrence_id=v_response.source_occurrence_id;
      select * into v_replacement from public.workshop_occurrences
      where workshop_occurrence_id=v_response.replacement_occurrence_id;
      return jsonb_build_object(
        'state','action_required','action','reschedule',
        'responseState',v_response.response,
        'responseDeadline',v_response.response_token_expires_at,
        'sourceTitle',v_source.title_snapshot,
        'sourceStartAt',v_source.start_at,
        'replacementTitle',v_replacement.title_snapshot,
        'replacementStartAt',v_replacement.start_at,
        'replacementVenue',v_replacement.venue_name,
        'protectedQuantity',v_response.protected_quantity
      );
    end if;
  end if;

  if v_booking.payment_state in ('exception', 'disputed', 'reversed')
    or v_booking.status in ('payment_disputed', 'transfer_action_required') then
    return jsonb_build_object('state', 'action_required');
  end if;
  if v_booking.payment_state = 'processing' or v_attempt.state = 'processing' then
    return jsonb_build_object(
      'state', 'processing', 'supportReference', v_booking.booking_reference
    );
  end if;
  if v_booking.payment_method = 'direct_venmo'
    and v_attempt.state = 'active'
    and v_attempt.effective_expires_at > now() then
    return jsonb_build_object(
      'state', 'pending_venmo',
      'supportReference', v_booking.booking_reference,
      'expiresAt', v_attempt.effective_expires_at
    );
  end if;
  return jsonb_build_object('state', 'unavailable');
end;
$$;

revoke all on function public.get_workshop_booking_status(text) from public;
grant execute on function public.get_workshop_booking_status(text) to service_role;

-- Rollback: restore the previous listing/detail/status projections from the
-- corresponding declarative schema files and drop workshop_public_series_slug.
