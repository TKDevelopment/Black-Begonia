create or replace function public.record_manual_payment(
  p_project_id uuid, p_obligation_id uuid, p_amount_cents bigint, p_method text,
  p_received_at timestamptz, p_note text, p_suspected_reference text default null,
  p_override_reason text default null, p_command_key uuid default gen_random_uuid(),
  p_confirm_overpayment boolean default false
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_existing public.payment_transactions; v_duplicate public.payment_transactions;
v_transaction public.payment_transactions; v_amount numeric(12,2):=p_amount_cents/100.0; v_remaining numeric(12,2); v_project_outstanding numeric(12,2);
v_obligation public.project_payment_records; v_row public.project_payment_records; v_alloc numeric(12,2); v_sequence int:=0; v_overpayment numeric(12,2):=0;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
  if p_amount_cents<=0 then raise exception 'Amount must be greater than zero'; end if;
  if p_received_at is null or p_received_at>now()+interval '5 minutes' then raise exception 'Receipt date is invalid'; end if;
  if p_method not in ('venmo','check','cash','other','stripe') then raise exception 'Unsupported payment method'; end if;
  select * into v_existing from public.payment_transactions where command_key=p_command_key;
  if found then return jsonb_build_object('state','recorded','transaction',to_jsonb(v_existing),'replayed',true); end if;
  perform 1 from public.project_payment_records where project_id=p_project_id and status not in ('canceled','waived') order by case payment_kind when 'deposit' then 1 else 2 end,project_payment_record_id for update;
  select * into v_obligation from public.project_payment_records where project_payment_record_id=p_obligation_id and project_id=p_project_id and status not in ('canceled','waived');
  if not found then raise exception 'Payment obligation is unavailable'; end if;
  select * into v_duplicate from public.payment_transactions where project_id=p_project_id and status='confirmed' and kind='receipt' and principal_amount=v_amount and method=p_method and occurred_at between p_received_at-interval '1 day' and p_received_at+interval '1 day' order by occurred_at desc limit 1;
  if found and (nullif(btrim(p_override_reason),'') is null or p_suspected_reference is distinct from v_duplicate.payment_reference) then
    return jsonb_build_object('state','duplicate_warning','suspectedReference',v_duplicate.payment_reference);
  end if;
  select coalesce(sum(outstanding_amount),0) into v_project_outstanding from public.project_payment_records where project_id=p_project_id and status not in ('canceled','waived');
  if v_amount>v_project_outstanding and not p_confirm_overpayment then return jsonb_build_object('state','overpayment_warning','overpaymentAmount',v_amount-v_project_outstanding); end if;
  insert into public.payment_transactions(payment_reference,project_id,kind,status,principal_amount,method,source,occurred_at,actor_type,actor_id,command_key,duplicate_override,duplicate_override_reason,suspected_reference,customer_notice_policy,customer_notice_state,note)
  values(public.generate_payment_reference(),p_project_id,'receipt','confirmed',v_amount,p_method,'manual',p_received_at,'florist',v_actor,p_command_key,v_duplicate.payment_transaction_id is not null,p_override_reason,p_suspected_reference,'required','queued',nullif(btrim(p_note),'')) returning * into v_transaction;
  v_remaining:=least(v_amount,v_project_outstanding);
  for v_row in select * from public.project_payment_records where project_id=p_project_id and status not in ('canceled','waived') order by case payment_kind when 'deposit' then 1 else 2 end for update loop
    exit when v_remaining<=0; v_alloc:=least(v_remaining,v_row.outstanding_amount);
    if v_alloc>0 then v_sequence:=v_sequence+1; insert into public.payment_transaction_allocations(payment_transaction_id,obligation_id,allocated_principal,sequence) values(v_transaction.payment_transaction_id,v_row.project_payment_record_id,v_alloc,v_sequence); v_remaining:=v_remaining-v_alloc; end if;
  end loop;
  perform public.recompute_project_payment_obligations(p_project_id);
  select greatest(v_amount-v_project_outstanding,0) into v_overpayment;
  if v_overpayment>0 then insert into public.payment_exceptions(project_id,payment_transaction_id,exception_type,urgency,amount,summary) values(p_project_id,v_transaction.payment_transaction_id,'overpayment','urgent',v_overpayment,'Payment exceeds the complete project balance'); end if;
  update public.projects p set status=case
      when p.status='awaiting_deposit' and not exists(select 1 from public.project_payment_records o where o.project_id=p.project_id and o.payment_kind='deposit' and o.outstanding_amount>0 and o.status not in ('waived','canceled'))
        then case when exists(select 1 from public.project_payment_records o where o.project_id=p.project_id and o.payment_kind='final_payment' and o.outstanding_amount>0 and o.status not in ('waived','canceled')) then 'booked'::public.project_status else 'final_prep'::public.project_status end
      when p.status='awaiting_final_payment' and not exists(select 1 from public.project_payment_records o where o.project_id=p.project_id and o.outstanding_amount>0 and o.status not in ('waived','canceled')) then 'final_prep'::public.project_status
      else p.status end,
    booked_at=case when p.status='awaiting_deposit' and not exists(select 1 from public.project_payment_records o where o.project_id=p.project_id and o.payment_kind='deposit' and o.outstanding_amount>0 and o.status not in ('waived','canceled')) then coalesce(p.booked_at,now()) else p.booked_at end, updated_at=now()
  where p.project_id=p_project_id and p.status not in ('completed','canceled');
  perform public.create_payment_activity(p_project_id,'Payment recorded',initcap(replace(v_obligation.payment_kind,'_',' '))||' payment '||v_transaction.payment_reference||' was recorded.','florist',jsonb_build_object('payment_reference',v_transaction.payment_reference,'payment_kind',v_obligation.payment_kind,'method',p_method,'principal_amount',v_amount),v_actor);
  insert into public.payment_message_deliveries(project_id,obligation_id,payment_transaction_id,delivery_kind,occurrence_key,principal_amount,status)
  values(p_project_id,p_obligation_id,v_transaction.payment_transaction_id,'receipt','receipt:'||v_transaction.payment_transaction_id,v_amount,'queued');
  return jsonb_build_object('state','recorded','transaction',to_jsonb(v_transaction),'overpaymentAmount',v_overpayment,'replayed',false);
end; $$;
revoke all on function public.record_manual_payment(uuid,uuid,bigint,text,timestamptz,text,text,text,uuid,boolean) from public,anon;
grant execute on function public.record_manual_payment(uuid,uuid,bigint,text,timestamptz,text,text,text,uuid,boolean) to authenticated;
