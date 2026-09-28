create or replace function public.get_crm_calendar_status(p_month date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c public.crm_m365_calendar_connections%rowtype;
  m public.crm_m365_sync_months%rowtype; r public.crm_m365_sync_runs%rowtype;
  v_month_status text:='not_loaded'; v_conflicts integer:=0; v_last_run_status text;
begin
  if not public.is_internal_crm_user() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_month is not null and extract(day from p_month)<>1 then
    raise exception 'invalid_calendar_month' using errcode='22023';
  end if;
  select * into c from public.crm_m365_calendar_connections
    order by case when status in ('connected','action_required') then 0 else 1 end,
      connected_at desc nulls last limit 1;
  if c.connection_id is not null then
    select * into r from public.crm_m365_sync_runs where connection_id=c.connection_id
      order by requested_at desc limit 1;
    v_last_run_status:=r.status;
    select count(*) into v_conflicts from public.crm_m365_sync_conflicts f
      join public.crm_m365_event_associations a on a.association_id=f.association_id
      where a.connection_id=c.connection_id and f.status in ('open','restoring');
    if p_month is not null then
      select * into m from public.crm_m365_sync_months
        where connection_id=c.connection_id and month_start=p_month;
      if c.status <> 'connected' then v_month_status:='stale';
      elsif m.connection_id is null then v_month_status:='not_loaded';
      else
        select * into r from public.crm_m365_sync_runs
          where connection_id=c.connection_id and trigger='range_request' and requested_month=p_month
          order by requested_at desc limit 1;
        if r.status in ('queued','running') and r.requested_at < now()-interval '2 minutes' then
          v_month_status:='delayed';
        elsif r.status in ('queued','running') then v_month_status:='loading';
        elsif r.status='failed' and r.requested_at>=coalesce(m.last_successful_scan_at,'-infinity'::timestamptz) then
          v_month_status:='failed';
        elsif m.last_successful_scan_at>=now()-interval '15 minutes'
          and m.last_error_code is null then v_month_status:='current';
        else v_month_status:='stale'; end if;
      end if;
    end if;
  end if;
  return jsonb_build_object(
    'connectionStatus',coalesce(c.status,'disconnected'),
    'calendarDisplayName',c.calendar_name,
    'lastSuccessfulSyncAt',c.last_successful_sync_at,
    'lastRunStatus',v_last_run_status,
    'lastErrorCode',case when c.last_error_code in
      ('graph_unavailable','graph_throttled','authorization_lost','scan_failed','export_failed')
      then c.last_error_code when c.last_error_code is not null then 'sync_unavailable' else null end,
    'openConflictCount',v_conflicts,
    'staleMirrorWarning',coalesce(c.status='disconnected' and exists(
      select 1 from public.crm_m365_event_associations a where a.connection_id=c.connection_id),false),
    'requestedMonth',p_month,'monthImportStatus',v_month_status,
    'monthLastSuccessfulScanAt',m.last_successful_scan_at);
end;
$$;
revoke all on function public.get_crm_calendar_status(date) from public, anon, authenticated;
grant execute on function public.get_crm_calendar_status(date) to authenticated;
