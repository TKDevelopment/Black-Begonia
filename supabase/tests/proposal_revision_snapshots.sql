-- Run after 20260721010000_proposal_catalog_row_pricing.sql in an isolated database.
begin;

do $$
declare
  v_precision integer;
  v_scale integer;
  v_rls_enabled boolean;
  v_trigger_count integer;
  v_cent_column_count integer;
  v_component_grants text[];
  v_line_item_grants text[];
begin
  select numeric_precision, numeric_scale
  into v_precision, v_scale
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'floral_proposal_components'
    and column_name = 'base_unit_cost';

  if v_precision <> 14 or v_scale <> 4 then
    raise exception 'Component base_unit_cost precision mismatch: numeric(%,%)', v_precision, v_scale;
  end if;

  select relrowsecurity
  into v_rls_enabled
  from pg_class
  where oid = 'public.floral_proposal_components'::regclass;

  if v_rls_enabled then
    raise exception 'Component RLS state changed unexpectedly.';
  end if;

  select count(*)
  into v_trigger_count
  from pg_trigger
  where tgrelid = 'public.floral_proposal_components'::regclass
    and not tgisinternal
    and tgname = 'trg_floral_proposal_components_set_updated_at';

  if v_trigger_count <> 1 then
    raise exception 'Component updated_at trigger contract changed unexpectedly.';
  end if;

  select array_agg(grantee || ':' || privilege_type order by grantee, privilege_type)
  into v_component_grants
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'floral_proposal_components';

  select array_agg(grantee || ':' || privilege_type order by grantee, privilege_type)
  into v_line_item_grants
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'floral_proposal_line_items';

  if v_component_grants is distinct from v_line_item_grants then
    raise exception 'Component grants no longer match the adjacent proposal line-item contract.';
  end if;

  select count(*)
  into v_cent_column_count
  from information_schema.columns
  where table_schema = 'public'
    and (
      (table_name = 'floral_proposal_components' and column_name in ('sell_unit_price', 'subtotal'))
      or (table_name = 'floral_proposal_line_items' and column_name in ('unit_price', 'subtotal'))
      or (table_name = 'floral_proposals' and column_name in ('subtotal', 'tax_amount', 'total_amount'))
      or (table_name = 'floral_proposal_shopping_list_items' and column_name in ('estimated_pack_cost', 'total_estimated_cost'))
    )
    and numeric_scale = 2;

  if v_cent_column_count <> 9 then
    raise exception 'One or more proposal/shopping currency columns no longer retain cent precision.';
  end if;
end;
$$;

do $$
declare
  v_project_id uuid := gen_random_uuid();
  v_snapshot_id uuid := gen_random_uuid();
  v_workspace_id uuid := gen_random_uuid();
  v_key uuid := gen_random_uuid();
  v_service_type public.service_type;
  v_result jsonb;
  v_replay jsonb;
  v_old_snapshot public.project_proposal_invoice_snapshots%rowtype;
  v_new_snapshot public.project_proposal_invoice_snapshots%rowtype;
  v_new_document public.project_proposal_document_versions%rowtype;
  v_count integer;
begin
  select enumlabel::public.service_type into v_service_type
  from pg_enum where enumtypid = 'public.service_type'::regtype order by enumsortorder limit 1;

  insert into public.projects(project_id, project_name, service_type, status, event_date)
  values (v_project_id, 'Feature 006 integration fixture', v_service_type, 'booked', current_date + 30);

  insert into public.project_proposal_invoice_snapshots(
    project_proposal_invoice_snapshot_id, project_id, version, snapshot,
    subtotal, tax_rate, tax_amount, total_amount, retainer_amount,
    final_balance_amount, is_active
  ) values (
    v_snapshot_id, v_project_id, 1,
    '{"schema_version":2,"line_items":[{"item_name":"Baseline arrangement"}],"tax_region":{"tax_rate":0.06},"totals":{"subtotal":100,"taxAmount":6,"totalAmount":106}}',
    100, .06, 6, 106, 31.8, 74.2, true
  );
  update public.projects set active_proposal_invoice_snapshot_id = v_snapshot_id where project_id = v_project_id;

  insert into public.project_proposal_revision_workspaces(
    project_proposal_revision_workspace_id, project_id, baseline_invoice_snapshot_id,
    schema_version, draft_snapshot, subtotal, tax_rate, tax_amount, total_amount,
    retainer_amount, final_balance_amount, pending_submission_key,
    pending_pdf_storage_path, pending_pdf_file_name
  ) values (
    v_workspace_id, v_project_id, v_snapshot_id, 2,
    '{"schema_version":2,"proposal_status":"draft","line_items":[{"item_name":"Revised arrangement"}],"tax_region":{"tax_rate":0.06},"totals":{"subtotal":150,"taxAmount":9,"totalAmount":159}}',
    150, .06, 9, 159, 47.7, 111.3, v_key,
    'projects/test/revision.pdf', 'revision.pdf'
  );

  begin
    update public.project_proposal_invoice_snapshots set total_amount = 999 where project_proposal_invoice_snapshot_id = v_snapshot_id;
    raise exception 'Snapshot content update unexpectedly succeeded.';
  exception when sqlstate '55000' then null;
  end;

  begin
    update public.project_proposal_invoice_snapshots set is_active = false where project_proposal_invoice_snapshot_id = v_snapshot_id;
    raise exception 'Direct lifecycle update unexpectedly succeeded.';
  exception when sqlstate '42501' then null;
  end;

  v_result := public.finalize_project_proposal_revision(
    v_project_id, v_workspace_id, v_snapshot_id, v_key, 'floral-proposals',
    'projects/test/revision.pdf', 'revision.pdf', 'application/pdf', 128,
    null, clock_timestamp()
  );

  if coalesce((v_result->>'success')::boolean, false) is not true
     or coalesce((v_result->>'idempotent_replay')::boolean, true) is not false then
    raise exception 'Finalization did not return a successful new result: %', v_result;
  end if;

  select * into v_old_snapshot from public.project_proposal_invoice_snapshots
  where project_proposal_invoice_snapshot_id = v_snapshot_id;
  select * into v_new_snapshot from public.project_proposal_invoice_snapshots
  where project_proposal_invoice_snapshot_id = (v_result->>'active_invoice_snapshot_id')::uuid;
  select * into v_new_document from public.project_proposal_document_versions
  where project_proposal_document_version_id = (v_result->>'proposal_document_version_id')::uuid;

  if v_old_snapshot.is_active or not v_new_snapshot.is_active or not v_new_document.is_active
     or v_new_snapshot.version <> v_new_document.version
     or v_new_document.invoice_snapshot_id <> v_new_snapshot.project_proposal_invoice_snapshot_id
     or v_new_snapshot.submission_idempotency_key <> v_key
     or v_new_document.submission_idempotency_key <> v_key then
    raise exception 'Finalization did not install one linked active pair.';
  end if;

  select count(*) into v_count from public.project_proposal_revision_workspaces where project_id = v_project_id;
  if v_count <> 0 then raise exception 'Finalization did not consume the workspace.'; end if;
  select count(*) into v_count from public.activity_log
  where entity_type = 'project' and entity_id = v_project_id and activity_type = 'proposal_revision_submitted';
  if v_count <> 1 then raise exception 'Finalization did not create exactly one activity.'; end if;

  v_replay := public.finalize_project_proposal_revision(
    v_project_id, v_workspace_id, v_snapshot_id, v_key, 'floral-proposals',
    'projects/test/revision.pdf', 'revision.pdf', 'application/pdf', 128,
    null, clock_timestamp()
  );
  if coalesce((v_replay->>'idempotent_replay')::boolean, false) is not true
     or v_replay->>'active_invoice_snapshot_id' <> v_result->>'active_invoice_snapshot_id' then
    raise exception 'Idempotent replay did not return the completed result.';
  end if;

  select count(*) into v_count from public.project_proposal_invoice_snapshots
  where project_id = v_project_id and is_active;
  if v_count <> 1 then raise exception 'Project does not have exactly one active snapshot.'; end if;
  select count(*) into v_count from public.project_proposal_document_versions
  where project_id = v_project_id and is_active;
  if v_count <> 1 then raise exception 'Project does not have exactly one active document.'; end if;

  begin
    delete from public.project_proposal_document_versions
    where project_proposal_document_version_id = v_new_document.project_proposal_document_version_id;
    raise exception 'Submitted document delete unexpectedly succeeded.';
  exception when sqlstate '55000' then null;
  end;
end;
$$;

do $$
declare v_count integer;
begin
  select count(*) into v_count from pg_policies
  where schemaname = 'public' and tablename = 'project_proposal_revision_workspaces'
    and policyname like 'internal crm users%';
  if v_count <> 4 then raise exception 'Workspace RLS policy set is incomplete.'; end if;

  select count(*) into v_count from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname in ('internal crm users update project proposal pdfs', 'internal crm users delete project proposal pdfs');
  if v_count <> 0 then raise exception 'Submitted PDF mutation policies still exist.'; end if;

  if has_function_privilege('authenticated',
    'public.finalize_project_proposal_revision(uuid,uuid,uuid,uuid,text,text,text,text,bigint,uuid,timestamp with time zone)', 'EXECUTE') then
    raise exception 'Authenticated role can execute privileged finalization.';
  end if;
end;
$$;

rollback;
