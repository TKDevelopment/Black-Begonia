-- Workshop operations/lifecycle slice. Depends on catalog, booking, payments.
-- Rollback is prohibited after reschedule, waitlist, or communication records.

create table public.workshop_reschedule_responses (
  workshop_reschedule_response_id uuid primary key default gen_random_uuid(),
  workshop_booking_id uuid not null references public.workshop_bookings(workshop_booking_id) on delete restrict,
  source_occurrence_id uuid not null references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  replacement_occurrence_id uuid not null references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  replacement_hold_id uuid not null unique
    references public.workshop_seat_holds(workshop_seat_hold_id) on delete restrict,
  protected_quantity integer not null check(protected_quantity>0),
  response text not null default 'pending'
    check(response in ('pending','accepted','declined','expired','staff_resolved')),
  response_token_digest text not null unique check(char_length(response_token_digest)>=43),
  response_token_expires_at timestamptz not null, responded_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution_command_key uuid unique,
  command_key uuid not null unique, created_at timestamptz not null default now(),
  constraint workshop_reschedule_distinct_occurrences check(source_occurrence_id<>replacement_occurrence_id),
  constraint workshop_reschedule_response_time check((response='pending' and responded_at is null) or (response<>'pending' and responded_at is not null))
);
create unique index uq_workshop_reschedule_pending_booking on public.workshop_reschedule_responses(workshop_booking_id) where response='pending';
alter table public.workshop_reschedule_responses enable row level security;
create policy workshop_reschedule_internal_select on public.workshop_reschedule_responses for select to authenticated using(public.is_internal_crm_user());

create table public.workshop_waitlist_entries (
  workshop_waitlist_entry_id uuid primary key default gen_random_uuid(),
  workshop_occurrence_id uuid not null references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  contact_name text not null, contact_email text not null,
  requested_quantity integer not null check(requested_quantity>0),
  state text not null default 'waiting' check(state in ('waiting','offered','converted','expired','withdrawn')),
  withdrawal_token_digest text not null unique check(char_length(withdrawal_token_digest)>=43),
  command_key uuid not null unique,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index idx_workshop_waitlist_queue on public.workshop_waitlist_entries(workshop_occurrence_id,created_at) where state='waiting';
create trigger trg_workshop_waitlist_entries_updated_at before update on public.workshop_waitlist_entries for each row execute function public.set_updated_at();
alter table public.workshop_waitlist_entries enable row level security;
create policy workshop_waitlist_entries_internal_select on public.workshop_waitlist_entries for select to authenticated using(public.is_internal_crm_user());

create table public.workshop_waitlist_offers (
  workshop_waitlist_offer_id uuid primary key default gen_random_uuid(),
  workshop_waitlist_entry_id uuid not null references public.workshop_waitlist_entries(workshop_waitlist_entry_id) on delete restrict,
  workshop_occurrence_id uuid not null references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  quantity integer not null check(quantity>0),
  state text not null default 'active' check(state in ('active','accepted','expired','cancelled')),
  offer_token_digest text not null unique check(char_length(offer_token_digest)>=43),
  expires_at timestamptz not null, resolved_at timestamptz,
  command_key uuid not null unique, created_at timestamptz not null default now(),
  constraint workshop_waitlist_offer_resolution check((state='active' and resolved_at is null) or (state<>'active' and resolved_at is not null))
);
create unique index uq_workshop_waitlist_active_offer on public.workshop_waitlist_offers(workshop_waitlist_entry_id) where state='active';
create index idx_workshop_waitlist_offer_expiry on public.workshop_waitlist_offers(expires_at) where state='active';
alter table public.workshop_waitlist_offers enable row level security;
create policy workshop_waitlist_offers_internal_select on public.workshop_waitlist_offers for select to authenticated using(public.is_internal_crm_user());

create table public.workshop_communications (
  workshop_communication_id uuid primary key default gen_random_uuid(),
  workshop_booking_id uuid references public.workshop_bookings(workshop_booking_id) on delete restrict,
  workshop_waitlist_entry_id uuid references public.workshop_waitlist_entries(workshop_waitlist_entry_id) on delete restrict,
  communication_type text not null, delivery_channel text not null default 'email' check(delivery_channel='email'),
  recipient_digest text not null, template_version text not null, payload_digest text not null,
  provider_message_id text,
  delivery_state text not null default 'queued' check(delivery_state in ('queued','claimed','sent','delivered','failed','suppressed')),
  occurred_at timestamptz not null default now(), command_key uuid not null unique,
  created_at timestamptz not null default now(),
  constraint workshop_communication_owner check((workshop_booking_id is not null)::integer+(workshop_waitlist_entry_id is not null)::integer=1)
);
create index idx_workshop_communications_delivery on public.workshop_communications(delivery_state,occurred_at);
create trigger trg_workshop_communications_immutable before update or delete on public.workshop_communications for each row execute function public.reject_workshop_immutable_change();
alter table public.workshop_communications enable row level security;
create policy workshop_communications_internal_select on public.workshop_communications for select to authenticated using(public.is_internal_crm_user());

create table public.workshop_checkout_expiration_queue (
  workshop_checkout_expiration_queue_id uuid primary key default gen_random_uuid(),
  workshop_payment_attempt_id uuid not null unique
    references public.workshop_payment_attempts(workshop_payment_attempt_id)
    on delete restrict,
  provider_checkout_id text not null,
  state text not null default 'queued'
    check(state in('queued','claimed','completed','failed')),
  attempt_count integer not null default 0 check(attempt_count between 0 and 10),
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,claimed_by text,last_error_category text,
  command_key uuid not null unique,created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint workshop_checkout_expiration_resolution check(
    (state in('queued','claimed') and resolved_at is null)
    or (state in('completed','failed') and resolved_at is not null)
  )
);
create index idx_workshop_checkout_expiration_claim
on public.workshop_checkout_expiration_queue(state,next_attempt_at,created_at)
where state='queued';
alter table public.workshop_checkout_expiration_queue enable row level security;
create policy workshop_checkout_expiration_internal_select
on public.workshop_checkout_expiration_queue for select to authenticated
using(public.is_internal_crm_user());

revoke all on public.workshop_reschedule_responses,
  public.workshop_waitlist_entries, public.workshop_waitlist_offers,
  public.workshop_communications,public.workshop_checkout_expiration_queue from anon;
grant select on public.workshop_reschedule_responses,
  public.workshop_waitlist_entries, public.workshop_waitlist_offers,
  public.workshop_communications,public.workshop_checkout_expiration_queue
  to authenticated;

create or replace function public.get_workshop_occurrence_operational_state(
  p_occurrence_id uuid
) returns jsonb
language plpgsql stable security definer set search_path='' as $$
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
  select * into v_occurrence from public.workshop_occurrences
  where workshop_occurrence_id=p_occurrence_id;
  if not found then raise exception 'occurrence not found' using errcode='P0002'; end if;
  select coalesce(sum(quantity),0) into v_reserved
  from public.workshop_seat_holds
  where workshop_occurrence_id=p_occurrence_id
    and (state='confirmed' or (state='active' and effective_expires_at>now()));
  v_remaining:=greatest(v_occurrence.capacity-v_reserved,0);
  select exists(select 1 from public.workshop_waitlist_entries
    where workshop_occurrence_id=p_occurrence_id and state in('waiting','offered'))
  into v_waiting;
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
    'lifecycle',v_occurrence.status,'availability',v_availability,
    'capacity',v_occurrence.capacity,'reservedQuantity',v_reserved,
    'remainingQuantity',v_remaining,'hasWaitingCustomers',v_waiting,
    'completionReviewRequired',v_occurrence.end_at<=now()
      and v_occurrence.status in('published_open','registration_closed')
  );
end;
$$;

create or replace function public.transition_workshop_occurrence(
  p_occurrence_id uuid,p_target_status text,p_command_key uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
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
  if p_command_key is null then raise exception 'invalid command' using errcode='22023'; end if;
  select * into v_existing from public.workshop_audit_events
  where command_key=p_command_key and event_type='occurrence_lifecycle_transition';
  if found then
    return public.get_workshop_occurrence_operational_state(
      v_existing.workshop_occurrence_id
    )||jsonb_build_object('replayed',true);
  end if;
  select * into v_occurrence from public.workshop_occurrences
  where workshop_occurrence_id=p_occurrence_id for update;
  if not found then raise exception 'occurrence not found' using errcode='P0002'; end if;
  v_previous_status:=v_occurrence.status;
  v_allowed:=case
    when v_occurrence.status='draft' and p_target_status='published_open' then true
    when v_occurrence.status='published_open'
      and p_target_status in('registration_closed','completed') then true
    when v_occurrence.status='registration_closed' and p_target_status='completed'
      then true
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
  update public.workshop_occurrences set status=p_target_status,
    published_at=case when p_target_status='published_open'
      then coalesce(published_at,now()) else published_at end,
    completed_at=case when p_target_status='completed' then now() else completed_at end,
    archived_at=case when p_target_status='archived' then now() else archived_at end,
    updated_by=v_actor
  where workshop_occurrence_id=p_occurrence_id returning * into v_occurrence;
  insert into public.workshop_audit_events(
    workshop_definition_id,workshop_occurrence_id,event_type,actor_type,
    actor_id,command_key,safe_metadata
  ) values(
    v_occurrence.workshop_definition_id,p_occurrence_id,
    'occurrence_lifecycle_transition','internal',v_actor,p_command_key,
    jsonb_build_object('fromStatus',v_previous_status,'toStatus',p_target_status)
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

create or replace function public.cancel_workshop_occurrence(
  p_occurrence_id uuid,p_reason_category text,p_command_key uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_occurrence public.workshop_occurrences;
  v_existing public.workshop_audit_events;
  v_actor uuid:=auth.uid();
  v_hold_count integer:=0;v_checkout_count integer:=0;
  v_booking_count integer:=0;v_notice_count integer:=0;
  v_refund_review_count integer:=0;v_race_review_count integer:=0;
  v_waitlist_count integer:=0;v_booking record;
begin
  if not public.is_internal_crm_user() then
    raise exception 'not authorized' using errcode='42501';
  end if;
  if p_command_key is null or p_reason_category not in(
    'florist_cancelled','venue_unavailable','weather',
    'insufficient_enrollment','safety','other'
  ) then raise exception 'invalid cancellation' using errcode='22023'; end if;
  select * into v_existing from public.workshop_audit_events
  where command_key=p_command_key and event_type='occurrence_cancelled';
  if found then
    return v_existing.safe_metadata||jsonb_build_object('replayed',true);
  end if;
  select * into v_occurrence from public.workshop_occurrences
  where workshop_occurrence_id=p_occurrence_id for update;
  if not found then raise exception 'occurrence not found' using errcode='P0002'; end if;
  if v_occurrence.status not in('draft','published_open','registration_closed') then
    raise exception 'invalid lifecycle transition' using errcode='P0001';
  end if;
  update public.workshop_occurrences set status='cancelled',cancelled_at=now(),
    status_page_expires_at=now()+interval '12 months',updated_by=v_actor
  where workshop_occurrence_id=p_occurrence_id;
  insert into public.workshop_checkout_expiration_queue(
    workshop_payment_attempt_id,provider_checkout_id,command_key
  )
  select a.workshop_payment_attempt_id,a.provider_checkout_id,gen_random_uuid()
  from public.workshop_payment_attempts a join public.workshop_bookings b
    on b.workshop_booking_id=a.workshop_booking_id
  where b.workshop_occurrence_id=p_occurrence_id and a.provider='stripe'
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
  from public.workshop_bookings b join public.workshop_payment_attempts a
    on a.workshop_booking_id=b.workshop_booking_id
  where b.workshop_occurrence_id=p_occurrence_id and a.state='processing'
    and not exists(select 1 from public.workshop_payment_exceptions e
      where e.workshop_payment_attempt_id=a.workshop_payment_attempt_id
        and e.exception_type='occurrence_cancellation_payment_race'
        and e.state in('open','acknowledged'));
  get diagnostics v_race_review_count=row_count;
  insert into public.workshop_payment_exceptions(
    workshop_booking_id,workshop_occurrence_id,
    exception_type,urgency,amount_minor,currency,summary,safe_detail,command_key
  )
  select b.workshop_booking_id,p_occurrence_id,
    'occurrence_cancellation_refund_review','normal',
    greatest(coalesce((select sum(case
      when t.transaction_type='charge' and t.state='paid' then t.amount_minor
      when t.transaction_type in('refund','external_refund') then -t.amount_minor
      else 0 end) from public.workshop_payment_transactions t
      where t.workshop_booking_id=b.workshop_booking_id),0),0),b.currency,
    'Paid booking requires florist-controlled cancellation review.',
    'No refund or transfer has been initiated automatically.',gen_random_uuid()
  from public.workshop_bookings b
  where b.workshop_occurrence_id=p_occurrence_id
    and b.payment_state in('paid','partially_refunded','disputed','exception')
    and not exists(select 1 from public.workshop_payment_exceptions e
      where e.workshop_booking_id=b.workshop_booking_id
        and e.exception_type='occurrence_cancellation_refund_review'
        and e.state in('open','acknowledged'));
  get diagnostics v_refund_review_count=row_count;
  update public.workshop_payment_attempts a set state='cancelled',resolved_at=now()
  from public.workshop_bookings b
  where b.workshop_booking_id=a.workshop_booking_id
    and b.workshop_occurrence_id=p_occurrence_id
    and a.state in('creating','active','processing');
  update public.workshop_seat_holds set state='cancelled',resolved_at=now(),
    resolution_reason='occurrence_cancelled'
  where workshop_occurrence_id=p_occurrence_id and state in('active','confirmed');
  get diagnostics v_hold_count=row_count;
  update public.workshop_waitlist_offers set state='cancelled',resolved_at=now()
  where workshop_occurrence_id=p_occurrence_id and state='active';
  update public.workshop_waitlist_entries set state='withdrawn'
  where workshop_occurrence_id=p_occurrence_id and state in('waiting','offered');
  get diagnostics v_waitlist_count=row_count;
  for v_booking in select b.workshop_booking_id,b.active_quantity,b.contact_email
    from public.workshop_bookings b where b.workshop_occurrence_id=p_occurrence_id
      and b.status not in('cancelled','expired','transferred') for update
  loop
    if v_booking.active_quantity>0 then
      insert into public.workshop_booking_adjustments(
        workshop_booking_id,adjustment_type,quantity_delta,amount_minor_delta,
        reason,command_key,actor_type,actor_id
      ) values(v_booking.workshop_booking_id,'full_cancel',
        -v_booking.active_quantity,0,'occurrence cancelled',gen_random_uuid(),
        'internal',v_actor);
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
  ) values(v_occurrence.workshop_definition_id,p_occurrence_id,
    'occurrence_cancelled','internal',v_actor,p_command_key,jsonb_build_object(
      'occurrenceId',p_occurrence_id,'lifecycle','cancelled',
      'reasonCategory',p_reason_category,'invalidatedHolds',v_hold_count,
      'checkoutExpirationsQueued',v_checkout_count,
      'affectedBookings',v_booking_count,'customerNoticesQueued',v_notice_count,
      'refundReviews',v_refund_review_count,'raceReviews',v_race_review_count,
      'closedWaitlistEntries',v_waitlist_count
    )) returning * into v_existing;
  return v_existing.safe_metadata||jsonb_build_object('replayed',false);
end;
$$;
revoke all on function public.cancel_workshop_occurrence(uuid,text,uuid)
from public;
grant execute on function public.cancel_workshop_occurrence(uuid,text,uuid)
to authenticated;

alter table public.workshop_booking_adjustments
  drop constraint workshop_booking_adjustment_effect;
alter table public.workshop_booking_adjustments
  add constraint workshop_booking_adjustment_effect check(
    quantity_delta<>0 or amount_minor_delta<>0 or adjustment_type='transfer'
  );
