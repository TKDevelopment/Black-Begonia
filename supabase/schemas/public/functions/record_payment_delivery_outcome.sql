create or replace function public.record_payment_delivery_outcome(p_delivery_id uuid,p_status text,p_mailgun_message_id text,p_failure_class text default null,p_redacted_error text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_delivery public.payment_message_deliveries;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  if p_status not in ('accepted','temporary_failed','permanent_failed','delivery_unknown') then raise exception 'Invalid delivery outcome'; end if;
  update public.payment_message_deliveries set status=p_status,mailgun_message_id=nullif(p_mailgun_message_id,''),sent_at=now(),accepted_at=case when p_status='accepted' then now() else accepted_at end,failed_at=case when p_status in ('temporary_failed','permanent_failed') then now() else failed_at end,failure_class=p_failure_class,redacted_error=left(p_redacted_error,200)
  where payment_message_delivery_id=p_delivery_id and status='claimed' returning * into v_delivery;
  if not found then return; end if;
  if v_delivery.payment_request_id is not null and v_delivery.delivery_kind='initial_request' then update public.payment_requests set initial_delivery_state=p_status where payment_request_id=v_delivery.payment_request_id; end if;
  perform public.create_payment_activity(v_delivery.project_id,case when p_status='accepted' then 'Payment email accepted' else 'Payment email needs attention' end,case when p_status='accepted' then 'The payment email provider accepted the message.' else 'A payment email was not confirmed as accepted.' end,'schedule',jsonb_strip_nulls(jsonb_build_object('delivery_id',v_delivery.payment_message_delivery_id,'delivery_kind',v_delivery.delivery_kind,'outcome',p_status,'failure_class',p_failure_class,'redacted_error',left(p_redacted_error,200))),null);
end; $$;
revoke all on function public.record_payment_delivery_outcome(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_payment_delivery_outcome(uuid,text,text,text,text) to service_role;
