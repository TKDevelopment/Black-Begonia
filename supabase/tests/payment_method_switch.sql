-- Run after 20260926030000_payment_method_switch.sql in an isolated database.
begin;
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  v_project_id uuid := gen_random_uuid();
  v_contact_id uuid := gen_random_uuid();
  v_obligation_id uuid := gen_random_uuid();
  v_request_id uuid;
  v_attempt_id uuid := gen_random_uuid();
  v_service_type public.service_type;
  v_cash jsonb;
  v_check jsonb;
  v_venmo jsonb;
  v_repeat jsonb;
  v_projection jsonb;
begin
  select enumlabel::public.service_type into v_service_type
  from pg_enum where enumtypid='public.service_type'::regtype order by enumsortorder limit 1;
  insert into public.projects(project_id,project_name,service_type,status,event_date)
  values(v_project_id,'Payment method switch test',v_service_type,'booked',current_date+90);
  insert into public.contacts(contact_id,first_name,last_name,email)
  values(v_contact_id,'Test','Customer','method-switch@example.com');
  insert into public.project_contacts(project_id,contact_id,relationship_type,is_primary)
  values(v_project_id,v_contact_id,'client',true);
  insert into public.payment_collection_settings(
    settings_id,collection_enabled,venmo_enabled,venmo_business_target
  ) values(true,true,true,'https://account.venmo.com/u/blackbegoniaflorist')
  on conflict(settings_id) do update set collection_enabled=true,
    venmo_enabled=true,venmo_business_target='https://account.venmo.com/u/blackbegoniaflorist';
  insert into public.project_payment_records(
    project_payment_record_id,project_id,payment_kind,status,amount_due,amount_paid,
    due_date,target_amount,credited_principal,outstanding_amount,fulfillment_state
  ) values(v_obligation_id,v_project_id,'deposit','due',100,0,current_date,100,0,100,'due');
  v_request_id := (public.issue_payment_request(
    array[v_obligation_id],10000,'installment','switch-digest-'||gen_random_uuid(),
    'ciphertext','iv','v1',gen_random_uuid()
  )->>'paymentRequestId')::uuid;

  v_projection := public.resolve_payment_request_projection(
    (select token_digest from public.payment_requests where payment_request_id=v_request_id)
  );
  if not (v_projection->'methods' ? 'venmo') then
    raise exception 'Valid Venmo business profile was not offered';
  end if;
  v_cash := public.record_payment_intention(
    (select token_digest from public.payment_requests where payment_request_id=v_request_id),
    'cash','cash-command'
  );
  v_check := public.record_payment_intention(
    (select token_digest from public.payment_requests where payment_request_id=v_request_id),
    'check','check-command'
  );
  if v_cash->>'payment_intention_id'=v_check->>'payment_intention_id'
    or v_check->>'method'<>'check'
    or v_check->>'pause_ends_at'<>v_cash->>'pause_ends_at'
    or (select state from public.payment_intentions
      where payment_intention_id=(v_cash->>'payment_intention_id')::uuid)<>'expired' then
    raise exception 'Switching cash to check did not replace the choice without extending the pause';
  end if;
  v_venmo := public.record_payment_intention(
    (select token_digest from public.payment_requests where payment_request_id=v_request_id),
    'venmo_business_profile','venmo-command'
  );
  v_repeat := public.record_payment_intention(
    (select token_digest from public.payment_requests where payment_request_id=v_request_id),
    'venmo_business_profile','venmo-repeat-command'
  );
  if v_venmo->>'method'<>'venmo_business_profile'
    or v_venmo->>'instruction_snapshot'<>'https://account.venmo.com/u/blackbegoniaflorist'
    or v_venmo->>'pause_ends_at'<>v_cash->>'pause_ends_at'
    or v_repeat->>'payment_intention_id'<>v_venmo->>'payment_intention_id'
    or (v_repeat->>'amount_cents')::bigint<>10000 then
    raise exception 'Venmo choice or repeat selection changed the reminder pause or amount';
  end if;

  update public.payment_collection_settings
  set venmo_business_target='https://example.com/unsupported'
  where settings_id;
  v_projection := public.resolve_payment_request_projection(
    (select token_digest from public.payment_requests where payment_request_id=v_request_id)
  );
  if v_projection->'methods' ? 'venmo' then
    raise exception 'An invalid Venmo target remained available to the customer';
  end if;
  begin
    perform public.record_payment_intention(
      (select token_digest from public.payment_requests where payment_request_id=v_request_id),
      'venmo_business_profile','invalid-venmo-command'
    );
    raise exception 'Invalid Venmo target was accepted';
  exception when others then
    if sqlerrm<>'Provider unavailable' then raise; end if;
  end;

  insert into public.payment_checkout_attempts(
    payment_checkout_attempt_id,payment_request_id,project_id,method,status,
    principal_amount,charge_amount,create_idempotency_key,expires_at
  ) values (
    v_attempt_id,v_request_id,v_project_id,'stripe_card','active',100,100,
    'switch-attempt-'||gen_random_uuid(),now()+interval '30 minutes'
  );
  begin
    perform public.record_payment_intention(
      (select token_digest from public.payment_requests where payment_request_id=v_request_id),
      'cash','locked-cash-command'
    );
    raise exception 'A live card checkout allowed a manual method';
  exception when others then
    if sqlerrm<>'PAYMENT_METHOD_LOCKED' then raise; end if;
  end;
  update public.payment_checkout_attempts set status='canceled',canceled_at=now()
  where payment_checkout_attempt_id=v_attempt_id;
  v_cash := public.record_payment_intention(
    (select token_digest from public.payment_requests where payment_request_id=v_request_id),
    'cash','released-cash-command'
  );
  if v_cash->>'method'<>'cash' then
    raise exception 'The customer could not choose cash after checkout cancellation';
  end if;
end $$;

rollback;
