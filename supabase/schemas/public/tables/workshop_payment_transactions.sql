create or replace function public.reject_workshop_immutable_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Workshop financial history is immutable.' using errcode = '55000';
end;
$$;

create table public.workshop_payment_transactions (
  workshop_payment_transaction_id uuid primary key default gen_random_uuid(),
  workshop_booking_id uuid not null references public.workshop_bookings(workshop_booking_id) on delete restrict,
  workshop_occurrence_id uuid not null references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  workshop_payment_attempt_id uuid null references public.workshop_payment_attempts(workshop_payment_attempt_id) on delete restrict,
  transaction_type text not null check (transaction_type in (
    'charge','refund','external_refund','fee','discount','dispute','reversal',
    'adjustment','correction'
  )),
  provider text not null check (provider in ('stripe','direct_venmo','manual')),
  provider_transaction_id text null,
  payment_reference text not null unique,
  amount_minor bigint not null,
  currency text not null check (currency = 'USD'),
  occurred_at timestamptz not null,
  state text not null check (state in ('pending','processing','paid','partially_refunded','refunded','disputed','reversed','exception')),
  command_key uuid null unique,
  payload_digest text null,
  normalized_facts jsonb not null default '{}'::jsonb,
  actor_type text not null default 'provider'
    check (actor_type in ('provider','internal','system')),
  actor_id uuid null references public.profiles(id) on delete set null,
  note text null,
  created_at timestamptz not null default now()
);
create unique index uq_workshop_transactions_provider
on public.workshop_payment_transactions (provider, provider_transaction_id, transaction_type)
where provider_transaction_id is not null;
create index idx_workshop_transactions_occurrence on public.workshop_payment_transactions (workshop_occurrence_id, occurred_at desc);
create trigger trg_workshop_payment_transactions_immutable
before update or delete on public.workshop_payment_transactions
for each row execute function public.reject_workshop_immutable_change();
alter table public.workshop_payment_transactions enable row level security;
create policy workshop_transactions_internal_select on public.workshop_payment_transactions for select to authenticated using (public.is_internal_crm_user());
revoke all on public.workshop_payment_transactions from anon;
grant select on public.workshop_payment_transactions to authenticated;
