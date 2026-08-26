-- Permit authenticated CRM users to remove draft or published workshop
-- occurrences only when no reservation record exists. Locking the occurrence
-- serializes this check with booking creation, while existing foreign keys keep
-- any other operational or financial history non-destructible.

create or replace function public.delete_workshop_occurrence(
  p_workshop_occurrence_id uuid,
  p_command_key uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_occurrence public.workshop_occurrences;
  v_booking_count bigint;
begin
  if not public.is_internal_crm_user() then
    raise exception 'not authorized' using errcode='42501';
  end if;
  if p_command_key is null then
    raise exception 'invalid request' using errcode='22023';
  end if;

  select * into v_occurrence
  from public.workshop_occurrences
  where workshop_occurrence_id=p_workshop_occurrence_id
  for update;
  if not found then
    return jsonb_build_object('deleted',true);
  end if;

  select count(*) into v_booking_count
  from public.workshop_bookings
  where workshop_occurrence_id=p_workshop_occurrence_id;
  if v_booking_count > 0 then
    raise exception 'workshop occurrence has booked reservations'
      using errcode='55000', detail=v_booking_count::text;
  end if;

  delete from public.workshop_media
  where workshop_occurrence_id=p_workshop_occurrence_id;
  delete from public.workshop_audit_events
  where workshop_occurrence_id=p_workshop_occurrence_id;
  delete from public.workshop_occurrences
  where workshop_occurrence_id=p_workshop_occurrence_id;

  return jsonb_build_object('deleted',true,'commandKey',p_command_key);
end;
$$;

revoke all on function public.delete_workshop_occurrence(uuid,uuid) from public;
grant execute on function public.delete_workshop_occurrence(uuid,uuid) to authenticated;
