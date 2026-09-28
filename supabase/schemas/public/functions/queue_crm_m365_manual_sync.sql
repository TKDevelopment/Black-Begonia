create or replace function public.queue_crm_m365_manual_sync(p_actor uuid,p_month date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_connection uuid; v_run uuid;
begin
  if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id
    where p.id=p_actor and p.is_active and r.role='admin') then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_month is not null and extract(day from p_month)<>1 then
    raise exception 'invalid_calendar_month' using errcode='22023';
  end if;
  select connection_id into v_connection from public.crm_m365_calendar_connections
    where status='connected' limit 1 for update;
  if v_connection is null then raise exception 'calendar_not_connected' using errcode='P0002'; end if;
  select run_id into v_run from public.crm_m365_sync_runs
    where connection_id=v_connection and trigger='manual' and status in ('queued','running')
    order by requested_at desc limit 1;
  if v_run is null then
    insert into public.crm_m365_sync_runs(connection_id,trigger,requested_month,requested_by)
      values(v_connection,'manual',p_month,p_actor) returning run_id into v_run;
  end if;
  return jsonb_build_object('status','queued','runId',v_run);
end;
$$;
revoke all on function public.queue_crm_m365_manual_sync(uuid,date) from public, anon, authenticated;
grant execute on function public.queue_crm_m365_manual_sync(uuid,date) to service_role;
