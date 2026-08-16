begin;
select no_plan();

select ok(
  pg_get_functiondef(
    'public.reserve_payment_checkout(text,text,text)'::regprocedure
  ) not like '%paypal_venmo%',
  'new project checkout attempts cannot use PayPal-backed Venmo'
);
select ok(
  pg_get_functiondef(
    'public.record_payment_intention(text,text,text)'::regprocedure
  ) like '%venmo_business_target%',
  'direct Venmo snapshots the configured business target'
);

insert into public.projects(project_id,project_name,event_date,status)
values(
  '33000000-0000-4000-8000-000000000001',
  'Direct Venmo Project','2026-10-10','active'
);
insert into public.payment_collection_settings(
  settings_id,collection_enabled,stripe_enabled,venmo_enabled,
  venmo_business_target
) values(
  true,true,true,true,'https://venmo.com/u/black-begonia'
) on conflict(settings_id) do update set
  collection_enabled=excluded.collection_enabled,
  stripe_enabled=excluded.stripe_enabled,
  venmo_enabled=excluded.venmo_enabled,
  venmo_business_target=excluded.venmo_business_target;
insert into public.payment_requests(
  payment_request_id,project_id,request_kind,status,token_digest,
  principal_amount,deposit_amount,final_amount,cash_instructions,
  check_instructions
) values(
  '33000000-0000-4000-8000-000000000002',
  '33000000-0000-4000-8000-000000000001',
  'consolidated','active','project-direct-venmo-token-digest',
  100,30,70,'Coordinate cash','Mail a check'
);

set local role service_role;
set local request.jwt.claims='{"role":"service_role"}';

select lives_ok(
  $$select public.record_payment_intention(
    'project-direct-venmo-token-digest','venmo_business_profile','venmo-command'
  )$$,
  'configured direct Venmo creates a pending manual intention'
);
reset role;
select is(
  (
    select instruction_snapshot
    from public.payment_intentions
    where payment_request_id='33000000-0000-4000-8000-000000000002'
  ),
  'https://venmo.com/u/black-begonia',
  'direct Venmo target is snapshotted for reconciliation'
);
select is(
  (
    select pause_ends_at-pause_started_at
    from public.payment_intentions
    where payment_request_id='33000000-0000-4000-8000-000000000002'
  ),
  interval '7 days',
  'project direct Venmo retains the configured reminder pause deadline'
);
set local role service_role;
set local request.jwt.claims='{"role":"service_role"}';
select throws_ok(
  $$select public.reserve_payment_checkout(
    'project-direct-venmo-token-digest','paypal_venmo','paypal-command'
  )$$,
  'P0001',
  'Unsupported checkout method',
  'PayPal-backed Venmo cannot create a new checkout attempt'
);

reset role;
select * from finish();
rollback;
