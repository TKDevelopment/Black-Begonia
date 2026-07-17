create table public.project_payment_records (
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
  constraint project_payment_records_project_id_fkey foreign key (project_id) references projects (project_id) on delete cascade,
  constraint project_payment_records_recorded_by_fkey foreign key (recorded_by) references profiles (id) on delete set null,
  constraint project_payment_records_kind_check check (payment_kind in ('deposit', 'final_payment')),
  constraint project_payment_records_status_check check (status in ('not_due', 'due', 'paid', 'waived', 'canceled')),
  constraint project_payment_records_method_check check (payment_method is null or payment_method in ('stripe', 'venmo', 'check', 'cash', 'other')),
  constraint project_payment_records_source_check check (payment_source in ('manual', 'stripe', 'imported')),
  constraint project_payment_records_paid_check check (
    status <> 'paid'
    or (paid_date is not null and amount_paid > 0 and payment_method is not null)
  )
) tablespace pg_default;

create index if not exists idx_project_payment_records_project_id on public.project_payment_records using btree (project_id) tablespace pg_default;
create index if not exists idx_project_payment_records_project_kind on public.project_payment_records using btree (project_id, payment_kind) tablespace pg_default;

create trigger trg_project_payment_records_set_updated_at before
update on project_payment_records for each row
execute function set_updated_at ();
