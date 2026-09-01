-- Workshop reservation checkout is Stripe-only from this release forward.
-- Historical direct-Venmo bookings, attempts, transactions, and reconciliation
-- evidence remain intact and readable.

begin;

update public.workshop_occurrences
set venmo_enabled = false
where venmo_enabled;

update public.workshop_occurrences
set status = 'registration_closed'
where status = 'published_open'
  and not stripe_enabled;

alter table public.workshop_occurrences
  add constraint workshop_occurrences_stripe_only
  check (not venmo_enabled);

alter table public.workshop_occurrences
  add constraint workshop_occurrences_open_requires_stripe
  check (status <> 'published_open' or stripe_enabled);

alter function public.switch_workshop_payment_method(
  text, text, uuid, text, integer, integer
) rename to switch_workshop_payment_method_before_stripe_only;

revoke all on function public.switch_workshop_payment_method_before_stripe_only(
  text, text, uuid, text, integer, integer
) from public;
revoke all on function public.switch_workshop_payment_method_before_stripe_only(
  text, text, uuid, text, integer, integer
) from service_role;

create function public.switch_workshop_payment_method(
  p_status_token_digest text,
  p_method text,
  p_command_key uuid,
  p_venmo_target text default null,
  p_stripe_hold_minutes integer default 15,
  p_venmo_hold_hours integer default 24
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_method <> 'stripe' then
    raise exception 'invalid_request';
  end if;

  return public.switch_workshop_payment_method_before_stripe_only(
    p_status_token_digest,
    'stripe',
    p_command_key,
    null,
    p_stripe_hold_minutes,
    p_venmo_hold_hours
  );
end;
$$;

revoke all on function public.switch_workshop_payment_method(
  text, text, uuid, text, integer, integer
) from public;
grant execute on function public.switch_workshop_payment_method(
  text, text, uuid, text, integer, integer
) to service_role;

comment on constraint workshop_occurrences_stripe_only
  on public.workshop_occurrences is
  'New workshop occurrences cannot authorize direct Venmo checkout.';
comment on constraint workshop_occurrences_open_requires_stripe
  on public.workshop_occurrences is
  'Publicly open workshop occurrences must support Stripe Checkout.';

commit;
