create or replace function public.claim_specific_payment_delivery(p_delivery_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_settings public.payment_collection_settings; v_local_date date; v_local_time time; v_row record; v_recipient jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  select * into v_settings from public.payment_collection_settings where settings_id;
  if not found then raise exception 'Payment collection settings are unavailable'; end if;
  v_local_date := (now() at time zone v_settings.business_timezone)::date;
  v_local_time := (now() at time zone v_settings.business_timezone)::time;
  select d.*,r.token_ciphertext,r.token_iv,r.token_key_version into v_row
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
  return jsonb_build_object('deliveryId',v_row.payment_message_delivery_id,'projectId',v_row.project_id,'obligationId',v_row.obligation_id,'requestId',v_row.payment_request_id,'transactionId',v_row.payment_transaction_id,'kind',v_row.delivery_kind,'recipientEmail',v_recipient->>'email','principalCents',round(v_row.principal_amount*100)::bigint,'customerFeeCents',round(v_row.customer_fee*100)::bigint,'tokenCiphertext',v_row.token_ciphertext,'tokenIv',v_row.token_iv,'tokenKeyVersion',v_row.token_key_version);
end; $$;
revoke all on function public.claim_specific_payment_delivery(uuid) from public,anon,authenticated;
grant execute on function public.claim_specific_payment_delivery(uuid) to service_role;
