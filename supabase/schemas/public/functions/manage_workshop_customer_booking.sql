create or replace function public.manage_workshop_customer_booking(
  p_action text,
  p_payload jsonb,
  p_command_key uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_booking public.workshop_bookings;
  v_adjustment public.workshop_booking_adjustments;
  v_exception public.workshop_payment_exceptions;
  v_quantity integer;
  v_active integer;
  v_refund_state text;
begin
  if p_action<>'cancel_seats' or p_command_key is null then
    raise exception 'invalid request' using errcode='22023';
  end if;
  select * into v_adjustment from public.workshop_booking_adjustments
  where command_key=p_command_key;
  if found then
    select * into v_booking from public.workshop_bookings
    where workshop_booking_id=v_adjustment.workshop_booking_id;
    return jsonb_build_object('replayed',true,
      'state',case when v_booking.active_quantity=0
        then 'cancelled' else 'partially_cancelled' end,
      'activeQuantity',v_booking.active_quantity,
      'refundProcessingState',case
        when v_booking.payment_state in('paid','partially_refunded')
          then 'pending_review' else 'not_required' end);
  end if;
  select * into v_exception from public.workshop_payment_exceptions
  where command_key=p_command_key;
  if found then
    return jsonb_build_object('replayed',true,'state','action_required',
      'refundProcessingState','pending_review');
  end if;
  v_quantity:=(p_payload->>'quantity')::integer;
  select * into v_booking from public.workshop_bookings
  where status_token_digest=p_payload->>'statusTokenDigest'
    and status_token_expires_at>now() for update;
  if not found or v_booking.status not in('pending_payment','confirmed')
    or v_quantity<=0 or v_quantity>v_booking.active_quantity
  then return jsonb_build_object('replayed',false,'state','unavailable'); end if;
  if v_booking.payment_state in('processing','disputed','exception') then
    insert into public.workshop_payment_exceptions(
      workshop_booking_id,workshop_occurrence_id,exception_type,urgency,
      amount_minor,currency,summary,command_key
    ) values(
      v_booking.workshop_booking_id,v_booking.workshop_occurrence_id,
      'customer_cancellation_race','urgent',
      v_booking.price_per_seat_minor_snapshot*v_quantity,v_booking.currency,
      'Customer cancellation requires payment review',p_command_key
    );
    return jsonb_build_object('replayed',false,'state','action_required',
      'activeQuantity',v_booking.active_quantity,
      'refundProcessingState','pending_review');
  end if;
  v_active:=v_booking.active_quantity-v_quantity;
  update public.workshop_bookings set active_quantity=v_active,
    status=case when v_active=0 then 'cancelled' else status end,
    cancelled_at=case when v_active=0 then now() else cancelled_at end
  where workshop_booking_id=v_booking.workshop_booking_id returning * into v_booking;
  update public.workshop_attendees set attendance_state='cancelled'
  where workshop_booking_id=v_booking.workshop_booking_id
    and seat_number>v_active and attendance_state<>'cancelled';
  if v_active=0 then
    update public.workshop_seat_holds set state='cancelled',
      resolved_at=coalesce(resolved_at,now()),
      resolution_reason='customer_cancellation'
    where booking_id=v_booking.workshop_booking_id and state in('active','confirmed');
  else
    update public.workshop_seat_holds set quantity=v_active
    where booking_id=v_booking.workshop_booking_id and state in('active','confirmed');
  end if;
  update public.workshop_payment_attempts set state='cancelled',
    resolved_at=coalesce(resolved_at,now())
  where workshop_booking_id=v_booking.workshop_booking_id
    and state in('creating','active');
  insert into public.workshop_booking_adjustments(
    workshop_booking_id,adjustment_type,quantity_delta,amount_minor_delta,
    reason,command_key,actor_type
  ) values(
    v_booking.workshop_booking_id,
    case when v_active=0 then 'full_cancel' else 'partial_cancel' end,
    -v_quantity,0,'customer requested seat cancellation',p_command_key,'customer'
  );
  v_refund_state:=case when v_booking.payment_state in('paid','partially_refunded')
    then 'pending_review' else 'not_required' end;
  if v_refund_state='pending_review' then
    insert into public.workshop_payment_exceptions(
      workshop_booking_id,workshop_occurrence_id,exception_type,urgency,
      amount_minor,currency,summary,command_key
    ) values(
      v_booking.workshop_booking_id,v_booking.workshop_occurrence_id,
      'customer_cancellation_refund','normal',
      v_booking.price_per_seat_minor_snapshot*v_quantity,v_booking.currency,
      'Customer cancellation requires refund review',p_command_key
    );
  end if;
  return jsonb_build_object('replayed',false,
    'state',case when v_active=0 then 'cancelled' else 'partially_cancelled' end,
    'activeQuantity',v_active,'refundProcessingState',v_refund_state);
end;
$$;
revoke all on function public.manage_workshop_customer_booking(text,jsonb,uuid)
from public;
grant execute on function public.manage_workshop_customer_booking(text,jsonb,uuid)
to service_role;
