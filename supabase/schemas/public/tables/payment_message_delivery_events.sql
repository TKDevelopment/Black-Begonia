create table public.payment_message_delivery_events (
  payment_message_delivery_event_id uuid primary key default gen_random_uuid(),
  payment_message_delivery_id uuid not null references public.payment_message_deliveries(payment_message_delivery_id) on delete cascade,
  provider_event_identity text not null unique,
  event_type text not null,
  provider_timestamp timestamptz not null,
  signature_verified_at timestamptz not null,
  payload_digest text not null,
  normalized_facts jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);
alter table public.payment_message_delivery_events enable row level security;
create policy payment_message_delivery_events_internal_select on public.payment_message_delivery_events for select to authenticated using (public.is_internal_crm_user());
