create or replace function public.apply_workshop_refund_seat_release(
  p_booking_id uuid,
  p_quantity integer,
  p_amount_minor bigint,
  p_reason text,
  p_command_key uuid,
  p_actor_type text,
  p_actor_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.workshop_bookings;
  v_adjustment public.workshop_booking_adjustments;
  v_new_active integer;
begin
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

  select * into v_booking from public.workshop_bookings
  where workshop_booking_id = p_booking_id for update;
  if not found or p_quantity is null or p_quantity <= 0
    or p_quantity > v_booking.active_quantity
    or p_amount_minor is null or p_amount_minor <= 0
    or p_actor_type not in ('internal', 'provider')
  then
    raise exception 'invalid refund seat release' using errcode = '22023';
  end if;

  v_new_active := v_booking.active_quantity - p_quantity;
  update public.workshop_bookings set
    active_quantity = v_new_active,
    status = case when v_new_active = 0 then 'cancelled' else status end,
    cancelled_at = case when v_new_active = 0 then now() else cancelled_at end
  where workshop_booking_id = v_booking.workshop_booking_id
  returning * into v_booking;

  update public.workshop_attendees set attendance_state = 'cancelled'
  where workshop_booking_id = v_booking.workshop_booking_id
    and seat_number > v_new_active and attendance_state <> 'cancelled';
  if v_new_active = 0 then
    update public.workshop_seat_holds set
      state = 'cancelled', resolved_at = coalesce(resolved_at, now()),
      resolution_reason = 'booking_refunded'
    where booking_id = v_booking.workshop_booking_id
      and state in ('active', 'confirmed');
  else
    update public.workshop_seat_holds set quantity = v_new_active
    where booking_id = v_booking.workshop_booking_id
      and state in ('active', 'confirmed');
  end if;

  insert into public.workshop_booking_adjustments(
    workshop_booking_id, adjustment_type, quantity_delta, amount_minor_delta,
    reason, command_key, actor_type, actor_id
  ) values (
    v_booking.workshop_booking_id,
    case when v_new_active = 0 then 'full_cancel' else 'partial_cancel' end,
    -p_quantity, -p_amount_minor,
    left(coalesce(nullif(btrim(p_reason), ''), 'seat refund'), 500),
    p_command_key, p_actor_type, p_actor_id
  );

  return jsonb_build_object(
    'replayed', false,
    'bookingId', v_booking.workshop_booking_id,
    'status', v_booking.status,
    'activeQuantity', v_booking.active_quantity
  );
end;
$$;

revoke all on function public.apply_workshop_refund_seat_release(
  uuid,integer,bigint,text,uuid,text,uuid
) from public, anon, authenticated;
