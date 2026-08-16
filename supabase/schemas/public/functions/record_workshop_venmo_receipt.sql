create or replace function public.record_workshop_venmo_receipt(
  p_reference text,
  p_provider_payment_id text,
  p_amount_minor bigint,
  p_currency text,
  p_occurred_at timestamptz,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.workshop_payment_attempts;
  v_booking public.workshop_bookings;
  v_hold public.workshop_seat_holds;
  v_occurrence public.workshop_occurrences;
  v_transaction public.workshop_payment_transactions;
  v_reserved bigint;
  v_exception_type text;
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and session_user <> 'postgres'
    and not public.is_internal_crm_user()
  then
    raise exception 'not authorized';
  end if;

  if char_length(btrim(coalesce(p_reference, ''))) = 0
    or char_length(btrim(coalesce(p_provider_payment_id, ''))) = 0
    or p_amount_minor <= 0
    or p_currency <> 'USD'
    or p_occurred_at is null
  then
    raise exception 'invalid_request';
  end if;

  select * into v_transaction
  from public.workshop_payment_transactions
  where command_key = p_command_key
     or (
       provider = 'direct_venmo'
       and provider_transaction_id = p_provider_payment_id
       and transaction_type = 'charge'
     );

  if found then
    return jsonb_build_object(
      'replayed', true,
      'state', v_transaction.state,
      'transactionId', v_transaction.workshop_payment_transaction_id
    );
  end if;

  select * into v_attempt
  from public.workshop_payment_attempts
  where provider = 'direct_venmo'
    and reconciliation_reference = p_reference
  order by created_at desc
  limit 1
  for update;

  if not found then
    insert into public.workshop_payment_exceptions (
      workshop_occurrence_id,
      exception_type,
      urgency,
      amount_minor,
      currency,
      summary,
      safe_detail,
      command_key
    ) values (
      null,
      'missing_reference',
      'urgent',
      p_amount_minor,
      p_currency,
      'Direct Venmo receipt could not be matched to a workshop booking.',
      'Review the supplied reconciliation reference.',
      p_command_key
    );
    return jsonb_build_object('replayed', false, 'state', 'unmatched');
  end if;

  select * into v_booking from public.workshop_bookings
  where workshop_booking_id = v_attempt.workshop_booking_id for update;
  select * into v_hold from public.workshop_seat_holds
  where workshop_seat_hold_id = v_attempt.workshop_seat_hold_id for update;
  select * into v_occurrence from public.workshop_occurrences
  where workshop_occurrence_id = v_booking.workshop_occurrence_id for update;

  if p_amount_minor < v_attempt.amount_minor then
    v_exception_type := 'underpayment';
  elsif p_amount_minor > v_attempt.amount_minor then
    v_exception_type := 'overpayment';
  elsif v_attempt.state = 'superseded' then
    v_exception_type := 'superseded_payment';
  elsif v_attempt.state = 'paid' or v_booking.payment_state = 'paid' then
    v_exception_type := 'duplicate_payment';
  elsif v_booking.status = 'cancelled'
    or (
      v_booking.status = 'expired'
      and not (
        v_attempt.state = 'expired'
        and v_hold.state = 'expired'
        and p_occurred_at <= v_attempt.effective_expires_at
      )
    )
  then
    v_exception_type := 'cancellation_race';
  elsif p_occurred_at > v_attempt.effective_expires_at then
    v_exception_type := 'late_payment';
  end if;

  if v_exception_type is null and v_hold.state = 'expired' then
    select coalesce(sum(h.quantity), 0) into v_reserved
    from public.workshop_seat_holds h
    where h.workshop_occurrence_id = v_occurrence.workshop_occurrence_id
      and h.workshop_seat_hold_id <> v_hold.workshop_seat_hold_id
      and (
        h.state = 'confirmed'
        or (h.state = 'active' and h.effective_expires_at > now())
      );
    if v_reserved + v_hold.quantity > v_occurrence.capacity then
      v_exception_type := 'late_capacity_conflict';
    end if;
  elsif v_exception_type is null and v_hold.state not in ('active', 'expired') then
    v_exception_type := 'capacity_unavailable';
  end if;

  insert into public.workshop_payment_transactions (
    workshop_booking_id,
    workshop_occurrence_id,
    workshop_payment_attempt_id,
    transaction_type,
    provider,
    provider_transaction_id,
    payment_reference,
    amount_minor,
    currency,
    occurred_at,
    state,
    command_key,
    normalized_facts
  ) values (
    v_booking.workshop_booking_id,
    v_occurrence.workshop_occurrence_id,
    v_attempt.workshop_payment_attempt_id,
    'charge',
    'direct_venmo',
    p_provider_payment_id,
    'VENMO-' || p_provider_payment_id,
    p_amount_minor,
    p_currency,
    p_occurred_at,
    case when v_exception_type is null then 'paid' else 'exception' end,
    p_command_key,
    jsonb_build_object('reconciliationReference', p_reference)
  )
  returning * into v_transaction;

  if v_exception_type is null then
    update public.workshop_payment_attempts
    set state = 'paid',
        provider_payment_id = p_provider_payment_id,
        resolved_at = now()
    where workshop_payment_attempt_id = v_attempt.workshop_payment_attempt_id;
    update public.workshop_seat_holds
    set state = 'confirmed',
        resolved_at = now(),
        resolution_reason = 'confirmed_direct_venmo_payment'
    where workshop_seat_hold_id = v_hold.workshop_seat_hold_id;
    update public.workshop_bookings
    set status = 'confirmed',
        payment_state = 'paid',
        payment_method = 'direct_venmo',
        confirmed_at = coalesce(confirmed_at, p_occurred_at)
    where workshop_booking_id = v_booking.workshop_booking_id;
  else
    update public.workshop_bookings
    set payment_state = 'exception'
    where workshop_booking_id = v_booking.workshop_booking_id
      and payment_state <> 'paid';
    insert into public.workshop_payment_exceptions (
      workshop_booking_id,
      workshop_occurrence_id,
      workshop_payment_attempt_id,
      workshop_payment_transaction_id,
      exception_type,
      urgency,
      amount_minor,
      currency,
      summary,
      safe_detail,
      command_key
    ) values (
      v_booking.workshop_booking_id,
      v_occurrence.workshop_occurrence_id,
      v_attempt.workshop_payment_attempt_id,
      v_transaction.workshop_payment_transaction_id,
      v_exception_type,
      'urgent',
      p_amount_minor,
      p_currency,
      'Direct Venmo payment requires manual workshop reconciliation.',
      'The receipt was recorded without changing workshop capacity.',
      p_command_key
    );
  end if;

  return jsonb_build_object(
    'replayed', false,
    'state', case when v_exception_type is null then 'confirmed' else 'exception' end,
    'exceptionType', v_exception_type,
    'bookingId', v_booking.workshop_booking_id,
    'transactionId', v_transaction.workshop_payment_transaction_id
  );
end;
$$;

revoke all on function public.record_workshop_venmo_receipt(
  text, text, bigint, text, timestamptz, uuid
) from public;
grant execute on function public.record_workshop_venmo_receipt(
  text, text, bigint, text, timestamptz, uuid
) to service_role, authenticated;
