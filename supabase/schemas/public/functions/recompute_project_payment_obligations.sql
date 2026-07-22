create or replace function public.recompute_project_payment_obligations(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with allocation_totals as (
    select
      a.obligation_id,
      coalesce(sum(a.allocated_principal) filter (where t.status in ('confirmed','resolved')), 0)::numeric(12,2) as credited,
      count(distinct t.method) filter (
        where t.kind = 'receipt' and t.status in ('confirmed','resolved') and a.allocated_principal > 0
      ) as method_count,
      min(t.method) filter (
        where t.kind = 'receipt' and t.status in ('confirmed','resolved') and a.allocated_principal > 0
      ) as single_method,
      max(t.occurred_at) filter (
        where t.kind = 'receipt' and t.status in ('confirmed','resolved') and a.allocated_principal > 0
      ) as last_receipt_at,
      (array_agg(t.method order by t.occurred_at desc, t.payment_transaction_id desc) filter (
        where t.kind = 'receipt' and t.status in ('confirmed','resolved') and a.allocated_principal > 0
      ))[1] as last_method
    from public.payment_transaction_allocations a
    join public.payment_transactions t using (payment_transaction_id)
    join public.project_payment_records scoped on scoped.project_payment_record_id = a.obligation_id
    where scoped.project_id = p_project_id
    group by a.obligation_id
  ), derived as (
    select
      o.project_payment_record_id,
      greatest(coalesce(a.credited, 0), 0)::numeric(12,2) as credited,
      greatest(o.target_amount - greatest(coalesce(a.credited, 0), 0), 0)::numeric(12,2) as outstanding,
      coalesce(a.method_count, 0) as method_count,
      a.single_method,
      a.last_receipt_at,
      a.last_method,
      case
        when o.status in ('waived','canceled','review_required') then o.status
        when o.target_amount = 0 then case when o.due_date is not null and o.due_date <= current_date then 'due' else 'not_due' end
        when greatest(coalesce(a.credited, 0), 0) <= 0 then case when o.due_date is not null and o.due_date <= current_date then 'due' else 'not_due' end
        when greatest(coalesce(a.credited, 0), 0) < o.target_amount then 'partially_paid'
        when greatest(coalesce(a.credited, 0), 0) = o.target_amount then 'paid'
        else 'overpaid'
      end as next_state
    from public.project_payment_records o
    left join allocation_totals a on a.obligation_id = o.project_payment_record_id
    where o.project_id = p_project_id
  )
  update public.project_payment_records o
  set credited_principal = d.credited,
      amount_paid = d.credited,
      outstanding_amount = d.outstanding,
      status = d.next_state,
      fulfillment_state = d.next_state,
      deposit_target_frozen_at = case
        when o.payment_kind = 'deposit' and d.credited > 0 then coalesce(o.deposit_target_frozen_at, now())
        else o.deposit_target_frozen_at
      end,
      fulfilled_at = case
        when d.credited >= o.target_amount and o.target_amount > 0 then coalesce(o.fulfilled_at, now())
        else null
      end,
      paid_date = case
        when d.credited >= o.target_amount and o.target_amount > 0 then d.last_receipt_at
        else null
      end,
      payment_method = case when d.method_count = 1 then d.single_method else null end,
      last_method = d.last_method,
      updated_at = now()
  from derived d
  where o.project_payment_record_id = d.project_payment_record_id;

  update public.projects project
  set status = case
        when project.status = 'awaiting_deposit'
          and not exists (
            select 1 from public.project_payment_records obligation
            where obligation.project_id = project.project_id
              and obligation.payment_kind = 'deposit'
              and obligation.outstanding_amount > 0
              and obligation.status not in ('waived','canceled')
          )
          then case
            when exists (
              select 1 from public.project_payment_records obligation
              where obligation.project_id = project.project_id
                and obligation.payment_kind = 'final_payment'
                and obligation.outstanding_amount > 0
                and obligation.status not in ('waived','canceled')
            ) then 'booked'::public.project_status
            else 'final_prep'::public.project_status
          end
        when project.status = 'awaiting_final_payment'
          and not exists (
            select 1 from public.project_payment_records obligation
            where obligation.project_id = project.project_id
              and obligation.outstanding_amount > 0
              and obligation.status not in ('waived','canceled')
          )
          then 'final_prep'::public.project_status
        else project.status
      end,
      booked_at = case
        when project.status = 'awaiting_deposit'
          and not exists (
            select 1 from public.project_payment_records obligation
            where obligation.project_id = project.project_id
              and obligation.payment_kind = 'deposit'
              and obligation.outstanding_amount > 0
              and obligation.status not in ('waived','canceled')
          )
          then coalesce(project.booked_at, now())
        else project.booked_at
      end,
      updated_at = now()
  where project.project_id = p_project_id
    and project.status in ('awaiting_deposit','awaiting_final_payment');

  update public.payment_message_deliveries delivery
  set status = 'canceled', suppression_reason = 'installment_fulfilled'
  where delivery.project_id = p_project_id
    and delivery.delivery_kind in ('deposit_reminder','final_reminder')
    and delivery.status in ('queued','claimed')
    and exists (
      select 1 from public.project_payment_records obligation
      where obligation.project_payment_record_id = delivery.obligation_id
        and obligation.outstanding_amount = 0
    );
end;
$$;

revoke all on function public.recompute_project_payment_obligations(uuid) from public, anon, authenticated;
grant execute on function public.recompute_project_payment_obligations(uuid) to service_role;
