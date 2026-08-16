create or replace function public.queue_workshop_communication(
  p_communication_type text,
  p_recipient_source text,
  p_template_version text,
  p_booking_id uuid,
  p_waitlist_entry_id uuid,
  p_personal_data_request_id uuid,
  p_token_purpose text,
  p_is_required boolean,
  p_expires_at timestamptz,
  p_command_key uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_queue public.workshop_message_queue;
  v_existing_outcome public.workshop_message_outcomes;
  v_booking_id uuid:=p_booking_id;
  v_suppressed boolean:=false;
begin
  select * into v_queue from public.workshop_message_queue where command_key=p_command_key;
  if found then return jsonb_build_object('replayed',true,'queueId',
    v_queue.workshop_message_queue_id,'state',v_queue.state); end if;
  if (p_booking_id is not null)::integer+(p_waitlist_entry_id is not null)::integer
      +(p_personal_data_request_id is not null)::integer<>1
  then raise exception 'invalid communication owner' using errcode='22023'; end if;
  if p_personal_data_request_id is not null then
    select workshop_booking_id into v_booking_id
    from public.workshop_personal_data_requests
    where workshop_personal_data_request_id=p_personal_data_request_id;
  end if;
  if not coalesce(p_is_required,true) and v_booking_id is not null then
    v_suppressed:=exists(select 1 from public.workshop_communication_suppressions
      where workshop_booking_id=v_booking_id);
  end if;
  insert into public.workshop_message_queue(
    workshop_booking_id,workshop_waitlist_entry_id,workshop_personal_data_request_id,
    communication_type,recipient_source,token_purpose,template_version,is_required,
    state,expires_at,command_key,resolved_at,last_error_category
  ) values(
    p_booking_id,p_waitlist_entry_id,p_personal_data_request_id,
    p_communication_type,p_recipient_source,p_token_purpose,p_template_version,
    coalesce(p_is_required,true),case when v_suppressed then 'suppressed' else 'queued' end,
    p_expires_at,p_command_key,case when v_suppressed then now() else null end,
    case when v_suppressed then 'privacy_suppression' else null end
  ) returning * into v_queue;
  return jsonb_build_object('replayed',false,'queueId',
    v_queue.workshop_message_queue_id,'state',v_queue.state);
end;
$$;

create or replace function public.claim_workshop_communications(
  p_worker text,p_limit integer default 25
) returns table(
  queue_id uuid,communication_type text,recipient_email text,token_purpose text,
  template_version text,personal_data_request_id uuid,waitlist_entry_id uuid,
  booking_id uuid,expires_at timestamptz,attempt_count integer
)
language plpgsql security definer set search_path='' as $$
begin
  if char_length(btrim(coalesce(p_worker,''))) not between 1 and 120
    or p_limit not between 1 and 100 then
    raise exception 'invalid claim' using errcode='22023';
  end if;
  update public.workshop_message_queue q set state='queued',
    next_attempt_at=now(),claimed_at=null,claimed_by=null,
    last_error_category='stale_claim_recovered'
  where q.state='claimed' and q.claimed_at<=now()-interval '10 minutes'
    and q.attempt_count<5;
  update public.workshop_message_queue q set state='failed',resolved_at=now(),
    last_error_category='claim_attempts_exhausted'
  where q.state='claimed' and q.claimed_at<=now()-interval '10 minutes'
    and q.attempt_count>=5;
  update public.workshop_message_queue q set state='suppressed',resolved_at=now(),
    last_error_category='expired_before_delivery'
  where q.state='queued' and q.expires_at is not null and q.expires_at<=now();
  return query
  with claimed as(
    select q.workshop_message_queue_id from public.workshop_message_queue q
    where q.state='queued' and q.next_attempt_at<=now()
      and (q.expires_at is null or q.expires_at>now())
    order by q.created_at,q.workshop_message_queue_id
    limit p_limit for update skip locked
  ),updated as(
    update public.workshop_message_queue q set state='claimed',claimed_at=now(),
      claimed_by=btrim(p_worker),attempt_count=q.attempt_count+1
    from claimed c where q.workshop_message_queue_id=c.workshop_message_queue_id
    returning q.*
  )
  select u.workshop_message_queue_id,u.communication_type,
    case u.recipient_source
      when 'booking_contact' then b.contact_email
      when 'waitlist_contact' then w.contact_email
      when 'proposed_correction_email'
        then lower(btrim(r.protected_proposed_corrections->>'contact_email'))
    end,
    u.token_purpose,u.template_version,u.workshop_personal_data_request_id,
    u.workshop_waitlist_entry_id,coalesce(u.workshop_booking_id,r.workshop_booking_id),
    u.expires_at,u.attempt_count
  from updated u
  left join public.workshop_bookings b on b.workshop_booking_id=u.workshop_booking_id
  left join public.workshop_waitlist_entries w
    on w.workshop_waitlist_entry_id=u.workshop_waitlist_entry_id
  left join public.workshop_personal_data_requests r
    on r.workshop_personal_data_request_id=u.workshop_personal_data_request_id;
end;
$$;

create or replace function public.queue_workshop_status_recovery(
  p_contact_email text,p_support_reference text,p_command_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_booking public.workshop_bookings; v_result jsonb;
begin
  select b.* into v_booking from public.workshop_bookings b
  where lower(b.contact_email)=lower(btrim(p_contact_email))
    and b.booking_reference=upper(btrim(p_support_reference)) limit 1;
  if not found then
    return jsonb_build_object('matched',false,'replayed',false);
  end if;
  v_result:=public.queue_workshop_communication(
    'replacement_status_access','booking_contact','v1',
    v_booking.workshop_booking_id,null,null,'status_access',true,
    now()+interval '24 hours',p_command_key
  );
  return v_result||jsonb_build_object('matched',true);
end;
$$;

create or replace function public.register_workshop_message_token(
  p_queue_id uuid,p_worker text,p_token_digest text,p_command_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_queue public.workshop_message_queue;
  v_request public.workshop_personal_data_requests;
  v_booking public.workshop_bookings;
  v_occurrence public.workshop_occurrences;
  v_offer public.workshop_waitlist_offers;
  v_response public.workshop_reschedule_responses;
  v_deadline timestamptz;
begin
  select * into v_queue from public.workshop_message_queue
  where workshop_message_queue_id=p_queue_id for update;
  if not found or v_queue.state<>'claimed' or v_queue.claimed_by<>p_worker
    or v_queue.token_purpose is null
    or char_length(coalesce(p_token_digest,''))<43
  then raise exception 'claim unavailable' using errcode='P0001'; end if;
  if v_queue.token_registration_key is not null then
    if v_queue.token_registration_key<>p_command_key then
      raise exception 'token already registered' using errcode='P0001';
    end if;
    return jsonb_build_object('replayed',true,'purpose',v_queue.token_purpose,
      'expiresAt',v_queue.expires_at);
  end if;
  if v_queue.token_purpose='status_access' then
    select * into v_booking from public.workshop_bookings
    where workshop_booking_id=v_queue.workshop_booking_id for update;
    if not found then
      raise exception 'claim unavailable' using errcode='P0001';
    end if;
    select * into v_occurrence from public.workshop_occurrences
    where workshop_occurrence_id=v_booking.workshop_occurrence_id;
    select max(response_token_expires_at) into v_deadline
    from public.workshop_reschedule_responses
    where workshop_booking_id=v_booking.workshop_booking_id and response='pending';
    select greatest(v_deadline,max(customer_action_deadline)) into v_deadline
    from public.workshop_payment_exceptions
    where workshop_booking_id=v_booking.workshop_booking_id
      and state in('open','acknowledged') and customer_action_deadline is not null;
    update public.workshop_bookings set status_token_digest=p_token_digest,
      status_token_expires_at=greatest(
        v_occurrence.end_at,coalesce(v_deadline,v_occurrence.end_at)
      )+interval '30 days',status_token_rotation_key=p_command_key
    where workshop_booking_id=v_booking.workshop_booking_id;
  elsif v_queue.token_purpose='waitlist_offer' then
    select * into v_offer from public.workshop_waitlist_offers
    where workshop_waitlist_entry_id=v_queue.workshop_waitlist_entry_id
      and state='active' order by created_at desc limit 1 for update;
    if not found then
      raise exception 'claim unavailable' using errcode='P0001';
    end if;
    update public.workshop_waitlist_offers set offer_token_digest=p_token_digest
    where workshop_waitlist_offer_id=v_offer.workshop_waitlist_offer_id;
  elsif v_queue.token_purpose='reschedule_response' then
    select * into v_response from public.workshop_reschedule_responses
    where workshop_booking_id=v_queue.workshop_booking_id and response='pending'
    order by created_at desc limit 1 for update;
    if not found or v_response.response_token_expires_at<=now() then
      raise exception 'claim unavailable' using errcode='P0001';
    end if;
    update public.workshop_reschedule_responses
    set response_token_digest=p_token_digest
    where workshop_reschedule_response_id=
      v_response.workshop_reschedule_response_id;
  elsif v_queue.token_purpose in('privacy_verification','replacement_email') then
    select * into v_request from public.workshop_personal_data_requests
    where workshop_personal_data_request_id=v_queue.workshop_personal_data_request_id
    for update;
    if not found then
      raise exception 'claim unavailable' using errcode='P0001';
    end if;
    if v_queue.token_purpose='privacy_verification'
      and v_request.state='pending_verification' then
      update public.workshop_personal_data_requests
      set verification_token_digest=p_token_digest,
        verification_expires_at=least(v_queue.expires_at,now()+interval '24 hours')
      where workshop_personal_data_request_id=v_request.workshop_personal_data_request_id;
    elsif v_queue.token_purpose='replacement_email' and v_request.state='approved' then
      update public.workshop_personal_data_requests
      set replacement_email_token_digest=p_token_digest,
        replacement_email_expires_at=least(v_queue.expires_at,now()+interval '24 hours')
      where workshop_personal_data_request_id=v_request.workshop_personal_data_request_id;
    else
      raise exception 'claim unavailable' using errcode='P0001';
    end if;
  else
    raise exception 'unsupported token purpose' using errcode='22023';
  end if;
  update public.workshop_message_queue set token_registration_key=p_command_key
  where workshop_message_queue_id=p_queue_id;
  return jsonb_build_object('replayed',false,'purpose',v_queue.token_purpose,
    'expiresAt',v_queue.expires_at);
end;
$$;

create or replace function public.record_workshop_communication_outcome(
  p_queue_id uuid,p_worker text,p_outcome text,p_provider_message_id text,
  p_recipient_digest text,p_payload_digest text,p_error_category text,
  p_retry_at timestamptz,p_command_key uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_queue public.workshop_message_queue;
  v_existing_outcome public.workshop_message_outcomes;
  v_booking_id uuid;
  v_state text;
begin
  select * into v_existing_outcome from public.workshop_message_outcomes
  where command_key=p_command_key;
  if found then return jsonb_build_object('replayed',true,
    'state',v_existing_outcome.resulting_state,
    'attemptCount',v_existing_outcome.attempt_count); end if;
  select * into v_queue from public.workshop_message_queue
  where workshop_message_queue_id=p_queue_id for update;
  if not found or v_queue.state<>'claimed' or v_queue.claimed_by<>p_worker then
    raise exception 'claim unavailable' using errcode='P0001';
  end if;
  if p_outcome='retryable' and v_queue.attempt_count<5 then
    update public.workshop_message_queue set state='queued',
      next_attempt_at=greatest(coalesce(p_retry_at,now()+interval '5 minutes'),now()),
      claimed_at=null,claimed_by=null,last_error_category=
        coalesce(nullif(p_error_category,''),'provider_retryable'),
      outcome_command_key=p_command_key
    where workshop_message_queue_id=p_queue_id returning * into v_queue;
    insert into public.workshop_message_outcomes(
      workshop_message_queue_id,outcome,resulting_state,attempt_count,error_category,command_key
    ) values(v_queue.workshop_message_queue_id,'retryable','queued',
      v_queue.attempt_count,v_queue.last_error_category,p_command_key);
    return jsonb_build_object('replayed',false,'state','queued',
      'attemptCount',v_queue.attempt_count);
  end if;
  v_state:=case when p_outcome='accepted' then 'sent' else 'failed' end;
  update public.workshop_message_queue set state=v_state,resolved_at=now(),
    provider_message_id=nullif(p_provider_message_id,''),
    last_error_category=case when v_state='failed'
      then coalesce(nullif(p_error_category,''),'provider_permanent') else null end,
    outcome_command_key=p_command_key
  where workshop_message_queue_id=p_queue_id returning * into v_queue;
  insert into public.workshop_message_outcomes(
    workshop_message_queue_id,outcome,resulting_state,attempt_count,error_category,command_key
  ) values(v_queue.workshop_message_queue_id,
    case when p_outcome='accepted' then 'accepted' else 'permanent' end,
    v_state,v_queue.attempt_count,v_queue.last_error_category,p_command_key);
  if v_queue.workshop_personal_data_request_id is not null then
    select workshop_booking_id into v_booking_id from public.workshop_personal_data_requests
    where workshop_personal_data_request_id=v_queue.workshop_personal_data_request_id;
  else v_booking_id:=v_queue.workshop_booking_id; end if;
  insert into public.workshop_communications(
    workshop_booking_id,workshop_waitlist_entry_id,communication_type,
    recipient_digest,template_version,payload_digest,provider_message_id,
    delivery_state,occurred_at,command_key
  ) values(
    v_booking_id,v_queue.workshop_waitlist_entry_id,v_queue.communication_type,
    coalesce(nullif(p_recipient_digest,''),'unavailable'),
    v_queue.template_version,coalesce(nullif(p_payload_digest,''),'unavailable'),
    nullif(p_provider_message_id,''),v_state,now(),p_command_key
  );
  return jsonb_build_object('replayed',false,'state',v_state,
    'attemptCount',v_queue.attempt_count);
end;
$$;

create or replace function public.complete_workshop_message_delivery(
  p_queue_id uuid,p_worker text,p_provider_message_id text,
  p_recipient_digest text,p_payload_digest text,p_token_digest text,
  p_command_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if nullif(p_token_digest,'') is not null then
    perform public.register_workshop_message_token(
      p_queue_id,p_worker,p_token_digest,p_command_key
    );
  end if;
  return public.record_workshop_communication_outcome(
    p_queue_id,p_worker,'accepted',p_provider_message_id,p_recipient_digest,
    p_payload_digest,null,null,p_command_key
  );
end;
$$;

create or replace function public.cancel_workshop_communications(
  p_booking_id uuid,p_personal_data_request_id uuid,p_reason_category text
) returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  update public.workshop_message_queue q set state='suppressed',resolved_at=now(),
    claimed_at=null,claimed_by=null,last_error_category=p_reason_category
  where q.state in ('queued','claimed')
    and (q.workshop_booking_id=p_booking_id
      or q.workshop_personal_data_request_id=p_personal_data_request_id)
    and (not q.is_required or p_personal_data_request_id is not null);
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

revoke all on function public.queue_workshop_communication(
  text,text,text,uuid,uuid,uuid,text,boolean,timestamptz,uuid
) from public;
revoke all on function public.claim_workshop_communications(text,integer) from public;
revoke all on function public.queue_workshop_status_recovery(text,text,uuid)
from public;
revoke all on function public.register_workshop_message_token(uuid,text,text,uuid)
from public;
revoke all on function public.record_workshop_communication_outcome(
  uuid,text,text,text,text,text,text,timestamptz,uuid
) from public;
revoke all on function public.complete_workshop_message_delivery(
  uuid,text,text,text,text,text,uuid
) from public;
revoke all on function public.cancel_workshop_communications(uuid,uuid,text) from public;
grant execute on function public.queue_workshop_communication(
  text,text,text,uuid,uuid,uuid,text,boolean,timestamptz,uuid
) to service_role;
grant execute on function public.claim_workshop_communications(text,integer) to service_role;
grant execute on function public.queue_workshop_status_recovery(text,text,uuid)
to service_role;
grant execute on function public.register_workshop_message_token(uuid,text,text,uuid)
to service_role;
grant execute on function public.record_workshop_communication_outcome(
  uuid,text,text,text,text,text,text,timestamptz,uuid
) to service_role;
grant execute on function public.complete_workshop_message_delivery(
  uuid,text,text,text,text,text,uuid
) to service_role;
grant execute on function public.cancel_workshop_communications(uuid,uuid,text)
to service_role;

create or replace function public.enqueue_confirmed_workshop_booking_message()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='confirmed'
    and (tg_op='INSERT' or old.status is distinct from 'confirmed') then
    perform public.queue_workshop_communication(
      'booking_confirmation','booking_contact','v1',
      new.workshop_booking_id,null,null,'status_access',true,
      now()+interval '24 hours',new.workshop_booking_id
    );
  end if;
  return new;
end;
$$;
create trigger trg_workshop_booking_confirmation_message
after insert or update of status on public.workshop_bookings
for each row execute function public.enqueue_confirmed_workshop_booking_message();

create or replace function public.enqueue_workshop_waitlist_offer_message()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform public.queue_workshop_communication(
    'waitlist_offer','waitlist_contact','v1',null,
    new.workshop_waitlist_entry_id,null,'waitlist_offer',true,new.expires_at,
    new.command_key
  );
  return new;
end;
$$;
create trigger trg_workshop_waitlist_offer_message
after insert on public.workshop_waitlist_offers
for each row execute function public.enqueue_workshop_waitlist_offer_message();

create or replace function public.cancel_workshop_waitlist_offer_message()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.state='active' and new.state<>'active' then
    update public.workshop_message_queue set state='suppressed',resolved_at=now(),
      claimed_at=null,claimed_by=null,last_error_category='offer_resolved'
    where command_key=old.command_key and state in ('queued','claimed');
  end if;
  return new;
end;
$$;
create trigger trg_workshop_waitlist_offer_message_resolution
after update of state on public.workshop_waitlist_offers
for each row execute function public.cancel_workshop_waitlist_offer_message();
