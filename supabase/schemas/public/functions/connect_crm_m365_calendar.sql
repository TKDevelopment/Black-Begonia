create or replace function public.connect_crm_m365_calendar(
  p_tenant_id text,p_mailbox_user_id text,p_mailbox_upn text,
  p_calendar_id text,p_calendar_name text,p_is_primary boolean,
  p_timezone text,p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.crm_m365_calendar_connections%rowtype; v_active uuid; v_run uuid; v_queued integer;
begin
  if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id
    where p.id=p_actor and p.is_active and r.role='admin') then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if nullif(btrim(p_tenant_id),'') is null or nullif(btrim(p_mailbox_user_id),'') is null
    or nullif(btrim(p_mailbox_upn),'') is null or nullif(btrim(p_calendar_id),'') is null
    or nullif(btrim(p_calendar_name),'') is null or nullif(btrim(p_timezone),'') is null
    or length(p_calendar_id)>512 or length(p_calendar_name)>160 then
    raise exception 'invalid_calendar_connection' using errcode='22023';
  end if;
  select connection_id into v_active from public.crm_m365_calendar_connections
    where status in ('connected','action_required') limit 1 for update;
  if v_active is not null and not exists(select 1 from public.crm_m365_calendar_connections
    where connection_id=v_active and tenant_id=p_tenant_id and mailbox_user_id=p_mailbox_user_id
      and calendar_id=p_calendar_id) then
    raise exception 'calendar_already_connected' using errcode='23505';
  end if;
  insert into public.crm_m365_calendar_connections(tenant_id,mailbox_user_id,mailbox_upn,
    calendar_id,calendar_name,is_primary,business_timezone,status,connected_by,connected_at)
  values(p_tenant_id,p_mailbox_user_id,p_mailbox_upn,p_calendar_id,p_calendar_name,
    p_is_primary,p_timezone,'connected',p_actor,now())
  on conflict(tenant_id,mailbox_user_id,calendar_id) do update set
    calendar_name=excluded.calendar_name,is_primary=excluded.is_primary,
    business_timezone=excluded.business_timezone,status='connected',
    connected_by=p_actor,connected_at=now(),disconnected_at=null,
    updated_at=now() returning * into c;
  v_queued:=public.requeue_crm_calendar_sources();
  insert into public.crm_m365_sync_runs(connection_id,trigger)
    values(c.connection_id,'manual') returning run_id into v_run;
  return jsonb_build_object('connectionId',c.connection_id,'calendarDisplayName',c.calendar_name,
    'status','connected','runId',v_run,'queuedSources',v_queued);
end;
$$;
revoke all on function public.connect_crm_m365_calendar(text,text,text,text,text,boolean,text,uuid) from public, anon, authenticated;
grant execute on function public.connect_crm_m365_calendar(text,text,text,text,text,boolean,text,uuid) to service_role;
