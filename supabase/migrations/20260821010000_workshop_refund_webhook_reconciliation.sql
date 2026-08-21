create or replace function public.mark_workshop_refund_provider_failed(
  p_refund_request_id uuid,
  p_provider_refund_id text,
  p_safe_failure text,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.workshop_refund_requests;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user <> 'postgres' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_refund_request_id is null or p_command_key is null
    or btrim(coalesce(p_provider_refund_id, '')) = ''
  then
    raise exception 'invalid_request';
  end if;

  select * into v_request from public.workshop_refund_requests
  where workshop_refund_request_id = p_refund_request_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_request.state = 'provider_failed' then
    return jsonb_build_object(
      'replayed', true, 'requestId', p_refund_request_id,
      'state', v_request.state
    );
  end if;
  if v_request.state not in ('requested', 'provider_accepted') then
    raise exception 'invalid_transition';
  end if;

  update public.workshop_refund_requests set
    state = 'provider_failed',
    provider_refund_id = coalesce(
      provider_refund_id, btrim(p_provider_refund_id)
    ),
    safe_failure = left(
      btrim(coalesce(p_safe_failure, 'provider_reported_failed')), 160
    )
  where workshop_refund_request_id = p_refund_request_id
  returning * into v_request;

  insert into public.workshop_payment_exceptions(
    workshop_booking_id, workshop_occurrence_id,
    workshop_payment_transaction_id, exception_type, urgency, amount_minor,
    currency, summary, safe_detail, command_key
  ) values (
    v_request.workshop_booking_id, v_request.workshop_occurrence_id,
    v_request.workshop_payment_transaction_id, 'refund_provider_failure',
    'urgent', v_request.amount_minor, v_request.currency,
    'Stripe reported that the workshop refund failed.',
    'Review the failed refund before trying again.', p_command_key
  );

  return jsonb_build_object(
    'replayed', false, 'requestId', p_refund_request_id,
    'state', v_request.state
  );
end;
$$;

revoke all on function public.mark_workshop_refund_provider_failed(
  uuid,text,text,uuid
) from public, anon, authenticated;
grant execute on function public.mark_workshop_refund_provider_failed(
  uuid,text,text,uuid
) to service_role;

create or replace function public.reconcile_workshop_refund_request(
  p_refund_request_id uuid,
  p_provider_refund_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.workshop_refund_requests;
  v_charge public.workshop_payment_transactions;
  v_refund public.workshop_payment_transactions;
  v_consumed bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user <> 'postgres' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_refund_request_id is null
    or btrim(coalesce(p_provider_refund_id, '')) = ''
  then
    raise exception 'invalid_request';
  end if;

  select * into v_request from public.workshop_refund_requests
  where workshop_refund_request_id = p_refund_request_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_request.provider_refund_id is not null
    and v_request.provider_refund_id <> btrim(p_provider_refund_id)
  then
    raise exception 'provider_reference_mismatch';
  end if;
  if v_request.state = 'reconciled' then
    return jsonb_build_object(
      'replayed', true, 'requestId', p_refund_request_id,
      'state', v_request.state
    );
  end if;
  if v_request.state not in ('requested', 'provider_accepted') then
    raise exception 'invalid_transition';
  end if;

  select * into v_charge from public.workshop_payment_transactions
  where workshop_payment_transaction_id =
    v_request.workshop_payment_transaction_id;
  select * into v_refund from public.workshop_payment_transactions
  where provider = 'stripe' and transaction_type = 'refund'
    and state = 'refunded'
    and provider_transaction_id = btrim(p_provider_refund_id)
    and normalized_facts->>'originalTransactionId' =
      v_charge.workshop_payment_transaction_id::text;
  if not found or v_refund.amount_minor <> v_request.amount_minor then
    raise exception 'refund_evidence_not_found';
  end if;

  update public.workshop_refund_requests set
    state = 'reconciled',
    provider_refund_id = coalesce(
      provider_refund_id, btrim(p_provider_refund_id)
    ),
    reconciled_at = coalesce(reconciled_at, now())
  where workshop_refund_request_id = p_refund_request_id
  returning * into v_request;

  select coalesce(sum(amount_minor), 0) into v_consumed
  from public.workshop_payment_transactions
  where transaction_type in ('refund', 'external_refund')
    and state = 'refunded'
    and normalized_facts->>'originalTransactionId' =
      v_charge.workshop_payment_transaction_id::text;
  update public.workshop_bookings set payment_state = case
    when v_consumed >= v_charge.amount_minor then 'refunded'
    else 'partially_refunded'
  end
  where workshop_booking_id = v_charge.workshop_booking_id;

  return jsonb_build_object(
    'replayed', false, 'requestId', p_refund_request_id,
    'state', v_request.state
  );
end;
$$;

revoke all on function public.reconcile_workshop_refund_request(uuid,text)
from public, anon, authenticated;
grant execute on function public.reconcile_workshop_refund_request(uuid,text)
to service_role;
