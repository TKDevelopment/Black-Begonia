-- Accept official account.venmo.com/u/ profile links in payment settings and checkout.

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
   or not coalesce(btrim(s.venmo_business_target) ~* '^(@[A-Za-z0-9_-]{2,64}|https://((www\.)?venmo\.com|account\.venmo\.com)/u/[A-Za-z0-9_-]{2,64}/?)$',false)
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
 if r.request_kind='installment' and not exists (
   select 1 from public.project_payment_records o
   where o.project_payment_record_id=r.installment_obligation_id
     and o.project_id=r.project_id and o.outstanding_amount>=r.principal_amount
     and o.status not in ('paid','waived','canceled','review_required')
 ) then return jsonb_build_object('state','unavailable'); end if;
 select * into p from public.projects where project_id=r.project_id and status not in ('completed','canceled');
 if not found then return jsonb_build_object('state','unavailable'); end if;
 select * into a from public.payment_checkout_attempts where payment_request_id=r.payment_request_id and (p_attempt_id is null or payment_checkout_attempt_id=p_attempt_id) order by created_at desc limit 1;
 select * into i from public.payment_intentions where payment_request_id=r.payment_request_id and state='active' order by created_at desc limit 1;
 select * into s from public.payment_collection_settings where settings_id;
 return jsonb_build_object('state',case when a.status='paid' then 'confirmed' when a.status in ('creating','active','processing') then 'processing' else 'active' end,
   'brand','Black Begonia Florals','purpose',r.request_kind,'projectLabel',p.project_name,'eventDate',p.event_date,'currency','USD','principalCents',round(r.principal_amount*100)::bigint,
   'depositCents',round(r.deposit_amount*100)::bigint,'finalCents',round(r.final_amount*100)::bigint,
   'methods',to_jsonb(array_remove(array[case when s.collection_enabled and s.stripe_enabled then 'stripe_card' end,case when s.collection_enabled and s.venmo_enabled and btrim(s.venmo_business_target) ~* '^(@[A-Za-z0-9_-]{2,64}|https://((www\.)?venmo\.com|account\.venmo\.com)/u/[A-Za-z0-9_-]{2,64}/?)$' then 'venmo' end,'cash','check'],null)),
   'activeAttempt',case when a.status in ('creating','active','processing') then a.payment_checkout_attempt_id end,
   'intention',case when i.payment_intention_id is not null then jsonb_build_object('method',i.method,'pauseEndsAt',i.pause_ends_at) end,
   'instructionSnapshots',jsonb_build_object('cash',r.cash_instructions,'check',r.check_instructions));
end; $$;
revoke all on function public.resolve_payment_request_projection(text,uuid) from public,anon,authenticated;
grant execute on function public.resolve_payment_request_projection(text,uuid) to service_role;

create or replace function public.update_payment_collection_settings(p_business_timezone text,p_send_window_start time,p_send_window_end time,p_cash_instructions text,p_check_instructions text,p_venmo_business_target text,p_stripe_enabled boolean,p_venmo_enabled boolean,p_reminders_enabled boolean,p_collection_enabled boolean,p_provider_environment text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_settings public.payment_collection_settings;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_business_timezone) then raise exception 'Invalid IANA timezone'; end if;
  if p_send_window_start>=p_send_window_end then raise exception 'Send window end must follow its start'; end if;
  if p_provider_environment not in ('sandbox','production') then raise exception 'Invalid provider environment'; end if;
  if p_venmo_enabled and nullif(btrim(p_venmo_business_target),'') is null then raise exception 'Venmo target is required when Venmo is enabled'; end if;
  if p_venmo_enabled and btrim(p_venmo_business_target) !~* '^(@[A-Za-z0-9_-]{2,64}|https://((www\.)?venmo\.com|account\.venmo\.com)/u/[A-Za-z0-9_-]{2,64}/?)$' then raise exception 'Enter a Venmo @handle or approved Venmo profile URL'; end if;
  insert into public.payment_collection_settings(settings_id,business_timezone,send_window_start,send_window_end,cash_instructions,check_instructions,venmo_business_target,stripe_enabled,venmo_enabled,reminders_enabled,collection_enabled,provider_environment,updated_by,updated_at)
  values(true,p_business_timezone,p_send_window_start,p_send_window_end,coalesce(p_cash_instructions,''),coalesce(p_check_instructions,''),nullif(btrim(p_venmo_business_target),''),p_stripe_enabled,p_venmo_enabled,p_reminders_enabled,p_collection_enabled,p_provider_environment,auth.uid(),now())
  on conflict(settings_id) do update set business_timezone=excluded.business_timezone,send_window_start=excluded.send_window_start,send_window_end=excluded.send_window_end,cash_instructions=excluded.cash_instructions,check_instructions=excluded.check_instructions,venmo_business_target=excluded.venmo_business_target,stripe_enabled=excluded.stripe_enabled,venmo_enabled=excluded.venmo_enabled,reminders_enabled=excluded.reminders_enabled,collection_enabled=excluded.collection_enabled,provider_environment=excluded.provider_environment,updated_by=excluded.updated_by,updated_at=excluded.updated_at returning * into v_settings;
  return to_jsonb(v_settings)||jsonb_build_object('customer_card_fee_policy','fixed_off','customer_card_fee_percent',0);
end; $$;
revoke all on function public.update_payment_collection_settings(text,time,time,text,text,text,boolean,boolean,boolean,boolean,text) from public,anon;
grant execute on function public.update_payment_collection_settings(text,time,time,text,text,text,boolean,boolean,boolean,boolean,text) to authenticated;
