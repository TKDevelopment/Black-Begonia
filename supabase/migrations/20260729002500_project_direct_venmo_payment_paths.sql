-- Project-payment runtime path retirement. This replaces active PayPal-backed
-- Venmo checkout with the existing direct business-profile intention flow.
-- Historical checkout attempts, provider events, and transactions are retained.

create or replace function public.resolve_payment_request_projection(
  p_token_digest text,p_attempt_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' stable as $$
declare
  r public.payment_requests;a public.payment_checkout_attempts;
  p public.projects;s public.payment_collection_settings;i public.payment_intentions;
begin
  if auth.role()<>'service_role' then raise exception 'service role required';end if;
  select * into r from public.payment_requests where token_digest=p_token_digest;
  if not found then return jsonb_build_object('state','unavailable');end if;
  if r.status='fulfilled' then
    select * into p from public.projects where project_id=r.project_id;
    return jsonb_build_object('state','confirmed','brand','Black Begonia Florals',
      'purpose',r.request_kind,'projectLabel',p.project_name,'eventDate',p.event_date,
      'currency','USD','principalCents',round(r.principal_amount*100)::bigint);
  end if;
  if r.status<>'active' or r.invalidated_at is not null then
    return jsonb_build_object('state','unavailable');end if;
  select * into p from public.projects where project_id=r.project_id
    and status not in('completed','canceled');
  if not found then return jsonb_build_object('state','unavailable');end if;
  select * into a from public.payment_checkout_attempts
    where payment_request_id=r.payment_request_id
      and(p_attempt_id is null or payment_checkout_attempt_id=p_attempt_id)
    order by created_at desc limit 1;
  select * into i from public.payment_intentions
    where payment_request_id=r.payment_request_id and state='active'
    order by created_at desc limit 1;
  select * into s from public.payment_collection_settings where settings_id;
  return jsonb_build_object(
    'state',case when a.status='paid' then 'confirmed'
      when a.status in('creating','active','processing') then 'processing'
      else 'active' end,
    'brand','Black Begonia Florals','purpose',r.request_kind,
    'projectLabel',p.project_name,'eventDate',p.event_date,'currency','USD',
    'principalCents',round(r.principal_amount*100)::bigint,
    'depositCents',round(r.deposit_amount*100)::bigint,
    'finalCents',round(r.final_amount*100)::bigint,
    'methods',to_jsonb(array_remove(array[
      case when s.collection_enabled and s.stripe_enabled then 'stripe_card' end,
      case when s.collection_enabled and s.venmo_enabled
        and nullif(btrim(s.venmo_business_target),'') is not null then 'venmo' end,
      'cash','check'
    ],null)),
    'activeAttempt',case when a.status in('creating','active','processing')
      then a.payment_checkout_attempt_id end,
    'intention',case when i.payment_intention_id is not null then
      jsonb_build_object('method',i.method,'pauseEndsAt',i.pause_ends_at) end,
    'instructionSnapshots',jsonb_build_object(
      'cash',r.cash_instructions,'check',r.check_instructions)
  );
end;$$;
revoke all on function public.resolve_payment_request_projection(text,uuid)
  from public,anon,authenticated;
grant execute on function public.resolve_payment_request_projection(text,uuid)
  to service_role;

create or replace function public.reserve_payment_checkout(
  p_token_digest text,p_method text,p_command_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  r public.payment_requests;a public.payment_checkout_attempts;
  s public.payment_collection_settings;
begin
  if auth.role()<>'service_role' then raise exception 'service role required';end if;
  if p_method<>'stripe_card' then raise exception 'Unsupported checkout method';end if;
  select * into r from public.payment_requests
    where token_digest=p_token_digest and status='active' and invalidated_at is null
    for update;
  if not found then raise exception 'Request unavailable';end if;
  select * into s from public.payment_collection_settings where settings_id;
  if not s.collection_enabled or not s.stripe_enabled then
    raise exception 'Provider unavailable';end if;
  update public.payment_checkout_attempts set status='expired',resolved_at=now(),
    last_verified_state='expired_locally'
    where payment_request_id=r.payment_request_id
      and status in('creating','active','processing') and expires_at<=now();
  select * into a from public.payment_checkout_attempts
    where payment_request_id=r.payment_request_id
      and status in('creating','active','processing') for update;
  if found then
    if a.method<>p_method then
      return jsonb_build_object('state','method_locked',
        'attemptId',a.payment_checkout_attempt_id);end if;
    return jsonb_build_object('state','existing','attempt',to_jsonb(a));
  end if;
  insert into public.payment_checkout_attempts(payment_request_id,project_id,
    method,principal_amount,charge_amount,create_idempotency_key,expires_at)
  values(r.payment_request_id,r.project_id,p_method,r.principal_amount,
    r.principal_amount,p_command_key,now()+interval '30 minutes')
  returning * into a;
  return jsonb_build_object('state','reserved','attempt',to_jsonb(a));
end;$$;
revoke all on function public.reserve_payment_checkout(text,text,text)
  from public,anon,authenticated;
grant execute on function public.reserve_payment_checkout(text,text,text)
  to service_role;

create or replace function public.record_payment_intention(
  p_token_digest text,p_method text,p_command_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  r public.payment_requests;i public.payment_intentions;
  s public.payment_collection_settings;
begin
  if auth.role()<>'service_role' then raise exception 'service role required';end if;
  if p_method not in('cash','check','venmo_business_profile') then
    raise exception 'Unsupported intention';end if;
  select * into r from public.payment_requests
    where token_digest=p_token_digest and status='active' and invalidated_at is null
    for update;
  if not found then raise exception 'Request unavailable';end if;
  select * into s from public.payment_collection_settings where settings_id;
  if p_method='venmo_business_profile' and(
    not s.collection_enabled or not s.venmo_enabled
    or nullif(btrim(s.venmo_business_target),'') is null
  )then raise exception 'Provider unavailable';end if;
  if exists(select 1 from public.payment_checkout_attempts
    where payment_request_id=r.payment_request_id
      and status in('creating','active','processing'))
    then raise exception 'PAYMENT_METHOD_LOCKED';end if;
  select * into i from public.payment_intentions
    where payment_request_id=r.payment_request_id
      and state='active' and pause_ends_at>now();
  if found then return to_jsonb(i)||jsonb_build_object(
    'amount_cents',round(r.principal_amount*100)::bigint);end if;
  update public.payment_intentions set state='expired'
    where payment_request_id=r.payment_request_id and state='active';
  insert into public.payment_intentions(payment_request_id,project_id,method,
    instruction_snapshot,reference,pause_ends_at)
  values(r.payment_request_id,r.project_id,p_method,
    case p_method when 'cash' then r.cash_instructions
      when 'check' then r.check_instructions else s.venmo_business_target end,
    'BB-'||upper(substr(replace(r.payment_request_id::text,'-',''),1,10)),
    now()+interval '7 days') returning * into i;
  perform public.create_payment_activity(r.project_id,'Payment intention recorded',
    'Customer plans to pay by '||replace(p_method,'_',' ')||'.','customer',
    jsonb_build_object('payment_intention_id',i.payment_intention_id,
      'method',p_method,'pause_ends_at',i.pause_ends_at),null);
  return to_jsonb(i)||jsonb_build_object(
    'amount_cents',round(r.principal_amount*100)::bigint);
end;$$;
revoke all on function public.record_payment_intention(text,text,text)
  from public,anon,authenticated;
grant execute on function public.record_payment_intention(text,text,text)
  to service_role;
