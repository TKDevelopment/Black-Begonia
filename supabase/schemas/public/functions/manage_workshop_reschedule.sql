create or replace function public.manage_workshop_reschedule(
  p_action text,
  p_payload jsonb,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_source public.workshop_occurrences;
  v_replacement public.workshop_occurrences;
  v_response public.workshop_reschedule_responses;
  v_existing public.workshop_audit_events;
  v_booking public.workshop_bookings;
  v_hold public.workshop_seat_holds;
  v_actor uuid:=auth.uid();
  v_source_id uuid;
  v_replacement_id uuid;
  v_response_id uuid;
  v_deadline timestamptz;
  v_reserved bigint;
  v_required bigint;
  v_count integer:=0;
  v_expired integer:=0;
  v_choice text;
begin
  if p_command_key is null then
    raise exception 'invalid request' using errcode='22023';
  end if;

  if p_action in('begin','expire_due','resolve_nonresponse')
    and not public.is_internal_crm_user()
  then
    raise exception 'not authorized' using errcode='42501';
  end if;

  if p_action='begin' then
    select * into v_existing from public.workshop_audit_events
    where command_key=p_command_key
      and event_type='occurrence_reschedule_started';
    if found then
      return v_existing.safe_metadata||jsonb_build_object('replayed',true);
    end if;
    v_source_id:=(p_payload->>'sourceOccurrenceId')::uuid;
    v_replacement_id:=(p_payload->>'replacementOccurrenceId')::uuid;
    v_deadline:=(p_payload->>'responseDeadline')::timestamptz;
    if v_source_id=v_replacement_id or v_deadline<=now() then
      raise exception 'invalid reschedule' using errcode='22023';
    end if;

    perform 1 from public.workshop_occurrences
    where workshop_occurrence_id in(v_source_id,v_replacement_id)
    order by workshop_occurrence_id for update;
    select * into v_source from public.workshop_occurrences
    where workshop_occurrence_id=v_source_id;
    select * into v_replacement from public.workshop_occurrences
    where workshop_occurrence_id=v_replacement_id;
    if v_source.workshop_occurrence_id is null
      or v_replacement.workshop_occurrence_id is null
    then raise exception 'occurrence not found' using errcode='P0002'; end if;
    if v_source.status not in('published_open','registration_closed')
      or v_replacement.status<>'published_open'
      or v_replacement.start_at<=now()
      or v_deadline>least(v_replacement.start_at,
        v_replacement.registration_closes_at)
    then raise exception 'invalid reschedule' using errcode='P0001'; end if;

    select coalesce(sum(active_quantity),0) into v_required
    from public.workshop_bookings
    where workshop_occurrence_id=v_source_id and active_quantity>0
      and status in('confirmed','checked_in');
    select coalesce(sum(quantity),0) into v_reserved
    from public.workshop_seat_holds
    where workshop_occurrence_id=v_replacement_id
      and (state='confirmed'
        or (state='active' and effective_expires_at>now()));
    if v_reserved+v_required>v_replacement.capacity then
      raise exception 'insufficient replacement capacity' using errcode='P0001';
    end if;

    update public.workshop_occurrences set status='rescheduled',
      replacement_occurrence_id=v_replacement_id,
      status_page_expires_at=now()+interval '12 months',updated_by=v_actor
    where workshop_occurrence_id=v_source_id;

    for v_booking in
      select * from public.workshop_bookings
      where workshop_occurrence_id=v_source_id and active_quantity>0
        and status in('confirmed','checked_in')
      order by workshop_booking_id for update
    loop
      insert into public.workshop_seat_holds(
        workshop_occurrence_id,booking_id,quantity,state,payment_method,
        normal_expires_at,effective_expires_at,command_key
      ) values(
        v_replacement_id,v_booking.workshop_booking_id,
        v_booking.active_quantity,'active',null,v_deadline,v_deadline,
        gen_random_uuid()
      ) returning * into v_hold;
      insert into public.workshop_reschedule_responses(
        workshop_booking_id,source_occurrence_id,replacement_occurrence_id,
        replacement_hold_id,protected_quantity,response_token_digest,
        response_token_expires_at,command_key
      ) values(
        v_booking.workshop_booking_id,v_source_id,v_replacement_id,
        v_hold.workshop_seat_hold_id,v_booking.active_quantity,
        repeat(md5(gen_random_uuid()::text),2),v_deadline,gen_random_uuid()
      );
      update public.workshop_bookings set status='transfer_action_required',
        status_token_expires_at=greatest(status_token_expires_at,
          v_deadline+interval '30 days')
      where workshop_booking_id=v_booking.workshop_booking_id;
      if v_booking.contact_email is not null then
        perform public.queue_workshop_communication(
          'reschedule_prompt','booking_contact','v1',
          v_booking.workshop_booking_id,null,null,'reschedule_response',
          true,v_deadline,gen_random_uuid()
        );
      end if;
      v_count:=v_count+1;
    end loop;

    insert into public.workshop_audit_events(
      workshop_definition_id,workshop_occurrence_id,event_type,actor_type,
      actor_id,command_key,safe_metadata
    ) values(
      v_source.workshop_definition_id,v_source_id,
      'occurrence_reschedule_started','internal',v_actor,p_command_key,
      jsonb_build_object(
        'sourceOccurrenceId',v_source_id,
        'replacementOccurrenceId',v_replacement_id,
        'responseDeadline',v_deadline,'affectedBookings',v_count,
        'protectedQuantity',v_required
      )
    ) returning * into v_existing;
    return v_existing.safe_metadata||jsonb_build_object('replayed',false);

  elsif p_action='respond' then
    select * into v_response from public.workshop_reschedule_responses
    where resolution_command_key=p_command_key;
    if found then
      return jsonb_build_object(
        'replayed',true,'state',v_response.response,
        'responseId',v_response.workshop_reschedule_response_id
      );
    end if;
    select * into v_response from public.workshop_reschedule_responses
    where response_token_digest=p_payload->>'responseTokenDigest' for update;
    if not found or v_response.response<>'pending' then
      return jsonb_build_object('replayed',false,'state','unavailable');
    end if;
    select * into v_booking from public.workshop_bookings
    where workshop_booking_id=v_response.workshop_booking_id for update;
    select * into v_hold from public.workshop_seat_holds
    where workshop_seat_hold_id=v_response.replacement_hold_id for update;
    if now()>=v_response.response_token_expires_at then
      update public.workshop_reschedule_responses set response='expired',
        responded_at=now(),resolution_command_key=p_command_key
      where workshop_reschedule_response_id=
        v_response.workshop_reschedule_response_id returning * into v_response;
      update public.workshop_seat_holds set state='expired',resolved_at=now(),
        resolution_reason='reschedule_response_expired'
      where workshop_seat_hold_id=v_hold.workshop_seat_hold_id
        and state='active';
      return jsonb_build_object(
        'replayed',false,'state','expired',
        'responseId',v_response.workshop_reschedule_response_id
      );
    end if;
    v_choice:=p_payload->>'response';
    if v_choice='accept' then
      if v_hold.state<>'active' then
        return jsonb_build_object('replayed',false,'state','unavailable');
      end if;
      update public.workshop_seat_holds set state='released',resolved_at=now(),
        resolution_reason='booking_transferred'
      where booking_id=v_booking.workshop_booking_id
        and workshop_occurrence_id=v_response.source_occurrence_id
        and state in('active','confirmed');
      update public.workshop_seat_holds set state='confirmed',resolved_at=now(),
        resolution_reason='accepted_reschedule_transfer'
      where workshop_seat_hold_id=v_hold.workshop_seat_hold_id;
      update public.workshop_bookings
      set workshop_occurrence_id=v_response.replacement_occurrence_id,
        status='transferred',
        status_token_expires_at=greatest(status_token_expires_at,
          (select end_at+interval '30 days'
           from public.workshop_occurrences
           where workshop_occurrence_id=v_response.replacement_occurrence_id))
      where workshop_booking_id=v_booking.workshop_booking_id;
      insert into public.workshop_booking_adjustments(
        workshop_booking_id,adjustment_type,quantity_delta,amount_minor_delta,
        reason,command_key,actor_type
      ) values(
        v_booking.workshop_booking_id,'transfer',0,0,
        'customer accepted material reschedule',p_command_key,'customer'
      );
      update public.workshop_reschedule_responses set response='accepted',
        responded_at=now(),resolution_command_key=p_command_key
      where workshop_reschedule_response_id=
        v_response.workshop_reschedule_response_id returning * into v_response;
    elsif v_choice='decline' then
      update public.workshop_seat_holds set state='released',resolved_at=now(),
        resolution_reason='reschedule_declined'
      where workshop_seat_hold_id=v_hold.workshop_seat_hold_id
        and state='active';
      update public.workshop_seat_holds set state='cancelled',resolved_at=now(),
        resolution_reason='reschedule_declined'
      where booking_id=v_booking.workshop_booking_id
        and workshop_occurrence_id=v_response.source_occurrence_id
        and state in('active','confirmed');
      if v_booking.active_quantity>0 then
        insert into public.workshop_booking_adjustments(
          workshop_booking_id,adjustment_type,quantity_delta,
          amount_minor_delta,reason,command_key,actor_type
        ) values(
          v_booking.workshop_booking_id,'full_cancel',
          -v_booking.active_quantity,0,'customer declined material reschedule',
          p_command_key,'customer'
        );
      end if;
      update public.workshop_bookings set status='cancelled',active_quantity=0,
        cancelled_at=coalesce(cancelled_at,now())
      where workshop_booking_id=v_booking.workshop_booking_id;
      if v_booking.payment_state in(
        'paid','partially_refunded','disputed','exception'
      ) then
        insert into public.workshop_payment_exceptions(
          workshop_booking_id,workshop_occurrence_id,exception_type,urgency,
          amount_minor,currency,summary,safe_detail,command_key
        ) values(
          v_booking.workshop_booking_id,v_response.source_occurrence_id,
          'reschedule_declined_refund_review','normal',
          v_booking.total_minor_snapshot,v_booking.currency,
          'Customer declined a material workshop reschedule.',
          'Review refund eligibility; no money moved automatically.',
          p_command_key
        );
      end if;
      update public.workshop_reschedule_responses set response='declined',
        responded_at=now(),resolution_command_key=p_command_key
      where workshop_reschedule_response_id=
        v_response.workshop_reschedule_response_id returning * into v_response;
    else
      raise exception 'invalid response' using errcode='22023';
    end if;
    insert into public.workshop_audit_events(
      workshop_occurrence_id,event_type,actor_type,command_key,safe_metadata
    ) values(
      v_response.source_occurrence_id,'reschedule_customer_response',
      'customer',p_command_key,jsonb_build_object(
        'responseId',v_response.workshop_reschedule_response_id,
        'response',v_response.response
      )
    );
    return jsonb_build_object(
      'replayed',false,'state',v_response.response,
      'responseId',v_response.workshop_reschedule_response_id
    );

  elsif p_action='expire_due' then
    v_source_id:=(p_payload->>'sourceOccurrenceId')::uuid;
    select * into v_existing from public.workshop_audit_events
    where command_key=p_command_key
      and event_type='reschedule_responses_expired';
    if found then
      return v_existing.safe_metadata||jsonb_build_object('replayed',true);
    end if;
    for v_response in
      select * from public.workshop_reschedule_responses
      where source_occurrence_id=v_source_id and response='pending'
        and response_token_expires_at<=now()
      order by workshop_reschedule_response_id for update skip locked
    loop
      update public.workshop_reschedule_responses set response='expired',
        responded_at=now(),resolution_command_key=gen_random_uuid()
      where workshop_reschedule_response_id=
        v_response.workshop_reschedule_response_id;
      update public.workshop_seat_holds set state='expired',resolved_at=now(),
        resolution_reason='reschedule_response_expired'
      where workshop_seat_hold_id=v_response.replacement_hold_id
        and state='active';
      v_expired:=v_expired+1;
    end loop;
    select * into v_source from public.workshop_occurrences
    where workshop_occurrence_id=v_source_id;
    if not found then
      raise exception 'occurrence not found' using errcode='P0002';
    end if;
    insert into public.workshop_audit_events(
      workshop_definition_id,workshop_occurrence_id,event_type,actor_type,
      actor_id,command_key,safe_metadata
    ) values(
      v_source.workshop_definition_id,v_source_id,
      'reschedule_responses_expired','internal',v_actor,p_command_key,
      jsonb_build_object('sourceOccurrenceId',v_source_id,
        'expiredResponses',v_expired)
    ) returning * into v_existing;
    return v_existing.safe_metadata||jsonb_build_object('replayed',false);

  elsif p_action='resolve_nonresponse' then
    v_response_id:=(p_payload->>'responseId')::uuid;
    select * into v_response from public.workshop_reschedule_responses
    where resolution_command_key=p_command_key;
    if found then
      return jsonb_build_object(
        'replayed',true,'state',v_response.response,
        'responseId',v_response.workshop_reschedule_response_id
      );
    end if;
    select * into v_response from public.workshop_reschedule_responses
    where workshop_reschedule_response_id=v_response_id for update;
    if not found
      or not (
        v_response.response='expired'
        or (v_response.response='pending'
          and v_response.response_token_expires_at<=now())
      )
      or p_payload->>'resolution'<>'cancel'
    then raise exception 'nonresponse unavailable' using errcode='P0001'; end if;
    select * into v_booking from public.workshop_bookings
    where workshop_booking_id=v_response.workshop_booking_id for update;
    update public.workshop_seat_holds set state='released',resolved_at=now(),
      resolution_reason='staff_resolved_reschedule_nonresponse'
    where workshop_seat_hold_id=v_response.replacement_hold_id
      and state in('active','expired');
    update public.workshop_seat_holds set state='cancelled',resolved_at=now(),
      resolution_reason='staff_resolved_reschedule_nonresponse'
    where booking_id=v_booking.workshop_booking_id
      and workshop_occurrence_id=v_response.source_occurrence_id
      and state in('active','confirmed');
    if v_booking.active_quantity>0 then
      insert into public.workshop_booking_adjustments(
        workshop_booking_id,adjustment_type,quantity_delta,amount_minor_delta,
        reason,command_key,actor_type,actor_id
      ) values(
        v_booking.workshop_booking_id,'full_cancel',
        -v_booking.active_quantity,0,'staff resolved reschedule nonresponse',
        p_command_key,'internal',v_actor
      );
    end if;
    update public.workshop_bookings set status='cancelled',active_quantity=0,
      cancelled_at=coalesce(cancelled_at,now())
    where workshop_booking_id=v_booking.workshop_booking_id;
    if v_booking.payment_state in(
      'paid','partially_refunded','disputed','exception'
    ) then
      insert into public.workshop_payment_exceptions(
        workshop_booking_id,workshop_occurrence_id,exception_type,urgency,
        amount_minor,currency,summary,safe_detail,command_key
      ) values(
        v_booking.workshop_booking_id,v_response.source_occurrence_id,
        'reschedule_nonresponse_refund_review','normal',
        v_booking.total_minor_snapshot,v_booking.currency,
        'Staff resolved an expired material-reschedule response.',
        'Review refund eligibility; no money moved automatically.',p_command_key
      );
    end if;
    update public.workshop_reschedule_responses set response='staff_resolved',
      responded_at=coalesce(responded_at,now()),resolved_by=v_actor,
      resolution_command_key=p_command_key
    where workshop_reschedule_response_id=v_response_id returning * into v_response;
    insert into public.workshop_audit_events(
      workshop_occurrence_id,event_type,actor_type,actor_id,command_key,
      safe_metadata
    ) values(
      v_response.source_occurrence_id,'reschedule_nonresponse_resolved',
      'internal',v_actor,p_command_key,jsonb_build_object(
        'responseId',v_response_id,'resolution','cancel'
      )
    );
    return jsonb_build_object(
      'replayed',false,'state','staff_resolved','responseId',v_response_id
    );
  else
    raise exception 'unsupported action' using errcode='22023';
  end if;
end;
$$;

revoke all on function public.manage_workshop_reschedule(text,jsonb,uuid)
from public;
grant execute on function public.manage_workshop_reschedule(text,jsonb,uuid)
to authenticated,service_role;
