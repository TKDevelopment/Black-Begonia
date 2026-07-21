create or replace function public.cascade_delete_project_test_data(
  p_project_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_source_lead_id uuid;
  v_contact_ids uuid[] := array[]::uuid[];
  v_organization_ids uuid[] := array[]::uuid[];
  v_storage_objects jsonb := '[]'::jsonb;
  v_deleted_lead boolean := false;
  v_deleted_contacts integer := 0;
  v_deleted_organizations integer := 0;
begin
  if not public.is_internal_crm_user() then
    raise exception 'Not authorized to delete projects.' using errcode = '42501';
  end if;

  select *
  into v_project
  from public.projects
  where project_id = p_project_id
  for update;

  if not found then
    raise exception 'Project not found.' using errcode = 'P0002';
  end if;

  if btrim(coalesce(p_confirmation, '')) <> v_project.project_name then
    raise exception 'Type the exact project name to confirm deletion.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.payment_transactions where project_id = p_project_id
  ) then
    raise exception 'This project has payment ledger history and must be retained.' using errcode = '55000';
  end if;

  if exists (
    select 1 from public.payment_legal_holds where project_id = p_project_id
  ) then
    raise exception 'This project has payment legal or dispute hold history and must be retained.' using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.payment_provider_events provider_event
    left join public.payment_checkout_attempts checkout_attempt
      on checkout_attempt.payment_checkout_attempt_id = provider_event.payment_checkout_attempt_id
    left join public.payment_transactions payment_transaction
      on payment_transaction.payment_transaction_id = provider_event.payment_transaction_id
    where checkout_attempt.project_id = p_project_id
       or payment_transaction.project_id = p_project_id
  ) then
    raise exception 'This project has provider payment audit history and must be retained.' using errcode = '55000';
  end if;

  v_source_lead_id := v_project.source_lead_id;

  if v_source_lead_id is not null then
    select coalesce(array_agg(contact_id), array[]::uuid[])
    into v_contact_ids
    from public.contacts
    where created_from_lead_id = v_source_lead_id;

    select coalesce(array_agg(organization_id), array[]::uuid[])
    into v_organization_ids
    from public.organizations
    where created_from_lead_id = v_source_lead_id;
  end if;

  select coalesce(jsonb_agg(storage_object order by storage_object->>'path'), '[]'::jsonb)
  into v_storage_objects
  from (
    select distinct jsonb_build_object(
      'bucket', document.storage_bucket,
      'path', document.storage_path
    ) as storage_object
    from public.project_proposal_document_versions document
    where document.project_id = p_project_id
    union
    select jsonb_build_object(
      'bucket', 'floral-proposals',
      'path', workspace.pending_pdf_storage_path
    )
    from public.project_proposal_revision_workspaces workspace
    where workspace.project_id = p_project_id
      and workspace.pending_pdf_storage_path is not null
  ) storage_paths;

  -- Clear restrictive cross-links before deleting the project-owned rows.
  delete from public.payment_request_obligations request_obligation
  where request_obligation.payment_request_id in (
      select payment_request_id from public.payment_requests where project_id = p_project_id
    )
     or request_obligation.obligation_id in (
      select project_payment_record_id from public.project_payment_records where project_id = p_project_id
    );

  delete from public.payment_message_delivery_events delivery_event
  where delivery_event.payment_message_delivery_id in (
    select payment_message_delivery_id
    from public.payment_message_deliveries
    where project_id = p_project_id
  );
  delete from public.payment_exceptions where project_id = p_project_id;
  delete from public.payment_intentions where project_id = p_project_id;
  delete from public.payment_message_deliveries where project_id = p_project_id;
  delete from public.payment_checkout_attempts where project_id = p_project_id;
  delete from public.payment_requests where project_id = p_project_id;
  delete from public.project_payment_records where project_id = p_project_id;

  delete from public.activity_log
  where entity_type = 'project' and entity_id = p_project_id;

  perform set_config('app.project_cascade_delete', 'on', true);
  update public.projects
  set active_proposal_document_version_id = null,
      active_proposal_invoice_snapshot_id = null
  where project_id = p_project_id;
  delete from public.project_proposal_revision_workspaces where project_id = p_project_id;
  delete from public.project_proposal_document_versions where project_id = p_project_id;
  delete from public.project_proposal_invoice_snapshots where project_id = p_project_id;

  delete from public.projects where project_id = p_project_id;

  if v_source_lead_id is not null
     and not exists (
       select 1 from public.projects where source_lead_id = v_source_lead_id
     ) then
    delete from public.leads where lead_id = v_source_lead_id;
    v_deleted_lead := found;
  end if;

  if cardinality(v_contact_ids) > 0 then
    with deleted as (
      delete from public.contacts contact
      where contact.contact_id = any(v_contact_ids)
        and not exists (
          select 1 from public.project_contacts project_contact
          where project_contact.contact_id = contact.contact_id
        )
        and not exists (
          select 1 from public.projects remaining_project
          where remaining_project.primary_contact_id = contact.contact_id
        )
        and not exists (
          select 1 from public.leads remaining_lead
          where remaining_lead.converted_primary_contact_id = contact.contact_id
        )
        and not exists (
          select 1 from public.payment_requests payment_request
          where payment_request.original_recipient_contact_id = contact.contact_id
        )
        and not exists (
          select 1 from public.payment_message_deliveries delivery
          where delivery.recipient_contact_id = contact.contact_id
        )
      returning 1
    )
    select count(*) into v_deleted_contacts from deleted;
  end if;

  if cardinality(v_organization_ids) > 0 then
    with deleted as (
      delete from public.organizations organization
      where organization.organization_id = any(v_organization_ids)
        and not exists (
          select 1 from public.project_organizations project_organization
          where project_organization.organization_id = organization.organization_id
        )
      returning 1
    )
    select count(*) into v_deleted_organizations from deleted;
  end if;

  return jsonb_build_object(
    'projectId', p_project_id,
    'projectName', v_project.project_name,
    'deletedSourceLead', v_deleted_lead,
    'deletedContacts', v_deleted_contacts,
    'deletedOrganizations', v_deleted_organizations,
    'storageObjects', v_storage_objects
  );
end;
$$;

revoke all on function public.cascade_delete_project_test_data(uuid, text) from public;
grant execute on function public.cascade_delete_project_test_data(uuid, text) to authenticated;
