-- Keep separately requested installment checkout links active for their own obligations.
alter table public.payment_requests
  add column installment_obligation_id uuid null
    references public.project_payment_records(project_payment_record_id) on delete restrict;

alter table public.payment_requests
  drop constraint payment_requests_request_kind_check;
alter table public.payment_requests
  add constraint payment_requests_request_kind_check
    check (request_kind in ('deposit','final_payment','consolidated','installment'));
alter table public.payment_requests
  add constraint payment_requests_installment_target_check
    check ((request_kind = 'installment') = (installment_obligation_id is not null));

drop index public.uq_payment_requests_active_project_kind;
create unique index uq_payment_requests_active_project_kind
  on public.payment_requests(project_id,request_kind)
  where status='active' and request_kind <> 'installment';
create unique index uq_payment_requests_active_installment
  on public.payment_requests(installment_obligation_id)
  where status='active' and request_kind='installment';

grant select(installment_obligation_id) on public.payment_requests to authenticated;

create or replace function public.issue_payment_request(
  p_obligation_ids uuid[], p_principal_cents bigint, p_kind text,
  p_token_digest text, p_token_ciphertext text, p_token_iv text,
  p_token_key_version text, p_command_key uuid
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_request public.payment_requests; v_existing public.payment_requests;
v_project_id uuid; v_outstanding numeric(12,2); v_principal numeric(12,2):=p_principal_cents/100.0;
v_deposit numeric(12,2); v_final numeric(12,2); v_selected_kind text;
v_recipient jsonb; v_settings public.payment_collection_settings;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  select * into v_existing from public.payment_requests where command_key=p_command_key;
  if found then return jsonb_build_object('paymentRequestId',v_existing.payment_request_id,'projectId',v_existing.project_id,'replayed',true); end if;
  if cardinality(p_obligation_ids) not between 1 and 2
    or p_kind not in ('deposit','final_payment','consolidated','installment')
    or p_principal_cents<=0
    or (p_kind='installment' and cardinality(p_obligation_ids)<>1) then
    raise exception 'Invalid request';
  end if;
  perform 1 from public.project_payment_records where project_payment_record_id=any(p_obligation_ids) order by case payment_kind when 'deposit' then 1 else 2 end for update;
  select (array_agg(project_id))[1],sum(outstanding_amount),sum(case when payment_kind='deposit' then least(outstanding_amount,v_principal) else 0 end),sum(case when payment_kind='final_payment' then outstanding_amount else 0 end)
  into v_project_id,v_outstanding,v_deposit,v_final from public.project_payment_records where project_payment_record_id=any(p_obligation_ids) and status not in ('paid','waived','canceled');
  if v_project_id is null or exists(select 1 from public.project_payment_records where project_payment_record_id=any(p_obligation_ids) and project_id<>v_project_id) or v_principal>v_outstanding then raise exception 'Obligations or amount are unavailable'; end if;
  if p_kind='installment' then
    select payment_kind into v_selected_kind from public.project_payment_records
    where project_payment_record_id=p_obligation_ids[1];
    if v_principal<>v_outstanding
      or v_selected_kind not in ('deposit','final_payment','revision_balance')
      or exists(select 1 from public.project_payment_records
        where project_payment_record_id=p_obligation_ids[1] and status='review_required')
      or not exists(select 1 from public.projects where project_id=v_project_id and status not in ('completed','canceled')) then
      raise exception 'Installment balance is unavailable';
    end if;
    v_deposit:=case when v_selected_kind='deposit' then v_principal else 0 end;
    v_final:=v_principal-v_deposit;
  elsif p_kind='deposit' then
    v_deposit:=v_principal;v_final:=0;
  elsif p_kind='final_payment' then
    v_final:=v_principal;v_deposit:=0;
  else
    v_deposit:=least(coalesce(v_deposit,0),v_principal);v_final:=v_principal-v_deposit;
  end if;
  select * into v_settings from public.payment_collection_settings where settings_id;
  v_recipient:=public.resolve_project_billing_recipient(v_project_id);
  if nullif(v_recipient->>'email','') is null then raise exception 'No eligible payment recipient'; end if;
  select * into v_existing from public.payment_requests r
  where r.project_id=v_project_id and r.status='active'
    and ((p_kind<>'installment' and (p_kind='consolidated' or r.request_kind in (p_kind,'consolidated')))
      or exists(select 1 from public.payment_request_obligations ro
        where ro.payment_request_id=r.payment_request_id and ro.obligation_id=any(p_obligation_ids)))
  order by r.created_at desc limit 1 for update;
  if exists (
    select 1 from public.payment_checkout_attempts a
    join public.payment_requests r on r.payment_request_id=a.payment_request_id
    where r.project_id=v_project_id and r.status='active'
      and a.status in ('creating','active','processing') and a.expires_at>now()
      and ((p_kind<>'installment' and (p_kind='consolidated' or r.request_kind in (p_kind,'consolidated')))
        or exists(select 1 from public.payment_request_obligations ro
          where ro.payment_request_id=r.payment_request_id and ro.obligation_id=any(p_obligation_ids)))
  ) then
    raise exception 'A checkout is already processing for this installment';
  end if;
  update public.payment_requests set status='superseded',invalidated_at=now(),token_ciphertext=null,token_iv=null,token_key_version=null
  where project_id=v_project_id and status='active'
    and ((p_kind<>'installment' and (p_kind='consolidated' or request_kind in (p_kind,'consolidated')))
      or exists(select 1 from public.payment_request_obligations ro
        where ro.payment_request_id=public.payment_requests.payment_request_id and ro.obligation_id=any(p_obligation_ids)));
  insert into public.payment_requests(project_id,request_kind,installment_obligation_id,status,token_digest,token_ciphertext,token_iv,token_key_version,principal_amount,deposit_amount,final_amount,proposal_snapshot_id,proposal_version,original_recipient_contact_id,original_recipient_email,recipient_fallback_used,cash_instructions,check_instructions,supersedes_request_id,initial_delivery_state,command_key,activated_at,created_by)
  select v_project_id,p_kind,case when p_kind='installment' then p_obligation_ids[1] else null end,'active',p_token_digest,p_token_ciphertext,p_token_iv,p_token_key_version,v_principal,v_deposit,v_final,p.active_proposal_invoice_snapshot_id,s.version,(v_recipient->>'contact_id')::uuid,v_recipient->>'email',(v_recipient->>'fallback_used')::boolean,coalesce(v_settings.cash_instructions,''),coalesce(v_settings.check_instructions,''),v_existing.payment_request_id,'queued',p_command_key,now(),v_actor
  from public.projects p left join public.project_proposal_invoice_snapshots s on s.project_proposal_invoice_snapshot_id=p.active_proposal_invoice_snapshot_id where p.project_id=v_project_id returning * into v_request;
  if v_existing.payment_request_id is not null then update public.payment_requests set superseded_by_request_id=v_request.payment_request_id where payment_request_id=v_existing.payment_request_id; end if;
  insert into public.payment_request_obligations(payment_request_id,obligation_id,requested_amount,display_order)
  select v_request.payment_request_id,o.project_payment_record_id,case when o.payment_kind='deposit' then v_deposit else v_final end,case when o.payment_kind='deposit' then 1 else 2 end
  from public.project_payment_records o where o.project_payment_record_id=any(p_obligation_ids) and case when o.payment_kind='deposit' then v_deposit else v_final end>0;
  insert into public.payment_message_deliveries(project_id,obligation_id,payment_request_id,delivery_kind,occurrence_key,recipient_contact_id,recipient_email,recipient_fallback_used,principal_amount,status,scheduled_timezone)
  values(v_project_id,p_obligation_ids[1],v_request.payment_request_id,'initial_request','initial:'||v_request.payment_request_id,(v_recipient->>'contact_id')::uuid,v_recipient->>'email',(v_recipient->>'fallback_used')::boolean,v_principal,'queued',v_settings.business_timezone);
  perform public.create_payment_activity(v_project_id,'Payment request created',initcap(replace(p_kind,'_',' '))||' payment request was created.','florist',jsonb_build_object('payment_request_id',v_request.payment_request_id,'principal_amount',v_principal),v_actor);
  return jsonb_build_object('paymentRequestId',v_request.payment_request_id,'projectId',v_project_id,'replayed',false);
end; $$;
revoke all on function public.issue_payment_request(uuid[],bigint,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.issue_payment_request(uuid[],bigint,text,text,text,text,text,uuid) to service_role;

create or replace function public.claim_specific_payment_delivery(p_delivery_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_settings public.payment_collection_settings; v_local_date date; v_local_time time; v_row record; v_recipient jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  select * into v_settings from public.payment_collection_settings where settings_id;
  if not found then raise exception 'Payment collection settings are unavailable'; end if;
  v_local_date := (now() at time zone v_settings.business_timezone)::date;
  v_local_time := (now() at time zone v_settings.business_timezone)::time;
  select d.*,r.request_kind,r.token_ciphertext,r.token_iv,r.token_key_version into v_row
  from public.payment_message_deliveries d
  left join public.payment_requests r on r.payment_request_id=d.payment_request_id
  left join public.project_payment_records o on o.project_payment_record_id=d.obligation_id
  left join public.projects p on p.project_id=d.project_id
  where d.payment_message_delivery_id=p_delivery_id and d.status='queued'
    and (d.scheduled_local_date is null or d.scheduled_local_date<=v_local_date)
    and (d.delivery_kind not in ('deposit_reminder','final_reminder') or (v_settings.reminders_enabled and v_settings.collection_enabled))
    and (d.delivery_kind not in ('initial_request','deposit_reminder','final_reminder') or r.status='active')
    and (d.delivery_kind not in ('deposit_reminder','final_reminder') or (p.event_date>=v_local_date and p.status not in ('completed','canceled')))
    and (d.obligation_id is null or o.status not in ('paid','waived','canceled') or d.delivery_kind in ('receipt','adjustment_notice'))
    and (d.delivery_kind in ('initial_request','receipt','adjustment_notice') or v_local_time between v_settings.send_window_start and v_settings.send_window_end)
  for update of d skip locked;
  if not found then return null; end if;
  v_recipient:=public.resolve_project_billing_recipient(v_row.project_id);
  if nullif(v_recipient->>'email','') is null then
    update public.payment_message_deliveries set status='suppressed',suppression_reason='no_current_billing_recipient' where payment_message_delivery_id=v_row.payment_message_delivery_id;
    perform public.create_payment_activity(v_row.project_id,'Payment email suppressed','No current billing recipient had a usable email address.','schedule',jsonb_build_object('delivery_id',v_row.payment_message_delivery_id),null);
    return null;
  end if;
  update public.payment_message_deliveries set status='claimed',claimed_at=now(),recipient_contact_id=(v_recipient->>'contact_id')::uuid,recipient_email=v_recipient->>'email',recipient_fallback_used=(v_recipient->>'fallback_used')::boolean where payment_message_delivery_id=v_row.payment_message_delivery_id;
  return jsonb_build_object('deliveryId',v_row.payment_message_delivery_id,'projectId',v_row.project_id,'obligationId',v_row.obligation_id,'requestId',v_row.payment_request_id,'requestKind',v_row.request_kind,'transactionId',v_row.payment_transaction_id,'kind',v_row.delivery_kind,'recipientEmail',v_recipient->>'email','principalCents',round(v_row.principal_amount*100)::bigint,'customerFeeCents',round(v_row.customer_fee*100)::bigint,'tokenCiphertext',v_row.token_ciphertext,'tokenIv',v_row.token_iv,'tokenKeyVersion',v_row.token_key_version);
end; $$;
revoke all on function public.claim_specific_payment_delivery(uuid) from public,anon,authenticated;
grant execute on function public.claim_specific_payment_delivery(uuid) to service_role;

create or replace function public.claim_payment_deliveries(p_limit integer default 25)
returns setof jsonb language plpgsql security definer set search_path='' as $$
declare v_settings public.payment_collection_settings; v_local_date date; v_local_time time; v_row record; v_recipient jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  select * into v_settings from public.payment_collection_settings where settings_id;
  v_local_date := (now() at time zone v_settings.business_timezone)::date;
  v_local_time := (now() at time zone v_settings.business_timezone)::time;

  if v_settings.reminders_enabled and v_settings.collection_enabled then
    insert into public.payment_message_deliveries(project_id,obligation_id,payment_request_id,delivery_kind,occurrence_key,scheduled_local_date,scheduled_timezone,principal_amount,status)
    select r.project_id,ro.obligation_id,r.payment_request_id,'final_reminder',
           'final:'||r.payment_request_id||':'||v_local_date,v_local_date,v_settings.business_timezone,r.principal_amount,'queued'
    from public.payment_requests r
    join public.payment_request_obligations ro on ro.payment_request_id=r.payment_request_id
    join public.project_payment_records o on o.project_payment_record_id=ro.obligation_id and o.payment_kind='final_payment'
    join public.projects p on p.project_id=r.project_id
    where r.status='active' and o.outstanding_amount>0 and o.status not in ('waived','canceled') and o.reminder_enabled
      and (o.reminder_paused_until is null or o.reminder_paused_until<=now())
      and (p.event_date-v_local_date in (60,45,38,31) or p.event_date-v_local_date between 0 and 30)
      and not exists(
        select 1 from public.payment_intentions i
        join public.payment_request_obligations iro on iro.payment_request_id=i.payment_request_id
        where iro.obligation_id=o.project_payment_record_id and i.state='active' and i.pause_ends_at>now()
      )
      and not exists(select 1 from public.payment_message_deliveries initial where initial.payment_request_id=r.payment_request_id and initial.delivery_kind='initial_request' and (initial.created_at at time zone v_settings.business_timezone)::date=v_local_date)
    on conflict(occurrence_key,attempt_number) do nothing;

    insert into public.payment_message_deliveries(project_id,obligation_id,payment_request_id,delivery_kind,occurrence_key,scheduled_local_date,scheduled_timezone,principal_amount,status)
    select r.project_id,ro.obligation_id,r.payment_request_id,'deposit_reminder',
           'deposit:'||r.payment_request_id||':'||v_local_date,v_local_date,v_settings.business_timezone,r.principal_amount,'queued'
    from public.payment_requests r
    join public.payment_request_obligations ro on ro.payment_request_id=r.payment_request_id
    join public.project_payment_records o on o.project_payment_record_id=ro.obligation_id and o.payment_kind='deposit'
    join lateral (select min(d.accepted_at at time zone v_settings.business_timezone)::date anchor from public.payment_message_deliveries d where d.payment_request_id=r.payment_request_id and d.delivery_kind='initial_request' and d.accepted_at is not null) a on a.anchor is not null
    where r.status='active' and r.request_kind='deposit' and o.outstanding_amount>0 and o.status not in ('waived','canceled') and o.reminder_enabled
      and (o.reminder_paused_until is null or o.reminder_paused_until<=now()) and v_local_date>=a.anchor+7 and mod(v_local_date-a.anchor,7)=0
      and not exists(
        select 1 from public.payment_intentions i
        join public.payment_request_obligations iro on iro.payment_request_id=i.payment_request_id
        where iro.obligation_id=o.project_payment_record_id and i.state='active' and i.pause_ends_at>now()
      )
    on conflict(occurrence_key,attempt_number) do nothing;
  end if;

  for v_row in
    select d.*,r.request_kind,r.token_ciphertext,r.token_iv,r.token_key_version from public.payment_message_deliveries d
    left join public.payment_requests r on r.payment_request_id=d.payment_request_id
    left join public.project_payment_records o on o.project_payment_record_id=d.obligation_id
    left join public.projects p on p.project_id=d.project_id
    where d.status='queued'
      and (d.scheduled_local_date is null or d.scheduled_local_date<=v_local_date)
      and (d.delivery_kind not in ('deposit_reminder','final_reminder') or (v_settings.reminders_enabled and v_settings.collection_enabled))
      and (d.delivery_kind not in ('initial_request','deposit_reminder','final_reminder') or r.status='active')
      and (d.delivery_kind not in ('deposit_reminder','final_reminder') or (p.event_date>=v_local_date and p.status not in ('completed','canceled')))
      and (d.obligation_id is null or o.status not in ('paid','waived','canceled') or d.delivery_kind in ('receipt','adjustment_notice'))
      and (d.delivery_kind in ('initial_request','receipt','adjustment_notice') or v_local_time between v_settings.send_window_start and v_settings.send_window_end)
    order by d.created_at for update of d skip locked limit least(greatest(p_limit,1),100)
  loop
    v_recipient:=public.resolve_project_billing_recipient(v_row.project_id);
    if nullif(v_recipient->>'email','') is null then
      update public.payment_message_deliveries set status='suppressed',suppression_reason='no_current_billing_recipient' where payment_message_delivery_id=v_row.payment_message_delivery_id;
      perform public.create_payment_activity(v_row.project_id,'Payment email suppressed','No current billing recipient had a usable email address.','schedule',jsonb_build_object('delivery_id',v_row.payment_message_delivery_id),null);
    else
      update public.payment_message_deliveries set status='claimed',claimed_at=now(),recipient_contact_id=(v_recipient->>'contact_id')::uuid,recipient_email=v_recipient->>'email',recipient_fallback_used=(v_recipient->>'fallback_used')::boolean where payment_message_delivery_id=v_row.payment_message_delivery_id;
      return next jsonb_build_object('deliveryId',v_row.payment_message_delivery_id,'projectId',v_row.project_id,'obligationId',v_row.obligation_id,'requestId',v_row.payment_request_id,'requestKind',v_row.request_kind,'transactionId',v_row.payment_transaction_id,'kind',v_row.delivery_kind,'recipientEmail',v_recipient->>'email','principalCents',round(v_row.principal_amount*100)::bigint,'customerFeeCents',round(v_row.customer_fee*100)::bigint,'tokenCiphertext',v_row.token_ciphertext,'tokenIv',v_row.token_iv,'tokenKeyVersion',v_row.token_key_version);
    end if;
  end loop;
  return;
end; $$;
revoke all on function public.claim_payment_deliveries(integer) from public,anon,authenticated;
grant execute on function public.claim_payment_deliveries(integer) to service_role;

create or replace function public.activate_project_final_collection(p_project_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_project public.projects; v_deposit uuid; v_final uuid; v_deposit_due numeric(12,2); v_final_due numeric(12,2);
v_deposit_covered boolean:=false; v_final_covered boolean:=false;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  perform public.refresh_project_payment_statuses(p_project_id);
  select * into v_project from public.projects where project_id=p_project_id for update;
  if not found or v_project.event_date is null or v_project.event_date>current_date+60 or v_project.status in ('completed','canceled') then return jsonb_build_object('eligible',false); end if;
  select (array_agg(project_payment_record_id order by created_at,project_payment_record_id) filter(where payment_kind='deposit' and outstanding_amount>0 and status not in ('waived','canceled')))[1],
         (array_agg(project_payment_record_id order by created_at,project_payment_record_id) filter(where payment_kind='final_payment' and outstanding_amount>0 and status not in ('waived','canceled')))[1],
         coalesce(sum(outstanding_amount) filter(where payment_kind='deposit' and status not in ('waived','canceled')),0),
         coalesce(sum(outstanding_amount) filter(where payment_kind='final_payment' and status not in ('waived','canceled')),0)
  into v_deposit,v_final,v_deposit_due,v_final_due from public.project_payment_records where project_id=p_project_id;
  if v_deposit_due+v_final_due<=0 then return jsonb_build_object('eligible',false); end if;
  select exists (
    select 1 from public.payment_requests r
    where r.project_id=p_project_id and r.status='active' and r.request_kind='installment'
      and r.installment_obligation_id=v_deposit and r.principal_amount=v_deposit_due
  ), exists (
    select 1 from public.payment_requests r
    where r.project_id=p_project_id and r.status='active' and r.request_kind='installment'
      and r.installment_obligation_id=v_final and r.principal_amount=v_final_due
  ) into v_deposit_covered,v_final_covered;
  if v_deposit_covered then v_deposit_due:=0; end if;
  if v_final_covered then v_final_due:=0; end if;
  if v_deposit_due+v_final_due<=0 then
    return jsonb_build_object('eligible',false,'reason','installment_requests_active');
  end if;
  return jsonb_build_object('eligible',true,'projectId',p_project_id,'kind',case when v_deposit_due>0 and v_final_due>0 then 'consolidated' when v_deposit_due>0 then 'deposit' else 'final_payment' end,
    'obligationIds',case when v_deposit_due>0 and v_final_due>0 then jsonb_build_array(v_deposit,v_final) when v_deposit_due>0 then jsonb_build_array(v_deposit) else jsonb_build_array(v_final) end,
    'principalCents',round((v_deposit_due+v_final_due)*100)::bigint);
end; $$;
revoke all on function public.activate_project_final_collection(uuid) from public,anon,authenticated;
grant execute on function public.activate_project_final_collection(uuid) to service_role;

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
   'methods',to_jsonb(array_remove(array[case when s.collection_enabled and s.stripe_enabled then 'stripe_card' end,case when s.collection_enabled and s.venmo_enabled and nullif(btrim(s.venmo_business_target),'') is not null then 'venmo' end,'cash','check'],null)),
   'activeAttempt',case when a.status in ('creating','active','processing') then a.payment_checkout_attempt_id end,
   'intention',case when i.payment_intention_id is not null then jsonb_build_object('method',i.method,'pauseEndsAt',i.pause_ends_at) end,
   'instructionSnapshots',jsonb_build_object('cash',r.cash_instructions,'check',r.check_instructions));
end; $$;
revoke all on function public.resolve_payment_request_projection(text,uuid) from public,anon,authenticated;
grant execute on function public.resolve_payment_request_projection(text,uuid) to service_role;

create or replace function public.reserve_payment_checkout(p_token_digest text,p_method text,p_command_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.payment_requests; a public.payment_checkout_attempts; s public.payment_collection_settings; begin
 if auth.role()<>'service_role' then raise exception 'service role required'; end if;
 if p_method <> 'stripe_card' then raise exception 'Unsupported checkout method'; end if;
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
 if not s.collection_enabled or not s.stripe_enabled then raise exception 'Provider unavailable'; end if;
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

create or replace function public.record_payment_intention(p_token_digest text,p_method text,p_command_key text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare r public.payment_requests;i public.payment_intentions;s public.payment_collection_settings;begin
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
   or nullif(btrim(s.venmo_business_target),'') is null
 ) then raise exception 'Provider unavailable'; end if;
 if exists(select 1 from public.payment_checkout_attempts where payment_request_id=r.payment_request_id and status in ('creating','active','processing')) then raise exception 'PAYMENT_METHOD_LOCKED'; end if;
 select * into i from public.payment_intentions where payment_request_id=r.payment_request_id and state='active' and pause_ends_at>now();
 if found then return to_jsonb(i); end if;
 update public.payment_intentions set state='expired' where payment_request_id=r.payment_request_id and state='active';
 insert into public.payment_intentions(payment_request_id,project_id,method,instruction_snapshot,reference,pause_ends_at)
 values(r.payment_request_id,r.project_id,p_method,case p_method when 'cash' then r.cash_instructions when 'check' then r.check_instructions else s.venmo_business_target end,'BB-'||upper(substr(replace(r.payment_request_id::text,'-',''),1,10)),now()+interval '7 days') returning * into i;
 perform public.create_payment_activity(r.project_id,'Payment intention recorded','Customer plans to pay by '||replace(p_method,'_',' ')||'.','customer',jsonb_build_object('payment_intention_id',i.payment_intention_id,'method',p_method,'pause_ends_at',i.pause_ends_at),null); return to_jsonb(i)||jsonb_build_object('amount_cents',round(r.principal_amount*100)::bigint);
end; $$;
revoke all on function public.record_payment_intention(text,text,text) from public,anon,authenticated;
grant execute on function public.record_payment_intention(text,text,text) to service_role;

create or replace function public.reconcile_payment_event(p_provider_event_id uuid,p_facts jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.payment_provider_events;a public.payment_checkout_attempts;r public.payment_requests;t public.payment_transactions;original public.payment_transactions;
v_kind text:=coalesce(p_facts->>'kind','receipt');v_status text:=coalesce(p_facts->>'status','confirmed');v_amount numeric(12,2):=coalesce((p_facts->>'principalCents')::bigint,0)/100.0;
v_remaining numeric(12,2);o public.project_payment_records;x record;v_alloc numeric(12,2);v_seq int:=0;v_project_outstanding numeric(12,2);v_effect_key text;
v_candidate_count integer:=0;v_original_id uuid;v_evidence_source text;
begin
 if auth.role()<>'service_role' then raise exception 'service role required'; end if;
 select * into e from public.payment_provider_events where payment_provider_event_id=p_provider_event_id for update;
 if not found then raise exception 'Provider event is unavailable'; end if;
 if e.processing_state in ('processed','duplicate') then return jsonb_build_object('state','duplicate','transactionId',e.payment_transaction_id); end if;
 select * into a from public.payment_checkout_attempts where payment_checkout_attempt_id=coalesce((p_facts->>'attemptId')::uuid,e.payment_checkout_attempt_id) for update;
 if not found then update public.payment_provider_events set processing_state='unmatched',processed_at=now() where payment_provider_event_id=e.payment_provider_event_id; raise exception 'Payment attempt is unmatched'; end if;
 select * into r from public.payment_requests where payment_request_id=a.payment_request_id for update;
 if upper(coalesce(p_facts->>'currency',''))<>'USD' or v_amount<=0 or (v_kind='receipt' and v_amount<>a.principal_amount) or coalesce(p_facts->>'merchantId','')<>coalesce(p_facts->>'expectedMerchantId',p_facts->>'merchantId','') then raise exception 'Provider amount, currency, or merchant mismatch'; end if;
 v_effect_key:=e.provider||':'||coalesce(e.provider_object_id,e.provider_event_id)||':'||v_kind;
 if exists(select 1 from public.payment_transactions where provider_reference=v_effect_key) then update public.payment_provider_events set processing_state='duplicate',processed_at=now() where payment_provider_event_id=e.payment_provider_event_id; return jsonb_build_object('state','duplicate'); end if;
 insert into public.payment_transactions(payment_reference,project_id,payment_request_id,payment_checkout_attempt_id,kind,status,principal_amount,customer_fee,merchant_fee,method,source,occurred_at,actor_type,provider_reference,customer_notice_policy,customer_notice_state,payload_digest,normalized_facts)
 values(public.generate_payment_reference(),a.project_id,r.payment_request_id,a.payment_checkout_attempt_id,v_kind,v_status,case when v_kind in ('refund','reversal','void') then -v_amount else v_amount end,0,(p_facts->>'merchantFeeCents')::bigint/100.0,a.method,case when e.provider='stripe' then 'stripe' else 'paypal' end,e.event_occurred_at,'provider',v_effect_key,case when v_kind='receipt' and v_status='confirmed' then 'required' when v_kind in ('refund','reversal') and v_status in ('confirmed','resolved') then 'required' when v_kind in ('dispute','correction') then 'optional' else 'none' end,'queued',e.payload_digest,p_facts) returning * into t;
 if v_kind='receipt' and v_status='confirmed' then
   perform 1
   from public.project_payment_records
   where project_id = a.project_id
     and status not in ('waived', 'canceled')
   order by case payment_kind when 'deposit' then 1 else 2 end,
            project_payment_record_id
   for update;
   select coalesce(sum(outstanding_amount), 0)
   into v_project_outstanding
   from public.project_payment_records
   where project_id = a.project_id
     and status not in ('waived', 'canceled');
   if r.request_kind='installment' then
     select * into o from public.project_payment_records
     where project_payment_record_id=r.installment_obligation_id and project_id=a.project_id
     for update;
     if not found then raise exception 'Installment obligation is unavailable'; end if;
     v_alloc:=least(v_amount,greatest(o.outstanding_amount,0));
     if v_alloc>0 then
       insert into public.payment_transaction_allocations(payment_transaction_id,obligation_id,allocated_principal,sequence)
       values(t.payment_transaction_id,o.project_payment_record_id,v_alloc,1);
     end if;
     if v_amount>v_alloc then
       insert into public.payment_exceptions(project_id,obligation_id,payment_request_id,payment_transaction_id,payment_provider_event_id,exception_type,urgency,amount,summary)
       values(a.project_id,o.project_payment_record_id,r.payment_request_id,t.payment_transaction_id,e.payment_provider_event_id,'overpayment','urgent',v_amount-v_alloc,'Provider payment exceeds the selected installment balance');
     end if;
   else
     v_remaining:=least(v_amount,v_project_outstanding);
     for o in select * from public.project_payment_records where project_id=a.project_id and status not in ('waived','canceled') order by case payment_kind when 'deposit' then 1 else 2 end for update loop exit when v_remaining<=0;v_alloc:=least(v_remaining,o.outstanding_amount);if v_alloc>0 then v_seq:=v_seq+1;insert into public.payment_transaction_allocations(payment_transaction_id,obligation_id,allocated_principal,sequence) values(t.payment_transaction_id,o.project_payment_record_id,v_alloc,v_seq);v_remaining:=v_remaining-v_alloc;end if;end loop;
     if v_amount>v_project_outstanding then insert into public.payment_exceptions(project_id,payment_transaction_id,payment_provider_event_id,exception_type,urgency,amount,summary) values(a.project_id,t.payment_transaction_id,e.payment_provider_event_id,'overpayment','urgent',v_amount-v_project_outstanding,'Provider payment exceeds the complete project balance');end if;
   end if;
   update public.payment_checkout_attempts set status='paid',resolved_at=now(),last_verified_state=e.event_type where payment_checkout_attempt_id=a.payment_checkout_attempt_id;
   update public.payment_requests set status='fulfilled',fulfilled_at=now(),invalidated_at=now(),token_ciphertext=null,token_iv=null,token_key_version=null where payment_request_id=r.payment_request_id;
   update public.payment_intentions set state='fulfilled',fulfilled_at=now() where payment_request_id=r.payment_request_id and state='active';
 elsif v_kind<>'receipt' and v_status in ('confirmed','resolved') then
   select count(*), (array_agg(candidate.payment_transaction_id order by candidate.occurred_at))[1]
   into v_candidate_count, v_original_id
   from public.payment_transactions candidate
   where candidate.project_id=a.project_id
     and candidate.kind='receipt'
     and candidate.status in ('confirmed','resolved')
     and (
       (nullif(p_facts->>'originalTransactionId','') is not null and candidate.payment_transaction_id=(p_facts->>'originalTransactionId')::uuid)
       or (nullif(p_facts->>'originalProviderReference','') is not null and candidate.provider_reference=p_facts->>'originalProviderReference')
       or (
         nullif(p_facts->>'originalTransactionId','') is null
         and nullif(p_facts->>'originalProviderReference','') is null
         and candidate.payment_checkout_attempt_id=a.payment_checkout_attempt_id
       )
     );
   if v_candidate_count=1 then
     select * into original from public.payment_transactions where payment_transaction_id=v_original_id;
     v_evidence_source:=case
       when nullif(p_facts->>'originalTransactionId','') is not null then 'provider_correlation'
       when nullif(p_facts->>'originalProviderReference','') is not null then 'provider_correlation'
       else 'checkout_correlation'
     end;
     insert into public.payment_transaction_relationships(project_id,parent_transaction_id,child_transaction_id,relationship_type,evidence_source)
     values(a.project_id,original.payment_transaction_id,t.payment_transaction_id,'adjusts',v_evidence_source);
     v_remaining:=v_amount;
     for x in select * from public.payment_transaction_allocations pa where pa.payment_transaction_id=original.payment_transaction_id order by pa.sequence desc loop
       exit when v_remaining<=0;v_alloc:=least(abs(x.allocated_principal),v_remaining);v_seq:=v_seq+1;
       insert into public.payment_transaction_allocations(payment_transaction_id,obligation_id,allocated_principal,sequence) values(t.payment_transaction_id,x.obligation_id,-v_alloc,v_seq);v_remaining:=v_remaining-v_alloc;
     end loop;
     insert into public.payment_exceptions(project_id,payment_transaction_id,payment_provider_event_id,exception_type,urgency,amount,summary)
     values(a.project_id,t.payment_transaction_id,e.payment_provider_event_id,'adjustment_reopened_balance','urgent',v_amount,'Provider adjustment reopened a project balance');
   else
     insert into public.payment_exceptions(project_id,payment_transaction_id,payment_provider_event_id,exception_type,urgency,amount,summary,redacted_detail)
     values(a.project_id,t.payment_transaction_id,e.payment_provider_event_id,'reconciliation_failure','urgent',v_amount,'Provider adjustment requires receipt matching','The original receipt could not be identified from exact provider or checkout evidence.');
   end if;
 else
   update public.payment_checkout_attempts set status=case when v_status='pending' then 'processing' else 'failed' end,resolved_at=case when v_status='failed' then now() else null end,last_verified_state=e.event_type where payment_checkout_attempt_id=a.payment_checkout_attempt_id;
 end if;
 perform public.recompute_project_payment_obligations(a.project_id);
 update public.payment_provider_events set processing_state='processed',payment_checkout_attempt_id=a.payment_checkout_attempt_id,payment_transaction_id=t.payment_transaction_id,processed_at=now() where payment_provider_event_id=e.payment_provider_event_id;
 perform public.create_payment_activity(a.project_id,case when v_kind='receipt' then 'Payment confirmed' else 'Payment adjusted' end,initcap(replace(v_kind,'_',' '))||' '||t.payment_reference||' was recorded.','provider',jsonb_build_object('payment_reference',t.payment_reference,'method',a.method,'principal_amount',t.principal_amount,'provider_event_id',e.payment_provider_event_id),null);
 if t.customer_notice_policy='required' then insert into public.payment_message_deliveries(project_id,payment_request_id,payment_transaction_id,delivery_kind,occurrence_key,principal_amount,status) values(a.project_id,r.payment_request_id,t.payment_transaction_id,case when v_kind='receipt' then 'receipt' else 'adjustment_notice' end,case when v_kind='receipt' then 'receipt:' else 'adjustment:' end||t.payment_transaction_id,abs(t.principal_amount),'queued');end if;
 return jsonb_build_object('state','processed','transactionId',t.payment_transaction_id,'paymentReference',t.payment_reference);
exception when others then update public.payment_provider_events set processing_state='failed',processing_error=left(sqlerrm,300),processed_at=now() where payment_provider_event_id=p_provider_event_id;return jsonb_build_object('state','failed','error','reconciliation_failed');end; $$;
revoke all on function public.reconcile_payment_event(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.reconcile_payment_event(uuid,jsonb) to service_role;
