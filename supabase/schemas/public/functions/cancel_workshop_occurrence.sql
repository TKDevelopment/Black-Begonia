create or replace function public.cancel_workshop_occurrence(
  p_occurrence_id uuid,
  p_reason_category text,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_occurrence public.workshop_occurrences;
  v_existing public.workshop_audit_events;
  v_actor uuid:=auth.uid();
  v_hold_count integer:=0;
  v_checkout_count integer:=0;
  v_booking_count integer:=0;
  v_notice_count integer:=0;
  v_refund_review_count integer:=0;
  v_race_review_count integer:=0;
  v_waitlist_count integer:=0;
  v_booking record;
begin
  if not public.is_internal_crm_user() then
    raise exception 'not authorized' using errcode='42501';
  end if;
  if p_command_key is null or p_reason_category not in(
    'florist_cancelled','venue_unavailable','weather',
    'insufficient_enrollment','safety','other'
  ) then
    raise exception 'invalid cancellation' using errcode='22023';
  end if;

  select * into v_existing from public.workshop_audit_events
  where command_key=p_command_key and event_type='occurrence_cancelled';
  if found then
    return v_existing.safe_metadata||jsonb_build_object('replayed',true);
  end if;

  select * into v_occurrence from public.workshop_occurrences
  where workshop_occurrence_id=p_occurrence_id for update;
  if not found then
    raise exception 'occurrence not found' using errcode='P0002';
  end if;
  if v_occurrence.status not in('draft','published_open','registration_closed') then
    raise exception 'invalid lifecycle transition' using errcode='P0001';
  end if;

  update public.workshop_occurrences
  set status='cancelled',cancelled_at=now(),
    status_page_expires_at=now()+interval '12 months',updated_by=v_actor
  where workshop_occurrence_id=p_occurrence_id;

  insert into public.workshop_checkout_expiration_queue(
    workshop_payment_attempt_id,provider_checkout_id,command_key
  )
  select a.workshop_payment_attempt_id,a.provider_checkout_id,gen_random_uuid()
  from public.workshop_payment_attempts a
  join public.workshop_bookings b
    on b.workshop_booking_id=a.workshop_booking_id
  where b.workshop_occurrence_id=p_occurrence_id
    and a.provider='stripe'
    and a.provider_checkout_id is not null
    and a.state in('creating','active','processing')
  on conflict(workshop_payment_attempt_id) do nothing;
  get diagnostics v_checkout_count=row_count;

  insert into public.workshop_payment_exceptions(
    workshop_booking_id,workshop_occurrence_id,workshop_payment_attempt_id,
    exception_type,urgency,amount_minor,currency,summary,safe_detail,command_key
  )
  select b.workshop_booking_id,p_occurrence_id,a.workshop_payment_attempt_id,
    'occurrence_cancellation_payment_race','urgent',a.amount_minor,a.currency,
    'Payment processing requires review after workshop cancellation.',
    'Do not confirm seats; reconcile any later provider completion exactly once.',
    gen_random_uuid()
  from public.workshop_bookings b
  join public.workshop_payment_attempts a
    on a.workshop_booking_id=b.workshop_booking_id
  where b.workshop_occurrence_id=p_occurrence_id and a.state='processing'
    and not exists(
      select 1 from public.workshop_payment_exceptions e
      where e.workshop_payment_attempt_id=a.workshop_payment_attempt_id
        and e.exception_type='occurrence_cancellation_payment_race'
        and e.state in('open','acknowledged')
    );
  get diagnostics v_race_review_count=row_count;

  insert into public.workshop_payment_exceptions(
    workshop_booking_id,workshop_occurrence_id,
    exception_type,urgency,amount_minor,currency,summary,safe_detail,command_key
  )
  select b.workshop_booking_id,p_occurrence_id,
    'occurrence_cancellation_refund_review','normal',
    greatest(coalesce((
      select sum(case
        when t.transaction_type='charge' and t.state='paid' then t.amount_minor
        when t.transaction_type in('refund','external_refund') then -t.amount_minor
        else 0 end)
      from public.workshop_payment_transactions t
      where t.workshop_booking_id=b.workshop_booking_id
    ),0),0),b.currency,
    'Paid booking requires florist-controlled cancellation review.',
    'No refund or transfer has been initiated automatically.',gen_random_uuid()
  from public.workshop_bookings b
  where b.workshop_occurrence_id=p_occurrence_id
    and b.payment_state in('paid','partially_refunded','disputed','exception')
    and not exists(
      select 1 from public.workshop_payment_exceptions e
      where e.workshop_booking_id=b.workshop_booking_id
        and e.exception_type='occurrence_cancellation_refund_review'
        and e.state in('open','acknowledged')
    );
  get diagnostics v_refund_review_count=row_count;

  update public.workshop_payment_attempts a
  set state='cancelled',resolved_at=now()
  from public.workshop_bookings b
  where b.workshop_booking_id=a.workshop_booking_id
    and b.workshop_occurrence_id=p_occurrence_id
    and a.state in('creating','active','processing');

  update public.workshop_seat_holds
  set state='cancelled',resolved_at=now(),
    resolution_reason='occurrence_cancelled'
  where workshop_occurrence_id=p_occurrence_id
    and state in('active','confirmed');
  get diagnostics v_hold_count=row_count;

  update public.workshop_waitlist_offers
  set state='cancelled',resolved_at=now()
  where workshop_occurrence_id=p_occurrence_id and state='active';
  update public.workshop_waitlist_entries
  set state='withdrawn'
  where workshop_occurrence_id=p_occurrence_id and state in('waiting','offered');
  get diagnostics v_waitlist_count=row_count;

  for v_booking in
    select b.workshop_booking_id,b.active_quantity,b.contact_email
    from public.workshop_bookings b
    where b.workshop_occurrence_id=p_occurrence_id
      and b.status not in('cancelled','expired','transferred')
    for update
  loop
    if v_booking.active_quantity>0 then
      insert into public.workshop_booking_adjustments(
        workshop_booking_id,adjustment_type,quantity_delta,amount_minor_delta,
        reason,command_key,actor_type,actor_id
      ) values(
        v_booking.workshop_booking_id,'full_cancel',
        -v_booking.active_quantity,0,'occurrence cancelled',gen_random_uuid(),
        'internal',v_actor
      );
    end if;
    update public.workshop_bookings set status='cancelled',active_quantity=0,
      cancelled_at=coalesce(cancelled_at,now())
    where workshop_booking_id=v_booking.workshop_booking_id;
    update public.workshop_attendees set attendance_state='cancelled'
    where workshop_booking_id=v_booking.workshop_booking_id
      and attendance_state='expected';
    v_booking_count:=v_booking_count+1;
    if v_booking.contact_email is not null then
      perform public.queue_workshop_communication(
        'cancellation_notice','booking_contact','v1',
        v_booking.workshop_booking_id,null,null,null,true,null,gen_random_uuid()
      );
      v_notice_count:=v_notice_count+1;
    end if;
  end loop;

  insert into public.workshop_audit_events(
    workshop_definition_id,workshop_occurrence_id,event_type,actor_type,
    actor_id,command_key,safe_metadata
  ) values(
    v_occurrence.workshop_definition_id,p_occurrence_id,'occurrence_cancelled',
    'internal',v_actor,p_command_key,jsonb_build_object(
      'occurrenceId',p_occurrence_id,'lifecycle','cancelled',
      'reasonCategory',p_reason_category,'invalidatedHolds',v_hold_count,
      'checkoutExpirationsQueued',v_checkout_count,
      'affectedBookings',v_booking_count,'customerNoticesQueued',v_notice_count,
      'refundReviews',v_refund_review_count,'raceReviews',v_race_review_count,
      'closedWaitlistEntries',v_waitlist_count
    )
  ) returning * into v_existing;

  return v_existing.safe_metadata||jsonb_build_object('replayed',false);
end;
$$;

revoke all on function public.cancel_workshop_occurrence(uuid,text,uuid)
from public;
grant execute on function public.cancel_workshop_occurrence(uuid,text,uuid)
to authenticated;
