create or replace function public.recover_workshop_status_access(
  p_contact_email text,
  p_support_reference text,
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
  if char_length(coalesce(p_new_digest, '')) < 43 then
    raise exception 'invalid_request';
  end if;

  select * into v_booking
  from public.workshop_bookings
  where status_token_rotation_key = p_command_key
     or (
       lower(contact_email) = lower(btrim(p_contact_email))
       and booking_reference = upper(btrim(p_support_reference))
     )
  order by (status_token_rotation_key = p_command_key) desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('matched', false, 'replayed', false);
  end if;

  if v_booking.status_token_rotation_key = p_command_key then
    return jsonb_build_object(
      'matched', true,
      'replayed', true,
      'bookingId', v_booking.workshop_booking_id,
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
      select greatest($2, max(customer_action_deadline))
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
    'matched', true,
    'replayed', false,
    'bookingId', v_booking.workshop_booking_id,
    'expiresAt', v_booking.status_token_expires_at
  );
end;
$$;

revoke all on function public.recover_workshop_status_access(
  text, text, text, uuid
) from public;
grant execute on function public.recover_workshop_status_access(
  text, text, text, uuid
) to service_role;
