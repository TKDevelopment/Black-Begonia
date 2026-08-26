begin;
select no_plan();

select ok(to_regclass('public.workshop_seat_holds') is not null,'seat holds exist');
select ok(to_regclass('public.workshop_bookings') is not null,'bookings exist');
select has_function(
  'public','delete_workshop_occurrence',array['uuid','uuid'],
  'booking-aware occurrence deletion command exists'
);
select matches(
  pg_get_functiondef('public.delete_workshop_occurrence(uuid,uuid)'::regprocedure),
  'workshop_bookings',
  'occurrence deletion checks booked reservations at the database boundary'
);
select ok(to_regclass('public.workshop_attendees') is not null,'attendees exist');
select ok(to_regclass('public.workshop_booking_adjustments') is not null,'booking adjustments exist');
select has_index('public','workshop_seat_holds','idx_workshop_holds_active_capacity','active holds are indexed for capacity');
select has_index('public','workshop_bookings','idx_workshop_bookings_occurrence','occurrence roster is indexed');
select has_function(
  'public','create_workshop_seat_hold',
  array['text','integer','text','text','text','integer','text','uuid','integer'],
  'authoritative booking and hold command exists'
);
select ok(
  pg_get_functiondef(
    'public.create_workshop_seat_hold(text,integer,text,text,text,integer,text,uuid,integer)'::regprocedure
  ) like '%for update%',
  'hold command locks occurrence'
);
select ok(
  pg_get_functiondef(
    'public.create_workshop_seat_hold(text,integer,text,text,text,integer,text,uuid,integer)'::regprocedure
  ) like '%insufficient_capacity%',
  'hold command rejects oversell'
);
select has_function(
  'public','switch_workshop_payment_method',
  array['text','text','uuid','text','integer','integer'],
  'payment method switching is authoritative'
);
select has_function('public','expire_workshop_holds',array['integer'],'hold expiration command exists');
select has_function(
  'public','get_workshop_booking_status',array['text'],
  'token-scoped redacted booking status projection exists'
);
select has_function(
  'public','attach_workshop_stripe_checkout',array['uuid','text','uuid'],
  'Stripe checkout attachment is an authoritative command'
);
select has_function(
  'public','recover_workshop_status_access',array['text','text','text','uuid'],
  'generic status recovery rotates through an authoritative command'
);
select has_function(
  'public','rotate_workshop_status_token',array['text','text','uuid'],
  'status token rotation command exists'
);
select ok((select relrowsecurity from pg_class where oid='public.workshop_bookings'::regclass),'booking customer data enforces RLS');
select ok(not has_table_privilege('anon','public.workshop_bookings','SELECT'),'anonymous users cannot read bookings');
select ok(not has_table_privilege('anon','public.workshop_seat_holds','INSERT'),'anonymous users cannot create holds directly');
select ok(
  not has_function_privilege(
    'anon',
    'public.create_workshop_seat_hold(text,integer,text,text,text,integer,text,uuid,integer)',
    'EXECUTE'
  ),
  'anonymous users cannot invoke capacity command'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.create_workshop_seat_hold(text,integer,text,text,text,integer,text,uuid,integer)',
    'EXECUTE'
  ),
  'service role invokes capacity command'
);
select col_not_null('public','workshop_bookings','status_token_digest','booking access stores a required digest');
select col_not_null('public','workshop_booking_adjustments','command_key','adjustment commands are idempotent');
select has_function('public','get_workshop_public_availability',array['uuid'],'booking-aware public availability exists');
select has_function('public','get_workshop_public_remaining_seats',array['uuid'],'public urgency threshold exists');

insert into public.workshop_definitions(
  workshop_definition_id,title,theme,advertising_line,description,
  included_materials,default_terms
) values (
  '30000000-0000-4000-8000-000000000001','Capacity Workshop','seasonal',
  'Capacity projection test','Safe public projection fixture','Materials','Terms'
);
insert into public.workshop_media(
  workshop_definition_id,media_role,storage_path,public_url,alt_text,
  display_order,is_public,width,height,byte_size,mime_type
) values (
  '30000000-0000-4000-8000-000000000001','hero','capacity/hero.webp',
  'https://example.test/capacity/hero.webp','Workshop arrangement',0,true,
  1200,800,100000,'image/webp'
);
insert into public.workshop_occurrences(
  workshop_occurrence_id,workshop_definition_id,slug,status,title_snapshot,
  advertising_line_snapshot,description_snapshot,included_materials_snapshot,
  terms_snapshot,terms_version,venue_name,address_line_1,locality,region,
  postal_code,country,timezone,local_start,local_end,utc_offset_minutes,
  start_at,end_at,registration_opens_at,registration_closes_at,capacity,
  per_booking_limit,price_minor,currency,stripe_enabled,venmo_enabled,
  waitlist_enabled
)
select fixture.id::uuid,'30000000-0000-4000-8000-000000000001',fixture.slug,
  fixture.status,'Capacity Workshop','Capacity projection test',
  'Safe public projection fixture','Materials','Terms',1,'Studio',
  '100 Flower Lane','Richmond','VA','23220','US','UTC',
  (now()+interval '10 days')::timestamp,(now()+interval '12 days')::timestamp,
  0,now()+interval '10 days',now()+interval '12 days',now()-interval '1 day',
  now()+interval '9 days',10,4,5000,'USD',false,true,fixture.waitlist
from (values
  ('30000000-0000-4000-8000-000000000010','capacity-available',false,'published_open'),
  ('30000000-0000-4000-8000-000000000011','capacity-limited',false,'published_open'),
  ('30000000-0000-4000-8000-000000000012','capacity-sold-out',false,'published_open'),
  ('30000000-0000-4000-8000-000000000013','capacity-waitlist',true,'published_open'),
  ('30000000-0000-4000-8000-000000000014','capacity-manually-closed',true,'registration_closed')
) fixture(id,slug,waitlist,status);

insert into public.workshop_stripe_price_versions(
  workshop_stripe_price_version_id,workshop_definition_id,stripe_product_id,
  stripe_price_id,amount_minor,currency,state,provider_created_at
) values (
  '30000000-0000-4000-8000-000000000030',
  '30000000-0000-4000-8000-000000000001',
  'prod_capacity_test','price_capacity_5000',5000,'USD','active',now()
);
update public.workshop_occurrences
set stripe_enabled=true,
    stripe_price_version_id='30000000-0000-4000-8000-000000000030'
where slug='capacity-available';

select lives_ok(
  $$select public.create_workshop_seat_hold(
    'capacity-available',2,'First Customer','first@example.test',null,1,
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '30000000-0000-4000-8000-000000000040',15
  )$$,
  'booking shell and hold are created atomically'
);
select is(
  (
    select total_minor_snapshot
    from public.workshop_bookings
    where contact_email='first@example.test'
  ),
  10000::bigint,
  'total is the exact tax-inclusive unit price multiplied by quantity'
);
select is(
  (
    select required_charges_minor_snapshot
    from public.workshop_bookings
    where contact_email='first@example.test'
  ),
  0::bigint,
  'no mandatory checkout surcharge is added'
);
select is(
  (
    select count(*)::integer
    from public.workshop_bookings
    where contact_email='first@example.test'
  ),
  1,
  'one booking shell exists before idempotent replay'
);
insert into public.profiles(id,is_active)
values ('30000000-0000-4000-8000-000000000090',true)
on conflict (id) do update set is_active=true;
insert into public.user_roles(user_id,role)
values ('30000000-0000-4000-8000-000000000090','admin')
on conflict (user_id,role) do nothing;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"30000000-0000-4000-8000-000000000090","role":"authenticated"}';
select throws_ok(
  $$select public.delete_workshop_occurrence(
    '30000000-0000-4000-8000-000000000010',
    '30000000-0000-4000-8000-000000000091'
  )$$,
  '55000',
  'workshop occurrence has booked reservations',
  'published occurrence deletion is blocked after any reservation is created'
);
reset role;
select lives_ok(
  $$select public.create_workshop_seat_hold(
    'capacity-available',2,'First Customer','first@example.test',null,1,
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '30000000-0000-4000-8000-000000000040',15
  )$$,
  'hold creation replay is safe'
);
select is(
  (
    select count(*)::integer
    from public.workshop_bookings
    where contact_email='first@example.test'
  ),
  1,
  'hold creation replay does not duplicate the booking'
);
select throws_ok(
  $$select public.create_workshop_seat_hold(
    'capacity-available',2,'First Customer','first@example.test',null,1,
    'different-status-token-digest-abcdefghijklmnopqrstuvwxyz',
    '30000000-0000-4000-8000-000000000040',15
  )$$,
  '22023','command key collision',
  'hold command rejects a reused command key with a different request'
);
select throws_ok(
  $$select public.create_workshop_seat_hold(
    'capacity-available',5,'Too Many','many@example.test',null,1,
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    '30000000-0000-4000-8000-000000000041',15
  )$$,
  'P0001',
  'quantity_changed',
  'per-booking quantity limit is enforced under the occurrence lock'
);
select lives_ok(
  $$select public.switch_workshop_payment_method(
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','direct_venmo',
    '30000000-0000-4000-8000-000000000042',
    'https://venmo.com/u/approved-business',15,24
  )$$,
  'direct Venmo selection creates an attempt'
);
select ok(
  (
    select effective_expires_at <= now()+interval '24 hours 1 minute'
      and effective_expires_at <= (
        select least(registration_closes_at,start_at)
        from public.workshop_occurrences where slug='capacity-available'
      )
    from public.workshop_payment_attempts
    where command_key='30000000-0000-4000-8000-000000000042'
  ),
  'direct Venmo deadline is capped at 24 hours and the occurrence cutoffs'
);
select is(
  public.get_workshop_booking_status(
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  )->>'state',
  'pending_venmo',
  'token-scoped status exposes pending direct Venmo state'
);
select ok(
  not (
    public.get_workshop_booking_status(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    ) ?| array['contactEmail','contactPhone','bookingId','statusTokenDigest']
  ),
  'booking status projection excludes customer data, identifiers, and token digests'
);
select lives_ok(
  $$select public.switch_workshop_payment_method(
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','stripe',
    '30000000-0000-4000-8000-000000000043',null,15,24
  )$$,
  'switching to Stripe creates a replacement attempt'
);
select is(
  (
    select count(*)::integer
    from public.workshop_payment_attempts a
    join public.workshop_bookings b using(workshop_booking_id)
    where b.contact_email='first@example.test'
      and a.state in('creating','active','processing')
  ),
  1,
  'only one payment attempt remains active after switching'
);
select is(
  (
    select state
    from public.workshop_payment_attempts
    where command_key='30000000-0000-4000-8000-000000000042'
  ),
  'superseded',
  'the previous payment attempt is explicitly superseded'
);
select is(
  (
    select amount_minor
    from public.workshop_payment_attempts
    where command_key='30000000-0000-4000-8000-000000000043'
  ),
  10000::bigint,
  'Stripe and direct Venmo use the same immutable total'
);
select lives_ok(
  $$select public.attach_workshop_stripe_checkout(
    (select workshop_payment_attempt_id from public.workshop_payment_attempts
      where command_key='30000000-0000-4000-8000-000000000043'),
    'cs_workshop_capacity_test',
    '30000000-0000-4000-8000-000000000045'
  )$$,
  'Stripe checkout identifier is attached under the attempt lock'
);
select lives_ok(
  $$select public.attach_workshop_stripe_checkout(
    (select workshop_payment_attempt_id from public.workshop_payment_attempts
      where command_key='30000000-0000-4000-8000-000000000043'),
    'cs_workshop_capacity_test',
    '30000000-0000-4000-8000-000000000045'
  )$$,
  'Stripe checkout attachment replay is safe'
);
select lives_ok(
  $$select public.rotate_workshop_status_token(
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'ccccccccccccccccccccccccccccccccccccccccccc',
    '30000000-0000-4000-8000-000000000044'
  )$$,
  'status access token rotates without storing a raw token'
);
select is(
  (
    select status_token_digest
    from public.workshop_bookings
    where contact_email='first@example.test'
  ),
  'ccccccccccccccccccccccccccccccccccccccccccc',
  'the prior status digest is invalidated'
);
select is(
  (
    select status_token_expires_at
    from public.workshop_bookings
    where contact_email='first@example.test'
  ),
  (
    select end_at + interval '30 days'
    from public.workshop_occurrences
    where slug='capacity-available'
  ),
  'token rotation uses occurrence end when no qualifying customer action is pending'
);
select lives_ok(
  $$select public.rotate_workshop_status_token(
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'ccccccccccccccccccccccccccccccccccccccccccc',
    '30000000-0000-4000-8000-000000000044'
  )$$,
  'status token rotation replay is safe'
);
select lives_ok(
  $$select public.recover_workshop_status_access(
    'first@example.test',
    (select booking_reference from public.workshop_bookings
      where contact_email='first@example.test'),
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    '30000000-0000-4000-8000-000000000046'
  )$$,
  'matching recovery details rotate the digest without exposing booking state publicly'
);
select is(
  (
    select status_token_digest
    from public.workshop_bookings
    where contact_email='first@example.test'
  ),
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'status recovery invalidates the previous digest'
);
select is(
  public.recover_workshop_status_access(
    'unknown@example.test','BBW-UNKNOWN',
    'lllllllllllllllllllllllllllllllllllllllllll',
    '30000000-0000-4000-8000-000000000047'
  )->>'matched',
  'false',
  'unknown recovery details produce only an internal non-match'
);

insert into public.workshop_seat_holds(
  workshop_occurrence_id,quantity,state,payment_method,normal_expires_at,
  effective_expires_at,command_key
) values
 ('30000000-0000-4000-8000-000000000011',8,'active','stripe',now()+interval '1 day',now()+interval '1 day','30000000-0000-4000-8000-000000000021'),
 ('30000000-0000-4000-8000-000000000012',10,'active','stripe',now()+interval '1 day',now()+interval '1 day','30000000-0000-4000-8000-000000000022'),
 ('30000000-0000-4000-8000-000000000013',10,'active','stripe',now()+interval '1 day',now()+interval '1 day','30000000-0000-4000-8000-000000000023');

select is(public.get_workshop_public_availability('30000000-0000-4000-8000-000000000010'),'available','unreserved capacity is available');
select is(public.get_workshop_public_availability('30000000-0000-4000-8000-000000000011'),'limited','low remaining capacity is limited');
select is(public.get_workshop_public_availability('30000000-0000-4000-8000-000000000012'),'sold_out','zero remaining capacity is sold out');
select is(public.get_workshop_public_availability('30000000-0000-4000-8000-000000000013'),'waitlist_available','sold-out waitlist-enabled occurrence exposes waitlist availability');
select is(public.get_workshop_public_availability('30000000-0000-4000-8000-000000000014'),'closed','manual lifecycle closure overrides derived capacity');
select is(
  (select "availability" from public.get_public_workshop_listing() where "slug"='capacity-limited'),
  'limited',
  'anonymous listing uses booking-aware availability'
);
select is(
  (select "remainingSeats" from public.get_public_workshop_listing() where "slug"='capacity-limited'),
  2,
  'listing exposes the exact positive count at or below half capacity'
);
select is(
  (select "remainingSeats" from public.get_public_workshop_listing() where "slug"='capacity-available'),
  null::integer,
  'listing withholds exact inventory above half capacity'
);
select is(
  (public.get_public_workshop_occurrence('capacity-limited')->>'remainingSeats')::integer,
  2,
  'detail exposes the same bounded urgency count'
);
select is(
  public.get_public_workshop_occurrence('capacity-waitlist')->>'waitlistEligible',
  'true',
  'detail projection exposes waitlist eligibility without booking facts'
);
select ok(
  not has_function_privilege('anon','public.get_workshop_public_availability(uuid)','EXECUTE'),
  'anonymous callers cannot probe arbitrary occurrence availability directly'
);
select ok(
  not has_function_privilege('anon','public.get_workshop_public_remaining_seats(uuid)','EXECUTE'),
  'anonymous callers cannot probe arbitrary exact inventory directly'
);

select * from finish();
rollback;
