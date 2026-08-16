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
    if not found or not v_occurrence.waitlist_enabled
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
