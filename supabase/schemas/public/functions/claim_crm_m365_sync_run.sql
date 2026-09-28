create or replace function public.claim_crm_m365_sync_run()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.crm_m365_calendar_connections%rowtype;
  r public.crm_m365_sync_runs%rowtype; v_owner uuid:=gen_random_uuid();
begin
  select * into c from public.crm_m365_calendar_connections where status='connected'
    order by connected_at desc limit 1 for update skip locked;
  if c.connection_id is null or c.lease_expires_at>now() then
    return jsonb_build_object('claimed',false);
  end if;
  update public.crm_m365_sync_runs set status='queued',started_at=null
    where connection_id=c.connection_id and status='running';
  select * into r from public.crm_m365_sync_runs
    where connection_id=c.connection_id and status='queued'
    order by requested_at limit 1 for update skip locked;
  if r.run_id is null then
    insert into public.crm_m365_sync_runs(connection_id,trigger,status,started_at)
      values(c.connection_id,'scheduled','running',now()) returning * into r;
  else
    update public.crm_m365_sync_runs set status='running',started_at=now()
      where run_id=r.run_id returning * into r;
  end if;
  update public.crm_m365_calendar_connections set lease_owner=v_owner,
    lease_expires_at=now()+interval '6 minutes',updated_at=now()
    where connection_id=c.connection_id;
  return jsonb_build_object('claimed',true,'owner',v_owner,'runId',r.run_id,
    'connectionId',c.connection_id,'mailboxUpn',c.mailbox_upn,
    'calendarId',c.calendar_id,'isPrimary',c.is_primary,
    'timezone',c.business_timezone,'trigger',r.trigger,'requestedMonth',r.requested_month);
end;
$$;
revoke all on function public.claim_crm_m365_sync_run() from public, anon, authenticated;
grant execute on function public.claim_crm_m365_sync_run() to service_role;
