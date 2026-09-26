-- Run after 20260926020000_installment_payment_email.sql in an isolated database.
begin;
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  v_project_id uuid := gen_random_uuid();
  v_contact_id uuid := gen_random_uuid();
  v_deposit_id uuid := gen_random_uuid();
  v_final_id uuid := gen_random_uuid();
  v_revision_id uuid := gen_random_uuid();
  v_first_id uuid;
  v_second_id uuid;
  v_replacement_id uuid;
  v_delivery_id uuid;
  v_claim jsonb;
  v_projection jsonb;
  v_service_type public.service_type;
begin
  select enumlabel::public.service_type into v_service_type
  from pg_enum where enumtypid='public.service_type'::regtype order by enumsortorder limit 1;
  insert into public.projects(project_id,project_name,service_type,status,event_date)
  values(v_project_id,'Installment email test',v_service_type,'booked',current_date+50);
  insert into public.contacts(contact_id,first_name,last_name,email)
  values(v_contact_id,'Test','Customer','installment-test@example.com');
  insert into public.project_contacts(project_id,contact_id,relationship_type,is_primary)
  values(v_project_id,v_contact_id,'client',true);
  insert into public.payment_collection_settings(settings_id) values(true)
  on conflict(settings_id) do nothing;
  insert into public.project_payment_records(
    project_payment_record_id,project_id,payment_kind,status,amount_due,amount_paid,
    due_date,target_amount,credited_principal,outstanding_amount,fulfillment_state
  ) values
    (v_deposit_id,v_project_id,'deposit','due',100,0,current_date,100,0,100,'due'),
    (v_final_id,v_project_id,'final_payment','due',30,0,current_date,30,0,30,'due'),
    (v_revision_id,v_project_id,'revision_balance','partially_paid',75,25,current_date,75,25,50,'partially_paid');

  v_first_id := (public.issue_payment_request(
    array[v_deposit_id],10000,'installment','digest-'||gen_random_uuid(),
    'ciphertext','iv','v1',gen_random_uuid()
  )->>'paymentRequestId')::uuid;
  v_second_id := (public.issue_payment_request(
    array[v_revision_id],5000,'installment','digest-'||gen_random_uuid(),
    'ciphertext','iv','v1',gen_random_uuid()
  )->>'paymentRequestId')::uuid;
  if (select count(*) from public.payment_requests
      where project_id=v_project_id and status='active' and request_kind='installment') <> 2 then
    raise exception 'Independent installment requests did not remain active';
  end if;
  v_projection := public.activate_project_final_collection(v_project_id);
  if v_projection->>'kind' <> 'final_payment'
    or (v_projection->>'principalCents')::bigint <> 3000 then
    raise exception 'Final collection did not exclude the separately requested deposit';
  end if;
  if (select count(*) from public.payment_request_obligations
      where payment_request_id=v_second_id and obligation_id=v_revision_id and requested_amount=50) <> 1 then
    raise exception 'Revision payment request did not target only its outstanding installment';
  end if;

  select payment_message_delivery_id into v_delivery_id
  from public.payment_message_deliveries where payment_request_id=v_second_id and delivery_kind='initial_request';
  v_claim := public.claim_specific_payment_delivery(v_delivery_id);
  if v_claim->>'kind' <> 'initial_request' or v_claim->>'requestKind' <> 'installment'
    or v_claim->>'tokenCiphertext' <> 'ciphertext' then
    raise exception 'Installment email claim omitted its secure request context';
  end if;
  v_projection := public.resolve_payment_request_projection(
    (select token_digest from public.payment_requests where payment_request_id=v_second_id)
  );
  if v_projection->>'state' <> 'active' or v_projection->>'purpose' <> 'installment'
    or (v_projection->>'principalCents')::bigint <> 5000 then
    raise exception 'Installment checkout did not show its own amount';
  end if;

  begin
    perform public.issue_payment_request(
      array[v_revision_id],7500,'installment','digest-'||gen_random_uuid(),
      'ciphertext','iv','v1',gen_random_uuid()
    );
    raise exception 'A request for more than the outstanding installment was accepted';
  exception when others then
    if sqlerrm <> 'Obligations or amount are unavailable' then raise; end if;
  end;

  v_replacement_id := (public.issue_payment_request(
    array[v_deposit_id],10000,'installment','digest-'||gen_random_uuid(),
    'ciphertext','iv','v1',gen_random_uuid()
  )->>'paymentRequestId')::uuid;
  if v_replacement_id=v_first_id
    or (select status from public.payment_requests where payment_request_id=v_first_id)<>'superseded'
    or (select status from public.payment_requests where payment_request_id=v_second_id)<>'active' then
    raise exception 'Resending one installment invalidated the wrong checkout link';
  end if;

  insert into public.payment_checkout_attempts(
    payment_request_id,project_id,method,status,principal_amount,charge_amount,
    create_idempotency_key,expires_at
  ) values (
    v_second_id,v_project_id,'stripe_card','active',50,50,
    'installment-fixture-'||gen_random_uuid(),now()+interval '30 minutes'
  );
  begin
    perform public.issue_payment_request(
      array[v_revision_id],5000,'installment','digest-'||gen_random_uuid(),
      'ciphertext','iv','v1',gen_random_uuid()
    );
    raise exception 'An active checkout was replaced';
  exception when others then
    if sqlerrm <> 'A checkout is already processing for this installment' then raise; end if;
  end;
  update public.payment_checkout_attempts set status='expired',resolved_at=now()
  where payment_request_id=v_second_id;

  update public.project_payment_records set outstanding_amount=40
  where project_payment_record_id=v_revision_id;
  v_projection := public.resolve_payment_request_projection(
    (select token_digest from public.payment_requests where payment_request_id=v_second_id)
  );
  if v_projection->>'state' <> 'unavailable' then
    raise exception 'A stale installment checkout remained payable after the balance changed';
  end if;
end $$;

rollback;
