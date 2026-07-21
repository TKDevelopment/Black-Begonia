begin;

-- Database-only payment contract tests. Edge Functions are deliberately not
-- targeted, imported, invoked, or simulated here.
select no_plan();
select ok(to_regclass('public.project_payment_records') is not null, 'legacy payment table exists');
select ok(to_regclass('public.payment_transactions') is not null, 'immutable transaction ledger exists');
select ok(to_regclass('public.payment_transaction_allocations') is not null, 'allocation ledger exists');
select ok(to_regclass('public.payment_requests') is not null, 'payment requests exist');
select ok(to_regclass('public.payment_checkout_attempts') is not null, 'checkout attempts exist');
select ok(to_regclass('public.payment_message_delivery_events') is not null, 'normalized delivery events exist');
select ok(to_regclass('public.payment_legal_holds') is not null, 'legal hold history exists');
select has_index('public','project_payment_records','uq_project_payment_records_active_kind','one canonical active obligation per kind');
select has_index('public','payment_checkout_attempts','uq_payment_checkout_attempts_active_request','one active checkout per request');
select has_index('public','payment_provider_events','uq_payment_provider_events_object_effect','provider semantic effects are unique');
select has_function('public','generate_payment_reference',array[]::text[],'BB reference generator exists');
select has_function('public','list_payment_obligations',array['text','text','text','text','text','text','text','integer','integer'],'obligation list contract exists');
select has_function('public','get_payment_obligation_detail',array['uuid'],'obligation detail contract exists');
select has_function('public','get_project_financial_summary',array['uuid'],'financial summary contract exists');
select has_function('public','convert_lead_to_project_with_payments',array['uuid','jsonb','jsonb','uuid','text'],'conversion is one transactional command');
select has_function('public','issue_payment_request',array['uuid[]','bigint','text','text','text','text','text','uuid'],'request issuance accepts encrypted token material');
select unlike(
  pg_get_functiondef('public.issue_payment_request(uuid[],bigint,text,text,text,text,text,uuid)'::regprocedure),
  '%min(project_id)%',
  'request issuance does not call an unsupported aggregate on UUID project IDs'
);
select has_function('public','reserve_payment_checkout',array['text','text','text'],'checkout reservation boundary exists');
select has_function('public','record_payment_intention',array['text','text','text'],'cash/check/Venmo fallback intention boundary exists');
select has_function('public','record_manual_payment',array['uuid','uuid','bigint','text','timestamptz','text','text','text','uuid','boolean'],'manual receipt boundary exists');
select has_function('public','reconcile_payment_event',array['uuid','jsonb'],'provider reconciliation boundary exists');
select has_function('public','claim_payment_deliveries',array['integer'],'bounded reminder claim boundary exists');
select has_function('public','claim_specific_payment_delivery',array['uuid'],'immediate delivery claim boundary exists');
select has_function('public','enqueue_payment_message_processor',array['uuid'],'validated payment processor enqueue boundary exists');
select has_function('public','activate_project_final_collection',array['uuid'],'final collection activation boundary exists');
select unlike(
  pg_get_functiondef('public.activate_project_final_collection(uuid)'::regprocedure),
  '%max(project_payment_record_id)%',
  'final collection activation does not call an unsupported aggregate on UUID obligation IDs'
);
select has_function('public','set_payment_reminder_control',array['uuid','uuid','boolean','timestamptz','text'],'audited reminder control exists');
select has_function('public','set_payment_legal_hold',array['uuid','text','text','text','uuid'],'idempotent legal hold command exists');
select has_function('public','recalculate_project_obligations_for_snapshot',array['uuid','uuid'],'proposal revision obligation recalculation exists');
select has_function('public','get_payment_operational_health',array[]::text[],'operational health query exists');
select has_function('public','purge_expired_payment_secrets',array['timestamptz'],'secret-only retention cleanup exists');
select col_is_pk('public','payment_transactions','payment_transaction_id','transaction identity is immutable');
select col_is_pk('public','payment_legal_holds','payment_legal_hold_id','hold events are append-only identities');
select has_trigger('public','payment_transactions','trg_payment_transactions_immutable','transaction updates and deletes are rejected');
select has_trigger('public','payment_transaction_allocations','trg_payment_allocations_immutable','allocation updates and deletes are rejected');
select has_trigger('public','payment_provider_events','trg_payment_provider_events_no_delete','provider evidence cannot be deleted');
select col_not_null('public','payment_transactions','payment_reference','every ledger effect has a BB reference');
select col_not_null('public','payment_message_delivery_events','payload_digest','delivery webhooks retain a normalized evidence digest');
select col_not_null('public','payment_legal_holds','command_key','legal hold replay has an idempotency key');
select results_eq(
  $$ select count(*)::bigint from public.project_payment_records where target_amount < credited_principal + outstanding_amount - 0.01 or target_amount > credited_principal + outstanding_amount + 0.01 $$,
  array[0::bigint],
  'legacy classified obligation aggregates preserve cent parity'
);
select results_eq(
  $$ select count(*)::bigint from public.payment_checkout_attempts where customer_fee <> 0 or charge_amount <> principal_amount $$,
  array[0::bigint],
  'card surcharge remains fixed off and fees never change principal'
);
select results_eq(
  $$ select count(*)::bigint from public.payment_requests where status not in ('draft','active') and (token_ciphertext is not null or invalidated_at is null) $$,
  array[0::bigint],
  'inactive request links have no reusable ciphertext'
);
select results_eq(
  $$ select count(*)::bigint from public.payment_transaction_allocations a join public.payment_transactions t using(payment_transaction_id) join public.project_payment_records o on o.project_payment_record_id=a.obligation_id where t.project_id<>o.project_id $$,
  array[0::bigint],
  'allocations never cross project boundaries'
);
select * from finish();

rollback;
