alter table public.project_proposal_revision_workspaces
  alter column schema_version set default 3;

create or replace function public.finalize_project_proposal_revision(
  p_project_id uuid,
  p_workspace_id uuid,
  p_baseline_snapshot_id uuid,
  p_idempotency_key uuid,
  p_pdf_bucket text,
  p_pdf_storage_path text,
  p_pdf_file_name text,
  p_pdf_content_type text,
  p_pdf_file_size_bytes bigint,
  p_submitted_by uuid,
  p_submitted_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_project public.projects%rowtype;
  v_workspace public.project_proposal_revision_workspaces%rowtype;
  v_baseline public.project_proposal_invoice_snapshots%rowtype;
  v_existing_snapshot public.project_proposal_invoice_snapshots%rowtype;
  v_existing_document public.project_proposal_document_versions%rowtype;
  v_new_snapshot_id uuid;
  v_new_document_id uuid;
  v_version integer;
  v_active_snapshot_count integer;
  v_line_count integer;
  v_total_line_count integer;
  v_line jsonb;
  v_line_index integer := 0;
  v_line_type text;
  v_line_quantity numeric;
  v_line_unit_price numeric;
  v_line_subtotal numeric;
  v_line_calculated_price numeric;
  v_line_override_price numeric;
  v_expected_line_subtotal numeric;
  v_computed_subtotal numeric(12,2) := 0;
  v_json_subtotal numeric(12,2);
  v_json_tax_amount numeric(12,2);
  v_json_total numeric(12,2);
begin
  if p_idempotency_key is null then
    raise exception 'A submission idempotency key is required.' using errcode = '22023';
  end if;

  select * into v_project
  from public.projects
  where project_id = p_project_id
  for update;

  if not found then
    raise exception 'The selected project could not be found.' using errcode = 'P0002';
  end if;

  select * into v_existing_snapshot
  from public.project_proposal_invoice_snapshots
  where submission_idempotency_key = p_idempotency_key;

  if found then
    select * into v_existing_document
    from public.project_proposal_document_versions
    where submission_idempotency_key = p_idempotency_key;

    if not found or v_existing_snapshot.project_id <> p_project_id then
      raise exception 'The completed submission key does not match this project.' using errcode = '23505';
    end if;

    return jsonb_build_object(
      'success', true,
      'project_id', v_existing_snapshot.project_id,
      'revision_workspace_id', p_workspace_id,
      'proposal_document_version_id', v_existing_document.project_proposal_document_version_id,
      'active_invoice_snapshot_id', v_existing_snapshot.project_proposal_invoice_snapshot_id,
      'version', v_existing_snapshot.version,
      'signed_pdf_storage_path', v_existing_document.storage_path,
      'submitted_at', v_existing_document.submitted_at,
      'idempotent_replay', true
    );
  end if;

  if v_project.status in ('completed'::public.project_status, 'canceled'::public.project_status) then
    raise exception 'Completed or canceled projects cannot be revised.' using errcode = '55000';
  end if;

  if v_project.event_date is null then
    raise exception 'The project requires an event date before proposal finalization.' using errcode = '22023';
  end if;

  select * into v_workspace
  from public.project_proposal_revision_workspaces
  where project_proposal_revision_workspace_id = p_workspace_id
    and project_id = p_project_id
  for update;

  if not found then
    raise exception 'The proposal revision workspace could not be found.' using errcode = 'P0002';
  end if;

  if v_workspace.pending_submission_key is distinct from p_idempotency_key
     or v_workspace.pending_pdf_storage_path is distinct from p_pdf_storage_path
     or v_workspace.pending_pdf_file_name is distinct from p_pdf_file_name then
    raise exception 'The saved revision pending submission does not match the finalization request.' using errcode = '40001';
  end if;

  if v_workspace.baseline_invoice_snapshot_id <> p_baseline_snapshot_id
     or v_project.active_proposal_invoice_snapshot_id <> p_baseline_snapshot_id then
    raise exception 'The active proposal changed after this revision started.' using errcode = '40001';
  end if;

  select * into v_baseline
  from public.project_proposal_invoice_snapshots
  where project_proposal_invoice_snapshot_id = p_baseline_snapshot_id
    and project_id = p_project_id
    and is_active = true
  for update;

  if not found then
    raise exception 'The revision baseline is not the active project snapshot.' using errcode = '40001';
  end if;

  select count(*) into v_active_snapshot_count
  from public.project_proposal_invoice_snapshots
  where project_id = p_project_id and is_active = true;

  if v_active_snapshot_count <> 1 then
    raise exception 'The project must have exactly one active invoice snapshot.' using errcode = '55000';
  end if;

  if v_workspace.schema_version <> 3
     or coalesce((v_workspace.draft_snapshot->>'schema_version')::integer, 0) <> 3
     or jsonb_typeof(v_workspace.draft_snapshot->'line_items') is distinct from 'array'
     or jsonb_typeof(v_workspace.draft_snapshot->'tax_region') is distinct from 'object'
     or jsonb_typeof(v_workspace.draft_snapshot->'totals') is distinct from 'object' then
    raise exception 'The saved revision uses an unsupported proposal schema.' using errcode = '22023';
  end if;

  if v_workspace.draft_snapshot ? 'labor_percent'
     or coalesce(v_workspace.draft_snapshot->'breakdown', '{}'::jsonb) ? 'calculatedLaborAmount' then
    raise exception 'Percentage-based labor is not allowed in proposal schema V3.' using errcode = '22023';
  end if;

  select count(*) into v_line_count
  from jsonb_array_elements(v_workspace.draft_snapshot->'line_items') line
  where nullif(btrim(line->>'item_name'), '') is not null;

  select count(*) into v_total_line_count
  from jsonb_array_elements(v_workspace.draft_snapshot->'line_items');

  if v_line_count < 1 or v_line_count <> v_total_line_count then
    raise exception 'The saved revision requires at least one valid line item.' using errcode = '22023';
  end if;

  for v_line in
    select value from jsonb_array_elements(v_workspace.draft_snapshot->'line_items')
  loop
    v_line_index := v_line_index + 1;
    v_line_type := v_line->>'line_item_type';
    if v_line_type is null
       or v_line_type not in ('product', 'labor', 'fee', 'discount')
       or jsonb_typeof(v_line->'quantity') is distinct from 'number'
       or jsonb_typeof(v_line->'unit_price') is distinct from 'number'
       or jsonb_typeof(v_line->'subtotal') is distinct from 'number' then
      raise exception 'Proposal line % has invalid pricing fields.', v_line_index using errcode = '22023';
    end if;

    v_line_quantity := (v_line->>'quantity')::numeric;
    v_line_unit_price := (v_line->>'unit_price')::numeric;
    v_line_subtotal := (v_line->>'subtotal')::numeric;
    if v_line_quantity < 0
       or v_line_unit_price < 0
       or round(v_line_unit_price, 2) is distinct from v_line_unit_price
       or round(v_line_subtotal, 2) is distinct from v_line_subtotal then
      raise exception 'Proposal line % contains invalid currency values.', v_line_index using errcode = '22023';
    end if;

    if v_line_type = 'product' then
      if jsonb_typeof(v_line->'calculated_unit_price') is distinct from 'number'
         or not (v_line ? 'actual_unit_price_override')
         or jsonb_typeof(v_line->'actual_unit_price_override') not in ('number', 'null') then
        raise exception 'Product line % is missing V3 price state.', v_line_index using errcode = '22023';
      end if;
      v_line_calculated_price := (v_line->>'calculated_unit_price')::numeric;
      v_line_override_price := case
        when jsonb_typeof(v_line->'actual_unit_price_override') = 'null' then null
        else (v_line->>'actual_unit_price_override')::numeric
      end;
      if v_line_calculated_price < 0
         or round(v_line_calculated_price, 2) is distinct from v_line_calculated_price
         or (v_line_override_price is not null and (
           v_line_override_price < 0
           or round(v_line_override_price, 2) is distinct from v_line_override_price
         ))
         or v_line_unit_price is distinct from coalesce(v_line_override_price, v_line_calculated_price) then
        raise exception 'Product line % effective price is inconsistent.', v_line_index using errcode = '22023';
      end if;
    elsif v_line ? 'calculated_unit_price' or v_line ? 'actual_unit_price_override' then
      raise exception 'Manual line % contains product-only price state.', v_line_index using errcode = '22023';
    end if;

    v_expected_line_subtotal := round(v_line_quantity * v_line_unit_price, 2);
    if v_line_type = 'discount' then
      v_expected_line_subtotal := -abs(v_expected_line_subtotal);
    end if;
    if v_line_subtotal is distinct from v_expected_line_subtotal then
      raise exception 'Proposal line % subtotal is inconsistent.', v_line_index using errcode = '22023';
    end if;
    v_computed_subtotal := round(v_computed_subtotal + v_line_subtotal, 2);
  end loop;

  if nullif(v_workspace.draft_snapshot->'tax_region'->>'tax_rate', '') is null then
    raise exception 'The saved revision requires recorded tax context.' using errcode = '22023';
  end if;

  v_json_subtotal := round((v_workspace.draft_snapshot->'totals'->>'subtotal')::numeric, 2);
  v_json_tax_amount := round((v_workspace.draft_snapshot->'totals'->>'taxAmount')::numeric, 2);
  v_json_total := round((v_workspace.draft_snapshot->'totals'->>'totalAmount')::numeric, 2);
  if v_json_subtotal is distinct from round(v_workspace.subtotal, 2)
     or v_json_subtotal is distinct from v_computed_subtotal
     or v_json_tax_amount is distinct from round(v_workspace.tax_amount, 2)
     or v_json_total is distinct from round(v_workspace.total_amount, 2)
     or round(v_workspace.subtotal + v_workspace.tax_amount, 2) is distinct from round(v_workspace.total_amount, 2)
     or round(greatest(v_workspace.subtotal, 0) * v_workspace.tax_rate, 2) is distinct from round(v_workspace.tax_amount, 2)
     or round((v_workspace.draft_snapshot->'tax_region'->>'tax_rate')::numeric, 6) is distinct from round(v_workspace.tax_rate, 6)
     or least(v_workspace.subtotal, v_workspace.tax_amount, v_workspace.total_amount, v_workspace.retainer_amount, v_workspace.final_balance_amount) < 0 then
    raise exception 'The saved revision totals are inconsistent.' using errcode = '22023';
  end if;

  select greatest(
    coalesce((select max(version) from public.project_proposal_invoice_snapshots where project_id = p_project_id), 0),
    coalesce((select max(version) from public.project_proposal_document_versions where project_id = p_project_id), 0)
  ) + 1 into v_version;

  perform set_config('app.proposal_revision_activation', 'on', true);
  update public.project_proposal_invoice_snapshots set is_active = false
  where project_proposal_invoice_snapshot_id = v_baseline.project_proposal_invoice_snapshot_id;
  update public.project_proposal_document_versions set is_active = false, status = 'superseded'
  where project_id = p_project_id and is_active = true;

  insert into public.project_proposal_invoice_snapshots (
    project_id, source_lead_id, source_floral_proposal_id, version, snapshot,
    subtotal, tax_rate, tax_amount, total_amount, retainer_amount,
    final_balance_amount, retainer_due_date, final_balance_due_date,
    created_by, is_active, submission_idempotency_key
  ) values (
    p_project_id, v_baseline.source_lead_id, v_baseline.source_floral_proposal_id,
    v_version, v_workspace.draft_snapshot || jsonb_build_object(
      'proposal_status', 'finalized', 'submitted_at', p_submitted_at,
      'submitted_pdf_file_name', p_pdf_file_name,
      'submitted_pdf_storage_path', p_pdf_storage_path,
      'submission_mode', 'project_revision'
    ),
    v_workspace.subtotal, v_workspace.tax_rate, v_workspace.tax_amount,
    v_workspace.total_amount, v_workspace.retainer_amount,
    v_workspace.final_balance_amount, v_workspace.retainer_due_date,
    v_workspace.final_balance_due_date, p_submitted_by, true, p_idempotency_key
  ) returning project_proposal_invoice_snapshot_id into v_new_snapshot_id;

  insert into public.project_proposal_document_versions (
    project_id, source_lead_id, source_floral_proposal_id, invoice_snapshot_id,
    version, file_name, storage_bucket, storage_path, content_type,
    file_size_bytes, uploaded_by, submitted_at, is_active, status,
    submission_idempotency_key
  ) values (
    p_project_id, v_baseline.source_lead_id, v_baseline.source_floral_proposal_id,
    v_new_snapshot_id, v_version, p_pdf_file_name, p_pdf_bucket,
    p_pdf_storage_path, p_pdf_content_type, p_pdf_file_size_bytes,
    p_submitted_by, p_submitted_at, true, 'submitted', p_idempotency_key
  ) returning project_proposal_document_version_id into v_new_document_id;

  update public.projects
  set active_proposal_invoice_snapshot_id = v_new_snapshot_id,
      active_proposal_document_version_id = v_new_document_id,
      updated_at = p_submitted_at
  where project_id = p_project_id;

  perform public.recalculate_project_obligations_for_snapshot(p_project_id, v_new_snapshot_id);

  insert into public.activity_log (
    entity_type, entity_id, activity_type, activity_label, description,
    performed_by, metadata, created_at
  ) values (
    'project', p_project_id, 'proposal_revision_submitted',
    'Proposal revision v' || v_version || ' submitted',
    'A revised proposal and approved PDF became the active project version.',
    p_submitted_by,
    jsonb_build_object(
      'replaced_snapshot_id', v_baseline.project_proposal_invoice_snapshot_id,
      'replaced_version', v_baseline.version,
      'new_snapshot_id', v_new_snapshot_id,
      'new_document_id', v_new_document_id,
      'new_version', v_version,
      'prior_total', v_baseline.total_amount,
      'new_total', v_workspace.total_amount,
      'submission_idempotency_key', p_idempotency_key,
      'submission_mode', 'project_revision'
    ),
    p_submitted_at
  );

  delete from public.project_proposal_revision_workspaces
  where project_proposal_revision_workspace_id = p_workspace_id;

  return jsonb_build_object(
    'success', true,
    'project_id', p_project_id,
    'revision_workspace_id', p_workspace_id,
    'proposal_document_version_id', v_new_document_id,
    'active_invoice_snapshot_id', v_new_snapshot_id,
    'version', v_version,
    'signed_pdf_storage_path', p_pdf_storage_path,
    'submitted_at', p_submitted_at,
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.finalize_project_proposal_revision(uuid, uuid, uuid, uuid, text, text, text, text, bigint, uuid, timestamptz) from public;
revoke all on function public.finalize_project_proposal_revision(uuid, uuid, uuid, uuid, text, text, text, text, bigint, uuid, timestamptz) from authenticated;
grant execute on function public.finalize_project_proposal_revision(uuid, uuid, uuid, uuid, text, text, text, text, bigint, uuid, timestamptz) to service_role;
