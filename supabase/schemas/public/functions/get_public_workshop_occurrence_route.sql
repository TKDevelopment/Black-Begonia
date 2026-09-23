create or replace function public.get_public_workshop_occurrence_route(
  p_series_slug text,
  p_workshop_date text
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_occurrence public.workshop_occurrences;
  v_result jsonb;
  v_current_url text;
begin
  select o.* into v_occurrence
  from public.workshop_occurrences o
  where public.workshop_public_series_slug(o.title_snapshot)=p_series_slug
    and o.local_start::date::text=p_workshop_date
    and o.status in(
      'published_open','registration_closed','cancelled','rescheduled','completed'
    )
  order by o.start_at,o.workshop_occurrence_id
  limit 1;

  if found then
    return public.get_public_workshop_occurrence(v_occurrence.slug)
      ||jsonb_build_object(
        'seriesSlug',public.workshop_public_series_slug(
          v_occurrence.title_snapshot
        ),
        'workshopDate',v_occurrence.local_start::date::text,
        'replacementUrl',case when v_occurrence.replacement_occurrence_id is not null
          then (select '/workshops/'
            ||public.workshop_public_series_slug(r.title_snapshot)||'/'
            ||r.local_start::date::text
            from public.workshop_occurrences r
            where r.workshop_occurrence_id=
              v_occurrence.replacement_occurrence_id)
          else null end
      );
  end if;

  select o.* into v_occurrence
  from public.workshop_occurrence_route_aliases a
  join public.workshop_occurrences o using(workshop_occurrence_id)
  where a.series_slug=p_series_slug
    and a.workshop_date::text=p_workshop_date
    and o.status in('published_open','registration_closed')
  order by a.created_at desc
  limit 1;
  if not found then return null; end if;

  v_current_url:='/workshops/'
    ||public.workshop_public_series_slug(v_occurrence.title_snapshot)||'/'
    ||v_occurrence.local_start::date::text;
  v_result:=public.get_public_workshop_occurrence(v_occurrence.slug);
  return v_result||jsonb_build_object(
    'seriesSlug',public.workshop_public_series_slug(v_occurrence.title_snapshot),
    'workshopDate',v_occurrence.local_start::date::text,
    'seoStatus','redirect',
    'redirectUrl',v_current_url
  );
end;
$$;

revoke all on function public.get_public_workshop_occurrence_route(text,text)
from public;
grant execute on function public.get_public_workshop_occurrence_route(text,text)
to anon,authenticated;
