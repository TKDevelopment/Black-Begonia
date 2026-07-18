create table public.project_proposal_invoice_snapshots (
  project_proposal_invoice_snapshot_id uuid not null default gen_random_uuid (),
  project_id uuid not null,
  source_lead_id uuid null,
  source_floral_proposal_id uuid null,
  version integer not null,
  snapshot jsonb not null default '{}'::jsonb,
  subtotal numeric(12, 2) not null default 0,
  tax_rate numeric(8, 4) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  retainer_amount numeric(12, 2) not null default 0,
  final_balance_amount numeric(12, 2) not null default 0,
  retainer_due_date date null,
  final_balance_due_date date null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  is_active boolean not null default true,
  submission_idempotency_key uuid null,
  constraint project_proposal_invoice_snapshots_pkey primary key (project_proposal_invoice_snapshot_id),
  constraint project_proposal_invoice_snapshots_project_version_unique unique (project_id, version),
  constraint project_proposal_invoice_snapshots_created_by_fkey foreign KEY (created_by) references profiles (id) on delete set null,
  constraint project_proposal_invoice_snapshots_project_id_fkey foreign KEY (project_id) references projects (project_id) on delete CASCADE,
  constraint project_proposal_invoice_snapshots_source_floral_proposal_id_fkey foreign KEY (source_floral_proposal_id) references floral_proposals (floral_proposal_id) on delete set null,
  constraint project_proposal_invoice_snapshots_source_lead_id_fkey foreign KEY (source_lead_id) references leads (lead_id) on delete set null
) TABLESPACE pg_default;

create unique index IF not exists idx_project_invoice_snapshots_one_active
on public.project_proposal_invoice_snapshots using btree (project_id)
where is_active;

create index IF not exists idx_project_invoice_snapshots_project_id
on public.project_proposal_invoice_snapshots using btree (project_id, created_at desc)
TABLESPACE pg_default;

create unique index IF not exists idx_project_invoice_snapshots_submission_key
on public.project_proposal_invoice_snapshots (submission_idempotency_key)
where submission_idempotency_key is not null;

alter table public.project_proposal_invoice_snapshots enable row level security;

create policy "internal crm users select project proposal invoice snapshots"
on public.project_proposal_invoice_snapshots for select to authenticated
using (public.is_internal_crm_user());

create policy "internal crm users insert project proposal invoice snapshots"
on public.project_proposal_invoice_snapshots for insert to authenticated
with check (public.is_internal_crm_user());
