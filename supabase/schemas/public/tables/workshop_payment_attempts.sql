create table public.workshop_payment_attempts (
  workshop_payment_attempt_id uuid primary key default gen_random_uuid(),
  workshop_booking_id uuid not null references public.workshop_bookings(workshop_booking_id) on delete restrict,
  workshop_seat_hold_id uuid not null references public.workshop_seat_holds(workshop_seat_hold_id) on delete restrict,
  provider text not null check (provider in ('stripe','direct_venmo')),
  provider_checkout_id text null,
  provider_payment_id text null,
  stripe_price_id text null,
  venmo_target_snapshot text null,
  reconciliation_reference text not null unique,
  quantity integer not null check (quantity > 0),
  state text not null default 'creating' check (
    state in ('creating','active','processing','paid','failed','expired','cancelled','superseded')
  ),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency = 'USD'),
  command_key uuid not null unique,
  normal_expires_at timestamptz not null,
  effective_expires_at timestamptz not null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workshop_payment_attempt_expiry check (effective_expires_at <= normal_expires_at),
  constraint workshop_payment_attempt_resolution check (
    (state in ('creating','active','processing') and resolved_at is null)
    or (state not in ('creating','active','processing') and resolved_at is not null)
  ),
  constraint workshop_payment_attempt_method_fields check (
    (provider = 'stripe' and venmo_target_snapshot is null)
    or (provider = 'direct_venmo' and venmo_target_snapshot is not null)
  )
);
create unique index uq_workshop_payment_attempt_provider_checkout
on public.workshop_payment_attempts (provider, provider_checkout_id) where provider_checkout_id is not null;
create index idx_workshop_payment_attempt_booking on public.workshop_payment_attempts (workshop_booking_id, created_at desc);
create unique index uq_workshop_payment_attempt_active
on public.workshop_payment_attempts (workshop_booking_id)
where state in ('creating','active','processing');
create trigger trg_workshop_payment_attempts_updated_at before update on public.workshop_payment_attempts
for each row execute function public.set_updated_at();
alter table public.workshop_payment_attempts enable row level security;
create policy workshop_payment_attempts_internal_select on public.workshop_payment_attempts for select to authenticated using (public.is_internal_crm_user());
revoke all on public.workshop_payment_attempts from anon;
grant select on public.workshop_payment_attempts to authenticated;
