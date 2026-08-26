begin;
select no_plan();

select ok(to_regclass('public.workshop_analytics_outcome_grants') is not null,'analytics outcome grants exist');
select ok(to_regclass('public.workshop_personal_data_requests') is not null,'personal-data requests exist');
select ok(to_regclass('public.workshop_data_retention_policies') is not null,'retention policies exist');
select col_not_null('public','workshop_analytics_outcome_grants','grant_digest','analytics grant stores only digest');
select ok(not exists(select 1 from information_schema.columns where table_schema='public' and table_name='workshop_analytics_outcome_grants' and column_name in ('token','raw_token','contact_email')),'analytics grants expose no raw token or email');
select col_not_null('public','workshop_personal_data_requests','verification_method','privacy request records verification boundary');
select has_index('public','workshop_data_retention_policies','uq_workshop_retention_active','only one policy may be active');
select has_index('public','workshop_analytics_outcome_grants','uq_workshop_analytics_confirmation_booking','one confirmation grant may be issued per booking');
select has_function(
  'public','manage_workshop_analytics_outcome',array['text','jsonb'],
  'analytics outcome command exists'
);
select ok(
  not has_function_privilege(
    'authenticated','public.manage_workshop_analytics_outcome(text,jsonb)',
    'EXECUTE'
  ),
  'browser callers cannot invoke the digest command directly'
);
select has_trigger('public','workshop_data_retention_policies','trg_workshop_retention_policy_immutability','active and retired policy content is protected');
select ok(
  pg_get_functiondef('public.enforce_workshop_retention_policy_immutability()'::regprocedure)
    ~ 'old\.state\s*=\s*''active''',
  'active policy has controlled retirement'
);
select ok(
  pg_get_functiondef('public.enforce_workshop_retention_policy_immutability()'::regprocedure)
    like '%new.state is distinct from ''retired''%',
  'only active to retired transition is allowed'
);
select ok(
  pg_get_functiondef('public.enforce_workshop_retention_policy_immutability()'::regprocedure)
    ~ 'old\.state\s*=\s*''retired''',
  'retired policy rows are immutable'
);
select ok(
  pg_get_functiondef('public.is_workshop_privacy_admin()'::regprocedure)
    ~ 'ur\.role\s*=\s*''admin''',
  'policy administration maps to existing admin role'
);
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='workshop_data_retention_policies' and policyname='workshop_retention_admin_update' and with_check like '%is_workshop_privacy_admin%'),'admin-only policy mutation is enforced');
select ok((select relrowsecurity from pg_class where oid='public.workshop_personal_data_requests'::regclass),'privacy requests enforce RLS');
select ok(not has_table_privilege('anon','public.workshop_personal_data_requests','SELECT'),'anonymous users cannot read privacy requests');

select has_function(
  'public','manage_workshop_data_retention_policy',array['text','jsonb','uuid'],
  'retention policy lifecycle command exists'
);
select ok(
  to_regclass('public.workshop_privacy_commands') is not null,
  'privacy command replay ledger exists'
);

insert into public.profiles(id,is_active) values
  ('42000000-0000-4000-8000-000000000001',true),
  ('42000000-0000-4000-8000-000000000002',true),
  ('42000000-0000-4000-8000-000000000003',false)
on conflict(id) do update set is_active=excluded.is_active;
insert into public.user_roles(user_id,role) values
  ('42000000-0000-4000-8000-000000000001','admin'),
  ('42000000-0000-4000-8000-000000000002','staff'),
  ('42000000-0000-4000-8000-000000000003','admin')
on conflict(user_id,role) do nothing;

set local role authenticated;
set local request.jwt.claims=
  '{"sub":"42000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$select public.manage_workshop_data_retention_policy(
    'create_draft',
    '{"policyVersion":"2026-01","fieldRules":[{"fieldCategory":"contact_email",
      "permittedActions":["correct","minimize"],"minimumAgeDays":0,"prerequisites":[]}],
      "operationalRetentionDays":365,"communicationRetentionDays":90,
      "financialRetentionDays":2555,"disputeRetentionDays":2555,
      "auditRetentionDays":2555}',
    '42000000-0000-4000-8000-000000000010'
  )$$,
  'active admin can create a retention-policy draft'
);
select lives_ok(
  $$select public.manage_workshop_data_retention_policy(
    'approve',
    jsonb_build_object('policyId',(select workshop_data_retention_policy_id
      from public.workshop_data_retention_policies where policy_version='2026-01')),
    '42000000-0000-4000-8000-000000000011'
  )$$,
  'active admin can approve a draft'
);
select throws_ok(
  $$update public.workshop_data_retention_policies
    set operational_retention_days=30 where policy_version='2026-01'$$,
  '55000',
  'Approved workshop retention policy content is immutable; only controlled activation is allowed.',
  'approved policy content cannot be edited'
);

set local request.jwt.claims=
  '{"sub":"42000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$select public.manage_workshop_data_retention_policy(
    'activate',
    jsonb_build_object('policyId',(select workshop_data_retention_policy_id
      from public.workshop_data_retention_policies where policy_version='2026-01'),
      'confirmed',true),
    '42000000-0000-4000-8000-000000000012'
  )$$,
  '42501','not authorized','active staff cannot administer privacy policy'
);

set local request.jwt.claims=
  '{"sub":"42000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok(
  $$select public.manage_workshop_data_retention_policy(
    'activate',
    jsonb_build_object('policyId',(select workshop_data_retention_policy_id
      from public.workshop_data_retention_policies where policy_version='2026-01'),
      'confirmed',true),
    '42000000-0000-4000-8000-000000000014'
  )$$,
  '42501','not authorized','inactive admin cannot administer privacy policy'
);

set local request.jwt.claims=
  '{"sub":"42000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$select public.manage_workshop_data_retention_policy(
    'activate',
    jsonb_build_object('policyId',(select workshop_data_retention_policy_id
      from public.workshop_data_retention_policies where policy_version='2026-01'),
      'confirmed',true),
    '42000000-0000-4000-8000-000000000012'
  )$$,
  'active admin can activate the approved policy'
);
select is(
  (select state from public.workshop_data_retention_policies where policy_version='2026-01'),
  'active','approved policy transitions to active'
);
select throws_ok(
  $$update public.workshop_data_retention_policies
    set field_rules='[]'::jsonb where policy_version='2026-01'$$,
  '55000',
  'Active workshop retention policy content is immutable; only controlled retirement is allowed.',
  'active policy content cannot be edited'
);
select lives_ok(
  $$select public.manage_workshop_data_retention_policy(
    'retire',
    jsonb_build_object('policyId',(select workshop_data_retention_policy_id
      from public.workshop_data_retention_policies where policy_version='2026-01')),
    '42000000-0000-4000-8000-000000000013'
  )$$,
  'active policy supports the controlled retirement transition'
);
select is(
  (public.manage_workshop_data_retention_policy(
    'retire','{}','42000000-0000-4000-8000-000000000013'
  )->>'replayed')::boolean,
  true,'privacy policy commands replay without a second transition'
);
select throws_ok(
  $$update public.workshop_data_retention_policies
    set audit_retention_days=1 where policy_version='2026-01'$$,
  '55000','Retired workshop retention policies are immutable.',
  'retired policy remains immutable'
);

reset role;
insert into public.workshop_definitions(
  workshop_definition_id,title,theme,advertising_line,description,
  included_materials,default_terms,default_terms_version
) values(
  '42000000-0000-4000-8000-000000000100','Privacy Workshop','seasonal',
  'Privacy test','Privacy operations','Materials','Terms',1
);
insert into public.workshop_occurrences(
  workshop_occurrence_id,workshop_definition_id,slug,status,title_snapshot,
  advertising_line_snapshot,description_snapshot,included_materials_snapshot,
  terms_snapshot,terms_version,venue_name,address_line_1,locality,region,
  postal_code,timezone,local_start,local_end,utc_offset_minutes,start_at,end_at,
  registration_opens_at,registration_closes_at,capacity,per_booking_limit,
  price_minor,currency,completed_at
) values(
  '42000000-0000-4000-8000-000000000101',
  '42000000-0000-4000-8000-000000000100','privacy-workshop-test','completed',
  'Privacy Workshop','Privacy test','Privacy operations','Materials','Terms',1,
  'Studio','1 Main St','Richmond','VA','23220','UTC',
  (now()-interval '10 days 2 hours')::timestamp,
  (now()-interval '10 days')::timestamp,0,
  now()-interval '10 days 2 hours',now()-interval '10 days',
  now()-interval '30 days',now()-interval '11 days',8,4,5000,'USD',
  now()-interval '10 days'
);
insert into public.workshop_bookings(
  workshop_booking_id,workshop_occurrence_id,booking_reference,status_token_digest,
  status_token_expires_at,contact_name,contact_email,contact_phone,
  purchased_quantity,active_quantity,status,payment_state,
  price_per_seat_minor_snapshot,subtotal_minor_snapshot,total_minor_snapshot,
  required_charges_minor_snapshot,currency,terms_snapshot,terms_version,confirmed_at
) values(
  '42000000-0000-4000-8000-000000000110',
  '42000000-0000-4000-8000-000000000101','BBW-PRIVACY-ONE',
  'privacy-status-token-digest-abcdefghijklmnopqrstuvwxyz0123456789',
  now()+interval '5 days','Privacy Guest','privacy@example.test','555-0100',
  1,1,'confirmed','paid',5000,5000,5000,0,'USD','Terms',1,now()-interval '20 days'
),(
  '42000000-0000-4000-8000-000000000120',
  '42000000-0000-4000-8000-000000000101','BBW-PRIVACY-TWO',
  'privacy-second-status-digest-abcdefghijklmnopqrstuvwxyz0123456789',
  now()+interval '5 days','Correction Guest','current@example.test','555-0200',
  1,1,'confirmed','paid',5000,5000,5000,0,'USD','Terms',1,now()-interval '20 days'
);
insert into public.workshop_attendees(
  workshop_attendee_id,workshop_booking_id,seat_number,display_name,accommodation_details
) values(
  '42000000-0000-4000-8000-000000000111',
  '42000000-0000-4000-8000-000000000110',1,'Private Attendee','Sensitive accommodation'
);
insert into public.workshop_payment_transactions(
  workshop_payment_transaction_id,workshop_booking_id,workshop_occurrence_id,
  transaction_type,provider,payment_reference,amount_minor,currency,occurred_at,state
) values(
  '42000000-0000-4000-8000-000000000112',
  '42000000-0000-4000-8000-000000000110',
  '42000000-0000-4000-8000-000000000101','charge','manual',
  'PRIVACY-FINANCIAL-FACT',5000,'USD',now()-interval '20 days','paid'
);

select is(
  (public.manage_workshop_analytics_outcome(
    'register_confirmation',
    jsonb_build_object(
      'statusTokenDigest',
        'privacy-status-token-digest-abcdefghijklmnopqrstuvwxyz0123456789',
      'grantDigest',repeat('a',64)
    )
  )->>'state'),
  'issued','first trusted confirmed-status resolution registers one digest'
);
select is(
  (public.manage_workshop_analytics_outcome(
    'register_confirmation',
    jsonb_build_object(
      'statusTokenDigest',
        'privacy-status-token-digest-abcdefghijklmnopqrstuvwxyz0123456789',
      'grantDigest',repeat('b',64)
    )
  )->>'state'),
  'unavailable','later confirmed-status resolutions cannot reissue a raw grant'
);
select is(
  (select count(*)::integer from public.workshop_analytics_outcome_grants
    where workshop_booking_id='42000000-0000-4000-8000-000000000110'
      and outcome_type='booking_confirmed'),
  1,'confirmation outcome eligibility is durable and at most one'
);
select is(
  (public.manage_workshop_analytics_outcome(
    'redeem',jsonb_build_object('grantDigest',repeat('a',64))
  )->'outcome'->>'publicContentId'),
  'privacy-workshop-test','redemption returns only a public content identifier'
);
select is(
  (public.manage_workshop_analytics_outcome(
    'redeem',jsonb_build_object('grantDigest',repeat('a',64))
  )->>'state'),
  'unavailable','consumed grants cannot replay'
);
select is(
  (public.manage_workshop_analytics_outcome(
    'register_confirmation',
    jsonb_build_object(
      'statusTokenDigest',
        'privacy-second-status-digest-abcdefghijklmnopqrstuvwxyz0123456789',
      'grantDigest',repeat('c',64)
    )
  )->>'state'),
  'issued','a separate confirmed booking receives its own eligibility'
);
select is(
  (public.manage_workshop_analytics_outcome(
    'discard',jsonb_build_object('grantDigest',repeat('c',64))
  )->>'state'),
  'discarded','blocked analytics can durably discard the pending outcome'
);
select is(
  (public.manage_workshop_analytics_outcome(
    'redeem',jsonb_build_object('grantDigest',repeat('c',64))
  )->>'state'),
  'unavailable','discarded outcomes never replay after permission changes'
);
insert into public.workshop_analytics_outcome_grants(
  workshop_booking_id,grant_digest,outcome_type,expires_at
) values(
  '42000000-0000-4000-8000-000000000110',repeat('d',64),
  'waitlist_joined',now()-interval '1 minute'
);
select is(
  (public.manage_workshop_analytics_outcome('expire','{}')->>'count')::integer,
  1,'expired unresolved grants are terminally discarded'
);
select ok(
  (select discarded_at is not null
    from public.workshop_analytics_outcome_grants
    where grant_digest=repeat('d',64)),
  'expiry does not leave a replayable digest'
);

set local role authenticated;
set local request.jwt.claims=
  '{"sub":"42000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$select public.manage_workshop_personal_data(
    'create_request',
    '{"bookingReference":"BBW-PRIVACY-ONE","requestType":"minimization",
      "fieldCategories":["contact_email","contact_phone","accommodation_details"],
      "bookingStatusDigest":"privacy-status-token-digest-abcdefghijklmnopqrstuvwxyz0123456789"}',
    '42000000-0000-4000-8000-000000000130'
  )$$,
  'valid booking-status digest directly verifies a durable minimization request'
);
select is(
  (select state from public.workshop_personal_data_requests
    where workshop_booking_id='42000000-0000-4000-8000-000000000110'),
  'verified','status-token request is verified'
);
select throws_ok(
  $$select public.manage_workshop_personal_data(
    'process_request',
    jsonb_build_object('requestId',(select workshop_personal_data_request_id
      from public.workshop_personal_data_requests
      where workshop_booking_id='42000000-0000-4000-8000-000000000110'),
      'decision','approve'),
    '42000000-0000-4000-8000-000000000131'
  )$$,
  'P0001','no active retention policy',
  'minimization fails safely when no policy is active'
);
select is(
  (select state from public.workshop_personal_data_requests
    where workshop_booking_id='42000000-0000-4000-8000-000000000110'),
  'verified','failed no-policy processing leaves the verified request unchanged'
);

select lives_ok(
  $$select public.manage_workshop_data_retention_policy(
    'create_draft',
    '{"policyVersion":"2026-02","fieldRules":[
      {"fieldCategory":"contact_email","permittedActions":["correct","minimize"],
       "minimumAgeDays":0,"prerequisites":[]},
      {"fieldCategory":"contact_phone","permittedActions":["correct","minimize"],
       "minimumAgeDays":0,"prerequisites":[]},
      {"fieldCategory":"attendee_name","permittedActions":["correct","minimize"],
       "minimumAgeDays":0,"prerequisites":[]},
      {"fieldCategory":"accommodation_details","permittedActions":["correct","minimize"],
       "minimumAgeDays":0,"prerequisites":[]}],
      "operationalRetentionDays":0,"communicationRetentionDays":0,
      "financialRetentionDays":2555,"disputeRetentionDays":2555,
      "auditRetentionDays":2555}',
    '42000000-0000-4000-8000-000000000132'
  )$$,'admin can draft the reviewed minimization policy'
);
select lives_ok(
  $$select public.manage_workshop_data_retention_policy(
    'approve',jsonb_build_object('policyId',(select workshop_data_retention_policy_id
      from public.workshop_data_retention_policies where policy_version='2026-02')),
    '42000000-0000-4000-8000-000000000133'
  )$$,'admin can approve the reviewed minimization policy'
);
select lives_ok(
  $$select public.manage_workshop_data_retention_policy(
    'activate',jsonb_build_object('policyId',(select workshop_data_retention_policy_id
      from public.workshop_data_retention_policies where policy_version='2026-02'),
      'confirmed',true),
    '42000000-0000-4000-8000-000000000134'
  )$$,'explicit confirmation activates the reviewed minimization policy'
);
select lives_ok(
  $$select public.manage_workshop_personal_data(
    'process_request',
    jsonb_build_object('requestId',(select workshop_personal_data_request_id
      from public.workshop_personal_data_requests
      where workshop_booking_id='42000000-0000-4000-8000-000000000110'),
      'decision','approve'),
    '42000000-0000-4000-8000-000000000135'
  )$$,'verified minimization processes eligible fields'
);
select is(
  (select state from public.workshop_personal_data_requests
    where workshop_booking_id='42000000-0000-4000-8000-000000000110'),
  'deferred','contact email is deferred while status recovery remains active'
);
select is(
  (select reason_category from public.workshop_personal_data_requests
    where workshop_booking_id='42000000-0000-4000-8000-000000000110'),
  'active_customer_dependency','deferral exposes only a safe reason category'
);
select ok(
  (select earliest_eligible_at>now() from public.workshop_personal_data_requests
    where workshop_booking_id='42000000-0000-4000-8000-000000000110'),
  'deferred email has an earliest eligibility time'
);
select is(
  (select contact_phone from public.workshop_bookings
    where workshop_booking_id='42000000-0000-4000-8000-000000000110'),
  null,'independently eligible phone is minimized immediately'
);
select is(
  (select accommodation_details from public.workshop_attendees
    where workshop_booking_id='42000000-0000-4000-8000-000000000110'),
  null,'eligible accommodation details are minimized immediately'
);
select is(
  (select contact_email from public.workshop_bookings
    where workshop_booking_id='42000000-0000-4000-8000-000000000110'),
  'privacy@example.test','current email remains while dependencies are active'
);
select is(
  (select count(*)::integer from public.workshop_communication_suppressions
    where workshop_booking_id='42000000-0000-4000-8000-000000000110'),
  1,'verified minimization creates durable non-required communication suppression'
);
select is(
  (select amount_minor from public.workshop_payment_transactions
    where payment_reference='PRIVACY-FINANCIAL-FACT'),
  5000::bigint,'personal-data minimization preserves immutable financial facts'
);
select ok(
  (select safe_metadata::text not like '%privacy@example.test%'
    and safe_metadata::text not like '%555-0100%'
    and safe_metadata::text not like '%Sensitive accommodation%'
    from public.workshop_audit_events
    where command_key='42000000-0000-4000-8000-000000000135'),
  'privacy audit metadata excludes removed values and sensitive free text'
);
select is(
  (public.manage_workshop_personal_data(
    'process_request','{}','42000000-0000-4000-8000-000000000135'
  )->>'replayed')::boolean,
  true,'personal-data processing is replay safe'
);

reset role;
update public.workshop_bookings set status_token_expires_at=now()-interval '1 minute'
where workshop_booking_id='42000000-0000-4000-8000-000000000110';
set local role authenticated;
set local request.jwt.claims=
  '{"sub":"42000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$select public.manage_workshop_personal_data(
    'process_request',
    jsonb_build_object('requestId',(select workshop_personal_data_request_id
      from public.workshop_personal_data_requests
      where workshop_booking_id='42000000-0000-4000-8000-000000000110'),
      'decision','approve'),
    '42000000-0000-4000-8000-000000000136'
  )$$,'deferred request completes after the customer dependency expires'
);
select is(
  (select contact_email from public.workshop_bookings
    where workshop_booking_id='42000000-0000-4000-8000-000000000110'),
  null,'eligible contact email is minimized'
);
select is(
  (select state from public.workshop_personal_data_requests
    where workshop_booking_id='42000000-0000-4000-8000-000000000110'),
  'completed','fully eligible minimization completes'
);

select lives_ok(
  $$select public.manage_workshop_personal_data(
    'create_request',
    '{"bookingReference":"BBW-PRIVACY-TWO","requestType":"correction",
      "fieldCategories":["contact_email"],
      "protectedCorrections":{"contact_email":"replacement@example.test"},
      "bookingStatusDigest":"not-valid",
      "verificationTokenDigest":"privacy-email-link-digest-abcdefghijklmnopqrstuvwxyz0123456789"}',
    '42000000-0000-4000-8000-000000000140'
  )$$,'unverified correction creates a current-address verification case'
);
select is(
  (select count(*)::integer from public.workshop_personal_data_requests
    where workshop_booking_id='42000000-0000-4000-8000-000000000120'),
  0,'CRM cannot read a request before customer verification'
);
reset role;
select is(
  (select state from public.workshop_personal_data_requests
    where workshop_booking_id='42000000-0000-4000-8000-000000000120'),
  'pending_verification','supplied identity facts alone do not verify authority'
);
select ok(
  (select verification_expires_at<=created_at+interval '24 hours'
    from public.workshop_personal_data_requests
    where workshop_booking_id='42000000-0000-4000-8000-000000000120'),
  'current-address verification expires within 24 hours'
);
set local role authenticated;
set local request.jwt.claims=
  '{"sub":"42000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$select public.manage_workshop_personal_data(
    'verify_request',
    '{"verificationTokenDigest":"privacy-email-link-digest-abcdefghijklmnopqrstuvwxyz0123456789"}',
    '42000000-0000-4000-8000-000000000141'
  )$$,'single-use current-address link verifies the correction'
);
select is(
  (public.manage_workshop_personal_data(
    'verify_request',
    '{"verificationTokenDigest":"privacy-email-link-digest-abcdefghijklmnopqrstuvwxyz0123456789"}',
    '42000000-0000-4000-8000-000000000142'
  )->>'state'),
  'unavailable','consumed current-address verification cannot replay'
);
select lives_ok(
  $$select public.manage_workshop_personal_data(
    'process_request',
    jsonb_build_object('requestId',(select workshop_personal_data_request_id
      from public.workshop_personal_data_requests
      where workshop_booking_id='42000000-0000-4000-8000-000000000120'),
      'decision','approve',
      'replacementEmailTokenDigest',
      'replacement-email-digest-abcdefghijklmnopqrstuvwxyz0123456789'),
    '42000000-0000-4000-8000-000000000143'
  )$$,'verified correction starts proposed-email confirmation'
);
select is(
  (select contact_email from public.workshop_bookings
    where workshop_booking_id='42000000-0000-4000-8000-000000000120'),
  'current@example.test','current email remains active before replacement confirmation'
);
select ok(
  (select replacement_email_expires_at<=processed_at+interval '24 hours'
    from public.workshop_personal_data_requests
    where workshop_booking_id='42000000-0000-4000-8000-000000000120'),
  'proposed-email confirmation expires within 24 hours'
);
select lives_ok(
  $$select public.manage_workshop_personal_data(
    'confirm_replacement_email',
    '{"replacementEmailTokenDigest":"replacement-email-digest-abcdefghijklmnopqrstuvwxyz0123456789",
      "newStatusTokenDigest":"rotated-status-token-digest-abcdefghijklmnopqrstuvwxyz0123456789"}',
    '42000000-0000-4000-8000-000000000144'
  )$$,'proposed address activates only after its one-time confirmation'
);
select is(
  (select contact_email from public.workshop_bookings
    where workshop_booking_id='42000000-0000-4000-8000-000000000120'),
  'replacement@example.test','confirmed replacement becomes the active address'
);
select isnt(
  (select status_token_digest from public.workshop_bookings
    where workshop_booking_id='42000000-0000-4000-8000-000000000120'),
  'privacy-second-status-digest-abcdefghijklmnopqrstuvwxyz0123456789',
  'replacement activation invalidates prior status access'
);
select ok(
  (select safe_metadata::text not like '%current@example.test%'
    and safe_metadata::text not like '%replacement@example.test%'
    from public.workshop_audit_events
    where command_key='42000000-0000-4000-8000-000000000143'),
  'replacement values stay out of audit metadata'
);
select is(
  (public.manage_workshop_personal_data(
    'create_request',
    '{"bookingReference":"BBW-NOT-REAL","requestType":"correction",
      "fieldCategories":["contact_phone"],
      "verificationTokenDigest":"unknown-booking-token-digest-abcdefghijklmnopqrstuvwxyz0123456789"}',
    '42000000-0000-4000-8000-000000000145'
  )->>'state'),
  'accepted','nonmatching request receives the same generic accepted state'
);
select throws_ok(
  $$select public.manage_workshop_data_retention_policy(
    'create_draft',
    '{"policyVersion":"invalid-policy","fieldRules":[
      {"fieldCategory":"contact_email","permittedActions":["erase"],
       "minimumAgeDays":0,"prerequisites":[]}],
      "operationalRetentionDays":0,"communicationRetentionDays":0,
      "financialRetentionDays":0,"disputeRetentionDays":0,"auditRetentionDays":0}',
    '42000000-0000-4000-8000-000000000146'
  )$$,
  '22023','invalid policy','policy field rules use an allowlisted schema'
);
select lives_ok(
  $$select public.manage_workshop_data_retention_policy(
    'create_draft',
    '{"policyVersion":"2026-03","fieldRules":[
      {"fieldCategory":"contact_email","permittedActions":["correct","minimize"],
       "minimumAgeDays":0,"prerequisites":[]},
      {"fieldCategory":"contact_phone","permittedActions":["correct","minimize"],
       "minimumAgeDays":0,"prerequisites":[]}],
      "operationalRetentionDays":0,"communicationRetentionDays":0,
      "financialRetentionDays":2555,"disputeRetentionDays":2555,
      "auditRetentionDays":2555}',
    '42000000-0000-4000-8000-000000000147'
  )$$,'admin can create a successor policy version'
);
select lives_ok(
  $$select public.manage_workshop_data_retention_policy(
    'approve',jsonb_build_object('policyId',(select workshop_data_retention_policy_id
      from public.workshop_data_retention_policies where policy_version='2026-03')),
    '42000000-0000-4000-8000-000000000148'
  )$$,'admin can approve a successor policy version'
);
select throws_ok(
  $$select public.manage_workshop_data_retention_policy(
    'activate',jsonb_build_object('policyId',(select workshop_data_retention_policy_id
      from public.workshop_data_retention_policies where policy_version='2026-03')),
    '42000000-0000-4000-8000-000000000149'
  )$$,
  'P0001','policy cannot be activated',
  'policy activation requires explicit confirmation'
);
select lives_ok(
  $$select public.manage_workshop_data_retention_policy(
    'activate',jsonb_build_object('policyId',(select workshop_data_retention_policy_id
      from public.workshop_data_retention_policies where policy_version='2026-03'),
      'confirmed',true),
    '42000000-0000-4000-8000-000000000150'
  )$$,'confirmed successor activation atomically changes policy versions'
);
select is(
  (select state from public.workshop_data_retention_policies where policy_version='2026-02'),
  'retired','successor activation atomically retires the prior active version'
);
select is(
  (select state from public.workshop_data_retention_policies where policy_version='2026-03'),
  'active','successor becomes the sole active policy'
);
select throws_ok(
  $$select public.manage_workshop_data_retention_policy(
    'retire','{}','42000000-0000-4000-8000-000000000145'
  )$$,
  '22023','command key collision',
  'cross-purpose privacy command-key collisions are rejected'
);

reset role;
select * from finish();
rollback;
