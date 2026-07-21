create or replace function public.retry_payment_delivery(p_delivery_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_source public.payment_message_deliveries; v_retry public.payment_message_deliveries; begin
 if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'Retry reason is required'; end if;
 select * into v_source from public.payment_message_deliveries where payment_message_delivery_id=p_delivery_id and status in ('temporary_failed','permanent_failed','delivery_unknown') for update;
 if not found then raise exception 'Delivery is not retryable'; end if;
 insert into public.payment_message_deliveries(project_id,obligation_id,payment_request_id,payment_transaction_id,delivery_kind,occurrence_key,scheduled_local_date,scheduled_timezone,recipient_contact_id,recipient_email,recipient_fallback_used,principal_amount,customer_fee,status,attempt_number,retry_of_delivery_id)
 values(v_source.project_id,v_source.obligation_id,v_source.payment_request_id,v_source.payment_transaction_id,v_source.delivery_kind,v_source.occurrence_key,v_source.scheduled_local_date,v_source.scheduled_timezone,v_source.recipient_contact_id,v_source.recipient_email,v_source.recipient_fallback_used,v_source.principal_amount,v_source.customer_fee,'queued',v_source.attempt_number+1,v_source.payment_message_delivery_id) returning * into v_retry;
 perform public.create_payment_activity(v_source.project_id,'Payment email retry queued','A florist queued an explicit retry after a failed or unknown delivery.','florist',jsonb_build_object('delivery_id',v_retry.payment_message_delivery_id,'reason',p_reason),auth.uid());
 return to_jsonb(v_retry);
end; $$;
revoke all on function public.retry_payment_delivery(uuid,text) from public,anon;
grant execute on function public.retry_payment_delivery(uuid,text) to authenticated;
