create or replace function public.recompute_project_payment_obligations(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.project_payment_records o
  set credited_principal=greatest(coalesce(a.credited,0),0),
      amount_paid=greatest(coalesce(a.credited,0),0),
      outstanding_amount=greatest(o.target_amount-coalesce(a.credited,0),0),
      status=case when o.status in ('waived','canceled','review_required') then o.status
                  when coalesce(a.credited,0)<=0 then case when o.due_date<=current_date then 'due' else 'not_due' end
                  when coalesce(a.credited,0)<o.target_amount then 'partially_paid'
                  when coalesce(a.credited,0)=o.target_amount then 'paid' else 'overpaid' end,
      fulfillment_state=case when o.status in ('waived','canceled','review_required') then o.status
                  when coalesce(a.credited,0)<=0 then case when o.due_date<=current_date then 'due' else 'not_due' end
                  when coalesce(a.credited,0)<o.target_amount then 'partially_paid'
                  when coalesce(a.credited,0)=o.target_amount then 'paid' else 'overpaid' end,
      deposit_target_frozen_at=case when o.payment_kind='deposit' and coalesce(a.credited,0)>0 then coalesce(o.deposit_target_frozen_at,now()) else o.deposit_target_frozen_at end,
      fulfilled_at=case when coalesce(a.credited,0)>=o.target_amount and o.target_amount>0 then coalesce(o.fulfilled_at,now()) else null end,
      updated_at=now()
  from (select obligation_id, sum(allocated_principal) credited from public.payment_transaction_allocations group by obligation_id) a
  where o.project_id=p_project_id and a.obligation_id=o.project_payment_record_id;

  update public.project_payment_records set credited_principal=0, amount_paid=0,
    outstanding_amount=target_amount,
    status=case when status in ('waived','canceled','review_required') then status when due_date<=current_date then 'due' else 'not_due' end,
    fulfillment_state=case when fulfillment_state in ('waived','canceled','review_required') then fulfillment_state when due_date<=current_date then 'due' else 'not_due' end,
    fulfilled_at=null, updated_at=now()
  where project_id=p_project_id and not exists(select 1 from public.payment_transaction_allocations a where a.obligation_id=project_payment_record_id);
end;
$$;
revoke all on function public.recompute_project_payment_obligations(uuid) from public, anon, authenticated;
grant execute on function public.recompute_project_payment_obligations(uuid) to service_role;
