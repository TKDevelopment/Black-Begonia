create table public.workshop_payment_provider_events (
  workshop_payment_provider_event_id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'stripe'),
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
  workshop_payment_attempt_id uuid null references public.workshop_payment_attempts(workshop_payment_attempt_id) on delete restrict,
  workshop_payment_transaction_id uuid null references public.workshop_payment_transactions(workshop_payment_transaction_id) on delete restrict,
  received_at timestamptz not null default now(),
  processed_at timestamptz null,
  unique (provider, provider_event_id)
);
create unique index uq_workshop_provider_event_effect
on public.workshop_payment_provider_events (provider, provider_object_id, event_type)
where provider_object_id is not null and processing_state = 'processed';
create trigger trg_workshop_payment_provider_events_no_delete
before delete on public.workshop_payment_provider_events
for each row execute function public.reject_workshop_immutable_change();
alter table public.workshop_payment_provider_events enable row level security;
create policy workshop_provider_events_internal_select on public.workshop_payment_provider_events for select to authenticated using (public.is_internal_crm_user());
revoke all on public.workshop_payment_provider_events from anon;
grant select on public.workshop_payment_provider_events to authenticated;
