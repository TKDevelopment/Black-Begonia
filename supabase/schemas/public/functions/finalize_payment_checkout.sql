create or replace function public.finalize_payment_checkout(p_attempt_id uuid,p_state text,p_provider_id text default null,p_handoff_url text default null,p_client_token text default null,p_error text default null)
returns jsonb language plpgsql security definer set search_path='' as $$ declare a public.payment_checkout_attempts; begin
 if auth.role()<>'service_role' then raise exception 'service role required'; end if;
 if p_state not in ('active','failed','expired','canceled') then raise exception 'Invalid checkout state'; end if;
 update public.payment_checkout_attempts set status=p_state,provider_session_id=case when method='stripe_card' then p_provider_id else provider_session_id end,provider_order_id=case when method='paypal_venmo' then p_provider_id else provider_order_id end,provider_handoff_url=p_handoff_url,provider_client_token=p_client_token,last_verified_state=coalesce(p_error,p_state),resolved_at=case when p_state<>'active' then now() end where payment_checkout_attempt_id=p_attempt_id and status='creating' returning * into a;
 if not found then select * into a from public.payment_checkout_attempts where payment_checkout_attempt_id=p_attempt_id; end if; return to_jsonb(a);
end; $$;
revoke all on function public.finalize_payment_checkout(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.finalize_payment_checkout(uuid,text,text,text,text,text) to service_role;
