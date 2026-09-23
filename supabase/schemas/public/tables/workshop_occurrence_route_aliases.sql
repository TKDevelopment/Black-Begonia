create table public.workshop_occurrence_route_aliases (
  workshop_occurrence_route_alias_id uuid primary key default gen_random_uuid(),
  workshop_occurrence_id uuid not null
    references public.workshop_occurrences(workshop_occurrence_id)
    on delete restrict,
  series_slug text not null,
  workshop_date date not null,
  created_at timestamptz not null default now(),
  unique(series_slug,workshop_date)
);

create index idx_workshop_occurrence_route_aliases_occurrence
on public.workshop_occurrence_route_aliases(workshop_occurrence_id);

alter table public.workshop_occurrence_route_aliases enable row level security;
create policy workshop_occurrence_route_aliases_internal_select
on public.workshop_occurrence_route_aliases for select to authenticated
using(public.is_internal_crm_user());
revoke all on public.workshop_occurrence_route_aliases from anon;
grant select on public.workshop_occurrence_route_aliases to authenticated;
