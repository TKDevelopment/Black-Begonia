create or replace function public.allocate_workshop_occurrence_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base_slug text := pg_catalog.lower(pg_catalog.btrim(new.slug));
  v_candidate_slug text;
  v_suffix integer := 1;
begin
  if v_base_slug is null or v_base_slug = '' then
    return new;
  end if;

  -- Serialize allocation for a requested base slug so concurrent series saves
  -- cannot select the same available suffix before the unique index is updated.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_base_slug, 0)
  );

  v_candidate_slug := v_base_slug;
  while exists (
    select 1
    from public.workshop_occurrences existing
    where existing.slug = v_candidate_slug
      and existing.workshop_occurrence_id is distinct from new.workshop_occurrence_id
  ) loop
    v_suffix := v_suffix + 1;
    v_candidate_slug := v_base_slug || '-' || v_suffix::text;
  end loop;

  new.slug := v_candidate_slug;
  return new;
end;
$$;

revoke all on function public.allocate_workshop_occurrence_slug() from public;

drop trigger if exists allocate_workshop_occurrence_slug
  on public.workshop_occurrences;
create trigger allocate_workshop_occurrence_slug
before insert or update of slug on public.workshop_occurrences
for each row execute function public.allocate_workshop_occurrence_slug();
