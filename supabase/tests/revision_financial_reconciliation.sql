-- Run after 20260926010000_reconcile_revision_finances.sql in an isolated database.
begin;
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  v_paid numeric(12,2);
  v_project_id uuid;
  v_old_id uuid;
  v_new_id uuid;
  v_deposit_id uuid;
  v_final_id uuid;
  v_transaction_id uuid;
  v_deposit_credit numeric(12,2);
  v_final_credit numeric(12,2);
  v_total_target numeric(12,2);
  v_total_credit numeric(12,2);
  v_outstanding numeric(12,2);
  v_final_target numeric(12,2);
  v_revision_target numeric(12,2);
  v_third_id uuid;
  v_fourth_id uuid;
  v_revision_id uuid;
  v_actor uuid;
  v_created jsonb;
  v_summary jsonb;
  v_service_type public.service_type;
begin
  select enumlabel::public.service_type into v_service_type
  from pg_enum where enumtypid = 'public.service_type'::regtype order by enumsortorder limit 1;

  foreach v_paid in array array[3210.00, 963.00, 0.00]::numeric[] loop
    v_project_id := gen_random_uuid();
    v_old_id := gen_random_uuid();
    v_new_id := gen_random_uuid();
    v_deposit_id := gen_random_uuid();
    v_final_id := gen_random_uuid();
    v_deposit_credit := least(v_paid, 963);
    v_final_credit := greatest(v_paid - 963, 0);

    insert into public.projects(project_id, project_name, service_type, status, event_date)
    values(v_project_id, 'Revision balance test', v_service_type,
      case when v_paid = 3210 then 'final_prep'::public.project_status else 'booked'::public.project_status end,
      current_date + 90);
    insert into public.project_proposal_invoice_snapshots(
      project_proposal_invoice_snapshot_id, project_id, version, subtotal, total_amount,
      retainer_amount, final_balance_amount, is_active
    ) values
      (v_old_id, v_project_id, 1, 3210, 3210, 963, 2247, false),
      (v_new_id, v_project_id, 2, 4500, 4500, 1350, 3150, true);
    update public.projects set active_proposal_invoice_snapshot_id = v_new_id
    where project_id = v_project_id;

    insert into public.project_payment_records(
      project_payment_record_id, project_id, payment_kind, status,
      amount_due, amount_paid, due_date, payment_source,
      basis_snapshot_id, basis_version, basis_total, target_amount,
      credited_principal, outstanding_amount, fulfillment_state, fulfilled_at
    ) values
      (v_deposit_id, v_project_id, 'deposit',
        case when v_deposit_credit = 963 then 'paid' else 'not_due' end,
        963, v_deposit_credit, current_date + 14, 'manual',
        v_old_id, 1, 3210, 963, v_deposit_credit, 963 - v_deposit_credit,
        case when v_deposit_credit = 963 then 'paid' else 'not_due' end,
        case when v_deposit_credit = 963 then now() else null end),
      (v_final_id, v_project_id, 'final_payment',
        case when v_final_credit = 2247 then 'paid' else 'not_due' end,
        2247, v_final_credit, current_date + 60, 'manual',
        v_old_id, 1, 3210, 2247, v_final_credit, 2247 - v_final_credit,
        case when v_final_credit = 2247 then 'paid' else 'not_due' end,
        case when v_final_credit = 2247 then now() else null end);

    if v_deposit_credit > 0 then
      insert into public.payment_transactions(
        payment_reference, project_id, kind, status, principal_amount,
        method, source, occurred_at, actor_type
      ) values ('REV-' || gen_random_uuid(), v_project_id, 'receipt', 'confirmed',
        v_deposit_credit, 'cash', 'manual', now(), 'florist')
      returning payment_transaction_id into v_transaction_id;
      insert into public.payment_transaction_allocations(
        payment_transaction_id, obligation_id, allocated_principal, sequence
      ) values (v_transaction_id, v_deposit_id, v_deposit_credit, 1);
    end if;
    if v_final_credit > 0 then
      insert into public.payment_transactions(
        payment_reference, project_id, kind, status, principal_amount,
        method, source, occurred_at, actor_type
      ) values ('REV-' || gen_random_uuid(), v_project_id, 'receipt', 'confirmed',
        v_final_credit, 'cash', 'manual', now(), 'florist')
      returning payment_transaction_id into v_transaction_id;
      insert into public.payment_transaction_allocations(
        payment_transaction_id, obligation_id, allocated_principal, sequence
      ) values (v_transaction_id, v_final_id, v_final_credit, 1);
    end if;

    perform public.recalculate_project_obligations_for_snapshot(v_project_id, v_new_id);
    select sum(target_amount), sum(credited_principal), sum(outstanding_amount)
      into v_total_target, v_total_credit, v_outstanding
    from public.project_payment_records where project_id = v_project_id and status <> 'canceled';
    select target_amount into v_final_target from public.project_payment_records
    where project_payment_record_id = v_final_id;
    if v_total_target <> 4500 or v_total_credit <> v_paid
      or v_outstanding <> 4500 - v_paid then
      raise exception 'Revision balance mismatch: paid %, target %, credit %, outstanding %',
        v_paid, v_total_target, v_total_credit, v_outstanding;
    end if;
    if v_paid = 3210 and v_final_target <> 3537 then
      raise exception 'Paid final installment was not reopened for the $1,290 addition';
    end if;
    if v_paid = 3210 and
      (select status from public.projects where project_id = v_project_id) <> 'booked' then
      raise exception 'A newly outstanding revision did not reopen the project payment state';
    end if;
    if v_paid = 0 and v_final_target <> 3150 then
      raise exception 'Unpaid obligations were not recalculated at the new proposal total';
    end if;

    if v_paid = 3210 then
      -- Scheduling the entire added balance keeps the original final receipt
      -- and splits the new amount into its own due date.
      begin
        perform public.create_revision_payment_installment(v_project_id, 129000, current_date + 30);
        raise exception 'An unauthenticated actor scheduled an installment';
      exception when others then
        if sqlerrm <> 'not authorized' then raise; end if;
      end;
      v_actor := gen_random_uuid();
      insert into auth.users(id, instance_id, aud, role, email,
        encrypted_password, email_confirmed_at, created_at, updated_at)
      values(v_actor, '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        'revision-test-' || v_actor || '@example.invalid', '', now(), now(), now());
      insert into public.profiles(id, email, is_active)
      values(v_actor, 'revision-test-' || v_actor || '@example.invalid', true);
      insert into public.user_roles(user_id, role) values(v_actor, 'staff');
      perform set_config('request.jwt.claim.sub', v_actor::text, true);
      v_created := public.create_revision_payment_installment(v_project_id, 129000, current_date + 30);
      v_revision_id := (v_created->>'obligationId')::uuid;
      v_summary := public.get_project_financial_summary(v_project_id);
      perform set_config('request.jwt.claim.sub', '', true);
      if (v_summary->>'proposalTotal')::numeric <> 4500
        or (v_summary->>'creditedPrincipal')::numeric <> 3210
        or (v_summary->>'outstanding')::numeric <> 1290
        or jsonb_array_length(v_summary->'obligations') <> 3 then
        raise exception 'Financial summary did not show the revised $4,500 quote and $1,290 balance';
      end if;
      if (select sum(outstanding_amount) from public.project_payment_records
          where project_id = v_project_id and status <> 'canceled') <> 1290 then
        raise exception 'Scheduling changed the $1,290 outstanding balance';
      end if;
      if (select target_amount from public.project_payment_records
          where project_payment_record_id = v_final_id) <> 2247 then
        raise exception 'Scheduling changed the paid final receipt target';
      end if;

      -- A later smaller quote releases the unpaid portion of the scheduled
      -- revision before touching already allocated receipts.
      v_third_id := gen_random_uuid();
      update public.project_proposal_invoice_snapshots set is_active = false
      where project_proposal_invoice_snapshot_id = v_new_id;
      insert into public.project_proposal_invoice_snapshots(
        project_proposal_invoice_snapshot_id, project_id, version, subtotal,
        total_amount, is_active
      ) values (v_third_id, v_project_id, 3, 4000, 4000, true);
      update public.projects set active_proposal_invoice_snapshot_id = v_third_id
      where project_id = v_project_id;
      perform public.recalculate_project_obligations_for_snapshot(v_project_id, v_third_id);
      select target_amount into v_revision_target from public.project_payment_records
      where project_payment_record_id = v_revision_id;
      select sum(target_amount), sum(credited_principal), sum(outstanding_amount)
        into v_total_target, v_total_credit, v_outstanding
      from public.project_payment_records where project_id = v_project_id and status <> 'canceled';
      if v_revision_target <> 790 or v_total_target <> 4000
        or v_total_credit <> 3210 or v_outstanding <> 790 then
        raise exception 'Later lower proposal did not release unpaid scheduled balance';
      end if;

      -- A quote below receipts has no collectible balance and retains the
      -- $3,210 receipt history for the financial summary to flag.
      v_fourth_id := gen_random_uuid();
      update public.project_proposal_invoice_snapshots set is_active = false
      where project_proposal_invoice_snapshot_id = v_third_id;
      insert into public.project_proposal_invoice_snapshots(
        project_proposal_invoice_snapshot_id, project_id, version, subtotal,
        total_amount, is_active
      ) values (v_fourth_id, v_project_id, 4, 3000, 3000, true);
      update public.projects set active_proposal_invoice_snapshot_id = v_fourth_id
      where project_id = v_project_id;
      perform public.recalculate_project_obligations_for_snapshot(v_project_id, v_fourth_id);
      select sum(credited_principal), sum(outstanding_amount)
        into v_total_credit, v_outstanding
      from public.project_payment_records where project_id = v_project_id and status <> 'canceled';
      if v_total_credit <> 3210 or v_outstanding <> 0 then
        raise exception 'A lower quote lost receipts or left a collectible balance';
      end if;
      perform set_config('request.jwt.claim.sub', v_actor::text, true);
      v_summary := public.get_project_financial_summary(v_project_id);
      perform set_config('request.jwt.claim.sub', '', true);
      if (v_summary->>'proposalTotal')::numeric <> 3000
        or (v_summary->>'creditedPrincipal')::numeric <> 3210
        or (v_summary->>'outstanding')::numeric <> 0
        or (v_summary->>'overpayment')::numeric <> 210 then
        raise exception 'Financial summary did not expose the current quote and excess receipts';
      end if;
    end if;
  end loop;
end;
$$;
rollback;
