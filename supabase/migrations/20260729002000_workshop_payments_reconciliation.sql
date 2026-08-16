-- Workshop payments/reconciliation slice. Depends only on catalog and booking.
-- This adds a workshop-specific ledger; it does not rewrite project payments
-- or historical PayPal facts. Rollback is prohibited after financial writes.

create table public.workshop_payment_attempts (
  workshop_payment_attempt_id uuid primary key default gen_random_uuid(),
  workshop_booking_id uuid not null references public.workshop_bookings(workshop_booking_id) on delete restrict,
  workshop_seat_hold_id uuid not null references public.workshop_seat_holds(workshop_seat_hold_id) on delete restrict,
  provider text not null check(provider in ('stripe','direct_venmo')),
  provider_checkout_id text, provider_payment_id text,
  stripe_price_id text, venmo_target_snapshot text,
  reconciliation_reference text not null unique,
  quantity integer not null check(quantity>0),
  state text not null default 'creating' check(state in ('creating','active','processing','paid','failed','expired','cancelled','superseded')),
  amount_minor bigint not null check(amount_minor>=0), currency text not null check(currency='USD'),
  command_key uuid not null unique, normal_expires_at timestamptz not null,
  effective_expires_at timestamptz not null, resolved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint workshop_payment_attempt_expiry check(effective_expires_at<=normal_expires_at),
  constraint workshop_payment_attempt_resolution check(
    (state in('creating','active','processing') and resolved_at is null)
    or (state not in('creating','active','processing') and resolved_at is not null)
  ),
  constraint workshop_payment_attempt_method_fields check(
    (provider='stripe' and venmo_target_snapshot is null)
    or (provider='direct_venmo' and venmo_target_snapshot is not null)
  )
);
create unique index uq_workshop_payment_attempt_provider_checkout on public.workshop_payment_attempts(provider,provider_checkout_id) where provider_checkout_id is not null;
create index idx_workshop_payment_attempt_booking on public.workshop_payment_attempts(workshop_booking_id,created_at desc);
create unique index uq_workshop_payment_attempt_active on public.workshop_payment_attempts(workshop_booking_id)
where state in('creating','active','processing');
create trigger trg_workshop_payment_attempts_updated_at before update on public.workshop_payment_attempts for each row execute function public.set_updated_at();
alter table public.workshop_payment_attempts enable row level security;
create policy workshop_payment_attempts_internal_select on public.workshop_payment_attempts for select to authenticated using(public.is_internal_crm_user());

create or replace function public.reject_workshop_immutable_change()
returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Workshop financial history is immutable.' using errcode='55000'; end; $$;

create table public.workshop_payment_transactions (
  workshop_payment_transaction_id uuid primary key default gen_random_uuid(),
  workshop_booking_id uuid not null references public.workshop_bookings(workshop_booking_id) on delete restrict,
  workshop_occurrence_id uuid not null references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  workshop_payment_attempt_id uuid references public.workshop_payment_attempts(workshop_payment_attempt_id) on delete restrict,
  transaction_type text not null check(transaction_type in ('charge','refund','dispute','reversal','adjustment')),
  provider text not null check(provider in ('stripe','direct_venmo','manual')),
  provider_transaction_id text, payment_reference text not null unique,
  amount_minor bigint not null, currency text not null check(currency='USD'),
  occurred_at timestamptz not null,
  state text not null check(state in ('pending','processing','paid','partially_refunded','refunded','disputed','reversed','exception')),
  command_key uuid unique, payload_digest text, normalized_facts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index uq_workshop_transactions_provider on public.workshop_payment_transactions(provider,provider_transaction_id,transaction_type) where provider_transaction_id is not null;
create index idx_workshop_transactions_occurrence on public.workshop_payment_transactions(workshop_occurrence_id,occurred_at desc);
create trigger trg_workshop_payment_transactions_immutable before update or delete on public.workshop_payment_transactions for each row execute function public.reject_workshop_immutable_change();
alter table public.workshop_payment_transactions enable row level security;
create policy workshop_transactions_internal_select on public.workshop_payment_transactions for select to authenticated using(public.is_internal_crm_user());

create table public.workshop_payment_provider_events (
  workshop_payment_provider_event_id uuid primary key default gen_random_uuid(),
  provider text not null check(provider='stripe'), provider_event_id text not null,
  provider_object_id text, provider_object_type text, event_type text not null, event_occurred_at timestamptz not null,
  signature_verified_at timestamptz not null, payload_digest text not null,
  normalized_facts jsonb not null default '{}'::jsonb,
  processing_state text not null default 'received' check(processing_state in ('received','processed','duplicate','failed','unmatched')),
  processing_error text,
  workshop_payment_attempt_id uuid references public.workshop_payment_attempts(workshop_payment_attempt_id) on delete restrict,
  workshop_payment_transaction_id uuid references public.workshop_payment_transactions(workshop_payment_transaction_id) on delete restrict,
  received_at timestamptz not null default now(), processed_at timestamptz,
  unique(provider,provider_event_id)
);
create unique index uq_workshop_provider_event_effect on public.workshop_payment_provider_events(provider,provider_object_id,event_type) where provider_object_id is not null and processing_state='processed';
create trigger trg_workshop_payment_provider_events_no_delete before delete on public.workshop_payment_provider_events for each row execute function public.reject_workshop_immutable_change();
alter table public.workshop_payment_provider_events enable row level security;
create policy workshop_provider_events_internal_select on public.workshop_payment_provider_events for select to authenticated using(public.is_internal_crm_user());

create table public.workshop_payment_exceptions (
  workshop_payment_exception_id uuid primary key default gen_random_uuid(),
  workshop_booking_id uuid references public.workshop_bookings(workshop_booking_id) on delete restrict,
  workshop_occurrence_id uuid references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  workshop_payment_attempt_id uuid references public.workshop_payment_attempts(workshop_payment_attempt_id) on delete restrict,
  workshop_payment_transaction_id uuid references public.workshop_payment_transactions(workshop_payment_transaction_id) on delete restrict,
  exception_type text not null,
  urgency text not null default 'normal' check(urgency in('normal','urgent')),
  state text not null default 'open' check(state in('open','acknowledged','resolved')),
  amount_minor bigint, currency text check(currency is null or currency='USD'),
  summary text not null, safe_detail text,
  provider_event_id uuid references public.workshop_payment_provider_events(workshop_payment_provider_event_id) on delete restrict,
  assigned_to uuid references public.profiles(id) on delete set null,
  command_key uuid not null unique, resolution text, resolution_reference text,
  customer_action_deadline timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null, resolved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index idx_workshop_exceptions_open on public.workshop_payment_exceptions(workshop_occurrence_id,created_at) where state in ('open','acknowledged');
create trigger trg_workshop_payment_exceptions_updated_at before update on public.workshop_payment_exceptions for each row execute function public.set_updated_at();
alter table public.workshop_payment_exceptions enable row level security;
create policy workshop_exceptions_internal_select on public.workshop_payment_exceptions for select to authenticated using(public.is_internal_crm_user());

create table public.workshop_expenses (
  workshop_expense_id uuid primary key default gen_random_uuid(),
  workshop_occurrence_id uuid not null references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  expense_category text not null, description text not null,
  amount_minor bigint not null check(amount_minor>=0), currency text not null check(currency='USD'),
  incurred_on date not null, receipt_storage_path text,
  command_key uuid not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_workshop_expenses_occurrence on public.workshop_expenses(workshop_occurrence_id,incurred_on desc);
create trigger trg_workshop_expenses_immutable before update or delete on public.workshop_expenses for each row execute function public.reject_workshop_immutable_change();
alter table public.workshop_expenses enable row level security;
create policy workshop_expenses_internal_select on public.workshop_expenses for select to authenticated using(public.is_internal_crm_user());

-- Payment-attempt commands are installed in this slice because their table is
-- intentionally additive after the booking/capacity slice.
create or replace function public.switch_workshop_payment_method(
  p_status_token_digest text,p_method text,p_command_key uuid,
  p_venmo_target text default null,p_stripe_hold_minutes integer default 15,
  p_venmo_hold_hours integer default 24
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  b public.workshop_bookings;o public.workshop_occurrences;
  h public.workshop_seat_holds;a public.workshop_payment_attempts;
  v_normal timestamptz;v_effective timestamptz;v_price text;
  v_attempt_id uuid:=gen_random_uuid();
begin
  select * into a from public.workshop_payment_attempts where command_key=p_command_key;
  if found then return jsonb_build_object('replayed',true,
    'paymentAttemptId',a.workshop_payment_attempt_id,'method',a.provider,
    'quantity',a.quantity,
    'amountMinor',a.amount_minor,'currency',a.currency,
    'reference',a.reconciliation_reference,'effectiveExpiresAt',a.effective_expires_at,
    'approvedTarget',a.venmo_target_snapshot);end if;
  if p_method not in('stripe','direct_venmo')
    or p_stripe_hold_minutes not between 1 and 30
    or p_venmo_hold_hours not between 1 and 24 then raise exception 'invalid_request';end if;
  select * into b from public.workshop_bookings
    where status_token_digest=p_status_token_digest for update;
  if not found or b.status_token_expires_at<=now() then raise exception 'unavailable';end if;
  select * into o from public.workshop_occurrences
    where workshop_occurrence_id=b.workshop_occurrence_id for update;
  select * into h from public.workshop_seat_holds
    where booking_id=b.workshop_booking_id and state='active'
    order by created_at desc limit 1 for update;
  if not found or h.effective_expires_at<=now() or b.status<>'pending_payment'
    then raise exception 'unavailable';end if;
  if(p_method='stripe' and not o.stripe_enabled)
    or(p_method='direct_venmo' and not o.venmo_enabled)
    or(p_method='direct_venmo' and char_length(btrim(coalesce(p_venmo_target,'')))=0)
    then raise exception 'payment_method_unavailable';end if;
  if p_method='stripe' then
    select stripe_price_id into v_price from public.workshop_stripe_price_versions
    where workshop_stripe_price_version_id=o.stripe_price_version_id and state='active';
    if v_price is null then raise exception 'payment_method_unavailable';end if;
    v_normal:=now()+make_interval(mins=>p_stripe_hold_minutes);
  else v_normal:=now()+make_interval(hours=>p_venmo_hold_hours);end if;
  v_effective:=least(v_normal,o.registration_closes_at,o.start_at);
  if v_effective<=now() then raise exception 'registration_closed';end if;
  update public.workshop_payment_attempts set state='superseded',resolved_at=now()
    where workshop_booking_id=b.workshop_booking_id
      and state in('creating','active','processing');
  update public.workshop_seat_holds set payment_method=p_method,
    normal_expires_at=v_normal,effective_expires_at=v_effective
    where workshop_seat_hold_id=h.workshop_seat_hold_id returning * into h;
  insert into public.workshop_payment_attempts(workshop_payment_attempt_id,workshop_booking_id,
    workshop_seat_hold_id,provider,stripe_price_id,venmo_target_snapshot,
    reconciliation_reference,quantity,state,amount_minor,currency,command_key,
    normal_expires_at,effective_expires_at)
  values(v_attempt_id,b.workshop_booking_id,h.workshop_seat_hold_id,p_method,v_price,
    case when p_method='direct_venmo' then btrim(p_venmo_target) end,
    b.booking_reference||'-'||upper(substr(replace(v_attempt_id::text,'-',''),1,6)),
    b.purchased_quantity,'active',b.total_minor_snapshot,
    b.currency,p_command_key,v_normal,v_effective) returning * into a;
  update public.workshop_bookings set payment_method=p_method,payment_state='pending'
    where workshop_booking_id=b.workshop_booking_id;
  return jsonb_build_object('replayed',false,
    'paymentAttemptId',a.workshop_payment_attempt_id,'method',a.provider,
    'quantity',a.quantity,
    'amountMinor',a.amount_minor,'currency',a.currency,
    'reference',a.reconciliation_reference,'effectiveExpiresAt',a.effective_expires_at,
    'approvedTarget',a.venmo_target_snapshot,'stripePriceId',a.stripe_price_id);
end;$$;
revoke all on function public.switch_workshop_payment_method(
  text,text,uuid,text,integer,integer) from public;
grant execute on function public.switch_workshop_payment_method(
  text,text,uuid,text,integer,integer) to service_role;

create or replace function public.attach_workshop_stripe_checkout(
  p_payment_attempt_id uuid,p_provider_checkout_id text,p_command_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.workshop_payment_attempts;v_replayed boolean;
begin
  if char_length(btrim(coalesce(p_provider_checkout_id,'')))=0
    then raise exception 'invalid_request';end if;
  select * into a from public.workshop_payment_attempts
    where workshop_payment_attempt_id=p_payment_attempt_id for update;
  if not found or a.provider<>'stripe' or a.state not in('creating','active')
    then raise exception 'unavailable';end if;
  if a.provider_checkout_id is not null
    and a.provider_checkout_id<>p_provider_checkout_id
    then raise exception 'invalid_transition';end if;
  v_replayed:=a.provider_checkout_id=p_provider_checkout_id;
  update public.workshop_payment_attempts set provider_checkout_id=p_provider_checkout_id,
    state='active' where workshop_payment_attempt_id=p_payment_attempt_id returning * into a;
  return jsonb_build_object('replayed',v_replayed,
    'paymentAttemptId',a.workshop_payment_attempt_id,
    'providerCheckoutId',a.provider_checkout_id,'commandKey',p_command_key);
end;$$;
revoke all on function public.attach_workshop_stripe_checkout(uuid,text,uuid) from public;
grant execute on function public.attach_workshop_stripe_checkout(uuid,text,uuid)
  to service_role;

create or replace function public.expire_workshop_holds(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ids uuid[];v_count integer;
begin
  if p_limit not between 1 and 500 then raise exception 'invalid_request';end if;
  select array_agg(d.workshop_seat_hold_id) into v_ids from(
    select workshop_seat_hold_id from public.workshop_seat_holds
    where state='active' and effective_expires_at<=now()
    order by effective_expires_at,workshop_seat_hold_id limit p_limit
    for update skip locked)d;
  if v_ids is null then return jsonb_build_object('expiredCount',0);end if;
  update public.workshop_seat_holds set state='expired',resolved_at=now(),
    resolution_reason='effective_deadline_elapsed'
    where workshop_seat_hold_id=any(v_ids);get diagnostics v_count=row_count;
  update public.workshop_payment_attempts set state='expired',resolved_at=now()
    where workshop_seat_hold_id=any(v_ids) and state in('creating','active');
  update public.workshop_bookings b set status='expired',
    payment_state=case when b.payment_state='unselected' then 'unselected' else 'exception' end
    where b.workshop_booking_id in(select booking_id from public.workshop_seat_holds
      where workshop_seat_hold_id=any(v_ids))
    and b.status='pending_payment' and b.payment_state not in('paid','processing');
  return jsonb_build_object('expiredCount',v_count);
end;$$;
revoke all on function public.expire_workshop_holds(integer) from public;
grant execute on function public.expire_workshop_holds(integer) to service_role;

create or replace function public.reconcile_workshop_stripe_event(
  p_provider_event_id text,p_event_type text,p_provider_object_id text,
  p_provider_object_type text,p_event_occurred_at timestamptz,
  p_signature_verified_at timestamptz,p_payload_digest text,
  p_payment_attempt_id uuid,p_provider_payment_id text,p_amount_minor bigint,
  p_currency text,p_command_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  e public.workshop_payment_provider_events;prior public.workshop_payment_provider_events;
  a public.workshop_payment_attempts;b public.workshop_bookings;
  h public.workshop_seat_holds;o public.workshop_occurrences;
  t public.workshop_payment_transactions;v_reserved bigint;v_type text;
begin
  if char_length(btrim(coalesce(p_provider_event_id,'')))=0
    or char_length(btrim(coalesce(p_payload_digest,'')))<32
    or p_signature_verified_at is null or p_event_occurred_at is null
    or p_amount_minor<0 or p_currency<>'USD' then raise exception 'invalid_request';end if;
  select * into e from public.workshop_payment_provider_events
    where provider='stripe' and provider_event_id=p_provider_event_id;
  if found then return jsonb_build_object('replayed',true,'state',e.processing_state,
    'providerEventId',e.workshop_payment_provider_event_id);end if;
  insert into public.workshop_payment_provider_events(provider,provider_event_id,
    provider_object_id,provider_object_type,event_type,event_occurred_at,
    signature_verified_at,payload_digest,normalized_facts,processing_state,
    workshop_payment_attempt_id)
  values('stripe',p_provider_event_id,nullif(btrim(coalesce(p_provider_object_id,'')),''),
    nullif(btrim(coalesce(p_provider_object_type,'')),''),p_event_type,
    p_event_occurred_at,p_signature_verified_at,p_payload_digest,
    jsonb_build_object('amountMinor',p_amount_minor,'currency',p_currency,
      'providerPaymentId',p_provider_payment_id),'received',p_payment_attempt_id)
  returning * into e;
  select * into prior from public.workshop_payment_provider_events
    where provider='stripe' and provider_object_id=p_provider_object_id
      and event_type=p_event_type and processing_state='processed'
      and workshop_payment_provider_event_id<>e.workshop_payment_provider_event_id limit 1;
  if found then
    update public.workshop_payment_provider_events set processing_state='duplicate',
      processed_at=now() where workshop_payment_provider_event_id=e.workshop_payment_provider_event_id;
    return jsonb_build_object('replayed',true,'state','duplicate',
      'providerEventId',e.workshop_payment_provider_event_id);
  end if;
  select * into a from public.workshop_payment_attempts
    where workshop_payment_attempt_id=p_payment_attempt_id for update;
  if not found then
    update public.workshop_payment_provider_events set processing_state='unmatched',
      processing_error='payment_attempt_unavailable',processed_at=now()
      where workshop_payment_provider_event_id=e.workshop_payment_provider_event_id;
    insert into public.workshop_payment_exceptions(workshop_occurrence_id,
      exception_type,urgency,amount_minor,currency,summary,safe_detail,
      provider_event_id,command_key)
    values(null,'unmatched_payment','urgent',p_amount_minor,p_currency,
      'Stripe money could not be matched to a workshop payment attempt.',
      'Review the provider event and workshop payment metadata.',
      e.workshop_payment_provider_event_id,p_command_key);
    return jsonb_build_object('replayed',false,'state','unmatched');
  end if;
  select * into b from public.workshop_bookings
    where workshop_booking_id=a.workshop_booking_id for update;
  select * into h from public.workshop_seat_holds
    where workshop_seat_hold_id=a.workshop_seat_hold_id for update;
  select * into o from public.workshop_occurrences
    where workshop_occurrence_id=b.workshop_occurrence_id for update;
  if p_event_type in('checkout.session.expired',
    'checkout.session.async_payment_failed','payment_intent.payment_failed') then
    if a.state='paid' or b.payment_state='paid' then
      update public.workshop_payment_provider_events set processing_state='duplicate',
        processing_error='terminal_success_already_recorded',processed_at=now()
        where workshop_payment_provider_event_id=e.workshop_payment_provider_event_id;
      return jsonb_build_object('replayed',false,'state','duplicate');
    end if;
    update public.workshop_payment_attempts
      set state=case when p_event_type='checkout.session.expired' then 'expired' else 'failed' end,
        resolved_at=now() where workshop_payment_attempt_id=a.workshop_payment_attempt_id;
    update public.workshop_seat_holds set state='released',resolved_at=now(),
      resolution_reason='stripe_payment_not_completed'
      where workshop_seat_hold_id=h.workshop_seat_hold_id and state='active';
    update public.workshop_bookings set status='expired',payment_state='exception'
      where workshop_booking_id=b.workshop_booking_id and status='pending_payment';
    update public.workshop_payment_provider_events set processing_state='processed',
      processed_at=now() where workshop_payment_provider_event_id=e.workshop_payment_provider_event_id;
    return jsonb_build_object('replayed',false,'state','failed');
  end if;
  if p_event_type not in('checkout.session.completed',
    'checkout.session.async_payment_succeeded','payment_intent.succeeded')
    then raise exception 'unsupported_event_type';end if;
  if a.amount_minor<>p_amount_minor or a.currency<>p_currency then
    v_type:=case when p_amount_minor<a.amount_minor then 'underpayment' else 'overpayment' end;
  elsif a.state='superseded' then v_type:='superseded_payment';
  elsif b.status='cancelled' or(b.status='expired' and not(
    a.state='expired' and h.state='expired'
    and p_event_occurred_at<=a.effective_expires_at))then v_type:='cancellation_race';
  elsif a.state='paid' or b.payment_state='paid' then v_type:='duplicate_payment';
  elsif p_event_occurred_at>a.effective_expires_at then v_type:='late_payment';
  end if;
  if v_type is null and h.state='expired' then
    select coalesce(sum(quantity),0) into v_reserved from public.workshop_seat_holds
      where workshop_occurrence_id=o.workshop_occurrence_id
        and workshop_seat_hold_id<>h.workshop_seat_hold_id
        and(state='confirmed' or(state='active' and effective_expires_at>now()));
    if v_reserved+h.quantity>o.capacity then v_type:='late_capacity_conflict';end if;
  elsif v_type is null and h.state not in('active','expired') then
    v_type:='capacity_unavailable';
  end if;
  insert into public.workshop_payment_transactions(workshop_booking_id,
    workshop_occurrence_id,workshop_payment_attempt_id,transaction_type,provider,
    provider_transaction_id,payment_reference,amount_minor,currency,occurred_at,
    state,command_key,payload_digest,normalized_facts)
  values(b.workshop_booking_id,o.workshop_occurrence_id,a.workshop_payment_attempt_id,
    'charge','stripe',p_provider_payment_id,'STRIPE-'||p_provider_event_id,
    p_amount_minor,p_currency,p_event_occurred_at,
    case when v_type is null then 'paid' else 'exception' end,p_command_key,
    p_payload_digest,jsonb_build_object('providerEventId',p_provider_event_id))
  returning * into t;
  if v_type is null then
    update public.workshop_payment_attempts set state='paid',
      provider_payment_id=p_provider_payment_id,resolved_at=now()
      where workshop_payment_attempt_id=a.workshop_payment_attempt_id;
    update public.workshop_seat_holds set state='confirmed',resolved_at=now(),
      resolution_reason='trusted_stripe_payment'
      where workshop_seat_hold_id=h.workshop_seat_hold_id;
    update public.workshop_bookings set status='confirmed',payment_state='paid',
      payment_method='stripe',confirmed_at=coalesce(confirmed_at,p_event_occurred_at)
      where workshop_booking_id=b.workshop_booking_id;
  else
    update public.workshop_bookings set payment_state='exception'
      where workshop_booking_id=b.workshop_booking_id and payment_state<>'paid';
    insert into public.workshop_payment_exceptions(workshop_booking_id,
      workshop_occurrence_id,workshop_payment_attempt_id,
      workshop_payment_transaction_id,exception_type,urgency,amount_minor,
      currency,summary,safe_detail,provider_event_id,command_key)
    values(b.workshop_booking_id,o.workshop_occurrence_id,a.workshop_payment_attempt_id,
      t.workshop_payment_transaction_id,v_type,'urgent',p_amount_minor,p_currency,
      'Stripe payment requires manual workshop reconciliation.',
      'The payment was recorded without changing workshop capacity.',
      e.workshop_payment_provider_event_id,p_command_key);
  end if;
  update public.workshop_payment_provider_events set processing_state='processed',
    workshop_payment_transaction_id=t.workshop_payment_transaction_id,processed_at=now()
    where workshop_payment_provider_event_id=e.workshop_payment_provider_event_id;
  return jsonb_build_object('replayed',false,
    'state',case when v_type is null then 'confirmed' else 'exception' end,
    'exceptionType',v_type,'bookingId',b.workshop_booking_id,
    'transactionId',t.workshop_payment_transaction_id);
end;$$;
revoke all on function public.reconcile_workshop_stripe_event(
  text,text,text,text,timestamptz,timestamptz,text,uuid,text,bigint,text,uuid) from public;
grant execute on function public.reconcile_workshop_stripe_event(
  text,text,text,text,timestamptz,timestamptz,text,uuid,text,bigint,text,uuid)
  to service_role;

create or replace function public.record_workshop_venmo_receipt(
  p_reference text,p_provider_payment_id text,p_amount_minor bigint,
  p_currency text,p_occurred_at timestamptz,p_command_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  a public.workshop_payment_attempts;b public.workshop_bookings;
  h public.workshop_seat_holds;o public.workshop_occurrences;
  t public.workshop_payment_transactions;v_reserved bigint;v_type text;
begin
  if coalesce(auth.role(),'')<>'service_role' and session_user<>'postgres'
    and not public.is_internal_crm_user() then raise exception 'not authorized';end if;
  if char_length(btrim(coalesce(p_reference,'')))=0
    or char_length(btrim(coalesce(p_provider_payment_id,'')))=0
    or p_amount_minor<=0 or p_currency<>'USD' or p_occurred_at is null
    then raise exception 'invalid_request';end if;
  select * into t from public.workshop_payment_transactions
    where command_key=p_command_key or(provider='direct_venmo'
      and provider_transaction_id=p_provider_payment_id and transaction_type='charge');
  if found then return jsonb_build_object('replayed',true,'state',t.state,
    'transactionId',t.workshop_payment_transaction_id);end if;
  select * into a from public.workshop_payment_attempts
    where provider='direct_venmo' and reconciliation_reference=p_reference
    order by created_at desc limit 1 for update;
  if not found then
    insert into public.workshop_payment_exceptions(workshop_occurrence_id,
      exception_type,urgency,amount_minor,currency,summary,safe_detail,command_key)
    values(null,'missing_reference','urgent',p_amount_minor,p_currency,
      'Direct Venmo receipt could not be matched to a workshop booking.',
      'Review the supplied reconciliation reference.',p_command_key);
    return jsonb_build_object('replayed',false,'state','unmatched');
  end if;
  select * into b from public.workshop_bookings
    where workshop_booking_id=a.workshop_booking_id for update;
  select * into h from public.workshop_seat_holds
    where workshop_seat_hold_id=a.workshop_seat_hold_id for update;
  select * into o from public.workshop_occurrences
    where workshop_occurrence_id=b.workshop_occurrence_id for update;
  if p_amount_minor<a.amount_minor then v_type:='underpayment';
  elsif p_amount_minor>a.amount_minor then v_type:='overpayment';
  elsif a.state='superseded' then v_type:='superseded_payment';
  elsif a.state='paid' or b.payment_state='paid' then v_type:='duplicate_payment';
  elsif b.status='cancelled' or(b.status='expired' and not(
    a.state='expired' and h.state='expired'
    and p_occurred_at<=a.effective_expires_at))then v_type:='cancellation_race';
  elsif p_occurred_at>a.effective_expires_at then v_type:='late_payment';end if;
  if v_type is null and h.state='expired' then
    select coalesce(sum(quantity),0) into v_reserved from public.workshop_seat_holds
      where workshop_occurrence_id=o.workshop_occurrence_id
        and workshop_seat_hold_id<>h.workshop_seat_hold_id
        and(state='confirmed' or(state='active' and effective_expires_at>now()));
    if v_reserved+h.quantity>o.capacity then v_type:='late_capacity_conflict';end if;
  elsif v_type is null and h.state not in('active','expired') then
    v_type:='capacity_unavailable';
  end if;
  insert into public.workshop_payment_transactions(workshop_booking_id,
    workshop_occurrence_id,workshop_payment_attempt_id,transaction_type,provider,
    provider_transaction_id,payment_reference,amount_minor,currency,occurred_at,
    state,command_key,normalized_facts)
  values(b.workshop_booking_id,o.workshop_occurrence_id,a.workshop_payment_attempt_id,
    'charge','direct_venmo',p_provider_payment_id,'VENMO-'||p_provider_payment_id,
    p_amount_minor,p_currency,p_occurred_at,
    case when v_type is null then 'paid' else 'exception' end,p_command_key,
    jsonb_build_object('reconciliationReference',p_reference))returning * into t;
  if v_type is null then
    update public.workshop_payment_attempts set state='paid',
      provider_payment_id=p_provider_payment_id,resolved_at=now()
      where workshop_payment_attempt_id=a.workshop_payment_attempt_id;
    update public.workshop_seat_holds set state='confirmed',resolved_at=now(),
      resolution_reason='confirmed_direct_venmo_payment'
      where workshop_seat_hold_id=h.workshop_seat_hold_id;
    update public.workshop_bookings set status='confirmed',payment_state='paid',
      payment_method='direct_venmo',confirmed_at=coalesce(confirmed_at,p_occurred_at)
      where workshop_booking_id=b.workshop_booking_id;
  else
    update public.workshop_bookings set payment_state='exception'
      where workshop_booking_id=b.workshop_booking_id and payment_state<>'paid';
    insert into public.workshop_payment_exceptions(workshop_booking_id,
      workshop_occurrence_id,workshop_payment_attempt_id,
      workshop_payment_transaction_id,exception_type,urgency,amount_minor,
      currency,summary,safe_detail,command_key)
    values(b.workshop_booking_id,o.workshop_occurrence_id,a.workshop_payment_attempt_id,
      t.workshop_payment_transaction_id,v_type,'urgent',p_amount_minor,p_currency,
      'Direct Venmo payment requires manual workshop reconciliation.',
      'The receipt was recorded without changing workshop capacity.',p_command_key);
  end if;
  return jsonb_build_object('replayed',false,
    'state',case when v_type is null then 'confirmed' else 'exception' end,
    'exceptionType',v_type,'bookingId',b.workshop_booking_id,
    'transactionId',t.workshop_payment_transaction_id);
end;$$;
revoke all on function public.record_workshop_venmo_receipt(
  text,text,bigint,text,timestamptz,uuid) from public;
grant execute on function public.record_workshop_venmo_receipt(
  text,text,bigint,text,timestamptz,uuid) to service_role,authenticated;

create or replace function public.resolve_workshop_payment_exception(
  p_exception_id uuid,p_resolution text,p_resolution_reference text,
  p_amount_minor bigint,p_command_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  e public.workshop_payment_exceptions;a public.workshop_payment_attempts;
  t public.workshop_payment_transactions;
begin
  if coalesce(auth.role(),'')<>'service_role' and session_user<>'postgres'
    and not public.is_internal_crm_user() then raise exception 'not authorized';end if;
  if p_resolution not in('external_refund','accepted_payment',
    'transferred_payment','dismissed_non_payment')
    or char_length(btrim(coalesce(p_resolution_reference,'')))=0
    then raise exception 'invalid_request';end if;
  select * into e from public.workshop_payment_exceptions
    where command_key=p_command_key or workshop_payment_exception_id=p_exception_id
    for update;
  if not found then raise exception 'not_found';end if;
  if e.command_key=p_command_key and e.state='resolved' then
    return jsonb_build_object('replayed',true,'exceptionId',
      e.workshop_payment_exception_id,'state',e.state,'resolution',e.resolution);
  end if;
  if e.state='resolved' then raise exception 'invalid_transition';end if;
  if p_resolution='external_refund' then
    if e.workshop_booking_id is null or e.workshop_occurrence_id is null
      or p_amount_minor is null or p_amount_minor<=0 then raise exception 'invalid_request';end if;
    select * into a from public.workshop_payment_attempts
      where workshop_payment_attempt_id=e.workshop_payment_attempt_id;
    insert into public.workshop_payment_transactions(workshop_booking_id,
      workshop_occurrence_id,workshop_payment_attempt_id,transaction_type,provider,
      provider_transaction_id,payment_reference,amount_minor,currency,occurred_at,
      state,command_key,normalized_facts)
    values(e.workshop_booking_id,e.workshop_occurrence_id,
      e.workshop_payment_attempt_id,'refund',coalesce(a.provider,'manual'),
      p_resolution_reference,'REFUND-'||p_resolution_reference,p_amount_minor,
      coalesce(e.currency,'USD'),now(),'refunded',p_command_key,
      jsonb_build_object('exceptionId',e.workshop_payment_exception_id))
    returning * into t;
  end if;
  update public.workshop_payment_exceptions set state='resolved',
    resolution=p_resolution,resolution_reference=btrim(p_resolution_reference),
    resolved_by=auth.uid(),resolved_at=now(),command_key=p_command_key
    where workshop_payment_exception_id=e.workshop_payment_exception_id returning * into e;
  return jsonb_build_object('replayed',false,
    'exceptionId',e.workshop_payment_exception_id,'state',e.state,
    'resolution',e.resolution,'transactionId',t.workshop_payment_transaction_id);
end;$$;
revoke all on function public.resolve_workshop_payment_exception(
  uuid,text,text,bigint,uuid) from public;
grant execute on function public.resolve_workshop_payment_exception(
  uuid,text,text,bigint,uuid) to service_role,authenticated;

create or replace function public.get_workshop_booking_status(
  p_status_token_digest text
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  b public.workshop_bookings;o public.workshop_occurrences;
  a public.workshop_payment_attempts;
begin
  if char_length(coalesce(p_status_token_digest,''))<43 then
    return jsonb_build_object('state','unavailable');end if;
  select * into b from public.workshop_bookings
    where status_token_digest=p_status_token_digest and status_token_expires_at>now();
  if not found then return jsonb_build_object('state','unavailable');end if;
  select * into o from public.workshop_occurrences
    where workshop_occurrence_id=b.workshop_occurrence_id;
  select * into a from public.workshop_payment_attempts
    where workshop_booking_id=b.workshop_booking_id order by created_at desc limit 1;
  if b.status in('confirmed','checked_in','transferred')
    and b.payment_state in('paid','partially_refunded') then
    return jsonb_build_object('state','confirmed',
      'publicWorkshopPath','/workshops/'||o.slug);end if;
  if b.payment_state='refunded' then return jsonb_build_object('state','refunded');end if;
  if b.status='cancelled' then return jsonb_build_object('state','cancelled');end if;
  if b.status='expired' then return jsonb_build_object('state','expired');end if;
  if b.payment_state in('exception','disputed','reversed')
    or b.status in('payment_disputed','transfer_action_required') then
    return jsonb_build_object('state','action_required');end if;
  if b.payment_state='processing' or a.state='processing' then
    return jsonb_build_object('state','processing',
      'supportReference',b.booking_reference);end if;
  if b.payment_method='direct_venmo' and a.state='active'
    and a.effective_expires_at>now() then
    return jsonb_build_object('state','pending_venmo',
      'supportReference',b.booking_reference,'expiresAt',a.effective_expires_at);end if;
  return jsonb_build_object('state','unavailable');
end;$$;
revoke all on function public.get_workshop_booking_status(text) from public;
grant execute on function public.get_workshop_booking_status(text) to service_role;

create or replace function public.recover_workshop_status_access(
  p_contact_email text,p_support_reference text,p_new_digest text,p_command_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  b public.workshop_bookings;o public.workshop_occurrences;v_deadline timestamptz;
begin
  if char_length(coalesce(p_new_digest,''))<43 then raise exception 'invalid_request';end if;
  select * into b from public.workshop_bookings
    where status_token_rotation_key=p_command_key or(
      lower(contact_email)=lower(btrim(p_contact_email))
      and booking_reference=upper(btrim(p_support_reference)))
    order by(status_token_rotation_key=p_command_key)desc limit 1 for update;
  if not found then return jsonb_build_object('matched',false,'replayed',false);end if;
  if b.status_token_rotation_key=p_command_key then
    return jsonb_build_object('matched',true,'replayed',true,
      'bookingId',b.workshop_booking_id,'expiresAt',b.status_token_expires_at);end if;
  select * into o from public.workshop_occurrences
    where workshop_occurrence_id=b.workshop_occurrence_id;
  if to_regclass('public.workshop_reschedule_responses') is not null then
    execute 'select max(response_token_expires_at) from public.workshop_reschedule_responses where workshop_booking_id=$1 and response=''pending'''
      into v_deadline using b.workshop_booking_id;
  end if;
  if to_regclass('public.workshop_payment_exceptions') is not null then
    execute 'select greatest($2,max(customer_action_deadline)) from public.workshop_payment_exceptions where workshop_booking_id=$1 and state in(''open'',''acknowledged'') and customer_action_deadline is not null'
      into v_deadline using b.workshop_booking_id,v_deadline;
  end if;
  update public.workshop_bookings set status_token_digest=p_new_digest,
    status_token_expires_at=greatest(o.end_at,coalesce(v_deadline,o.end_at))+interval '30 days',
    status_token_rotation_key=p_command_key
    where workshop_booking_id=b.workshop_booking_id returning * into b;
  return jsonb_build_object('matched',true,'replayed',false,
    'bookingId',b.workshop_booking_id,'expiresAt',b.status_token_expires_at);
end;$$;
revoke all on function public.recover_workshop_status_access(text,text,text,uuid) from public;
grant execute on function public.recover_workshop_status_access(text,text,text,uuid)
  to service_role;

create view public.workshop_financial_entries with(security_invoker=true) as
select 'transaction'::text source_type,t.workshop_payment_transaction_id source_id,o.workshop_series_id,
t.workshop_occurrence_id,t.occurred_at entry_date,t.transaction_type entry_category,
case when t.transaction_type in ('refund','reversal') then -abs(t.amount_minor) else t.amount_minor end signed_amount_minor,
t.currency,t.provider method,t.state transaction_state,t.payment_reference traceable_reference
from public.workshop_payment_transactions t join public.workshop_occurrences o using(workshop_occurrence_id)
union all
select 'expense',e.workshop_expense_id,o.workshop_series_id,e.workshop_occurrence_id,e.incurred_on::timestamptz,
e.expense_category,-abs(e.amount_minor),e.currency,'expense','recorded',e.workshop_expense_id::text
from public.workshop_expenses e join public.workshop_occurrences o using(workshop_occurrence_id);
revoke all on public.workshop_financial_entries from anon;
grant select on public.workshop_financial_entries to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('workshop-receipts','workshop-receipts',false,10485760,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "internal users read workshop receipts" on storage.objects for select to authenticated using(bucket_id='workshop-receipts' and public.is_internal_crm_user());
create policy "internal users upload workshop receipts" on storage.objects for insert to authenticated with check(bucket_id='workshop-receipts' and public.is_internal_crm_user());

revoke all on public.workshop_payment_attempts,
  public.workshop_payment_transactions, public.workshop_payment_provider_events,
  public.workshop_payment_exceptions, public.workshop_expenses from anon;
grant select on public.workshop_payment_attempts,
  public.workshop_payment_transactions, public.workshop_payment_provider_events,
  public.workshop_payment_exceptions, public.workshop_expenses to authenticated;
