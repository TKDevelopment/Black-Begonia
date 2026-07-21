-- Repairs projects created by the retired proposal-submission path after the
-- integrated-payments migration. The scope intentionally excludes any project
-- that already has a payment obligation or lacks an authoritative snapshot.
do $$
declare
  v_project record;
  v_contact_id uuid;
  v_deposit numeric(12, 2);
  v_final numeric(12, 2);
begin
  for v_project in
    select
      p.project_id,
      p.source_lead_id,
      p.active_proposal_invoice_snapshot_id,
      s.version as proposal_version,
      s.total_amount,
      s.retainer_amount,
      s.final_balance_amount,
      s.final_balance_due_date,
      l.first_name,
      l.last_name,
      l.email,
      l.phone,
      l.preferred_contact_method
    from public.projects p
    join public.leads l on l.lead_id = p.source_lead_id
    join public.project_proposal_invoice_snapshots s
      on s.project_proposal_invoice_snapshot_id = p.active_proposal_invoice_snapshot_id
    where p.status = 'booked'
      and s.total_amount > 0
      and not exists (
        select 1
        from public.project_payment_records payment
        where payment.project_id = p.project_id
      )
    order by p.project_id
    for update of p
  loop
    select c.contact_id
    into v_contact_id
    from public.contacts c
    where c.created_from_lead_id = v_project.source_lead_id
      and c.contact_type = 'client'
    order by c.created_at
    limit 1;

    if v_contact_id is null then
      insert into public.contacts (
        first_name,
        last_name,
        email,
        phone,
        preferred_contact_method,
        contact_type,
        notes,
        created_from_lead_id
      )
      values (
        v_project.first_name,
        v_project.last_name,
        lower(v_project.email),
        v_project.phone,
        v_project.preferred_contact_method,
        'client',
        'Primary client contact repaired from the proposal conversion workflow.',
        v_project.source_lead_id
      )
      returning contact_id into v_contact_id;
    end if;

    insert into public.project_contacts (
      project_id,
      contact_id,
      relationship_type,
      is_primary
    )
    select v_project.project_id, v_contact_id, 'client', true
    where not exists (
      select 1
      from public.project_contacts pc
      where pc.project_id = v_project.project_id
        and pc.contact_id = v_contact_id
    );

    update public.projects
    set primary_contact_id = v_contact_id,
        status = 'awaiting_deposit',
        booked_at = null,
        updated_at = now()
    where project_id = v_project.project_id;

    update public.leads
    set converted_primary_contact_id = v_contact_id,
        updated_at = now()
    where lead_id = v_project.source_lead_id;

    v_deposit := round(v_project.total_amount * 0.30, 2);
    v_final := v_project.total_amount - v_deposit;

    insert into public.project_payment_records (
      project_id,
      payment_kind,
      status,
      amount_due,
      amount_paid,
      due_date,
      payment_source,
      basis_snapshot_id,
      basis_version,
      basis_total,
      target_amount,
      credited_principal,
      outstanding_amount,
      fulfillment_state,
      migration_state
    )
    values
      (
        v_project.project_id,
        'deposit',
        'due',
        v_deposit,
        0,
        current_date,
        'manual',
        v_project.active_proposal_invoice_snapshot_id,
        v_project.proposal_version,
        v_project.total_amount,
        v_deposit,
        0,
        v_deposit,
        'due',
        'native'
      ),
      (
        v_project.project_id,
        'final_payment',
        'not_due',
        v_final,
        0,
        v_project.final_balance_due_date,
        'manual',
        v_project.active_proposal_invoice_snapshot_id,
        v_project.proposal_version,
        v_project.total_amount,
        v_final,
        0,
        v_final,
        'not_due',
        'native'
      );

    perform public.create_payment_activity(
      v_project.project_id,
      'Conversion payment setup repaired',
      'The project was restored to Awaiting Deposit and its 30% deposit and final-payment obligations were initialized.',
      'system',
      jsonb_build_object(
        'deposit_amount', v_deposit,
        'final_amount', v_final,
        'proposal_version', v_project.proposal_version,
        'repair_migration', '20260720010000'
      ),
      null
    );
  end loop;
end;
$$;
