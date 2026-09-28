create or replace function public.queue_crm_calendar_month(p_month date,p_requested_by uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.crm_m365_calendar_connections%rowtype; m public.crm_m365_sync_months%rowtype;
  v_run uuid; v_count integer; v_retry timestamptz; v_now timestamptz:=now();
begin
  if p_month is null or extract(day from p_month)<>1 or p_requested_by is null then
    raise exception 'invalid_calendar_month' using errcode='22023';
  end if;
  if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id
    where p.id=p_requested_by and p.is_active and r.role in ('admin','staff')) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select * into c from public.crm_m365_calendar_connections
    where status in ('connected','action_required') order by connected_at desc limit 1 for update;
  if c.connection_id is null or c.status <> 'connected' then
    return jsonb_build_object('status','disconnected');
  end if;
  select * into m from public.crm_m365_sync_months
    where connection_id=c.connection_id and month_start=p_month;
  if m.last_successful_scan_at >= v_now-interval '15 minutes'
    and m.last_error_code is null then
    update public.crm_m365_sync_months set last_requested_at=v_now
      where connection_id=c.connection_id and month_start=p_month;
    return jsonb_build_object('status','current');
  end if;
  select run_id into v_run from public.crm_m365_sync_runs
    where connection_id=c.connection_id and trigger='range_request'
      and requested_month=p_month and status in ('queued','running')
    order by requested_at desc limit 1;
  if v_run is not null then
    update public.crm_m365_sync_months set last_requested_at=v_now
      where connection_id=c.connection_id and month_start=p_month;
    return jsonb_build_object('status','queued','runId',v_run,'coalesced',true);
  end if;
  if not exists(select 1 from public.crm_m365_sync_runs
    where requested_by=p_requested_by and trigger='range_request' and requested_month=p_month
      and requested_at>v_now-interval '1 hour') then
    select count(distinct requested_month), min(requested_at)+interval '1 hour'
      into v_count,v_retry from public.crm_m365_sync_runs
      where requested_by=p_requested_by and trigger='range_request'
        and requested_at>v_now-interval '1 hour';
    if v_count>=24 then
      return jsonb_build_object('status','rate_limited','retryAt',v_retry);
    end if;
  end if;
  select count(*) into v_count from public.crm_m365_sync_runs
    where connection_id=c.connection_id and trigger='range_request'
      and status in ('queued','running');
  if v_count>=3 then
    return jsonb_build_object('status','rate_limited','retryAt',v_now+interval '2 minutes');
  end if;
  insert into public.crm_m365_sync_months(connection_id,month_start,strategy,last_requested_at)
    values(c.connection_id,p_month,case when c.is_primary then 'primary_delta' else 'full_reconcile' end,v_now)
    on conflict(connection_id,month_start) do update set last_requested_at=excluded.last_requested_at;
  insert into public.crm_m365_sync_runs(connection_id,trigger,requested_month,requested_by)
    values(c.connection_id,'range_request',p_month,p_requested_by) returning run_id into v_run;
  return jsonb_build_object('status','queued','runId',v_run,'coalesced',false);
end;
$$;
revoke all on function public.queue_crm_calendar_month(date,uuid) from public, anon, authenticated;
grant execute on function public.queue_crm_calendar_month(date,uuid) to service_role;
