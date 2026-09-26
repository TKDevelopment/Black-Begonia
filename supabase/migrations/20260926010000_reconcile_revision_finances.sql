-- Preserve existing receipts while a revised proposal changes the active balance.
alter table public.project_payment_records
  add column if not exists origin_snapshot_id uuid null
  references public.project_proposal_invoice_snapshots(project_proposal_invoice_snapshot_id) on delete set null;

alter table public.project_payment_records drop constraint if exists project_payment_records_kind_check;
alter table public.project_payment_records
  add constraint project_payment_records_kind_check
  check (payment_kind in ('deposit', 'final_payment', 'revision_balance'));

drop index if exists public.uq_project_payment_records_active_kind;
create unique index uq_project_payment_records_active_kind
  on public.project_payment_records(project_id, payment_kind)
  where status <> 'canceled' and payment_kind in ('deposit', 'final_payment');

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

create or replace function public.get_project_financial_summary(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_project public.projects;
  v_snapshot public.project_proposal_invoice_snapshots;
  v_obligations jsonb;
  v_needs_attention jsonb;
begin
  if not public.is_internal_crm_user() then
    raise exception 'not authorized';
  end if;

  select * into v_project from public.projects where project_id = p_project_id;
  if not found then
    return jsonb_build_object('available',false,'obligations','[]'::jsonb,'needsAttention','[]'::jsonb);
  end if;
  select * into v_snapshot
  from public.project_proposal_invoice_snapshots
  where project_proposal_invoice_snapshot_id = v_project.active_proposal_invoice_snapshot_id
    and project_id = p_project_id;

  select coalesce(jsonb_agg(
    to_jsonb(o) || jsonb_build_object(
      'displayStatus', case when o.target_amount = 0 then 'not_required' else o.status end,
      'plannedMethod', planned.method,
      'methodSummary', jsonb_build_object(
        'state', case
          when methods.method_count > 1 then 'multiple'
          when methods.method_count = 1 then 'received'
          when planned.method is not null then 'planned'
          else 'none'
        end,
        'label', case
          when methods.method_count > 1 then 'Multiple'
          when methods.method_count = 1 then initcap(replace(methods.single_method,'_',' '))
          when planned.method is not null then initcap(replace(planned.method,'_',' ')) || ' (planned)'
          else 'Not selected'
        end
      ),
      'receipts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'paymentTransactionId', t.payment_transaction_id,
          'paymentReference', t.payment_reference,
          'receiptPrincipal', t.principal_amount,
          'allocatedPrincipal', a.allocated_principal,
          'method', t.method,
          'source', t.source,
          'occurredAt', t.occurred_at,
          'status', t.status,
          'note', t.note,
          'adjustments', coalesce((
            select jsonb_agg(jsonb_build_object(
              'paymentTransactionId', child.payment_transaction_id,
              'paymentReference', child.payment_reference,
              'kind', child.kind,
              'status', child.status,
              'amount', child_alloc.allocated_principal,
              'occurredAt', child.occurred_at,
              'description', child.note
            ) order by child.occurred_at, child.payment_transaction_id)
            from public.payment_transaction_relationships rel
            join public.payment_transactions child on child.payment_transaction_id = rel.child_transaction_id
            left join public.payment_transaction_allocations child_alloc
              on child_alloc.payment_transaction_id = child.payment_transaction_id
             and child_alloc.obligation_id = o.project_payment_record_id
            where rel.parent_transaction_id = t.payment_transaction_id
              and rel.relationship_type = 'adjusts'
              and child.payment_transaction_id in (
                select history.payment_transaction_id
                from public.payment_transactions history
                where history.project_id = p_project_id
                order by history.occurred_at desc, history.payment_transaction_id desc
                limit 250
              )
          ), '[]'::jsonb)
        ) order by t.occurred_at, t.payment_transaction_id)
        from public.payment_transaction_allocations a
        join public.payment_transactions t on t.payment_transaction_id = a.payment_transaction_id
        where a.obligation_id = o.project_payment_record_id
          and a.allocated_principal > 0
          and t.kind = 'receipt'
          and t.status in ('confirmed','resolved')
          and t.payment_transaction_id in (
            select history.payment_transaction_id
            from public.payment_transactions history
            where history.project_id = p_project_id
            order by history.occurred_at desc, history.payment_transaction_id desc
            limit 250
          )
      ), '[]'::jsonb)
    ) order by case o.payment_kind when 'deposit' then 1 when 'final_payment' then 2 else 3 end, o.created_at, o.project_payment_record_id), '[]'::jsonb)
  into v_obligations
  from public.project_payment_records o
  left join lateral (
    select i.method
    from public.payment_intentions i
    join public.payment_requests r on r.payment_request_id = i.payment_request_id
    join public.payment_request_obligations ro on ro.payment_request_id = i.payment_request_id
    where ro.obligation_id = o.project_payment_record_id
      and i.project_id = p_project_id
      and i.state = 'active'
      and r.status = 'active'
      and o.outstanding_amount > 0
    order by i.created_at desc, i.payment_intention_id desc
    limit 1
  ) planned on true
  left join lateral (
    select count(distinct t.method) as method_count, min(t.method) as single_method
    from public.payment_transaction_allocations a
    join public.payment_transactions t on t.payment_transaction_id = a.payment_transaction_id
    where a.obligation_id = o.project_payment_record_id
      and a.allocated_principal > 0
      and t.kind = 'receipt'
      and t.status in ('confirmed','resolved')
  ) methods on true
  where o.project_id = p_project_id
    and o.status <> 'canceled';

  select coalesce(jsonb_agg(jsonb_build_object(
    'paymentExceptionId', e.payment_exception_id,
    'type', e.exception_type,
    'urgency', e.urgency,
    'amount', e.amount,
    'summary', e.summary,
    'state', e.state,
    'createdAt', e.created_at
  ) order by e.urgency desc, e.created_at desc), '[]'::jsonb)
  into v_needs_attention
  from public.payment_exceptions e
  where e.project_id = p_project_id
    and e.state in ('open','acknowledged')
    and e.exception_type in ('adjustment_reopened_balance','reconciliation_failure','legacy_ambiguity');

  return jsonb_build_object(
    'available', v_snapshot.project_proposal_invoice_snapshot_id is not null,
    'proposalTotal', v_snapshot.total_amount,
    'depositTarget', coalesce((select o.target_amount from public.project_payment_records o where o.project_id=p_project_id and o.payment_kind='deposit' and o.status<>'canceled' limit 1),0),
    'finalTarget', coalesce((select o.target_amount from public.project_payment_records o where o.project_id=p_project_id and o.payment_kind='final_payment' and o.status<>'canceled' limit 1),0),
    'creditedPrincipal', coalesce((select sum(o.credited_principal) from public.project_payment_records o where o.project_id=p_project_id and o.status<>'canceled'),0),
    'outstanding', coalesce((select sum(o.outstanding_amount) from public.project_payment_records o where o.project_id=p_project_id and o.status<>'canceled'),0),
    'customerFees', coalesce((select sum(t.customer_fee) from public.payment_transactions t where t.project_id=p_project_id and t.status in ('confirmed','resolved')),0),
    'merchantFees', (select sum(t.merchant_fee) from public.payment_transactions t where t.project_id=p_project_id and t.status in ('confirmed','resolved')),
    'overpayment', coalesce((select sum(e.amount) from public.payment_exceptions e where e.project_id=p_project_id and e.exception_type='overpayment' and e.state<>'resolved'),0)
      + coalesce(greatest((select sum(o.credited_principal) from public.project_payment_records o
          where o.project_id=p_project_id and o.status<>'canceled') - v_snapshot.total_amount, 0), 0),
    'obligations', v_obligations,
    'needsAttention', v_needs_attention
  );
end;
$$;

revoke all on function public.get_project_financial_summary(uuid) from public, anon;
grant execute on function public.get_project_financial_summary(uuid) to authenticated;

-- Repair revised projects that already have a new active snapshot but retained
-- installment targets from an earlier proposal. The function preserves receipts.
do $$
declare
  v_project record;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  for v_project in
    select p.project_id, s.project_proposal_invoice_snapshot_id as snapshot_id
    from public.projects p
    join public.project_proposal_invoice_snapshots s
      on s.project_proposal_invoice_snapshot_id = p.active_proposal_invoice_snapshot_id
      and s.is_active
    join public.project_payment_records d
      on d.project_id = p.project_id and d.payment_kind = 'deposit' and d.status <> 'canceled'
    join public.project_payment_records f
      on f.project_id = p.project_id and f.payment_kind = 'final_payment' and f.status <> 'canceled'
    where s.version > 1
      and (
        d.basis_snapshot_id is distinct from s.project_proposal_invoice_snapshot_id
        or f.basis_snapshot_id is distinct from s.project_proposal_invoice_snapshot_id
        or d.target_amount + f.target_amount + coalesce((
          select sum(extra.target_amount)
          from public.project_payment_records extra
          where extra.project_id = p.project_id and extra.payment_kind = 'revision_balance'
            and extra.status <> 'canceled'
        ), 0) is distinct from s.total_amount
      )
  loop
    perform public.recalculate_project_obligations_for_snapshot(v_project.project_id, v_project.snapshot_id);
  end loop;
end;
$$;

