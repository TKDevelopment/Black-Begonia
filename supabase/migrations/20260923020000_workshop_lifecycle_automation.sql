-- Add occurrence lifecycle automation, durable cancellation refunds, customer
-- notifications, dated-route redirects, and retire active workshop Venmo APIs.

begin;

alter table public.workshop_message_queue
  add column if not exists message_context jsonb not null default '{}'::jsonb;

alter table public.workshop_message_queue
  drop constraint if exists workshop_message_queue_communication_type_check;
alter table public.workshop_message_queue
  add constraint workshop_message_queue_communication_type_check
  check (communication_type in (
    'booking_confirmation','replacement_status_access','waitlist_offer',
    'current_address_privacy_verification','proposed_email_confirmation',
    'cancellation_notice','reschedule_prompt','refund_notice',
    'reschedule_confirmation','refund_confirmation','workshop_thank_you'
  ));

create table public.workshop_cancellation_refund_jobs (
  workshop_cancellation_refund_job_id uuid primary key default gen_random_uuid(),
  workshop_refund_request_id uuid not null unique
    references public.workshop_refund_requests(workshop_refund_request_id) on delete restrict,
  workshop_occurrence_id uuid not null
    references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  state text not null default 'queued'
    check (state in ('queued','claimed','provider_accepted','failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz null,
  claimed_by text null,
  last_error_category text null,
  command_key uuid not null unique,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint workshop_cancellation_refund_job_resolution check (
    (state in ('queued','claimed') and resolved_at is null)
    or (state in ('provider_accepted','failed') and resolved_at is not null)
  )
);
create index idx_workshop_cancellation_refund_jobs_claim
  on public.workshop_cancellation_refund_jobs(state,next_attempt_at,created_at)
  where state='queued';
alter table public.workshop_cancellation_refund_jobs enable row level security;
create policy workshop_cancellation_refund_jobs_internal_select
  on public.workshop_cancellation_refund_jobs for select to authenticated
  using(public.is_internal_crm_user());
revoke all on public.workshop_cancellation_refund_jobs from anon;
grant select on public.workshop_cancellation_refund_jobs to authenticated;

create table public.workshop_occurrence_route_aliases (
  workshop_occurrence_route_alias_id uuid primary key default gen_random_uuid(),
  workshop_occurrence_id uuid not null
    references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  series_slug text not null,
  workshop_date date not null,
  created_at timestamptz not null default now(),
  unique(series_slug,workshop_date)
);
create index idx_workshop_occurrence_route_aliases_occurrence
  on public.workshop_occurrence_route_aliases(workshop_occurrence_id);
alter table public.workshop_occurrence_route_aliases enable row level security;
create policy workshop_occurrence_route_aliases_internal_select
  on public.workshop_occurrence_route_aliases for select to authenticated
  using(public.is_internal_crm_user());
revoke all on public.workshop_occurrence_route_aliases from anon;
grant select on public.workshop_occurrence_route_aliases to authenticated;

drop function if exists public.record_workshop_venmo_receipt(
  text,text,bigint,text,timestamptz,uuid
);

drop function public.switch_workshop_payment_method(
  text,text,uuid,text,integer,integer
);
create function public.switch_workshop_payment_method(
  p_status_token_digest text,
  p_method text,
  p_command_key uuid,
  p_stripe_hold_minutes integer default 15
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_method <> 'stripe' or p_stripe_hold_minutes not between 1 and 30 then
    raise exception 'invalid_request';
  end if;
  return public.switch_workshop_payment_method_before_stripe_only(
    p_status_token_digest,'stripe',p_command_key,null,p_stripe_hold_minutes,24
  ) - 'approvedTarget';
end;
$$;
revoke all on function public.switch_workshop_payment_method(
  text,text,uuid,integer
) from public;
grant execute on function public.switch_workshop_payment_method(
  text,text,uuid,integer
) to service_role;

alter function public.manage_workshop_financials(text,jsonb,uuid)
  rename to manage_workshop_financials_before_workshop_venmo_retirement;
revoke all on function public.manage_workshop_financials_before_workshop_venmo_retirement(
  text,jsonb,uuid
) from public, anon, authenticated, service_role;
create function public.manage_workshop_financials(
  p_action text,p_payload jsonb,p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_action = 'record_external_refund' then
    raise exception 'unsupported action' using errcode = '22023';
  end if;
  return public.manage_workshop_financials_before_workshop_venmo_retirement(
    p_action,p_payload,p_command_key
  );
end;
$$;
revoke all on function public.manage_workshop_financials(text,jsonb,uuid)
  from public, anon;
grant execute on function public.manage_workshop_financials(text,jsonb,uuid)
  to authenticated, service_role;

alter function public.manage_workshop_refund_order(text,jsonb,uuid)
  rename to manage_workshop_refund_order_before_workshop_venmo_retirement;
revoke all on function public.manage_workshop_refund_order_before_workshop_venmo_retirement(
  text,jsonb,uuid
) from public, anon, authenticated, service_role;
create function public.manage_workshop_refund_order(
  p_action text,p_payload jsonb,p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider text;
begin
  if p_action not in ('eligibility','request_stripe') then
    raise exception 'unsupported action' using errcode = '22023';
  end if;
  select provider into v_provider
  from public.workshop_payment_transactions
  where workshop_payment_transaction_id=nullif(p_payload->>'transactionId','')::uuid;
  if v_provider is distinct from 'stripe' then
    raise exception 'refund_not_eligible' using errcode = 'P0001';
  end if;
  return public.manage_workshop_refund_order_before_workshop_venmo_retirement(
    p_action,p_payload,p_command_key
  );
end;
$$;
revoke all on function public.manage_workshop_refund_order(text,jsonb,uuid)
  from public, anon;
grant execute on function public.manage_workshop_refund_order(text,jsonb,uuid)
  to authenticated;

create function public.reschedule_workshop_occurrence_schedule(
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

create function public.complete_and_archive_workshop_occurrence(
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
    set message_context=jsonb_build_object('recommendations',v_recommendations)
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

create function public.claim_workshop_cancellation_refunds(
  p_worker text,
  p_limit integer default 25
) returns table(
  job_id uuid,
  refund_request_id uuid,
  command_key uuid,
  provider_charge_id text,
  amount_minor bigint,
  currency text,
  request_state text,
  attempt_count integer
)
language plpgsql
security definer
set search_path=''
as $$
begin
  if coalesce(auth.role(),'')<>'service_role' and session_user<>'postgres' then
    raise exception 'not authorized' using errcode='42501';
  end if;
  if char_length(btrim(coalesce(p_worker,''))) not between 1 and 120
    or p_limit not between 1 and 100
  then
    raise exception 'invalid claim' using errcode='22023';
  end if;

  update public.workshop_cancellation_refund_jobs
  set state='queued',claimed_at=null,claimed_by=null,next_attempt_at=now(),
      last_error_category='stale_claim_recovered'
  where state='claimed' and claimed_at<=now()-interval '10 minutes'
    and attempt_count<5;
  update public.workshop_cancellation_refund_jobs
  set state='failed',resolved_at=now(),claimed_at=null,claimed_by=null,
      last_error_category='attempts_exhausted'
  where state='claimed' and claimed_at<=now()-interval '10 minutes'
    and attempt_count>=5;

  return query
  with claimed as(
    select j.workshop_cancellation_refund_job_id
    from public.workshop_cancellation_refund_jobs j
    where j.state='queued' and j.next_attempt_at<=now()
    order by j.created_at,j.workshop_cancellation_refund_job_id
    limit p_limit for update skip locked
  ), updated as(
    update public.workshop_cancellation_refund_jobs j
    set state='claimed',claimed_at=now(),claimed_by=btrim(p_worker),
        attempt_count=j.attempt_count+1
    from claimed c
    where j.workshop_cancellation_refund_job_id=
      c.workshop_cancellation_refund_job_id
    returning j.*
  )
  select u.workshop_cancellation_refund_job_id,
    r.workshop_refund_request_id,u.command_key,
    t.provider_transaction_id,r.amount_minor,r.currency,r.state,u.attempt_count
  from updated u
  join public.workshop_refund_requests r
    on r.workshop_refund_request_id=u.workshop_refund_request_id
  join public.workshop_payment_transactions t
    on t.workshop_payment_transaction_id=r.workshop_payment_transaction_id;
end;
$$;

create function public.resolve_workshop_cancellation_refund_job(
  p_job_id uuid,
  p_worker text,
  p_outcome text,
  p_error_category text default null,
  p_retry_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_job public.workshop_cancellation_refund_jobs;
begin
  if coalesce(auth.role(),'')<>'service_role' and session_user<>'postgres' then
    raise exception 'not authorized' using errcode='42501';
  end if;
  select * into v_job
  from public.workshop_cancellation_refund_jobs
  where workshop_cancellation_refund_job_id=p_job_id
  for update;
  if not found then raise exception 'job not found' using errcode='P0002'; end if;
  if v_job.state in('provider_accepted','failed') then
    return jsonb_build_object('replayed',true,'state',v_job.state);
  end if;
  if v_job.state<>'claimed' or v_job.claimed_by<>btrim(p_worker) then
    raise exception 'claim unavailable' using errcode='P0001';
  end if;

  if p_outcome='provider_accepted' then
    update public.workshop_cancellation_refund_jobs
    set state='provider_accepted',resolved_at=now(),claimed_at=null,
        claimed_by=null,last_error_category=null
    where workshop_cancellation_refund_job_id=p_job_id returning * into v_job;
  elsif p_outcome='retry' and v_job.attempt_count<5 then
    update public.workshop_cancellation_refund_jobs
    set state='queued',next_attempt_at=greatest(
          coalesce(p_retry_at,now()+interval '5 minutes'),now()
        ),claimed_at=null,claimed_by=null,
        last_error_category=left(coalesce(p_error_category,'provider_retryable'),160)
    where workshop_cancellation_refund_job_id=p_job_id returning * into v_job;
  elsif p_outcome in('retry','failed') then
    update public.workshop_cancellation_refund_jobs
    set state='failed',resolved_at=now(),claimed_at=null,claimed_by=null,
        last_error_category=left(coalesce(p_error_category,'provider_failed'),160)
    where workshop_cancellation_refund_job_id=p_job_id returning * into v_job;
  else
    raise exception 'invalid outcome' using errcode='22023';
  end if;

  return jsonb_build_object('replayed',false,'state',v_job.state,
    'attemptCount',v_job.attempt_count);
end;
$$;
revoke all on function public.claim_workshop_cancellation_refunds(text,integer)
  from public,anon,authenticated;
revoke all on function public.resolve_workshop_cancellation_refund_job(
  uuid,text,text,text,timestamptz
) from public,anon,authenticated;
grant execute on function public.claim_workshop_cancellation_refunds(text,integer)
  to service_role;
grant execute on function public.resolve_workshop_cancellation_refund_job(
  uuid,text,text,text,timestamptz
) to service_role;

create function public.enqueue_workshop_cancellation_refund_processor(
  p_batch_limit integer default 25
) returns bigint
language plpgsql
security definer
set search_path=''
as $$
declare
  v_project_url text;
  v_cron_secret text;
  v_request_id bigint;
begin
  if p_batch_limit not between 1 and 100 then
    raise exception 'Workshop refund processor batch limit must be between 1 and 100';
  end if;
  select nullif(btrim(decrypted_secret),'') into v_project_url
  from vault.decrypted_secrets where name='project_url' limit 1;
  select nullif(btrim(decrypted_secret),'') into v_cron_secret
  from vault.decrypted_secrets where name='workshop_message_cron_secret' limit 1;
  if v_project_url is null
    or v_project_url !~ '^https://[a-z0-9-]+\.supabase\.co$'
    or v_cron_secret is null or length(v_cron_secret)<32
  then
    raise exception 'Workshop refund processor configuration is unavailable';
  end if;
  select net.http_post(
    url:=regexp_replace(v_project_url,'/+$','')
      ||'/functions/v1/process-workshop-cancellation-refunds',
    headers:=jsonb_build_object(
      'Content-Type','application/json','x-cron-secret',v_cron_secret
    ),
    body:=jsonb_build_object('batchLimit',p_batch_limit),
    timeout_milliseconds:=10000
  ) into v_request_id;
  return v_request_id;
end;
$$;
revoke all on function public.enqueue_workshop_cancellation_refund_processor(integer)
  from public,anon,authenticated;
grant execute on function public.enqueue_workshop_cancellation_refund_processor(integer)
  to service_role;

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
  v_refund_request_count integer:=0;
  v_race_review_count integer:=0;
  v_waitlist_count integer:=0;
  v_booking record;
  v_refund record;
  v_refund_result jsonb;
  v_refund_command uuid;
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

  for v_refund in
    select t.*,
      greatest(t.amount_minor-coalesce((
        select sum(r.amount_minor)
        from public.workshop_refund_requests r
        where r.workshop_payment_transaction_id=
          t.workshop_payment_transaction_id
          and r.state in('requested','provider_accepted','reconciled')
      ),0),0) as remaining_minor
    from public.workshop_payment_transactions t
    join public.workshop_bookings b
      on b.workshop_booking_id=t.workshop_booking_id
    where b.workshop_occurrence_id=p_occurrence_id
      and b.status in('confirmed','checked_in')
      and b.active_quantity>0
      and t.transaction_type='charge'
      and t.provider='stripe'
      and t.state in('paid','partially_refunded')
    order by t.workshop_payment_transaction_id
    for update of t
  loop
    if v_refund.remaining_minor>0 then
      v_refund_command:=gen_random_uuid();
      v_refund_result:=public.manage_workshop_financials(
        'request_refund',
        jsonb_build_object(
          'transactionId',v_refund.workshop_payment_transaction_id,
          'amountMinor',v_refund.remaining_minor,
          'currency',v_refund.currency,
          'reason','event_cancelled'
        ),
        v_refund_command
      );
      insert into public.workshop_cancellation_refund_jobs(
        workshop_refund_request_id,workshop_occurrence_id,command_key
      ) values(
        (v_refund_result->>'requestId')::uuid,p_occurrence_id,v_refund_command
      ) on conflict(workshop_refund_request_id) do nothing;
      v_refund_request_count:=v_refund_request_count+1;
    end if;
  end loop;

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
      'refundRequestsQueued',v_refund_request_count,
      'raceReviews',v_race_review_count,
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

create or replace function public.reconcile_workshop_refund_request(
  p_refund_request_id uuid,
  p_provider_refund_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.workshop_refund_requests;
  v_charge public.workshop_payment_transactions;
  v_refund public.workshop_payment_transactions;
  v_consumed bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user <> 'postgres' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_refund_request_id is null
    or btrim(coalesce(p_provider_refund_id, '')) = ''
  then
    raise exception 'invalid_request';
  end if;

  select * into v_request from public.workshop_refund_requests
  where workshop_refund_request_id = p_refund_request_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_request.provider_refund_id is not null
    and v_request.provider_refund_id <> btrim(p_provider_refund_id)
  then
    raise exception 'provider_reference_mismatch';
  end if;
  if v_request.state = 'reconciled' then
    perform public.queue_workshop_communication(
      'refund_confirmation','booking_contact','v1',
      v_request.workshop_booking_id,null,null,null,true,null,
      v_request.workshop_refund_request_id
    );
    update public.workshop_message_queue
    set message_context=jsonb_build_object(
      'amountMinor',v_request.amount_minor,'currency',v_request.currency
    )
    where command_key=v_request.workshop_refund_request_id;
    return jsonb_build_object(
      'replayed', true, 'requestId', p_refund_request_id,
      'state', v_request.state
    );
  end if;
  if v_request.state not in ('requested', 'provider_accepted') then
    raise exception 'invalid_transition';
  end if;

  select * into v_charge from public.workshop_payment_transactions
  where workshop_payment_transaction_id =
    v_request.workshop_payment_transaction_id;
  select * into v_refund from public.workshop_payment_transactions
  where provider = 'stripe' and transaction_type = 'refund'
    and state = 'refunded'
    and provider_transaction_id = btrim(p_provider_refund_id)
    and normalized_facts->>'originalTransactionId' =
      v_charge.workshop_payment_transaction_id::text;
  if not found or v_refund.amount_minor <> v_request.amount_minor then
    raise exception 'refund_evidence_not_found';
  end if;

  update public.workshop_refund_requests set
    state = 'reconciled',
    provider_refund_id = coalesce(
      provider_refund_id, btrim(p_provider_refund_id)
    ),
    reconciled_at = coalesce(reconciled_at, now())
  where workshop_refund_request_id = p_refund_request_id
  returning * into v_request;

  select coalesce(sum(amount_minor), 0) into v_consumed
  from public.workshop_payment_transactions
  where transaction_type in ('refund', 'external_refund')
    and state = 'refunded'
    and normalized_facts->>'originalTransactionId' =
      v_charge.workshop_payment_transaction_id::text;
  update public.workshop_bookings set payment_state = case
    when v_consumed >= v_charge.amount_minor then 'refunded'
    else 'partially_refunded'
  end
  where workshop_booking_id = v_charge.workshop_booking_id;

  perform public.queue_workshop_communication(
    'refund_confirmation','booking_contact','v1',
    v_request.workshop_booking_id,null,null,null,true,null,
    v_request.workshop_refund_request_id
  );
  update public.workshop_message_queue
  set message_context=jsonb_build_object(
    'amountMinor',v_request.amount_minor,'currency',v_request.currency
  )
  where command_key=v_request.workshop_refund_request_id;

  return jsonb_build_object(
    'replayed', false, 'requestId', p_refund_request_id,
    'state', v_request.state
  );
end;
$$;
revoke all on function public.reconcile_workshop_refund_request(uuid,text)
  from public, anon, authenticated;
grant execute on function public.reconcile_workshop_refund_request(uuid,text)
  to service_role;

create or replace function public.get_public_workshop_occurrence_route(
  p_series_slug text,
  p_workshop_date text
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_occurrence public.workshop_occurrences;
  v_result jsonb;
  v_current_url text;
begin
  select o.* into v_occurrence
  from public.workshop_occurrences o
  where public.workshop_public_series_slug(o.title_snapshot)=p_series_slug
    and o.local_start::date::text=p_workshop_date
    and o.status in(
      'published_open','registration_closed','cancelled','rescheduled','completed'
    )
  order by o.start_at,o.workshop_occurrence_id
  limit 1;

  if found then
    return public.get_public_workshop_occurrence(v_occurrence.slug)
      ||jsonb_build_object(
        'seriesSlug',public.workshop_public_series_slug(
          v_occurrence.title_snapshot
        ),
        'workshopDate',v_occurrence.local_start::date::text,
        'replacementUrl',case when v_occurrence.replacement_occurrence_id is not null
          then (select '/workshops/'
            ||public.workshop_public_series_slug(r.title_snapshot)||'/'
            ||r.local_start::date::text
            from public.workshop_occurrences r
            where r.workshop_occurrence_id=
              v_occurrence.replacement_occurrence_id)
          else null end
      );
  end if;

  select o.* into v_occurrence
  from public.workshop_occurrence_route_aliases a
  join public.workshop_occurrences o using(workshop_occurrence_id)
  where a.series_slug=p_series_slug
    and a.workshop_date::text=p_workshop_date
    and o.status in('published_open','registration_closed')
  order by a.created_at desc
  limit 1;
  if not found then return null; end if;

  v_current_url:='/workshops/'
    ||public.workshop_public_series_slug(v_occurrence.title_snapshot)||'/'
    ||v_occurrence.local_start::date::text;
  v_result:=public.get_public_workshop_occurrence(v_occurrence.slug);
  return v_result||jsonb_build_object(
    'seriesSlug',public.workshop_public_series_slug(v_occurrence.title_snapshot),
    'workshopDate',v_occurrence.local_start::date::text,
    'seoStatus','redirect',
    'redirectUrl',v_current_url
  );
end;
$$;
revoke all on function public.get_public_workshop_occurrence_route(text,text)
  from public;
grant execute on function public.get_public_workshop_occurrence_route(text,text)
  to anon,authenticated;

create or replace function public.get_workshop_booking_status(
  p_status_token_digest text
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_booking public.workshop_bookings;
  v_occurrence public.workshop_occurrences;
  v_attempt public.workshop_payment_attempts;
  v_response public.workshop_reschedule_responses;
  v_source public.workshop_occurrences;
  v_replacement public.workshop_occurrences;
begin
  if char_length(coalesce(p_status_token_digest, '')) < 43 then
    return jsonb_build_object('state', 'unavailable');
  end if;

  select * into v_booking
  from public.workshop_bookings
  where status_token_digest = p_status_token_digest
    and status_token_expires_at > now();
  if not found then
    return jsonb_build_object('state', 'unavailable');
  end if;

  select * into v_occurrence
  from public.workshop_occurrences
  where workshop_occurrence_id = v_booking.workshop_occurrence_id;
  select * into v_attempt
  from public.workshop_payment_attempts
  where workshop_booking_id = v_booking.workshop_booking_id
  order by created_at desc limit 1;

  if v_booking.status in ('confirmed', 'checked_in', 'transferred')
    and v_booking.payment_state in ('paid', 'partially_refunded')
  then
    return jsonb_build_object(
      'state', 'confirmed',
      'publicWorkshopPath', '/workshops/'
        || public.workshop_public_series_slug(v_occurrence.title_snapshot)
        || '/' || v_occurrence.local_start::date::text,
      'workshopTitle', v_occurrence.title_snapshot,
      'startAt', v_occurrence.start_at,
      'endAt', v_occurrence.end_at,
      'timezone', v_occurrence.timezone,
      'venueName', v_occurrence.venue_name,
      'addressLine1', v_occurrence.address_line_1,
      'addressLine2', v_occurrence.address_line_2,
      'locality', v_occurrence.locality,
      'region', v_occurrence.region,
      'postalCode', v_occurrence.postal_code,
      'activeQuantity', v_booking.active_quantity,
      'termsSnapshot', v_booking.terms_snapshot
    );
  end if;
  if v_booking.payment_state = 'refunded' then
    return jsonb_build_object('state', 'refunded');
  end if;
  if v_booking.status = 'cancelled' then
    return jsonb_build_object('state', 'cancelled');
  end if;
  if v_booking.status = 'expired' then
    return jsonb_build_object('state', 'expired');
  end if;

  if v_booking.status = 'transfer_action_required' then
    select * into v_response from public.workshop_reschedule_responses
    where workshop_booking_id=v_booking.workshop_booking_id
      and response in('pending','expired')
    order by created_at desc limit 1;
    if found then
      select * into v_source from public.workshop_occurrences
      where workshop_occurrence_id=v_response.source_occurrence_id;
      select * into v_replacement from public.workshop_occurrences
      where workshop_occurrence_id=v_response.replacement_occurrence_id;
      return jsonb_build_object(
        'state','action_required','action','reschedule',
        'responseState',v_response.response,
        'responseDeadline',v_response.response_token_expires_at,
        'sourceTitle',v_source.title_snapshot,
        'sourceStartAt',v_source.start_at,
        'replacementTitle',v_replacement.title_snapshot,
        'replacementStartAt',v_replacement.start_at,
        'replacementVenue',v_replacement.venue_name,
        'protectedQuantity',v_response.protected_quantity
      );
    end if;
  end if;

  if v_booking.payment_state in ('exception', 'disputed', 'reversed')
    or v_booking.status in ('payment_disputed', 'transfer_action_required')
  then
    return jsonb_build_object('state', 'action_required');
  end if;
  if v_booking.payment_state = 'processing' or v_attempt.state = 'processing' then
    return jsonb_build_object(
      'state', 'processing',
      'supportReference', v_booking.booking_reference
    );
  end if;
  return jsonb_build_object('state', 'unavailable');
end;
$$;
revoke all on function public.get_workshop_booking_status(text) from public;
grant execute on function public.get_workshop_booking_status(text) to service_role;

alter function public.get_public_workshop_occurrence(text)
  rename to get_public_workshop_occurrence_before_workshop_venmo_retirement;
revoke all on function public.get_public_workshop_occurrence_before_workshop_venmo_retirement(text)
  from public, anon, authenticated;
create function public.get_public_workshop_occurrence(p_occurrence_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_public_workshop_occurrence_before_workshop_venmo_retirement(
    p_occurrence_slug
  ) - 'venmoEnabled';
$$;
revoke all on function public.get_public_workshop_occurrence(text) from public;
grant execute on function public.get_public_workshop_occurrence(text)
  to anon,authenticated;

-- Rebind the route lookup to the Venmo-free public occurrence wrapper after
-- the original function was renamed above.
create or replace function public.get_public_workshop_occurrence_route(
  p_series_slug text,
  p_workshop_date text
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_occurrence public.workshop_occurrences;
  v_result jsonb;
  v_current_url text;
begin
  select o.* into v_occurrence
  from public.workshop_occurrences o
  where public.workshop_public_series_slug(o.title_snapshot)=p_series_slug
    and o.local_start::date::text=p_workshop_date
    and o.status in(
      'published_open','registration_closed','cancelled','rescheduled','completed'
    )
  order by o.start_at,o.workshop_occurrence_id
  limit 1;
  if found then
    return public.get_public_workshop_occurrence(v_occurrence.slug)
      ||jsonb_build_object(
        'seriesSlug',public.workshop_public_series_slug(v_occurrence.title_snapshot),
        'workshopDate',v_occurrence.local_start::date::text,
        'replacementUrl',case when v_occurrence.replacement_occurrence_id is not null
          then (select '/workshops/'
            ||public.workshop_public_series_slug(r.title_snapshot)||'/'
            ||r.local_start::date::text
            from public.workshop_occurrences r
            where r.workshop_occurrence_id=v_occurrence.replacement_occurrence_id)
          else null end
      );
  end if;
  select o.* into v_occurrence
  from public.workshop_occurrence_route_aliases a
  join public.workshop_occurrences o using(workshop_occurrence_id)
  where a.series_slug=p_series_slug
    and a.workshop_date::text=p_workshop_date
    and o.status in('published_open','registration_closed')
  order by a.created_at desc limit 1;
  if not found then return null; end if;
  v_current_url:='/workshops/'
    ||public.workshop_public_series_slug(v_occurrence.title_snapshot)||'/'
    ||v_occurrence.local_start::date::text;
  v_result:=public.get_public_workshop_occurrence(v_occurrence.slug);
  return v_result||jsonb_build_object(
    'seriesSlug',public.workshop_public_series_slug(v_occurrence.title_snapshot),
    'workshopDate',v_occurrence.local_start::date::text,
    'seoStatus','redirect','redirectUrl',v_current_url
  );
end;
$$;

create or replace function public.install_workshop_scheduled_jobs()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id bigint;
  v_hold_job_id bigint;
  v_message_job_id bigint;
  v_refund_job_id bigint;
begin
  if to_regclass('cron.job') is null or to_regnamespace('net') is null then
    raise exception 'Workshop schedules require the pg_cron and pg_net extensions';
  end if;
  if to_regclass('vault.decrypted_secrets') is null then
    raise exception 'Workshop schedules require Supabase Vault';
  end if;
  if not exists (
    select 1 from vault.decrypted_secrets
    where name='project_url' and nullif(btrim(decrypted_secret),'') is not null
  ) then
    raise exception 'Workshop schedules require the project_url Vault secret';
  end if;
  if not exists (
    select 1 from vault.decrypted_secrets
    where name='workshop_scheduler_secret'
      and length(nullif(btrim(decrypted_secret),''))>=32
  ) then
    raise exception 'Workshop schedules require the workshop_scheduler_secret Vault secret';
  end if;
  if not exists (
    select 1 from vault.decrypted_secrets
    where name='workshop_message_cron_secret'
      and length(nullif(btrim(decrypted_secret),''))>=32
  ) then
    raise exception 'Workshop schedules require the workshop_message_cron_secret Vault secret';
  end if;

  for v_job_id in
    select jobid from cron.job
    where jobname in(
      'expire-workshop-holds-1m',
      'process-workshop-messages-1m',
      'process-workshop-cancellation-refunds-1m'
    )
  loop
    perform cron.unschedule(v_job_id);
  end loop;
  v_hold_job_id:=cron.schedule(
    'expire-workshop-holds-1m','* * * * *',
    'select public.enqueue_workshop_hold_expiration();'
  );
  v_message_job_id:=cron.schedule(
    'process-workshop-messages-1m','* * * * *',
    'select public.enqueue_workshop_message_processor(25);'
  );
  v_refund_job_id:=cron.schedule(
    'process-workshop-cancellation-refunds-1m','* * * * *',
    'select public.enqueue_workshop_cancellation_refund_processor(25);'
  );
  return jsonb_build_object(
    'expireWorkshopHoldsJobId',v_hold_job_id,
    'processWorkshopMessagesJobId',v_message_job_id,
    'processWorkshopCancellationRefundsJobId',v_refund_job_id
  );
end;
$$;
revoke all on function public.install_workshop_scheduled_jobs()
  from public,anon,authenticated;
grant execute on function public.install_workshop_scheduled_jobs()
  to service_role;

do $$
begin
  if to_regclass('cron.job') is null
    or to_regnamespace('net') is null
    or to_regclass('vault.decrypted_secrets') is null
    or not exists(
      select 1 from vault.decrypted_secrets
      where name='project_url' and nullif(btrim(decrypted_secret),'') is not null
    )
    or not exists(
      select 1 from vault.decrypted_secrets
      where name='workshop_scheduler_secret'
        and length(nullif(btrim(decrypted_secret),''))>=32
    )
    or not exists(
      select 1 from vault.decrypted_secrets
      where name='workshop_message_cron_secret'
        and length(nullif(btrim(decrypted_secret),''))>=32
    )
  then
    raise warning 'Workshop Cron jobs not installed: configure required Vault secrets, then call public.install_workshop_scheduled_jobs()';
    return;
  end if;
  perform public.install_workshop_scheduled_jobs();
end;
$$;

commit;

-- Rollback: restore the previous lifecycle functions and remove the two new
-- queue/alias tables after draining any outstanding refund and email work.
