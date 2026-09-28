create or replace function public.dispatch_crm_m365_sync_job()
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_project_url text; v_secret text; v_request_id bigint;
begin
  select nullif(btrim(decrypted_secret),'') into v_project_url
    from vault.decrypted_secrets where name='project_url' limit 1;
  select nullif(btrim(decrypted_secret),'') into v_secret
    from vault.decrypted_secrets where name='crm_m365_scheduler_secret' limit 1;
  if v_project_url !~ '^https://[a-z0-9-]+\.supabase\.co/?$'
    or v_secret is null or length(v_secret)<32 then
    raise exception 'calendar_scheduler_not_configured' using errcode='55000';
  end if;
  select net.http_post(url:=rtrim(v_project_url,'/')||'/functions/v1/crm-m365-calendar-sync',
    headers:=jsonb_build_object('Content-Type','application/json','x-crm-m365-scheduler-secret',v_secret),
    body:='{}'::jsonb,timeout_milliseconds:=10000) into v_request_id;
  return v_request_id;
end;
$$;
revoke all on function public.dispatch_crm_m365_sync_job() from public, anon, authenticated;
grant execute on function public.dispatch_crm_m365_sync_job() to service_role;
