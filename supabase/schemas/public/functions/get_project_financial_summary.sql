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
    ) order by case o.payment_kind when 'deposit' then 1 else 2 end), '[]'::jsonb)
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
    'overpayment', coalesce((select sum(e.amount) from public.payment_exceptions e where e.project_id=p_project_id and e.exception_type='overpayment' and e.state<>'resolved'),0),
    'obligations', v_obligations,
    'needsAttention', v_needs_attention
  );
end;
$$;

revoke all on function public.get_project_financial_summary(uuid) from public, anon;
grant execute on function public.get_project_financial_summary(uuid) to authenticated;
