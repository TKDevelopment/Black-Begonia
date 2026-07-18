create table public.project_proposal_revision_workspaces (
  project_proposal_revision_workspace_id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(project_id) on delete cascade,
  baseline_invoice_snapshot_id uuid not null references public.project_proposal_invoice_snapshots(project_proposal_invoice_snapshot_id) on delete restrict,
  source_lead_id uuid null references public.leads(lead_id) on delete set null,
  schema_version integer not null default 2 check (schema_version > 0),
  draft_snapshot jsonb not null,
  subtotal numeric(12, 2) not null default 0,
  tax_rate numeric(8, 4) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  retainer_amount numeric(12, 2) not null default 0,
  final_balance_amount numeric(12, 2) not null default 0,
  retainer_due_date date null,
  final_balance_due_date date null,
  pending_submission_key uuid null,
  pending_pdf_storage_path text null,
  pending_pdf_file_name text null,
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_proposal_revision_workspace_pending_metadata_check check (
    (pending_submission_key is null and pending_pdf_storage_path is null and pending_pdf_file_name is null)
    or
    (pending_submission_key is not null and pending_pdf_storage_path is not null and pending_pdf_file_name is not null)
  )
);

create index idx_project_proposal_revision_workspaces_baseline
on public.project_proposal_revision_workspaces (baseline_invoice_snapshot_id);

create trigger trg_project_proposal_revision_workspaces_updated_at
before update on public.project_proposal_revision_workspaces
for each row execute function public.set_updated_at();

alter table public.project_proposal_revision_workspaces enable row level security;

create policy "internal crm users select proposal revision workspaces"
on public.project_proposal_revision_workspaces for select to authenticated
using (public.is_internal_crm_user());

create policy "internal crm users insert proposal revision workspaces"
on public.project_proposal_revision_workspaces for insert to authenticated
with check (public.is_internal_crm_user());

create policy "internal crm users update proposal revision workspaces"
on public.project_proposal_revision_workspaces for update to authenticated
using (public.is_internal_crm_user())
with check (public.is_internal_crm_user());

create policy "internal crm users discard proposal revision workspaces"
on public.project_proposal_revision_workspaces for delete to authenticated
using (public.is_internal_crm_user());
