create or replace function public.resolve_payment_request_projection(p_token_digest text,p_attempt_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare r public.payment_requests; a public.payment_checkout_attempts; p public.projects; s public.payment_collection_settings; i public.payment_intentions;
begin
 if auth.role()<>'service_role' then raise exception 'service role required'; end if;
 select * into r from public.payment_requests where token_digest=p_token_digest;
 if not found then return jsonb_build_object('state','unavailable'); end if;
 if r.status='fulfilled' then
   select * into p from public.projects where project_id=r.project_id;
   return jsonb_build_object('state','confirmed','brand','Black Begonia Florals','purpose',r.request_kind,'projectLabel',p.project_name,'eventDate',p.event_date,'currency','USD','principalCents',round(r.principal_amount*100)::bigint);
 end if;
 if r.status<>'active' or r.invalidated_at is not null then return jsonb_build_object('state','unavailable'); end if;
 select * into p from public.projects where project_id=r.project_id and status not in ('completed','canceled');
 if not found then return jsonb_build_object('state','unavailable'); end if;
 select * into a from public.payment_checkout_attempts where payment_request_id=r.payment_request_id and (p_attempt_id is null or payment_checkout_attempt_id=p_attempt_id) order by created_at desc limit 1;
 select * into i from public.payment_intentions where payment_request_id=r.payment_request_id and state='active' order by created_at desc limit 1;
 select * into s from public.payment_collection_settings where settings_id;
 return jsonb_build_object('state',case when a.status='paid' then 'confirmed' when a.status in ('creating','active','processing') then 'processing' else 'active' end,
   'brand','Black Begonia Florals','purpose',r.request_kind,'projectLabel',p.project_name,'eventDate',p.event_date,'currency','USD','principalCents',round(r.principal_amount*100)::bigint,
   'depositCents',round(r.deposit_amount*100)::bigint,'finalCents',round(r.final_amount*100)::bigint,
   'methods',to_jsonb(array_remove(array[case when s.collection_enabled and s.stripe_enabled then 'stripe_card' end,case when s.collection_enabled then 'venmo' end,'cash','check'],null)),
   'activeAttempt',case when a.status in ('creating','active','processing') then a.payment_checkout_attempt_id end,
   'intention',case when i.payment_intention_id is not null then jsonb_build_object('method',i.method,'pauseEndsAt',i.pause_ends_at) end,
   'instructionSnapshots',jsonb_build_object('cash',r.cash_instructions,'check',r.check_instructions));
end; $$;
revoke all on function public.resolve_payment_request_projection(text,uuid) from public,anon,authenticated;
grant execute on function public.resolve_payment_request_projection(text,uuid) to service_role;
