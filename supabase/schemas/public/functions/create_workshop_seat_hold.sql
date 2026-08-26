create or replace function public.create_workshop_seat_hold(
  p_occurrence_slug text,
  p_quantity integer,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_terms_version integer,
  p_status_token_digest text,
  p_command_key uuid,
  p_hold_minutes integer default 15
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_occurrence public.workshop_occurrences;
  v_existing public.workshop_seat_holds;
  v_booking public.workshop_bookings;
  v_hold public.workshop_seat_holds;
  v_reserved bigint;
  v_subtotal_minor bigint;
  v_tax_minor bigint;
  v_normal_expires_at timestamptz;
  v_effective_expires_at timestamptz;
begin
  select h.* into v_existing
  from public.workshop_seat_holds h
  where h.command_key = p_command_key;

  if found then
    select * into v_booking
    from public.workshop_bookings
    where workshop_booking_id = v_existing.booking_id;
    select * into v_occurrence
    from public.workshop_occurrences
    where workshop_occurrence_id = v_booking.workshop_occurrence_id;

    if v_occurrence.slug is distinct from p_occurrence_slug
      or v_booking.purchased_quantity is distinct from p_quantity
      or v_booking.contact_name is distinct from btrim(p_contact_name)
      or v_booking.contact_email is distinct from lower(btrim(p_contact_email))
      or v_booking.contact_phone is distinct from nullif(btrim(coalesce(p_contact_phone, '')), '')
      or v_booking.terms_version is distinct from p_terms_version
      or v_booking.status_token_digest is distinct from p_status_token_digest
    then
      raise exception 'command key collision' using errcode = '22023';
    end if;

    return jsonb_build_object(
      'replayed', true,
      'bookingId', v_booking.workshop_booking_id,
      'holdId', v_existing.workshop_seat_hold_id,
      'supportReference', v_booking.booking_reference,
      'quantity', v_booking.purchased_quantity,
      'priceMinor', v_booking.price_per_seat_minor_snapshot,
      'subtotalMinor', v_booking.subtotal_minor_snapshot,
      'taxMinor', coalesce(v_booking.tax_minor_snapshot, 0),
      'taxRateBasisPoints', coalesce(v_booking.tax_rate_basis_points_snapshot, 0),
      'taxRegion', coalesce(v_booking.tax_region_snapshot, ''),
      'totalMinor', v_booking.total_minor_snapshot,
      'currency', v_booking.currency,
      'effectiveExpiresAt', v_existing.effective_expires_at,
      'methods', case
        when v_occurrence.stripe_enabled and v_occurrence.venmo_enabled
          then jsonb_build_array('stripe', 'direct_venmo')
        when v_occurrence.stripe_enabled then jsonb_build_array('stripe')
        when v_occurrence.venmo_enabled then jsonb_build_array('direct_venmo')
        else '[]'::jsonb
      end
    );
  end if;

  if p_quantity <= 0
    or p_hold_minutes not between 1 and 30
    or char_length(btrim(coalesce(p_contact_name, ''))) not between 1 and 160
    or char_length(btrim(coalesce(p_contact_email, ''))) not between 3 and 320
    or char_length(coalesce(p_status_token_digest, '')) < 43
  then
    raise exception 'invalid_request';
  end if;

  select * into v_occurrence
  from public.workshop_occurrences
  where slug = p_occurrence_slug
  for update;

  if not found then
    raise exception 'unavailable';
  end if;

  update public.workshop_seat_holds
  set state = 'expired',
      resolved_at = now(),
      resolution_reason = 'effective_deadline_elapsed'
  where workshop_occurrence_id = v_occurrence.workshop_occurrence_id
    and state = 'active'
    and effective_expires_at <= now();

  if v_occurrence.status <> 'published_open'
    or now() < v_occurrence.registration_opens_at
    or now() >= least(v_occurrence.registration_closes_at, v_occurrence.start_at)
  then
    raise exception 'registration_closed';
  end if;

  if p_terms_version <> v_occurrence.terms_version then
    raise exception 'terms_changed';
  end if;

  if p_quantity > v_occurrence.per_booking_limit then
    raise exception 'quantity_changed';
  end if;

  select coalesce(sum(h.quantity), 0)
  into v_reserved
  from public.workshop_seat_holds h
  where h.workshop_occurrence_id = v_occurrence.workshop_occurrence_id
    and (
      h.state = 'confirmed'
      or (h.state = 'active' and h.effective_expires_at > now())
    );

  if v_reserved + p_quantity > v_occurrence.capacity then
    raise exception 'insufficient_capacity';
  end if;

  v_normal_expires_at := now() + make_interval(mins => p_hold_minutes);
  v_effective_expires_at := least(
    v_normal_expires_at,
    v_occurrence.registration_closes_at,
    v_occurrence.start_at
  );
  v_subtotal_minor := v_occurrence.price_minor * p_quantity;
  v_tax_minor := ((v_subtotal_minor * v_occurrence.tax_rate_basis_points + 5000) / 10000);

  insert into public.workshop_bookings (
    workshop_occurrence_id,
    booking_reference,
    status_token_digest,
    status_token_expires_at,
    contact_name,
    contact_email,
    contact_phone,
    purchased_quantity,
    active_quantity,
    price_per_seat_minor_snapshot,
    subtotal_minor_snapshot,
    tax_region_snapshot,
    tax_rate_basis_points_snapshot,
    tax_minor_snapshot,
    total_minor_snapshot,
    required_charges_minor_snapshot,
    currency,
    terms_snapshot,
    terms_version
  ) values (
    v_occurrence.workshop_occurrence_id,
    'BBW-' || to_char(v_occurrence.start_at, 'YYYY') || '-'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    p_status_token_digest,
    v_occurrence.end_at + interval '30 days',
    btrim(p_contact_name),
    lower(btrim(p_contact_email)),
    nullif(btrim(coalesce(p_contact_phone, '')), ''),
    p_quantity,
    p_quantity,
    v_occurrence.price_minor,
    v_subtotal_minor,
    v_occurrence.tax_region,
    v_occurrence.tax_rate_basis_points,
    v_tax_minor,
    v_subtotal_minor + v_tax_minor,
    0,
    v_occurrence.currency,
    v_occurrence.terms_snapshot,
    v_occurrence.terms_version
  )
  returning * into v_booking;

  insert into public.workshop_seat_holds (
    workshop_occurrence_id,
    booking_id,
    quantity,
    payment_method,
    normal_expires_at,
    effective_expires_at,
    command_key
  ) values (
    v_occurrence.workshop_occurrence_id,
    v_booking.workshop_booking_id,
    p_quantity,
    null,
    v_normal_expires_at,
    v_effective_expires_at,
    p_command_key
  )
  returning * into v_hold;

  return jsonb_build_object(
    'replayed', false,
    'bookingId', v_booking.workshop_booking_id,
    'holdId', v_hold.workshop_seat_hold_id,
    'supportReference', v_booking.booking_reference,
    'quantity', v_booking.purchased_quantity,
    'priceMinor', v_booking.price_per_seat_minor_snapshot,
    'subtotalMinor', v_booking.subtotal_minor_snapshot,
    'taxMinor', coalesce(v_booking.tax_minor_snapshot, 0),
    'taxRateBasisPoints', coalesce(v_booking.tax_rate_basis_points_snapshot, 0),
    'taxRegion', coalesce(v_booking.tax_region_snapshot, ''),
    'totalMinor', v_booking.total_minor_snapshot,
    'currency', v_booking.currency,
    'effectiveExpiresAt', v_hold.effective_expires_at,
    'methods', case
      when v_occurrence.stripe_enabled and v_occurrence.venmo_enabled
        then jsonb_build_array('stripe', 'direct_venmo')
      when v_occurrence.stripe_enabled then jsonb_build_array('stripe')
      when v_occurrence.venmo_enabled then jsonb_build_array('direct_venmo')
      else '[]'::jsonb
    end
  );
end;
$$;

revoke all on function public.create_workshop_seat_hold(
  text, integer, text, text, text, integer, text, uuid, integer
) from public;
grant execute on function public.create_workshop_seat_hold(
  text, integer, text, text, text, integer, text, uuid, integer
) to service_role;
