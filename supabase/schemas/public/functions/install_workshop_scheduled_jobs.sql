create or replace function public.install_workshop_scheduled_jobs()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id bigint;
  v_hold_job_id bigint;
  v_message_job_id bigint;
begin
  if to_regclass('cron.job') is null or to_regnamespace('net') is null then
    raise exception 'Workshop schedules require the pg_cron and pg_net extensions';
  end if;
  if to_regclass('vault.decrypted_secrets') is null then
    raise exception 'Workshop schedules require Supabase Vault';
  end if;

  if not exists (
    select 1 from vault.decrypted_secrets
     where name = 'project_url' and nullif(btrim(decrypted_secret), '') is not null
  ) then
    raise exception 'Workshop schedules require the project_url Vault secret';
  end if;
  if not exists (
    select 1 from vault.decrypted_secrets
     where name = 'workshop_scheduler_secret'
       and length(nullif(btrim(decrypted_secret), '')) >= 32
  ) then
    raise exception 'Workshop schedules require the workshop_scheduler_secret Vault secret';
  end if;
  if not exists (
    select 1 from vault.decrypted_secrets
     where name = 'workshop_message_cron_secret'
       and length(nullif(btrim(decrypted_secret), '')) >= 32
  ) then
    raise exception 'Workshop schedules require the workshop_message_cron_secret Vault secret';
  end if;

  for v_job_id in
    select jobid from cron.job
     where jobname in (
       'expire-workshop-holds-1m',
       'process-workshop-messages-1m'
     )
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  v_hold_job_id := cron.schedule(
    'expire-workshop-holds-1m',
    '* * * * *',
    'select public.enqueue_workshop_hold_expiration();'
  );
  v_message_job_id := cron.schedule(
    'process-workshop-messages-1m',
    '* * * * *',
    'select public.enqueue_workshop_message_processor(25);'
  );

  return jsonb_build_object(
    'expireWorkshopHoldsJobId', v_hold_job_id,
    'processWorkshopMessagesJobId', v_message_job_id
  );
end;
$$;

revoke all on function public.install_workshop_scheduled_jobs() from public, anon, authenticated;
grant execute on function public.install_workshop_scheduled_jobs() to service_role;
