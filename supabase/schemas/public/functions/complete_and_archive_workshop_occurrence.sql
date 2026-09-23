create or replace function public.complete_and_archive_workshop_occurrence(
  p_occurrence_id uuid,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_occurrence public.workshop_occurrences;
  v_existing public.workshop_audit_events;
  v_recommendations jsonb:='[]'::jsonb;
  v_notice_count integer:=0;
  v_booking record;
  v_notice_key uuid;
begin
  if not public.is_internal_crm_user() then
    raise exception 'not authorized' using errcode='42501';
  end if;
  if p_occurrence_id is null or p_command_key is null then
    raise exception 'invalid command' using errcode='22023';
  end if;

  select * into v_existing
  from public.workshop_audit_events
  where command_key=p_command_key
    and event_type='occurrence_completed_archived';
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
  if v_occurrence.status not in('published_open','registration_closed')
    or v_occurrence.end_at>now()
  then
    raise exception 'completion review is not yet available' using errcode='P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'title',recommendation.title_snapshot,
    'url','/workshops/'||public.workshop_public_series_slug(
      recommendation.title_snapshot
    ),
    'startAt',recommendation.start_at
  ) order by recommendation.start_at),'[]'::jsonb)
  into v_recommendations
  from(
    select candidate.*
    from(
      select distinct on(o.workshop_definition_id)
        o.workshop_definition_id,o.title_snapshot,o.start_at
      from public.workshop_occurrences o
      where o.status='published_open'
        and o.start_at>now()
        and o.workshop_definition_id<>v_occurrence.workshop_definition_id
      order by o.workshop_definition_id,o.start_at,o.workshop_occurrence_id
    ) candidate
    order by candidate.start_at,candidate.workshop_definition_id
    limit 3
  ) recommendation;

  update public.workshop_occurrences
  set status='archived',
      completed_at=coalesce(completed_at,now()),
      archived_at=coalesce(archived_at,now()),
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
      'workshop_thank_you','booking_contact','v1',
      v_booking.workshop_booking_id,null,null,null,false,null,v_notice_key
    );
    update public.workshop_message_queue
    set message_context=jsonb_build_object(
      'recommendations',v_recommendations
    )
    where command_key=v_notice_key;
    v_notice_count:=v_notice_count+1;
  end loop;

  insert into public.workshop_audit_events(
    workshop_definition_id,workshop_occurrence_id,event_type,actor_type,
    actor_id,command_key,safe_metadata
  ) values(
    v_occurrence.workshop_definition_id,p_occurrence_id,
    'occurrence_completed_archived','internal',auth.uid(),p_command_key,
    jsonb_build_object(
      'occurrenceId',p_occurrence_id,
      'lifecycle','archived',
      'customerThankYousQueued',v_notice_count,
      'recommendationCount',jsonb_array_length(v_recommendations)
    )
  ) returning * into v_existing;

  return v_existing.safe_metadata||jsonb_build_object('replayed',false);
end;
$$;

revoke all on function public.complete_and_archive_workshop_occurrence(uuid,uuid)
from public;
grant execute on function public.complete_and_archive_workshop_occurrence(uuid,uuid)
to authenticated;
