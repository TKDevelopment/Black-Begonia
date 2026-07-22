-- Refine project installments around the immutable receipt/allocation ledger.
-- This migration intentionally does not modify payment Edge Functions or schedules.

create table public.payment_transaction_relationships (
  payment_transaction_relationship_id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(project_id) on delete restrict,
  parent_transaction_id uuid not null references public.payment_transactions(payment_transaction_id) on delete restrict,
  child_transaction_id uuid not null references public.payment_transactions(payment_transaction_id) on delete restrict,
  relationship_type text not null default 'adjusts' check (relationship_type = 'adjusts'),
  evidence_source text not null check (evidence_source in ('provider_correlation','request_correlation','checkout_correlation','migration_exact_match','authorized_resolution')),
  created_at timestamptz not null default now(),
  check (parent_transaction_id <> child_transaction_id)
);

create unique index uq_payment_transaction_relationships_adjustment on public.payment_transaction_relationships(child_transaction_id) where relationship_type = 'adjusts';
create index idx_payment_transaction_relationships_parent on public.payment_transaction_relationships(parent_transaction_id, child_transaction_id);
create index if not exists idx_payment_transactions_project_occurred on public.payment_transactions(project_id, occurred_at desc, payment_transaction_id);
create index if not exists idx_payment_transaction_allocations_obligation on public.payment_transaction_allocations(obligation_id, payment_transaction_id);

create or replace function public.validate_payment_transaction_relationship()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_parent public.payment_transactions; v_child public.payment_transactions;
begin
  select * into v_parent from public.payment_transactions where payment_transaction_id = new.parent_transaction_id;
  select * into v_child from public.payment_transactions where payment_transaction_id = new.child_transaction_id;
  if v_parent.payment_transaction_id is null or v_child.payment_transaction_id is null then raise exception 'Related payment transaction is unavailable'; end if;
  if v_parent.project_id <> new.project_id or v_child.project_id <> new.project_id then raise exception 'Related payment transactions must belong to the same project'; end if;
  if v_parent.kind <> 'receipt' or v_child.kind = 'receipt' then raise exception 'Adjustment relationships require a receipt parent and adjustment child'; end if;
  return new;
end;
$$;
create trigger trg_payment_transaction_relationships_validate before insert on public.payment_transaction_relationships for each row execute function public.validate_payment_transaction_relationship();
create trigger trg_payment_transaction_relationships_immutable before update or delete on public.payment_transaction_relationships for each row execute function public.prevent_payment_financial_mutation();
alter table public.payment_transaction_relationships enable row level security;
create policy payment_transaction_relationships_internal_select on public.payment_transaction_relationships for select to authenticated using (public.is_internal_crm_user());
revoke all on public.payment_transaction_relationships from public, anon, authenticated;
grant select on public.payment_transaction_relationships to authenticated;

-- Repair only relationships supported by one exact piece of persisted evidence.
with adjustment_candidates as (
  select adjustment.payment_transaction_id child_transaction_id, adjustment.project_id,
    receipt.payment_transaction_id parent_transaction_id,
    case when adjustment.normalized_facts->>'originalTransactionId'=receipt.payment_transaction_id::text then 1
         when nullif(adjustment.normalized_facts->>'originalProviderReference','')=receipt.provider_reference then 2 else 3 end evidence_rank
  from public.payment_transactions adjustment
  join public.payment_transactions receipt on receipt.project_id=adjustment.project_id and receipt.kind='receipt'
  where adjustment.kind<>'receipt' and (
    (coalesce(adjustment.normalized_facts->>'originalTransactionId','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and receipt.payment_transaction_id::text=adjustment.normalized_facts->>'originalTransactionId')
    or (nullif(adjustment.normalized_facts->>'originalTransactionId','') is null and nullif(adjustment.normalized_facts->>'originalProviderReference','') is not null and receipt.provider_reference=adjustment.normalized_facts->>'originalProviderReference')
    or (nullif(adjustment.normalized_facts->>'originalTransactionId','') is null and nullif(adjustment.normalized_facts->>'originalProviderReference','') is null and adjustment.payment_checkout_attempt_id is not null and receipt.payment_checkout_attempt_id=adjustment.payment_checkout_attempt_id)
  )
), exact_candidates as (
  select child_transaction_id,project_id,(array_agg(parent_transaction_id order by parent_transaction_id::text))[1] parent_transaction_id
  from adjustment_candidates ac
  where evidence_rank=(select min(c2.evidence_rank) from adjustment_candidates c2 where c2.child_transaction_id=ac.child_transaction_id)
  group by child_transaction_id,project_id having count(*)=1
)
insert into public.payment_transaction_relationships(project_id,parent_transaction_id,child_transaction_id,relationship_type,evidence_source)
select project_id,parent_transaction_id,child_transaction_id,'adjusts','migration_exact_match' from exact_candidates
on conflict (child_transaction_id) where relationship_type='adjusts' do nothing;

insert into public.payment_exceptions(project_id,payment_transaction_id,exception_type,urgency,state,amount,summary,redacted_detail)
select adjustment.project_id,adjustment.payment_transaction_id,'legacy_ambiguity','urgent','open',abs(adjustment.principal_amount),
  'Legacy adjustment needs receipt matching','No single original receipt could be established from exact persisted evidence.'
from public.payment_transactions adjustment
where adjustment.kind<>'receipt'
  and not exists(select 1 from public.payment_transaction_relationships r where r.child_transaction_id=adjustment.payment_transaction_id)
  and not exists(select 1 from public.payment_exceptions e where e.payment_transaction_id=adjustment.payment_transaction_id and e.exception_type='legacy_ambiguity' and e.state in ('open','acknowledged'));

alter table public.project_payment_records drop constraint if exists project_payment_records_paid_check;
drop function if exists public.record_manual_payment(uuid,uuid,bigint,text,timestamptz,text,text,text,uuid,boolean);
create or replace function public.recompute_project_payment_obligations(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with allocation_totals as (
    select
      a.obligation_id,
      coalesce(sum(a.allocated_principal) filter (where t.status in ('confirmed','resolved')), 0)::numeric(12,2) as credited,
      count(distinct t.method) filter (
        where t.kind = 'receipt' and t.status in ('confirmed','resolved') and a.allocated_principal > 0
      ) as method_count,
      min(t.method) filter (
        where t.kind = 'receipt' and t.status in ('confirmed','resolved') and a.allocated_principal > 0
      ) as single_method,
      max(t.occurred_at) filter (
        where t.kind = 'receipt' and t.status in ('confirmed','resolved') and a.allocated_principal > 0
      ) as last_receipt_at,
      (array_agg(t.method order by t.occurred_at desc, t.payment_transaction_id desc) filter (
        where t.kind = 'receipt' and t.status in ('confirmed','resolved') and a.allocated_principal > 0
      ))[1] as last_method
    from public.payment_transaction_allocations a
    join public.payment_transactions t using (payment_transaction_id)
    join public.project_payment_records scoped on scoped.project_payment_record_id = a.obligation_id
    where scoped.project_id = p_project_id
    group by a.obligation_id
  ), derived as (
    select
      o.project_payment_record_id,
      greatest(coalesce(a.credited, 0), 0)::numeric(12,2) as credited,
      greatest(o.target_amount - greatest(coalesce(a.credited, 0), 0), 0)::numeric(12,2) as outstanding,
      coalesce(a.method_count, 0) as method_count,
      a.single_method,
      a.last_receipt_at,
      a.last_method,
      case
        when o.status in ('waived','canceled','review_required') then o.status
        when o.target_amount = 0 then case when o.due_date is not null and o.due_date <= current_date then 'due' else 'not_due' end
        when greatest(coalesce(a.credited, 0), 0) <= 0 then case when o.due_date is not null and o.due_date <= current_date then 'due' else 'not_due' end
        when greatest(coalesce(a.credited, 0), 0) < o.target_amount then 'partially_paid'
        when greatest(coalesce(a.credited, 0), 0) = o.target_amount then 'paid'
        else 'overpaid'
      end as next_state
    from public.project_payment_records o
    left join allocation_totals a on a.obligation_id = o.project_payment_record_id
    where o.project_id = p_project_id
  )
  update public.project_payment_records o
  set credited_principal = d.credited,
      amount_paid = d.credited,
      outstanding_amount = d.outstanding,
      status = d.next_state,
      fulfillment_state = d.next_state,
      deposit_target_frozen_at = case
        when o.payment_kind = 'deposit' and d.credited > 0 then coalesce(o.deposit_target_frozen_at, now())
        else o.deposit_target_frozen_at
      end,
      fulfilled_at = case
        when d.credited >= o.target_amount and o.target_amount > 0 then coalesce(o.fulfilled_at, now())
        else null
      end,
      paid_date = case
        when d.credited >= o.target_amount and o.target_amount > 0 then d.last_receipt_at
        else null
      end,
      payment_method = case when d.method_count = 1 then d.single_method else null end,
      last_method = d.last_method,
      updated_at = now()
  from derived d
  where o.project_payment_record_id = d.project_payment_record_id;

  update public.projects project
  set status = case
        when project.status = 'awaiting_deposit'
          and not exists (
            select 1 from public.project_payment_records obligation
            where obligation.project_id = project.project_id
              and obligation.payment_kind = 'deposit'
              and obligation.outstanding_amount > 0
              and obligation.status not in ('waived','canceled')
          )
          then case
            when exists (
              select 1 from public.project_payment_records obligation
              where obligation.project_id = project.project_id
                and obligation.payment_kind = 'final_payment'
                and obligation.outstanding_amount > 0
                and obligation.status not in ('waived','canceled')
            ) then 'booked'::public.project_status
            else 'final_prep'::public.project_status
          end
        when project.status = 'awaiting_final_payment'
          and not exists (
            select 1 from public.project_payment_records obligation
            where obligation.project_id = project.project_id
              and obligation.outstanding_amount > 0
              and obligation.status not in ('waived','canceled')
          )
          then 'final_prep'::public.project_status
        else project.status
      end,
      booked_at = case
        when project.status = 'awaiting_deposit'
          and not exists (
            select 1 from public.project_payment_records obligation
            where obligation.project_id = project.project_id
              and obligation.payment_kind = 'deposit'
              and obligation.outstanding_amount > 0
              and obligation.status not in ('waived','canceled')
          )
          then coalesce(project.booked_at, now())
        else project.booked_at
      end,
      updated_at = now()
  where project.project_id = p_project_id
    and project.status in ('awaiting_deposit','awaiting_final_payment');

  update public.payment_message_deliveries delivery
  set status = 'canceled', suppression_reason = 'installment_fulfilled'
  where delivery.project_id = p_project_id
    and delivery.delivery_kind in ('deposit_reminder','final_reminder')
    and delivery.status in ('queued','claimed')
    and exists (
      select 1 from public.project_payment_records obligation
      where obligation.project_payment_record_id = delivery.obligation_id
        and obligation.outstanding_amount = 0
    );
end;
$$;

revoke all on function public.recompute_project_payment_obligations(uuid) from public, anon, authenticated;
grant execute on function public.recompute_project_payment_obligations(uuid) to service_role;

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

create or replace function public.get_project_financial_summary(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_project public.projects;
  v_snapshot public.project_proposal_invoice_snapshots;
  v_obligations jsonb;
  v_needs_attention jsonb;
begin
  if not public.is_internal_crm_user() then
    raise exception 'not authorized';
  end if;

  select * into v_project from public.projects where project_id = p_project_id;
  if not found then
    return jsonb_build_object('available',false,'obligations','[]'::jsonb,'needsAttention','[]'::jsonb);
  end if;
  select * into v_snapshot
  from public.project_proposal_invoice_snapshots
  where project_proposal_invoice_snapshot_id = v_project.active_proposal_invoice_snapshot_id
    and project_id = p_project_id;

  select coalesce(jsonb_agg(
    to_jsonb(o) || jsonb_build_object(
      'displayStatus', case when o.target_amount = 0 then 'not_required' else o.status end,
      'plannedMethod', planned.method,
      'methodSummary', jsonb_build_object(
        'state', case
          when methods.method_count > 1 then 'multiple'
          when methods.method_count = 1 then 'received'
          when planned.method is not null then 'planned'
          else 'none'
        end,
        'label', case
          when methods.method_count > 1 then 'Multiple'
          when methods.method_count = 1 then initcap(replace(methods.single_method,'_',' '))
          when planned.method is not null then initcap(replace(planned.method,'_',' ')) || ' (planned)'
          else 'Not selected'
        end
      ),
      'receipts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'paymentTransactionId', t.payment_transaction_id,
          'paymentReference', t.payment_reference,
          'receiptPrincipal', t.principal_amount,
          'allocatedPrincipal', a.allocated_principal,
          'method', t.method,
          'source', t.source,
          'occurredAt', t.occurred_at,
          'status', t.status,
          'note', t.note,
          'adjustments', coalesce((
            select jsonb_agg(jsonb_build_object(
              'paymentTransactionId', child.payment_transaction_id,
              'paymentReference', child.payment_reference,
              'kind', child.kind,
              'status', child.status,
              'amount', child_alloc.allocated_principal,
              'occurredAt', child.occurred_at,
              'description', child.note
            ) order by child.occurred_at, child.payment_transaction_id)
            from public.payment_transaction_relationships rel
            join public.payment_transactions child on child.payment_transaction_id = rel.child_transaction_id
            left join public.payment_transaction_allocations child_alloc
              on child_alloc.payment_transaction_id = child.payment_transaction_id
             and child_alloc.obligation_id = o.project_payment_record_id
            where rel.parent_transaction_id = t.payment_transaction_id
              and rel.relationship_type = 'adjusts'
              and child.payment_transaction_id in (
                select history.payment_transaction_id
                from public.payment_transactions history
                where history.project_id = p_project_id
                order by history.occurred_at desc, history.payment_transaction_id desc
                limit 250
              )
          ), '[]'::jsonb)
        ) order by t.occurred_at, t.payment_transaction_id)
        from public.payment_transaction_allocations a
        join public.payment_transactions t on t.payment_transaction_id = a.payment_transaction_id
        where a.obligation_id = o.project_payment_record_id
          and a.allocated_principal > 0
          and t.kind = 'receipt'
          and t.status in ('confirmed','resolved')
          and t.payment_transaction_id in (
            select history.payment_transaction_id
            from public.payment_transactions history
            where history.project_id = p_project_id
            order by history.occurred_at desc, history.payment_transaction_id desc
            limit 250
          )
      ), '[]'::jsonb)
    ) order by case o.payment_kind when 'deposit' then 1 else 2 end), '[]'::jsonb)
  into v_obligations
  from public.project_payment_records o
  left join lateral (
    select i.method
    from public.payment_intentions i
    join public.payment_requests r on r.payment_request_id = i.payment_request_id
    join public.payment_request_obligations ro on ro.payment_request_id = i.payment_request_id
    where ro.obligation_id = o.project_payment_record_id
      and i.project_id = p_project_id
      and i.state = 'active'
      and r.status = 'active'
      and o.outstanding_amount > 0
    order by i.created_at desc, i.payment_intention_id desc
    limit 1
  ) planned on true
  left join lateral (
    select count(distinct t.method) as method_count, min(t.method) as single_method
    from public.payment_transaction_allocations a
    join public.payment_transactions t on t.payment_transaction_id = a.payment_transaction_id
    where a.obligation_id = o.project_payment_record_id
      and a.allocated_principal > 0
      and t.kind = 'receipt'
      and t.status in ('confirmed','resolved')
  ) methods on true
  where o.project_id = p_project_id
    and o.status <> 'canceled';

  select coalesce(jsonb_agg(jsonb_build_object(
    'paymentExceptionId', e.payment_exception_id,
    'type', e.exception_type,
    'urgency', e.urgency,
    'amount', e.amount,
    'summary', e.summary,
    'state', e.state,
    'createdAt', e.created_at
  ) order by e.urgency desc, e.created_at desc), '[]'::jsonb)
  into v_needs_attention
  from public.payment_exceptions e
  where e.project_id = p_project_id
    and e.state in ('open','acknowledged')
    and e.exception_type in ('adjustment_reopened_balance','reconciliation_failure','legacy_ambiguity');

  return jsonb_build_object(
    'available', v_snapshot.project_proposal_invoice_snapshot_id is not null,
    'proposalTotal', v_snapshot.total_amount,
    'depositTarget', coalesce((select o.target_amount from public.project_payment_records o where o.project_id=p_project_id and o.payment_kind='deposit' and o.status<>'canceled' limit 1),0),
    'finalTarget', coalesce((select o.target_amount from public.project_payment_records o where o.project_id=p_project_id and o.payment_kind='final_payment' and o.status<>'canceled' limit 1),0),
    'creditedPrincipal', coalesce((select sum(o.credited_principal) from public.project_payment_records o where o.project_id=p_project_id and o.status<>'canceled'),0),
    'outstanding', coalesce((select sum(o.outstanding_amount) from public.project_payment_records o where o.project_id=p_project_id and o.status<>'canceled'),0),
    'customerFees', coalesce((select sum(t.customer_fee) from public.payment_transactions t where t.project_id=p_project_id and t.status in ('confirmed','resolved')),0),
    'merchantFees', (select sum(t.merchant_fee) from public.payment_transactions t where t.project_id=p_project_id and t.status in ('confirmed','resolved')),
    'overpayment', coalesce((select sum(e.amount) from public.payment_exceptions e where e.project_id=p_project_id and e.exception_type='overpayment' and e.state<>'resolved'),0),
    'obligations', v_obligations,
    'needsAttention', v_needs_attention
  );
end;
$$;

revoke all on function public.get_project_financial_summary(uuid) from public, anon;
grant execute on function public.get_project_financial_summary(uuid) to authenticated;

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

-- Bring compatibility columns in line with the ledger before enforcing the new invariant.
insert into public.payment_exceptions(
  project_id,obligation_id,exception_type,urgency,state,amount,summary,redacted_detail
)
select
  obligation.project_id,obligation.project_payment_record_id,'legacy_ambiguity','urgent','open',
  obligation.target_amount,'Legacy paid installment needs evidence review',
  'The prior paid state has no immutable positive allocation evidence and was not inferred from compatibility metadata.'
from public.project_payment_records obligation
where obligation.status in ('paid','overpaid')
  and not exists (
    select 1
    from public.payment_transaction_allocations allocation
    join public.payment_transactions ledger_transaction
      on ledger_transaction.payment_transaction_id = allocation.payment_transaction_id
    where allocation.obligation_id = obligation.project_payment_record_id
      and allocation.allocated_principal > 0
      and ledger_transaction.kind = 'receipt'
      and ledger_transaction.status in ('confirmed','resolved')
  )
  and not exists (
    select 1
    from public.payment_exceptions exception
    where exception.obligation_id = obligation.project_payment_record_id
      and exception.exception_type = 'legacy_ambiguity'
      and exception.state in ('open','acknowledged')
  );

update public.project_payment_records obligation
set status = 'review_required',
    fulfillment_state = 'review_required',
    migration_state = 'ambiguous',
    updated_at = now()
where obligation.status in ('paid','overpaid')
  and not exists (
    select 1
    from public.payment_transaction_allocations allocation
    join public.payment_transactions ledger_transaction
      on ledger_transaction.payment_transaction_id = allocation.payment_transaction_id
    where allocation.obligation_id = obligation.project_payment_record_id
      and allocation.allocated_principal > 0
      and ledger_transaction.kind = 'receipt'
      and ledger_transaction.status in ('confirmed','resolved')
  );

do $$
declare v_project_id uuid;
begin
  for v_project_id in select distinct project_id from public.project_payment_records loop
    perform public.recompute_project_payment_obligations(v_project_id);
  end loop;
end;
$$;

alter table public.project_payment_records
  add constraint project_payment_records_paid_check check (
    status not in ('paid','overpaid')
    or (
      target_amount > 0
      and credited_principal >= target_amount
      and outstanding_amount = 0
      and fulfilled_at is not null
      and amount_paid = credited_principal
    )
  );

notify pgrst, 'reload schema';
