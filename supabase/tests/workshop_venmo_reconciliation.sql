begin;
select no_plan();

select has_function(
  'public','record_workshop_venmo_receipt',
  array['text','text','bigint','text','timestamp with time zone','uuid'],
  'historical direct Venmo receipt reconciliation remains available'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.record_workshop_venmo_receipt(text,text,bigint,text,timestamptz,uuid)',
    'EXECUTE'
  ),
  'anonymous callers cannot reconcile historical direct Venmo receipts'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.workshop_occurrences'::regclass
      and conname = 'workshop_occurrences_stripe_only'
  ),
  'workshop occurrences enforce Stripe-only checkout'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.workshop_occurrences'::regclass
      and conname = 'workshop_occurrences_open_requires_stripe'
  ),
  'publicly open workshop occurrences require Stripe'
);
select throws_ok(
  $$select public.switch_workshop_payment_method(
    'hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh','direct_venmo',
    '32000000-0000-4000-8000-000000000011',
    'https://venmo.com/u/legacy-business',15,24
  )$$,
  'P0001',
  'invalid_request',
  'new direct Venmo workshop handoffs are rejected before token lookup'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.switch_workshop_payment_method_before_stripe_only(text,text,uuid,text,integer,integer)',
    'EXECUTE'
  ),
  'the pre-cutover payment switch cannot be called by the service role'
);

select * from finish();
rollback;
