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
      tax_region, tax_rate_basis_points, currency, stripe_price_version_id, stripe_enabled, venmo_enabled,
      waitlist_enabled, is_featured, featured_order, created_by, updated_by
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
      upper(p_draft->>'currency'),
      nullif(p_draft->>'stripePriceVersionId','')::uuid,
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
