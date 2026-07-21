create or replace function public.enforce_project_proposal_snapshot_immutability()
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

    raise exception 'Submitted proposal invoice snapshots cannot be deleted.' using errcode = '55000';
  end if;

  if (to_jsonb(new) - 'is_active') is distinct from (to_jsonb(old) - 'is_active') then
    raise exception 'Submitted proposal invoice snapshot content is immutable.' using errcode = '55000';
  end if;

  if old.is_active = true and new.is_active = false
     and current_user = 'postgres'
     and current_setting('app.proposal_revision_activation', true) = 'on' then
    return new;
  end if;

  if new.is_active is not distinct from old.is_active then
    return new;
  end if;

  raise exception 'Proposal snapshot lifecycle changes require controlled finalization.' using errcode = '42501';
end;
$$;

create trigger trg_project_proposal_snapshot_immutability
before update or delete on public.project_proposal_invoice_snapshots
for each row execute function public.enforce_project_proposal_snapshot_immutability();
