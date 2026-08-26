create or replace function public.manage_workshop_refund_order(
  p_action text,
  p_payload jsonb,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_charge public.workshop_payment_transactions;
  v_transaction public.workshop_payment_transactions;
  v_request public.workshop_refund_requests;
  v_booking public.workshop_bookings;
  v_result jsonb;
  v_amount bigint;
  v_consumed bigint;
  v_remaining bigint;
  v_pending_seats bigint;
  v_seat_quantity integer;
  v_reason text;
  v_reference text;
begin
  if p_command_key is null or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
  then
    raise exception 'invalid_request';
  end if;
  if not public.is_internal_crm_user() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into v_charge from public.workshop_payment_transactions
  where workshop_payment_transaction_id =
    nullif(p_payload->>'transactionId', '')::uuid
  for update;
  if not found or v_charge.transaction_type <> 'charge'
    or v_charge.provider not in ('stripe', 'direct_venmo')
    or v_charge.state not in ('paid', 'partially_refunded')
    or v_charge.provider_transaction_id is null
  then
    raise exception 'refund_not_eligible' using errcode = 'P0001';
  end if;

  if v_charge.provider = 'stripe' then
    select coalesce(sum(amount_minor), 0) into v_consumed
    from public.workshop_refund_requests
    where workshop_payment_transaction_id = v_charge.workshop_payment_transaction_id
      and state in ('requested', 'provider_accepted', 'reconciled');
  else
    select coalesce(sum(amount_minor), 0) into v_consumed
    from public.workshop_payment_transactions
    where transaction_type = 'external_refund' and state = 'refunded'
      and normalized_facts->>'originalTransactionId' =
        v_charge.workshop_payment_transaction_id::text;
  end if;
  v_remaining := greatest(v_charge.amount_minor - v_consumed, 0);

  if p_action = 'eligibility' then
    if v_charge.provider = 'stripe' then
      select * into v_request from public.workshop_refund_requests
      where command_key = p_command_key;
    end if;
    return jsonb_build_object(
      'eligible', v_remaining > 0
        or v_request.workshop_refund_request_id is not null,
      'transactionId', v_charge.workshop_payment_transaction_id,
      'currency', v_charge.currency,
      'provider', v_charge.provider,
      'remainingRefundableMinor', case
        when v_request.workshop_refund_request_id is not null
          then v_request.amount_minor else v_remaining end,
      'providerChargeId', v_charge.provider_transaction_id,
      'bookingId', v_charge.workshop_booking_id,
      'occurrenceId', v_charge.workshop_occurrence_id
    );
  end if;

  v_amount := nullif(p_payload->>'amountMinor', '')::bigint;
  v_seat_quantity := nullif(p_payload->>'seatQuantity', '')::integer;
  v_reason := btrim(coalesce(p_payload->>'reason', ''));

  if p_action = 'request_stripe' then
    if v_charge.provider <> 'stripe' then
      raise exception 'refund_not_eligible' using errcode = 'P0001';
    end if;
    select * into v_request from public.workshop_refund_requests
    where command_key = p_command_key;
    if found then
      return jsonb_build_object(
        'replayed', true,
        'requestId', v_request.workshop_refund_request_id,
        'state', v_request.state,
        'amountMinor', v_request.amount_minor,
        'seatQuantity', v_request.seat_quantity,
        'currency', v_request.currency,
        'providerChargeId', v_charge.provider_transaction_id,
        'paymentAttemptId', v_charge.workshop_payment_attempt_id,
        'remainingRefundableMinor', v_remaining
      );
    end if;
    select * into v_booking from public.workshop_bookings
    where workshop_booking_id = v_charge.workshop_booking_id for update;
    select coalesce(sum(seat_quantity), 0) into v_pending_seats
    from public.workshop_refund_requests
    where workshop_booking_id = v_charge.workshop_booking_id
      and seat_quantity is not null
      and state in ('requested', 'provider_accepted');
    if v_remaining <= 0 or v_amount is null or v_amount <= 0
      or v_amount > v_remaining or v_seat_quantity is null
      or v_seat_quantity <= 0
      or v_seat_quantity > v_booking.active_quantity - v_pending_seats
      or v_amount <> v_seat_quantity * v_booking.price_per_seat_minor_snapshot
      or upper(btrim(coalesce(p_payload->>'currency', ''))) <> v_charge.currency
      or v_reason not in (
        'customer_requested','duplicate','fraudulent','event_cancelled','other'
      )
    then
      raise exception 'refund_not_eligible' using errcode = 'P0001';
    end if;
    v_result := public.manage_workshop_financials(
      'request_refund',
      jsonb_build_object(
        'transactionId', v_charge.workshop_payment_transaction_id,
        'amountMinor', v_amount,
        'currency', v_charge.currency,
        'reason', v_reason
      ),
      p_command_key
    );
    update public.workshop_refund_requests set seat_quantity = v_seat_quantity
    where command_key = p_command_key returning * into v_request;
    return v_result || jsonb_build_object(
      'seatQuantity', v_request.seat_quantity,
      'paymentAttemptId', v_charge.workshop_payment_attempt_id
    );
  end if;

  if p_action = 'record_venmo' then
    if v_charge.provider <> 'direct_venmo' then
      raise exception 'refund_not_eligible' using errcode = 'P0001';
    end if;
    select * into v_transaction from public.workshop_payment_transactions
    where command_key = p_command_key;
    if found then
      return jsonb_build_object(
        'replayed', true,
        'transactionId', v_transaction.workshop_payment_transaction_id,
        'state', v_transaction.state
      );
    end if;
    select * into v_booking from public.workshop_bookings
    where workshop_booking_id = v_charge.workshop_booking_id for update;
    v_reference := btrim(coalesce(p_payload->>'reference', ''));
    if v_remaining <= 0 or v_amount is null or v_amount <= 0
      or v_amount > v_remaining or v_seat_quantity is null
      or v_seat_quantity <= 0 or v_seat_quantity > v_booking.active_quantity
      or v_amount <> v_seat_quantity * v_booking.price_per_seat_minor_snapshot
      or upper(btrim(coalesce(p_payload->>'currency', ''))) <> v_charge.currency
      or v_reference = ''
      or v_reason not in (
        'customer_requested','duplicate','fraudulent','event_cancelled','other'
      )
    then
      raise exception 'refund_not_eligible' using errcode = 'P0001';
    end if;
    v_result := public.manage_workshop_financials(
      'record_external_refund',
      p_payload - 'seatQuantity',
      p_command_key
    );
    perform public.apply_workshop_refund_seat_release(
      v_charge.workshop_booking_id,
      v_seat_quantity,
      v_amount,
      'Direct Venmo refund confirmed: ' || v_reference,
      p_command_key,
      'internal',
      v_actor
    );
    select coalesce(sum(amount_minor), 0) into v_consumed
    from public.workshop_payment_transactions
    where transaction_type = 'external_refund' and state = 'refunded'
      and normalized_facts->>'originalTransactionId' =
        v_charge.workshop_payment_transaction_id::text;
    update public.workshop_bookings
    set payment_state = case
      when v_consumed >= v_charge.amount_minor then 'refunded'
      else 'partially_refunded'
    end
    where workshop_booking_id = v_charge.workshop_booking_id;
    return v_result || jsonb_build_object(
      'seatQuantity', v_seat_quantity,
      'activeQuantity', v_booking.active_quantity - v_seat_quantity
    );
  end if;

  raise exception 'unsupported action' using errcode = '22023';
end;
$$;

revoke all on function public.manage_workshop_refund_order(text,jsonb,uuid)
from public, anon;
grant execute on function public.manage_workshop_refund_order(text,jsonb,uuid)
to authenticated;

create or replace function public.release_reconciled_workshop_refund_seats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.state = 'reconciled' and old.state is distinct from new.state
    and new.seat_quantity is not null and new.seats_released_at is null
  then
    perform public.apply_workshop_refund_seat_release(
      new.workshop_booking_id,
      new.seat_quantity,
      new.amount_minor,
      'Stripe refund confirmed',
      new.workshop_refund_request_id,
      'provider',
      null
    );
    new.seats_released_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.release_reconciled_workshop_refund_seats()
from public, anon, authenticated;

create trigger trg_workshop_refund_requests_release_seats
before update of state on public.workshop_refund_requests
for each row execute function public.release_reconciled_workshop_refund_seats();
