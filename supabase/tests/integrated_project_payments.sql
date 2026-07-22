begin;

-- Database-only payment contract tests. Edge Functions are deliberately not
-- targeted, imported, invoked, or simulated here.
select no_plan();
select ok(to_regclass('public.project_payment_records') is not null, 'legacy payment table exists');
select ok(to_regclass('public.payment_transactions') is not null, 'immutable transaction ledger exists');
select ok(to_regclass('public.payment_transaction_allocations') is not null, 'allocation ledger exists');
select ok(to_regclass('public.payment_transaction_relationships') is not null, 'append-only transaction relationships exist');
select ok(to_regclass('public.payment_requests') is not null, 'payment requests exist');
select ok(to_regclass('public.payment_checkout_attempts') is not null, 'checkout attempts exist');
select ok(to_regclass('public.payment_message_delivery_events') is not null, 'normalized delivery events exist');
select ok(to_regclass('public.payment_legal_holds') is not null, 'legal hold history exists');
select has_index('public','project_payment_records','uq_project_payment_records_active_kind','one canonical active obligation per kind');
select has_index('public','payment_transaction_allocations','idx_payment_transaction_allocations_obligation','installment allocation history is indexed');
select has_index('public','payment_transactions','idx_payment_transactions_project_occurred','project transaction history is indexed');
select has_index('public','payment_transaction_relationships','uq_payment_transaction_relationships_adjustment','one original receipt per adjustment');
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
select has_function('public','record_manual_payment',array['uuid','uuid','bigint','text','timestamptz','text','text','text','uuid','boolean','boolean'],'selected-first manual receipt boundary exists');
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
select has_trigger('public','payment_transaction_relationships','trg_payment_transaction_relationships_validate','adjustment relationships validate transaction ownership and kinds');
select has_trigger('public','payment_transaction_relationships','trg_payment_transaction_relationships_immutable','adjustment relationships are immutable');
select ok(
  (select relrowsecurity from pg_class where oid='public.payment_transaction_relationships'::regclass),
  'adjustment relationships enforce RLS'
);
select has_trigger('public','payment_provider_events','trg_payment_provider_events_no_delete','provider evidence cannot be deleted');
select col_not_null('public','payment_transactions','payment_reference','every ledger effect has a BB reference');
select col_not_null('public','payment_message_delivery_events','payload_digest','delivery webhooks retain a normalized evidence digest');
select col_not_null('public','payment_legal_holds','command_key','legal hold replay has an idempotency key');
select unlike(
  pg_get_constraintdef((select oid from pg_constraint where conrelid='public.project_payment_records'::regclass and conname='project_payment_records_paid_check')),
  '%payment_method%',
  'paid-state integrity does not require one legacy payment method'
);
select unlike(
  pg_get_constraintdef((select oid from pg_constraint where conrelid='public.project_payment_records'::regclass and conname='project_payment_records_paid_check')),
  '%paid_date%',
  'paid-state integrity does not require one legacy paid date'
);
select like(
  pg_get_functiondef('public.record_manual_payment(uuid,uuid,bigint,text,timestamptz,text,text,text,uuid,boolean,boolean)'::regprocedure),
  '%spillover_warning%',
  'manual receipt command returns a no-write spillover proposal'
);
select like(
  pg_get_functiondef('public.record_manual_payment(uuid,uuid,bigint,text,timestamptz,text,text,text,uuid,boolean,boolean)'::regprocedure),
  '%affectedObligationIds%',
  'manual receipt result identifies every affected installment'
);
select like(
  pg_get_functiondef('public.recompute_project_payment_obligations(uuid)'::regprocedure),
  '%awaiting_final_payment%',
  'ledger recomputation owns forward-only project payment gates'
);
select like(
  pg_get_functiondef('public.recompute_project_payment_obligations(uuid)'::regprocedure),
  '%installment_fulfilled%',
  'ledger recomputation suppresses reminders for fulfilled installments'
);
select like(
  pg_get_functiondef('public.get_project_financial_summary(uuid)'::regprocedure),
  '%methodSummary%',
  'financial summary projects installment method state'
);
select like(
  pg_get_functiondef('public.get_project_financial_summary(uuid)'::regprocedure),
  '%receipts%',
  'financial summary nests receipt allocations'
);
select like(
  pg_get_functiondef('public.get_project_financial_summary(uuid)'::regprocedure),
  '%limit 250%',
  'financial summary bounds project receipt and adjustment history'
);
select unlike(
  pg_get_functiondef('public.get_project_financial_summary(uuid)'::regprocedure),
  '%token_ciphertext%',
  'financial summary never projects payment-link secrets'
);
select unlike(
  pg_get_functiondef('public.get_project_financial_summary(uuid)'::regprocedure),
  '%update public.payment_intentions%',
  'financial summary remains side-effect free'
);
select unlike(
  pg_get_functiondef('public.reconcile_payment_event(uuid,jsonb)'::regprocedure),
  '%order by occurred_at desc limit 1%',
  'adjustment reconciliation never guesses the latest receipt'
);
select like(
  pg_get_functiondef('public.claim_payment_deliveries(integer)'::regprocedure),
  '%payment_request_obligations%',
  'reminder pauses resolve through request installment coverage'
);
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
