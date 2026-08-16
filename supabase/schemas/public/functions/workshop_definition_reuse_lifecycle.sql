create or replace function public.promote_published_workshop_definition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published_open' and new.published_at is not null then
    update public.workshop_definitions
    set is_reusable = true,
        updated_by = coalesce(new.updated_by, auth.uid())
    where workshop_definition_id = new.workshop_definition_id
      and not is_reusable
      and reusable_retired_at is null;
  end if;
  return new;
end;
$$;

revoke all on function public.promote_published_workshop_definition() from public;

create trigger trg_promote_published_workshop_definition
after insert or update of status, published_at on public.workshop_occurrences
for each row execute function public.promote_published_workshop_definition();
