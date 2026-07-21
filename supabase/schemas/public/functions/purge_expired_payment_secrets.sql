create or replace function public.purge_expired_payment_secrets(p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_requests integer;v_checkouts integer;v_provider integer;v_transactions integer:=0;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  update public.payment_requests r set token_ciphertext=null,token_iv=null,token_key_version=null
  where (r.status not in ('draft','active') or r.invalidated_at<p_now) and (r.token_ciphertext is not null or r.token_iv is not null);
  get diagnostics v_requests=row_count;
  update public.payment_checkout_attempts a set provider_client_token=null,provider_handoff_url=null
  where a.expires_at<p_now and (a.provider_client_token is not null or a.provider_handoff_url is not null);
  get diagnostics v_checkouts=row_count;
  update public.payment_provider_events e set normalized_facts=jsonb_strip_nulls(jsonb_build_object('attemptId',e.normalized_facts->'attemptId','kind',e.normalized_facts->'kind','status',e.normalized_facts->'status','principalCents',e.normalized_facts->'principalCents','currency',e.normalized_facts->'currency','providerObjectId',e.normalized_facts->'providerObjectId'))
  where e.received_at<p_now-interval '30 days' and not exists(select 1 from public.payment_legal_holds h where h.project_id=(select a.project_id from public.payment_checkout_attempts a where a.payment_checkout_attempt_id=e.payment_checkout_attempt_id) and h.action='placed' and not exists(select 1 from public.payment_legal_holds r where r.project_id=h.project_id and r.hold_type=h.hold_type and r.action='released' and r.created_at>h.created_at));
  get diagnostics v_provider=row_count;
  -- Immutable financial transaction rows are never updated or deleted here.
  return jsonb_build_object('requests',v_requests,'checkouts',v_checkouts,'providerEvents',v_provider,'transactions',v_transactions);
end; $$;
revoke all on function public.purge_expired_payment_secrets(timestamptz) from public,anon,authenticated;
grant execute on function public.purge_expired_payment_secrets(timestamptz) to service_role;
