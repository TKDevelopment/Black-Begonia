create table public.payment_transaction_allocations (
  payment_transaction_allocation_id uuid primary key default gen_random_uuid(),
  payment_transaction_id uuid not null references public.payment_transactions(payment_transaction_id) on delete restrict,
  obligation_id uuid not null references public.project_payment_records(project_payment_record_id) on delete restrict,
  allocated_principal numeric(12,2) not null check (allocated_principal <> 0),
  sequence smallint not null check (sequence between 1 and 2),
  created_at timestamptz not null default now(),
  unique (payment_transaction_id, obligation_id, sequence)
);
alter table public.payment_transaction_allocations enable row level security;
create policy payment_transaction_allocations_internal_select on public.payment_transaction_allocations for select to authenticated using (public.is_internal_crm_user());
