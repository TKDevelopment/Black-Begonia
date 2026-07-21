create or replace function public.get_payment_obligation_detail(p_obligation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare v_project_id uuid; v_result jsonb;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
  select project_id into v_project_id from public.project_payment_records where project_payment_record_id=p_obligation_id;
  if v_project_id is null then return null; end if;
  select jsonb_build_object(
    'obligation',to_jsonb(o), 'project',jsonb_build_object('project_id',p.project_id,'project_name',p.project_name,'event_date',p.event_date,'status',p.status),
    'requests',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.payment_request_obligations ro join public.payment_requests r using(payment_request_id) where ro.obligation_id=o.project_payment_record_id),'[]'::jsonb),
    'checkouts',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.payment_checkout_attempts a where a.project_id=o.project_id),'[]'::jsonb),
    'intentions',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from public.payment_intentions i where i.project_id=o.project_id and (i.obligation_id is null or i.obligation_id=o.project_payment_record_id)),'[]'::jsonb),
    'transactions',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('allocations',(select coalesce(jsonb_agg(to_jsonb(a) order by a.sequence),'[]'::jsonb) from public.payment_transaction_allocations a where a.payment_transaction_id=t.payment_transaction_id)) order by t.occurred_at desc) from public.payment_transactions t where t.project_id=o.project_id),'[]'::jsonb),
    'deliveries',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from public.payment_message_deliveries d where d.project_id=o.project_id and (d.obligation_id is null or d.obligation_id=o.project_payment_record_id)),'[]'::jsonb),
    'exceptions',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from public.payment_exceptions e where e.project_id=o.project_id and (e.obligation_id is null or e.obligation_id=o.project_payment_record_id)),'[]'::jsonb),
    'legalHolds',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc) from public.payment_legal_holds h where h.project_id=o.project_id),'[]'::jsonb),
    'activity',coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from public.activity_log l where l.entity_type='project' and l.entity_id=o.project_id),'[]'::jsonb)
  ) into v_result from public.project_payment_records o join public.projects p on p.project_id=o.project_id where o.project_payment_record_id=p_obligation_id;
  return v_result;
end;
$$;
revoke all on function public.get_payment_obligation_detail(uuid) from public, anon;
grant execute on function public.get_payment_obligation_detail(uuid) to authenticated;
