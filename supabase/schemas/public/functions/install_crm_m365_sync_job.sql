create or replace function public.install_crm_m365_sync_job()
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_job_id bigint;
begin
  if to_regclass('cron.job') is null or to_regnamespace('net') is null
    or to_regclass('vault.decrypted_secrets') is null then
    raise exception 'calendar_scheduler_extensions_missing' using errcode='55000';
  end if;
  if not exists(select 1 from vault.decrypted_secrets where name='project_url'
    and decrypted_secret ~ '^https://[a-z0-9-]+\.supabase\.co/?$')
    or not exists(select 1 from vault.decrypted_secrets where name='crm_m365_scheduler_secret'
      and length(decrypted_secret)>=32) then
    raise exception 'calendar_scheduler_secrets_missing' using errcode='55000';
  end if;
  for v_job_id in select jobid from cron.job where jobname='sync-crm-m365-calendar-5m' loop
    perform cron.unschedule(v_job_id);
  end loop;
  return cron.schedule('sync-crm-m365-calendar-5m','*/5 * * * *',
    'select public.dispatch_crm_m365_sync_job();');
end;
$$;
revoke all on function public.install_crm_m365_sync_job() from public, anon, authenticated;
grant execute on function public.install_crm_m365_sync_job() to service_role;
