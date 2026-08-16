create table public.workshop_expenses (
  workshop_expense_id uuid primary key default gen_random_uuid(),
  workshop_occurrence_id uuid null references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  workshop_series_id uuid null references public.workshop_series(workshop_series_id) on delete restrict,
  expense_category text not null check (expense_category in (
    'materials','venue','labor','marketing','travel','equipment','fees','other'
  )),
  description text not null,
  vendor_or_payee text null,
  note text null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency = 'USD'),
  incurred_on date not null,
  receipt_storage_path text null,
  command_key uuid not null unique,
  correction_of_expense_id uuid null references public.workshop_expenses(workshop_expense_id) on delete restrict,
  is_reversal boolean not null default false,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint workshop_expense_scope check (
    (workshop_occurrence_id is not null)::integer
      + (workshop_series_id is not null)::integer = 1
  )
);
create index idx_workshop_expenses_occurrence on public.workshop_expenses (workshop_occurrence_id, incurred_on desc);
create index idx_workshop_expenses_series on public.workshop_expenses (workshop_series_id, incurred_on desc);
create unique index uq_workshop_expense_reversal
on public.workshop_expenses (correction_of_expense_id)
where is_reversal;
create trigger trg_workshop_expenses_immutable
before update or delete on public.workshop_expenses
for each row execute function public.reject_workshop_immutable_change();
alter table public.workshop_expenses enable row level security;
create policy workshop_expenses_internal_select on public.workshop_expenses for select to authenticated using (public.is_internal_crm_user());
revoke all on public.workshop_expenses from anon;
grant select on public.workshop_expenses to authenticated;
