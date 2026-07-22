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
   v_remaining:=least(v_amount,v_project_outstanding);
   for o in select * from public.project_payment_records where project_id=a.project_id and status not in ('waived','canceled') order by case payment_kind when 'deposit' then 1 else 2 end for update loop exit when v_remaining<=0;v_alloc:=least(v_remaining,o.outstanding_amount);if v_alloc>0 then v_seq:=v_seq+1;insert into public.payment_transaction_allocations(payment_transaction_id,obligation_id,allocated_principal,sequence) values(t.payment_transaction_id,o.project_payment_record_id,v_alloc,v_seq);v_remaining:=v_remaining-v_alloc;end if;end loop;
   if v_amount>v_project_outstanding then insert into public.payment_exceptions(project_id,payment_transaction_id,payment_provider_event_id,exception_type,urgency,amount,summary) values(a.project_id,t.payment_transaction_id,e.payment_provider_event_id,'overpayment','urgent',v_amount-v_project_outstanding,'Provider payment exceeds the complete project balance');end if;
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
