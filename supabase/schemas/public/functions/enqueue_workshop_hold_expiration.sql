create or replace function public.enqueue_workshop_hold_expiration()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_url text;
  v_scheduler_secret text;
  v_request_id bigint;
begin
  select nullif(btrim(decrypted_secret), '')
    into v_project_url
    from vault.decrypted_secrets
   where name = 'project_url'
   limit 1;

  select nullif(btrim(decrypted_secret), '')
    into v_scheduler_secret
    from vault.decrypted_secrets
   where name = 'workshop_scheduler_secret'
   limit 1;

  if v_project_url is null then
    raise exception 'Workshop scheduler Vault project_url is missing';
  end if;
  if v_scheduler_secret is null or length(v_scheduler_secret) < 32 then
    raise exception 'Workshop scheduler Vault workshop_scheduler_secret is missing or invalid';
  end if;

  v_project_url := regexp_replace(v_project_url, '/+$', '');
  if v_project_url !~ '^https://[a-z0-9-]+\.supabase\.co$' then
    raise exception 'Workshop scheduler Vault project_url is invalid';
  end if;

  select net.http_post(
    url := v_project_url || '/functions/v1/expire-workshop-holds',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-workshop-scheduler-secret', v_scheduler_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.enqueue_workshop_hold_expiration() from public, anon, authenticated;
grant execute on function public.enqueue_workshop_hold_expiration() to service_role;
