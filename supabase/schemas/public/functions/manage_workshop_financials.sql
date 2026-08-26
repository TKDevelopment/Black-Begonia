create or replace function public.manage_workshop_financials(
  p_action text,
  p_payload jsonb,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_charge public.workshop_payment_transactions;
  v_request public.workshop_refund_requests;
  v_transaction public.workshop_payment_transactions;
  v_exception public.workshop_payment_exceptions;
  v_attempt public.workshop_payment_attempts;
  v_event public.workshop_payment_provider_events;
  v_amount bigint;
  v_consumed bigint;
  v_remaining bigint;
  v_currency text;
  v_reason text;
  v_reference text;
  v_kind text;
  v_state text;
  v_provider_object_id text;
  v_request_id uuid;
begin
  if p_command_key is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_request';
  end if;
  if coalesce(auth.role(), '') <> 'service_role'
    and session_user <> 'postgres'
    and not public.is_internal_crm_user()
  then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_action in ('refund_eligibility', 'request_refund') then
    select * into v_charge
    from public.workshop_payment_transactions
    where workshop_payment_transaction_id =
      nullif(p_payload->>'transactionId', '')::uuid
    for update;
    if not found
      or v_charge.transaction_type <> 'charge'
      or v_charge.provider <> 'stripe'
      or v_charge.state not in ('paid', 'partially_refunded')
      or v_charge.provider_transaction_id is null
    then
      raise exception 'refund_not_eligible' using errcode = 'P0001';
    end if;

    select coalesce(sum(amount_minor), 0) into v_consumed
    from public.workshop_refund_requests
    where workshop_payment_transaction_id =
      v_charge.workshop_payment_transaction_id
      and state in ('requested', 'provider_accepted', 'reconciled');
    v_remaining := greatest(v_charge.amount_minor - v_consumed, 0);

    if p_action = 'refund_eligibility' then
      select * into v_request from public.workshop_refund_requests
      where command_key = p_command_key;
      return jsonb_build_object(
        'eligible', v_remaining > 0 or found,
        'transactionId', v_charge.workshop_payment_transaction_id,
        'currency', v_charge.currency,
        'remainingRefundableMinor', case
          when found then v_request.amount_minor else v_remaining end,
        'providerChargeId', v_charge.provider_transaction_id,
        'bookingId', v_charge.workshop_booking_id,
        'occurrenceId', v_charge.workshop_occurrence_id
      );
    end if;

    select * into v_request
    from public.workshop_refund_requests
    where command_key = p_command_key;
    if found then
      return jsonb_build_object(
        'replayed', true,
        'requestId', v_request.workshop_refund_request_id,
        'state', v_request.state,
        'amountMinor', v_request.amount_minor,
        'currency', v_request.currency,
        'providerChargeId', v_charge.provider_transaction_id,
        'remainingRefundableMinor', v_remaining
      );
    end if;

    v_amount := nullif(p_payload->>'amountMinor', '')::bigint;
    v_currency := upper(btrim(coalesce(p_payload->>'currency', '')));
    v_reason := btrim(coalesce(p_payload->>'reason', ''));
    if v_remaining <= 0
      or v_amount is null or v_amount <= 0 or v_amount > v_remaining
      or v_currency <> v_charge.currency
      or v_reason not in (
        'customer_requested','duplicate','fraudulent','event_cancelled','other'
      )
    then
      raise exception 'refund_not_eligible' using errcode = 'P0001';
    end if;

    insert into public.workshop_refund_requests(
      workshop_payment_transaction_id, workshop_booking_id,
      workshop_occurrence_id, amount_minor, currency, reason, command_key,
      requested_by
    ) values (
      v_charge.workshop_payment_transaction_id, v_charge.workshop_booking_id,
      v_charge.workshop_occurrence_id, v_amount, v_currency, v_reason,
      p_command_key, v_actor
    ) returning * into v_request;
    return jsonb_build_object(
      'replayed', false,
      'requestId', v_request.workshop_refund_request_id,
      'state', v_request.state,
      'amountMinor', v_request.amount_minor,
      'currency', v_request.currency,
      'providerChargeId', v_charge.provider_transaction_id,
      'remainingRefundableMinor', v_remaining - v_amount
    );
  end if;

  if p_action in ('refund_provider_accepted', 'refund_provider_failed') then
    if coalesce(auth.role(), '') <> 'service_role' and session_user <> 'postgres' then
      raise exception 'not authorized' using errcode = '42501';
    end if;
    v_request_id := nullif(p_payload->>'requestId', '')::uuid;
    select * into v_request from public.workshop_refund_requests
    where workshop_refund_request_id = v_request_id for update;
    if not found then raise exception 'not_found'; end if;
    if v_request.state in ('provider_accepted', 'reconciled')
      and p_action = 'refund_provider_accepted'
    then
      return jsonb_build_object(
        'replayed', true, 'requestId', v_request_id, 'state', v_request.state
      );
    end if;
    if v_request.state = 'provider_failed'
      and p_action = 'refund_provider_failed'
    then
      return jsonb_build_object(
        'replayed', true, 'requestId', v_request_id, 'state', v_request.state
      );
    end if;
    if v_request.state <> 'requested' then
      raise exception 'invalid_transition';
    end if;
    if p_action = 'refund_provider_accepted' then
      v_reference := btrim(coalesce(p_payload->>'providerRefundId', ''));
      if v_reference = '' then raise exception 'invalid_request'; end if;
      update public.workshop_refund_requests
      set state = 'provider_accepted', provider_refund_id = v_reference,
        provider_accepted_at = now()
      where workshop_refund_request_id = v_request_id
      returning * into v_request;
    else
      update public.workshop_refund_requests
      set state = 'provider_failed',
        safe_failure = left(
          btrim(coalesce(p_payload->>'safeFailure', 'provider_rejected')), 160
        )
      where workshop_refund_request_id = v_request_id
      returning * into v_request;
      insert into public.workshop_payment_exceptions(
        workshop_booking_id, workshop_occurrence_id,
        workshop_payment_transaction_id, exception_type, urgency, amount_minor,
        currency, summary, safe_detail, command_key
      ) values (
        v_request.workshop_booking_id, v_request.workshop_occurrence_id,
        v_request.workshop_payment_transaction_id, 'refund_provider_failure',
        'urgent', v_request.amount_minor, v_request.currency,
        'Stripe did not accept the workshop refund request.',
        'Review the refund request before trying again.', p_command_key
      );
    end if;
    return jsonb_build_object(
      'replayed', false, 'requestId', v_request_id, 'state', v_request.state
    );
  end if;

  if p_action = 'record_provider_fact' then
    if coalesce(auth.role(), '') <> 'service_role' and session_user <> 'postgres' then
      raise exception 'not authorized' using errcode = '42501';
    end if;
    v_kind := btrim(coalesce(p_payload->>'kind', ''));
    v_state := btrim(coalesce(p_payload->>'state', ''));
    v_amount := nullif(p_payload->>'amountMinor', '')::bigint;
    v_currency := upper(btrim(coalesce(p_payload->>'currency', '')));
    v_provider_object_id := btrim(coalesce(p_payload->>'providerObjectId', ''));
    select * into v_event from public.workshop_payment_provider_events
    where provider = 'stripe'
      and provider_event_id = btrim(coalesce(p_payload->>'providerEventId', ''));
    if found then
      return jsonb_build_object(
        'replayed', true, 'state', v_event.processing_state
      );
    end if;
    select * into v_event from public.workshop_payment_provider_events
    where provider = 'stripe'
      and provider_object_id = v_provider_object_id
      and event_type = left(
        btrim(coalesce(p_payload->>'eventType', 'unknown')), 120
      )
      and processing_state = 'processed';
    if found then
      return jsonb_build_object('replayed', true, 'state', 'duplicate');
    end if;
    if v_kind not in ('refund','fee','dispute','reversal')
      or v_state not in ('pending','confirmed','failed','resolved')
      or v_amount is null or v_amount < 0 or v_currency <> 'USD'
      or v_provider_object_id = ''
      or char_length(coalesce(p_payload->>'payloadDigest', '')) < 32
    then
      raise exception 'invalid_request';
    end if;
    v_request_id := nullif(p_payload->>'refundRequestId', '')::uuid;
    if v_request_id is not null then
      select * into v_request from public.workshop_refund_requests
      where workshop_refund_request_id = v_request_id for update;
      if not found then raise exception 'not_found'; end if;
      select * into v_charge from public.workshop_payment_transactions
      where workshop_payment_transaction_id =
        v_request.workshop_payment_transaction_id;
    else
      select * into v_attempt from public.workshop_payment_attempts
      where workshop_payment_attempt_id =
        nullif(p_payload->>'paymentAttemptId', '')::uuid;
      if not found then raise exception 'not_found'; end if;
      select * into v_charge from public.workshop_payment_transactions
      where workshop_payment_attempt_id = v_attempt.workshop_payment_attempt_id
        and transaction_type = 'charge'
      order by occurred_at limit 1;
      if not found then raise exception 'not_found'; end if;
    end if;
    insert into public.workshop_payment_provider_events(
      provider, provider_event_id, provider_object_id, provider_object_type,
      event_type, event_occurred_at, signature_verified_at, payload_digest,
      normalized_facts, processing_state, workshop_payment_attempt_id,
      processed_at
    ) values (
      'stripe', btrim(p_payload->>'providerEventId'), v_provider_object_id,
      left(btrim(coalesce(p_payload->>'providerObjectType', 'unknown')), 80),
      left(btrim(coalesce(p_payload->>'eventType', 'unknown')), 120),
      (p_payload->>'occurredAt')::timestamptz, now(),
      p_payload->>'payloadDigest',
      jsonb_build_object('kind', v_kind, 'amountMinor', v_amount,
        'currency', v_currency),
      'processed', v_charge.workshop_payment_attempt_id, now()
    ) returning * into v_event;
    if v_state in ('confirmed', 'resolved') and v_amount > 0 then
      insert into public.workshop_payment_transactions(
        workshop_booking_id, workshop_occurrence_id,
        workshop_payment_attempt_id, transaction_type, provider,
        provider_transaction_id, payment_reference, amount_minor, currency,
        occurred_at, state, command_key, payload_digest, normalized_facts,
        actor_type
      ) values (
        v_charge.workshop_booking_id, v_charge.workshop_occurrence_id,
        v_charge.workshop_payment_attempt_id, v_kind, 'stripe',
        v_provider_object_id,
        upper(v_kind)||'-'||btrim(p_payload->>'providerEventId'),
        v_amount, v_currency, (p_payload->>'occurredAt')::timestamptz,
        case
          when v_kind = 'refund' then 'refunded'
          when v_kind = 'dispute' then 'disputed'
          when v_kind = 'reversal' then 'reversed'
          else 'paid'
        end,
        p_command_key, p_payload->>'payloadDigest',
        jsonb_build_object(
          'providerEventId', p_payload->>'providerEventId',
          'originalTransactionId', v_charge.workshop_payment_transaction_id,
          'refundRequestId', v_request_id
        ),
        'provider'
      )
      on conflict (provider, provider_transaction_id, transaction_type)
        where provider_transaction_id is not null
      do nothing
      returning * into v_transaction;
      if not found then
        return jsonb_build_object('replayed', true, 'state', 'duplicate');
      end if;
      if v_kind = 'refund' and v_request_id is not null then
        update public.workshop_refund_requests
        set state = 'reconciled',
          provider_refund_id = coalesce(provider_refund_id, v_provider_object_id),
          reconciled_at = now()
        where workshop_refund_request_id = v_request_id;
        select coalesce(sum(amount_minor), 0) into v_consumed
        from public.workshop_payment_transactions
        where transaction_type in ('refund','external_refund')
          and state = 'refunded'
          and normalized_facts->>'originalTransactionId' =
            v_charge.workshop_payment_transaction_id::text;
        update public.workshop_bookings
        set payment_state = case
          when v_consumed >= v_charge.amount_minor then 'refunded'
          else 'partially_refunded'
        end
        where workshop_booking_id = v_charge.workshop_booking_id;
      elsif v_kind in ('dispute','reversal') then
        update public.workshop_bookings
        set payment_state = case
          when v_kind = 'dispute' then 'disputed' else 'reversed'
        end,
        status = 'payment_disputed'
        where workshop_booking_id = v_charge.workshop_booking_id;
        insert into public.workshop_payment_exceptions(
          workshop_booking_id, workshop_occurrence_id,
          workshop_payment_transaction_id, exception_type, urgency,
          amount_minor, currency, summary, safe_detail, provider_event_id,
          command_key
        ) values (
          v_charge.workshop_booking_id, v_charge.workshop_occurrence_id,
          v_transaction.workshop_payment_transaction_id, v_kind, 'urgent',
          v_amount, v_currency,
          'A Stripe '||v_kind||' requires workshop payment review.',
          'Seats remain unchanged until an explicit operational decision.',
          v_event.workshop_payment_provider_event_id, p_command_key
        );
      end if;
    end if;
    return jsonb_build_object(
      'replayed', false, 'state', v_state, 'kind', v_kind,
      'transactionId', v_transaction.workshop_payment_transaction_id
    );
  end if;

  if p_action in ('record_external_refund', 'record_correction') then
    select * into v_charge from public.workshop_payment_transactions
    where workshop_payment_transaction_id =
      nullif(p_payload->>'transactionId', '')::uuid
    for update;
    if not found or v_charge.transaction_type <> 'charge' then
      raise exception 'not_found';
    end if;
    select * into v_transaction from public.workshop_payment_transactions
    where command_key = p_command_key;
    if found then
      return jsonb_build_object(
        'replayed', true,
        'transactionId', v_transaction.workshop_payment_transaction_id
      );
    end if;
    v_amount := nullif(p_payload->>'amountMinor', '')::bigint;
    v_currency := upper(btrim(coalesce(p_payload->>'currency', '')));
    v_reference := btrim(coalesce(p_payload->>'reference', ''));
    if v_amount is null or v_amount = 0 or v_currency <> v_charge.currency
      or v_reference = '' then raise exception 'invalid_request'; end if;
    if p_action = 'record_external_refund' and (
      v_charge.provider <> 'direct_venmo' or v_amount < 0
    ) then raise exception 'invalid_request'; end if;
    insert into public.workshop_payment_transactions(
      workshop_booking_id, workshop_occurrence_id,
      workshop_payment_attempt_id, transaction_type, provider,
      provider_transaction_id, payment_reference, amount_minor, currency,
      occurred_at, state, command_key, normalized_facts, actor_type, actor_id,
      note
    ) values (
      v_charge.workshop_booking_id, v_charge.workshop_occurrence_id,
      v_charge.workshop_payment_attempt_id,
      case when p_action = 'record_external_refund'
        then 'external_refund' else 'correction' end,
      case when p_action = 'record_external_refund'
        then 'direct_venmo' else 'manual' end,
      case when p_action = 'record_external_refund' then v_reference end,
      v_reference, v_amount, v_currency,
      coalesce((p_payload->>'occurredAt')::timestamptz, now()),
      case when p_action = 'record_external_refund' then 'refunded' else 'paid' end,
      p_command_key,
      jsonb_build_object(
        'originalTransactionId', v_charge.workshop_payment_transaction_id,
        'reason', left(btrim(coalesce(p_payload->>'reason', 'other')), 80)
      ),
      'internal', v_actor, left(nullif(btrim(p_payload->>'note'), ''), 500)
    ) returning * into v_transaction;
    return jsonb_build_object(
      'replayed', false,
      'transactionId', v_transaction.workshop_payment_transaction_id,
      'state', v_transaction.state
    );
  end if;

  if p_action = 'resolve_exception' then
    select * into v_exception from public.workshop_payment_exceptions
    where workshop_payment_exception_id =
      nullif(p_payload->>'exceptionId', '')::uuid for update;
    if not found then raise exception 'not_found'; end if;
    if v_exception.state = 'resolved' then
      return jsonb_build_object(
        'replayed', true, 'exceptionId',
        v_exception.workshop_payment_exception_id, 'state', v_exception.state
      );
    end if;
    v_reason := btrim(coalesce(p_payload->>'resolution', ''));
    if v_reason not in (
      'external_refund','accepted_payment','transferred_payment',
      'dismissed_non_payment','provider_resolved'
    ) then raise exception 'invalid_request'; end if;
    update public.workshop_payment_exceptions
    set state = 'resolved', resolution = v_reason,
      resolution_reference =
        left(btrim(coalesce(p_payload->>'reference', '')), 160),
      resolved_by = v_actor, resolved_at = now()
    where workshop_payment_exception_id =
      v_exception.workshop_payment_exception_id;
    return jsonb_build_object(
      'replayed', false, 'exceptionId',
      v_exception.workshop_payment_exception_id, 'state', 'resolved'
    );
  end if;

  raise exception 'invalid_action';
end;
$$;

revoke all on function public.manage_workshop_financials(text,jsonb,uuid)
from public;
grant execute on function public.manage_workshop_financials(text,jsonb,uuid)
to authenticated, service_role;

create or replace function public.get_workshop_financial_summary(
  p_workshop_occurrence_id uuid default null,
  p_workshop_series_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_internal_crm_user() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if (p_workshop_occurrence_id is not null)::integer
    + (p_workshop_series_id is not null)::integer <> 1
  then raise exception 'invalid_scope'; end if;
  select jsonb_build_object(
    'scopeType', case when p_workshop_occurrence_id is not null
      then 'occurrence' else 'series' end,
    'scopeId', coalesce(p_workshop_occurrence_id, p_workshop_series_id),
    'currency', coalesce(min(currency), 'USD'),
    'grossRevenueMinor', coalesce(sum(signed_amount_minor)
      filter (where entry_category = 'charge'
        and transaction_state in (
          'paid','partially_refunded','refunded','disputed','reversed'
        )), 0),
    'discountsMinor', abs(coalesce(sum(signed_amount_minor)
      filter (where entry_category = 'discount'), 0)),
    'refundsMinor', abs(coalesce(sum(signed_amount_minor)
      filter (where entry_category in ('refund','external_refund')), 0)),
    'providerFeesMinor', abs(coalesce(sum(signed_amount_minor)
      filter (where entry_category = 'fee'), 0)),
    'disputesAndReversalsMinor', abs(coalesce(sum(signed_amount_minor)
      filter (where entry_category in ('dispute','reversal')), 0)),
    'expensesMinor', abs(coalesce(sum(signed_amount_minor)
      filter (where source_type = 'expense'), 0)),
    'netIncomeMinor', coalesce(sum(signed_amount_minor)
      filter (where source_type = 'expense'
        or (
          entry_category <> 'dispute'
          and transaction_state in (
            'paid','partially_refunded','refunded','disputed','reversed'
          )
        )), 0),
    'transactionCount', count(*) filter (where source_type = 'transaction'),
    'openExceptionCount', (
      select count(*) from public.workshop_payment_exceptions exception
      join public.workshop_occurrences occurrence
        on occurrence.workshop_occurrence_id =
          exception.workshop_occurrence_id
      where exception.state in ('open','acknowledged')
        and (
          exception.workshop_occurrence_id = p_workshop_occurrence_id
          or occurrence.workshop_series_id = p_workshop_series_id
        )
    )
  ) into v_result
  from public.workshop_financial_entries entry
  where entry.workshop_occurrence_id = p_workshop_occurrence_id
    or entry.workshop_series_id = p_workshop_series_id;
  return v_result;
end;
$$;

revoke all on function public.get_workshop_financial_summary(uuid,uuid)
from public;
grant execute on function public.get_workshop_financial_summary(uuid,uuid)
to authenticated;
