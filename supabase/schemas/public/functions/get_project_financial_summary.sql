create or replace function public.get_project_financial_summary(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare v_result jsonb;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'available',s.project_proposal_invoice_snapshot_id is not null,
    'proposalTotal',s.total_amount,
    'depositTarget',coalesce(max(o.target_amount) filter(where o.payment_kind='deposit'),0),
    'finalTarget',coalesce(max(o.target_amount) filter(where o.payment_kind='final_payment'),0),
    'creditedPrincipal',coalesce(sum(o.credited_principal),0),
    'outstanding',coalesce(sum(o.outstanding_amount),0),
    'customerFees',coalesce((select sum(t.customer_fee) from public.payment_transactions t where t.project_id=p_project_id and t.status='confirmed'),0),
    'merchantFees',coalesce((select sum(t.merchant_fee) from public.payment_transactions t where t.project_id=p_project_id and t.status='confirmed'),0),
    'overpayment',coalesce((select sum(e.amount) from public.payment_exceptions e where e.project_id=p_project_id and e.exception_type='overpayment' and e.state<>'resolved'),0),
    'obligations',coalesce(jsonb_agg(to_jsonb(o) order by o.payment_kind),'[]'::jsonb)
  ) into v_result from public.projects p
  left join public.project_proposal_invoice_snapshots s on s.project_proposal_invoice_snapshot_id=p.active_proposal_invoice_snapshot_id and s.project_id=p.project_id
  left join public.project_payment_records o on o.project_id=p.project_id and o.status<>'canceled'
  where p.project_id=p_project_id group by s.project_proposal_invoice_snapshot_id,s.total_amount;
  return coalesce(v_result,jsonb_build_object('available',false));
end;
$$;
revoke all on function public.get_project_financial_summary(uuid) from public, anon;
grant execute on function public.get_project_financial_summary(uuid) to authenticated;
