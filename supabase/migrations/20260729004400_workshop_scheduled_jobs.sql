-- Install bounded workshop processors through named, idempotent pg_cron jobs.
-- Runtime credentials are read from Vault and are never persisted in cron.job.
create or replace function public.enqueue_workshop_hold_expiration()
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_project_url text; v_scheduler_secret text; v_request_id bigint;
begin
  select nullif(btrim(decrypted_secret),'') into v_project_url from vault.decrypted_secrets where name='project_url' limit 1;
  select nullif(btrim(decrypted_secret),'') into v_scheduler_secret from vault.decrypted_secrets where name='workshop_scheduler_secret' limit 1;
  if v_project_url is null then raise exception 'Workshop scheduler Vault project_url is missing'; end if;
  if v_scheduler_secret is null or length(v_scheduler_secret)<32 then raise exception 'Workshop scheduler Vault workshop_scheduler_secret is missing or invalid'; end if;
  v_project_url:=regexp_replace(v_project_url,'/+$','');
  if v_project_url !~ '^https://[a-z0-9-]+\.supabase\.co$' then raise exception 'Workshop scheduler Vault project_url is invalid'; end if;
  select net.http_post(url:=v_project_url||'/functions/v1/expire-workshop-holds',headers:=jsonb_build_object('Content-Type','application/json','x-workshop-scheduler-secret',v_scheduler_secret),body:='{}'::jsonb,timeout_milliseconds:=10000) into v_request_id;
  return v_request_id;
end; $$;
revoke all on function public.enqueue_workshop_hold_expiration() from public,anon,authenticated;
grant execute on function public.enqueue_workshop_hold_expiration() to service_role;

create or replace function public.enqueue_workshop_message_processor(p_batch_limit integer default 25)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_project_url text; v_cron_secret text; v_request_id bigint;
begin
  if p_batch_limit<1 or p_batch_limit>100 then raise exception 'Workshop message processor batch limit must be between 1 and 100'; end if;
  select nullif(btrim(decrypted_secret),'') into v_project_url from vault.decrypted_secrets where name='project_url' limit 1;
  select nullif(btrim(decrypted_secret),'') into v_cron_secret from vault.decrypted_secrets where name='workshop_message_cron_secret' limit 1;
  if v_project_url is null then raise exception 'Workshop message processor Vault project_url is missing'; end if;
  if v_cron_secret is null or length(v_cron_secret)<32 then raise exception 'Workshop message processor Vault workshop_message_cron_secret is missing or invalid'; end if;
  v_project_url:=regexp_replace(v_project_url,'/+$','');
  if v_project_url !~ '^https://[a-z0-9-]+\.supabase\.co$' then raise exception 'Workshop message processor Vault project_url is invalid'; end if;
  select net.http_post(url:=v_project_url||'/functions/v1/process-workshop-messages',headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',v_cron_secret),body:=jsonb_build_object('batchLimit',p_batch_limit),timeout_milliseconds:=10000) into v_request_id;
  return v_request_id;
end; $$;
revoke all on function public.enqueue_workshop_message_processor(integer) from public,anon,authenticated;
grant execute on function public.enqueue_workshop_message_processor(integer) to service_role;

create or replace function public.install_workshop_scheduled_jobs()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_job_id bigint; v_hold_job_id bigint; v_message_job_id bigint;
begin
  if to_regclass('cron.job') is null or to_regnamespace('net') is null then raise exception 'Workshop schedules require the pg_cron and pg_net extensions'; end if;
  if to_regclass('vault.decrypted_secrets') is null then raise exception 'Workshop schedules require Supabase Vault'; end if;
  if not exists(select 1 from vault.decrypted_secrets where name='project_url' and nullif(btrim(decrypted_secret),'') is not null) then raise exception 'Workshop schedules require the project_url Vault secret'; end if;
  if not exists(select 1 from vault.decrypted_secrets where name='workshop_scheduler_secret' and length(nullif(btrim(decrypted_secret),''))>=32) then raise exception 'Workshop schedules require the workshop_scheduler_secret Vault secret'; end if;
  if not exists(select 1 from vault.decrypted_secrets where name='workshop_message_cron_secret' and length(nullif(btrim(decrypted_secret),''))>=32) then raise exception 'Workshop schedules require the workshop_message_cron_secret Vault secret'; end if;
  for v_job_id in select jobid from cron.job where jobname in ('expire-workshop-holds-1m','process-workshop-messages-1m') loop perform cron.unschedule(v_job_id); end loop;
  v_hold_job_id:=cron.schedule('expire-workshop-holds-1m','* * * * *','select public.enqueue_workshop_hold_expiration();');
  v_message_job_id:=cron.schedule('process-workshop-messages-1m','* * * * *','select public.enqueue_workshop_message_processor(25);');
  return jsonb_build_object('expireWorkshopHoldsJobId',v_hold_job_id,'processWorkshopMessagesJobId',v_message_job_id);
end; $$;
revoke all on function public.install_workshop_scheduled_jobs() from public,anon,authenticated;
grant execute on function public.install_workshop_scheduled_jobs() to service_role;

do $workshop_cron$
begin
  if to_regclass('cron.job') is null or to_regnamespace('net') is null or to_regclass('vault.decrypted_secrets') is null then
    raise warning 'Workshop Cron jobs not installed: pg_cron, pg_net, and Vault are required';
    return;
  end if;
  if not exists(select 1 from vault.decrypted_secrets where name='project_url' and nullif(btrim(decrypted_secret),'') is not null)
     or not exists(select 1 from vault.decrypted_secrets where name='workshop_scheduler_secret' and length(nullif(btrim(decrypted_secret),''))>=32)
     or not exists(select 1 from vault.decrypted_secrets where name='workshop_message_cron_secret' and length(nullif(btrim(decrypted_secret),''))>=32) then
    raise warning 'Workshop Cron jobs not installed: configure project_url, workshop_scheduler_secret, and workshop_message_cron_secret in Vault, then call public.install_workshop_scheduled_jobs()';
    return;
  end if;
  perform public.install_workshop_scheduled_jobs();
end $workshop_cron$;
