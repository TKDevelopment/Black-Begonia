-- A florist-selected initial payment request is an immediate transactional
-- message. Only automated reminders remain constrained to the send window.
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
    where r.status='active' and o.outstanding_amount>0 and o.status not in ('waived','canceled')
      and (p.event_date-v_local_date in (60,45,38,31) or p.event_date-v_local_date between 0 and 30)
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
      and not exists(select 1 from public.payment_intentions i where i.obligation_id=o.project_payment_record_id and i.state='active' and i.pause_ends_at>now())
    on conflict(occurrence_key,attempt_number) do nothing;
  end if;

  for v_row in
    select d.*,r.token_ciphertext,r.token_iv,r.token_key_version from public.payment_message_deliveries d
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
      return next jsonb_build_object('deliveryId',v_row.payment_message_delivery_id,'projectId',v_row.project_id,'obligationId',v_row.obligation_id,'requestId',v_row.payment_request_id,'transactionId',v_row.payment_transaction_id,'kind',v_row.delivery_kind,'recipientEmail',v_recipient->>'email','principalCents',round(v_row.principal_amount*100)::bigint,'customerFeeCents',round(v_row.customer_fee*100)::bigint,'tokenCiphertext',v_row.token_ciphertext,'tokenIv',v_row.token_iv,'tokenKeyVersion',v_row.token_key_version);
    end if;
  end loop;
  return;
end; $$;
revoke all on function public.claim_payment_deliveries(integer) from public,anon,authenticated;
grant execute on function public.claim_payment_deliveries(integer) to service_role;
