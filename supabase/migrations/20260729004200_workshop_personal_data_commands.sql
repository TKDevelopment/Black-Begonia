-- Additive US5 verified personal-data processing slice. Depends on 04100.
-- Booking email becomes nullable only for policy-authorized minimization.
alter table public.workshop_bookings alter column contact_email drop not null;
alter table public.workshop_bookings drop constraint workshop_bookings_contact_email_check;
alter table public.workshop_bookings add constraint workshop_bookings_contact_email_check
check(contact_email is null or char_length(btrim(contact_email)) between 3 and 320);

alter table public.workshop_personal_data_requests
drop constraint workshop_personal_data_policy_resolution;
alter table public.workshop_personal_data_requests
add constraint workshop_personal_data_policy_resolution check(
  state not in ('approved','deferred','completed','denied')
  or request_type='correction' or retention_policy_version is not null
);
alter table public.workshop_personal_data_requests
drop constraint workshop_personal_data_email_verification;
alter table public.workshop_personal_data_requests
add constraint workshop_personal_data_email_verification check(
  verification_method<>'email_link' or state<>'pending_verification'
  or(verification_token_digest is null and verification_expires_at is null)
  or (verification_token_digest is not null and verification_expires_at is not null
    and verification_expires_at<=created_at+interval '24 hours')
);

create or replace function public.manage_workshop_personal_data(
  p_action text,p_payload jsonb,p_command_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_request public.workshop_personal_data_requests;
  v_booking public.workshop_bookings;
  v_policy public.workshop_data_retention_policies;
  v_occurrence_id uuid;
  v_categories text[];
  v_category text;
  v_attendee jsonb;
  v_result jsonb;
  v_state text;
  v_email_blocked boolean:=false;
  v_earliest timestamptz;
  v_email_policy_earliest timestamptz;
  v_rule jsonb;
  v_proposed_email text;
  v_existing_type text;
begin
  if p_command_key is null then raise exception 'invalid request' using errcode='22023'; end if;
  select result,command_type into v_result,v_existing_type
  from public.workshop_privacy_commands where command_key=p_command_key;
  if found then
    if v_existing_type<>'personal_data_'||p_action then
      raise exception 'command key collision' using errcode='22023';
    end if;
    return v_result||jsonb_build_object('replayed',true);
  end if;

  if p_action='create_request' then
    if (p_payload->>'requestType') not in ('correction','minimization')
      or jsonb_typeof(p_payload->'fieldCategories')<>'array'
      or jsonb_array_length(p_payload->'fieldCategories')=0
    then raise exception 'invalid request' using errcode='22023'; end if;
    select array_agg(value order by value) into v_categories
    from jsonb_array_elements_text(p_payload->'fieldCategories') value;
    if exists(select 1 from unnest(v_categories) c
      where c not in ('contact_email','contact_phone','attendee_name','accommodation_details'))
    then raise exception 'invalid field category' using errcode='22023'; end if;
    select * into v_booking from public.workshop_bookings
    where booking_reference=upper(btrim(p_payload->>'bookingReference'));
    if not found then
      v_result:=jsonb_build_object('replayed',false,'state','accepted');
    else
      if coalesce(p_payload->>'bookingStatusDigest','')=v_booking.status_token_digest
        and v_booking.status_token_expires_at>now() then
        insert into public.workshop_personal_data_requests(
          workshop_booking_id,request_type,requested_field_categories,
          protected_proposed_corrections,state,verification_method,verified_at
        ) values (
          v_booking.workshop_booking_id,p_payload->>'requestType',v_categories,
          p_payload->'protectedCorrections','verified','booking_status_token',now()
        ) returning * into v_request;
      else
        if nullif(p_payload->>'verificationTokenDigest','') is not null
          and char_length(p_payload->>'verificationTokenDigest')<43
        then raise exception 'invalid verification digest' using errcode='22023'; end if;
        insert into public.workshop_personal_data_requests(
          workshop_booking_id,request_type,requested_field_categories,
          protected_proposed_corrections,state,verification_method,
          verification_token_digest,verification_expires_at
        ) values (
          v_booking.workshop_booking_id,p_payload->>'requestType',v_categories,
          p_payload->'protectedCorrections','pending_verification','email_link',
          nullif(p_payload->>'verificationTokenDigest',''),
          case when nullif(p_payload->>'verificationTokenDigest','') is not null
            then now()+interval '24 hours' else null end
        ) returning * into v_request;
        perform public.queue_workshop_communication(
          'current_address_privacy_verification','booking_contact','v1',
          null,null,v_request.workshop_personal_data_request_id,
          'privacy_verification',true,now()+interval '24 hours',p_command_key
        );
      end if;
      v_result:=jsonb_build_object('replayed',false,'state','accepted',
        'requestId',v_request.workshop_personal_data_request_id,
        'verificationState',v_request.state);
    end if;
  elsif p_action='register_delivery_token' then
    if auth.role()<>'service_role' then
      raise exception 'not authorized' using errcode='42501';
    end if;
    select * into v_request from public.workshop_personal_data_requests
    where workshop_personal_data_request_id=(p_payload->>'requestId')::uuid for update;
    if not found or char_length(coalesce(p_payload->>'tokenDigest',''))<43 then
      raise exception 'request unavailable' using errcode='P0001';
    end if;
    if p_payload->>'purpose'='privacy_verification'
      and v_request.state='pending_verification' then
      update public.workshop_personal_data_requests set
        verification_token_digest=p_payload->>'tokenDigest',
        verification_expires_at=now()+interval '24 hours'
      where workshop_personal_data_request_id=v_request.workshop_personal_data_request_id
      returning * into v_request;
    elsif p_payload->>'purpose'='replacement_email'
      and v_request.state='approved' then
      update public.workshop_personal_data_requests set
        replacement_email_token_digest=p_payload->>'tokenDigest',
        replacement_email_expires_at=now()+interval '24 hours'
      where workshop_personal_data_request_id=v_request.workshop_personal_data_request_id
      returning * into v_request;
    else raise exception 'request unavailable' using errcode='P0001';
    end if;
    v_result:=jsonb_build_object('replayed',false,'state','registered',
      'requestId',v_request.workshop_personal_data_request_id,
      'expiresAt',case when p_payload->>'purpose'='privacy_verification'
        then v_request.verification_expires_at else v_request.replacement_email_expires_at end);
  elsif p_action='verify_request' then
    select * into v_request from public.workshop_personal_data_requests
    where verification_token_digest=p_payload->>'verificationTokenDigest'
      and state='pending_verification' for update;
    if not found or v_request.verification_expires_at<=now() then
      if found then update public.workshop_personal_data_requests set state='expired',
        verification_token_digest=null where workshop_personal_data_request_id=
        v_request.workshop_personal_data_request_id;
        perform public.cancel_workshop_communications(
          null,v_request.workshop_personal_data_request_id,'verification_expired'
        );
      end if;
      v_result:=jsonb_build_object('replayed',false,'state','unavailable');
    else
      update public.workshop_personal_data_requests set state='verified',
        verified_at=now(),verification_token_digest=null
      where workshop_personal_data_request_id=v_request.workshop_personal_data_request_id
      returning * into v_request;
      perform public.cancel_workshop_communications(
        null,v_request.workshop_personal_data_request_id,'token_consumed'
      );
      v_result:=jsonb_build_object('replayed',false,'state','verified',
        'requestId',v_request.workshop_personal_data_request_id);
    end if;
  elsif p_action='confirm_replacement_email' then
    select * into v_request from public.workshop_personal_data_requests
    where replacement_email_token_digest=p_payload->>'replacementEmailTokenDigest'
      and state='approved' for update;
    if not found or v_request.replacement_email_expires_at<=now() then
      v_result:=jsonb_build_object('replayed',false,'state','unavailable');
    else
      v_proposed_email:=lower(btrim(v_request.protected_proposed_corrections->>'contact_email'));
      if char_length(v_proposed_email) not between 3 and 320
        or char_length(coalesce(p_payload->>'newStatusTokenDigest',''))<43
      then raise exception 'invalid replacement' using errcode='22023'; end if;
      update public.workshop_bookings set contact_email=v_proposed_email,
        status_token_digest=p_payload->>'newStatusTokenDigest'
      where workshop_booking_id=v_request.workshop_booking_id
      returning workshop_occurrence_id into v_occurrence_id;
      update public.workshop_personal_data_requests set verification_token_digest=null,
        replacement_email_token_digest=null,
        state=case when state='pending_verification' then 'expired' else state end
      where workshop_booking_id=v_request.workshop_booking_id
        and workshop_personal_data_request_id<>v_request.workshop_personal_data_request_id;
      update public.workshop_personal_data_requests set state='completed',
        replacement_email_token_digest=null,replacement_email_confirmed_at=now(),
        protected_proposed_corrections=null,processed_at=coalesce(processed_at,now())
      where workshop_personal_data_request_id=v_request.workshop_personal_data_request_id
      returning * into v_request;
      perform public.cancel_workshop_communications(
        null,v_request.workshop_personal_data_request_id,'token_consumed'
      );
      insert into public.workshop_audit_events(
        workshop_occurrence_id,event_type,actor_type,command_key,safe_metadata
      ) values(v_occurrence_id,'personal_data_replacement_email_confirmed',
        'customer',p_command_key,jsonb_build_object('outcome','completed'));
      v_result:=jsonb_build_object('replayed',false,'state','completed',
        'requestId',v_request.workshop_personal_data_request_id);
    end if;
  elsif p_action='process_request' then
    if not public.is_internal_crm_user() then
      raise exception 'not authorized' using errcode='42501';
    end if;
    select * into v_request from public.workshop_personal_data_requests
    where workshop_personal_data_request_id=(p_payload->>'requestId')::uuid
      and state in ('verified','deferred') for update;
    if not found then raise exception 'request unavailable' using errcode='P0001'; end if;
    select * into v_booking from public.workshop_bookings
    where workshop_booking_id=v_request.workshop_booking_id for update;
    v_occurrence_id:=v_booking.workshop_occurrence_id;
    if p_payload->>'decision'='deny' then
      if v_request.request_type='minimization' then
        select * into v_policy from public.workshop_data_retention_policies
        where state='active' for share;
        if not found then raise exception 'no active retention policy' using errcode='P0001'; end if;
      end if;
      v_state:='denied';
    elsif p_payload->>'decision'<>'approve' then
      raise exception 'invalid decision' using errcode='22023';
    elsif v_request.request_type='correction' then
      if 'contact_phone'=any(v_request.requested_field_categories) then
        update public.workshop_bookings set contact_phone=
          nullif(btrim(v_request.protected_proposed_corrections->>'contact_phone'),'')
        where workshop_booking_id=v_request.workshop_booking_id;
      end if;
      if jsonb_typeof(v_request.protected_proposed_corrections->'attendees')='array' then
        for v_attendee in select value from
          jsonb_array_elements(v_request.protected_proposed_corrections->'attendees') loop
          update public.workshop_attendees set
            display_name=case when 'attendee_name'=any(v_request.requested_field_categories)
              then nullif(btrim(v_attendee->>'displayName'),'') else display_name end,
            accommodation_details=case
              when 'accommodation_details'=any(v_request.requested_field_categories)
              then nullif(btrim(v_attendee->>'accommodationDetails'),'')
              else accommodation_details end
          where workshop_attendee_id=(v_attendee->>'attendeeId')::uuid
            and workshop_booking_id=v_request.workshop_booking_id;
        end loop;
      end if;
      if 'contact_email'=any(v_request.requested_field_categories) then
        v_proposed_email:=lower(btrim(v_request.protected_proposed_corrections->>'contact_email'));
        if char_length(v_proposed_email) not between 3 and 320
          or (nullif(p_payload->>'replacementEmailTokenDigest','') is not null
            and char_length(p_payload->>'replacementEmailTokenDigest')<43)
        then raise exception 'invalid replacement email' using errcode='22023'; end if;
        update public.workshop_personal_data_requests set state='approved',
          replacement_email_token_digest=nullif(p_payload->>'replacementEmailTokenDigest',''),
          replacement_email_expires_at=case
            when nullif(p_payload->>'replacementEmailTokenDigest','') is not null
            then now()+interval '24 hours' else null end,
          processed_by=auth.uid(),processed_at=now(),reason_category='replacement_confirmation'
        where workshop_personal_data_request_id=v_request.workshop_personal_data_request_id
        returning * into v_request;
        perform public.queue_workshop_communication(
          'proposed_email_confirmation','proposed_correction_email','v1',
          null,null,v_request.workshop_personal_data_request_id,
          'replacement_email',true,now()+interval '24 hours',p_command_key
        );
        v_state:='approved';
      else v_state:='completed'; end if;
    else
      select * into v_policy from public.workshop_data_retention_policies
      where state='active' for share;
      if not found then raise exception 'no active retention policy' using errcode='P0001'; end if;
      foreach v_category in array v_request.requested_field_categories loop
        select value into v_rule from jsonb_array_elements(v_policy.field_rules)
        where value->>'fieldCategory'=v_category
          and value->'permittedActions' ? 'minimize';
        if not found then raise exception 'field not minimizable' using errcode='P0001'; end if;
      end loop;
      if 'contact_phone'=any(v_request.requested_field_categories) then
        update public.workshop_bookings set contact_phone=null
        where workshop_booking_id=v_request.workshop_booking_id;
      end if;
      if 'attendee_name'=any(v_request.requested_field_categories) then
        update public.workshop_attendees set display_name=null
        where workshop_booking_id=v_request.workshop_booking_id;
      end if;
      if 'accommodation_details'=any(v_request.requested_field_categories) then
        update public.workshop_attendees set accommodation_details=null
        where workshop_booking_id=v_request.workshop_booking_id;
      end if;
      if 'contact_email'=any(v_request.requested_field_categories) then
        select o.end_at
          + make_interval(days=>coalesce((email_rule->>'minimumAgeDays')::integer,0))
        into v_email_policy_earliest
        from public.workshop_occurrences o cross join lateral(
          select value as email_rule from jsonb_array_elements(v_policy.field_rules)
          where value->>'fieldCategory'='contact_email'
        ) r where o.workshop_occurrence_id=v_booking.workshop_occurrence_id;
        v_email_blocked:=v_booking.status_token_expires_at>now()
          or coalesce(v_email_policy_earliest>now(),false)
          or v_booking.payment_state in ('pending','processing','disputed','exception')
          or exists(select 1 from public.workshop_reschedule_responses
            where workshop_booking_id=v_booking.workshop_booking_id and response='pending')
          or exists(select 1 from public.workshop_communications
            where workshop_booking_id=v_booking.workshop_booking_id
              and delivery_state in ('queued','claimed'))
          or exists(select 1 from public.workshop_personal_data_requests
            where workshop_booking_id=v_booking.workshop_booking_id
              and workshop_personal_data_request_id<>v_request.workshop_personal_data_request_id
              and ((verification_token_digest is not null and verification_expires_at>now())
                or (replacement_email_token_digest is not null
                  and replacement_email_expires_at>now())));
        select max(deadline) into v_earliest from(values
          (v_booking.status_token_expires_at),(v_email_policy_earliest),
          ((select max(response_token_expires_at) from public.workshop_reschedule_responses
            where workshop_booking_id=v_booking.workshop_booking_id and response='pending')),
          ((select max(verification_expires_at) from public.workshop_personal_data_requests
            where workshop_booking_id=v_booking.workshop_booking_id
              and verification_token_digest is not null))) d(deadline);
        if v_email_blocked then v_state:='deferred';
        else
          update public.workshop_bookings set contact_email=null,
            status_token_digest=repeat(md5(gen_random_uuid()::text),2)
          where workshop_booking_id=v_booking.workshop_booking_id;
          update public.workshop_personal_data_requests set verification_token_digest=null,
            replacement_email_token_digest=null,
            state=case when state='pending_verification' then 'expired' else state end
          where workshop_booking_id=v_booking.workshop_booking_id;
          v_state:='completed';
        end if;
      else v_state:='completed'; end if;
      insert into public.workshop_communication_suppressions(
        workshop_booking_id,reason_category,command_key,created_by
      ) values(v_booking.workshop_booking_id,'verified_minimization',p_command_key,auth.uid());
      perform public.cancel_workshop_communications(
        v_booking.workshop_booking_id,null,'verified_minimization'
      );
    end if;
    if v_state<>'approved' then
      update public.workshop_personal_data_requests set state=v_state,
        retention_policy_version=case when v_request.request_type='minimization'
          then v_policy.policy_version else null end,
        processed_by=auth.uid(),processed_at=now(),
        reason_category=case when v_state='deferred' then 'active_customer_dependency'
          else nullif(p_payload->>'reasonCategory','') end,
        earliest_eligible_at=case when v_state='deferred'
          then coalesce(v_earliest,now()+interval '24 hours') else null end,
        protected_proposed_corrections=case when v_state='deferred'
          then protected_proposed_corrections else null end
      where workshop_personal_data_request_id=v_request.workshop_personal_data_request_id
      returning * into v_request;
    end if;
    insert into public.workshop_audit_events(
      workshop_occurrence_id,event_type,actor_type,actor_id,command_key,safe_metadata
    ) values(v_occurrence_id,'personal_data_request_processed','internal',auth.uid(),
      p_command_key,jsonb_build_object('requestType',v_request.request_type,
        'outcome',v_request.state,'reasonCategory',v_request.reason_category));
    v_result:=jsonb_build_object('replayed',false,
      'requestId',v_request.workshop_personal_data_request_id,
      'state',v_request.state,'reasonCategory',v_request.reason_category,
      'earliestEligibleAt',v_request.earliest_eligible_at);
  else raise exception 'unsupported action' using errcode='22023';
  end if;
  insert into public.workshop_privacy_commands(command_key,command_type,result,actor_id)
  values(p_command_key,'personal_data_'||p_action,v_result,
    case when p_action='process_request' then auth.uid() else null end);
  return v_result;
end;
$$;
revoke all on function public.manage_workshop_personal_data(text,jsonb,uuid) from public;
grant execute on function public.manage_workshop_personal_data(text,jsonb,uuid)
to authenticated,service_role;
