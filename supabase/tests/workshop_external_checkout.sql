begin;
select no_plan();

insert into auth.users(id,email)
values ('2e000000-0000-4000-8000-000000000001','workshop-external-checkout-test@example.com');
insert into public.profiles(id,email,is_active)
values ('2e000000-0000-4000-8000-000000000001','workshop-external-checkout-test@example.com',true)
on conflict (id) do update set is_active=true;
insert into public.user_roles(user_id,role)
values ('2e000000-0000-4000-8000-000000000001','admin');
set local request.jwt.claims = '{"sub":"2e000000-0000-4000-8000-000000000001","role":"authenticated"}';

-- Exercise the actual commands and constraints together. All fixtures roll back.
do $$
declare
  v_definition uuid;
  v_series uuid;
  v_id uuid;
  v_stripe_id uuid;
  v_price uuid;
  v_booking jsonb;
  v_draft jsonb;
  v_saved jsonb;
  v_url text;
  v_hold jsonb;
  v_attempt jsonb;
  v_payment_command uuid := gen_random_uuid();
  v_denied boolean;
begin
  insert into public.workshop_definitions(title,theme,advertising_line,description,included_materials,default_terms)
  values ('Venue flowers','seasonal','Make flowers together','A floral workshop.','Flowers and tools','Venue terms')
  returning workshop_definition_id into v_definition;
  insert into public.workshop_series(workshop_definition_id,series_label,default_capacity,default_price_minor,
    default_venue_name,default_address_line_1,default_locality,default_region,default_postal_code,default_timezone)
  values (v_definition,'Venue dates',2,5000,'Venue','1 Flower St','Providence','RI','02903','America/New_York')
  returning workshop_series_id into v_series;
  v_draft := jsonb_build_object(
    'workshopDefinitionId',v_definition,'workshopSeriesId',v_series,'slug','venue-flowers-2099-11-08',
    'title','Venue flowers','advertisingLine','Make flowers together','description','A floral workshop.',
    'includedMaterials','Flowers and tools','terms','Venue booking terms','termsVersion',1,
    'venueName','Venue','addressLine1','1 Flower St','locality','Providence','region','RI',
    'postalCode','02903','country','US','timezone','America/New_York',
    'localStart','2099-11-08T13:00:00','localEnd','2099-11-08T15:00:00','utcOffsetMinutes',-300,
    'registrationOpensAt',now()-interval '1 day','registrationClosesAt','2099-11-08T17:00:00Z',
    'capacity',2,'perBookingLimit',2,'priceMinor',5000,'taxRegion','RI','currency','USD',
    'stripeEnabled',true,'waitlistEnabled',true,'isFeatured',true,
    'externalCheckoutUrl','  https://venue.example/tickets?event=flowers#reserve  '
  );
  v_saved := public.save_workshop_occurrence(v_draft,gen_random_uuid());
  v_id := (v_saved->>'workshop_occurrence_id')::uuid;
  assert v_saved->>'external_checkout_url' = 'https://venue.example/tickets?event=flowers#reserve', 'URL is trimmed and persisted';
  assert (v_saved->>'stripe_enabled')::boolean = false, 'Venue checkout disables Stripe';
  assert (v_saved->>'waitlist_enabled')::boolean = false, 'Venue checkout disables the local waitlist';

  insert into public.workshop_media(workshop_definition_id,media_role,storage_path,public_url,alt_text,is_public,width,height,byte_size,mime_type)
  values (v_definition,'hero','external-checkout-test/hero.webp','https://example.com/hero.webp','Flowers',true,1200,800,1024,'image/webp');
  perform public.publish_workshop_occurrence(v_id,gen_random_uuid());
  assert (select status='published_open' from public.workshop_occurrences where workshop_occurrence_id=v_id), 'External workshop publishes without Stripe';
  assert public.get_public_workshop_occurrence('venue-flowers-2099-11-08')->>'externalCheckoutUrl' = v_saved->>'external_checkout_url', 'Public detail exposes venue link';
  assert public.get_public_workshop_occurrence(p_occurrence_slug => 'venue-flowers-2099-11-08')->>'externalCheckoutUrl' = v_saved->>'external_checkout_url', 'Public RPC retains the deployed named argument';
  assert public.get_public_workshop_occurrence_route('venue-flowers','2099-11-08')->>'externalCheckoutUrl' = v_saved->>'external_checkout_url', 'Dated public routes expose venue checkout';
  assert (select "externalCheckoutUrl"=v_saved->>'external_checkout_url' from public.get_public_workshop_listing() where slug='venue-flowers-2099-11-08'), 'Listing exposes venue link';

  v_denied := false;
  begin
    perform public.create_workshop_seat_hold('venue-flowers-2099-11-08',1,'Guest','guest@example.com',null,1,repeat('e',64),gen_random_uuid(),15);
  exception when sqlstate '55000' then v_denied := true;
  end;
  assert v_denied, 'Direct API clients cannot create venue bookings';
  assert not exists(select 1 from public.workshop_bookings where workshop_occurrence_id=v_id), 'Blocked requests leave no local booking';
  v_denied := false;
  begin
    perform public.manage_workshop_waitlist('join',jsonb_build_object(
      'occurrenceSlug','venue-flowers-2099-11-08','quantity',1,'contactName','Guest',
      'contactEmail','guest@example.com','withdrawalTokenDigest',repeat('w',64)
    ),gen_random_uuid());
  exception when sqlstate 'P0001' then v_denied := true;
  end;
  assert v_denied, 'Venue workshops do not accept local waitlist entries';

  -- Staff can record venue bookings, even though public inventory stays unknown.
  v_booking := public.manage_workshop_roster('create_reservation',jsonb_build_object(
    'occurrenceId',v_id,'quantity',2,'reservationType','manual','statusTokenDigest',repeat('m',64),
    'contactName','Venue guest','contactEmail','guest@example.com','reason','Venue guest list'
  ),gen_random_uuid());
  assert v_booking->>'status'='confirmed', 'Manual venue bookings remain supported';
  assert public.get_workshop_public_availability(v_id)='available', 'Local capacity cannot sell out venue checkout';
  assert public.get_workshop_public_remaining_seats(v_id) is null, 'Venue remaining seats are unknown';
  assert public.get_workshop_occurrence_operational_state(v_id)->>'externalCheckoutUrl'=v_saved->>'external_checkout_url', 'Roster exposes manual tracking mode';
  assert exists(select 1 from public.crm_m365_calendar_outbox where source_type='workshop' and source_id=v_id), 'Existing calendar trigger still queues workshop updates';

  for v_url in select unnest(array['javascript:alert(1)','http://venue.example','//venue.example','https://user:password@venue.example','https://venue.example/a b',E'https://venue.example\\evil','https://']) loop
    v_denied := false;
    begin
      update public.workshop_occurrences set external_checkout_url=v_url where workshop_occurrence_id=v_id;
    exception when check_violation then v_denied := true;
    end;
    assert v_denied, 'Unsafe venue URL is rejected: ' || v_url;
  end loop;

  -- Clearing the link on a published workshop requires the normal Stripe setup.
  v_denied := false;
  begin
    update public.workshop_occurrences set external_checkout_url=null where workshop_occurrence_id=v_id;
  exception when check_violation then v_denied := true;
  end;
  assert v_denied, 'Published workshops always retain a working checkout provider';
  update public.workshop_occurrences set status='registration_closed' where workshop_occurrence_id=v_id;
  assert public.get_workshop_public_availability(v_id)='closed', 'Closed venue events stay closed';
  update public.workshop_occurrences set status='published_open' where workshop_occurrence_id=v_id;

  perform public.apply_workshop_series_update(v_series,array[v_id],jsonb_build_object(
    'scope','selected','externalCheckoutUrl','https://venue.example/new-tickets',
    'confirmedBookedOccurrenceIds',jsonb_build_array(v_id)
  ),gen_random_uuid());
  assert (select external_checkout_url='https://venue.example/new-tickets' from public.workshop_occurrences where workshop_occurrence_id=v_id), 'Series updates persist checkout overrides';

  -- No override preserves normal publication, public seat counts, and Stripe holds.
  insert into public.workshop_stripe_price_versions(workshop_definition_id,stripe_product_id,stripe_price_id,amount_minor,currency,state,provider_created_at)
  values (v_definition,'prod_external_checkout_test','price_external_checkout_test',5000,'USD','active',now())
  returning workshop_stripe_price_version_id into v_price;
  update public.workshop_definitions set stripe_product_id='prod_external_checkout_test',stripe_catalog_state='ready' where workshop_definition_id=v_definition;
  v_draft := (v_draft - 'externalCheckoutUrl') || jsonb_build_object('slug','stripe-flowers-2099-11-08','stripePriceVersionId',v_price);
  v_saved := public.save_workshop_occurrence(v_draft,gen_random_uuid());
  v_stripe_id := (v_saved->>'workshop_occurrence_id')::uuid;
  perform public.publish_workshop_occurrence(v_stripe_id,gen_random_uuid());
  v_hold := public.create_workshop_seat_hold('stripe-flowers-2099-11-08',1,'Stripe guest','stripe@example.com',null,1,repeat('s',64),gen_random_uuid(),15);
  assert v_hold->'methods'='["stripe"]'::jsonb, 'Default reservations still offer Stripe';
  assert public.get_workshop_public_remaining_seats(v_stripe_id)=1, 'Default inventory still tracks local holds';
  v_denied := false;
  begin
    perform public.save_workshop_occurrence(v_draft || jsonb_build_object(
      'workshopOccurrenceId',v_stripe_id,'externalCheckoutUrl','https://venue.example/tickets'
    ),gen_random_uuid());
  exception when sqlstate '55000' then v_denied := true;
  end;
  assert v_denied, 'Provider changes wait for active checkout holds';

  v_attempt := public.switch_workshop_payment_method(repeat('s',64),'stripe',v_payment_command,30);
  assert v_attempt->>'method'='stripe', 'Existing four-argument checkout RPC still selects Stripe';
  assert v_attempt->>'stripePriceId'='price_external_checkout_test', 'Checkout receives the configured Stripe price';
  assert (v_attempt->>'amountMinor')::bigint=5350, 'Checkout retains pre-tax price plus tax';
  assert v_attempt ?& array['paymentAttemptId','quantity','priceMinor','subtotalMinor','taxMinor','taxRateBasisPoints','taxRegion','amountMinor','currency','workshopTitle','advertisingLine','startAt','timezone','venueName','locality','region'], 'The existing checkout contract is complete';
  perform public.attach_workshop_stripe_checkout((v_attempt->>'paymentAttemptId')::uuid,'cs_external_checkout_regression',gen_random_uuid());
  perform public.reconcile_workshop_stripe_event(
    'evt_external_checkout_regression','checkout.session.completed','cs_external_checkout_regression',
    'checkout.session',now(),now(),repeat('a',64),(v_attempt->>'paymentAttemptId')::uuid,
    'pi_external_checkout_regression',5350,'USD',gen_random_uuid()
  );
  assert (select status='confirmed' and payment_state='paid' from public.workshop_bookings where workshop_booking_id=(v_hold->>'bookingId')::uuid), 'Existing Stripe reconciliation confirms payment and seats';
  assert exists(select 1 from public.workshop_message_queue where workshop_booking_id=(v_hold->>'bookingId')::uuid and communication_type='booking_confirmation'), 'Existing confirmation trigger is preserved';

  -- After the old payment is settled, staff can change providers without losing
  -- history. Replaying the prior checkout command must not reopen Stripe.
  perform public.save_workshop_occurrence(v_draft || jsonb_build_object(
    'workshopOccurrenceId',v_stripe_id,'externalCheckoutUrl','https://venue.example/tickets'
  ),gen_random_uuid());
  v_denied := false;
  begin
    perform public.switch_workshop_payment_method(repeat('s',64),'stripe',v_payment_command,30);
  exception when sqlstate '55000' then v_denied := true;
  end;
  assert v_denied, 'Previous checkout commands cannot reopen Stripe for venue events';
  assert (select count(*)=1 from public.workshop_payment_transactions where provider_transaction_id='pi_external_checkout_regression'), 'Changing providers preserves recorded payment history';
  perform public.save_workshop_occurrence(v_draft || jsonb_build_object('workshopOccurrenceId',v_stripe_id,'externalCheckoutUrl',null),gen_random_uuid());
  assert (select external_checkout_url is null and stripe_enabled from public.workshop_occurrences where workshop_occurrence_id=v_stripe_id), 'Clearing the override restores Stripe';

  assert has_function_privilege('service_role','public.create_workshop_seat_hold(text,integer,text,text,text,integer,text,uuid,integer)','EXECUTE'), 'Existing booking service retains hold access';
  assert has_function_privilege('service_role','public.switch_workshop_payment_method(text,text,uuid,integer)','EXECUTE'), 'Existing booking service retains checkout access';
  assert not has_function_privilege('anon','public.create_workshop_seat_hold(text,integer,text,text,text,integer,text,uuid,integer)','EXECUTE'), 'Customers cannot bypass the booking service';

  -- The override does not bypass staff authorization.
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  v_denied := false;
  begin
    perform public.save_workshop_occurrence(v_draft,gen_random_uuid());
  exception when insufficient_privilege then v_denied := true;
  end;
  assert v_denied, 'Unauthenticated visitors cannot set venue URLs';
end;
$$;

select pass('external checkout commands, inventory, manual booking, URL validation, provider transitions, and default Stripe behavior');
select * from finish();
rollback;
