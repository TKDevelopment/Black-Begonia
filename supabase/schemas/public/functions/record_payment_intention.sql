create or replace function public.record_payment_intention(p_token_digest text,p_method text,p_command_key text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare r public.payment_requests;i public.payment_intentions;s public.payment_collection_settings;v_pause_started_at timestamptz;v_pause_ends_at timestamptz;begin
 if auth.role()<>'service_role' then raise exception 'service role required'; end if;
 if p_method not in ('cash','check','venmo_business_profile') then raise exception 'Unsupported intention'; end if;
 select * into r from public.payment_requests where token_digest=p_token_digest and status='active' and invalidated_at is null for update;
 if not found then raise exception 'Request unavailable'; end if;
 if r.request_kind='installment' and not exists (
   select 1 from public.project_payment_records o
   where o.project_payment_record_id=r.installment_obligation_id
     and o.project_id=r.project_id and o.outstanding_amount>=r.principal_amount
     and o.status not in ('paid','waived','canceled','review_required')
 ) then raise exception 'Installment balance changed; request a new payment link'; end if;
 if r.request_kind='installment' and not exists (
   select 1 from public.projects p where p.project_id=r.project_id
     and p.status not in ('completed','canceled')
 ) then raise exception 'Project payment is unavailable'; end if;
 select * into s from public.payment_collection_settings where settings_id;
 if p_method='venmo_business_profile' and (
   not s.collection_enabled or not s.venmo_enabled
   or not coalesce(btrim(s.venmo_business_target) ~* '^(@[A-Za-z0-9_-]{2,64}|https://(www\.)?venmo\.com/u/[A-Za-z0-9_-]{2,64}/?)$',false)
 ) then raise exception 'Provider unavailable'; end if;
 if exists(select 1 from public.payment_checkout_attempts where payment_request_id=r.payment_request_id and status in ('creating','active','processing')) then raise exception 'PAYMENT_METHOD_LOCKED'; end if;
 select * into i from public.payment_intentions where payment_request_id=r.payment_request_id and state='active' and pause_ends_at>now();
 if found then
   if i.method=p_method then return to_jsonb(i)||jsonb_build_object('amount_cents',round(r.principal_amount*100)::bigint); end if;
   v_pause_started_at:=i.pause_started_at;
   v_pause_ends_at:=i.pause_ends_at;
 end if;
 update public.payment_intentions set state='expired' where payment_request_id=r.payment_request_id and state='active';
 insert into public.payment_intentions(payment_request_id,project_id,method,instruction_snapshot,reference,pause_started_at,pause_ends_at)
 values(r.payment_request_id,r.project_id,p_method,case p_method when 'cash' then r.cash_instructions when 'check' then r.check_instructions else s.venmo_business_target end,'BB-'||upper(substr(replace(r.payment_request_id::text,'-',''),1,10)),coalesce(v_pause_started_at,now()),coalesce(v_pause_ends_at,now()+interval '7 days')) returning * into i;
 perform public.create_payment_activity(r.project_id,'Payment intention recorded','Customer plans to pay by '||replace(p_method,'_',' ')||'.','customer',jsonb_build_object('payment_intention_id',i.payment_intention_id,'method',p_method,'pause_ends_at',i.pause_ends_at),null); return to_jsonb(i)||jsonb_build_object('amount_cents',round(r.principal_amount*100)::bigint);
end; $$;
revoke all on function public.record_payment_intention(text,text,text) from public,anon,authenticated;
grant execute on function public.record_payment_intention(text,text,text) to service_role;
