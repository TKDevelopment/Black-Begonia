create or replace function public.record_manual_payment(
  p_project_id uuid,
  p_obligation_id uuid,
  p_amount_cents bigint,
  p_method text,
  p_received_at timestamptz,
  p_note text,
  p_suspected_reference text default null,
  p_override_reason text default null,
  p_command_key uuid default gen_random_uuid(),
  p_confirm_overpayment boolean default false,
  p_confirm_spillover boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_command_key uuid := coalesce(p_command_key, gen_random_uuid());
  v_existing public.payment_transactions;
  v_duplicate public.payment_transactions;
  v_transaction public.payment_transactions;
  v_selected public.project_payment_records;
  v_other public.project_payment_records;
  v_amount numeric(12,2) := p_amount_cents / 100.0;
  v_selected_alloc numeric(12,2) := 0;
  v_other_alloc numeric(12,2) := 0;
  v_overpayment numeric(12,2) := 0;
  v_proposal jsonb := '[]'::jsonb;
  v_allocations jsonb := '[]'::jsonb;
  v_affected_ids jsonb := '[]'::jsonb;
begin
  if not public.is_internal_crm_user() then
    raise exception 'not authorized';
  end if;
  if p_amount_cents <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;
  if p_received_at is null or p_received_at > now() + interval '5 minutes' then
    raise exception 'Receipt date is invalid';
  end if;
  if p_method not in ('venmo','check','cash','other','stripe') then
    raise exception 'Unsupported payment method';
  end if;

  select * into v_existing
  from public.payment_transactions
  where command_key = v_command_key;
  if found then
    select coalesce(jsonb_agg(jsonb_build_object(
      'obligationId', a.obligation_id,
      'paymentKind', o.payment_kind,
      'amount', a.allocated_principal
    ) order by a.sequence), '[]'::jsonb),
    coalesce(jsonb_agg(to_jsonb(a.obligation_id) order by a.sequence), '[]'::jsonb)
    into v_allocations, v_affected_ids
    from public.payment_transaction_allocations a
    join public.project_payment_records o on o.project_payment_record_id = a.obligation_id
    where a.payment_transaction_id = v_existing.payment_transaction_id;

    return jsonb_build_object(
      'state', 'recorded',
      'replayed', true,
      'transactionId', v_existing.payment_transaction_id,
      'paymentReference', v_existing.payment_reference,
      'allocations', v_allocations,
      'affectedObligationIds', v_affected_ids,
      'overpaymentAmount', greatest(v_existing.principal_amount - coalesce((select sum(a.allocated_principal) from public.payment_transaction_allocations a where a.payment_transaction_id = v_existing.payment_transaction_id), 0), 0)
    );
  end if;

  perform 1
  from public.project_payment_records
  where project_id = p_project_id
    and status not in ('canceled','waived')
  order by case payment_kind when 'deposit' then 1 else 2 end, project_payment_record_id
  for update;

  select * into v_selected
  from public.project_payment_records
  where project_payment_record_id = p_obligation_id
    and project_id = p_project_id
    and status not in ('paid','overpaid','canceled','waived')
    and target_amount > 0
    and outstanding_amount > 0;
  if not found then
    raise exception 'Payment installment is unavailable';
  end if;

  select * into v_duplicate
  from public.payment_transactions
  where project_id = p_project_id
    and status = 'confirmed'
    and kind = 'receipt'
    and principal_amount = v_amount
    and method = p_method
    and occurred_at between p_received_at - interval '1 day' and p_received_at + interval '1 day'
  order by occurred_at desc, payment_transaction_id desc
  limit 1;
  if found and (
    nullif(btrim(p_override_reason), '') is null
    or p_suspected_reference is distinct from v_duplicate.payment_reference
  ) then
    return jsonb_build_object('state','duplicate_warning','suspectedReference',v_duplicate.payment_reference);
  end if;

  v_selected_alloc := least(v_amount, v_selected.outstanding_amount);
  select * into v_other
  from public.project_payment_records
  where project_id = p_project_id
    and project_payment_record_id <> v_selected.project_payment_record_id
    and status not in ('paid','overpaid','canceled','waived')
    and target_amount > 0
    and outstanding_amount > 0
  order by case payment_kind when 'deposit' then 1 else 2 end
  limit 1;
  if found then
    v_other_alloc := least(greatest(v_amount - v_selected_alloc, 0), v_other.outstanding_amount);
  end if;
  v_overpayment := greatest(v_amount - v_selected_alloc - v_other_alloc, 0);

  v_proposal := jsonb_build_array(jsonb_build_object(
    'obligationId', v_selected.project_payment_record_id,
    'paymentKind', v_selected.payment_kind,
    'amount', v_selected_alloc
  ));
  if v_other_alloc > 0 then
    v_proposal := v_proposal || jsonb_build_array(jsonb_build_object(
      'obligationId', v_other.project_payment_record_id,
      'paymentKind', v_other.payment_kind,
      'amount', v_other_alloc
    ));
  end if;

  if v_other_alloc > 0 and not p_confirm_spillover then
    return jsonb_build_object(
      'state','spillover_warning',
      'spilloverAmount',v_other_alloc,
      'proposedAllocations',v_proposal
    );
  end if;
  if v_overpayment > 0 and not p_confirm_overpayment then
    return jsonb_build_object(
      'state','overpayment_warning',
      'overpaymentAmount',v_overpayment,
      'proposedAllocations',v_proposal
    );
  end if;

  insert into public.payment_transactions(
    payment_reference, project_id, kind, status, principal_amount, method, source,
    occurred_at, actor_type, actor_id, command_key, duplicate_override,
    duplicate_override_reason, suspected_reference, customer_notice_policy,
    customer_notice_state, note
  ) values (
    public.generate_payment_reference(), p_project_id, 'receipt', 'confirmed', v_amount,
    p_method, 'manual', p_received_at, 'florist', v_actor, v_command_key,
    v_duplicate.payment_transaction_id is not null, nullif(btrim(p_override_reason),''),
    p_suspected_reference, 'required', 'queued', nullif(btrim(p_note),'')
  ) returning * into v_transaction;

  insert into public.payment_transaction_allocations(payment_transaction_id, obligation_id, allocated_principal, sequence)
  values (v_transaction.payment_transaction_id, v_selected.project_payment_record_id, v_selected_alloc, 1);
  if v_other_alloc > 0 then
    insert into public.payment_transaction_allocations(payment_transaction_id, obligation_id, allocated_principal, sequence)
    values (v_transaction.payment_transaction_id, v_other.project_payment_record_id, v_other_alloc, 2);
  end if;

  perform public.recompute_project_payment_obligations(p_project_id);

  update public.payment_intentions i
  set state = 'fulfilled', fulfilled_at = now()
  where i.project_id = p_project_id
    and i.state = 'active'
    and exists (
      select 1
      from public.payment_request_obligations ro
      join public.payment_transaction_allocations a on a.obligation_id = ro.obligation_id
      where ro.payment_request_id = i.payment_request_id
        and a.payment_transaction_id = v_transaction.payment_transaction_id
    );

  update public.payment_requests r
  set status = 'fulfilled', fulfilled_at = coalesce(r.fulfilled_at, now()),
      invalidated_at = coalesce(r.invalidated_at, now()),
      token_ciphertext = null, token_iv = null, token_key_version = null
  where r.project_id = p_project_id
    and r.status = 'active'
    and exists (
      select 1 from public.payment_request_obligations ro
      join public.payment_transaction_allocations a on a.obligation_id = ro.obligation_id
      where ro.payment_request_id = r.payment_request_id
        and a.payment_transaction_id = v_transaction.payment_transaction_id
    )
    and not exists (
      select 1 from public.payment_request_obligations ro
      join public.project_payment_records o on o.project_payment_record_id = ro.obligation_id
      where ro.payment_request_id = r.payment_request_id
        and o.outstanding_amount > 0
        and o.status not in ('waived','canceled')
    );

  if v_overpayment > 0 then
    insert into public.payment_exceptions(project_id,payment_transaction_id,exception_type,urgency,amount,summary)
    values(p_project_id,v_transaction.payment_transaction_id,'overpayment','urgent',v_overpayment,'Payment exceeds the complete project balance');
  end if;

  perform public.create_payment_activity(
    p_project_id,
    'Payment recorded',
    initcap(replace(v_selected.payment_kind,'_',' ')) || ' payment ' || v_transaction.payment_reference || ' was recorded.',
    'florist',
    jsonb_build_object(
      'payment_reference',v_transaction.payment_reference,
      'payment_kind',v_selected.payment_kind,
      'method',p_method,
      'principal_amount',v_amount,
      'allocations',v_proposal
    ),
    v_actor
  );

  insert into public.payment_message_deliveries(
    project_id,obligation_id,payment_transaction_id,delivery_kind,occurrence_key,principal_amount,status
  ) values (
    p_project_id,v_selected.project_payment_record_id,v_transaction.payment_transaction_id,
    'receipt','receipt:' || v_transaction.payment_transaction_id,v_amount,'queued'
  );

  select coalesce(jsonb_agg(jsonb_build_object(
      'obligationId', a.obligation_id,
      'paymentKind', o.payment_kind,
      'amount', a.allocated_principal
    ) order by a.sequence), '[]'::jsonb),
    coalesce(jsonb_agg(to_jsonb(a.obligation_id) order by a.sequence), '[]'::jsonb)
  into v_allocations, v_affected_ids
  from public.payment_transaction_allocations a
  join public.project_payment_records o on o.project_payment_record_id = a.obligation_id
  where a.payment_transaction_id = v_transaction.payment_transaction_id;

  return jsonb_build_object(
    'state','recorded',
    'replayed',false,
    'transactionId',v_transaction.payment_transaction_id,
    'paymentReference',v_transaction.payment_reference,
    'allocations',v_allocations,
    'affectedObligationIds',v_affected_ids,
    'overpaymentAmount',v_overpayment
  );
end;
$$;

revoke all on function public.record_manual_payment(uuid,uuid,bigint,text,timestamptz,text,text,text,uuid,boolean,boolean) from public, anon;
grant execute on function public.record_manual_payment(uuid,uuid,bigint,text,timestamptz,text,text,text,uuid,boolean,boolean) to authenticated;
