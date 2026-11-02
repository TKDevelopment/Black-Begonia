-- Optional venue checkout; NULL preserves existing Stripe behavior.
alter table public.workshop_occurrences add column external_checkout_url text null;
alter table public.workshop_occurrences
  drop constraint workshop_occurrences_open_requires_stripe,
  add constraint workshop_occurrences_open_requires_stripe check (
    status <> 'published_open' or stripe_enabled or external_checkout_url is not null
  ),
  add constraint workshop_occurrences_external_checkout_url check (
    external_checkout_url is null or (
      char_length(external_checkout_url) between 1 and 2048
      and external_checkout_url ~* '^https://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]\\]*)?$'
    )
  ),
  add constraint workshop_occurrences_external_checkout_mode check (
    external_checkout_url is null or (not stripe_enabled and not waitlist_enabled)
  );

create or replace function public.guard_workshop_checkout_mode_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.external_checkout_url is distinct from old.external_checkout_url
    and new.external_checkout_url is not null
    and exists (
      select 1 from public.workshop_seat_holds h
      where h.workshop_occurrence_id = old.workshop_occurrence_id
        and h.state = 'active' and h.effective_expires_at > now()
    ) then
    raise exception 'Wait for active reservations to expire before changing checkout providers.' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_workshop_checkout_mode_change() from public;
create trigger guard_workshop_checkout_mode_change
before update of external_checkout_url on public.workshop_occurrences
for each row execute function public.guard_workshop_checkout_mode_change();

create or replace function public.get_workshop_public_availability(
  p_workshop_occurrence_id uuid
) returns text
language sql stable security definer set search_path=''
as $$
  with facts as (
    select o.status, o.registration_opens_at, o.registration_closes_at,
      o.capacity, o.waitlist_enabled, o.external_checkout_url,
      greatest(o.capacity - coalesce((
        select sum(h.quantity)
        from public.workshop_seat_holds h
        where h.workshop_occurrence_id=o.workshop_occurrence_id
          and (
            h.state='confirmed'
            or (h.state='active' and h.effective_expires_at>now())
          )
      ),0),0)::integer as remaining
    from public.workshop_occurrences o
    where o.workshop_occurrence_id=p_workshop_occurrence_id
  )
  select case
    when status<>'published_open'
      or now()<registration_opens_at or now()>=registration_closes_at then 'closed'
    when external_checkout_url is not null then 'available'
    when remaining=0 and waitlist_enabled then 'waitlist_available'
    when remaining=0 then 'sold_out'
    when remaining<=greatest(3,ceil(capacity*.25)::integer) then 'limited'
    else 'available'
  end
  from facts;
$$;

revoke all on function public.get_workshop_public_availability(uuid) from public;

drop function public.get_public_workshop_listing();
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
  v_external_checkout_url text := nullif(btrim(p_draft->>'externalCheckoutUrl'),'');
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
      tax_region, tax_rate_basis_points, currency, stripe_price_version_id, external_checkout_url, stripe_enabled, venmo_enabled,
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
      v_external_checkout_url,
      v_external_checkout_url is null and coalesce((p_draft->>'stripeEnabled')::boolean,false),
      false,
      v_external_checkout_url is null and coalesce((p_draft->>'waitlistEnabled')::boolean,false),
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
      external_checkout_url = v_external_checkout_url,
      stripe_enabled = v_external_checkout_url is null and coalesce((p_draft->>'stripeEnabled')::boolean,false),
      venmo_enabled = false,
      waitlist_enabled = v_external_checkout_url is null and coalesce((p_draft->>'waitlistEnabled')::boolean,false),
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

create or replace function public.publish_workshop_occurrence(
  p_workshop_occurrence_id uuid,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_occurrence public.workshop_occurrences;
  v_replay_id uuid;
begin
  if not public.is_internal_crm_user() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select (safe_metadata->>'occurrenceId')::uuid into v_replay_id
  from public.workshop_audit_events
  where command_key=p_command_key and event_type='occurrence_published';
  if v_replay_id is not null then
    select * into v_occurrence from public.workshop_occurrences
    where workshop_occurrence_id=v_replay_id;
    return to_jsonb(v_occurrence);
  end if;

  select * into v_occurrence from public.workshop_occurrences
  where workshop_occurrence_id=p_workshop_occurrence_id for update;
  if not found then raise exception 'workshop occurrence not found' using errcode='P0002'; end if;
  if v_occurrence.status not in ('draft','registration_closed') then
    raise exception 'workshop occurrence cannot be published' using errcode='55000';
  end if;
  if nullif(btrim(v_occurrence.included_materials_snapshot),'') is null then
    raise exception 'included materials are required' using errcode='22023';
  end if;
  if nullif(btrim(v_occurrence.terms_snapshot),'') is null
    or nullif(btrim(v_occurrence.venue_name),'') is null
    or nullif(btrim(v_occurrence.address_line_1),'') is null
    or nullif(btrim(v_occurrence.locality),'') is null
    or nullif(btrim(v_occurrence.region),'') is null
    or nullif(btrim(v_occurrence.postal_code),'') is null then
    raise exception 'address and terms are required' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.workshop_media m
    where m.is_public and m.media_role='hero' and nullif(btrim(m.alt_text),'') is not null
      and (
        m.workshop_occurrence_id=v_occurrence.workshop_occurrence_id
        or (
          m.workshop_definition_id=v_occurrence.workshop_definition_id
          and not exists(
            select 1 from public.workshop_media override_media
            where override_media.workshop_occurrence_id=v_occurrence.workshop_occurrence_id
              and override_media.media_role='hero'
          )
        )
      )
  ) then
    raise exception 'effective hero image is required' using errcode='22023';
  end if;
  if v_occurrence.external_checkout_url is null and not v_occurrence.stripe_enabled then
    raise exception 'Stripe checkout is required' using errcode='22023';
  end if;
  if v_occurrence.external_checkout_url is null and not exists (
    select 1 from public.workshop_stripe_price_versions p
    join public.workshop_definitions d using(workshop_definition_id)
    where p.workshop_stripe_price_version_id=v_occurrence.stripe_price_version_id
      and p.state='active' and p.amount_minor=v_occurrence.price_minor
      and p.currency=v_occurrence.currency and d.stripe_catalog_state='ready'
  ) then
    raise exception 'Stripe catalog is not ready' using errcode='22023';
  end if;

  update public.workshop_occurrences
  set status='published_open', published_at=coalesce(published_at,now()), updated_by=auth.uid()
  where workshop_occurrence_id=p_workshop_occurrence_id
  returning * into v_occurrence;
  insert into public.workshop_audit_events(
    workshop_definition_id,workshop_occurrence_id,event_type,actor_type,
    actor_id,command_key,safe_metadata
  ) values (
    v_occurrence.workshop_definition_id,v_occurrence.workshop_occurrence_id,
    'occurrence_published','internal',auth.uid(),p_command_key,
    jsonb_build_object('occurrenceId',v_occurrence.workshop_occurrence_id)
  );
  return to_jsonb(v_occurrence);
end;
$$;

create or replace function public.archive_workshop_occurrence(
  p_workshop_occurrence_id uuid,
  p_command_key uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_occurrence public.workshop_occurrences;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized' using errcode='42501'; end if;
  select * into v_occurrence from public.workshop_occurrences
    where workshop_occurrence_id=p_workshop_occurrence_id for update;
  if not found then raise exception 'workshop occurrence not found' using errcode='P0002'; end if;
  if v_occurrence.status not in ('cancelled','rescheduled','completed') then
    raise exception 'only terminal workshop occurrences can be archived' using errcode='55000';
  end if;
  update public.workshop_occurrences set status='archived',archived_at=now(),updated_by=auth.uid()
    where workshop_occurrence_id=p_workshop_occurrence_id returning * into v_occurrence;
  insert into public.workshop_audit_events(workshop_definition_id,workshop_occurrence_id,event_type,actor_type,actor_id,command_key,safe_metadata)
  values(v_occurrence.workshop_definition_id,v_occurrence.workshop_occurrence_id,'occurrence_archived','internal',auth.uid(),p_command_key,jsonb_build_object('occurrenceId',v_occurrence.workshop_occurrence_id));
  return to_jsonb(v_occurrence);
end; $$;

create or replace function public.delete_workshop_occurrence(
  p_workshop_occurrence_id uuid,
  p_command_key uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_occurrence public.workshop_occurrences;
  v_booking_count bigint;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized' using errcode='42501'; end if;
  if p_command_key is null then raise exception 'invalid request' using errcode='22023'; end if;
  select * into v_occurrence from public.workshop_occurrences
    where workshop_occurrence_id=p_workshop_occurrence_id for update;
  if not found then return jsonb_build_object('deleted',true); end if;
  select count(*) into v_booking_count
  from public.workshop_bookings
  where workshop_occurrence_id=p_workshop_occurrence_id;
  if v_booking_count > 0 then
    raise exception 'workshop occurrence has booked reservations'
      using errcode='55000', detail=v_booking_count::text;
  end if;
  delete from public.workshop_media where workshop_occurrence_id=p_workshop_occurrence_id;
  delete from public.workshop_audit_events where workshop_occurrence_id=p_workshop_occurrence_id;
  delete from public.workshop_occurrences where workshop_occurrence_id=p_workshop_occurrence_id;
  return jsonb_build_object('deleted',true,'commandKey',p_command_key);
end; $$;

revoke all on function public.publish_workshop_occurrence(uuid,uuid) from public;
revoke all on function public.archive_workshop_occurrence(uuid,uuid) from public;
revoke all on function public.delete_workshop_occurrence(uuid,uuid) from public;
grant execute on function public.publish_workshop_occurrence(uuid,uuid) to authenticated;
grant execute on function public.archive_workshop_occurrence(uuid,uuid) to authenticated;
grant execute on function public.delete_workshop_occurrence(uuid,uuid) to authenticated;

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
    'locality','region','postalCode','country','terms','externalCheckoutUrl'
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
    external_checkout_url = case when p_patch ? 'externalCheckoutUrl' then nullif(btrim(p_patch->>'externalCheckoutUrl'),'') else external_checkout_url end,
    stripe_enabled = case when nullif(btrim(p_patch->>'externalCheckoutUrl'),'') is not null then false else case when p_patch ? 'stripeEnabled' then (p_patch->>'stripeEnabled')::boolean else stripe_enabled end end,
    venmo_enabled = false,
    waitlist_enabled = case when nullif(btrim(p_patch->>'externalCheckoutUrl'),'') is not null then false else case when p_patch ? 'waitlistEnabled' then (p_patch->>'waitlistEnabled')::boolean else waitlist_enabled end end,
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

create or replace function public.workshop_public_series_slug(p_title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    pg_catalog.btrim(pg_catalog.left(
      pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.btrim(p_title)), '[^a-z0-9]+', '-', 'g'),
      80
    ), '-'),
    ''
  );
$$;

revoke all on function public.workshop_public_series_slug(text) from public;

create or replace function public.get_workshop_public_remaining_seats(
  p_workshop_occurrence_id uuid
) returns integer
language sql stable security definer set search_path = ''
as $$
  with facts as (
    select o.capacity,
      greatest(o.capacity - coalesce((
        select sum(h.quantity)
        from public.workshop_seat_holds h
        where h.workshop_occurrence_id = o.workshop_occurrence_id
          and (
            h.state = 'confirmed'
            or (h.state = 'active' and h.effective_expires_at > now())
          )
      ), 0), 0)::integer as remaining
    from public.workshop_occurrences o
    where o.workshop_occurrence_id = p_workshop_occurrence_id
      and o.external_checkout_url is null
  )
  select case
    when remaining > 0 and remaining * 2 <= capacity then remaining
    else null
  end
  from facts;
$$;

revoke all on function public.get_workshop_public_remaining_seats(uuid) from public;

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
  "externalCheckoutUrl" text, "updatedAt" timestamptz
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
    o.is_featured, o.featured_order, o.external_checkout_url, o.updated_at
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
    'externalCheckoutUrl', o.external_checkout_url,
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
    'waitlistEligible', false,
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

    if v_occurrence.external_checkout_url is not null then
      raise exception 'external_checkout_required' using errcode = '55000';
    end if;

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
      'methods', case when v_occurrence.stripe_enabled
        then jsonb_build_array('stripe') else '[]'::jsonb end
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

  if v_occurrence.external_checkout_url is not null then
    raise exception 'external_checkout_required' using errcode = '55000';
  end if;
  if not v_occurrence.stripe_enabled then
    raise exception 'payment_method_unavailable';
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
    'methods', jsonb_build_array('stripe')
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
  p_stripe_hold_minutes integer default 15
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
    if v_occurrence.external_checkout_url is not null then
      raise exception 'external_checkout_required' using errcode = '55000';
    end if;
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

  if v_occurrence.external_checkout_url is not null then
    raise exception 'external_checkout_required' using errcode = '55000';
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
  text, text, uuid, integer
) from public;
grant execute on function public.switch_workshop_payment_method(
  text, text, uuid, integer
) to service_role;

create or replace function public.manage_workshop_waitlist(
  p_action text,
  p_payload jsonb,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_occurrence public.workshop_occurrences;
  v_entry public.workshop_waitlist_entries;
  v_offer public.workshop_waitlist_offers;
  v_hold public.workshop_seat_holds;
  v_booking public.workshop_bookings;
  v_reserved bigint;
  v_available integer;
  v_quantity integer;
  v_duration integer;
  v_expires timestamptz;
  v_result jsonb;
begin
  if p_command_key is null then raise exception 'invalid request' using errcode='22023'; end if;

  select * into v_entry from public.workshop_waitlist_entries
  where command_key=p_command_key;
  if found then
    return jsonb_build_object('replayed',true,'state',v_entry.state,
      'entryId',v_entry.workshop_waitlist_entry_id);
  end if;
  select * into v_offer from public.workshop_waitlist_offers
  where command_key=p_command_key or resolution_command_key=p_command_key;
  if found then
    return jsonb_build_object('replayed',true,'state',v_offer.state,
      'entryId',v_offer.workshop_waitlist_entry_id,
      'offerId',v_offer.workshop_waitlist_offer_id,'quantity',v_offer.quantity,
      'effectiveExpiresAt',v_offer.expires_at);
  end if;

  if p_action='join' then
    v_quantity:=(p_payload->>'quantity')::integer;
    select * into v_occurrence from public.workshop_occurrences
    where slug=p_payload->>'occurrenceSlug' for update;
    if not found or v_occurrence.status<>'published_open'
      or v_occurrence.external_checkout_url is not null
      or not v_occurrence.waitlist_enabled
      or now()>=least(v_occurrence.registration_closes_at,v_occurrence.start_at)
    then raise exception 'waitlist unavailable' using errcode='P0001'; end if;
    if v_quantity<=0 or v_quantity>v_occurrence.per_booking_limit
      or char_length(btrim(coalesce(p_payload->>'contactName',''))) not between 1 and 160
      or char_length(btrim(coalesce(p_payload->>'contactEmail',''))) not between 3 and 320
      or char_length(coalesce(p_payload->>'withdrawalTokenDigest',''))<43
    then raise exception 'invalid request' using errcode='22023'; end if;
    insert into public.workshop_waitlist_entries(
      workshop_occurrence_id,contact_name,contact_email,requested_quantity,
      withdrawal_token_digest,command_key
    ) values(
      v_occurrence.workshop_occurrence_id,btrim(p_payload->>'contactName'),
      lower(btrim(p_payload->>'contactEmail')),v_quantity,
      p_payload->>'withdrawalTokenDigest',p_command_key
    ) returning * into v_entry;
    return jsonb_build_object('replayed',false,'state','waiting',
      'entryId',v_entry.workshop_waitlist_entry_id);
  elsif p_action='offer_next' then
    if not public.is_internal_crm_user() then
      raise exception 'not authorized' using errcode='42501';
    end if;
    v_duration:=coalesce((p_payload->>'durationMinutes')::integer,1440);
    if v_duration not between 60 and 4320
      or (nullif(p_payload->>'offerTokenDigest','') is not null
        and char_length(p_payload->>'offerTokenDigest')<43)
    then raise exception 'invalid offer' using errcode='22023'; end if;
    select * into v_occurrence from public.workshop_occurrences
    where workshop_occurrence_id=(p_payload->>'occurrenceId')::uuid for update;
    if not found or v_occurrence.external_checkout_url is not null
      or not v_occurrence.waitlist_enabled
      or v_occurrence.status<>'published_open'
      or now()>=least(v_occurrence.registration_closes_at,v_occurrence.start_at)
    then raise exception 'waitlist unavailable' using errcode='P0001'; end if;
    update public.workshop_waitlist_offers set state='expired',resolved_at=now()
    where workshop_occurrence_id=v_occurrence.workshop_occurrence_id
      and state='active' and expires_at<=now();
    update public.workshop_seat_holds h set state='expired',resolved_at=now(),
      resolution_reason='waitlist_offer_expired'
    where h.workshop_occurrence_id=v_occurrence.workshop_occurrence_id
      and h.state='active' and h.effective_expires_at<=now();
    update public.workshop_waitlist_entries e set state='expired'
    where e.state='offered' and exists(
      select 1 from public.workshop_waitlist_offers o
      where o.workshop_waitlist_entry_id=e.workshop_waitlist_entry_id
        and o.state='expired'
    );
    select coalesce(sum(quantity),0) into v_reserved
    from public.workshop_seat_holds
    where workshop_occurrence_id=v_occurrence.workshop_occurrence_id
      and (state='confirmed' or (state='active' and effective_expires_at>now()));
    v_available:=v_occurrence.capacity-v_reserved;
    if v_available<=0 then
      return jsonb_build_object('replayed',false,'state','no_capacity');
    end if;
    select * into v_entry from public.workshop_waitlist_entries
    where workshop_occurrence_id=v_occurrence.workshop_occurrence_id
      and state='waiting' order by created_at,workshop_waitlist_entry_id
    limit 1 for update skip locked;
    if not found then return jsonb_build_object('replayed',false,'state','empty'); end if;
    v_quantity:=least(v_entry.requested_quantity,v_available);
    v_expires:=least(now()+make_interval(mins=>v_duration),
      v_occurrence.registration_closes_at,v_occurrence.start_at);
    insert into public.workshop_seat_holds(
      workshop_occurrence_id,quantity,state,payment_method,normal_expires_at,
      effective_expires_at,command_key
    ) values(
      v_occurrence.workshop_occurrence_id,v_quantity,'active',null,
      now()+make_interval(mins=>v_duration),v_expires,p_command_key
    ) returning * into v_hold;
    insert into public.workshop_waitlist_offers(
      workshop_waitlist_entry_id,workshop_occurrence_id,workshop_seat_hold_id,
      quantity,offer_token_digest,expires_at,command_key
    ) values(
      v_entry.workshop_waitlist_entry_id,v_occurrence.workshop_occurrence_id,
      v_hold.workshop_seat_hold_id,v_quantity,
      coalesce(nullif(p_payload->>'offerTokenDigest',''),
        repeat(md5(gen_random_uuid()::text),2)),
      v_expires,p_command_key
    ) returning * into v_offer;
    update public.workshop_waitlist_entries set state='offered'
    where workshop_waitlist_entry_id=v_entry.workshop_waitlist_entry_id;
    return jsonb_build_object('replayed',false,'state','active',
      'entryId',v_entry.workshop_waitlist_entry_id,
      'offerId',v_offer.workshop_waitlist_offer_id,'quantity',v_quantity,
      'effectiveExpiresAt',v_expires);
  elsif p_action='accept_offer' then
    select * into v_offer from public.workshop_waitlist_offers
    where offer_token_digest=p_payload->>'offerTokenDigest' for update;
    if not found or v_offer.state<>'active' then
      return jsonb_build_object('replayed',false,'state','unavailable');
    end if;
    select * into v_occurrence from public.workshop_occurrences
    where workshop_occurrence_id=v_offer.workshop_occurrence_id for update;
    if v_occurrence.external_checkout_url is not null then
      raise exception 'external_checkout_required' using errcode = '55000';
    end if;
    select * into v_entry from public.workshop_waitlist_entries
    where workshop_waitlist_entry_id=v_offer.workshop_waitlist_entry_id for update;
    if now()>=v_offer.expires_at then
      update public.workshop_waitlist_offers set state='expired',resolved_at=now(),
        resolution_command_key=p_command_key
      where workshop_waitlist_offer_id=v_offer.workshop_waitlist_offer_id
      returning * into v_offer;
      update public.workshop_waitlist_entries set state='expired'
      where workshop_waitlist_entry_id=v_entry.workshop_waitlist_entry_id;
      update public.workshop_seat_holds set state='expired',resolved_at=now(),
        resolution_reason='late_waitlist_acceptance'
      where workshop_seat_hold_id=v_offer.workshop_seat_hold_id and state='active';
      return jsonb_build_object('replayed',false,'state','expired',
        'offerId',v_offer.workshop_waitlist_offer_id);
    end if;
    if (p_payload->>'termsVersion')::integer<>v_occurrence.terms_version
      or char_length(coalesce(p_payload->>'statusTokenDigest',''))<43
    then raise exception 'terms changed' using errcode='P0001'; end if;
    insert into public.workshop_bookings(
      workshop_occurrence_id,booking_reference,status_token_digest,status_token_expires_at,
      contact_name,contact_email,purchased_quantity,active_quantity,
      price_per_seat_minor_snapshot,subtotal_minor_snapshot,total_minor_snapshot,
      required_charges_minor_snapshot,currency,terms_snapshot,terms_version
    ) values(
      v_occurrence.workshop_occurrence_id,
      'BBW-'||to_char(v_occurrence.start_at,'YYYY')||'-'
        ||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
      p_payload->>'statusTokenDigest',v_occurrence.end_at+interval '30 days',
      v_entry.contact_name,v_entry.contact_email,v_offer.quantity,v_offer.quantity,
      v_occurrence.price_minor,v_occurrence.price_minor*v_offer.quantity,
      v_occurrence.price_minor*v_offer.quantity,0,v_occurrence.currency,
      v_occurrence.terms_snapshot,v_occurrence.terms_version
    ) returning * into v_booking;
    update public.workshop_seat_holds set booking_id=v_booking.workshop_booking_id
    where workshop_seat_hold_id=v_offer.workshop_seat_hold_id;
    update public.workshop_waitlist_offers set state='accepted',resolved_at=now(),
      resolution_command_key=p_command_key
    where workshop_waitlist_offer_id=v_offer.workshop_waitlist_offer_id
    returning * into v_offer;
    update public.workshop_waitlist_entries set state='converted'
    where workshop_waitlist_entry_id=v_entry.workshop_waitlist_entry_id;
    return jsonb_build_object('replayed',false,'state','accepted',
      'bookingId',v_booking.workshop_booking_id,'quantity',v_offer.quantity,
      'effectiveExpiresAt',v_offer.expires_at);
  elsif p_action='decline_offer' then
    select * into v_offer from public.workshop_waitlist_offers
    where offer_token_digest=p_payload->>'offerTokenDigest' for update;
    if not found or v_offer.state<>'active' then
      return jsonb_build_object('replayed',false,'state','unavailable');
    end if;
    update public.workshop_waitlist_offers set state='cancelled',resolved_at=now(),
      resolution_command_key=p_command_key
    where workshop_waitlist_offer_id=v_offer.workshop_waitlist_offer_id
    returning * into v_offer;
    update public.workshop_waitlist_entries set state='withdrawn'
    where workshop_waitlist_entry_id=v_offer.workshop_waitlist_entry_id;
    update public.workshop_seat_holds set state='released',resolved_at=now(),
      resolution_reason='waitlist_offer_declined'
    where workshop_seat_hold_id=v_offer.workshop_seat_hold_id and state='active';
    return jsonb_build_object('replayed',false,'state','cancelled',
      'offerId',v_offer.workshop_waitlist_offer_id);
  else
    raise exception 'unsupported action' using errcode='22023';
  end if;
end;
$$;
revoke all on function public.manage_workshop_waitlist(text,jsonb,uuid) from public;
grant execute on function public.manage_workshop_waitlist(text,jsonb,uuid)
to authenticated,service_role;

create or replace function public.get_workshop_occurrence_operational_state(
  p_occurrence_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_occurrence public.workshop_occurrences;
  v_reserved bigint;
  v_remaining integer;
  v_waiting boolean;
  v_availability text;
begin
  if not public.is_internal_crm_user() then
    raise exception 'not authorized' using errcode='42501';
  end if;

  select * into v_occurrence
  from public.workshop_occurrences
  where workshop_occurrence_id=p_occurrence_id;
  if not found then
    raise exception 'occurrence not found' using errcode='P0002';
  end if;

  select coalesce(sum(quantity),0) into v_reserved
  from public.workshop_seat_holds
  where workshop_occurrence_id=p_occurrence_id
    and (
      state='confirmed'
      or (state='active' and effective_expires_at>now())
    );
  v_remaining:=greatest(v_occurrence.capacity-v_reserved,0);
  select exists(
    select 1 from public.workshop_waitlist_entries
    where workshop_occurrence_id=p_occurrence_id
      and state in('waiting','offered')
  ) into v_waiting;

  v_availability:=case
    when v_occurrence.status<>'published_open'
      or now()<v_occurrence.registration_opens_at
      or now()>=least(v_occurrence.registration_closes_at,v_occurrence.start_at)
      then 'closed'
    when v_remaining=0 and v_occurrence.waitlist_enabled then 'waitlist_available'
    when v_remaining=0 then 'sold_out'
    when v_remaining<=greatest(1,ceil(v_occurrence.capacity*.2)::integer)
      then 'limited'
    else 'available'
  end;

  return jsonb_build_object(
    'externalCheckoutUrl',v_occurrence.external_checkout_url,
    'occurrenceId',v_occurrence.workshop_occurrence_id,
    'lifecycle',v_occurrence.status,
    'availability',v_availability,
    'capacity',v_occurrence.capacity,
    'reservedQuantity',v_reserved,
    'remainingQuantity',v_remaining,
    'hasWaitingCustomers',v_waiting,
    'completionReviewRequired',
      v_occurrence.end_at<=now()
      and v_occurrence.status in('published_open','registration_closed')
  );
end;
$$;

create or replace function public.transition_workshop_occurrence(
  p_occurrence_id uuid,
  p_target_status text,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_occurrence public.workshop_occurrences;
  v_existing public.workshop_audit_events;
  v_allowed boolean:=false;
  v_actor uuid:=auth.uid();
  v_previous_status text;
begin
  if not public.is_internal_crm_user() then
    raise exception 'not authorized' using errcode='42501';
  end if;
  if p_command_key is null then
    raise exception 'invalid command' using errcode='22023';
  end if;

  select * into v_existing
  from public.workshop_audit_events
  where command_key=p_command_key and event_type='occurrence_lifecycle_transition';
  if found then
    return public.get_workshop_occurrence_operational_state(
      v_existing.workshop_occurrence_id
    )||jsonb_build_object('replayed',true);
  end if;

  select * into v_occurrence
  from public.workshop_occurrences
  where workshop_occurrence_id=p_occurrence_id
  for update;
  if not found then
    raise exception 'occurrence not found' using errcode='P0002';
  end if;
  v_previous_status:=v_occurrence.status;

  v_allowed:=case
    when v_occurrence.status='draft' and p_target_status='published_open'
      then true
    when v_occurrence.status='published_open'
      and p_target_status in('registration_closed','completed') then true
    when v_occurrence.status='registration_closed'
      and p_target_status='completed' then true
    when v_occurrence.status in('rescheduled','cancelled','completed')
      and p_target_status='archived' then true
    else false
  end;
  if not v_allowed then
    raise exception 'invalid lifecycle transition' using errcode='P0001';
  end if;
  if p_target_status='completed' and v_occurrence.end_at>now() then
    raise exception 'completion review is not yet available' using errcode='P0001';
  end if;

  update public.workshop_occurrences
  set status=p_target_status,
    published_at=case
      when p_target_status='published_open' then coalesce(published_at,now())
      else published_at
    end,
    completed_at=case when p_target_status='completed' then now() else completed_at end,
    archived_at=case when p_target_status='archived' then now() else archived_at end,
    updated_by=v_actor
  where workshop_occurrence_id=p_occurrence_id
  returning * into v_occurrence;

  insert into public.workshop_audit_events(
    workshop_definition_id,workshop_occurrence_id,event_type,actor_type,
    actor_id,command_key,safe_metadata
  ) values(
    v_occurrence.workshop_definition_id,p_occurrence_id,
    'occurrence_lifecycle_transition','internal',v_actor,p_command_key,
    jsonb_build_object(
      'fromStatus',v_previous_status,
      'toStatus',p_target_status
    )
  );

  return public.get_workshop_occurrence_operational_state(p_occurrence_id)
    ||jsonb_build_object('replayed',false);
end;
$$;

revoke all on function public.get_workshop_occurrence_operational_state(uuid)
from public;
revoke all on function public.transition_workshop_occurrence(uuid,text,uuid)
from public;
grant execute on function public.get_workshop_occurrence_operational_state(uuid)
to authenticated;
grant execute on function public.transition_workshop_occurrence(uuid,text,uuid)
to authenticated;

notify pgrst, 'reload schema';
