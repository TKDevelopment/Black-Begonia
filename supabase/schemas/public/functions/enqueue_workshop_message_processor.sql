create or replace function public.enqueue_workshop_message_processor(
  p_batch_limit integer default 25
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_url text;
  v_cron_secret text;
  v_request_id bigint;
begin
  if p_batch_limit < 1 or p_batch_limit > 100 then
    raise exception 'Workshop message processor batch limit must be between 1 and 100';
  end if;

  select nullif(btrim(decrypted_secret), '')
    into v_project_url
    from vault.decrypted_secrets
   where name = 'project_url'
   limit 1;

  select nullif(btrim(decrypted_secret), '')
    into v_cron_secret
    from vault.decrypted_secrets
   where name = 'workshop_message_cron_secret'
   limit 1;

  if v_project_url is null then
    raise exception 'Workshop message processor Vault project_url is missing';
  end if;
  if v_cron_secret is null or length(v_cron_secret) < 32 then
    raise exception 'Workshop message processor Vault workshop_message_cron_secret is missing or invalid';
  end if;

  v_project_url := regexp_replace(v_project_url, '/+$', '');
  if v_project_url !~ '^https://[a-z0-9-]+\.supabase\.co$' then
    raise exception 'Workshop message processor Vault project_url is invalid';
  end if;

  select net.http_post(
    url := v_project_url || '/functions/v1/process-workshop-messages',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_cron_secret
    ),
    body := jsonb_build_object('batchLimit', p_batch_limit),
    timeout_milliseconds := 10000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.enqueue_workshop_message_processor(integer) from public, anon, authenticated;
grant execute on function public.enqueue_workshop_message_processor(integer) to service_role;
