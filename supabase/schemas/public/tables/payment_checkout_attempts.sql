create table public.payment_checkout_attempts (
  payment_checkout_attempt_id uuid primary key default gen_random_uuid(),
  payment_request_id uuid not null references public.payment_requests(payment_request_id) on delete cascade,
  project_id uuid not null references public.projects(project_id) on delete cascade,
  method text not null check (method in ('stripe_card','paypal_venmo')),
  status text not null default 'creating' check (status in ('creating','active','processing','paid','failed','expired','canceled')),
  principal_amount numeric(12,2) not null check (principal_amount > 0),
  customer_fee numeric(12,2) not null default 0 check (customer_fee = 0),
  charge_amount numeric(12,2) not null check (charge_amount = principal_amount),
  fee_policy_decision text not null default 'disabled' check (fee_policy_decision='disabled'),
  fee_policy_reason text not null default 'Customer card surcharging is disabled for this release.',
  provider_session_id text null unique,
  provider_order_id text null unique,
  provider_payment_id text null unique,
  provider_capture_id text null unique,
  provider_handoff_url text null,
  provider_client_token text null,
  create_idempotency_key text not null unique,
  capture_idempotency_key text null unique,
  expires_at timestamptz not null,
  resolved_at timestamptz null,
  canceled_at timestamptz null,
  canceled_by uuid null references public.profiles(id) on delete set null,
  canceled_reason text null,
  last_verified_state text null,
  retention_eligible_at timestamptz null default (now() + interval '7 years'),
  created_at timestamptz not null default now()
);
create unique index uq_payment_checkout_attempts_active_request on public.payment_checkout_attempts(payment_request_id) where status in ('creating','active','processing');
alter table public.payment_checkout_attempts enable row level security;
create policy payment_checkout_attempts_internal_select on public.payment_checkout_attempts for select to authenticated using (public.is_internal_crm_user());
