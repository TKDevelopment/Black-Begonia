create or replace function public.reserve_payment_checkout(p_token_digest text,p_method text,p_command_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.payment_requests; a public.payment_checkout_attempts; s public.payment_collection_settings; begin
 if auth.role()<>'service_role' then raise exception 'service role required'; end if;
 if p_method not in ('stripe_card','paypal_venmo') then raise exception 'Unsupported checkout method'; end if;
 select * into r from public.payment_requests where token_digest=p_token_digest and status='active' and invalidated_at is null for update;
 if not found then raise exception 'Request unavailable'; end if;
 select * into s from public.payment_collection_settings where settings_id;
 if not s.collection_enabled or (p_method='stripe_card' and not s.stripe_enabled) or (p_method='paypal_venmo' and not s.venmo_enabled) then raise exception 'Provider unavailable'; end if;
 update public.payment_checkout_attempts set status='expired',resolved_at=now(),last_verified_state='expired_locally' where payment_request_id=r.payment_request_id and status in ('creating','active','processing') and expires_at<=now();
 select * into a from public.payment_checkout_attempts where payment_request_id=r.payment_request_id and status in ('creating','active','processing') for update;
 if found then
   if a.method<>p_method then return jsonb_build_object('state','method_locked','attemptId',a.payment_checkout_attempt_id); end if;
   return jsonb_build_object('state','existing','attempt',to_jsonb(a));
 end if;
 insert into public.payment_checkout_attempts(payment_request_id,project_id,method,principal_amount,charge_amount,create_idempotency_key,expires_at)
 values(r.payment_request_id,r.project_id,p_method,r.principal_amount,r.principal_amount,p_command_key,now()+interval '30 minutes') returning * into a;
 return jsonb_build_object('state','reserved','attempt',to_jsonb(a));
end; $$;
revoke all on function public.reserve_payment_checkout(text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_payment_checkout(text,text,text) to service_role;
