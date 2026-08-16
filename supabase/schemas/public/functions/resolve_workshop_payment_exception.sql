create or replace function public.resolve_workshop_payment_exception(
  p_exception_id uuid,
  p_resolution text,
  p_resolution_reference text,
  p_amount_minor bigint,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exception public.workshop_payment_exceptions;
  v_attempt public.workshop_payment_attempts;
  v_transaction public.workshop_payment_transactions;
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and session_user <> 'postgres'
    and not public.is_internal_crm_user()
  then
    raise exception 'not authorized';
  end if;

  if p_resolution not in (
    'external_refund',
    'accepted_payment',
    'transferred_payment',
    'dismissed_non_payment'
  ) or char_length(btrim(coalesce(p_resolution_reference, ''))) = 0 then
    raise exception 'invalid_request';
  end if;

  select * into v_exception
  from public.workshop_payment_exceptions
  where command_key = p_command_key
     or workshop_payment_exception_id = p_exception_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;

  if v_exception.command_key = p_command_key and v_exception.state = 'resolved' then
    return jsonb_build_object(
      'replayed', true,
      'exceptionId', v_exception.workshop_payment_exception_id,
      'state', v_exception.state,
      'resolution', v_exception.resolution
    );
  end if;

  if v_exception.state = 'resolved' then
    raise exception 'invalid_transition';
  end if;

  if p_resolution = 'external_refund' then
    if v_exception.workshop_booking_id is null
      or v_exception.workshop_occurrence_id is null
      or p_amount_minor is null
      or p_amount_minor <= 0
    then
      raise exception 'invalid_request';
    end if;

    select * into v_attempt
    from public.workshop_payment_attempts
    where workshop_payment_attempt_id = v_exception.workshop_payment_attempt_id;

    insert into public.workshop_payment_transactions (
      workshop_booking_id,
      workshop_occurrence_id,
      workshop_payment_attempt_id,
      transaction_type,
      provider,
      provider_transaction_id,
      payment_reference,
      amount_minor,
      currency,
      occurred_at,
      state,
      command_key,
      normalized_facts
    ) values (
      v_exception.workshop_booking_id,
      v_exception.workshop_occurrence_id,
      v_exception.workshop_payment_attempt_id,
      'refund',
      coalesce(v_attempt.provider, 'manual'),
      p_resolution_reference,
      'REFUND-' || p_resolution_reference,
      p_amount_minor,
      coalesce(v_exception.currency, 'USD'),
      now(),
      'refunded',
      p_command_key,
      jsonb_build_object('exceptionId', v_exception.workshop_payment_exception_id)
    )
    returning * into v_transaction;
  end if;

  update public.workshop_payment_exceptions
  set state = 'resolved',
      resolution = p_resolution,
      resolution_reference = btrim(p_resolution_reference),
      resolved_by = auth.uid(),
      resolved_at = now(),
      command_key = p_command_key
  where workshop_payment_exception_id = v_exception.workshop_payment_exception_id
  returning * into v_exception;

  return jsonb_build_object(
    'replayed', false,
    'exceptionId', v_exception.workshop_payment_exception_id,
    'state', v_exception.state,
    'resolution', v_exception.resolution,
    'transactionId', v_transaction.workshop_payment_transaction_id
  );
end;
$$;

revoke all on function public.resolve_workshop_payment_exception(
  uuid, text, text, bigint, uuid
) from public;
grant execute on function public.resolve_workshop_payment_exception(
  uuid, text, text, bigint, uuid
) to service_role, authenticated;
