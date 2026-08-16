begin;
select no_plan();

select ok(to_regclass('public.workshop_payment_attempts') is not null,'payment attempts exist');
select ok(to_regclass('public.workshop_payment_transactions') is not null,'transaction ledger exists');
select ok(to_regclass('public.workshop_payment_provider_events') is not null,'provider evidence exists');
select ok(to_regclass('public.workshop_payment_exceptions') is not null,'payment exceptions exist');
select ok(to_regclass('public.workshop_expenses') is not null,'workshop expenses exist');
select ok(to_regclass('public.workshop_financial_entries') is not null,'normalized financial projection exists');
select has_column('public','workshop_refund_requests','seat_quantity',
  'refund requests can reserve a roster seat quantity');
select has_column('public','workshop_refund_requests','seats_released_at',
  'refund requests record when seats were released');
select has_function('public','manage_workshop_refund_order',array['text','jsonb','uuid'],
  'seat-aware refund order command exists');
select has_trigger('public','workshop_refund_requests',
  'trg_workshop_refund_requests_release_seats',
  'reconciled Stripe refund requests release their reserved seats');
select has_trigger('public','workshop_payment_transactions','trg_workshop_payment_transactions_immutable','transaction ledger is immutable');
select has_trigger('public','workshop_expenses','trg_workshop_expenses_immutable','expense facts are immutable');
select has_trigger('public','workshop_payment_provider_events','trg_workshop_payment_provider_events_no_delete','provider evidence cannot be deleted');
select has_index('public','workshop_payment_provider_events','uq_workshop_provider_event_effect','provider semantic effects are unique');
select ok((select relrowsecurity from pg_class where oid='public.workshop_payment_transactions'::regclass),'financial ledger enforces RLS');
select ok(not has_table_privilege('anon','public.workshop_payment_transactions','SELECT'),'anonymous users cannot read finance');
select is((select public from storage.buckets where id='workshop-receipts'),false,'receipt bucket is private');
select ok(not exists(select 1 from information_schema.columns where table_schema='public' and table_name='workshop_financial_entries' and column_name in ('contact_email','contact_phone','status_token_digest')),'financial projection excludes personal and token data');
select ok(
  pg_get_viewdef('public.workshop_financial_entries'::regclass,true)::text
    like '%signed_amount_minor%',
  'financial projection signs income and expense values'
);
select has_function(
  'public','reconcile_workshop_stripe_event',
  array[
    'text','text','text','text','timestamp with time zone',
    'timestamp with time zone','text','uuid','text','bigint','text','uuid'
  ],
  'trusted Stripe reconciliation command exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.reconcile_workshop_stripe_event(text,text,text,text,timestamptz,timestamptz,text,uuid,text,bigint,text,uuid)',
    'EXECUTE'
  ),
  'anonymous callers cannot reconcile Stripe money'
);
select ok(
  position(
    'for no key update' in lower(pg_get_functiondef(
      'public.reconcile_workshop_stripe_event(text,text,text,text,timestamptz,timestamptz,text,uuid,text,bigint,text,uuid)'::regprocedure
    ))
  ) > 0,
  'Stripe reconciliation uses a non-key attempt lock compatible with provider-event foreign keys'
);
select ok(
  position(
    'from public.workshop_payment_attempts' in lower(pg_get_functiondef(
      'public.reconcile_workshop_stripe_event(text,text,text,text,timestamptz,timestamptz,text,uuid,text,bigint,text,uuid)'::regprocedure
    ))
  ) < position(
    'insert into public.workshop_payment_provider_events' in lower(pg_get_functiondef(
      'public.reconcile_workshop_stripe_event(text,text,text,text,timestamptz,timestamptz,text,uuid,text,bigint,text,uuid)'::regprocedure
    ))
  ),
  'Stripe reconciliation locks the payment attempt before inserting provider evidence'
);
select ok(
  position(
    'on conflict (provider, provider_event_id)' in lower(pg_get_functiondef(
      'public.reconcile_workshop_stripe_event(text,text,text,text,timestamptz,timestamptz,text,uuid,text,bigint,text,uuid)'::regprocedure
    ))
  ) > 0,
  'concurrent replay insertion is conflict-safe'
);

select lives_ok(
  $$select public.reconcile_workshop_stripe_event(
    'evt_workshop_unmatched_lock_order','payment_intent.succeeded',
    'pi_workshop_unmatched_lock_order','payment_intent',now(),now(),
    '9999999999999999999999999999999999999999999999999999999999999999',
    '31000000-0000-4000-8000-000000000009',
    'pi_workshop_unmatched_lock_order',15000,'USD',
    '31000000-0000-4000-8000-000000000008'
  )$$,
  'unmatched Stripe money is durably recorded without a foreign-key failure'
);
select is(
  (select processing_state
   from public.workshop_payment_provider_events
   where provider_event_id = 'evt_workshop_unmatched_lock_order'),
  'unmatched',
  'unmatched provider evidence retains its terminal state'
);
select is(
  (select exception_type
   from public.workshop_payment_exceptions
   where command_key = '31000000-0000-4000-8000-000000000008'),
  'unmatched_payment',
  'unmatched Stripe money remains visible for manual reconciliation'
);

insert into public.workshop_definitions(
  workshop_definition_id,title,theme,advertising_line,description,
  included_materials,default_terms
) values (
  '31000000-0000-4000-8000-000000000001','Payment Workshop','seasonal',
  'Payment reconciliation test','Safe payment fixture','Materials','Terms'
);
insert into public.workshop_stripe_price_versions(
  workshop_stripe_price_version_id,workshop_definition_id,stripe_product_id,
  stripe_price_id,amount_minor,currency,state,provider_created_at
) values (
  '31000000-0000-4000-8000-000000000002',
  '31000000-0000-4000-8000-000000000001',
  'prod_payment_test','price_payment_7500',7500,'USD','active',now()
);
insert into public.workshop_occurrences(
  workshop_occurrence_id,workshop_definition_id,slug,status,title_snapshot,
  advertising_line_snapshot,description_snapshot,included_materials_snapshot,
  terms_snapshot,terms_version,venue_name,address_line_1,locality,region,
  postal_code,country,timezone,local_start,local_end,utc_offset_minutes,
  start_at,end_at,registration_opens_at,registration_closes_at,capacity,
  per_booking_limit,price_minor,currency,stripe_price_version_id,
  stripe_enabled,venmo_enabled,waitlist_enabled
) values (
  '31000000-0000-4000-8000-000000000003',
  '31000000-0000-4000-8000-000000000001',
  'payment-workshop','published_open','Payment Workshop',
  'Payment reconciliation test','Safe payment fixture','Materials','Terms',1,
  'Studio','100 Flower Lane','Richmond','VA','23220','US','UTC',
  (now()+interval '10 days')::timestamp,(now()+interval '10 days 2 hours')::timestamp,
  0,now()+interval '10 days',now()+interval '10 days 2 hours',
  now()-interval '1 day',now()+interval '9 days',4,4,7500,'USD',
  '31000000-0000-4000-8000-000000000002',true,true,false
);

select lives_ok(
  $$select public.create_workshop_seat_hold(
    'payment-workshop',2,'Stripe Customer','stripe@example.test',null,1,
    'ddddddddddddddddddddddddddddddddddddddddddd',
    '31000000-0000-4000-8000-000000000010',15
  )$$,
  'Stripe fixture booking is held'
);
select lives_ok(
  $$select public.switch_workshop_payment_method(
    'ddddddddddddddddddddddddddddddddddddddddddd','stripe',
    '31000000-0000-4000-8000-000000000011',null,15,24
  )$$,
  'Stripe fixture attempt is active'
);
select lives_ok(
  $$select public.reconcile_workshop_stripe_event(
    'evt_workshop_success','checkout.session.completed','cs_workshop_success',
    'checkout.session',now(),now(),
    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    (select workshop_payment_attempt_id from public.workshop_payment_attempts
      where command_key='31000000-0000-4000-8000-000000000011'),
    'pi_workshop_success',15000,'USD',
    '31000000-0000-4000-8000-000000000012'
  )$$,
  'signed authoritative Stripe success confirms the booking'
);
select is(
  (select status from public.workshop_bookings where contact_email='stripe@example.test'),
  'confirmed',
  'trusted Stripe completion confirms the booking'
);
select is(
  public.get_workshop_booking_status(
    'ddddddddddddddddddddddddddddddddddddddddddd'
  )->>'state',
  'confirmed',
  'confirmed status returns only a clean public-workshop handoff'
);
select is(
  public.get_workshop_booking_status(
    'ddddddddddddddddddddddddddddddddddddddddddd'
  )->>'publicWorkshopPath',
  '/workshops/payment-workshop/' || (now()+interval '10 days')::date::text,
  'confirmed status path contains no booking token'
);
select is(
  public.get_workshop_booking_status(
    'ddddddddddddddddddddddddddddddddddddddddddd'
  )->>'workshopTitle',
  'Payment Workshop',
  'confirmed status includes the booked workshop title'
);
select is(
  public.get_workshop_booking_status(
    'ddddddddddddddddddddddddddddddddddddddddddd'
  )->>'activeQuantity',
  '2',
  'confirmed status includes the active seats booked'
);
select is(
  public.get_workshop_booking_status(
    'ddddddddddddddddddddddddddddddddddddddddddd'
  )->>'termsSnapshot',
  'Terms',
  'confirmed status includes the immutable terms accepted at booking'
);
select ok(
  not (
    public.get_workshop_booking_status(
      'ddddddddddddddddddddddddddddddddddddddddddd'
    ) ?| array['contactEmail','contactPhone','statusTokenDigest']
  ),
  'confirmed status excludes customer contact and credential fields'
);
select is(
  (select state from public.workshop_seat_holds
    where booking_id=(select workshop_booking_id from public.workshop_bookings
      where contact_email='stripe@example.test')),
  'confirmed',
  'trusted Stripe completion confirms capacity exactly once'
);
select is(
  (select count(*)::integer from public.workshop_payment_transactions
    where provider_transaction_id='pi_workshop_success'),
  1,
  'Stripe success appends one immutable transaction'
);
select lives_ok(
  $$select public.reconcile_workshop_stripe_event(
    'evt_workshop_success','checkout.session.completed','cs_workshop_success',
    'checkout.session',now(),now(),
    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    (select workshop_payment_attempt_id from public.workshop_payment_attempts
      where command_key='31000000-0000-4000-8000-000000000011'),
    'pi_workshop_success',15000,'USD',
    '31000000-0000-4000-8000-000000000012'
  )$$,
  'Stripe provider-event replay is safe'
);
select is(
  (select count(*)::integer from public.workshop_payment_transactions
    where provider_transaction_id='pi_workshop_success'),
  1,
  'Stripe replay has no duplicate ledger or capacity effect'
);
select lives_ok(
  $$select public.reconcile_workshop_stripe_event(
    'evt_payment_intent_same_charge','payment_intent.succeeded',
    'pi_workshop_success','payment_intent',now(),now(),
    'abababababababababababababababababababababababababababababababab',
    (select workshop_payment_attempt_id from public.workshop_payment_attempts
      where command_key='31000000-0000-4000-8000-000000000011'),
    'pi_workshop_success',15000,'USD',
    '31000000-0000-4000-8000-000000000015'
  )$$,
  'a different Stripe success event for the same payment is safely absorbed'
);
select is(
  (select processing_state from public.workshop_payment_provider_events
    where provider_event_id='evt_payment_intent_same_charge'),
  'duplicate',
  'cross-event Stripe success is recorded as a semantic duplicate'
);
select is(
  (select count(*)::integer from public.workshop_payment_transactions
    where provider_transaction_id='pi_workshop_success'
      and transaction_type='charge'),
  1,
  'cross-event Stripe success cannot violate the provider transaction key'
);
select lives_ok(
  $$select public.reconcile_workshop_stripe_event(
    'evt_workshop_failure_after_success','checkout.session.async_payment_failed',
    'cs_workshop_failure_after_success','checkout.session',now(),now(),
    'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    (select workshop_payment_attempt_id from public.workshop_payment_attempts
      where command_key='31000000-0000-4000-8000-000000000011'),
    'pi_workshop_success',15000,'USD',
    '31000000-0000-4000-8000-000000000013'
  )$$,
  'out-of-order failure after success is safely absorbed'
);
select is(
  (select status from public.workshop_bookings where contact_email='stripe@example.test'),
  'confirmed',
  'out-of-order failure cannot reverse a trusted success'
);

select lives_ok(
  $$select public.create_workshop_seat_hold(
    'payment-workshop',1,'Mismatch Customer','mismatch@example.test',null,1,
    'ggggggggggggggggggggggggggggggggggggggggggg',
    '31000000-0000-4000-8000-000000000020',15
  )$$,
  'mismatch fixture booking is held'
);
select lives_ok(
  $$select public.switch_workshop_payment_method(
    'ggggggggggggggggggggggggggggggggggggggggggg','stripe',
    '31000000-0000-4000-8000-000000000021',null,15,24
  )$$,
  'mismatch fixture attempt is active'
);
select lives_ok(
  $$select public.reconcile_workshop_stripe_event(
    'evt_workshop_underpayment','checkout.session.completed','cs_underpayment',
    'checkout.session',now(),now(),
    '1111111111111111111111111111111111111111111111111111111111111111',
    (select workshop_payment_attempt_id from public.workshop_payment_attempts
      where command_key='31000000-0000-4000-8000-000000000021'),
    'pi_underpayment',7000,'USD',
    '31000000-0000-4000-8000-000000000022'
  )$$,
  'mismatched Stripe money is recorded as an exception'
);
select is(
  (select status from public.workshop_bookings where contact_email='mismatch@example.test'),
  'pending_payment',
  'mismatched Stripe money does not confirm the booking'
);
select is(
  (select exception_type from public.workshop_payment_exceptions
    where command_key='31000000-0000-4000-8000-000000000022'),
  'underpayment',
  'Stripe amount mismatch is explicit and operationally reviewable'
);
select ok(
  (
    select coalesce(sum(quantity),0) <= (
      select capacity from public.workshop_occurrences where slug='payment-workshop'
    )
    from public.workshop_seat_holds
    where workshop_occurrence_id='31000000-0000-4000-8000-000000000003'
      and state in('active','confirmed')
  ),
  'reconciliation never oversells the occurrence'
);

select ok(
  to_regclass('public.workshop_refund_requests') is not null,
  'refund requests have an authoritative operational state'
);
select has_function(
  'public','manage_workshop_financials',array['text','jsonb','uuid'],
  'authoritative workshop financial command exists'
);
select has_function(
  'public','manage_workshop_expenses',array['text','jsonb','uuid'],
  'authoritative workshop expense command exists'
);
select throws_ok(
  $$update public.workshop_payment_transactions set amount_minor=1
    where provider_transaction_id='pi_workshop_success'$$,
  '55000','Workshop financial history is immutable.',
  'trusted transaction facts cannot be rewritten'
);
select throws_ok(
  $$delete from public.workshop_payment_transactions
    where provider_transaction_id='pi_workshop_success'$$,
  '55000','Workshop financial history is immutable.',
  'trusted transaction facts cannot be deleted'
);

insert into public.profiles(id,is_active)
values('32000000-0000-4000-8000-000000000001',true)
on conflict(id) do update set is_active=true;
insert into public.user_roles(user_id,role)
values('32000000-0000-4000-8000-000000000001','staff')
on conflict(user_id,role) do nothing;
insert into public.workshop_series(
  workshop_series_id,workshop_definition_id,series_label,default_capacity,
  default_price_minor,default_currency,default_venue_name,
  default_address_line_1,default_locality,default_region,default_postal_code,
  default_country,default_timezone
) values (
  '32000000-0000-4000-8000-000000000002',
  '31000000-0000-4000-8000-000000000001','Payment Series',4,7500,'USD',
  'Studio','100 Flower Lane','Richmond','VA','23220','US','UTC'
);
update public.workshop_occurrences
set workshop_series_id='32000000-0000-4000-8000-000000000002',
  price_minor=9999
where workshop_occurrence_id='31000000-0000-4000-8000-000000000003';
select is(
  (select amount_minor from public.workshop_payment_transactions
    where provider_transaction_id='pi_workshop_success'),
  15000::bigint,
  'financial history keeps the trusted booking snapshot after price changes'
);

select ok(
  not has_function_privilege(
    'anon','public.manage_workshop_financials(text,jsonb,uuid)','EXECUTE'
  ),
  'anonymous actors cannot inspect or mutate workshop financials'
);
set local role authenticated;
set local request.jwt.claims=
  '{"sub":"32000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local request.jwt.claim.sub='32000000-0000-4000-8000-000000000001';
select is(
  (public.manage_workshop_financials(
    'refund_eligibility',
    jsonb_build_object(
      'transactionId',(select workshop_payment_transaction_id
        from public.workshop_payment_transactions
        where provider_transaction_id='pi_workshop_success')
    ),
    '32000000-0000-4000-8000-000000000010'
  )->>'remainingRefundableMinor')::bigint,
  15000::bigint,'trusted Stripe charge exposes its remaining refundable balance'
);
select is(
  (public.manage_workshop_financials(
    'request_refund',
    jsonb_build_object(
      'transactionId',(select workshop_payment_transaction_id
        from public.workshop_payment_transactions
        where provider_transaction_id='pi_workshop_success'),
      'amountMinor',5000,'currency','USD','reason','customer_requested'
    ),
    '32000000-0000-4000-8000-000000000011'
  )->>'state'),
  'requested','authorized partial Stripe refund becomes provider work'
);
select is(
  (public.manage_workshop_financials(
    'request_refund',
    jsonb_build_object(
      'transactionId',(select workshop_payment_transaction_id
        from public.workshop_payment_transactions
        where provider_transaction_id='pi_workshop_success'),
      'amountMinor',5000,'currency','USD','reason','customer_requested'
    ),
    '32000000-0000-4000-8000-000000000011'
  )->>'replayed')::boolean,
  true,'refund request command replay is deterministic'
);
select throws_ok(
  $$select public.manage_workshop_financials(
    'request_refund',
    jsonb_build_object(
      'transactionId',(select workshop_payment_transaction_id
        from public.workshop_payment_transactions
        where provider_transaction_id='pi_workshop_success'),
      'amountMinor',10001,'currency','USD','reason','customer_requested'
    ),
    '32000000-0000-4000-8000-000000000012'
  )$$,
  'P0001','refund_not_eligible',
  'concurrent refund requests cannot exceed the locked remaining balance'
);
select throws_ok(
  $$select public.manage_workshop_financials(
    'request_refund',
    jsonb_build_object(
      'transactionId',(select workshop_payment_transaction_id
        from public.workshop_payment_transactions
        where provider_transaction_id='pi_workshop_success'),
      'amountMinor',100,'currency','EUR','reason','customer_requested'
    ),
    '32000000-0000-4000-8000-000000000013'
  )$$,
  'P0001','refund_not_eligible','refund currency must match the trusted charge'
);
select throws_ok(
  $$select public.manage_workshop_financials(
    'request_refund',
    jsonb_build_object(
      'transactionId',(select workshop_payment_transaction_id
        from public.workshop_payment_transactions
        where provider_transaction_id='pi_workshop_success'),
      'amountMinor',0,'currency','USD','reason','customer_requested'
    ),
    '32000000-0000-4000-8000-000000000014'
  )$$,
  'P0001','refund_not_eligible','refund amount must be positive'
);
select is(
  (select active_quantity from public.workshop_bookings
    where contact_email='stripe@example.test'),
  2,'refund initiation does not cancel seats'
);

reset role;
select is(
  (public.manage_workshop_financials(
    'refund_provider_accepted',
    jsonb_build_object(
      'requestId',(select workshop_refund_request_id
        from public.workshop_refund_requests
        where command_key='32000000-0000-4000-8000-000000000011'),
      'providerRefundId','re_partial_5000'
    ),
    '32000000-0000-4000-8000-000000000015'
  )->>'state'),
  'provider_accepted','provider acceptance remains distinct from reconciliation'
);
select is(
  (public.manage_workshop_financials(
    'record_provider_fact',
    jsonb_build_object(
      'kind','refund','state','pending','amountMinor',5000,'currency','USD',
      'providerObjectId','re_partial_5000','providerObjectType','refund',
      'providerEventId','evt_refund_partial_pending','eventType','refund.created',
      'occurredAt',now(),'payloadDigest',repeat('9',64),
      'refundRequestId',(select workshop_refund_request_id
        from public.workshop_refund_requests
        where command_key='32000000-0000-4000-8000-000000000011')
    ),
    '32000000-0000-4000-8000-000000000098'
  )->>'kind'),
  'refund','pending refund webhook records provider evidence'
);
select is(
  (select count(*)::integer from public.workshop_payment_transactions
    where provider='stripe' and provider_transaction_id='re_partial_5000'
      and transaction_type='refund'),
  0,'pending refund does not append a completed money fact'
);
select is(
  (public.manage_workshop_financials(
    'record_provider_fact',
    jsonb_build_object(
      'kind','refund','state','confirmed','amountMinor',5000,'currency','USD',
      'providerObjectId','re_partial_5000','providerObjectType','refund',
      'providerEventId','evt_refund_partial','eventType','refund.updated',
      'occurredAt',now(),'payloadDigest',repeat('a',64),
      'refundRequestId',(select workshop_refund_request_id
        from public.workshop_refund_requests
        where command_key='32000000-0000-4000-8000-000000000011')
    ),
    '32000000-0000-4000-8000-000000000016'
  )->>'kind'),
  'refund','trusted refund webhook appends an immutable refund fact'
);
select is(
  (select payment_state from public.workshop_bookings
    where contact_email='stripe@example.test'),
  'partially_refunded','partial refund derives the booking payment projection'
);
select is(
  (select active_quantity from public.workshop_bookings
    where contact_email='stripe@example.test'),
  2,'refund reconciliation still has no capacity effect'
);
select is(
  (public.manage_workshop_financials(
    'record_provider_fact',
    jsonb_build_object(
      'kind','refund','state','confirmed','amountMinor',5000,'currency','USD',
      'providerObjectId','re_partial_5000','providerObjectType','refund',
      'providerEventId','evt_refund_partial','eventType','refund.updated',
      'occurredAt',now(),'payloadDigest',repeat('a',64),
      'refundRequestId',(select workshop_refund_request_id
        from public.workshop_refund_requests
        where command_key='32000000-0000-4000-8000-000000000011')
    ),
    '32000000-0000-4000-8000-000000000016'
  )->>'replayed')::boolean,
  true,'refund provider-event replay cannot duplicate the ledger'
);
select is(
  (public.manage_workshop_financials(
    'record_provider_fact',
    jsonb_build_object(
      'kind','refund','state','confirmed','amountMinor',5000,'currency','USD',
      'providerObjectId','re_partial_5000','providerObjectType','refund',
      'providerEventId','evt_refund_partial_overlap','eventType','refund.created',
      'occurredAt',now(),'payloadDigest',repeat('8',64),
      'refundRequestId',(select workshop_refund_request_id
        from public.workshop_refund_requests
        where command_key='32000000-0000-4000-8000-000000000011')
    ),
    '32000000-0000-4000-8000-000000000099'
  )->>'replayed')::boolean,
  true,'overlapping refund event types cannot duplicate one provider money fact'
);
select is(
  (select count(*)::integer from public.workshop_payment_transactions
    where provider='stripe' and provider_transaction_id='re_partial_5000'
      and transaction_type='refund'),
  1,'provider-object ledger uniqueness survives overlapping refund events'
);

set local role authenticated;
select lives_ok(
  $$select public.manage_workshop_financials(
    'request_refund',
    jsonb_build_object(
      'transactionId',(select workshop_payment_transaction_id
        from public.workshop_payment_transactions
        where provider_transaction_id='pi_workshop_success'),
      'amountMinor',10000,'currency','USD','reason','event_cancelled'
    ),
    '32000000-0000-4000-8000-000000000020'
  )$$,'remaining balance may be requested once'
);
reset role;
select is(
  (public.manage_workshop_financials(
    'refund_provider_failed',
    jsonb_build_object(
      'requestId',(select workshop_refund_request_id
        from public.workshop_refund_requests
        where command_key='32000000-0000-4000-8000-000000000020'),
      'safeFailure','provider_rejected'
    ),
    '32000000-0000-4000-8000-000000000021'
  )->>'state'),
  'provider_failed','provider failure remains visible and releases eligibility'
);
set local role authenticated;
select is(
  (public.manage_workshop_financials(
    'refund_eligibility',
    jsonb_build_object(
      'transactionId',(select workshop_payment_transaction_id
        from public.workshop_payment_transactions
        where provider_transaction_id='pi_workshop_success')
    ),
    '32000000-0000-4000-8000-000000000022'
  )->>'remainingRefundableMinor')::bigint,
  10000::bigint,'failed provider request does not consume refundable balance'
);
select lives_ok(
  $$select public.manage_workshop_financials(
    'request_refund',
    jsonb_build_object(
      'transactionId',(select workshop_payment_transaction_id
        from public.workshop_payment_transactions
        where provider_transaction_id='pi_workshop_success'),
      'amountMinor',10000,'currency','USD','reason','event_cancelled'
    ),
    '32000000-0000-4000-8000-000000000023'
  )$$,'remaining trusted balance can be requested after provider failure'
);
reset role;
select lives_ok(
  $$select public.manage_workshop_financials(
    'refund_provider_accepted',
    jsonb_build_object(
      'requestId',(select workshop_refund_request_id
        from public.workshop_refund_requests
        where command_key='32000000-0000-4000-8000-000000000023'),
      'providerRefundId','re_final_10000'
    ),
    '32000000-0000-4000-8000-000000000024'
  )$$,'full refund provider request is accepted'
);
select lives_ok(
  $$select public.manage_workshop_financials(
    'record_provider_fact',
    jsonb_build_object(
      'kind','refund','state','confirmed','amountMinor',10000,'currency','USD',
      'providerObjectId','re_final_10000','providerObjectType','refund',
      'providerEventId','evt_refund_final','eventType','refund.updated',
      'occurredAt',now(),'payloadDigest',repeat('b',64),
      'refundRequestId',(select workshop_refund_request_id
        from public.workshop_refund_requests
        where command_key='32000000-0000-4000-8000-000000000023')
    ),
    '32000000-0000-4000-8000-000000000025'
  )$$,'full refund webhook reconciliation is immutable'
);
select is(
  (select payment_state from public.workshop_bookings
    where contact_email='stripe@example.test'),
  'refunded','full trusted balance derives refunded payment state'
);
select is(
  (select active_quantity from public.workshop_bookings
    where contact_email='stripe@example.test'),
  2,'full refund still does not release seats'
);
select lives_ok(
  $$select public.manage_workshop_financials(
    'record_provider_fact',
    jsonb_build_object(
      'kind','fee','state','confirmed','amountMinor',450,'currency','USD',
      'providerObjectId','txn_fee_450','providerObjectType','balance_transaction',
      'providerEventId','evt_fee_450','eventType','charge.succeeded',
      'occurredAt',now(),'payloadDigest',repeat('c',64),
      'paymentAttemptId',(select workshop_payment_attempt_id
        from public.workshop_payment_attempts
        where command_key='31000000-0000-4000-8000-000000000011')
    ),
    '32000000-0000-4000-8000-000000000026'
  )$$,'provider fee is a distinct immutable financial fact'
);
select lives_ok(
  $$select public.manage_workshop_financials(
    'record_provider_fact',
    jsonb_build_object(
      'kind','dispute','state','confirmed','amountMinor',15000,'currency','USD',
      'providerObjectId','dp_workshop_1','providerObjectType','dispute',
      'providerEventId','evt_dispute_1','eventType','charge.dispute.created',
      'occurredAt',now(),'payloadDigest',repeat('d',64),
      'paymentAttemptId',(select workshop_payment_attempt_id
        from public.workshop_payment_attempts
        where command_key='31000000-0000-4000-8000-000000000011')
    ),
    '32000000-0000-4000-8000-000000000027'
  )$$,'trusted dispute appends history and urgent action'
);
select is(
  (select status from public.workshop_bookings
    where contact_email='stripe@example.test'),
  'payment_disputed','dispute flags the booking without cancelling it'
);
select is(
  (select active_quantity from public.workshop_bookings
    where contact_email='stripe@example.test'),
  2,'dispute has no implicit capacity effect'
);
select lives_ok(
  $$select public.manage_workshop_financials(
    'record_provider_fact',
    jsonb_build_object(
      'kind','reversal','state','confirmed','amountMinor',15000,'currency','USD',
      'providerObjectId','dp_workshop_1_closed','providerObjectType','dispute',
      'providerEventId','evt_dispute_1_closed','eventType','charge.dispute.closed',
      'occurredAt',now(),'payloadDigest',repeat('e',64),
      'paymentAttemptId',(select workshop_payment_attempt_id
        from public.workshop_payment_attempts
        where command_key='31000000-0000-4000-8000-000000000011')
    ),
    '32000000-0000-4000-8000-000000000028'
  )$$,'trusted reversal appends history without rewriting the dispute'
);
select is(
  (select active_quantity from public.workshop_bookings
    where contact_email='stripe@example.test'),
  2,'reversal also preserves workshop capacity'
);

insert into public.workshop_payment_transactions(
  workshop_booking_id,workshop_occurrence_id,workshop_payment_attempt_id,
  transaction_type,provider,provider_transaction_id,payment_reference,
  amount_minor,currency,occurred_at,state,command_key,actor_type
)
select workshop_booking_id,workshop_occurrence_id,workshop_payment_attempt_id,
  'charge','stripe','pi_roster_refund','STRIPE-ROSTER-REFUND',15000,'USD',
  now(),'paid','32000000-0000-4000-8000-000000000050','provider'
from public.workshop_payment_transactions
where provider_transaction_id='pi_workshop_success';
set local role authenticated;
select is(
  (public.manage_workshop_refund_order(
    'request_stripe',
    jsonb_build_object(
      'transactionId',(select workshop_payment_transaction_id
        from public.workshop_payment_transactions
        where provider_transaction_id='pi_roster_refund'),
      'amountMinor',7500,'seatQuantity',1,'currency','USD',
      'reason','customer_requested'
    ),
    '32000000-0000-4000-8000-000000000051'
  )->>'seatQuantity')::integer,
  1,'roster Stripe refund atomically reserves the selected seat quantity'
);
select ok(
  (public.manage_workshop_refund_order(
    'eligibility',
    jsonb_build_object(
      'transactionId',(select workshop_payment_transaction_id
        from public.workshop_payment_transactions
        where provider_transaction_id='pi_roster_refund')
    ),
    '32000000-0000-4000-8000-000000000051'
  )->>'eligible')::boolean,
  'seat-aware Stripe refund remains eligible for an idempotent command replay'
);
select is(
  (select active_quantity from public.workshop_bookings
    where contact_email='stripe@example.test'),
  2,'Stripe seats stay active until a verified provider refund fact arrives'
);
reset role;
select lives_ok(
  $$select public.manage_workshop_financials(
    'refund_provider_accepted',
    jsonb_build_object(
      'requestId',(select workshop_refund_request_id
        from public.workshop_refund_requests
        where command_key='32000000-0000-4000-8000-000000000051'),
      'providerRefundId','re_roster_refund'
    ),
    '32000000-0000-4000-8000-000000000052'
  )$$,'seat-aware Stripe refund can reach provider accepted state'
);
select lives_ok(
  $$select public.manage_workshop_financials(
    'record_provider_fact',
    jsonb_build_object(
      'kind','refund','state','confirmed','amountMinor',7500,'currency','USD',
      'providerObjectId','re_roster_refund','providerObjectType','refund',
      'providerEventId','evt_roster_refund','eventType','refund.updated',
      'occurredAt',now(),'payloadDigest',repeat('f',64),
      'refundRequestId',(select workshop_refund_request_id
        from public.workshop_refund_requests
        where command_key='32000000-0000-4000-8000-000000000051')
    ),
    '32000000-0000-4000-8000-000000000053'
  )$$,'verified Stripe refund reconciliation releases selected seats'
);
select is(
  (select active_quantity from public.workshop_bookings
    where contact_email='stripe@example.test'),
  1,'verified Stripe refund releases exactly one selected seat'
);
select ok(
  (select seats_released_at is not null from public.workshop_refund_requests
    where command_key='32000000-0000-4000-8000-000000000051'),
  'Stripe refund request records its seat release completion'
);

insert into public.workshop_payment_transactions(
  workshop_booking_id,workshop_occurrence_id,transaction_type,provider,
  provider_transaction_id,payment_reference,amount_minor,currency,occurred_at,
  state,command_key,actor_type
)
select workshop_booking_id,workshop_occurrence_id,'charge','direct_venmo',
  'venmo_external_charge','VENMO-EXTERNAL-CHARGE',3000,'USD',now(),'paid',
  '32000000-0000-4000-8000-000000000040','internal'
from public.workshop_bookings where contact_email='stripe@example.test';
set local role authenticated;
select lives_ok(
  $$select public.manage_workshop_financials(
    'record_external_refund',
    jsonb_build_object(
      'transactionId',(select workshop_payment_transaction_id
        from public.workshop_payment_transactions
        where provider_transaction_id='venmo_external_charge'),
      'amountMinor',1000,'currency','USD','reference','VENMO-REFUND-EXT-1',
      'reason','customer_requested','occurredAt',now()
    ),
    '32000000-0000-4000-8000-000000000041'
  )$$,'externally completed Venmo refund appends a separate fact'
);
select lives_ok(
  $$select public.manage_workshop_financials(
    'record_correction',
    jsonb_build_object(
      'transactionId',(select workshop_payment_transaction_id
        from public.workshop_payment_transactions
        where provider_transaction_id='venmo_external_charge'),
      'amountMinor',-200,'currency','USD','reference','CORRECTION-EXT-1',
      'reason','reconciliation','occurredAt',now()
    ),
    '32000000-0000-4000-8000-000000000042'
  )$$,'manual correction appends rather than rewriting its source'
);
select is(
  (select count(*)::integer from public.workshop_payment_transactions
    where normalized_facts->>'originalTransactionId'=(select
      workshop_payment_transaction_id::text
      from public.workshop_payment_transactions
      where provider_transaction_id='venmo_external_charge')),
  2,'external refund and correction remain traceable to the original receipt'
);

insert into public.workshop_payment_transactions(
  workshop_booking_id,workshop_occurrence_id,transaction_type,provider,
  provider_transaction_id,payment_reference,amount_minor,currency,occurred_at,
  state,command_key,actor_type
)
select workshop_booking_id,workshop_occurrence_id,'charge','direct_venmo',
  'venmo_roster_charge','VENMO-ROSTER-CHARGE',7500,'USD',now(),'paid',
  '32000000-0000-4000-8000-000000000060','internal'
from public.workshop_bookings where contact_email='stripe@example.test';
select lives_ok(
  $$select public.manage_workshop_refund_order(
    'record_venmo',
    jsonb_build_object(
      'transactionId',(select workshop_payment_transaction_id
        from public.workshop_payment_transactions
        where provider_transaction_id='venmo_roster_charge'),
      'amountMinor',7500,'seatQuantity',1,'currency','USD',
      'reference','VENMO-ROSTER-REFUND','reason','customer_requested',
      'occurredAt',now()
    ),
    '32000000-0000-4000-8000-000000000061'
  )$$,'confirmed manual Venmo refund records money and releases seats atomically'
);
select is(
  (select active_quantity from public.workshop_bookings
    where contact_email='stripe@example.test'),
  0,'manual Venmo refund releases exactly its selected seat'
);
select is(
  (select amount_minor_delta from public.workshop_booking_adjustments
    where command_key='32000000-0000-4000-8000-000000000061'),
  -7500::bigint,'Venmo refund seat adjustment records the financial delta'
);

select lives_ok(
  $$select public.manage_workshop_expenses(
    'create',
    jsonb_build_object(
      'occurrenceId','31000000-0000-4000-8000-000000000003',
      'amountMinor',2400,'currency','USD','category','materials',
      'description','Seasonal stems','vendorOrPayee','Flower Market',
      'note','Occurrence materials','expenseDate',current_date,
      'receiptStoragePath','workshop-receipts/occurrence/materials.pdf'
    ),
    '32000000-0000-4000-8000-000000000030'
  )$$,'occurrence expense accepts private receipt evidence'
);
select lives_ok(
  $$select public.manage_workshop_expenses(
    'create',
    jsonb_build_object(
      'seriesId','32000000-0000-4000-8000-000000000002',
      'amountMinor',1000,'currency','USD','category','marketing',
      'description','Series advertisement','expenseDate',current_date
    ),
    '32000000-0000-4000-8000-000000000031'
  )$$,'series expense is recorded independently'
);
select lives_ok(
  $$select public.manage_workshop_expenses(
    'correct',
    jsonb_build_object(
      'originalExpenseId',(select workshop_expense_id
        from public.workshop_expenses
        where command_key='32000000-0000-4000-8000-000000000030'),
      'occurrenceId','31000000-0000-4000-8000-000000000003',
      'amountMinor',2200,'currency','USD','category','materials',
      'description','Corrected seasonal stems','expenseDate',current_date
    ),
    '32000000-0000-4000-8000-000000000032'
  )$$,'expense correction appends reversal and replacement facts'
);
select is(
  (select count(*)::integer from public.workshop_expenses
    where correction_of_expense_id=(select workshop_expense_id
      from public.workshop_expenses
      where command_key='32000000-0000-4000-8000-000000000030')),
  2,'expense correction preserves original, reversal, and replacement history'
);
select is(
  (public.get_workshop_financial_summary(
    '31000000-0000-4000-8000-000000000003',null
  )->>'grossRevenueMinor')::bigint,
  18000::bigint,'occurrence summary derives gross revenue from immutable facts'
);
select is(
  (public.get_workshop_financial_summary(
    '31000000-0000-4000-8000-000000000003',null
  )->>'refundsMinor')::bigint,
  16000::bigint,'occurrence summary distinguishes provider and external refunds'
);
select is(
  (public.get_workshop_financial_summary(
    '31000000-0000-4000-8000-000000000003',null
  )->>'providerFeesMinor')::bigint,
  450::bigint,'occurrence summary distinguishes provider fees'
);
select is(
  (public.get_workshop_financial_summary(
    null,'32000000-0000-4000-8000-000000000002'
  )->>'expensesMinor')::bigint,
  3200::bigint,'series summary combines occurrence and series expenses'
);
select ok(
  not exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='workshop_financial_entries'
      and column_name in (
        'contact_name','contact_email','contact_phone','display_name',
        'accommodation_details','receipt_storage_path'
      )
  ),
  'dashboard projection excludes attendee and private receipt fields'
);

reset role;
select * from finish();
rollback;
