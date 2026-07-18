begin;

-- Apply after 20260718000000_project_details_workflow.sql and
-- 20260718000001_project_document_version_status.sql. Unsafe legacy pointer
-- states are reported instead of rewritten by recency.
do $$
declare
  invalid_projects integer;
begin
  select count(*) into invalid_projects
  from public.projects p
  where p.active_proposal_invoice_snapshot_id is not null
    and not exists (
      select 1 from public.project_proposal_invoice_snapshots s
      where s.project_proposal_invoice_snapshot_id = p.active_proposal_invoice_snapshot_id
        and s.project_id = p.project_id
        and s.is_active = true
    );

  if invalid_projects > 0 then
    raise notice '% project(s) have an invalid active invoice snapshot pointer and must be repaired before revision.', invalid_projects;
  end if;
end;
$$;

alter table public.project_proposal_invoice_snapshots
  add column if not exists submission_idempotency_key uuid null;

alter table public.project_proposal_document_versions
  add column if not exists submission_idempotency_key uuid null;

create unique index if not exists idx_project_invoice_snapshots_submission_key
on public.project_proposal_invoice_snapshots (submission_idempotency_key)
where submission_idempotency_key is not null;

create unique index if not exists idx_project_document_versions_submission_key
on public.project_proposal_document_versions (submission_idempotency_key)
where submission_idempotency_key is not null;

create table if not exists public.project_proposal_revision_workspaces (
  project_proposal_revision_workspace_id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(project_id) on delete cascade,
  baseline_invoice_snapshot_id uuid not null references public.project_proposal_invoice_snapshots(project_proposal_invoice_snapshot_id) on delete restrict,
  source_lead_id uuid null references public.leads(lead_id) on delete set null,
  schema_version integer not null default 2 check (schema_version > 0),
  draft_snapshot jsonb not null,
  subtotal numeric(12, 2) not null default 0,
  tax_rate numeric(8, 4) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  retainer_amount numeric(12, 2) not null default 0,
  final_balance_amount numeric(12, 2) not null default 0,
  retainer_due_date date null,
  final_balance_due_date date null,
  pending_submission_key uuid null,
  pending_pdf_storage_path text null,
  pending_pdf_file_name text null,
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_proposal_revision_workspace_pending_metadata_check check (
    (pending_submission_key is null and pending_pdf_storage_path is null and pending_pdf_file_name is null)
    or
    (pending_submission_key is not null and pending_pdf_storage_path is not null and pending_pdf_file_name is not null)
  )
);

create index if not exists idx_project_proposal_revision_workspaces_baseline
on public.project_proposal_revision_workspaces (baseline_invoice_snapshot_id);

drop trigger if exists trg_project_proposal_revision_workspaces_updated_at
on public.project_proposal_revision_workspaces;
create trigger trg_project_proposal_revision_workspaces_updated_at
before update on public.project_proposal_revision_workspaces
for each row execute function public.set_updated_at();

alter table public.project_proposal_revision_workspaces enable row level security;

drop policy if exists "internal crm users select proposal revision workspaces" on public.project_proposal_revision_workspaces;
create policy "internal crm users select proposal revision workspaces"
on public.project_proposal_revision_workspaces for select to authenticated
using (public.is_internal_crm_user());

drop policy if exists "internal crm users insert proposal revision workspaces" on public.project_proposal_revision_workspaces;
create policy "internal crm users insert proposal revision workspaces"
on public.project_proposal_revision_workspaces for insert to authenticated
with check (public.is_internal_crm_user());

drop policy if exists "internal crm users update proposal revision workspaces" on public.project_proposal_revision_workspaces;
create policy "internal crm users update proposal revision workspaces"
on public.project_proposal_revision_workspaces for update to authenticated
using (public.is_internal_crm_user()) with check (public.is_internal_crm_user());

drop policy if exists "internal crm users discard proposal revision workspaces" on public.project_proposal_revision_workspaces;
create policy "internal crm users discard proposal revision workspaces"
on public.project_proposal_revision_workspaces for delete to authenticated
using (public.is_internal_crm_user());

drop policy if exists "internal crm users update project proposal invoice snapshots" on public.project_proposal_invoice_snapshots;
drop policy if exists "internal crm users delete project proposal invoice snapshots" on public.project_proposal_invoice_snapshots;
drop policy if exists "internal crm users update project proposal document versions" on public.project_proposal_document_versions;
drop policy if exists "internal crm users delete project proposal document versions" on public.project_proposal_document_versions;
drop policy if exists "internal crm users update project proposal pdfs" on storage.objects;
drop policy if exists "internal crm users delete project proposal pdfs" on storage.objects;

create or replace function public.enforce_project_proposal_snapshot_immutability()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if tg_op = 'DELETE' then
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
  if new.is_active is not distinct from old.is_active then return new; end if;
  raise exception 'Proposal snapshot lifecycle changes require controlled finalization.' using errcode = '42501';
end;
$$;

create or replace function public.enforce_project_proposal_document_immutability()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if tg_op = 'DELETE' then
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
  if new.is_active is not distinct from old.is_active and new.status is not distinct from old.status then return new; end if;
  raise exception 'Proposal document lifecycle changes require controlled finalization.' using errcode = '42501';
end;
$$;

drop trigger if exists trg_project_proposal_snapshot_immutability on public.project_proposal_invoice_snapshots;
create trigger trg_project_proposal_snapshot_immutability
before update or delete on public.project_proposal_invoice_snapshots
for each row execute function public.enforce_project_proposal_snapshot_immutability();

drop trigger if exists trg_project_proposal_document_immutability on public.project_proposal_document_versions;
create trigger trg_project_proposal_document_immutability
before update or delete on public.project_proposal_document_versions
for each row execute function public.enforce_project_proposal_document_immutability();

create or replace function public.finalize_project_proposal_revision(
  p_project_id uuid, p_workspace_id uuid, p_baseline_snapshot_id uuid,
  p_idempotency_key uuid, p_pdf_bucket text, p_pdf_storage_path text,
  p_pdf_file_name text, p_pdf_content_type text, p_pdf_file_size_bytes bigint,
  p_submitted_by uuid, p_submitted_at timestamptz default now()
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_project public.projects%rowtype;
  v_workspace public.project_proposal_revision_workspaces%rowtype;
  v_baseline public.project_proposal_invoice_snapshots%rowtype;
  v_existing_snapshot public.project_proposal_invoice_snapshots%rowtype;
  v_existing_document public.project_proposal_document_versions%rowtype;
  v_new_snapshot_id uuid; v_new_document_id uuid; v_version integer;
  v_active_snapshot_count integer; v_line_count integer; v_total_line_count integer;
  v_json_subtotal numeric(12,2); v_json_tax_amount numeric(12,2); v_json_total numeric(12,2);
begin
  if p_idempotency_key is null then raise exception 'A submission idempotency key is required.' using errcode = '22023'; end if;
  select * into v_project from public.projects where project_id = p_project_id for update;
  if not found then raise exception 'The selected project could not be found.' using errcode = 'P0002'; end if;

  select * into v_existing_snapshot from public.project_proposal_invoice_snapshots where submission_idempotency_key = p_idempotency_key;
  if found then
    select * into v_existing_document from public.project_proposal_document_versions where submission_idempotency_key = p_idempotency_key;
    if not found or v_existing_snapshot.project_id <> p_project_id then
      raise exception 'The completed submission key does not match this project.' using errcode = '23505';
    end if;
    return jsonb_build_object('success', true, 'project_id', v_existing_snapshot.project_id,
      'revision_workspace_id', p_workspace_id, 'proposal_document_version_id', v_existing_document.project_proposal_document_version_id,
      'active_invoice_snapshot_id', v_existing_snapshot.project_proposal_invoice_snapshot_id,
      'version', v_existing_snapshot.version, 'signed_pdf_storage_path', v_existing_document.storage_path,
      'submitted_at', v_existing_document.submitted_at, 'idempotent_replay', true);
  end if;

  if v_project.status in ('completed'::public.project_status, 'canceled'::public.project_status) then
    raise exception 'Completed or canceled projects cannot be revised.' using errcode = '55000';
  end if;
  if v_project.event_date is null then
    raise exception 'The project requires an event date before proposal finalization.' using errcode = '22023';
  end if;
  select * into v_workspace from public.project_proposal_revision_workspaces
  where project_proposal_revision_workspace_id = p_workspace_id and project_id = p_project_id for update;
  if not found then raise exception 'The proposal revision workspace could not be found.' using errcode = 'P0002'; end if;
  if v_workspace.pending_submission_key is distinct from p_idempotency_key
     or v_workspace.pending_pdf_storage_path is distinct from p_pdf_storage_path
     or v_workspace.pending_pdf_file_name is distinct from p_pdf_file_name then
    raise exception 'The saved revision pending submission does not match the finalization request.' using errcode = '40001';
  end if;
  if v_workspace.baseline_invoice_snapshot_id <> p_baseline_snapshot_id
     or v_project.active_proposal_invoice_snapshot_id <> p_baseline_snapshot_id then
    raise exception 'The active proposal changed after this revision started.' using errcode = '40001';
  end if;
  select * into v_baseline from public.project_proposal_invoice_snapshots
  where project_proposal_invoice_snapshot_id = p_baseline_snapshot_id and project_id = p_project_id and is_active for update;
  if not found then raise exception 'The revision baseline is not the active project snapshot.' using errcode = '40001'; end if;
  select count(*) into v_active_snapshot_count from public.project_proposal_invoice_snapshots where project_id = p_project_id and is_active;
  if v_active_snapshot_count <> 1 then raise exception 'The project must have exactly one active invoice snapshot.' using errcode = '55000'; end if;

  if v_workspace.schema_version <> 2 or coalesce((v_workspace.draft_snapshot->>'schema_version')::integer, 0) <> 2
     or jsonb_typeof(v_workspace.draft_snapshot->'line_items') <> 'array'
     or jsonb_typeof(v_workspace.draft_snapshot->'tax_region') <> 'object'
     or jsonb_typeof(v_workspace.draft_snapshot->'totals') <> 'object' then
    raise exception 'The saved revision uses an unsupported proposal schema.' using errcode = '22023';
  end if;
  select count(*) into v_line_count from jsonb_array_elements(v_workspace.draft_snapshot->'line_items') line
  where nullif(btrim(line->>'item_name'), '') is not null;
  select count(*) into v_total_line_count from jsonb_array_elements(v_workspace.draft_snapshot->'line_items');
  if v_line_count < 1 or v_line_count <> v_total_line_count then raise exception 'The saved revision requires at least one valid line item.' using errcode = '22023'; end if;
  if nullif(v_workspace.draft_snapshot->'tax_region'->>'tax_rate', '') is null then
    raise exception 'The saved revision requires recorded tax context.' using errcode = '22023';
  end if;
  v_json_subtotal := round((v_workspace.draft_snapshot->'totals'->>'subtotal')::numeric, 2);
  v_json_tax_amount := round((v_workspace.draft_snapshot->'totals'->>'taxAmount')::numeric, 2);
  v_json_total := round((v_workspace.draft_snapshot->'totals'->>'totalAmount')::numeric, 2);
  if v_json_subtotal is distinct from round(v_workspace.subtotal, 2)
     or v_json_tax_amount is distinct from round(v_workspace.tax_amount, 2)
     or v_json_total is distinct from round(v_workspace.total_amount, 2)
     or round(v_workspace.subtotal + v_workspace.tax_amount, 2) is distinct from round(v_workspace.total_amount, 2)
     or round(v_workspace.subtotal * v_workspace.tax_rate, 2) is distinct from round(v_workspace.tax_amount, 2)
     or round((v_workspace.draft_snapshot->'tax_region'->>'tax_rate')::numeric, 6) is distinct from round(v_workspace.tax_rate, 6)
     or least(v_workspace.subtotal, v_workspace.tax_amount, v_workspace.total_amount, v_workspace.retainer_amount, v_workspace.final_balance_amount) < 0 then
    raise exception 'The saved revision totals are inconsistent.' using errcode = '22023';
  end if;

  select greatest(coalesce((select max(version) from public.project_proposal_invoice_snapshots where project_id = p_project_id), 0),
    coalesce((select max(version) from public.project_proposal_document_versions where project_id = p_project_id), 0)) + 1 into v_version;
  perform set_config('app.proposal_revision_activation', 'on', true);
  update public.project_proposal_invoice_snapshots set is_active = false where project_proposal_invoice_snapshot_id = v_baseline.project_proposal_invoice_snapshot_id;
  update public.project_proposal_document_versions set is_active = false, status = 'superseded' where project_id = p_project_id and is_active;

  insert into public.project_proposal_invoice_snapshots (
    project_id, source_lead_id, source_floral_proposal_id, version, snapshot, subtotal, tax_rate,
    tax_amount, total_amount, retainer_amount, final_balance_amount, retainer_due_date,
    final_balance_due_date, created_by, is_active, submission_idempotency_key
  ) values (p_project_id, v_baseline.source_lead_id, v_baseline.source_floral_proposal_id, v_version,
    v_workspace.draft_snapshot || jsonb_build_object('proposal_status','finalized','submitted_at',p_submitted_at,
      'submitted_pdf_file_name',p_pdf_file_name,'submitted_pdf_storage_path',p_pdf_storage_path,'submission_mode','project_revision'),
    v_workspace.subtotal, v_workspace.tax_rate, v_workspace.tax_amount, v_workspace.total_amount,
    v_workspace.retainer_amount, v_workspace.final_balance_amount, v_workspace.retainer_due_date,
    v_workspace.final_balance_due_date, p_submitted_by, true, p_idempotency_key)
  returning project_proposal_invoice_snapshot_id into v_new_snapshot_id;

  insert into public.project_proposal_document_versions (
    project_id, source_lead_id, source_floral_proposal_id, invoice_snapshot_id, version, file_name,
    storage_bucket, storage_path, content_type, file_size_bytes, uploaded_by, submitted_at,
    is_active, status, submission_idempotency_key
  ) values (p_project_id, v_baseline.source_lead_id, v_baseline.source_floral_proposal_id, v_new_snapshot_id,
    v_version, p_pdf_file_name, p_pdf_bucket, p_pdf_storage_path, p_pdf_content_type,
    p_pdf_file_size_bytes, p_submitted_by, p_submitted_at, true, 'submitted', p_idempotency_key)
  returning project_proposal_document_version_id into v_new_document_id;

  update public.projects set active_proposal_invoice_snapshot_id = v_new_snapshot_id,
    active_proposal_document_version_id = v_new_document_id, updated_at = p_submitted_at where project_id = p_project_id;
  insert into public.activity_log (entity_type, entity_id, activity_type, activity_label, description, performed_by, metadata, created_at)
  values ('project', p_project_id, 'proposal_revision_submitted', 'Proposal revision v' || v_version || ' submitted',
    'A revised proposal and approved PDF became the active project version.', p_submitted_by,
    jsonb_build_object('replaced_snapshot_id',v_baseline.project_proposal_invoice_snapshot_id,'replaced_version',v_baseline.version,
      'new_snapshot_id',v_new_snapshot_id,'new_document_id',v_new_document_id,'new_version',v_version,
      'prior_total',v_baseline.total_amount,'new_total',v_workspace.total_amount,
      'submission_idempotency_key',p_idempotency_key,'submission_mode','project_revision'), p_submitted_at);
  delete from public.project_proposal_revision_workspaces where project_proposal_revision_workspace_id = p_workspace_id;
  return jsonb_build_object('success',true,'project_id',p_project_id,'revision_workspace_id',p_workspace_id,
    'proposal_document_version_id',v_new_document_id,'active_invoice_snapshot_id',v_new_snapshot_id,
    'version',v_version,'signed_pdf_storage_path',p_pdf_storage_path,'submitted_at',p_submitted_at,'idempotent_replay',false);
end;
$$;

revoke all on function public.finalize_project_proposal_revision(uuid, uuid, uuid, uuid, text, text, text, text, bigint, uuid, timestamptz) from public;
revoke all on function public.finalize_project_proposal_revision(uuid, uuid, uuid, uuid, text, text, text, text, bigint, uuid, timestamptz) from authenticated;
grant execute on function public.finalize_project_proposal_revision(uuid, uuid, uuid, uuid, text, text, text, text, bigint, uuid, timestamptz) to service_role;

commit;
