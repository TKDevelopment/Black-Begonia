create table public.payment_provider_events (
  payment_provider_event_id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe','paypal')),
  provider_event_id text not null,
  provider_object_id text null,
  provider_object_type text null,
  event_type text not null,
  event_occurred_at timestamptz not null,
  signature_verified_at timestamptz not null,
  payload_digest text not null,
  normalized_facts jsonb not null default '{}'::jsonb,
  processing_state text not null default 'received' check (processing_state in ('received','processed','duplicate','failed','unmatched')),
  processing_error text null,
  payment_checkout_attempt_id uuid null references public.payment_checkout_attempts(payment_checkout_attempt_id) on delete set null,
  payment_transaction_id uuid null references public.payment_transactions(payment_transaction_id) on delete set null,
  received_at timestamptz not null default now(),
  processed_at timestamptz null,
  retention_eligible_at timestamptz null default (now() + interval '7 years'),
  unique (provider, provider_event_id)
);
create unique index uq_payment_provider_events_object_effect on public.payment_provider_events(provider, provider_object_id, event_type) where provider_object_id is not null and processing_state='processed';
alter table public.payment_provider_events enable row level security;
create policy payment_provider_events_internal_select on public.payment_provider_events for select to authenticated using (public.is_internal_crm_user());
