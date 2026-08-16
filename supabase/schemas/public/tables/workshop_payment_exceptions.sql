create table public.workshop_payment_exceptions (
  workshop_payment_exception_id uuid primary key default gen_random_uuid(),
  workshop_booking_id uuid null references public.workshop_bookings(workshop_booking_id) on delete restrict,
  workshop_occurrence_id uuid null references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  workshop_payment_attempt_id uuid null references public.workshop_payment_attempts(workshop_payment_attempt_id) on delete restrict,
  workshop_payment_transaction_id uuid null references public.workshop_payment_transactions(workshop_payment_transaction_id) on delete restrict,
  exception_type text not null,
  urgency text not null default 'normal' check (urgency in ('normal','urgent')),
  state text not null default 'open' check (state in ('open','acknowledged','resolved')),
  amount_minor bigint null,
  currency text null check (currency is null or currency = 'USD'),
  summary text not null,
  safe_detail text null,
  provider_event_id uuid null references public.workshop_payment_provider_events(workshop_payment_provider_event_id) on delete restrict,
  assigned_to uuid null references public.profiles(id) on delete set null,
  command_key uuid not null unique,
  resolution text null,
  resolution_reference text null,
  customer_action_deadline timestamptz null,
  resolved_by uuid null references public.profiles(id) on delete set null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_workshop_exceptions_open on public.workshop_payment_exceptions (workshop_occurrence_id, created_at)
where state in ('open','acknowledged');
create trigger trg_workshop_payment_exceptions_updated_at before update on public.workshop_payment_exceptions
for each row execute function public.set_updated_at();
alter table public.workshop_payment_exceptions enable row level security;
create policy workshop_exceptions_internal_select on public.workshop_payment_exceptions for select to authenticated using (public.is_internal_crm_user());
revoke all on public.workshop_payment_exceptions from anon;
grant select on public.workshop_payment_exceptions to authenticated;
