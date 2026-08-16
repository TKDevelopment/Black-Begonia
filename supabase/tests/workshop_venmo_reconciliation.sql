begin;
select no_plan();

select has_function(
  'public','record_workshop_venmo_receipt',
  array['text','text','bigint','text','timestamp with time zone','uuid'],
  'direct Venmo receipt command exists'
);
select has_function(
  'public','resolve_workshop_payment_exception',
  array['uuid','text','text','bigint','uuid'],
  'payment exception resolution command exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.record_workshop_venmo_receipt(text,text,bigint,text,timestamptz,uuid)',
    'EXECUTE'
  ),
  'anonymous callers cannot confirm direct Venmo receipts'
);

insert into public.workshop_definitions(
  workshop_definition_id,title,theme,advertising_line,description,
  included_materials,default_terms
) values (
  '32000000-0000-4000-8000-000000000001','Venmo Workshop','seasonal',
  'Venmo reconciliation test','Safe Venmo fixture','Materials','Terms'
);
insert into public.workshop_occurrences(
  workshop_occurrence_id,workshop_definition_id,slug,status,title_snapshot,
  advertising_line_snapshot,description_snapshot,included_materials_snapshot,
  terms_snapshot,terms_version,venue_name,address_line_1,locality,region,
  postal_code,country,timezone,local_start,local_end,utc_offset_minutes,
  start_at,end_at,registration_opens_at,registration_closes_at,capacity,
  per_booking_limit,price_minor,currency,stripe_enabled,venmo_enabled,
  waitlist_enabled
) values (
  '32000000-0000-4000-8000-000000000002',
  '32000000-0000-4000-8000-000000000001',
  'venmo-workshop','published_open','Venmo Workshop',
  'Venmo reconciliation test','Safe Venmo fixture','Materials','Terms',1,
  'Studio','100 Flower Lane','Richmond','VA','23220','US','UTC',
  (now()+interval '10 days')::timestamp,(now()+interval '10 days 2 hours')::timestamp,
  0,now()+interval '10 days',now()+interval '10 days 2 hours',
  now()-interval '1 day',now()+interval '9 days',10,4,6000,'USD',
  false,true,false
);

select lives_ok(
  $$select public.create_workshop_seat_hold(
    'venmo-workshop',2,'Venmo Customer','venmo@example.test',null,1,
    'hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
    '32000000-0000-4000-8000-000000000010',15
  )$$,
  'direct Venmo fixture booking is held'
);
select lives_ok(
  $$select public.switch_workshop_payment_method(
    'hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh','direct_venmo',
    '32000000-0000-4000-8000-000000000011',
    'https://venmo.com/u/approved-business',15,24
  )$$,
  'direct Venmo instructions use an approved target'
);
select ok(
  (
    select reconciliation_reference like 'BBW-%-%'
      and reconciliation_reference not like '%@%'
      and venmo_target_snapshot='https://venmo.com/u/approved-business'
      and effective_expires_at<=now()+interval '24 hours 1 minute'
    from public.workshop_payment_attempts
    where command_key='32000000-0000-4000-8000-000000000011'
  ),
  'direct Venmo instructions have a non-secret attempt reference and capped deadline'
);
select lives_ok(
  $$select public.record_workshop_venmo_receipt(
    (select reconciliation_reference from public.workshop_payment_attempts
      where command_key='32000000-0000-4000-8000-000000000011'),
    'venmo-payment-valid',12000,'USD',now(),
    '32000000-0000-4000-8000-000000000012'
  )$$,
  'florist confirmation records an on-time exact direct Venmo receipt'
);
select is(
  (select status from public.workshop_bookings where contact_email='venmo@example.test'),
  'confirmed',
  'exact on-time direct Venmo receipt confirms the booking'
);
select is(
  (select count(*)::integer from public.workshop_payment_transactions
    where provider_transaction_id='venmo-payment-valid'),
  1,
  'direct Venmo receipt appends exactly one immutable transaction'
);
select lives_ok(
  $$select public.record_workshop_venmo_receipt(
    (select reconciliation_reference from public.workshop_payment_attempts
      where command_key='32000000-0000-4000-8000-000000000011'),
    'venmo-payment-valid',12000,'USD',now(),
    '32000000-0000-4000-8000-000000000012'
  )$$,
  'direct Venmo receipt replay is safe'
);
select is(
  (select count(*)::integer from public.workshop_payment_transactions
    where provider_transaction_id='venmo-payment-valid'),
  1,
  'direct Venmo replay has no duplicate ledger effect'
);

select lives_ok(
  $$select public.create_workshop_seat_hold(
    'venmo-workshop',1,'Under Customer','under@example.test',null,1,
    'iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii',
    '32000000-0000-4000-8000-000000000020',15
  )$$,
  'underpayment fixture booking is held'
);
select lives_ok(
  $$select public.switch_workshop_payment_method(
    'iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii','direct_venmo',
    '32000000-0000-4000-8000-000000000021',
    'https://venmo.com/u/approved-business',15,24
  )$$,
  'underpayment fixture instructions are active'
);
select lives_ok(
  $$select public.record_workshop_venmo_receipt(
    (select reconciliation_reference from public.workshop_payment_attempts
      where command_key='32000000-0000-4000-8000-000000000021'),
    'venmo-payment-under',5500,'USD',now(),
    '32000000-0000-4000-8000-000000000022'
  )$$,
  'direct Venmo underpayment is recorded without confirmation'
);
select is(
  (select exception_type from public.workshop_payment_exceptions
    where command_key='32000000-0000-4000-8000-000000000022'),
  'underpayment',
  'direct Venmo underpayment enters the exception queue'
);
select is(
  (select status from public.workshop_bookings where contact_email='under@example.test'),
  'pending_payment',
  'direct Venmo underpayment does not confirm capacity'
);
select lives_ok(
  $$select public.resolve_workshop_payment_exception(
    (select workshop_payment_exception_id from public.workshop_payment_exceptions
      where command_key='32000000-0000-4000-8000-000000000022'),
    'external_refund','venmo-refund-under',5500,
    '32000000-0000-4000-8000-000000000023'
  )$$,
  'external direct Venmo refund resolves the exception append-only'
);
select is(
  (select count(*)::integer from public.workshop_payment_transactions
    where provider_transaction_id='venmo-refund-under'
      and transaction_type='refund'),
  1,
  'external refund creates a separate immutable refund transaction'
);

select lives_ok(
  $$select public.create_workshop_seat_hold(
    'venmo-workshop',1,'Switch Customer','switch@example.test',null,1,
    'jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj',
    '32000000-0000-4000-8000-000000000030',15
  )$$,
  'superseded-reference fixture booking is held'
);
select lives_ok(
  $$select public.switch_workshop_payment_method(
    'jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj','direct_venmo',
    '32000000-0000-4000-8000-000000000031',
    'https://venmo.com/u/approved-business',15,24
  )$$,
  'first direct Venmo attempt is active'
);
select lives_ok(
  $$select public.switch_workshop_payment_method(
    'jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj','direct_venmo',
    '32000000-0000-4000-8000-000000000032',
    'https://venmo.com/u/approved-business',15,24
  )$$,
  'replacement direct Venmo attempt supersedes the first'
);
select isnt(
  (select reconciliation_reference from public.workshop_payment_attempts
    where command_key='32000000-0000-4000-8000-000000000031'),
  (select reconciliation_reference from public.workshop_payment_attempts
    where command_key='32000000-0000-4000-8000-000000000032'),
  'each direct Venmo attempt has a distinct reconciliation reference'
);
select lives_ok(
  $$select public.record_workshop_venmo_receipt(
    (select reconciliation_reference from public.workshop_payment_attempts
      where command_key='32000000-0000-4000-8000-000000000031'),
    'venmo-payment-superseded',6000,'USD',now(),
    '32000000-0000-4000-8000-000000000033'
  )$$,
  'money sent against superseded instructions is retained for review'
);
select is(
  (select exception_type from public.workshop_payment_exceptions
    where command_key='32000000-0000-4000-8000-000000000033'),
  'superseded_payment',
  'superseded direct Venmo reference never confirms the booking'
);

select lives_ok(
  $$select public.record_workshop_venmo_receipt(
    'UNKNOWN-WORKSHOP-REFERENCE','venmo-payment-unmatched',6000,'USD',now(),
    '32000000-0000-4000-8000-000000000040'
  )$$,
  'missing direct Venmo reference is retained as unmatched money'
);
select is(
  (select exception_type from public.workshop_payment_exceptions
    where command_key='32000000-0000-4000-8000-000000000040'),
  'missing_reference',
  'missing direct Venmo reference creates an urgent exception'
);

select * from finish();
rollback;
