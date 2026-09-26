create or replace function public.recalculate_project_obligations_for_snapshot(p_project_id uuid, p_snapshot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_snapshot public.project_proposal_invoice_snapshots;
  v_deposit public.project_payment_records;
  v_final public.project_payment_records;
  v_has_receipt boolean;
  v_deposit_target numeric(12,2);
  v_final_target numeric(12,2);
  v_revision_target numeric(12,2);
  v_revision public.project_payment_records;
  v_excess numeric(12,2);
  v_reduction numeric(12,2);
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  select * into v_snapshot from public.project_proposal_invoice_snapshots
  where project_proposal_invoice_snapshot_id = p_snapshot_id and project_id = p_project_id and is_active for update;
  if not found then raise exception 'An active proposal snapshot is required'; end if;

  select * into v_deposit from public.project_payment_records
  where project_id = p_project_id and payment_kind = 'deposit' and status <> 'canceled' for update;
  select * into v_final from public.project_payment_records
  where project_id = p_project_id and payment_kind = 'final_payment' and status <> 'canceled' for update;
  if v_deposit.project_payment_record_id is null or v_final.project_payment_record_id is null then
    raise exception 'Both project payment obligations are required';
  end if;

  select exists (
    select 1 from public.payment_transaction_allocations a
    join public.payment_transactions t using (payment_transaction_id)
    join public.project_payment_records o on o.project_payment_record_id = a.obligation_id
    where o.project_id = p_project_id and t.kind = 'receipt' and t.status in ('confirmed', 'resolved')
  ) into v_has_receipt;
  select coalesce(sum(target_amount), 0) into v_revision_target
  from public.project_payment_records
  where project_id = p_project_id and payment_kind = 'revision_balance' and status <> 'canceled';
  v_deposit_target := case when v_has_receipt
    then greatest(v_deposit.target_amount, v_deposit.credited_principal)
    else round(v_snapshot.total_amount * .30, 2) end;
  -- A smaller later proposal first releases unpaid portions of scheduled
  -- revision installments. Receipt allocations remain attached to their rows.
  v_excess := greatest(v_deposit_target + v_final.credited_principal
    + v_revision_target - v_snapshot.total_amount, 0);
  for v_revision in
    select * from public.project_payment_records
    where project_id = p_project_id and payment_kind = 'revision_balance'
      and status <> 'canceled'
    order by created_at desc, project_payment_record_id desc for update
  loop
    exit when v_excess = 0;
    v_reduction := least(v_excess,
      greatest(v_revision.target_amount - v_revision.credited_principal, 0));
    if v_reduction > 0 then
      update public.project_payment_records
      set target_amount = target_amount - v_reduction,
          amount_due = amount_due - v_reduction,
          outstanding_amount = greatest(outstanding_amount - v_reduction, 0),
          updated_at = now()
      where project_payment_record_id = v_revision.project_payment_record_id;
      v_excess := v_excess - v_reduction;
      v_revision_target := v_revision_target - v_reduction;
    end if;
  end loop;
  if v_excess > 0 then
    v_reduction := least(v_excess,
      greatest(v_deposit_target - v_deposit.credited_principal, 0));
    v_deposit_target := v_deposit_target - v_reduction;
  end if;
  -- When receipts exceed the new quote, credited principal remains intact and
  -- the financial summary reports the excess as an overpayment.
  v_final_target := greatest(v_snapshot.total_amount - v_deposit_target - v_revision_target,
    v_final.credited_principal, 0);

  -- The paid-state constraint must remain true throughout the update.
  update public.project_payment_records o
  set basis_snapshot_id = p_snapshot_id,
      basis_version = v_snapshot.version,
      basis_total = v_snapshot.total_amount,
      target_amount = case when o.payment_kind = 'deposit' then v_deposit_target else v_final_target end,
      amount_due = case when o.payment_kind = 'deposit' then v_deposit_target else v_final_target end,
      status = case
        when o.status in ('paid', 'overpaid')
          and o.credited_principal < case when o.payment_kind = 'deposit' then v_deposit_target else v_final_target end
          then 'partially_paid'
        else o.status end,
      fulfillment_state = case
        when o.status in ('paid', 'overpaid')
          and o.credited_principal < case when o.payment_kind = 'deposit' then v_deposit_target else v_final_target end
          then 'partially_paid'
        else o.fulfillment_state end,
      outstanding_amount = greatest(
        (case when o.payment_kind = 'deposit' then v_deposit_target else v_final_target end) - o.credited_principal, 0),
      deposit_target_frozen_at = case when o.payment_kind = 'deposit' and v_has_receipt
        then coalesce(o.deposit_target_frozen_at, now()) else o.deposit_target_frozen_at end,
      updated_at = now()
  where o.project_payment_record_id in (v_deposit.project_payment_record_id, v_final.project_payment_record_id);

  update public.project_payment_records
  set basis_snapshot_id = p_snapshot_id, basis_version = v_snapshot.version,
      basis_total = v_snapshot.total_amount, updated_at = now()
  where project_id = p_project_id and payment_kind = 'revision_balance' and status <> 'canceled';

  perform public.recompute_project_payment_obligations(p_project_id);
  update public.projects
  set status = case when event_date > current_date + 60 then 'booked'::public.project_status
      else 'awaiting_final_payment'::public.project_status end,
    updated_at = now()
  where project_id = p_project_id and status = 'final_prep'
    and exists (
      select 1 from public.project_payment_records
      where project_id = p_project_id and outstanding_amount > 0
        and status not in ('waived', 'canceled')
    );
  update public.payment_requests set status = 'superseded', invalidated_at = now(),
    token_ciphertext = null, token_iv = null, token_key_version = null
  where project_id = p_project_id and status = 'active';
  update public.payment_checkout_attempts set status = 'canceled', canceled_at = now(),
    canceled_reason = 'proposal_revision'
  where project_id = p_project_id and status in ('creating', 'active', 'processing');
  perform public.create_payment_activity(p_project_id, 'Payment obligations recalculated',
    case when v_has_receipt then 'Existing payments were preserved while the revised balance was recalculated.'
      else 'Deposit and final targets were recalculated from the revised proposal.' end,
    'system', jsonb_build_object('snapshot_id', p_snapshot_id, 'proposal_version', v_snapshot.version,
      'deposit_target', v_deposit_target, 'final_target', v_final_target,
      'revision_target', v_revision_target, 'deposit_frozen', v_has_receipt), null);
  return jsonb_build_object('projectId', p_project_id, 'snapshotId', p_snapshot_id,
    'depositTarget', v_deposit_target, 'finalTarget', v_final_target,
    'revisionTarget', v_revision_target, 'depositFrozen', v_has_receipt);
end;
$$;
revoke all on function public.recalculate_project_obligations_for_snapshot(uuid,uuid) from public, anon, authenticated;
grant execute on function public.recalculate_project_obligations_for_snapshot(uuid,uuid) to service_role;
