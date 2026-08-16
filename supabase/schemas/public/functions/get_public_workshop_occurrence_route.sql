create or replace function public.get_public_workshop_occurrence_route(
  p_series_slug text,
  p_workshop_date text
) returns jsonb
language sql stable security definer set search_path = ''
as $$
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
grant execute on function public.get_public_workshop_occurrence_route(text,text) to anon, authenticated;
