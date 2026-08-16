create or replace function public.get_workshop_booking_status(
  p_status_token_digest text
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_booking public.workshop_bookings;
  v_occurrence public.workshop_occurrences;
  v_attempt public.workshop_payment_attempts;
  v_response public.workshop_reschedule_responses;
  v_source public.workshop_occurrences;
  v_replacement public.workshop_occurrences;
begin
  if char_length(coalesce(p_status_token_digest, '')) < 43 then
    return jsonb_build_object('state', 'unavailable');
  end if;

  select * into v_booking
  from public.workshop_bookings
  where status_token_digest = p_status_token_digest
    and status_token_expires_at > now();

  if not found then
    return jsonb_build_object('state', 'unavailable');
  end if;

  select * into v_occurrence
  from public.workshop_occurrences
  where workshop_occurrence_id = v_booking.workshop_occurrence_id;

  select * into v_attempt
  from public.workshop_payment_attempts
  where workshop_booking_id = v_booking.workshop_booking_id
  order by created_at desc
  limit 1;

  if v_booking.status in ('confirmed', 'checked_in', 'transferred')
    and v_booking.payment_state in ('paid', 'partially_refunded')
  then
    return jsonb_build_object(
      'state', 'confirmed',
      'publicWorkshopPath', '/workshops/'
        || public.workshop_public_series_slug(v_occurrence.title_snapshot)
        || '/' || v_occurrence.local_start::date::text,
      'workshopTitle', v_occurrence.title_snapshot,
      'startAt', v_occurrence.start_at,
      'endAt', v_occurrence.end_at,
      'timezone', v_occurrence.timezone,
      'venueName', v_occurrence.venue_name,
      'addressLine1', v_occurrence.address_line_1,
      'addressLine2', v_occurrence.address_line_2,
      'locality', v_occurrence.locality,
      'region', v_occurrence.region,
      'postalCode', v_occurrence.postal_code,
      'activeQuantity', v_booking.active_quantity,
      'termsSnapshot', v_booking.terms_snapshot
    );
  end if;

  if v_booking.payment_state = 'refunded' then
    return jsonb_build_object('state', 'refunded');
  end if;

  if v_booking.status = 'cancelled' then
    return jsonb_build_object('state', 'cancelled');
  end if;

  if v_booking.status = 'expired' then
    return jsonb_build_object('state', 'expired');
  end if;

  if v_booking.status = 'transfer_action_required' then
    select * into v_response from public.workshop_reschedule_responses
    where workshop_booking_id=v_booking.workshop_booking_id
      and response in('pending','expired')
    order by created_at desc limit 1;
    if found then
      select * into v_source from public.workshop_occurrences
      where workshop_occurrence_id=v_response.source_occurrence_id;
      select * into v_replacement from public.workshop_occurrences
      where workshop_occurrence_id=v_response.replacement_occurrence_id;
      return jsonb_build_object(
        'state','action_required','action','reschedule',
        'responseState',v_response.response,
        'responseDeadline',v_response.response_token_expires_at,
        'sourceTitle',v_source.title_snapshot,
        'sourceStartAt',v_source.start_at,
        'replacementTitle',v_replacement.title_snapshot,
        'replacementStartAt',v_replacement.start_at,
        'replacementVenue',v_replacement.venue_name,
        'protectedQuantity',v_response.protected_quantity
      );
    end if;
  end if;

  if v_booking.payment_state in ('exception', 'disputed', 'reversed')
    or v_booking.status in ('payment_disputed', 'transfer_action_required')
  then
    return jsonb_build_object('state', 'action_required');
  end if;

  if v_booking.payment_state = 'processing'
    or v_attempt.state = 'processing'
  then
    return jsonb_build_object(
      'state', 'processing',
      'supportReference', v_booking.booking_reference
    );
  end if;

  if v_booking.payment_method = 'direct_venmo'
    and v_attempt.state = 'active'
    and v_attempt.effective_expires_at > now()
  then
    return jsonb_build_object(
      'state', 'pending_venmo',
      'supportReference', v_booking.booking_reference,
      'expiresAt', v_attempt.effective_expires_at
    );
  end if;

  return jsonb_build_object('state', 'unavailable');
end;
$$;

revoke all on function public.get_workshop_booking_status(text) from public;
grant execute on function public.get_workshop_booking_status(text) to service_role;
