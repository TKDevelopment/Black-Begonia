create or replace function public.manage_workshop_roster(
  p_action text,
  p_payload jsonb,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_occurrence public.workshop_occurrences;
  v_booking public.workshop_bookings;
  v_adjustment public.workshop_booking_adjustments;
  v_attendee public.workshop_attendees;
  v_quantity integer;
  v_reserved bigint;
  v_mode text;
  v_new_active integer;
  v_status_digest text;
  v_audit public.workshop_audit_events;
begin
  if not public.is_internal_crm_user() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_command_key is null then
    raise exception 'invalid request' using errcode = '22023';
  end if;

  select * into v_adjustment
  from public.workshop_booking_adjustments
  where command_key = p_command_key;
  if found then
    select * into v_booking from public.workshop_bookings
    where workshop_booking_id = v_adjustment.workshop_booking_id;
    return jsonb_build_object(
      'replayed', true,
      'bookingId', v_booking.workshop_booking_id,
      'status', v_booking.status,
      'activeQuantity', v_booking.active_quantity
    );
  end if;
  select * into v_audit from public.workshop_audit_events
  where command_key=p_command_key and event_type='attendee_checked_in';
  if found then
    return v_audit.safe_metadata||jsonb_build_object('replayed',true);
  end if;

  if p_action = 'create_reservation' then
    v_quantity := (p_payload->>'quantity')::integer;
    v_mode := p_payload->>'reservationType';
    v_status_digest := p_payload->>'statusTokenDigest';
    if v_quantity <= 0
      or v_mode not in ('manual','complimentary')
      or char_length(coalesce(v_status_digest,'')) < 43
      or char_length(btrim(coalesce(p_payload->>'contactName',''))) not between 1 and 160
      or char_length(btrim(coalesce(p_payload->>'contactEmail',''))) not between 3 and 320
    then
      raise exception 'invalid request' using errcode = '22023';
    end if;

    select * into v_occurrence
    from public.workshop_occurrences
    where workshop_occurrence_id = (p_payload->>'occurrenceId')::uuid
    for update;
    if not found or v_occurrence.status not in ('published_open','registration_closed') then
      raise exception 'occurrence unavailable' using errcode = 'P0001';
    end if;

    update public.workshop_seat_holds
    set state='expired', resolved_at=now(), resolution_reason='effective_deadline_elapsed'
    where workshop_occurrence_id=v_occurrence.workshop_occurrence_id
      and state='active' and effective_expires_at<=now();
    select coalesce(sum(quantity),0) into v_reserved
    from public.workshop_seat_holds
    where workshop_occurrence_id=v_occurrence.workshop_occurrence_id
      and (state='confirmed' or (state='active' and effective_expires_at>now()));
    if v_reserved + v_quantity > v_occurrence.capacity then
      raise exception 'insufficient capacity' using errcode = 'P0001';
    end if;

    insert into public.workshop_bookings(
      workshop_occurrence_id, booking_reference, status_token_digest,
      status_token_expires_at, contact_name, contact_email, contact_phone,
      purchased_quantity, active_quantity, status, payment_state,
      price_per_seat_minor_snapshot, subtotal_minor_snapshot,
      total_minor_snapshot, required_charges_minor_snapshot, currency,
      terms_snapshot, terms_version, confirmed_at
    ) values (
      v_occurrence.workshop_occurrence_id,
      'BBW-'||to_char(v_occurrence.start_at,'YYYY')||'-'
        ||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
      v_status_digest, v_occurrence.end_at+interval '30 days',
      btrim(p_payload->>'contactName'), lower(btrim(p_payload->>'contactEmail')),
      nullif(btrim(coalesce(p_payload->>'contactPhone','')),''),
      v_quantity, v_quantity, 'confirmed',
      case when v_mode='complimentary' then 'paid' else 'unselected' end,
      v_occurrence.price_minor, v_occurrence.price_minor*v_quantity,
      v_occurrence.price_minor*v_quantity, 0, v_occurrence.currency,
      v_occurrence.terms_snapshot, v_occurrence.terms_version, now()
    ) returning * into v_booking;

    insert into public.workshop_seat_holds(
      workshop_occurrence_id, booking_id, quantity, state, payment_method,
      normal_expires_at, effective_expires_at, resolved_at, resolution_reason,
      command_key
    ) values (
      v_occurrence.workshop_occurrence_id, v_booking.workshop_booking_id,
      v_quantity, 'confirmed', null, v_occurrence.end_at, v_occurrence.end_at,
      now(), v_mode, p_command_key
    );
    insert into public.workshop_attendees(workshop_booking_id,seat_number)
    select v_booking.workshop_booking_id, generate_series(1,v_quantity);
    insert into public.workshop_booking_adjustments(
      workshop_booking_id, adjustment_type, quantity_delta, amount_minor_delta,
      reason, command_key, actor_type, actor_id
    ) values (
      v_booking.workshop_booking_id, v_mode, v_quantity,
      case when v_mode='complimentary' then -v_booking.total_minor_snapshot else 0 end,
      coalesce(nullif(btrim(p_payload->>'reason'),''),v_mode||' reservation'),
      p_command_key, 'internal', auth.uid()
    );
    return jsonb_build_object(
      'replayed', false, 'bookingId', v_booking.workshop_booking_id,
      'status', v_booking.status, 'activeQuantity', v_booking.active_quantity
    );
  elsif p_action = 'cancel_seats' then
    v_quantity := (p_payload->>'quantity')::integer;
    select * into v_booking from public.workshop_bookings
    where workshop_booking_id=(p_payload->>'bookingId')::uuid for update;
    if not found or v_quantity <= 0 or v_quantity > v_booking.active_quantity then
      raise exception 'invalid cancellation' using errcode = '22023';
    end if;
    v_new_active := v_booking.active_quantity-v_quantity;
    update public.workshop_bookings set
      active_quantity=v_new_active,
      status=case when v_new_active=0 then 'cancelled' else status end,
      cancelled_at=case when v_new_active=0 then now() else cancelled_at end
    where workshop_booking_id=v_booking.workshop_booking_id returning * into v_booking;
    update public.workshop_attendees set attendance_state='cancelled'
    where workshop_booking_id=v_booking.workshop_booking_id
      and seat_number>v_new_active and attendance_state<>'cancelled';
    if v_new_active=0 then
      update public.workshop_seat_holds set
        state='cancelled', resolved_at=coalesce(resolved_at,now()),
        resolution_reason='booking_cancelled'
      where booking_id=v_booking.workshop_booking_id and state in ('active','confirmed');
    else
      update public.workshop_seat_holds set quantity=v_new_active
      where booking_id=v_booking.workshop_booking_id and state in ('active','confirmed');
    end if;
    insert into public.workshop_booking_adjustments(
      workshop_booking_id, adjustment_type, quantity_delta, amount_minor_delta,
      reason, command_key, actor_type, actor_id
    ) values (
      v_booking.workshop_booking_id,
      case when v_new_active=0 then 'full_cancel' else 'partial_cancel' end,
      -v_quantity, 0, coalesce(nullif(btrim(p_payload->>'reason'),''),'seat cancellation'),
      p_command_key, 'internal', auth.uid()
    );
    return jsonb_build_object(
      'replayed', false, 'bookingId', v_booking.workshop_booking_id,
      'status', v_booking.status, 'activeQuantity', v_booking.active_quantity
    );
  elsif p_action = 'check_in' then
    select * into v_attendee from public.workshop_attendees
    where workshop_attendee_id=(p_payload->>'attendeeId')::uuid for update;
    if not found or v_attendee.attendance_state='cancelled' then
      raise exception 'attendee unavailable' using errcode = 'P0001';
    end if;
    update public.workshop_attendees set
      attendance_state='checked_in', checked_in_at=coalesce(checked_in_at,now()),
      checked_in_by=coalesce(checked_in_by,auth.uid())
    where workshop_attendee_id=v_attendee.workshop_attendee_id returning * into v_attendee;
    update public.workshop_bookings set
      status='checked_in', checked_in_at=coalesce(checked_in_at,now())
    where workshop_booking_id=v_attendee.workshop_booking_id returning * into v_booking;
    insert into public.workshop_audit_events(
      workshop_occurrence_id,event_type,actor_type,actor_id,command_key,safe_metadata
    ) values (
      v_booking.workshop_occurrence_id,'attendee_checked_in','internal',auth.uid(),
      p_command_key,jsonb_build_object(
        'bookingId',v_attendee.workshop_booking_id,
        'attendeeId',v_attendee.workshop_attendee_id,
        'attendanceState','checked_in'
      )
    );
    return jsonb_build_object(
      'replayed', false, 'bookingId', v_attendee.workshop_booking_id,
      'attendeeId', v_attendee.workshop_attendee_id, 'attendanceState','checked_in'
    );
  else
    raise exception 'unsupported action' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.get_minimized_workshop_roster(p_occurrence_id uuid)
returns table(
  booking_reference text,
  contact_name text,
  active_quantity integer,
  booking_status text,
  seat_number smallint,
  attendee_name text,
  attendance_state text
)
language sql
stable
security definer
set search_path=''
as $$
  select b.booking_reference, b.contact_name, b.active_quantity, b.status,
    a.seat_number, a.display_name, a.attendance_state
  from public.workshop_bookings b
  join public.workshop_attendees a using(workshop_booking_id)
  where public.is_internal_crm_user()
    and b.workshop_occurrence_id=p_occurrence_id
    and a.attendance_state<>'cancelled'
  order by b.created_at,a.seat_number;
$$;

revoke all on function public.manage_workshop_roster(text,jsonb,uuid) from public;
revoke all on function public.get_minimized_workshop_roster(uuid) from public;
grant execute on function public.manage_workshop_roster(text,jsonb,uuid) to authenticated;
grant execute on function public.get_minimized_workshop_roster(uuid) to authenticated;
