create or replace function public.get_public_workshop_sitemap()
returns table (
  "slug" text,
  "lastmod" timestamptz,
  "lifecycleStatus" text,
  "seoStatus" text
)
language sql stable security definer set search_path = ''
as $$
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
