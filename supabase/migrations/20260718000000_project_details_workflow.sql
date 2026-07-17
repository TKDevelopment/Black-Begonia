begin;

alter type public.project_status rename to project_status_old;

create type public.project_status as enum (
  'awaiting_deposit',
  'booked',
  'awaiting_final_payment',
  'final_prep',
  'completed',
  'canceled'
);

alter table public.projects
  alter column status drop default;

alter table public.projects
  alter column status type public.project_status
  using (
    case status::text
      when 'completed' then 'completed'
      when 'canceled' then 'canceled'
      when 'booked' then 'booked'
      else 'awaiting_deposit'
    end
  )::public.project_status;

alter table public.projects
  alter column status set default 'awaiting_deposit'::public.project_status;

drop type public.project_status_old;

alter type public.activity_type add value if not exists 'payment_recorded';
alter type public.activity_type add value if not exists 'proposal_revision_submitted';
alter type public.activity_type add value if not exists 'proposal_document_submitted';
alter type public.activity_type add value if not exists 'active_invoice_snapshot_changed';

create table if not exists public.project_payment_records (
  project_payment_record_id uuid not null default gen_random_uuid (),
  project_id uuid not null,
  payment_kind text not null,
  status text not null default 'not_due',
  amount_due numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null default 0,
  due_date date null,
  paid_date timestamp with time zone null,
  payment_method text null,
  payment_source text not null default 'manual',
  external_payment_id text null,
  notes text null,
  recorded_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint project_payment_records_pkey primary key (project_payment_record_id),
  constraint project_payment_records_project_id_fkey foreign key (project_id) references public.projects (project_id) on delete cascade,
  constraint project_payment_records_recorded_by_fkey foreign key (recorded_by) references public.profiles (id) on delete set null,
  constraint project_payment_records_kind_check check (payment_kind in ('deposit', 'final_payment')),
  constraint project_payment_records_status_check check (status in ('not_due', 'due', 'paid', 'waived', 'canceled')),
  constraint project_payment_records_method_check check (payment_method is null or payment_method in ('stripe', 'venmo', 'check', 'cash', 'other')),
  constraint project_payment_records_source_check check (payment_source in ('manual', 'stripe', 'imported')),
  constraint project_payment_records_paid_check check (
    status <> 'paid'
    or (paid_date is not null and amount_paid > 0 and payment_method is not null)
  )
);

create index if not exists idx_project_payment_records_project_id on public.project_payment_records using btree (project_id);
create index if not exists idx_project_payment_records_project_kind on public.project_payment_records using btree (project_id, payment_kind);

alter table public.project_payment_records enable row level security;

drop policy if exists "Internal CRM users can read project payment records" on public.project_payment_records;
create policy "Internal CRM users can read project payment records"
on public.project_payment_records
for select
to authenticated
using (public.is_internal_crm_user());

drop policy if exists "Internal CRM users can insert project payment records" on public.project_payment_records;
create policy "Internal CRM users can insert project payment records"
on public.project_payment_records
for insert
to authenticated
with check (public.is_internal_crm_user());

drop policy if exists "Internal CRM users can update project payment records" on public.project_payment_records;
create policy "Internal CRM users can update project payment records"
on public.project_payment_records
for update
to authenticated
using (public.is_internal_crm_user())
with check (public.is_internal_crm_user());

drop trigger if exists trg_project_payment_records_set_updated_at on public.project_payment_records;
create trigger trg_project_payment_records_set_updated_at before
update on public.project_payment_records for each row
execute function public.set_updated_at ();

create or replace function public.refresh_project_payment_statuses(target_project_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.projects p
  set status = 'awaiting_final_payment'::public.project_status,
      updated_at = now()
  where p.status = 'booked'::public.project_status
    and p.event_date is not null
    and p.event_date <= (current_date + interval '45 days')::date
    and (target_project_id is null or p.project_id = target_project_id)
    and not exists (
      select 1
      from public.project_payment_records r
      where r.project_id = p.project_id
        and r.payment_kind = 'final_payment'
        and r.status = 'paid'
    );
end;
$$;

commit;
