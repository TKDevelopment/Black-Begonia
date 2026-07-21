create or replace function public.get_payment_operational_health()
returns jsonb language plpgsql security definer set search_path='' stable as $$
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
  return jsonb_build_object(
    'providerEvents',jsonb_build_object('failed',(select count(*) from public.payment_provider_events where processing_state='failed'),'unmatched',(select count(*) from public.payment_provider_events where processing_state='unmatched'),'receivedStale',(select count(*) from public.payment_provider_events where processing_state='received' and received_at<now()-interval '10 minutes')),
    'checkoutAttempts',jsonb_build_object('stale',(select count(*) from public.payment_checkout_attempts where status in ('creating','active','processing') and expires_at<now())),
    'deliveries',jsonb_build_object('failed',(select count(*) from public.payment_message_deliveries where status in ('temporary_failed','permanent_failed')),'unknown',(select count(*) from public.payment_message_deliveries where status='delivery_unknown'),'claimedStale',(select count(*) from public.payment_message_deliveries where status='claimed' and claimed_at<now()-interval '30 minutes')),
    'exceptions',jsonb_build_object('urgentOpen',(select count(*) from public.payment_exceptions where urgency='urgent' and state<>'resolved')),
    'aggregateParity',jsonb_build_object('mismatches',(select count(*) from public.project_payment_records o where abs(o.credited_principal-coalesce((select sum(a.allocated_principal) from public.payment_transaction_allocations a join public.payment_transactions t using(payment_transaction_id) where a.obligation_id=o.project_payment_record_id and t.status in ('confirmed','resolved')),0))>.005)),
    'generatedAt',now()
  );
end; $$;
revoke all on function public.get_payment_operational_health() from public,anon;
grant execute on function public.get_payment_operational_health() to authenticated;
