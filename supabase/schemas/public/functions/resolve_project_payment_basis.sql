create or replace function public.resolve_project_payment_basis(p_project_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'available', s.project_proposal_invoice_snapshot_id is not null,
    'snapshot_id', s.project_proposal_invoice_snapshot_id,
    'version', s.version,
    'total', s.total_amount,
    'deposit', round(s.total_amount * .30, 2),
    'final', s.total_amount - round(s.total_amount * .30, 2),
    'final_due_date', coalesce(s.final_balance_due_date, p.event_date - 30)
  )
  from public.projects p
  left join public.project_proposal_invoice_snapshots s
    on s.project_proposal_invoice_snapshot_id=p.active_proposal_invoice_snapshot_id
   and s.project_id=p.project_id and s.is_active
  where p.project_id=p_project_id;
$$;
revoke all on function public.resolve_project_payment_basis(uuid) from public, anon;
grant execute on function public.resolve_project_payment_basis(uuid) to authenticated, service_role;
