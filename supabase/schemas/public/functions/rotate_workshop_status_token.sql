create or replace function public.rotate_workshop_status_token(
  p_current_digest text,
  p_new_digest text,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.workshop_bookings;
  v_occurrence public.workshop_occurrences;
  v_qualifying_deadline timestamptz;
begin
  if char_length(coalesce(p_current_digest, '')) < 43
    or char_length(coalesce(p_new_digest, '')) < 43
    or p_current_digest = p_new_digest
  then
    raise exception 'invalid_request';
  end if;

  select * into v_booking
  from public.workshop_bookings
  where status_token_rotation_key = p_command_key
     or status_token_digest = p_current_digest
  for update;

  if not found then
    raise exception 'unavailable';
  end if;

  if v_booking.status_token_rotation_key = p_command_key then
    return jsonb_build_object(
      'replayed', true,
      'bookingId', v_booking.workshop_booking_id,
      'supportReference', v_booking.booking_reference,
      'expiresAt', v_booking.status_token_expires_at
    );
  end if;

  select * into v_occurrence
  from public.workshop_occurrences
  where workshop_occurrence_id = v_booking.workshop_occurrence_id;

  if to_regclass('public.workshop_reschedule_responses') is not null then
    execute $query$
      select max(response_token_expires_at)
      from public.workshop_reschedule_responses
      where workshop_booking_id = $1
        and response = 'pending'
    $query$
    into v_qualifying_deadline
    using v_booking.workshop_booking_id;
  end if;

  if to_regclass('public.workshop_payment_exceptions') is not null then
    execute $query$
      select greatest(
        $2,
        max(customer_action_deadline)
      )
      from public.workshop_payment_exceptions
      where workshop_booking_id = $1
        and state in ('open', 'acknowledged')
        and customer_action_deadline is not null
    $query$
    into v_qualifying_deadline
    using v_booking.workshop_booking_id, v_qualifying_deadline;
  end if;

  update public.workshop_bookings
  set status_token_digest = p_new_digest,
      status_token_expires_at = greatest(
        v_occurrence.end_at,
        coalesce(v_qualifying_deadline, v_occurrence.end_at)
      ) + interval '30 days',
      status_token_rotation_key = p_command_key
  where workshop_booking_id = v_booking.workshop_booking_id
  returning * into v_booking;

  return jsonb_build_object(
    'replayed', false,
    'bookingId', v_booking.workshop_booking_id,
    'supportReference', v_booking.booking_reference,
    'expiresAt', v_booking.status_token_expires_at
  );
end;
$$;

revoke all on function public.rotate_workshop_status_token(text, text, uuid) from public;
grant execute on function public.rotate_workshop_status_token(text, text, uuid) to service_role;
