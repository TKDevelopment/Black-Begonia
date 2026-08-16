create table public.workshop_refund_requests (
  workshop_refund_request_id uuid primary key default gen_random_uuid(),
  workshop_payment_transaction_id uuid not null
    references public.workshop_payment_transactions(workshop_payment_transaction_id)
    on delete restrict,
  workshop_booking_id uuid not null
    references public.workshop_bookings(workshop_booking_id) on delete restrict,
  workshop_occurrence_id uuid not null
    references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  seat_quantity integer null check (seat_quantity > 0),
  currency text not null check (currency = 'USD'),
  reason text not null check (reason in (
    'customer_requested','duplicate','fraudulent','event_cancelled','other'
  )),
  state text not null default 'requested' check (state in (
    'requested','provider_accepted','provider_failed','reconciled'
  )),
  provider_refund_id text null unique,
  safe_failure text null,
  command_key uuid not null unique,
  requested_by uuid null references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  provider_accepted_at timestamptz null,
  reconciled_at timestamptz null,
  seats_released_at timestamptz null,
  updated_at timestamptz not null default now()
);
create index idx_workshop_refund_requests_charge
on public.workshop_refund_requests (workshop_payment_transaction_id, state);
create trigger trg_workshop_refund_requests_updated_at
before update on public.workshop_refund_requests
for each row execute function public.set_updated_at();
alter table public.workshop_refund_requests enable row level security;
create policy workshop_refund_requests_internal_select
on public.workshop_refund_requests for select to authenticated
using (public.is_internal_crm_user());
revoke all on public.workshop_refund_requests from anon;
grant select on public.workshop_refund_requests to authenticated;
