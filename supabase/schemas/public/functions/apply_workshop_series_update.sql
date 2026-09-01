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
    venmo_enabled = false,
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
