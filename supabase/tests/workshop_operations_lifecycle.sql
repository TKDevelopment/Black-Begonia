begin;
select no_plan();

select ok(to_regclass('public.workshop_reschedule_responses') is not null,'reschedule responses exist');
select ok(to_regclass('public.workshop_waitlist_entries') is not null,'waitlist entries exist');
select ok(to_regclass('public.workshop_waitlist_offers') is not null,'waitlist offers exist');
select ok(to_regclass('public.workshop_communications') is not null,'communication history exists');
select has_index('public','workshop_reschedule_responses','uq_workshop_reschedule_pending_booking','one pending transfer response per booking');
select has_index('public','workshop_waitlist_entries','idx_workshop_waitlist_queue','waitlist FIFO facts are indexed');
select has_index('public','workshop_waitlist_offers','uq_workshop_waitlist_active_offer','one active offer per entry');
select has_trigger('public','workshop_communications','trg_workshop_communications_immutable','communication history is immutable');
select col_not_null('public','workshop_reschedule_responses','response_token_digest','reschedule access is digest-only');
select col_not_null('public','workshop_waitlist_offers','offer_token_digest','waitlist access is digest-only');
select col_not_null('public','workshop_communications','recipient_digest','communication history stores recipient digest');
select ok((select relrowsecurity from pg_class where oid='public.workshop_waitlist_entries'::regclass),'waitlist customer data enforces RLS');
select ok(not has_table_privilege('anon','public.workshop_waitlist_entries','SELECT'),'anonymous users cannot read waitlist data');

select has_function(
  'public','manage_workshop_roster',array['text','jsonb','uuid'],
  'authoritative roster command exists'
);
select has_function(
  'public','get_minimized_workshop_roster',array['uuid'],
  'minimized roster projection exists'
);

insert into public.profiles(id,is_active)
values('41000000-0000-4000-8000-000000000001',true)
on conflict(id) do update set is_active=true;
insert into public.user_roles(user_id,role)
values('41000000-0000-4000-8000-000000000001','staff')
on conflict(user_id,role) do nothing;
insert into public.workshop_definitions(
  workshop_definition_id,title,theme,advertising_line,description,
  included_materials,default_terms,default_terms_version
) values (
  '41000000-0000-4000-8000-000000000010','Roster Workshop','seasonal',
  'Roster operations','Test workshop','Materials','Terms',1
);
insert into public.workshop_occurrences(
  workshop_occurrence_id,workshop_definition_id,slug,status,title_snapshot,
  advertising_line_snapshot,description_snapshot,included_materials_snapshot,
  terms_snapshot,terms_version,venue_name,address_line_1,locality,region,
  postal_code,timezone,local_start,local_end,utc_offset_minutes,start_at,end_at,
  registration_opens_at,registration_closes_at,capacity,per_booking_limit,
  price_minor,currency,waitlist_enabled
) values (
  '41000000-0000-4000-8000-000000000020',
  '41000000-0000-4000-8000-000000000010','roster-workshop-test',
  'published_open','Roster Workshop','Roster operations','Test workshop',
  'Materials','Terms',1,'Studio','1 Main St','Richmond','VA','23220','UTC',
  (now()+interval '10 days')::timestamp,(now()+interval '10 days 2 hours')::timestamp,
  0,now()+interval '10 days',now()+interval '10 days 2 hours',
  now()-interval '1 day',now()+interval '9 days',4,4,5000,'USD',true
);

set local role authenticated;
set local request.jwt.claims=
  '{"sub":"41000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$select public.manage_workshop_roster(
    'create_reservation',
    '{"occurrenceId":"41000000-0000-4000-8000-000000000020","quantity":3,
      "reservationType":"manual","statusTokenDigest":"roster-manual-token-digest-abcdefghijklmnopqrstuvwxyz0123456789",
      "contactName":"Manual Guest","contactEmail":"manual@example.test","reason":"phone booking"}',
    '41000000-0000-4000-8000-000000000030'
  )$$,
  'staff can create a capacity-protected manual reservation'
);
select is(
  (select active_quantity from public.workshop_bookings b
    join public.workshop_booking_adjustments a using(workshop_booking_id)
    where a.command_key='41000000-0000-4000-8000-000000000030'),
  3,'manual reservation has the requested active seats'
);
select is(
  (select communication_type from public.workshop_message_queue q
    join public.workshop_bookings b
      on b.workshop_booking_id=q.workshop_booking_id
    join public.workshop_booking_adjustments a
      on a.workshop_booking_id=b.workshop_booking_id
    where a.command_key='41000000-0000-4000-8000-000000000030'),
  'booking_confirmation','confirmed manual reservation queues its confirmation'
);
select is(
  (select count(*)::integer from public.workshop_attendees a
    join public.workshop_booking_adjustments x using(workshop_booking_id)
    where x.command_key='41000000-0000-4000-8000-000000000030'),
  3,'manual reservation creates one attendee row per seat'
);
select throws_ok(
  $$select public.manage_workshop_roster(
    'create_reservation',
    '{"occurrenceId":"41000000-0000-4000-8000-000000000020","quantity":2,
      "reservationType":"complimentary","statusTokenDigest":"roster-overbook-token-digest-abcdefghijklmnopqrstuvwxyz0123456789",
      "contactName":"Overflow","contactEmail":"overflow@example.test"}',
    '41000000-0000-4000-8000-000000000031'
  )$$,'P0001','insufficient capacity','manual operations cannot overbook'
);
select is(
  (public.manage_workshop_roster(
    'create_reservation','{}',
    '41000000-0000-4000-8000-000000000030'
  )->>'replayed')::boolean,
  true,'manual reservation command replay does not duplicate seats'
);
select lives_ok(
  $$select public.manage_workshop_roster(
    'cancel_seats',
    jsonb_build_object(
      'bookingId',(select workshop_booking_id from public.workshop_booking_adjustments
        where command_key='41000000-0000-4000-8000-000000000030'),
      'quantity',1,'reason','guest count changed'
    ),
    '41000000-0000-4000-8000-000000000032'
  )$$,
  'staff can partially cancel a reservation'
);
select is(
  (select active_quantity from public.workshop_bookings b
    join public.workshop_booking_adjustments a using(workshop_booking_id)
    where a.command_key='41000000-0000-4000-8000-000000000030'),
  2,'partial cancellation releases only the selected quantity'
);
select is(
  (select total_minor_snapshot from public.workshop_bookings b
    join public.workshop_booking_adjustments a using(workshop_booking_id)
    where a.command_key='41000000-0000-4000-8000-000000000030'),
  15000::bigint,'partial cancellation preserves immutable price history'
);
select is(
  (select count(*)::integer from public.workshop_attendees a
    join public.workshop_booking_adjustments x using(workshop_booking_id)
    where x.command_key='41000000-0000-4000-8000-000000000030'
      and a.attendance_state='cancelled'),
  1,'partial cancellation marks only released attendee seats'
);
select lives_ok(
  $$select public.manage_workshop_roster(
    'create_reservation',
    '{"occurrenceId":"41000000-0000-4000-8000-000000000020","quantity":2,
      "reservationType":"complimentary",
      "statusTokenDigest":"roster-complimentary-token-digest-abcdefghijklmnopqrstuvwxyz0123456789",
      "contactName":"Community Guest","contactEmail":"community@example.test",
      "reason":"community partner"}',
    '41000000-0000-4000-8000-000000000034'
  )$$,
  'staff can create a capacity-backed complimentary reservation'
);
select is(
  (select amount_minor_delta from public.workshop_booking_adjustments
    where command_key='41000000-0000-4000-8000-000000000034'),
  -10000::bigint,'complimentary reservation offsets its immutable price snapshot'
);
select lives_ok(
  $$select public.manage_workshop_roster(
    'cancel_seats',
    jsonb_build_object(
      'bookingId',(select workshop_booking_id from public.workshop_booking_adjustments
        where command_key='41000000-0000-4000-8000-000000000034'),
      'quantity',2,'reason','community guest cancelled'
    ),
    '41000000-0000-4000-8000-000000000035'
  )$$,
  'staff can fully cancel a complimentary reservation'
);
select is(
  (select status from public.workshop_bookings b
    join public.workshop_booking_adjustments a using(workshop_booking_id)
    where a.command_key='41000000-0000-4000-8000-000000000034'),
  'cancelled','full cancellation closes the booking'
);
select is(
  (select state from public.workshop_seat_holds h
    join public.workshop_booking_adjustments a
      on a.workshop_booking_id=h.booking_id
    where a.command_key='41000000-0000-4000-8000-000000000034'),
  'cancelled','full cancellation releases the confirmed capacity hold'
);
select lives_ok(
  $$select public.manage_workshop_roster(
    'check_in',
    jsonb_build_object('attendeeId',(
      select a.workshop_attendee_id from public.workshop_attendees a
      join public.workshop_booking_adjustments x using(workshop_booking_id)
      where x.command_key='41000000-0000-4000-8000-000000000030'
        and a.attendance_state='expected' order by seat_number limit 1
    )),
    '41000000-0000-4000-8000-000000000033'
  )$$,
  'staff can check in an active attendee'
);
select is(
  (select count(*)::integer from public.get_minimized_workshop_roster(
    '41000000-0000-4000-8000-000000000020'
  )),
  2,'minimized roster excludes cancelled seats'
);
select ok(
  pg_get_function_result('public.get_minimized_workshop_roster(uuid)'::regprocedure)
    not like '%contact_email%'
  and pg_get_function_result('public.get_minimized_workshop_roster(uuid)'::regprocedure)
    not like '%contact_phone%'
  and pg_get_function_result('public.get_minimized_workshop_roster(uuid)'::regprocedure)
    not like '%accommodation_details%',
  'minimized roster excludes contact and accommodation fields'
);
select has_function(
  'public','manage_workshop_waitlist',array['text','jsonb','uuid'],
  'authoritative FIFO waitlist command exists'
);
select lives_ok(
  $$select public.manage_workshop_waitlist(
    'join',
    '{"occurrenceSlug":"roster-workshop-test","quantity":3,
      "contactName":"First Waiting","contactEmail":"first-waiting@example.test",
      "withdrawalTokenDigest":"waitlist-withdrawal-one-abcdefghijklmnopqrstuvwxyz0123456789"}',
    '41000000-0000-4000-8000-000000000040'
  )$$,'first customer can join the waitlist'
);
select lives_ok(
  $$select public.manage_workshop_waitlist(
    'join',
    '{"occurrenceSlug":"roster-workshop-test","quantity":1,
      "contactName":"Second Waiting","contactEmail":"second-waiting@example.test",
      "withdrawalTokenDigest":"waitlist-withdrawal-two-abcdefghijklmnopqrstuvwxyz0123456789"}',
    '41000000-0000-4000-8000-000000000041'
  )$$,'second customer can join the waitlist'
);
select lives_ok(
  $$select public.manage_workshop_waitlist(
    'join',
    '{"occurrenceSlug":"roster-workshop-test","quantity":1,
      "contactName":"Third Waiting","contactEmail":"third-waiting@example.test",
      "withdrawalTokenDigest":"waitlist-withdrawal-three-abcdefghijklmnopqrstuvwxyz0123456789"}',
    '41000000-0000-4000-8000-000000000042'
  )$$,'third customer can join the waitlist'
);
select lives_ok(
  $$select public.manage_workshop_waitlist(
    'join',
    '{"occurrenceSlug":"roster-workshop-test","quantity":1,
      "contactName":"Fourth Waiting","contactEmail":"fourth-waiting@example.test",
      "withdrawalTokenDigest":"waitlist-withdrawal-four-abcdefghijklmnopqrstuvwxyz0123456789"}',
    '41000000-0000-4000-8000-000000000043'
  )$$,'fourth customer can join the waitlist'
);
select is(
  (public.manage_workshop_waitlist(
    'join','{}','41000000-0000-4000-8000-000000000040'
  )->>'replayed')::boolean,
  true,'waitlist join replay does not duplicate the queue entry'
);
reset role;
update public.workshop_waitlist_entries set created_at=case contact_email
  when 'first-waiting@example.test' then now()-interval '4 minutes'
  when 'second-waiting@example.test' then now()-interval '3 minutes'
  when 'third-waiting@example.test' then now()-interval '2 minutes'
  else now()-interval '1 minute' end
where workshop_occurrence_id='41000000-0000-4000-8000-000000000020';
set local role authenticated;
set local request.jwt.claims=
  '{"sub":"41000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$select public.manage_workshop_waitlist(
    'offer_next',
    '{"occurrenceId":"41000000-0000-4000-8000-000000000020",
      "durationMinutes":59,
      "offerTokenDigest":"waitlist-invalid-duration-abcdefghijklmnopqrstuvwxyz0123456789"}',
    '41000000-0000-4000-8000-000000000044'
  )$$,
  '22023','invalid offer','waitlist offer duration cannot be less than one hour'
);
select throws_ok(
  $$select public.manage_workshop_waitlist(
    'offer_next',
    '{"occurrenceId":"41000000-0000-4000-8000-000000000020",
      "durationMinutes":4321,
      "offerTokenDigest":"waitlist-invalid-duration-two-abcdefghijklmnopqrstuvwxyz0123456789"}',
    '41000000-0000-4000-8000-000000000045'
  )$$,
  '22023','invalid offer','waitlist offer duration cannot exceed 72 hours'
);
select lives_ok(
  $$select public.manage_workshop_waitlist(
    'offer_next',
    '{"occurrenceId":"41000000-0000-4000-8000-000000000020",
      "offerTokenDigest":"waitlist-offer-one-digest-abcdefghijklmnopqrstuvwxyz0123456789"}',
    '41000000-0000-4000-8000-000000000046'
  )$$,'default-duration offer selects the FIFO customer'
);
select is(
  (select e.contact_email from public.workshop_waitlist_offers o
    join public.workshop_waitlist_entries e using(workshop_waitlist_entry_id)
    where o.command_key='41000000-0000-4000-8000-000000000046'),
  'first-waiting@example.test','oldest waiting customer is offered first'
);
select is(
  (select quantity from public.workshop_waitlist_offers
    where command_key='41000000-0000-4000-8000-000000000046'),
  2,'offer reduces quantity to currently available capacity'
);
select ok(
  (select expires_at between created_at+interval '23 hours 59 minutes'
      and created_at+interval '24 hours 1 minute'
    from public.workshop_waitlist_offers
    where command_key='41000000-0000-4000-8000-000000000046'),
  'default waitlist offer duration is 24 hours'
);
select ok(
  (select o.expires_at<=least(w.registration_closes_at,w.start_at)
    from public.workshop_waitlist_offers o
    join public.workshop_occurrences w using(workshop_occurrence_id)
    where o.command_key='41000000-0000-4000-8000-000000000046'),
  'offer deadline is capped by registration close and workshop start'
);
select is(
  (public.manage_workshop_waitlist(
    'offer_next',
    '{"occurrenceId":"41000000-0000-4000-8000-000000000020",
      "offerTokenDigest":"waitlist-no-capacity-digest-abcdefghijklmnopqrstuvwxyz0123456789"}',
    '41000000-0000-4000-8000-000000000047'
  )->>'state'),
  'no_capacity','active offer hold protects capacity from another offer'
);
select lives_ok(
  $$select public.manage_workshop_waitlist(
    'decline_offer',
    '{"offerTokenDigest":"waitlist-offer-one-digest-abcdefghijklmnopqrstuvwxyz0123456789"}',
    '41000000-0000-4000-8000-000000000048'
  )$$,'declining an offer releases its protected capacity'
);
select is(
  (public.manage_workshop_waitlist(
    'decline_offer','{}','41000000-0000-4000-8000-000000000048'
  )->>'replayed')::boolean,
  true,'offer decline replay does not release capacity twice'
);
select lives_ok(
  $$select public.manage_workshop_waitlist(
    'offer_next',
    '{"occurrenceId":"41000000-0000-4000-8000-000000000020",
      "durationMinutes":60,
      "offerTokenDigest":"waitlist-offer-two-digest-abcdefghijklmnopqrstuvwxyz0123456789"}',
    '41000000-0000-4000-8000-000000000049'
  )$$,'decline advances the queue to the next waiting customer'
);
select is(
  (select e.contact_email from public.workshop_waitlist_offers o
    join public.workshop_waitlist_entries e using(workshop_waitlist_entry_id)
    where o.command_key='41000000-0000-4000-8000-000000000049'),
  'second-waiting@example.test','queue advances exactly to the second customer'
);
select lives_ok(
  $$select public.manage_workshop_waitlist(
    'accept_offer',
    '{"offerTokenDigest":"waitlist-offer-two-digest-abcdefghijklmnopqrstuvwxyz0123456789",
      "termsVersion":1,
      "statusTokenDigest":"waitlist-booking-status-digest-abcdefghijklmnopqrstuvwxyz0123456789"}',
    '41000000-0000-4000-8000-000000000050'
  )$$,'timely offer acceptance creates a pending booking atomically'
);
select is(
  (select purchased_quantity from public.workshop_bookings b
    join public.workshop_seat_holds h on h.booking_id=b.workshop_booking_id
    join public.workshop_waitlist_offers o
      on o.workshop_seat_hold_id=h.workshop_seat_hold_id
    where o.command_key='41000000-0000-4000-8000-000000000049'),
  1,'accepted offer preserves its protected quantity'
);
select lives_ok(
  $$select public.manage_workshop_waitlist(
    'offer_next',
    '{"occurrenceId":"41000000-0000-4000-8000-000000000020",
      "durationMinutes":60,
      "offerTokenDigest":"waitlist-offer-three-digest-abcdefghijklmnopqrstuvwxyz0123456789"}',
    '41000000-0000-4000-8000-000000000051'
  )$$,'remaining seat advances to the third customer'
);
reset role;
update public.workshop_waitlist_offers set expires_at=now()
where command_key='41000000-0000-4000-8000-000000000051';
update public.workshop_seat_holds set effective_expires_at=now()
where command_key='41000000-0000-4000-8000-000000000051';
set local role authenticated;
set local request.jwt.claims=
  '{"sub":"41000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(
  (public.manage_workshop_waitlist(
    'accept_offer',
    '{"offerTokenDigest":"waitlist-offer-three-digest-abcdefghijklmnopqrstuvwxyz0123456789",
      "termsVersion":1,
      "statusTokenDigest":"late-waitlist-status-digest-abcdefghijklmnopqrstuvwxyz0123456789"}',
    '41000000-0000-4000-8000-000000000052'
  )->>'state'),
  'expired','acceptance at the exact deadline is rejected without capacity effect'
);
select lives_ok(
  $$select public.manage_workshop_waitlist(
    'offer_next',
    '{"occurrenceId":"41000000-0000-4000-8000-000000000020",
      "durationMinutes":60,
      "offerTokenDigest":"waitlist-offer-four-digest-abcdefghijklmnopqrstuvwxyz0123456789"}',
    '41000000-0000-4000-8000-000000000053'
  )$$,'late acceptance advances capacity to the next waiting customer'
);
select is(
  (select e.contact_email from public.workshop_waitlist_offers o
    join public.workshop_waitlist_entries e using(workshop_waitlist_entry_id)
    where o.command_key='41000000-0000-4000-8000-000000000053'),
  'fourth-waiting@example.test','late offer advances exactly once to fourth customer'
);
select has_function(
  'public','queue_workshop_communication',
  array['text','text','text','uuid','uuid','uuid','text','boolean',
    'timestamp with time zone','uuid'],
  'durable communication queue command exists'
);
select has_function(
  'public','claim_workshop_communications',array['text','integer'],
  'skip-locked communication claim command exists'
);
select has_function(
  'public','record_workshop_communication_outcome',
  array['uuid','text','text','text','text','text','text',
    'timestamp with time zone','uuid'],
  'communication outcome command exists'
);
select ok(
  pg_get_functiondef('public.claim_workshop_communications(text,integer)'::regprocedure)
    ~* 'skip locked',
  'communication claiming uses skip-locked concurrency'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.claim_workshop_communications(text,integer)',
    'EXECUTE'
  ),
  'service worker can execute the claim command'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.claim_workshop_communications(text,integer)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute the claim command'
);

reset role;
select lives_ok(
  $$select public.queue_workshop_communication(
    'booking_confirmation','booking_contact','v1',
    (select workshop_booking_id from public.workshop_booking_adjustments
      where command_key='41000000-0000-4000-8000-000000000030'),
    null,null,null,true,null,'41000000-0000-4000-8000-000000000060'
  )$$,'confirmation is queued durably'
);
select is(
  (public.queue_workshop_communication(
    'booking_confirmation','booking_contact','v1',
    (select workshop_booking_id from public.workshop_booking_adjustments
      where command_key='41000000-0000-4000-8000-000000000030'),
    null,null,null,true,null,'41000000-0000-4000-8000-000000000060'
  )->>'replayed')::boolean,
  true,'communication queue command is idempotent'
);
reset role;
update public.workshop_message_queue set created_at=now()-interval '1 day'
where command_key='41000000-0000-4000-8000-000000000060';
select is(
  (select recipient_email from public.claim_workshop_communications('worker-a',100)
    where queue_id=(select workshop_message_queue_id
      from public.workshop_message_queue
      where command_key='41000000-0000-4000-8000-000000000060')),
  'manual@example.test','claim resolves the recipient only for the service worker'
);
select is(
  (select state from public.workshop_message_queue
    where command_key='41000000-0000-4000-8000-000000000060'),
  'claimed','claimed message is not visible to another queue claim'
);
select lives_ok(
  $$select public.record_workshop_communication_outcome(
    (select workshop_message_queue_id from public.workshop_message_queue
      where command_key='41000000-0000-4000-8000-000000000060'),
    'worker-a','retryable',null,'recipient-digest','payload-digest',
    'provider_timeout',now(),'41000000-0000-4000-8000-000000000061'
  )$$,'retryable provider outcome requeues the message'
);
select is(
  (select state from public.workshop_message_queue
    where command_key='41000000-0000-4000-8000-000000000060'),
  'queued','retryable outcome returns message to queue'
);
select is(
  (select resulting_state from public.workshop_message_outcomes
    where command_key='41000000-0000-4000-8000-000000000061'),
  'queued','retryable outcome is recorded append-only'
);
select is(
  (select count(*)::integer from public.claim_workshop_communications('worker-b',1)),
  1,'requeued message can be claimed by a later worker'
);
select lives_ok(
  $$select public.record_workshop_communication_outcome(
    (select workshop_message_queue_id from public.workshop_message_queue
      where command_key='41000000-0000-4000-8000-000000000060'),
    'worker-b','accepted','mailgun-message-1','recipient-digest','payload-digest',
    null,null,'41000000-0000-4000-8000-000000000062'
  )$$,'provider acceptance resolves the queue message'
);
select is(
  (select delivery_state from public.workshop_communications
    where command_key='41000000-0000-4000-8000-000000000062'),
  'sent','provider acceptance appends immutable delivery history'
);
select is(
  (public.record_workshop_communication_outcome(
    (select workshop_message_queue_id from public.workshop_message_queue
      where command_key='41000000-0000-4000-8000-000000000060'),
    'worker-b','accepted','mailgun-message-1','recipient-digest','payload-digest',
    null,null,'41000000-0000-4000-8000-000000000062'
  )->>'replayed')::boolean,
  true,'provider outcome replay does not append duplicate history'
);
select lives_ok(
  $$select public.queue_workshop_communication(
    'cancellation_notice','booking_contact','v1',
    (select workshop_booking_id from public.workshop_booking_adjustments
      where command_key='41000000-0000-4000-8000-000000000030'),
    null,null,null,true,null,'41000000-0000-4000-8000-000000000063'
  )$$,'a second required message can be queued'
);
select is(
  (select count(*)::integer from public.claim_workshop_communications('worker-c',100)
    where queue_id=(select workshop_message_queue_id from public.workshop_message_queue
      where command_key='41000000-0000-4000-8000-000000000063')),
  1,'second required message is claimed once'
);
select lives_ok(
  $$select public.record_workshop_communication_outcome(
    (select workshop_message_queue_id from public.workshop_message_queue
      where command_key='41000000-0000-4000-8000-000000000063'),
    'worker-c','permanent',null,'recipient-digest','payload-digest',
    'recipient_suppressed',null,'41000000-0000-4000-8000-000000000064'
  )$$,'permanent provider failure resolves visibly without retry'
);
select is(
  (select state from public.workshop_message_queue
    where command_key='41000000-0000-4000-8000-000000000063'),
  'failed','permanent failure remains visible to CRM operations'
);
select is(
  (select status from public.workshop_bookings b
    join public.workshop_booking_adjustments a using(workshop_booking_id)
    where a.command_key='41000000-0000-4000-8000-000000000030'),
  'checked_in','message retries and failures never change booking truth'
);
select lives_ok(
  $$select public.queue_workshop_communication(
    'refund_notice','booking_contact','v1',
    (select workshop_booking_id from public.workshop_booking_adjustments
      where command_key='41000000-0000-4000-8000-000000000030'),
    null,null,null,true,now()-interval '1 minute',
    '41000000-0000-4000-8000-000000000065'
  )$$,'already-expired message can be recorded for bounded cleanup'
);
select is(
  (select count(*)::integer from public.claim_workshop_communications('worker-d',100)
    where queue_id=(select workshop_message_queue_id from public.workshop_message_queue
      where command_key='41000000-0000-4000-8000-000000000065')),
  0,'expired message is never delivered'
);
select is(
  (select state from public.workshop_message_queue
    where command_key='41000000-0000-4000-8000-000000000065'),
  'suppressed','expired message reaches a terminal suppressed state'
);
reset role;
insert into public.workshop_communication_suppressions(
  workshop_booking_id,reason_category,command_key
) values(
  (select workshop_booking_id from public.workshop_booking_adjustments
    where command_key='41000000-0000-4000-8000-000000000030'),
  'customer_request','41000000-0000-4000-8000-000000000066'
);
select is(
  (public.queue_workshop_communication(
    'refund_notice','booking_contact','v1',
    (select workshop_booking_id from public.workshop_booking_adjustments
      where command_key='41000000-0000-4000-8000-000000000030'),
    null,null,null,false,null,'41000000-0000-4000-8000-000000000067'
  )->>'state'),
  'suppressed','privacy suppression prevents future non-required messages'
);
select has_function(
  'public','queue_workshop_status_recovery',array['text','text','uuid'],
  'status recovery has a standalone durable queue command'
);
select has_function(
  'public','register_workshop_message_token',
  array['uuid','text','text','uuid'],
  'claimed message tokens are registered through a digest-only command'
);
select has_function(
  'public','complete_workshop_message_delivery',
  array['uuid','text','text','text','text','text','uuid'],
  'provider acceptance and token registration share one database transaction'
);
select is(
  (public.queue_workshop_status_recovery(
    'unknown@example.test','BBW-UNKNOWN',
    '41000000-0000-4000-8000-000000000068'
  )->>'matched')::boolean,
  false,'unknown recovery details return the same non-enumerating result'
);
select is(
  (select count(*)::integer from public.workshop_message_queue
    where command_key='41000000-0000-4000-8000-000000000068'),
  0,'an unmatched recovery request creates no durable message'
);
select is(
  (public.queue_workshop_status_recovery(
    'manual@example.test',
    (select booking_reference from public.workshop_bookings b
      join public.workshop_booking_adjustments a using(workshop_booking_id)
      where a.command_key='41000000-0000-4000-8000-000000000030'),
    '41000000-0000-4000-8000-000000000069'
  )->>'matched')::boolean,
  true,'matching recovery details queue a replacement status message'
);
select is(
  (public.queue_workshop_status_recovery(
    'manual@example.test',
    (select booking_reference from public.workshop_bookings b
      join public.workshop_booking_adjustments a using(workshop_booking_id)
      where a.command_key='41000000-0000-4000-8000-000000000030'),
    '41000000-0000-4000-8000-000000000069'
  )->>'replayed')::boolean,
  true,'status recovery queueing is idempotent'
);
select is(
  (select count(*)::integer from public.claim_workshop_communications(
    'worker-recovery',100
  ) where queue_id=(select workshop_message_queue_id
    from public.workshop_message_queue
    where command_key='41000000-0000-4000-8000-000000000069')),
  1,'the recovery message is claimed exactly once'
);
select is(
  (public.register_workshop_message_token(
    (select workshop_message_queue_id from public.workshop_message_queue
      where command_key='41000000-0000-4000-8000-000000000069'),
    'worker-recovery',
    'recovery-token-digest-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
    '41000000-0000-4000-8000-000000000070'
  )->>'purpose'),
  'status_access','the worker registers only the status-access digest'
);
select is(
  (select status_token_digest from public.workshop_bookings b
    join public.workshop_booking_adjustments a using(workshop_booking_id)
    where a.command_key='41000000-0000-4000-8000-000000000030'),
  'recovery-token-digest-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
  'digest registration rotates the authoritative booking status token'
);
select is(
  (public.register_workshop_message_token(
    (select workshop_message_queue_id from public.workshop_message_queue
      where command_key='41000000-0000-4000-8000-000000000069'),
    'worker-recovery',
    'recovery-token-digest-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
    '41000000-0000-4000-8000-000000000070'
  )->>'replayed')::boolean,
  true,'message token registration replays safely'
);
select throws_ok(
  $$select public.register_workshop_message_token(
    (select workshop_message_queue_id from public.workshop_message_queue
      where command_key='41000000-0000-4000-8000-000000000069'),
    'worker-recovery',
    'different-token-digest-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
    '41000000-0000-4000-8000-000000000071'
  )$$,
  'P0001','token already registered',
  'a second command cannot replace the token registered for one delivery'
);
select is(
  (public.complete_workshop_message_delivery(
    (select workshop_message_queue_id from public.workshop_message_queue
      where command_key='41000000-0000-4000-8000-000000000069'),
    'worker-recovery','mailgun-recovery-1','recipient-digest','payload-digest',
    'recovery-token-digest-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
    '41000000-0000-4000-8000-000000000070'
  )->>'state'),
  'sent','accepted recovery atomically records delivery and its token digest'
);
select is(
  (select count(*)::integer from public.workshop_message_outcomes
    where command_key='41000000-0000-4000-8000-000000000070'),
  1,'atomic delivery completion appends one outcome'
);
select has_function(
  'public','manage_workshop_customer_booking',array['text','jsonb','uuid'],
  'customer cancellation has a separate token-scoped command'
);
select is(
  (public.manage_workshop_customer_booking(
    'cancel_seats',
    '{"statusTokenDigest":"forged-status-token-digest-abcdefghijklmnopqrstuvwxyz0123456789",
      "quantity":1}',
    '41000000-0000-4000-8000-000000000072'
  )->>'state'),
  'unavailable','a forged cancellation token reveals no booking state'
);
select is(
  (public.manage_workshop_customer_booking(
    'cancel_seats',
    '{"statusTokenDigest":"waitlist-booking-status-digest-abcdefghijklmnopqrstuvwxyz0123456789",
      "quantity":1}',
    '41000000-0000-4000-8000-000000000073'
  )->>'state'),
  'cancelled','a valid customer token can cancel its remaining seat'
);
select is(
  (public.manage_workshop_customer_booking(
    'cancel_seats',
    '{"statusTokenDigest":"waitlist-booking-status-digest-abcdefghijklmnopqrstuvwxyz0123456789",
      "quantity":1}',
    '41000000-0000-4000-8000-000000000073'
  )->>'replayed')::boolean,
  true,'customer cancellation is replay-safe'
);
select is(
  (select actor_type from public.workshop_booking_adjustments
    where command_key='41000000-0000-4000-8000-000000000073'),
  'customer','customer cancellation records controlled provenance'
);
select is(
  (select h.state from public.workshop_seat_holds h
    join public.workshop_waitlist_offers o
      on o.workshop_seat_hold_id=h.workshop_seat_hold_id
    where o.command_key='41000000-0000-4000-8000-000000000049'),
  'cancelled','full customer cancellation releases protected capacity'
);

select has_function(
  'public','get_workshop_occurrence_operational_state',array['uuid'],
  'lifecycle and derived availability have a read model'
);
select has_function(
  'public','transition_workshop_occurrence',array['uuid','text','uuid'],
  'authoritative occurrence lifecycle command exists'
);
select ok(
  not has_function_privilege(
    'anon','public.transition_workshop_occurrence(uuid,text,uuid)','EXECUTE'
  ),
  'anonymous callers cannot transition workshop lifecycle'
);

reset role;
insert into public.workshop_occurrences(
  workshop_occurrence_id,workshop_definition_id,slug,status,title_snapshot,
  advertising_line_snapshot,description_snapshot,included_materials_snapshot,
  terms_snapshot,terms_version,venue_name,address_line_1,locality,region,
  postal_code,timezone,local_start,local_end,utc_offset_minutes,start_at,end_at,
  registration_opens_at,registration_closes_at,capacity,per_booking_limit,
  price_minor,currency,waitlist_enabled
) values
(
  '41000000-0000-4000-8000-000000000080',
  '41000000-0000-4000-8000-000000000010','lifecycle-future-test',
  'draft','Lifecycle Future','Lifecycle operations','Test workshop',
  'Materials','Terms',1,'Studio','1 Main St','Richmond','VA','23220','UTC',
  (now()+interval '20 days')::timestamp,(now()+interval '20 days 2 hours')::timestamp,
  0,now()+interval '20 days',now()+interval '20 days 2 hours',
  now()-interval '1 day',now()+interval '19 days',10,4,5000,'USD',true
),(
  '41000000-0000-4000-8000-000000000081',
  '41000000-0000-4000-8000-000000000010','lifecycle-past-test',
  'published_open','Lifecycle Past','Completion review','Test workshop',
  'Materials','Terms',1,'Studio','1 Main St','Richmond','VA','23220','UTC',
  (now()-interval '2 days')::timestamp,(now()-interval '2 days'+interval '2 hours')::timestamp,
  0,now()-interval '2 days',now()-interval '2 days'+interval '2 hours',
  now()-interval '20 days',now()-interval '3 days',10,4,5000,'USD',false
),(
  '41000000-0000-4000-8000-000000000082',
  '41000000-0000-4000-8000-000000000010','lifecycle-cancelled-test',
  'cancelled','Lifecycle Cancelled','Archive cancelled','Test workshop',
  'Materials','Terms',1,'Studio','1 Main St','Richmond','VA','23220','UTC',
  (now()-interval '4 days')::timestamp,(now()-interval '4 days'+interval '2 hours')::timestamp,
  0,now()-interval '4 days',now()-interval '4 days'+interval '2 hours',
  now()-interval '20 days',now()-interval '5 days',10,4,5000,'USD',false
);

set local role authenticated;
set local request.jwt.claims=
  '{"sub":"41000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(
  (public.get_workshop_occurrence_operational_state(
    '41000000-0000-4000-8000-000000000080'
  )->>'availability'),
  'closed','draft lifecycle takes precedence over derived seat availability'
);
select is(
  (public.transition_workshop_occurrence(
    '41000000-0000-4000-8000-000000000080','published_open',
    '41000000-0000-4000-8000-000000000083'
  )->>'availability'),
  'available','publishing exposes separately derived availability'
);
select is(
  (public.transition_workshop_occurrence(
    '41000000-0000-4000-8000-000000000080','published_open',
    '41000000-0000-4000-8000-000000000083'
  )->>'replayed')::boolean,
  true,'lifecycle command replay does not add a second transition'
);
select is(
  (public.transition_workshop_occurrence(
    '41000000-0000-4000-8000-000000000080','registration_closed',
    '41000000-0000-4000-8000-000000000084'
  )->>'availability'),
  'closed','manual registration close overrides available capacity'
);
select throws_ok(
  $$select public.transition_workshop_occurrence(
    '41000000-0000-4000-8000-000000000080','published_open',
    '41000000-0000-4000-8000-000000000085'
  )$$,
  'P0001','invalid lifecycle transition',
  'capacity changes cannot silently reopen a manually closed occurrence'
);
select is(
  (public.get_workshop_occurrence_operational_state(
    '41000000-0000-4000-8000-000000000081'
  )->>'completionReviewRequired')::boolean,
  true,'a passed open occurrence is flagged for completion review'
);
select is(
  (public.transition_workshop_occurrence(
    '41000000-0000-4000-8000-000000000081','completed',
    '41000000-0000-4000-8000-000000000086'
  )->>'lifecycle'),
  'completed','staff completion review persists completed lifecycle'
);
select is(
  (public.transition_workshop_occurrence(
    '41000000-0000-4000-8000-000000000081','archived',
    '41000000-0000-4000-8000-000000000087'
  )->>'lifecycle'),
  'archived','completed occurrence may be archived without deleting history'
);
select is(
  (public.transition_workshop_occurrence(
    '41000000-0000-4000-8000-000000000082','archived',
    '41000000-0000-4000-8000-000000000088'
  )->>'lifecycle'),
  'archived','cancelled occurrence may be archived'
);
select is(
  (select count(*)::integer from public.workshop_audit_events
    where event_type='occurrence_lifecycle_transition'
      and command_key between
        '41000000-0000-4000-8000-000000000083'
        and '41000000-0000-4000-8000-000000000088'),
  5,'each successful lifecycle transition appends one audit event'
);
select is(
  (select safe_metadata->>'fromStatus' from public.workshop_audit_events
    where command_key='41000000-0000-4000-8000-000000000084'),
  'published_open','lifecycle audit preserves the previous persisted state'
);

reset role;
create temporary table workshop_transition_matrix(
  occurrence_id uuid primary key,
  source_status text not null,
  target_status text not null,
  expected_allowed boolean not null,
  actual_allowed boolean
) on commit drop;
insert into workshop_transition_matrix(
  occurrence_id,source_status,target_status,expected_allowed
)
select
  gen_random_uuid(),
  source_status,
  target_status,
  (
    (source_status='draft' and target_status='published_open')
    or (
      source_status='published_open'
      and target_status in('registration_closed','completed')
    )
    or (
      source_status='registration_closed' and target_status='completed'
    )
    or (
      source_status in('rescheduled','cancelled','completed')
      and target_status='archived'
    )
  )
from unnest(array[
  'draft','published_open','registration_closed','rescheduled','cancelled',
  'completed','archived'
]) source_status
cross join unnest(array[
  'draft','published_open','registration_closed','rescheduled','cancelled',
  'completed','archived'
]) target_status;
insert into public.workshop_occurrences(
  workshop_occurrence_id,workshop_definition_id,slug,status,title_snapshot,
  advertising_line_snapshot,description_snapshot,included_materials_snapshot,
  terms_snapshot,terms_version,venue_name,address_line_1,locality,region,
  postal_code,timezone,local_start,local_end,utc_offset_minutes,start_at,end_at,
  registration_opens_at,registration_closes_at,capacity,per_booking_limit,
  price_minor,currency,waitlist_enabled
)
select
  occurrence_id,
  '41000000-0000-4000-8000-000000000010',
  'lifecycle-matrix-'||replace(occurrence_id::text,'-',''),
  source_status,
  'Lifecycle Matrix',
  'Exhaustive lifecycle coverage',
  'Test workshop',
  'Materials',
  'Terms',
  1,
  'Studio',
  '1 Main St',
  'Richmond',
  'VA',
  '23220',
  'UTC',
  (now()-interval '2 days')::timestamp,
  (now()-interval '2 days'+interval '2 hours')::timestamp,
  0,
  now()-interval '2 days',
  now()-interval '2 days'+interval '2 hours',
  now()-interval '20 days',
  now()-interval '3 days',
  10,
  4,
  5000,
  'USD',
  false
from workshop_transition_matrix;

grant select,update on workshop_transition_matrix to authenticated;
set local role authenticated;
do $$
declare
  v_case record;
begin
  for v_case in select * from workshop_transition_matrix loop
    begin
      perform public.transition_workshop_occurrence(
        v_case.occurrence_id,v_case.target_status,gen_random_uuid()
      );
      update workshop_transition_matrix
      set actual_allowed=true
      where occurrence_id=v_case.occurrence_id;
    exception when sqlstate 'P0001' then
      update workshop_transition_matrix
      set actual_allowed=false
      where occurrence_id=v_case.occurrence_id;
    end;
  end loop;
end;
$$;
select is(
  (select count(*)::integer from workshop_transition_matrix),
  49,'lifecycle matrix exercises every persisted source/target combination'
);
select is(
  (select count(*)::integer from workshop_transition_matrix
    where actual_allowed is distinct from expected_allowed),
  0,'every allowed and forbidden persisted lifecycle transition is enforced'
);
select is(
  (select count(*)::integer
    from public.workshop_audit_events audit
    join workshop_transition_matrix matrix
      on matrix.occurrence_id=audit.workshop_occurrence_id
    where audit.event_type='occurrence_lifecycle_transition'),
  7,'only successful matrix transitions append lifecycle audit history'
);

select ok(
  to_regclass('public.workshop_checkout_expiration_queue') is not null,
  'provider checkout expiration work has a durable queue'
);
select has_function(
  'public','cancel_workshop_occurrence',array['uuid','text','uuid'],
  'authoritative occurrence cancellation command exists'
);
select ok(
  not has_function_privilege(
    'anon','public.cancel_workshop_occurrence(uuid,text,uuid)','EXECUTE'
  ),
  'anonymous callers cannot cancel an occurrence'
);

reset role;
insert into public.workshop_occurrences(
  workshop_occurrence_id,workshop_definition_id,slug,status,title_snapshot,
  advertising_line_snapshot,description_snapshot,included_materials_snapshot,
  terms_snapshot,terms_version,venue_name,address_line_1,locality,region,
  postal_code,timezone,local_start,local_end,utc_offset_minutes,start_at,end_at,
  registration_opens_at,registration_closes_at,capacity,per_booking_limit,
  price_minor,currency,waitlist_enabled
) values(
  '41000000-0000-4000-8000-000000000090',
  '41000000-0000-4000-8000-000000000010','cancellation-lifecycle-test',
  'published_open','Cancellation Test','Cancellation operations','Test workshop',
  'Materials','Terms',1,'Studio','1 Main St','Richmond','VA','23220','UTC',
  (now()+interval '30 days')::timestamp,(now()+interval '30 days 2 hours')::timestamp,
  0,now()+interval '30 days',now()+interval '30 days 2 hours',
  now()-interval '1 day',now()+interval '29 days',5,4,5000,'USD',true
);
insert into public.workshop_seat_holds(
  workshop_seat_hold_id,workshop_occurrence_id,quantity,state,payment_method,
  normal_expires_at,effective_expires_at,resolved_at,resolution_reason,command_key
) values
(
  '41000000-0000-4000-8000-000000000091',
  '41000000-0000-4000-8000-000000000090',2,'active','stripe',
  now()+interval '30 minutes',now()+interval '30 minutes',null,null,
  '41000000-0000-4000-8000-000000000092'
),(
  '41000000-0000-4000-8000-000000000093',
  '41000000-0000-4000-8000-000000000090',1,'confirmed','stripe',
  now()+interval '30 minutes',now()+interval '30 minutes',
  now()-interval '1 day','trusted_stripe_payment',
  '41000000-0000-4000-8000-000000000094'
);
insert into public.workshop_bookings(
  workshop_booking_id,workshop_occurrence_id,booking_reference,
  status_token_digest,status_token_expires_at,contact_name,contact_email,
  purchased_quantity,active_quantity,status,payment_state,
  price_per_seat_minor_snapshot,subtotal_minor_snapshot,total_minor_snapshot,
  required_charges_minor_snapshot,currency,terms_snapshot,terms_version,
  payment_method,confirmed_at
) values
(
  '41000000-0000-4000-8000-000000000095',
  '41000000-0000-4000-8000-000000000090','BBW-CANCEL-PENDING',
  'cancel-pending-status-digest-abcdefghijklmnopqrstuvwxyz0123456789',
  now()+interval '60 days','Pending Guest','pending-cancel@example.test',
  2,2,'pending_payment','processing',5000,10000,10000,0,'USD','Terms',1,
  'stripe',null
),(
  '41000000-0000-4000-8000-000000000096',
  '41000000-0000-4000-8000-000000000090','BBW-CANCEL-PAID',
  'cancel-paid-status-digest-abcdefghijklmnopqrstuvwxyz0123456789ABC',
  now()+interval '60 days','Paid Guest','paid-cancel@example.test',
  1,1,'confirmed','paid',5000,5000,5000,0,'USD','Terms',1,
  'stripe',now()-interval '1 day'
);
update public.workshop_seat_holds
set booking_id=case workshop_seat_hold_id
  when '41000000-0000-4000-8000-000000000091'
    then '41000000-0000-4000-8000-000000000095'::uuid
  else '41000000-0000-4000-8000-000000000096'::uuid end
where workshop_seat_hold_id in(
  '41000000-0000-4000-8000-000000000091',
  '41000000-0000-4000-8000-000000000093'
);
insert into public.workshop_payment_attempts(
  workshop_payment_attempt_id,workshop_booking_id,workshop_seat_hold_id,
  provider,provider_checkout_id,provider_payment_id,stripe_price_id,
  reconciliation_reference,quantity,state,amount_minor,currency,command_key,
  normal_expires_at,effective_expires_at,resolved_at
) values
(
  '41000000-0000-4000-8000-000000000097',
  '41000000-0000-4000-8000-000000000095',
  '41000000-0000-4000-8000-000000000091','stripe','cs_cancel_processing',
  null,'price_cancel','BBW-CANCEL-PENDING',2,'processing',10000,'USD',
  '41000000-0000-4000-8000-000000000098',
  now()+interval '30 minutes',now()+interval '30 minutes',null
),(
  '41000000-0000-4000-8000-000000000099',
  '41000000-0000-4000-8000-000000000096',
  '41000000-0000-4000-8000-000000000093','stripe','cs_cancel_paid',
  'pi_cancel_paid','price_cancel','BBW-CANCEL-PAID',1,'paid',5000,'USD',
  '42000000-0000-4000-8000-000000000001',
  now()+interval '30 minutes',now()+interval '30 minutes',now()-interval '1 day'
);
insert into public.workshop_payment_transactions(
  workshop_booking_id,workshop_occurrence_id,workshop_payment_attempt_id,
  transaction_type,provider,provider_transaction_id,payment_reference,
  amount_minor,currency,occurred_at,state,command_key
) values(
  '41000000-0000-4000-8000-000000000096',
  '41000000-0000-4000-8000-000000000090',
  '41000000-0000-4000-8000-000000000099','charge','stripe',
  'pi_cancel_paid','STRIPE-CANCEL-PAID',5000,'USD',now()-interval '1 day',
  'paid','42000000-0000-4000-8000-000000000002'
);
insert into public.workshop_waitlist_entries(
  workshop_waitlist_entry_id,workshop_occurrence_id,contact_name,contact_email,
  requested_quantity,state,withdrawal_token_digest,command_key
) values(
  '42000000-0000-4000-8000-000000000003',
  '41000000-0000-4000-8000-000000000090','Waiting Guest',
  'waiting-cancel@example.test',1,'waiting',
  'cancel-waitlist-withdrawal-digest-abcdefghijklmnopqrstuvwxyz0123456789',
  '42000000-0000-4000-8000-000000000004'
);

set local role authenticated;
set local request.jwt.claims=
  '{"sub":"41000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(
  (public.cancel_workshop_occurrence(
    '41000000-0000-4000-8000-000000000090','weather',
    '42000000-0000-4000-8000-000000000005'
  )->>'affectedBookings')::integer,
  2,'cancellation identifies every affected active booking'
);
select is(
  (select status from public.workshop_occurrences
    where workshop_occurrence_id='41000000-0000-4000-8000-000000000090'),
  'cancelled','cancellation closes occurrence lifecycle immediately'
);
select ok(
  (select status_page_expires_at between
      now()+interval '11 months 29 days' and now()+interval '12 months 1 day'
    from public.workshop_occurrences
    where workshop_occurrence_id='41000000-0000-4000-8000-000000000090'),
  'cancelled public status retention is set to twelve months'
);
select is(
  (select count(*)::integer from public.workshop_seat_holds
    where workshop_occurrence_id='41000000-0000-4000-8000-000000000090'
      and state='cancelled'),
  2,'active and confirmed capacity are invalidated atomically'
);
select is(
  (select count(*)::integer from public.workshop_bookings
    where workshop_occurrence_id='41000000-0000-4000-8000-000000000090'
      and status='cancelled' and active_quantity=0),
  2,'affected bookings cannot be confirmed or retain sellable seats'
);
select is(
  (select state from public.workshop_payment_attempts
    where workshop_payment_attempt_id='41000000-0000-4000-8000-000000000097'),
  'cancelled','in-flight payment instructions become unusable locally'
);
select is(
  (select count(*)::integer from public.workshop_checkout_expiration_queue
    where workshop_payment_attempt_id='41000000-0000-4000-8000-000000000097'
      and provider_checkout_id='cs_cancel_processing' and state='queued'),
  1,'Stripe checkout expiration is queued durably'
);
select is(
  (select count(*)::integer from public.workshop_message_queue
    where communication_type='cancellation_notice'
      and workshop_booking_id in(
        '41000000-0000-4000-8000-000000000095',
        '41000000-0000-4000-8000-000000000096'
      )),
  2,'affected customers with an address receive durable cancellation notices'
);
select is(
  (select state from public.workshop_waitlist_entries
    where workshop_waitlist_entry_id='42000000-0000-4000-8000-000000000003'),
  'withdrawn','cancellation closes the occurrence waitlist'
);
select is(
  (select count(*)::integer from public.workshop_payment_exceptions
    where workshop_occurrence_id='41000000-0000-4000-8000-000000000090'
      and exception_type='occurrence_cancellation_refund_review'),
  1,'paid booking is preserved for florist-controlled refund review'
);
select is(
  (select amount_minor from public.workshop_payment_exceptions
    where workshop_occurrence_id='41000000-0000-4000-8000-000000000090'
      and exception_type='occurrence_cancellation_refund_review'),
  5000::bigint,'refund review records the remaining trusted paid amount'
);
select is(
  (select count(*)::integer from public.workshop_payment_transactions
    where workshop_occurrence_id='41000000-0000-4000-8000-000000000090'),
  1,'occurrence cancellation never moves money automatically'
);
select is(
  (public.cancel_workshop_occurrence(
    '41000000-0000-4000-8000-000000000090','weather',
    '42000000-0000-4000-8000-000000000005'
  )->>'replayed')::boolean,
  true,'cancellation replay does not duplicate notices or exceptions'
);
select is(
  (select count(*)::integer from public.workshop_message_queue
    where communication_type='cancellation_notice'
      and workshop_booking_id in(
        '41000000-0000-4000-8000-000000000095',
        '41000000-0000-4000-8000-000000000096'
      )),
  2,'replay leaves exactly one cancellation notice per affected booking'
);

reset role;
select is(
  (public.reconcile_workshop_stripe_event(
    'evt_cancel_after_occurrence','checkout.session.completed',
    'cs_cancel_processing','checkout.session',now(),now(),
    'cancel-race-payload-digest-abcdefghijklmnopqrstuvwxyz0123456789',
    '41000000-0000-4000-8000-000000000097','pi_cancel_after',10000,'USD',
    '42000000-0000-4000-8000-000000000006'
  )->>'exceptionType'),
  'cancellation_race','payment completed after cancellation cannot confirm seats'
);
select is(
  (select count(*)::integer from public.workshop_payment_transactions
    where provider_transaction_id='pi_cancel_after'),
  1,'post-cancellation money is recorded exactly once'
);
select is(
  (public.reconcile_workshop_stripe_event(
    'evt_cancel_after_occurrence','checkout.session.completed',
    'cs_cancel_processing','checkout.session',now(),now(),
    'cancel-race-payload-digest-abcdefghijklmnopqrstuvwxyz0123456789',
    '41000000-0000-4000-8000-000000000097','pi_cancel_after',10000,'USD',
    '42000000-0000-4000-8000-000000000006'
  )->>'replayed')::boolean,
  true,'replayed provider completion has no second financial effect'
);
select is(
  (select status from public.workshop_bookings
    where workshop_booking_id='41000000-0000-4000-8000-000000000095'),
  'cancelled','post-cancellation money never recreates or confirms the booking'
);

select has_function(
  'public','manage_workshop_reschedule',array['text','jsonb','uuid'],
  'authoritative material-reschedule command exists'
);
select col_not_null(
  'public','workshop_reschedule_responses','protected_quantity',
  'each response records its protected replacement quantity'
);
select col_not_null(
  'public','workshop_reschedule_responses','replacement_hold_id',
  'each response owns one protected replacement hold'
);
select ok(
  not has_function_privilege(
    'anon','public.manage_workshop_reschedule(text,jsonb,uuid)','EXECUTE'
  ),
  'anonymous callers cannot invoke reschedule commands directly'
);

reset role;
insert into public.workshop_occurrences(
  workshop_occurrence_id,workshop_definition_id,slug,status,title_snapshot,
  advertising_line_snapshot,description_snapshot,included_materials_snapshot,
  terms_snapshot,terms_version,venue_name,address_line_1,locality,region,
  postal_code,timezone,local_start,local_end,utc_offset_minutes,start_at,end_at,
  registration_opens_at,registration_closes_at,capacity,per_booking_limit,
  price_minor,currency,waitlist_enabled
) values
(
  '43000000-0000-4000-8000-000000000010',
  '41000000-0000-4000-8000-000000000010','reschedule-source-test',
  'published_open','Original Workshop','Original schedule','Test workshop',
  'Materials','Terms',1,'Old Studio','1 Main St','Richmond','VA','23220','UTC',
  (now()+interval '40 days')::timestamp,(now()+interval '40 days 2 hours')::timestamp,
  0,now()+interval '40 days',now()+interval '40 days 2 hours',
  now()-interval '1 day',now()+interval '39 days',3,3,5000,'USD',false
),(
  '43000000-0000-4000-8000-000000000020',
  '41000000-0000-4000-8000-000000000010','reschedule-replacement-test',
  'published_open','Replacement Workshop','Replacement schedule','Test workshop',
  'Materials','Terms',1,'New Studio','2 Main St','Richmond','VA','23220','UTC',
  (now()+interval '50 days')::timestamp,(now()+interval '50 days 2 hours')::timestamp,
  0,now()+interval '50 days',now()+interval '50 days 2 hours',
  now()-interval '1 day',now()+interval '49 days',3,3,5000,'USD',false
);
insert into public.workshop_seat_holds(
  workshop_seat_hold_id,workshop_occurrence_id,quantity,state,payment_method,
  normal_expires_at,effective_expires_at,resolved_at,resolution_reason,command_key
) values
(
  '43000000-0000-4000-8000-000000000201',
  '43000000-0000-4000-8000-000000000010',1,'confirmed','stripe',
  now()+interval '40 days',now()+interval '40 days',
  now()-interval '1 day','trusted_payment',
  '43000000-0000-4000-8000-000000000211'
),(
  '43000000-0000-4000-8000-000000000202',
  '43000000-0000-4000-8000-000000000010',1,'confirmed','stripe',
  now()+interval '40 days',now()+interval '40 days',
  now()-interval '1 day','trusted_payment',
  '43000000-0000-4000-8000-000000000212'
),(
  '43000000-0000-4000-8000-000000000203',
  '43000000-0000-4000-8000-000000000010',1,'confirmed','stripe',
  now()+interval '40 days',now()+interval '40 days',
  now()-interval '1 day','trusted_payment',
  '43000000-0000-4000-8000-000000000213'
);
insert into public.workshop_bookings(
  workshop_booking_id,workshop_occurrence_id,booking_reference,
  status_token_digest,status_token_expires_at,contact_name,contact_email,
  purchased_quantity,active_quantity,status,payment_state,
  price_per_seat_minor_snapshot,subtotal_minor_snapshot,total_minor_snapshot,
  required_charges_minor_snapshot,currency,terms_snapshot,terms_version,
  payment_method,confirmed_at
) values
(
  '43000000-0000-4000-8000-000000000101',
  '43000000-0000-4000-8000-000000000010','BBW-RESCHEDULE-ACCEPT',
  'reschedule-accept-status-digest-abcdefghijklmnopqrstuvwxyz0123456789',
  now()+interval '70 days','Accept Guest','accept-reschedule@example.test',
  1,1,'confirmed','paid',5000,5000,5000,0,'USD','Terms',1,'stripe',now()
),(
  '43000000-0000-4000-8000-000000000102',
  '43000000-0000-4000-8000-000000000010','BBW-RESCHEDULE-DECLINE',
  'reschedule-decline-status-digest-abcdefghijklmnopqrstuvwxyz0123456789',
  now()+interval '70 days','Decline Guest','decline-reschedule@example.test',
  1,1,'confirmed','paid',5000,5000,5000,0,'USD','Terms',1,'stripe',now()
),(
  '43000000-0000-4000-8000-000000000103',
  '43000000-0000-4000-8000-000000000010','BBW-RESCHEDULE-EXPIRE',
  'reschedule-expire-status-digest-abcdefghijklmnopqrstuvwxyz0123456789',
  now()+interval '70 days','Expire Guest','expire-reschedule@example.test',
  1,1,'confirmed','paid',5000,5000,5000,0,'USD','Terms',1,'stripe',now()
);
update public.workshop_seat_holds set booking_id=case workshop_seat_hold_id
  when '43000000-0000-4000-8000-000000000201'
    then '43000000-0000-4000-8000-000000000101'::uuid
  when '43000000-0000-4000-8000-000000000202'
    then '43000000-0000-4000-8000-000000000102'::uuid
  else '43000000-0000-4000-8000-000000000103'::uuid end
where workshop_seat_hold_id in(
  '43000000-0000-4000-8000-000000000201',
  '43000000-0000-4000-8000-000000000202',
  '43000000-0000-4000-8000-000000000203'
);

set local role authenticated;
set local request.jwt.claims=
  '{"sub":"41000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(
  (public.manage_workshop_reschedule(
    'begin',
    jsonb_build_object(
      'sourceOccurrenceId','43000000-0000-4000-8000-000000000010',
      'replacementOccurrenceId','43000000-0000-4000-8000-000000000020',
      'responseDeadline',now()+interval '7 days'
    ),
    '43000000-0000-4000-8000-000000000301'
  )->>'affectedBookings')::integer,
  3,'material reschedule creates one decision per affected booking'
);
select is(
  (select status from public.workshop_occurrences
    where workshop_occurrence_id='43000000-0000-4000-8000-000000000010'),
  'rescheduled','source occurrence moves to persisted rescheduled lifecycle'
);
select is(
  (select replacement_occurrence_id from public.workshop_occurrences
    where workshop_occurrence_id='43000000-0000-4000-8000-000000000010'),
  '43000000-0000-4000-8000-000000000020'::uuid,
  'original occurrence URL retains an explicit replacement link'
);
select ok(
  (select status_page_expires_at between
      now()+interval '11 months 29 days' and now()+interval '12 months 1 day'
    from public.workshop_occurrences
    where workshop_occurrence_id='43000000-0000-4000-8000-000000000010'),
  'original rescheduled URL retains twelve months of public status'
);
select is(
  (select coalesce(sum(protected_quantity),0)::integer
    from public.workshop_reschedule_responses
    where source_occurrence_id='43000000-0000-4000-8000-000000000010'),
  3,'equivalent replacement capacity is protected atomically'
);
select is(
  (select count(*)::integer from public.workshop_seat_holds
    where workshop_occurrence_id='43000000-0000-4000-8000-000000000020'
      and state='active'),
  3,'each customer decision owns a bounded replacement hold'
);
select is(
  (select count(*)::integer from public.workshop_bookings
    where workshop_occurrence_id='43000000-0000-4000-8000-000000000010'
      and status='transfer_action_required'),
  3,'no booking is silently transferred to the replacement'
);
select is(
  (select count(*)::integer from public.workshop_message_queue
    where communication_type='reschedule_prompt'
      and token_purpose='reschedule_response'
      and workshop_booking_id in(
        '43000000-0000-4000-8000-000000000101',
        '43000000-0000-4000-8000-000000000102',
        '43000000-0000-4000-8000-000000000103'
      )),
  3,'every reachable affected customer receives a single-purpose prompt'
);
set local role service_role;
select is(
  (public.get_workshop_booking_status(
    'reschedule-accept-status-digest-abcdefghijklmnopqrstuvwxyz0123456789'
  )->>'action'),
  'reschedule','authorized booking status exposes a safe reschedule action'
);
select is(
  (public.get_workshop_booking_status(
    'reschedule-accept-status-digest-abcdefghijklmnopqrstuvwxyz0123456789'
  )->>'replacementTitle'),
  'Replacement Workshop','status includes replacement copy without response token'
);
select is(
  (public.get_workshop_booking_status(
    'reschedule-accept-status-digest-abcdefghijklmnopqrstuvwxyz0123456789'
  )->>'protectedQuantity')::integer,
  1,'status includes only the authorized booking protected quantity'
);
select ok(
  not (public.get_workshop_booking_status(
    'reschedule-accept-status-digest-abcdefghijklmnopqrstuvwxyz0123456789'
  ) ? 'responseTokenDigest'),
  'status projection never returns a response-token digest'
);
set local role authenticated;
select is(
  (public.manage_workshop_reschedule(
    'begin','{}','43000000-0000-4000-8000-000000000301'
  )->>'replayed')::boolean,
  true,'material reschedule creation is replay-safe'
);

reset role;
select count(*) from public.claim_workshop_communications(
  'reschedule-token-worker',100
);
select is(
  (public.register_workshop_message_token(
    (select workshop_message_queue_id from public.workshop_message_queue
      where workshop_booking_id='43000000-0000-4000-8000-000000000101'
        and communication_type='reschedule_prompt'),
    'reschedule-token-worker',
    'reschedule-accept-response-digest-abcdefghijklmnopqrstuvwxyz0123456789',
    '43000000-0000-4000-8000-000000000307'
  )->>'purpose'),
  'reschedule_response',
  'claimed message worker registers only the response-token digest'
);
select is(
  (select response_token_digest from public.workshop_reschedule_responses
    where workshop_booking_id='43000000-0000-4000-8000-000000000101'),
  'reschedule-accept-response-digest-abcdefghijklmnopqrstuvwxyz0123456789',
  'raw reschedule response token is never persisted'
);
update public.workshop_reschedule_responses set response_token_digest=case
  when workshop_booking_id='43000000-0000-4000-8000-000000000102'
    then 'reschedule-decline-response-digest-abcdefghijklmnopqrstuvwxyz0123456789'
  else 'reschedule-expire-response-digest-abcdefghijklmnopqrstuvwxyz0123456789'
  end
where source_occurrence_id='43000000-0000-4000-8000-000000000010'
  and workshop_booking_id<>'43000000-0000-4000-8000-000000000101';

select is(
  (public.manage_workshop_reschedule(
    'respond',
    '{"responseTokenDigest":"forged-reschedule-response-digest-abcdefghijklmnopqrstuvwxyz0123456789",
      "response":"accept"}',
    '43000000-0000-4000-8000-000000000302'
  )->>'state'),
  'unavailable','forged reschedule tokens reveal no booking state'
);
select is(
  (public.manage_workshop_reschedule(
    'respond',
    '{"responseTokenDigest":"reschedule-accept-response-digest-abcdefghijklmnopqrstuvwxyz0123456789",
      "response":"accept"}',
    '43000000-0000-4000-8000-000000000303'
  )->>'state'),
  'accepted','customer may explicitly accept protected replacement capacity'
);
select is(
  (select workshop_occurrence_id from public.workshop_bookings
    where workshop_booking_id='43000000-0000-4000-8000-000000000101'),
  '43000000-0000-4000-8000-000000000020'::uuid,
  'acceptance atomically transfers only the accepting booking'
);
select is(
  (select state from public.workshop_seat_holds
    where workshop_seat_hold_id=(
      select replacement_hold_id from public.workshop_reschedule_responses
      where workshop_booking_id='43000000-0000-4000-8000-000000000101'
    )),
  'confirmed','accepted replacement capacity becomes confirmed'
);
select is(
  (public.manage_workshop_reschedule(
    'respond',
    '{"responseTokenDigest":"reschedule-decline-response-digest-abcdefghijklmnopqrstuvwxyz0123456789",
      "response":"decline"}',
    '43000000-0000-4000-8000-000000000304'
  )->>'state'),
  'declined','customer may decline and request cancellation handling'
);
select is(
  (select status from public.workshop_bookings
    where workshop_booking_id='43000000-0000-4000-8000-000000000102'),
  'cancelled','decline never transfers the customer silently'
);
select is(
  (select count(*)::integer from public.workshop_payment_exceptions
    where workshop_booking_id='43000000-0000-4000-8000-000000000102'
      and exception_type='reschedule_declined_refund_review'),
  1,'decline creates florist-controlled refund review without moving money'
);
select is(
  (public.manage_workshop_reschedule(
    'respond',
    '{"responseTokenDigest":"reschedule-accept-response-digest-abcdefghijklmnopqrstuvwxyz0123456789",
      "response":"accept"}',
    '43000000-0000-4000-8000-000000000303'
  )->>'replayed')::boolean,
  true,'customer response replay has no second capacity effect'
);

reset role;
update public.workshop_reschedule_responses set response_token_expires_at=now()
where workshop_booking_id='43000000-0000-4000-8000-000000000103';
update public.workshop_seat_holds set effective_expires_at=now()
where workshop_seat_hold_id=(
  select replacement_hold_id from public.workshop_reschedule_responses
  where workshop_booking_id='43000000-0000-4000-8000-000000000103'
);
select is(
  (public.manage_workshop_reschedule(
    'respond',
    '{"responseTokenDigest":"reschedule-expire-response-digest-abcdefghijklmnopqrstuvwxyz0123456789",
      "response":"accept"}',
    '43000000-0000-4000-8000-000000000305'
  )->>'state'),
  'expired','response at the exact deadline cannot transfer capacity'
);
select is(
  (select status from public.workshop_bookings
    where workshop_booking_id='43000000-0000-4000-8000-000000000103'),
  'transfer_action_required','nonresponse remains unconfirmed for florist review'
);

set local role authenticated;
set local request.jwt.claims=
  '{"sub":"41000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(
  (public.manage_workshop_reschedule(
    'resolve_nonresponse',
    jsonb_build_object(
      'responseId',(select workshop_reschedule_response_id
        from public.workshop_reschedule_responses
        where workshop_booking_id='43000000-0000-4000-8000-000000000103'),
      'resolution','cancel'
    ),
    '43000000-0000-4000-8000-000000000306'
  )->>'state'),
  'staff_resolved','florist may explicitly resolve an expired nonresponse'
);
select is(
  (select status from public.workshop_bookings
    where workshop_booking_id='43000000-0000-4000-8000-000000000103'),
  'cancelled','staff resolution records cancellation rather than acceptance'
);
select is(
  (select count(*)::integer from public.workshop_bookings
    where workshop_occurrence_id='43000000-0000-4000-8000-000000000020'
      and status='transferred'),
  1,'only the explicitly accepting customer reaches the replacement'
);

reset role;
insert into public.workshop_bookings(
  workshop_booking_id,workshop_occurrence_id,booking_reference,
  status_token_digest,status_token_expires_at,contact_name,contact_email,
  purchased_quantity,active_quantity,status,payment_state,
  price_per_seat_minor_snapshot,subtotal_minor_snapshot,total_minor_snapshot,
  required_charges_minor_snapshot,currency,terms_snapshot,terms_version,
  payment_method
) values (
  '41000000-0000-4000-8000-000000000090',
  '41000000-0000-4000-8000-000000000020','BBW-VENMO-UPDATE',
  'confirmed-transition-digest-abcdefghijklmnopqrstuvwxyz0123456789',
  now()+interval '40 days','Venmo Guest','venmo@example.test',1,1,
  'pending_payment','pending',5000,5000,5000,0,'USD','Terms',1,'direct_venmo'
);
select is(
  (select count(*)::integer from public.workshop_message_queue
    where workshop_booking_id='41000000-0000-4000-8000-000000000090'),
  0,'pending Venmo booking does not receive a false confirmation'
);
update public.workshop_bookings
set status='confirmed',payment_state='paid',confirmed_at=now()
where workshop_booking_id='41000000-0000-4000-8000-000000000090';
select is(
  (select count(*)::integer from public.workshop_message_queue
    where workshop_booking_id='41000000-0000-4000-8000-000000000090'
      and communication_type='booking_confirmation'),
  1,'verified payment transition queues one booking confirmation'
);
update public.workshop_bookings set status='confirmed'
where workshop_booking_id='41000000-0000-4000-8000-000000000090';
select is(
  (select count(*)::integer from public.workshop_message_queue
    where workshop_booking_id='41000000-0000-4000-8000-000000000090'
      and communication_type='booking_confirmation'),
  1,'later confirmed-state updates do not duplicate confirmation email'
);
select * from finish();
rollback;
