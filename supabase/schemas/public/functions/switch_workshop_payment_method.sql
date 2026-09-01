create or replace function public.switch_workshop_payment_method(
  p_status_token_digest text,
  p_method text,
  p_command_key uuid,
  p_venmo_target text default null,
  p_stripe_hold_minutes integer default 15,
  p_venmo_hold_hours integer default 24
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.workshop_bookings;
  v_occurrence public.workshop_occurrences;
  v_hold public.workshop_seat_holds;
  v_attempt public.workshop_payment_attempts;
  v_normal_expires_at timestamptz;
  v_effective_expires_at timestamptz;
  v_stripe_price_id text;
  v_attempt_id uuid := gen_random_uuid();
begin
  if p_method <> 'stripe'
    or p_stripe_hold_minutes not between 1 and 30
  then
    raise exception 'invalid_request';
  end if;

  select * into v_attempt
  from public.workshop_payment_attempts
  where command_key = p_command_key;

  if found then
    select * into v_booking
    from public.workshop_bookings
    where workshop_booking_id = v_attempt.workshop_booking_id;
    select * into v_occurrence
    from public.workshop_occurrences
    where workshop_occurrence_id = v_booking.workshop_occurrence_id;
    return jsonb_build_object(
      'replayed', true,
      'paymentAttemptId', v_attempt.workshop_payment_attempt_id,
      'method', v_attempt.provider,
      'quantity', v_attempt.quantity,
      'priceMinor', v_booking.price_per_seat_minor_snapshot,
      'subtotalMinor', v_booking.subtotal_minor_snapshot,
      'taxMinor', coalesce(v_booking.tax_minor_snapshot, 0),
      'taxRateBasisPoints', coalesce(v_booking.tax_rate_basis_points_snapshot, 0),
      'taxRegion', coalesce(v_booking.tax_region_snapshot, ''),
      'amountMinor', v_attempt.amount_minor,
      'currency', v_attempt.currency,
      'reference', v_attempt.reconciliation_reference,
      'effectiveExpiresAt', v_attempt.effective_expires_at,
      'approvedTarget', v_attempt.venmo_target_snapshot,
      'stripePriceId', v_attempt.stripe_price_id,
      'workshopTitle', v_occurrence.title_snapshot,
      'advertisingLine', v_occurrence.advertising_line_snapshot,
      'startAt', v_occurrence.start_at,
      'timezone', v_occurrence.timezone,
      'venueName', v_occurrence.venue_name,
      'locality', v_occurrence.locality,
      'region', v_occurrence.region
    );
  end if;

  select * into v_booking
  from public.workshop_bookings
  where status_token_digest = p_status_token_digest
  for update;

  if not found or v_booking.status_token_expires_at <= now() then
    raise exception 'unavailable';
  end if;

  select * into v_occurrence
  from public.workshop_occurrences
  where workshop_occurrence_id = v_booking.workshop_occurrence_id
  for update;

  select * into v_hold
  from public.workshop_seat_holds
  where booking_id = v_booking.workshop_booking_id
    and state = 'active'
  order by created_at desc
  limit 1
  for update;

  if not found or v_hold.effective_expires_at <= now()
    or v_booking.status <> 'pending_payment'
  then
    raise exception 'unavailable';
  end if;

  if not v_occurrence.stripe_enabled then
    raise exception 'payment_method_unavailable';
  end if;

  select price.stripe_price_id into v_stripe_price_id
  from public.workshop_stripe_price_versions price
  where price.workshop_stripe_price_version_id = v_occurrence.stripe_price_version_id
    and price.state = 'active';

  if v_stripe_price_id is null then
    raise exception 'payment_method_unavailable';
  end if;

  v_normal_expires_at := now() + make_interval(mins => p_stripe_hold_minutes);

  v_effective_expires_at := least(
    v_normal_expires_at,
    v_occurrence.registration_closes_at,
    v_occurrence.start_at
  );

  if v_effective_expires_at <= now() then
    raise exception 'registration_closed';
  end if;

  update public.workshop_payment_attempts
  set state = 'superseded',
      resolved_at = now()
  where workshop_booking_id = v_booking.workshop_booking_id
    and state in ('creating', 'active', 'processing');

  update public.workshop_seat_holds
  set payment_method = p_method,
      normal_expires_at = v_normal_expires_at,
      effective_expires_at = v_effective_expires_at
  where workshop_seat_hold_id = v_hold.workshop_seat_hold_id
  returning * into v_hold;

  insert into public.workshop_payment_attempts (
    workshop_payment_attempt_id,
    workshop_booking_id,
    workshop_seat_hold_id,
    provider,
    stripe_price_id,
    venmo_target_snapshot,
    reconciliation_reference,
    quantity,
    state,
    amount_minor,
    currency,
    command_key,
    normal_expires_at,
    effective_expires_at
  ) values (
    v_attempt_id,
    v_booking.workshop_booking_id,
    v_hold.workshop_seat_hold_id,
    p_method,
    v_stripe_price_id,
    null,
    v_booking.booking_reference || '-'
      || upper(substr(replace(v_attempt_id::text, '-', ''), 1, 6)),
    v_booking.purchased_quantity,
    'active',
    v_booking.total_minor_snapshot,
    v_booking.currency,
    p_command_key,
    v_normal_expires_at,
    v_effective_expires_at
  )
  returning * into v_attempt;

  update public.workshop_bookings
  set payment_method = p_method,
      payment_state = 'pending'
  where workshop_booking_id = v_booking.workshop_booking_id;

  return jsonb_build_object(
    'replayed', false,
    'paymentAttemptId', v_attempt.workshop_payment_attempt_id,
    'method', v_attempt.provider,
    'quantity', v_attempt.quantity,
    'priceMinor', v_booking.price_per_seat_minor_snapshot,
    'subtotalMinor', v_booking.subtotal_minor_snapshot,
    'taxMinor', coalesce(v_booking.tax_minor_snapshot, 0),
    'taxRateBasisPoints', coalesce(v_booking.tax_rate_basis_points_snapshot, 0),
    'taxRegion', coalesce(v_booking.tax_region_snapshot, ''),
    'amountMinor', v_attempt.amount_minor,
    'currency', v_attempt.currency,
    'reference', v_attempt.reconciliation_reference,
    'effectiveExpiresAt', v_attempt.effective_expires_at,
    'approvedTarget', v_attempt.venmo_target_snapshot,
    'stripePriceId', v_attempt.stripe_price_id,
    'workshopTitle', v_occurrence.title_snapshot,
    'advertisingLine', v_occurrence.advertising_line_snapshot,
    'startAt', v_occurrence.start_at,
    'timezone', v_occurrence.timezone,
    'venueName', v_occurrence.venue_name,
    'locality', v_occurrence.locality,
    'region', v_occurrence.region
  );
end;
$$;

revoke all on function public.switch_workshop_payment_method(
  text, text, uuid, text, integer, integer
) from public;
grant execute on function public.switch_workshop_payment_method(
  text, text, uuid, text, integer, integer
) to service_role;
