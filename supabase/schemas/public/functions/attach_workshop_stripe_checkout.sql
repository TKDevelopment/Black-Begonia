create or replace function public.attach_workshop_stripe_checkout(
  p_payment_attempt_id uuid,
  p_provider_checkout_id text,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.workshop_payment_attempts;
  v_replayed boolean;
begin
  if char_length(btrim(coalesce(p_provider_checkout_id, ''))) = 0 then
    raise exception 'invalid_request';
  end if;

  select * into v_attempt
  from public.workshop_payment_attempts
  where workshop_payment_attempt_id = p_payment_attempt_id
  for update;

  if not found
    or v_attempt.provider <> 'stripe'
    or v_attempt.state not in ('creating', 'active')
  then
    raise exception 'unavailable';
  end if;

  if v_attempt.provider_checkout_id is not null
    and v_attempt.provider_checkout_id <> p_provider_checkout_id
  then
    raise exception 'invalid_transition';
  end if;

  v_replayed := v_attempt.provider_checkout_id = p_provider_checkout_id;

  update public.workshop_payment_attempts
  set provider_checkout_id = p_provider_checkout_id,
      state = 'active'
  where workshop_payment_attempt_id = p_payment_attempt_id
  returning * into v_attempt;

  return jsonb_build_object(
    'replayed', v_replayed,
    'paymentAttemptId', v_attempt.workshop_payment_attempt_id,
    'providerCheckoutId', v_attempt.provider_checkout_id,
    'commandKey', p_command_key
  );
end;
$$;

revoke all on function public.attach_workshop_stripe_checkout(
  uuid, text, uuid
) from public;
grant execute on function public.attach_workshop_stripe_checkout(
  uuid, text, uuid
) to service_role;
