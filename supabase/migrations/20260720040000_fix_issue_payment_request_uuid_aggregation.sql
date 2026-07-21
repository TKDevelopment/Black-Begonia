-- PostgreSQL does not provide min(uuid). Replace the project-id aggregate used
-- while issuing payment requests with a UUID-safe array selection. The
-- existing cross-project validation immediately below remains authoritative.
create or replace function public.issue_payment_request(
  p_obligation_ids uuid[], p_principal_cents bigint, p_kind text,
  p_token_digest text, p_token_ciphertext text, p_token_iv text,
  p_token_key_version text, p_command_key uuid
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_request public.payment_requests; v_existing public.payment_requests;
v_project_id uuid; v_outstanding numeric(12,2); v_principal numeric(12,2):=p_principal_cents/100.0;
v_deposit numeric(12,2); v_final numeric(12,2); v_recipient jsonb; v_settings public.payment_collection_settings;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  select * into v_existing from public.payment_requests where command_key=p_command_key;
  if found then return jsonb_build_object('paymentRequestId',v_existing.payment_request_id,'projectId',v_existing.project_id,'replayed',true); end if;
  if cardinality(p_obligation_ids) not between 1 and 2 or p_kind not in ('deposit','final_payment','consolidated') or p_principal_cents<=0 then raise exception 'Invalid request'; end if;
  perform 1 from public.project_payment_records where project_payment_record_id=any(p_obligation_ids) order by case payment_kind when 'deposit' then 1 else 2 end for update;
  select (array_agg(project_id))[1],sum(outstanding_amount),sum(case when payment_kind='deposit' then least(outstanding_amount,v_principal) else 0 end),sum(case when payment_kind='final_payment' then outstanding_amount else 0 end)
  into v_project_id,v_outstanding,v_deposit,v_final from public.project_payment_records where project_payment_record_id=any(p_obligation_ids) and status not in ('paid','waived','canceled');
  if v_project_id is null or exists(select 1 from public.project_payment_records where project_payment_record_id=any(p_obligation_ids) and project_id<>v_project_id) or v_principal>v_outstanding then raise exception 'Obligations or amount are unavailable'; end if;
  if p_kind='deposit' then v_deposit:=v_principal;v_final:=0; elsif p_kind='final_payment' then v_final:=v_principal;v_deposit:=0; else v_deposit:=least(coalesce(v_deposit,0),v_principal);v_final:=v_principal-v_deposit; end if;
  select * into v_settings from public.payment_collection_settings where settings_id;
  v_recipient:=public.resolve_project_billing_recipient(v_project_id);
  if nullif(v_recipient->>'email','') is null then raise exception 'No eligible payment recipient'; end if;
  select * into v_existing from public.payment_requests where project_id=v_project_id and status='active' and (p_kind='consolidated' or request_kind in (p_kind,'consolidated')) order by created_at desc limit 1 for update;
  update public.payment_requests set status='superseded',invalidated_at=now(),token_ciphertext=null,token_iv=null,token_key_version=null
  where project_id=v_project_id and status='active' and (p_kind='consolidated' or request_kind in (p_kind,'consolidated'));
  insert into public.payment_requests(project_id,request_kind,status,token_digest,token_ciphertext,token_iv,token_key_version,principal_amount,deposit_amount,final_amount,proposal_snapshot_id,proposal_version,original_recipient_contact_id,original_recipient_email,recipient_fallback_used,cash_instructions,check_instructions,supersedes_request_id,initial_delivery_state,command_key,activated_at,created_by)
  select v_project_id,p_kind,'active',p_token_digest,p_token_ciphertext,p_token_iv,p_token_key_version,v_principal,v_deposit,v_final,p.active_proposal_invoice_snapshot_id,s.version,(v_recipient->>'contact_id')::uuid,v_recipient->>'email',(v_recipient->>'fallback_used')::boolean,coalesce(v_settings.cash_instructions,''),coalesce(v_settings.check_instructions,''),v_existing.payment_request_id,'queued',p_command_key,now(),v_actor
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
