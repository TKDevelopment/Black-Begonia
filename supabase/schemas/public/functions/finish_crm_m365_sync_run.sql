create or replace function public.finish_crm_m365_sync_run(
  p_run uuid,p_owner uuid,p_status text,p_error_code text default null,
  p_exported integer default 0,p_imported integer default 0,p_conflicts integer default 0)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_connection uuid;
begin
  if p_status not in ('succeeded','failed') then raise exception 'invalid_run_status' using errcode='22023'; end if;
  select r.connection_id into v_connection from public.crm_m365_sync_runs r
    join public.crm_m365_calendar_connections c on c.connection_id=r.connection_id
    where r.run_id=p_run and r.status='running' and c.lease_owner=p_owner
    for update of r,c;
  if v_connection is null then return false; end if;
  update public.crm_m365_sync_runs set status=p_status,finished_at=now(),
    exported_count=greatest(0,p_exported),imported_count=greatest(0,p_imported),
    conflict_count=greatest(0,p_conflicts),
    last_error_code=case when p_status='failed' then coalesce(p_error_code,'sync_unavailable') else null end
    where run_id=p_run;
  update public.crm_m365_calendar_connections set lease_owner=null,lease_expires_at=null,
    status=case when p_status='failed' and p_error_code='authorization_lost'
      then 'action_required' else status end,
    last_successful_sync_at=case when p_status='succeeded' then now() else last_successful_sync_at end,
    last_error_code=case when p_status='succeeded' then null else coalesce(p_error_code,'sync_unavailable') end,
    updated_at=now() where connection_id=v_connection;
  return true;
end;
$$;
revoke all on function public.finish_crm_m365_sync_run(uuid,uuid,text,text,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.finish_crm_m365_sync_run(uuid,uuid,text,text,integer,integer,integer) to service_role;
