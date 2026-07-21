-- Validate Vault configuration before pg_net receives a request and centralize
-- scheduled/targeted invocation behind one service-only database boundary.
create or replace function public.enqueue_payment_message_processor(p_delivery_id uuid default null)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_project_url text; v_service_role_key text; v_cron_secret text; v_request_id bigint;
begin
  select nullif(decrypted_secret,'') into v_project_url from vault.decrypted_secrets where name='project_url' limit 1;
  select nullif(decrypted_secret,'') into v_service_role_key from vault.decrypted_secrets where name='service_role_key' limit 1;
  select nullif(decrypted_secret,'') into v_cron_secret from vault.decrypted_secrets where name='payment_cron_secret' limit 1;
  if v_project_url is null then raise exception 'Payment processor Vault project_url is missing'; end if;
  if v_service_role_key is null then raise exception 'Payment processor Vault service_role_key is missing'; end if;
  if v_cron_secret is null then raise exception 'Payment processor Vault payment_cron_secret is missing'; end if;
  v_project_url:=regexp_replace(v_project_url,'/+$','');
  if v_project_url !~ '^https://[a-z0-9-]+\.supabase\.co$' then raise exception 'Payment processor Vault project_url is invalid'; end if;
  select net.http_post(
    url:=v_project_url||'/functions/v1/process-payment-messages',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_service_role_key,'x-cron-secret',v_cron_secret),
    body:=case when p_delivery_id is null then '{}'::jsonb else jsonb_build_object('requestedDeliveryId',p_delivery_id::text) end,
    timeout_milliseconds:=10000
  ) into v_request_id;
  return v_request_id;
end; $$;
revoke all on function public.enqueue_payment_message_processor(uuid) from public,anon,authenticated;
grant execute on function public.enqueue_payment_message_processor(uuid) to service_role;

do $payment_cron$
declare v_job_id bigint;
begin
  if to_regclass('cron.job') is null then
    raise warning 'Payment processor Cron not installed: pg_cron is unavailable';
    return;
  end if;
  if not exists(select 1 from vault.decrypted_secrets where name='project_url' and nullif(decrypted_secret,'') is not null)
     or not exists(select 1 from vault.decrypted_secrets where name='service_role_key' and nullif(decrypted_secret,'') is not null)
     or not exists(select 1 from vault.decrypted_secrets where name='payment_cron_secret' and nullif(decrypted_secret,'') is not null) then
    raise warning 'Payment processor Cron not installed: nonempty project_url, service_role_key, and payment_cron_secret Vault values are required';
    return;
  end if;
  select jobid into v_job_id from cron.job where jobname='process-project-payment-messages-15m';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule('process-project-payment-messages-15m','*/15 * * * *',$cron_body$
    select public.enqueue_payment_message_processor(null);
  $cron_body$);
end $payment_cron$;
