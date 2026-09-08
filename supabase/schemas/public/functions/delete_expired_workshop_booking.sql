create or replace function public.delete_expired_workshop_booking(
  p_booking_id uuid,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.workshop_bookings;
  v_audit public.workshop_audit_events;
begin
  if not public.is_internal_crm_user() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_booking_id is null or p_command_key is null then
    raise exception 'invalid request' using errcode = '22023';
  end if;

  select * into v_audit
  from public.workshop_audit_events
  where command_key = p_command_key
    and event_type = 'expired_booking_deleted';
  if found then
    return v_audit.safe_metadata || jsonb_build_object('replayed', true);
  end if;

  select * into v_booking
  from public.workshop_bookings
  where workshop_booking_id = p_booking_id
  for update;
  if not found then
    raise exception 'booking unavailable' using errcode = 'P0001';
  end if;
  if v_booking.status <> 'expired' then
    raise exception 'only expired bookings can be deleted' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.workshop_payment_transactions
    where workshop_booking_id = p_booking_id
  ) or exists (
    select 1 from public.workshop_refund_requests
    where workshop_booking_id = p_booking_id
  ) or exists (
    select 1 from public.workshop_communications
    where workshop_booking_id = p_booking_id
  ) or exists (
    select 1 from public.workshop_personal_data_requests
    where workshop_booking_id = p_booking_id
  ) or exists (
    select 1 from public.workshop_reschedule_responses
    where workshop_booking_id = p_booking_id
  ) then
    raise exception 'protected booking history must be retained' using errcode = '55000';
  end if;

  -- Provider evidence and exception records remain durable but no longer retain
  -- a foreign-key link to an abandoned booking or its removable attempt.
  update public.workshop_payment_provider_events
  set workshop_payment_attempt_id = null
  where workshop_payment_attempt_id in (
    select workshop_payment_attempt_id
    from public.workshop_payment_attempts
    where workshop_booking_id = p_booking_id
  );
  update public.workshop_payment_exceptions
  set workshop_booking_id = null,
      workshop_payment_attempt_id = null
  where workshop_booking_id = p_booking_id
     or workshop_payment_attempt_id in (
       select workshop_payment_attempt_id
       from public.workshop_payment_attempts
       where workshop_booking_id = p_booking_id
     );

  delete from public.workshop_message_queue
  where workshop_booking_id = p_booking_id;
  delete from public.workshop_analytics_outcome_grants
  where workshop_booking_id = p_booking_id;
  delete from public.workshop_communication_suppressions
  where workshop_booking_id = p_booking_id;
  delete from public.workshop_booking_adjustments
  where workshop_booking_id = p_booking_id;
  delete from public.workshop_attendees
  where workshop_booking_id = p_booking_id;
  delete from public.workshop_payment_attempts
  where workshop_booking_id = p_booking_id;
  delete from public.workshop_seat_holds
  where booking_id = p_booking_id;
  delete from public.workshop_bookings
  where workshop_booking_id = p_booking_id;

  insert into public.workshop_audit_events(
    workshop_occurrence_id,
    event_type,
    actor_type,
    actor_id,
    command_key,
    safe_metadata
  ) values (
    v_booking.workshop_occurrence_id,
    'expired_booking_deleted',
    'internal',
    auth.uid(),
    p_command_key,
    jsonb_build_object(
      'bookingId', p_booking_id,
      'status', 'deleted',
      'activeQuantity', 0
    )
  );

  return jsonb_build_object(
    'replayed', false,
    'bookingId', p_booking_id,
    'status', 'deleted',
    'activeQuantity', 0
  );
end;
$$;

revoke all on function public.delete_expired_workshop_booking(uuid, uuid) from public;
grant execute on function public.delete_expired_workshop_booking(uuid, uuid) to authenticated;
