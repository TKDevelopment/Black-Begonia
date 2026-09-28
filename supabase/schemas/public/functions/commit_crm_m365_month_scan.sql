create or replace function public.commit_crm_m365_month_scan(
  p_run uuid,p_owner uuid,p_month date,p_mode text,p_changes jsonb,p_delta_link text default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare c public.crm_m365_calendar_connections%rowtype;
  v_scan uuid:=gen_random_uuid(); v_row jsonb; v_count integer:=0;
begin
  if p_month is null or extract(day from p_month)<>1 or p_mode not in ('full','delta')
    or jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes)>1000
    or (p_delta_link is not null and p_delta_link !~ '^https://graph\.microsoft\.com/v1\.0/') then
    raise exception 'invalid_calendar_scan' using errcode='22023';
  end if;
  select c.* into c from public.crm_m365_sync_runs r
    join public.crm_m365_calendar_connections c on c.connection_id=r.connection_id
    where r.run_id=p_run and r.status='running' and c.lease_owner=p_owner
      and c.status='connected' for update of c;
  if c.connection_id is null then raise exception 'calendar_scan_lease_lost' using errcode='55000'; end if;
  for v_row in select value from jsonb_array_elements(p_changes) loop
    if nullif(v_row->>'id','') is null or length(v_row->>'id')>512 then
      raise exception 'invalid_calendar_occurrence' using errcode='22023';
    end if;
    if coalesce((v_row->>'deleted')::boolean,false) then
      delete from public.crm_m365_imported_occurrences
        where connection_id=c.connection_id and graph_occurrence_id=v_row->>'id';
      continue;
    end if;
    if exists(select 1 from public.crm_m365_event_associations a
      where a.connection_id=c.connection_id and a.graph_event_id=v_row->>'id') then
      delete from public.crm_m365_imported_occurrences
        where connection_id=c.connection_id and graph_occurrence_id=v_row->>'id';
      continue;
    end if;
    insert into public.crm_m365_imported_occurrences(
      connection_id,graph_occurrence_id,series_master_id,start_at,end_at,
      local_start_date,local_end_date,is_all_day,display_title,location,
      outlook_web_url,is_private,provider_status,last_seen_scan_id)
    values(c.connection_id,v_row->>'id',nullif(v_row->>'seriesMasterId',''),
      (v_row->>'startAt')::timestamptz,(v_row->>'endAt')::timestamptz,
      (v_row->>'localStartDate')::date,(v_row->>'localEndDate')::date,
      (v_row->>'isAllDay')::boolean,
      case when (v_row->>'isPrivate')::boolean then 'Private event'
        else left(coalesce(nullif(btrim(v_row->>'title'),''),'Untitled event'),240) end,
      case when (v_row->>'isPrivate')::boolean then null else nullif(v_row->>'location','') end,
      nullif(v_row->>'outlookWebUrl',''),(v_row->>'isPrivate')::boolean,
      case when (v_row->>'isCanceled')::boolean then 'canceled' else 'active' end,v_scan)
    on conflict(connection_id,graph_occurrence_id) do update set
      series_master_id=excluded.series_master_id,start_at=excluded.start_at,end_at=excluded.end_at,
      local_start_date=excluded.local_start_date,local_end_date=excluded.local_end_date,
      is_all_day=excluded.is_all_day,display_title=excluded.display_title,
      location=excluded.location,outlook_web_url=excluded.outlook_web_url,
      is_private=excluded.is_private,provider_status=excluded.provider_status,
      last_seen_scan_id=v_scan,updated_at=now();
    v_count:=v_count+1;
  end loop;
  if p_mode='full' then
    delete from public.crm_m365_imported_occurrences i
      where i.connection_id=c.connection_id and i.local_start_date<p_month+interval '1 month'
        and i.local_end_date>p_month and i.last_seen_scan_id is distinct from v_scan;
  end if;
  insert into public.crm_m365_sync_months(connection_id,month_start,strategy,
    opaque_delta_link,last_successful_scan_at,last_error_code,scan_generation)
    values(c.connection_id,p_month,case when c.is_primary then 'primary_delta' else 'full_reconcile' end,
      p_delta_link,now(),null,v_scan)
    on conflict(connection_id,month_start) do update set
      opaque_delta_link=excluded.opaque_delta_link,last_successful_scan_at=now(),
      last_error_code=null,retry_after_at=null,scan_generation=v_scan;
  return v_count;
end;
$$;
revoke all on function public.commit_crm_m365_month_scan(uuid,uuid,date,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.commit_crm_m365_month_scan(uuid,uuid,date,text,jsonb,text) to service_role;
