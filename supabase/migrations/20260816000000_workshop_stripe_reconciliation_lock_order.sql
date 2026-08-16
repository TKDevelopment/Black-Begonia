-- Prevent concurrent Stripe success variants from deadlocking while
-- reconciling the same workshop payment attempt.
create or replace function public.reconcile_workshop_stripe_event(
  p_provider_event_id text,
  p_event_type text,
  p_provider_object_id text,
  p_provider_object_type text,
  p_event_occurred_at timestamptz,
  p_signature_verified_at timestamptz,
  p_payload_digest text,
  p_payment_attempt_id uuid,
  p_provider_payment_id text,
  p_amount_minor bigint,
  p_currency text,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.workshop_payment_provider_events;
  v_prior_event public.workshop_payment_provider_events;
  v_attempt public.workshop_payment_attempts;
  v_booking public.workshop_bookings;
  v_hold public.workshop_seat_holds;
  v_occurrence public.workshop_occurrences;
  v_transaction public.workshop_payment_transactions;
  v_attempt_found boolean;
  v_reserved bigint;
  v_exception_type text;
begin
  if char_length(btrim(coalesce(p_provider_event_id, ''))) = 0
    or char_length(btrim(coalesce(p_payload_digest, ''))) < 32
    or p_signature_verified_at is null
    or p_event_occurred_at is null
    or p_amount_minor < 0
    or p_currency <> 'USD'
  then
    raise exception 'invalid_request';
  end if;

  select * into v_event
  from public.workshop_payment_provider_events
  where provider = 'stripe'
    and provider_event_id = p_provider_event_id;

  if found then
    return jsonb_build_object(
      'replayed', true,
      'state', v_event.processing_state,
      'providerEventId', v_event.workshop_payment_provider_event_id
    );
  end if;

  -- Serialize every event for an existing attempt before inserting provider
  -- evidence. The evidence row's foreign key otherwise takes a KEY SHARE lock
  -- first, and concurrent calls can deadlock while upgrading that lock to
  -- FOR UPDATE on the same attempt. No key column is changed by reconciliation,
  -- so NO KEY UPDATE is the narrow lock required by the later state updates.
  select * into v_attempt
  from public.workshop_payment_attempts
  where workshop_payment_attempt_id = p_payment_attempt_id
  for no key update;
  v_attempt_found := found;

  insert into public.workshop_payment_provider_events (
    provider,
    provider_event_id,
    provider_object_id,
    provider_object_type,
    event_type,
    event_occurred_at,
    signature_verified_at,
    payload_digest,
    normalized_facts,
    processing_state,
    workshop_payment_attempt_id
  ) values (
    'stripe',
    p_provider_event_id,
    nullif(btrim(coalesce(p_provider_object_id, '')), ''),
    nullif(btrim(coalesce(p_provider_object_type, '')), ''),
    p_event_type,
    p_event_occurred_at,
    p_signature_verified_at,
    p_payload_digest,
    jsonb_build_object(
      'amountMinor', p_amount_minor,
      'currency', p_currency,
      'providerPaymentId', p_provider_payment_id,
      'requestedPaymentAttemptId', p_payment_attempt_id
    ),
    'received',
    case
      when v_attempt_found then v_attempt.workshop_payment_attempt_id
      else null
    end
  )
  on conflict (provider, provider_event_id) do nothing
  returning * into v_event;

  -- A simultaneous replay may have passed the fast-path lookup before the
  -- winning transaction committed. Treat the conflict as a replay after the
  -- attempt-level serialization point instead of surfacing a uniqueness 500.
  if not found then
    select * into v_event
    from public.workshop_payment_provider_events
    where provider = 'stripe'
      and provider_event_id = p_provider_event_id;

    return jsonb_build_object(
      'replayed', true,
      'state', v_event.processing_state,
      'providerEventId', v_event.workshop_payment_provider_event_id
    );
  end if;

  select * into v_prior_event
  from public.workshop_payment_provider_events
  where provider = 'stripe'
    and provider_object_id = p_provider_object_id
    and event_type = p_event_type
    and processing_state = 'processed'
    and workshop_payment_provider_event_id <> v_event.workshop_payment_provider_event_id
  limit 1;

  if found then
    update public.workshop_payment_provider_events
    set processing_state = 'duplicate',
        processed_at = now()
    where workshop_payment_provider_event_id = v_event.workshop_payment_provider_event_id;

    return jsonb_build_object(
      'replayed', true,
      'state', 'duplicate',
      'providerEventId', v_event.workshop_payment_provider_event_id
    );
  end if;

  if not v_attempt_found then
    update public.workshop_payment_provider_events
    set processing_state = 'unmatched',
        processing_error = 'payment_attempt_unavailable',
        processed_at = now()
    where workshop_payment_provider_event_id = v_event.workshop_payment_provider_event_id;

    insert into public.workshop_payment_exceptions (
      workshop_occurrence_id,
      exception_type,
      urgency,
      amount_minor,
      currency,
      summary,
      safe_detail,
      provider_event_id,
      command_key
    ) values (
      null,
      'unmatched_payment',
      'urgent',
      p_amount_minor,
      p_currency,
      'Stripe money could not be matched to a workshop payment attempt.',
      'Review the provider event and workshop payment metadata.',
      v_event.workshop_payment_provider_event_id,
      p_command_key
    );

    return jsonb_build_object('replayed', false, 'state', 'unmatched');
  end if;

  select * into v_booking
  from public.workshop_bookings
  where workshop_booking_id = v_attempt.workshop_booking_id
  for update;
  select * into v_hold
  from public.workshop_seat_holds
  where workshop_seat_hold_id = v_attempt.workshop_seat_hold_id
  for update;
  select * into v_occurrence
  from public.workshop_occurrences
  where workshop_occurrence_id = v_booking.workshop_occurrence_id
  for update;

  if p_event_type in (
    'checkout.session.expired',
    'checkout.session.async_payment_failed',
    'payment_intent.payment_failed'
  ) then
    if v_attempt.state = 'paid' or v_booking.payment_state = 'paid' then
      update public.workshop_payment_provider_events
      set processing_state = 'duplicate',
          processing_error = 'terminal_success_already_recorded',
          processed_at = now()
      where workshop_payment_provider_event_id = v_event.workshop_payment_provider_event_id;
      return jsonb_build_object('replayed', false, 'state', 'duplicate');
    end if;

    update public.workshop_payment_attempts
    set state = case when p_event_type = 'checkout.session.expired' then 'expired' else 'failed' end,
        resolved_at = now()
    where workshop_payment_attempt_id = v_attempt.workshop_payment_attempt_id;
    update public.workshop_seat_holds
    set state = 'released',
        resolved_at = now(),
        resolution_reason = 'stripe_payment_not_completed'
    where workshop_seat_hold_id = v_hold.workshop_seat_hold_id
      and state = 'active';
    update public.workshop_bookings
    set status = 'expired',
        payment_state = 'exception'
    where workshop_booking_id = v_booking.workshop_booking_id
      and status = 'pending_payment';
    update public.workshop_payment_provider_events
    set processing_state = 'processed',
        processed_at = now()
    where workshop_payment_provider_event_id = v_event.workshop_payment_provider_event_id;
    return jsonb_build_object('replayed', false, 'state', 'failed');
  end if;

  if p_event_type not in (
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'payment_intent.succeeded'
  ) then
    raise exception 'unsupported_event_type';
  end if;

  select * into v_transaction
  from public.workshop_payment_transactions
  where provider = 'stripe'
    and provider_transaction_id = p_provider_payment_id
    and transaction_type = 'charge';
  if found then
    update public.workshop_payment_provider_events
    set processing_state = 'duplicate',
        processing_error = 'provider_charge_already_recorded',
        workshop_payment_transaction_id =
          v_transaction.workshop_payment_transaction_id,
        processed_at = now()
    where workshop_payment_provider_event_id =
      v_event.workshop_payment_provider_event_id;
    return jsonb_build_object(
      'replayed', true,
      'state', 'duplicate',
      'providerEventId', v_event.workshop_payment_provider_event_id,
      'transactionId', v_transaction.workshop_payment_transaction_id
    );
  end if;

  if v_attempt.amount_minor <> p_amount_minor or v_attempt.currency <> p_currency then
    v_exception_type := case
      when p_amount_minor < v_attempt.amount_minor then 'underpayment'
      else 'overpayment'
    end;
  elsif v_attempt.state = 'superseded' then
    v_exception_type := 'superseded_payment';
  elsif v_booking.status = 'cancelled'
    or (
      v_booking.status = 'expired'
      and not (
        v_attempt.state = 'expired'
        and v_hold.state = 'expired'
        and p_event_occurred_at <= v_attempt.effective_expires_at
      )
    )
  then
    v_exception_type := 'cancellation_race';
  elsif v_attempt.state = 'paid' or v_booking.payment_state = 'paid' then
    v_exception_type := 'duplicate_payment';
  elsif p_event_occurred_at > v_attempt.effective_expires_at then
    v_exception_type := 'late_payment';
  end if;

  if v_exception_type is null and v_hold.state = 'expired' then
    select coalesce(sum(h.quantity), 0)
    into v_reserved
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
    payload_digest,
    normalized_facts
  ) values (
    v_booking.workshop_booking_id,
    v_occurrence.workshop_occurrence_id,
    v_attempt.workshop_payment_attempt_id,
    'charge',
    'stripe',
    p_provider_payment_id,
    'STRIPE-' || p_provider_event_id,
    p_amount_minor,
    p_currency,
    p_event_occurred_at,
    case when v_exception_type is null then 'paid' else 'exception' end,
    p_command_key,
    p_payload_digest,
    jsonb_build_object('providerEventId', p_provider_event_id)
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
        resolution_reason = 'trusted_stripe_payment'
    where workshop_seat_hold_id = v_hold.workshop_seat_hold_id;
    update public.workshop_bookings
    set status = 'confirmed',
        payment_state = 'paid',
        payment_method = 'stripe',
        confirmed_at = coalesce(confirmed_at, p_event_occurred_at)
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
      provider_event_id,
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
      'Stripe payment requires manual workshop reconciliation.',
      'The payment was recorded without changing workshop capacity.',
      v_event.workshop_payment_provider_event_id,
      p_command_key
    );
  end if;

  update public.workshop_payment_provider_events
  set processing_state = 'processed',
      workshop_payment_transaction_id = v_transaction.workshop_payment_transaction_id,
      processed_at = now()
  where workshop_payment_provider_event_id = v_event.workshop_payment_provider_event_id;

  return jsonb_build_object(
    'replayed', false,
    'state', case when v_exception_type is null then 'confirmed' else 'exception' end,
    'exceptionType', v_exception_type,
    'bookingId', v_booking.workshop_booking_id,
    'transactionId', v_transaction.workshop_payment_transaction_id
  );
end;
$$;

revoke all on function public.reconcile_workshop_stripe_event(
  text, text, text, text, timestamptz, timestamptz, text, uuid, text,
  bigint, text, uuid
) from public;
grant execute on function public.reconcile_workshop_stripe_event(
  text, text, text, text, timestamptz, timestamptz, text, uuid, text,
  bigint, text, uuid
) to service_role;


-- Rollback: restore the preceding reconciliation function only after
-- workshop Stripe checkout is disabled and all pending provider events
-- have been reconciled.
