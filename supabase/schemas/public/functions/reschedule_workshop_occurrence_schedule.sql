create or replace function public.reschedule_workshop_occurrence_schedule(
  p_occurrence_id uuid,
  p_local_start timestamp,
  p_local_end timestamp,
  p_utc_offset_minutes smallint,
  p_registration_closes_at timestamptz,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_occurrence public.workshop_occurrences;
  v_existing public.workshop_audit_events;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_notice_count integer:=0;
  v_booking record;
  v_notice_key uuid;
begin
  if not public.is_internal_crm_user() then
    raise exception 'not authorized' using errcode='42501';
  end if;
  if p_occurrence_id is null or p_command_key is null
    or p_local_start is null or p_local_end is null
    or p_utc_offset_minutes not between -840 and 840
  then
    raise exception 'invalid reschedule' using errcode='22023';
  end if;

  select * into v_existing
  from public.workshop_audit_events
  where command_key=p_command_key
    and event_type='occurrence_schedule_rescheduled';
  if found then
    return v_existing.safe_metadata||jsonb_build_object('replayed',true);
  end if;

  select * into v_occurrence
  from public.workshop_occurrences
  where workshop_occurrence_id=p_occurrence_id
  for update;
  if not found then
    raise exception 'occurrence not found' using errcode='P0002';
  end if;
  if v_occurrence.status not in('published_open','registration_closed') then
    raise exception 'invalid lifecycle transition' using errcode='P0001';
  end if;

  v_start_at:=to_timestamp(
    extract(epoch from p_local_start)-(p_utc_offset_minutes*60)
  );
  v_end_at:=to_timestamp(
    extract(epoch from p_local_end)-(p_utc_offset_minutes*60)
  );
  if p_local_end<=p_local_start or v_start_at<=now()
    or p_registration_closes_at<=v_occurrence.registration_opens_at
    or p_registration_closes_at>v_start_at
    or (v_start_at at time zone v_occurrence.timezone)<>p_local_start
    or (v_end_at at time zone v_occurrence.timezone)<>p_local_end
  then
    raise exception 'invalid reschedule' using errcode='22023';
  end if;

  insert into public.workshop_occurrence_route_aliases(
    workshop_occurrence_id,series_slug,workshop_date
  ) values(
    p_occurrence_id,
    public.workshop_public_series_slug(v_occurrence.title_snapshot),
    v_occurrence.local_start::date
  ) on conflict(series_slug,workshop_date) do nothing;

  update public.workshop_occurrences
  set local_start=p_local_start,
      local_end=p_local_end,
      utc_offset_minutes=p_utc_offset_minutes,
      start_at=v_start_at,
      end_at=v_end_at,
      registration_closes_at=p_registration_closes_at,
      updated_by=auth.uid()
  where workshop_occurrence_id=p_occurrence_id;

  for v_booking in
    select workshop_booking_id
    from public.workshop_bookings
    where workshop_occurrence_id=p_occurrence_id
      and status in('confirmed','checked_in')
      and active_quantity>0
      and contact_email is not null
    order by workshop_booking_id
  loop
    v_notice_key:=gen_random_uuid();
    perform public.queue_workshop_communication(
      'reschedule_confirmation','booking_contact','v1',
      v_booking.workshop_booking_id,null,null,null,true,null,v_notice_key
    );
    update public.workshop_message_queue
    set message_context=jsonb_build_object(
      'previousStartAt',v_occurrence.start_at,
      'previousEndAt',v_occurrence.end_at
    )
    where command_key=v_notice_key;
    v_notice_count:=v_notice_count+1;
  end loop;

  insert into public.workshop_audit_events(
    workshop_definition_id,workshop_occurrence_id,event_type,actor_type,
    actor_id,command_key,safe_metadata
  ) values(
    v_occurrence.workshop_definition_id,p_occurrence_id,
    'occurrence_schedule_rescheduled','internal',auth.uid(),p_command_key,
    jsonb_build_object(
      'occurrenceId',p_occurrence_id,
      'previousStartAt',v_occurrence.start_at,
      'previousEndAt',v_occurrence.end_at,
      'startAt',v_start_at,
      'endAt',v_end_at,
      'customerNoticesQueued',v_notice_count
    )
  ) returning * into v_existing;

  return v_existing.safe_metadata||jsonb_build_object('replayed',false);
end;
$$;

revoke all on function public.reschedule_workshop_occurrence_schedule(
  uuid,timestamp,timestamp,smallint,timestamptz,uuid
) from public;
grant execute on function public.reschedule_workshop_occurrence_schedule(
  uuid,timestamp,timestamp,smallint,timestamptz,uuid
) to authenticated;
