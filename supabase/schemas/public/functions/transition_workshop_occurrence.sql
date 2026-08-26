create or replace function public.get_workshop_occurrence_operational_state(
  p_occurrence_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_occurrence public.workshop_occurrences;
  v_reserved bigint;
  v_remaining integer;
  v_waiting boolean;
  v_availability text;
begin
  if not public.is_internal_crm_user() then
    raise exception 'not authorized' using errcode='42501';
  end if;

  select * into v_occurrence
  from public.workshop_occurrences
  where workshop_occurrence_id=p_occurrence_id;
  if not found then
    raise exception 'occurrence not found' using errcode='P0002';
  end if;

  select coalesce(sum(quantity),0) into v_reserved
  from public.workshop_seat_holds
  where workshop_occurrence_id=p_occurrence_id
    and (
      state='confirmed'
      or (state='active' and effective_expires_at>now())
    );
  v_remaining:=greatest(v_occurrence.capacity-v_reserved,0);
  select exists(
    select 1 from public.workshop_waitlist_entries
    where workshop_occurrence_id=p_occurrence_id
      and state in('waiting','offered')
  ) into v_waiting;

  v_availability:=case
    when v_occurrence.status<>'published_open'
      or now()<v_occurrence.registration_opens_at
      or now()>=least(v_occurrence.registration_closes_at,v_occurrence.start_at)
      then 'closed'
    when v_remaining=0 and v_occurrence.waitlist_enabled then 'waitlist_available'
    when v_remaining=0 then 'sold_out'
    when v_remaining<=greatest(1,ceil(v_occurrence.capacity*.2)::integer)
      then 'limited'
    else 'available'
  end;

  return jsonb_build_object(
    'occurrenceId',v_occurrence.workshop_occurrence_id,
    'lifecycle',v_occurrence.status,
    'availability',v_availability,
    'capacity',v_occurrence.capacity,
    'reservedQuantity',v_reserved,
    'remainingQuantity',v_remaining,
    'hasWaitingCustomers',v_waiting,
    'completionReviewRequired',
      v_occurrence.end_at<=now()
      and v_occurrence.status in('published_open','registration_closed')
  );
end;
$$;

create or replace function public.transition_workshop_occurrence(
  p_occurrence_id uuid,
  p_target_status text,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_occurrence public.workshop_occurrences;
  v_existing public.workshop_audit_events;
  v_allowed boolean:=false;
  v_actor uuid:=auth.uid();
  v_previous_status text;
begin
  if not public.is_internal_crm_user() then
    raise exception 'not authorized' using errcode='42501';
  end if;
  if p_command_key is null then
    raise exception 'invalid command' using errcode='22023';
  end if;

  select * into v_existing
  from public.workshop_audit_events
  where command_key=p_command_key and event_type='occurrence_lifecycle_transition';
  if found then
    return public.get_workshop_occurrence_operational_state(
      v_existing.workshop_occurrence_id
    )||jsonb_build_object('replayed',true);
  end if;

  select * into v_occurrence
  from public.workshop_occurrences
  where workshop_occurrence_id=p_occurrence_id
  for update;
  if not found then
    raise exception 'occurrence not found' using errcode='P0002';
  end if;
  v_previous_status:=v_occurrence.status;

  v_allowed:=case
    when v_occurrence.status='draft' and p_target_status='published_open'
      then true
    when v_occurrence.status='published_open'
      and p_target_status in('registration_closed','completed') then true
    when v_occurrence.status='registration_closed'
      and p_target_status='completed' then true
    when v_occurrence.status in('rescheduled','cancelled','completed')
      and p_target_status='archived' then true
    else false
  end;
  if not v_allowed then
    raise exception 'invalid lifecycle transition' using errcode='P0001';
  end if;
  if p_target_status='completed' and v_occurrence.end_at>now() then
    raise exception 'completion review is not yet available' using errcode='P0001';
  end if;

  update public.workshop_occurrences
  set status=p_target_status,
    published_at=case
      when p_target_status='published_open' then coalesce(published_at,now())
      else published_at
    end,
    completed_at=case when p_target_status='completed' then now() else completed_at end,
    archived_at=case when p_target_status='archived' then now() else archived_at end,
    updated_by=v_actor
  where workshop_occurrence_id=p_occurrence_id
  returning * into v_occurrence;

  insert into public.workshop_audit_events(
    workshop_definition_id,workshop_occurrence_id,event_type,actor_type,
    actor_id,command_key,safe_metadata
  ) values(
    v_occurrence.workshop_definition_id,p_occurrence_id,
    'occurrence_lifecycle_transition','internal',v_actor,p_command_key,
    jsonb_build_object(
      'fromStatus',v_previous_status,
      'toStatus',p_target_status
    )
  );

  return public.get_workshop_occurrence_operational_state(p_occurrence_id)
    ||jsonb_build_object('replayed',false);
end;
$$;

revoke all on function public.get_workshop_occurrence_operational_state(uuid)
from public;
revoke all on function public.transition_workshop_occurrence(uuid,text,uuid)
from public;
grant execute on function public.get_workshop_occurrence_operational_state(uuid)
to authenticated;
grant execute on function public.transition_workshop_occurrence(uuid,text,uuid)
to authenticated;
