-- Workshop pre-tax pricing and fixed Northeast tax rates.
-- Existing workshop bookings may remain legacy tax-inclusive snapshots with
-- null tax snapshot fields. New bookings snapshot subtotal, tax, and total.

create or replace function public.workshop_tax_rate_basis_points(p_tax_region text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case upper(btrim(coalesce(p_tax_region, '')))
    when 'RI' then 700
    when 'CT' then 635
    when 'MA' then 625
    else null
  end;
$$;

revoke all on function public.workshop_tax_rate_basis_points(text) from public;

alter table public.workshop_series
  add column if not exists default_tax_region text not null default 'RI',
  add column if not exists default_tax_rate_basis_points integer not null default 700;

alter table public.workshop_series
  drop constraint if exists workshop_series_tax_region_rate,
  add constraint workshop_series_tax_region_rate check (
    (default_tax_region = 'RI' and default_tax_rate_basis_points = 700)
    or (default_tax_region = 'CT' and default_tax_rate_basis_points = 635)
    or (default_tax_region = 'MA' and default_tax_rate_basis_points = 625)
  );

alter table public.workshop_series
  drop constraint if exists workshop_series_default_tax_region_check,
  add constraint workshop_series_default_tax_region_check
    check (default_tax_region in ('RI','CT','MA'));

alter table public.workshop_series
  drop constraint if exists workshop_series_default_tax_rate_basis_points_check,
  add constraint workshop_series_default_tax_rate_basis_points_check
    check (default_tax_rate_basis_points in (700,635,625));

alter table public.workshop_occurrences
  add column if not exists tax_region text not null default 'RI',
  add column if not exists tax_rate_basis_points integer not null default 700;

alter table public.workshop_occurrences
  drop constraint if exists workshop_occurrences_tax_region_rate,
  add constraint workshop_occurrences_tax_region_rate check (
    (tax_region = 'RI' and tax_rate_basis_points = 700)
    or (tax_region = 'CT' and tax_rate_basis_points = 635)
    or (tax_region = 'MA' and tax_rate_basis_points = 625)
  );

alter table public.workshop_occurrences
  drop constraint if exists workshop_occurrences_tax_region_check,
  add constraint workshop_occurrences_tax_region_check
    check (tax_region in ('RI','CT','MA'));

alter table public.workshop_occurrences
  drop constraint if exists workshop_occurrences_tax_rate_basis_points_check,
  add constraint workshop_occurrences_tax_rate_basis_points_check
    check (tax_rate_basis_points in (700,635,625));

alter table public.workshop_bookings
  add column if not exists tax_region_snapshot text null,
  add column if not exists tax_rate_basis_points_snapshot integer null,
  add column if not exists tax_minor_snapshot bigint null;

alter table public.workshop_bookings
  drop constraint if exists workshop_booking_tax_region_snapshot_check,
  add constraint workshop_booking_tax_region_snapshot_check
    check (tax_region_snapshot is null or tax_region_snapshot in ('RI','CT','MA'));

alter table public.workshop_bookings
  drop constraint if exists workshop_booking_tax_rate_basis_points_snapshot_check,
  add constraint workshop_booking_tax_rate_basis_points_snapshot_check
    check (tax_rate_basis_points_snapshot is null or tax_rate_basis_points_snapshot in (700,635,625));

alter table public.workshop_bookings
  drop constraint if exists workshop_booking_tax_minor_snapshot_check,
  add constraint workshop_booking_tax_minor_snapshot_check
    check (tax_minor_snapshot is null or tax_minor_snapshot >= 0);

alter table public.workshop_bookings
  drop constraint if exists workshop_booking_total_snapshot,
  add constraint workshop_booking_total_snapshot check (
    subtotal_minor_snapshot = price_per_seat_minor_snapshot * purchased_quantity
    and (
      (
        tax_region_snapshot is null
        and tax_rate_basis_points_snapshot is null
        and tax_minor_snapshot is null
        and total_minor_snapshot = subtotal_minor_snapshot + required_charges_minor_snapshot
      )
      or (
        tax_region_snapshot is not null
        and tax_rate_basis_points_snapshot is not null
        and tax_minor_snapshot = ((subtotal_minor_snapshot * tax_rate_basis_points_snapshot + 5000) / 10000)
        and total_minor_snapshot = subtotal_minor_snapshot + tax_minor_snapshot + required_charges_minor_snapshot
        and (
          (tax_region_snapshot = 'RI' and tax_rate_basis_points_snapshot = 700)
          or (tax_region_snapshot = 'CT' and tax_rate_basis_points_snapshot = 635)
          or (tax_region_snapshot = 'MA' and tax_rate_basis_points_snapshot = 625)
        )
      )
    )
  );

create or replace function public.save_workshop_occurrence(
  p_draft jsonb,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_id uuid;
  v_occurrence_id uuid;
  v_definition_id uuid := (p_draft->>'workshopDefinitionId')::uuid;
  v_series_id uuid := nullif(p_draft->>'workshopSeriesId','')::uuid;
  v_timezone text := nullif(btrim(p_draft->>'timezone'),'');
  v_local_start timestamp := (p_draft->>'localStart')::timestamp;
  v_local_end timestamp := (p_draft->>'localEnd')::timestamp;
  v_offset smallint := (p_draft->>'utcOffsetMinutes')::smallint;
  v_tax_region text := upper(btrim(coalesce(p_draft->>'taxRegion', 'RI')));
  v_tax_rate_basis_points integer;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_occurrence public.workshop_occurrences;
begin
  if not public.is_internal_crm_user() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_command_key is null or v_definition_id is null then
    raise exception 'invalid request' using errcode = '22023';
  end if;
  v_tax_rate_basis_points := public.workshop_tax_rate_basis_points(v_tax_region);
  if v_tax_rate_basis_points is null then
    raise exception 'invalid tax region' using errcode = '22023';
  end if;

  select (safe_metadata->>'occurrenceId')::uuid into v_existing_id
  from public.workshop_audit_events
  where command_key = p_command_key and event_type = 'occurrence_saved';
  if v_existing_id is not null then
    select * into v_occurrence from public.workshop_occurrences
    where workshop_occurrence_id = v_existing_id;
    return to_jsonb(v_occurrence);
  end if;

  if not exists(select 1 from pg_catalog.pg_timezone_names where name = v_timezone) then
    raise exception 'invalid timezone' using errcode = '22023';
  end if;
  if v_local_end <= v_local_start then
    raise exception 'invalid schedule' using errcode = '22023';
  end if;

  v_start_at := to_timestamp(extract(epoch from v_local_start) - (v_offset * 60));
  v_end_at := to_timestamp(extract(epoch from v_local_end) - (v_offset * 60));
  if (v_start_at at time zone v_timezone) <> v_local_start
    or (v_end_at at time zone v_timezone) <> v_local_end then
    raise exception 'invalid timezone offset' using errcode = '22023';
  end if;

  if nullif(btrim(p_draft->>'title'),'') is null
    or nullif(btrim(p_draft->>'advertisingLine'),'') is null
    or nullif(btrim(p_draft->>'description'),'') is null then
    raise exception 'missing workshop content' using errcode = '22023';
  end if;

  v_occurrence_id := nullif(p_draft->>'workshopOccurrenceId','')::uuid;
  if v_occurrence_id is null then
    insert into public.workshop_occurrences (
      workshop_definition_id, workshop_series_id, slug,
      title_snapshot, advertising_line_snapshot, description_snapshot,
      included_materials_snapshot, terms_snapshot, terms_version,
      venue_name, address_line_1, address_line_2, locality, region,
      postal_code, country, timezone, local_start, local_end,
      utc_offset_minutes, start_at, end_at, registration_opens_at,
      registration_closes_at, capacity, per_booking_limit, price_minor,
      tax_region, tax_rate_basis_points, currency, stripe_price_version_id,
      stripe_enabled, venmo_enabled, waitlist_enabled, is_featured,
      featured_order, created_by, updated_by
    ) values (
      v_definition_id, v_series_id, lower(btrim(p_draft->>'slug')),
      btrim(p_draft->>'title'), btrim(p_draft->>'advertisingLine'),
      btrim(p_draft->>'description'), coalesce(btrim(p_draft->>'includedMaterials'),''),
      coalesce(btrim(p_draft->>'terms'),''), (p_draft->>'termsVersion')::integer,
      coalesce(btrim(p_draft->>'venueName'),''), coalesce(btrim(p_draft->>'addressLine1'),''),
      nullif(btrim(p_draft->>'addressLine2'),''), coalesce(btrim(p_draft->>'locality'),''),
      coalesce(btrim(p_draft->>'region'),''), coalesce(btrim(p_draft->>'postalCode'),''),
      coalesce(nullif(upper(btrim(p_draft->>'country')),''),'US'), v_timezone,
      v_local_start, v_local_end, v_offset, v_start_at, v_end_at,
      (p_draft->>'registrationOpensAt')::timestamptz,
      (p_draft->>'registrationClosesAt')::timestamptz,
      (p_draft->>'capacity')::integer, (p_draft->>'perBookingLimit')::integer,
      (p_draft->>'priceMinor')::bigint, v_tax_region, v_tax_rate_basis_points,
      upper(p_draft->>'currency'), nullif(p_draft->>'stripePriceVersionId','')::uuid,
      coalesce((p_draft->>'stripeEnabled')::boolean,false),
      coalesce((p_draft->>'venmoEnabled')::boolean,false),
      coalesce((p_draft->>'waitlistEnabled')::boolean,false),
      coalesce((p_draft->>'isFeatured')::boolean,false),
      nullif(p_draft->>'featuredOrder','')::smallint, auth.uid(), auth.uid()
    ) returning * into v_occurrence;
  else
    update public.workshop_occurrences set
      workshop_series_id = v_series_id,
      slug = lower(btrim(p_draft->>'slug')),
      title_snapshot = btrim(p_draft->>'title'),
      advertising_line_snapshot = btrim(p_draft->>'advertisingLine'),
      description_snapshot = btrim(p_draft->>'description'),
      included_materials_snapshot = coalesce(btrim(p_draft->>'includedMaterials'),''),
      terms_snapshot = coalesce(btrim(p_draft->>'terms'),''),
      terms_version = (p_draft->>'termsVersion')::integer,
      venue_name = coalesce(btrim(p_draft->>'venueName'),''),
      address_line_1 = coalesce(btrim(p_draft->>'addressLine1'),''),
      address_line_2 = nullif(btrim(p_draft->>'addressLine2'),''),
      locality = coalesce(btrim(p_draft->>'locality'),''),
      region = coalesce(btrim(p_draft->>'region'),''),
      postal_code = coalesce(btrim(p_draft->>'postalCode'),''),
      country = coalesce(nullif(upper(btrim(p_draft->>'country')),''),'US'),
      timezone = v_timezone, local_start = v_local_start, local_end = v_local_end,
      utc_offset_minutes = v_offset, start_at = v_start_at, end_at = v_end_at,
      registration_opens_at = (p_draft->>'registrationOpensAt')::timestamptz,
      registration_closes_at = (p_draft->>'registrationClosesAt')::timestamptz,
      capacity = (p_draft->>'capacity')::integer,
      per_booking_limit = (p_draft->>'perBookingLimit')::integer,
      price_minor = (p_draft->>'priceMinor')::bigint,
      tax_region = v_tax_region,
      tax_rate_basis_points = v_tax_rate_basis_points,
      currency = upper(p_draft->>'currency'),
      stripe_price_version_id = nullif(p_draft->>'stripePriceVersionId','')::uuid,
      stripe_enabled = coalesce((p_draft->>'stripeEnabled')::boolean,false),
      venmo_enabled = coalesce((p_draft->>'venmoEnabled')::boolean,false),
      waitlist_enabled = coalesce((p_draft->>'waitlistEnabled')::boolean,false),
      is_featured = coalesce((p_draft->>'isFeatured')::boolean,false),
      featured_order = nullif(p_draft->>'featuredOrder','')::smallint,
      updated_by = auth.uid()
    where workshop_occurrence_id = v_occurrence_id
      and workshop_definition_id = v_definition_id
      and status in ('draft','published_open','registration_closed')
    returning * into v_occurrence;
    if not found then
      raise exception 'workshop occurrence cannot be edited' using errcode = '55000';
    end if;
  end if;

  insert into public.workshop_audit_events(
    workshop_definition_id, workshop_occurrence_id, event_type, actor_type,
    actor_id, command_key, safe_metadata
  ) values (
    v_occurrence.workshop_definition_id, v_occurrence.workshop_occurrence_id,
    'occurrence_saved', 'internal', auth.uid(), p_command_key,
    jsonb_build_object('occurrenceId',v_occurrence.workshop_occurrence_id)
  );
  return to_jsonb(v_occurrence);
end;
$$;

revoke all on function public.save_workshop_occurrence(jsonb,uuid) from public;
grant execute on function public.save_workshop_occurrence(jsonb,uuid) to authenticated;

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
    workshop_occurrence_id, booking_reference, status_token_digest,
    status_token_expires_at, contact_name, contact_email, contact_phone,
    purchased_quantity, active_quantity, price_per_seat_minor_snapshot,
    subtotal_minor_snapshot, tax_region_snapshot,
    tax_rate_basis_points_snapshot, tax_minor_snapshot, total_minor_snapshot,
    required_charges_minor_snapshot, currency, terms_snapshot, terms_version
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
    workshop_occurrence_id, booking_id, quantity, payment_method,
    normal_expires_at, effective_expires_at, command_key
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

  if p_method not in ('stripe', 'direct_venmo')
    or p_stripe_hold_minutes not between 1 and 30
    or p_venmo_hold_hours not between 1 and 24
  then
    raise exception 'invalid_request';
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

  if (p_method = 'stripe' and not v_occurrence.stripe_enabled)
    or (p_method = 'direct_venmo' and not v_occurrence.venmo_enabled)
    or (p_method = 'direct_venmo' and char_length(btrim(coalesce(p_venmo_target, ''))) = 0)
  then
    raise exception 'payment_method_unavailable';
  end if;

  if p_method = 'stripe' then
    select price.stripe_price_id into v_stripe_price_id
    from public.workshop_stripe_price_versions price
    where price.workshop_stripe_price_version_id = v_occurrence.stripe_price_version_id
      and price.state = 'active';

    if v_stripe_price_id is null then
      raise exception 'payment_method_unavailable';
    end if;

    v_normal_expires_at := now() + make_interval(mins => p_stripe_hold_minutes);
  else
    v_normal_expires_at := now() + make_interval(hours => p_venmo_hold_hours);
  end if;

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
    workshop_payment_attempt_id, workshop_booking_id, workshop_seat_hold_id,
    provider, stripe_price_id, venmo_target_snapshot,
    reconciliation_reference, quantity, state, amount_minor, currency,
    command_key, normal_expires_at, effective_expires_at
  ) values (
    v_attempt_id,
    v_booking.workshop_booking_id,
    v_hold.workshop_seat_hold_id,
    p_method,
    v_stripe_price_id,
    case when p_method = 'direct_venmo' then btrim(p_venmo_target) end,
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

create or replace function public.apply_workshop_series_update(
  p_workshop_series_id uuid,
  p_occurrence_ids uuid[],
  p_patch jsonb,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_series public.workshop_series;
  v_target_ids uuid[];
  v_booked_ids uuid[];
  v_confirmed_ids uuid[] := coalesce(array(
    select (value #>> '{}')::uuid
    from jsonb_array_elements(coalesce(p_patch->'confirmedBookedOccurrenceIds','[]'::jsonb))
  ), '{}'::uuid[]);
  v_material boolean := p_patch ?| array[
    'priceMinor','taxRegion','capacity','venueName','addressLine1','addressLine2',
    'locality','region','postalCode','country','terms'
  ];
  v_tax_region text;
  v_tax_rate_basis_points integer;
  v_replay jsonb;
begin
  if not public.is_internal_crm_user() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_command_key is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'invalid series update' using errcode = '22023';
  end if;

  select safe_metadata into v_replay
  from public.workshop_audit_events
  where command_key = p_command_key and event_type = 'series_updated';
  if v_replay is not null then
    return v_replay || jsonb_build_object(
      'occurrences', (
        select coalesce(jsonb_agg(to_jsonb(o) order by o.start_at), '[]'::jsonb)
        from public.workshop_occurrences o
        where o.workshop_occurrence_id in (
          select (value #>> '{}')::uuid
          from jsonb_array_elements(v_replay->'occurrenceIds')
        )
      )
    );
  end if;

  select * into v_series from public.workshop_series
  where workshop_series_id = p_workshop_series_id for update;
  if not found then
    raise exception 'workshop series not found' using errcode = 'P0002';
  end if;

  if p_patch->>'scope' = 'all_future' then
    select coalesce(array_agg(workshop_occurrence_id order by start_at), '{}'::uuid[])
    into v_target_ids
    from public.workshop_occurrences
    where workshop_series_id = p_workshop_series_id
      and start_at > now()
      and status in ('draft','published_open','registration_closed');
  else
    select coalesce(array_agg(workshop_occurrence_id order by start_at), '{}'::uuid[])
    into v_target_ids
    from public.workshop_occurrences
    where workshop_series_id = p_workshop_series_id
      and workshop_occurrence_id = any(coalesce(p_occurrence_ids, '{}'::uuid[]))
      and status in ('draft','published_open','registration_closed');
  end if;
  if cardinality(v_target_ids) = 0 then
    raise exception 'series update has no eligible occurrences' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct workshop_occurrence_id), '{}'::uuid[])
  into v_booked_ids
  from public.workshop_audit_events
  where workshop_occurrence_id = any(v_target_ids)
    and event_type in ('booking_created','booking_confirmed','manual_booking_created');

  if coalesce((p_patch->>'previewOnly')::boolean, false) then
    return jsonb_build_object(
      'previewOnly', true,
      'occurrenceIds', to_jsonb(v_target_ids),
      'bookedOccurrenceIds', to_jsonb(v_booked_ids)
    );
  end if;
  if v_material and not v_booked_ids <@ v_confirmed_ids then
    raise exception 'booked occurrence confirmation required'
      using errcode = '55000',
      detail = array_to_string(v_booked_ids, ',');
  end if;
  if p_patch ? 'taxRegion' then
    v_tax_region := upper(btrim(p_patch->>'taxRegion'));
    v_tax_rate_basis_points := public.workshop_tax_rate_basis_points(v_tax_region);
    if v_tax_rate_basis_points is null then
      raise exception 'invalid tax region' using errcode = '22023';
    end if;
  end if;

  update public.workshop_occurrences set
    title_snapshot = case when p_patch ? 'title' then btrim(p_patch->>'title') else title_snapshot end,
    advertising_line_snapshot = case when p_patch ? 'advertisingLine' then btrim(p_patch->>'advertisingLine') else advertising_line_snapshot end,
    description_snapshot = case when p_patch ? 'description' then btrim(p_patch->>'description') else description_snapshot end,
    included_materials_snapshot = case when p_patch ? 'includedMaterials' then btrim(p_patch->>'includedMaterials') else included_materials_snapshot end,
    terms_snapshot = case when p_patch ? 'terms' then btrim(p_patch->>'terms') else terms_snapshot end,
    terms_version = case when p_patch ? 'termsVersion' then (p_patch->>'termsVersion')::integer else terms_version end,
    venue_name = case when p_patch ? 'venueName' then btrim(p_patch->>'venueName') else venue_name end,
    address_line_1 = case when p_patch ? 'addressLine1' then btrim(p_patch->>'addressLine1') else address_line_1 end,
    address_line_2 = case when p_patch ? 'addressLine2' then nullif(btrim(p_patch->>'addressLine2'),'') else address_line_2 end,
    locality = case when p_patch ? 'locality' then btrim(p_patch->>'locality') else locality end,
    region = case when p_patch ? 'region' then btrim(p_patch->>'region') else region end,
    postal_code = case when p_patch ? 'postalCode' then btrim(p_patch->>'postalCode') else postal_code end,
    country = case when p_patch ? 'country' then upper(btrim(p_patch->>'country')) else country end,
    capacity = case when p_patch ? 'capacity' then (p_patch->>'capacity')::integer else capacity end,
    per_booking_limit = case when p_patch ? 'perBookingLimit' then (p_patch->>'perBookingLimit')::integer else per_booking_limit end,
    price_minor = case when p_patch ? 'priceMinor' then (p_patch->>'priceMinor')::bigint else price_minor end,
    tax_region = case when p_patch ? 'taxRegion' then v_tax_region else tax_region end,
    tax_rate_basis_points = case when p_patch ? 'taxRegion' then v_tax_rate_basis_points else tax_rate_basis_points end,
    stripe_price_version_id = case when p_patch ? 'stripePriceVersionId' then nullif(p_patch->>'stripePriceVersionId','')::uuid else stripe_price_version_id end,
    stripe_enabled = case when p_patch ? 'stripeEnabled' then (p_patch->>'stripeEnabled')::boolean else stripe_enabled end,
    venmo_enabled = case when p_patch ? 'venmoEnabled' then (p_patch->>'venmoEnabled')::boolean else venmo_enabled end,
    waitlist_enabled = case when p_patch ? 'waitlistEnabled' then (p_patch->>'waitlistEnabled')::boolean else waitlist_enabled end,
    updated_by = auth.uid()
  where workshop_occurrence_id = any(v_target_ids);

  insert into public.workshop_audit_events(
    workshop_definition_id, event_type, actor_type, actor_id, command_key,
    safe_metadata
  ) values (
    v_series.workshop_definition_id, 'series_updated', 'internal', auth.uid(),
    p_command_key, jsonb_build_object(
      'seriesId', p_workshop_series_id,
      'occurrenceIds', to_jsonb(v_target_ids),
      'bookedOccurrenceIds', to_jsonb(v_booked_ids),
      'changedFields', (
        select coalesce(jsonb_agg(key order by key), '[]'::jsonb)
        from jsonb_object_keys(p_patch) key
        where key not in ('scope','previewOnly','confirmedBookedOccurrenceIds')
      )
    )
  ) returning safe_metadata into v_replay;

  return v_replay || jsonb_build_object(
    'occurrences', (
      select coalesce(jsonb_agg(to_jsonb(o) order by o.start_at), '[]'::jsonb)
      from public.workshop_occurrences o
      where o.workshop_occurrence_id = any(v_target_ids)
    )
  );
end;
$$;

revoke all on function public.apply_workshop_series_update(uuid,uuid[],jsonb,uuid) from public;
grant execute on function public.apply_workshop_series_update(uuid,uuid[],jsonb,uuid) to authenticated;

drop function if exists public.get_public_workshop_listing();

create or replace function public.get_public_workshop_listing()
returns table (
  "slug" text, "seriesSlug" text, "workshopDate" text,
  "title" text, "advertisingLine" text, "theme" text,
  "heroImageUrl" text, "heroAltText" text, "startAt" timestamptz,
  "endAt" timestamptz, "timezone" text, "venueName" text,
  "locality" text, "region" text, "priceMinor" bigint, "currency" text,
  "taxRegion" text, "taxRateBasisPoints" integer,
  "availability" text, "remainingSeats" integer,
  "isFeatured" boolean, "featuredOrder" smallint,
  "updatedAt" timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select o.slug, public.workshop_public_series_slug(o.title_snapshot),
    o.local_start::date::text, o.title_snapshot, o.advertising_line_snapshot,
    d.theme, hero.public_url, hero.alt_text, o.start_at, o.end_at, o.timezone,
    o.venue_name, o.locality, o.region, o.price_minor, o.currency,
    o.tax_region, o.tax_rate_basis_points,
    public.get_workshop_public_availability(o.workshop_occurrence_id),
    public.get_workshop_public_remaining_seats(o.workshop_occurrence_id),
    o.is_featured, o.featured_order, o.updated_at
  from public.workshop_occurrences o
  join public.workshop_definitions d using (workshop_definition_id)
  join lateral (
    select wm.public_url, wm.alt_text
    from public.workshop_media wm
    where wm.is_public and wm.media_role = 'hero'
      and (
        wm.workshop_occurrence_id = o.workshop_occurrence_id
        or (
          wm.workshop_occurrence_id is null
          and wm.workshop_definition_id = o.workshop_definition_id
        )
      )
    order by (wm.workshop_occurrence_id is not null) desc
    limit 1
  ) hero on true
  where o.status = 'published_open'
    and o.end_at > now()
    and o.registration_closes_at > now()
  order by o.start_at, o.workshop_occurrence_id;
$$;

revoke all on function public.get_public_workshop_listing() from public;
grant execute on function public.get_public_workshop_listing() to anon, authenticated;

create or replace function public.get_public_workshop_occurrence(p_slug text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'slug', o.slug,
    'seriesSlug', public.workshop_public_series_slug(o.title_snapshot),
    'workshopDate', o.local_start::date::text,
    'title', o.title_snapshot,
    'advertisingLine', o.advertising_line_snapshot, 'theme', d.theme,
    'heroImageUrl', hero.public_url, 'heroAltText', hero.alt_text,
    'lifecycleStatus', o.status, 'description', o.description_snapshot,
    'includedMaterials', o.included_materials_snapshot,
    'accessibilityGuidance', d.accessibility_guidance,
    'contactGuidance', d.contact_guidance, 'terms', o.terms_snapshot,
    'termsVersion', o.terms_version, 'startAt', o.start_at, 'endAt', o.end_at,
    'timezone', o.timezone, 'venueName', o.venue_name,
    'addressLine1', o.address_line_1, 'addressLine2', o.address_line_2,
    'locality', o.locality, 'region', o.region, 'postalCode', o.postal_code,
    'country', o.country, 'priceMinor', o.price_minor,
    'taxRegion', o.tax_region,
    'taxRateBasisPoints', o.tax_rate_basis_points,
    'currency', o.currency,
    'perBookingLimit', o.per_booking_limit, 'stripeEnabled', o.stripe_enabled,
    'venmoEnabled', o.venmo_enabled, 'waitlistEligible', false,
    'availability', public.get_workshop_public_availability(
      o.workshop_occurrence_id
    ),
    'remainingSeats', public.get_workshop_public_remaining_seats(
      o.workshop_occurrence_id
    ),
    'isFeatured', o.is_featured, 'featuredOrder', o.featured_order,
    'updatedAt', o.updated_at,
    'seoStatus', case
      when o.status in ('cancelled','rescheduled') and o.status_page_expires_at <= now() then 'redirect'
      when o.status in ('cancelled','rescheduled') then 'noindex'
      else 'index'
    end,
    'replacementUrl', case when replacement.slug is not null
      then '/workshops/' || public.workshop_public_series_slug(replacement.title_snapshot)
        || '/' || replacement.local_start::date::text else null end,
    'replacementStartAt', replacement.start_at,
    'replacementEndAt', replacement.end_at,
    'redirectUrl', case when o.status_page_expires_at <= now()
      then coalesce(
        '/workshops/' || public.workshop_public_series_slug(replacement.title_snapshot)
          || '/' || replacement.local_start::date::text,
        '/workshops'
      ) else null end,
    'media', coalesce((
      select jsonb_agg(jsonb_build_object(
        'role', wm.media_role, 'url', wm.public_url, 'altText', wm.alt_text,
        'displayOrder', wm.display_order
      ) order by case wm.media_role when 'hero' then 0 else 1 end, wm.display_order)
      from public.workshop_media wm
      where wm.is_public and (
        wm.workshop_occurrence_id = o.workshop_occurrence_id
        or (
          wm.workshop_definition_id = o.workshop_definition_id
          and not exists (
            select 1 from public.workshop_media override_media
            where override_media.workshop_occurrence_id = o.workshop_occurrence_id
              and override_media.media_role = wm.media_role
          )
        )
      )
    ), '[]'::jsonb)
  )
  from public.workshop_occurrences o
  join public.workshop_definitions d using (workshop_definition_id)
  join lateral (
    select wm.public_url, wm.alt_text
    from public.workshop_media wm
    where wm.is_public and wm.media_role = 'hero'
      and (
        wm.workshop_occurrence_id = o.workshop_occurrence_id
        or (
          wm.workshop_occurrence_id is null
          and wm.workshop_definition_id = o.workshop_definition_id
        )
      )
    order by (wm.workshop_occurrence_id is not null) desc limit 1
  ) hero on true
  left join public.workshop_occurrences replacement
    on replacement.workshop_occurrence_id = o.replacement_occurrence_id
  where o.slug = p_slug
    and o.status in (
      'published_open','registration_closed','cancelled','rescheduled','completed'
    );
$$;

revoke all on function public.get_public_workshop_occurrence(text) from public;
grant execute on function public.get_public_workshop_occurrence(text) to anon, authenticated;
