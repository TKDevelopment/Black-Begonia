create table public.payment_message_deliveries (
  payment_message_delivery_id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(project_id) on delete cascade,
  obligation_id uuid null references public.project_payment_records(project_payment_record_id) on delete set null,
  payment_request_id uuid null references public.payment_requests(payment_request_id) on delete set null,
  payment_transaction_id uuid null references public.payment_transactions(payment_transaction_id) on delete set null,
  delivery_kind text not null check (delivery_kind in ('initial_request','deposit_reminder','final_reminder','receipt','adjustment_notice')),
  occurrence_key text not null,
  scheduled_local_date date null,
  scheduled_timezone text null,
  recipient_contact_id uuid null references public.contacts(contact_id) on delete set null,
  recipient_email text null,
  recipient_fallback_used boolean not null default false,
  principal_amount numeric(12,2) not null default 0,
  customer_fee numeric(12,2) not null default 0,
  status text not null default 'queued' check (status in ('queued','claimed','accepted','delivered','temporary_failed','permanent_failed','suppressed','delivery_unknown','canceled')),
  attempt_number integer not null default 1,
  retry_of_delivery_id uuid null references public.payment_message_deliveries(payment_message_delivery_id) on delete set null,
  mailgun_message_id text null unique,
  claimed_at timestamptz null,
  sent_at timestamptz null,
  accepted_at timestamptz null,
  delivered_at timestamptz null,
  failed_at timestamptz null,
  failure_class text null,
  redacted_error text null,
  suppression_reason text null,
  retention_eligible_at timestamptz null default (now() + interval '7 years'),
  created_at timestamptz not null default now(),
  unique (occurrence_key, attempt_number)
);
create index idx_payment_message_deliveries_claim on public.payment_message_deliveries(status, scheduled_local_date, created_at);
alter table public.payment_message_deliveries enable row level security;
create policy payment_message_deliveries_internal_select on public.payment_message_deliveries for select to authenticated using (public.is_internal_crm_user());
