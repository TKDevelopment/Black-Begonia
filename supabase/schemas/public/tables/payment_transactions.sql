create sequence if not exists public.payment_reference_sequence;
create table public.payment_transactions (
  payment_transaction_id uuid primary key default gen_random_uuid(),
  payment_reference text not null unique,
  project_id uuid not null references public.projects(project_id) on delete restrict,
  payment_request_id uuid null references public.payment_requests(payment_request_id) on delete set null,
  payment_checkout_attempt_id uuid null references public.payment_checkout_attempts(payment_checkout_attempt_id) on delete set null,
  kind text not null check (kind in ('receipt','refund','reversal','dispute','void','correction','credit_allocation','external_refund')),
  status text not null check (status in ('pending','confirmed','failed','resolved')),
  principal_amount numeric(12,2) not null,
  customer_fee numeric(12,2) not null default 0,
  merchant_fee numeric(12,2) null,
  method text not null,
  source text not null check (source in ('manual','stripe','paypal','imported','system')),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  actor_type text not null check (actor_type in ('florist','customer','provider','schedule','system')),
  actor_id uuid null,
  provider_reference text null,
  command_key uuid null unique,
  duplicate_override boolean not null default false,
  duplicate_override_reason text null,
  suspected_reference text null,
  customer_notice_policy text not null default 'none' check (customer_notice_policy in ('required','optional','none')),
  customer_notice_state text not null default 'not_queued',
  note text null,
  payload_digest text null,
  normalized_facts jsonb not null default '{}'::jsonb,
  retention_eligible_at timestamptz null default (now() + interval '7 years'),
  constraint payment_transactions_duplicate_override_check check (not duplicate_override or (nullif(btrim(duplicate_override_reason),'') is not null and nullif(btrim(suspected_reference),'') is not null))
);
create unique index uq_payment_transactions_provider_reference on public.payment_transactions(source, provider_reference) where provider_reference is not null;
alter table public.payment_transactions enable row level security;
create policy payment_transactions_internal_select on public.payment_transactions for select to authenticated using (public.is_internal_crm_user());
