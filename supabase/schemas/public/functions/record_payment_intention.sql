create or replace function public.record_payment_intention(p_token_digest text,p_method text,p_command_key text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare r public.payment_requests;i public.payment_intentions;begin
 if auth.role()<>'service_role' then raise exception 'service role required'; end if;
 if p_method not in ('cash','check','venmo_business_profile') then raise exception 'Unsupported intention'; end if;
 select * into r from public.payment_requests where token_digest=p_token_digest and status='active' and invalidated_at is null for update;
 if not found then raise exception 'Request unavailable'; end if;
 if exists(select 1 from public.payment_checkout_attempts where payment_request_id=r.payment_request_id and status in ('creating','active','processing')) then raise exception 'PAYMENT_METHOD_LOCKED'; end if;
 select * into i from public.payment_intentions where payment_request_id=r.payment_request_id and state='active' and pause_ends_at>now();
 if found then return to_jsonb(i); end if;
 update public.payment_intentions set state='expired' where payment_request_id=r.payment_request_id and state='active';
 insert into public.payment_intentions(payment_request_id,project_id,method,instruction_snapshot,reference,pause_ends_at)
 values(r.payment_request_id,r.project_id,p_method,case p_method when 'cash' then r.cash_instructions when 'check' then r.check_instructions else null end,'BB-'||upper(substr(replace(r.payment_request_id::text,'-',''),1,10)),now()+interval '7 days') returning * into i;
 perform public.create_payment_activity(r.project_id,'Payment intention recorded','Customer plans to pay by '||replace(p_method,'_',' ')||'.','customer',jsonb_build_object('payment_intention_id',i.payment_intention_id,'method',p_method,'pause_ends_at',i.pause_ends_at),null); return to_jsonb(i);
end; $$;
revoke all on function public.record_payment_intention(text,text,text) from public,anon,authenticated;
grant execute on function public.record_payment_intention(text,text,text) to service_role;
