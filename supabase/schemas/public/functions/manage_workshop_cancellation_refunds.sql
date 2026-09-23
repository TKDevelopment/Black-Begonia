create or replace function public.claim_workshop_cancellation_refunds(
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

create or replace function public.resolve_workshop_cancellation_refund_job(
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
