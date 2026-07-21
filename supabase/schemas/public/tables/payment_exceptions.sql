create table public.payment_exceptions (
  payment_exception_id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(project_id) on delete cascade,
  obligation_id uuid null references public.project_payment_records(project_payment_record_id) on delete set null,
  payment_request_id uuid null references public.payment_requests(payment_request_id) on delete set null,
  payment_checkout_attempt_id uuid null references public.payment_checkout_attempts(payment_checkout_attempt_id) on delete set null,
  payment_transaction_id uuid null references public.payment_transactions(payment_transaction_id) on delete set null,
  payment_provider_event_id uuid null references public.payment_provider_events(payment_provider_event_id) on delete set null,
  exception_type text not null check (exception_type in ('legacy_ambiguity','unmatched_provider_event','suspected_duplicate','overpayment','adjustment_reopened_balance','delivery_unknown','reconciliation_failure','status_transition_failure')),
  urgency text not null default 'normal' check (urgency in ('normal','urgent')),
  state text not null default 'open' check (state in ('open','acknowledged','resolved')),
  amount numeric(12,2) null,
  summary text not null,
  redacted_detail text null,
  resolution text null check (resolution is null or resolution in ('external_refund','retained_credit','correction','matched','dismissed','status_reviewed')),
  resolution_reference text null,
  retained_unapplied_credit numeric(12,2) not null default 0,
  resolved_by uuid null references public.profiles(id) on delete set null,
  resolved_at timestamptz null,
  retention_eligible_at timestamptz null default (now() + interval '7 years'),
  created_at timestamptz not null default now()
);
create index idx_payment_exceptions_open on public.payment_exceptions(state, urgency, created_at);
alter table public.payment_exceptions enable row level security;
create policy payment_exceptions_internal_select on public.payment_exceptions for select to authenticated using (public.is_internal_crm_user());
