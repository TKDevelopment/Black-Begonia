create or replace function public.create_revision_payment_installment(
  p_project_id uuid, p_amount_cents bigint, p_due_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_snapshot public.project_proposal_invoice_snapshots;
  v_final public.project_payment_records;
  v_new public.project_payment_records;
  v_previous_total numeric(12,2);
  v_already_scheduled numeric(12,2);
  v_amount numeric(12,2) := p_amount_cents / 100.0;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_due_date is null or p_due_date < current_date then
    raise exception 'A positive amount and a current or future due date are required';
  end if;

  select * into v_project from public.projects where project_id = p_project_id for update;
  if not found or v_project.status in ('completed', 'canceled') then
    raise exception 'This project cannot accept a new installment';
  end if;
  select * into v_snapshot from public.project_proposal_invoice_snapshots
  where project_proposal_invoice_snapshot_id = v_project.active_proposal_invoice_snapshot_id
    and project_id = p_project_id and is_active;
  if not found or v_snapshot.version < 2 then raise exception 'An active revised proposal is required'; end if;
  select total_amount into v_previous_total from public.project_proposal_invoice_snapshots
  where project_id = p_project_id and version < v_snapshot.version
  order by version desc limit 1;
  if v_previous_total is null then raise exception 'The previous proposal could not be found'; end if;

  select * into v_final from public.project_payment_records
  where project_id = p_project_id and payment_kind = 'final_payment' and status <> 'canceled' for update;
  if not found or v_final.basis_snapshot_id is distinct from v_snapshot.project_proposal_invoice_snapshot_id then
    raise exception 'The final payment needs reconciliation before scheduling';
  end if;
  select coalesce(sum(target_amount), 0) into v_already_scheduled from public.project_payment_records
  where project_id = p_project_id and payment_kind = 'revision_balance'
    and origin_snapshot_id = v_snapshot.project_proposal_invoice_snapshot_id and status <> 'canceled';
  if v_amount > least(
      greatest(v_snapshot.total_amount - v_previous_total - v_already_scheduled, 0),
      v_final.outstanding_amount
    ) then
    raise exception 'Amount exceeds the unscheduled revision balance';
  end if;

  update public.project_payment_records
  set target_amount = target_amount - v_amount,
      amount_due = amount_due - v_amount,
      outstanding_amount = outstanding_amount - v_amount,
      updated_at = now()
  where project_payment_record_id = v_final.project_payment_record_id;

  insert into public.project_payment_records(
    project_id, payment_kind, status, amount_due, amount_paid, due_date,
    payment_source, basis_snapshot_id, origin_snapshot_id, basis_version, basis_total,
    target_amount, credited_principal, outstanding_amount, fulfillment_state, migration_state
  ) values (
    p_project_id, 'revision_balance',
    case when p_due_date <= current_date then 'due' else 'not_due' end,
    v_amount, 0, p_due_date, 'manual',
    v_snapshot.project_proposal_invoice_snapshot_id, v_snapshot.project_proposal_invoice_snapshot_id,
    v_snapshot.version, v_snapshot.total_amount,
    v_amount, 0, v_amount,
    case when p_due_date <= current_date then 'due' else 'not_due' end, 'native'
  ) returning * into v_new;

  perform public.recompute_project_payment_obligations(p_project_id);
  perform public.create_payment_activity(p_project_id, 'Revision installment created',
    'An additional payment installment was scheduled for the revised proposal.',
    'florist', jsonb_build_object('obligation_id', v_new.project_payment_record_id,
      'snapshot_id', v_snapshot.project_proposal_invoice_snapshot_id,
      'amount', v_amount, 'due_date', p_due_date), auth.uid());
  return jsonb_build_object('obligationId', v_new.project_payment_record_id,
    'amount', v_amount, 'dueDate', p_due_date);
end;
$$;
revoke all on function public.create_revision_payment_installment(uuid,bigint,date) from public, anon;
grant execute on function public.create_revision_payment_installment(uuid,bigint,date) to authenticated;
