create or replace function public.enforce_project_proposal_document_immutability()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    if current_user = 'postgres'
       and current_setting('app.project_cascade_delete', true) = 'on' then
      return old;
    end if;

    raise exception 'Submitted proposal documents cannot be deleted.' using errcode = '55000';
  end if;

  if (to_jsonb(new) - array['is_active', 'status']) is distinct from
     (to_jsonb(old) - array['is_active', 'status']) then
    raise exception 'Submitted proposal document content is immutable.' using errcode = '55000';
  end if;

  if old.is_active = true and new.is_active = false
     and old.status = 'submitted' and new.status = 'superseded'
     and current_user = 'postgres'
     and current_setting('app.proposal_revision_activation', true) = 'on' then
    return new;
  end if;

  if new.is_active is not distinct from old.is_active
     and new.status is not distinct from old.status then
    return new;
  end if;

  raise exception 'Proposal document lifecycle changes require controlled finalization.' using errcode = '42501';
end;
$$;

create trigger trg_project_proposal_document_immutability
before update or delete on public.project_proposal_document_versions
for each row execute function public.enforce_project_proposal_document_immutability();
