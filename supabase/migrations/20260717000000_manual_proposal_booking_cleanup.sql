-- Manual proposal booking cleanup.
-- Removes retired signing/portal schema and adds project-owned proposal history.

drop table if exists public.proposal_signing_sessions cascade;

alter table if exists public.floral_proposals
  drop column if exists passcode_hash,
  drop column if exists pdf_storage_path,
  drop column if exists pdf_url,
  drop column if exists canva_pdf_storage_path,
  drop column if exists canva_pdf_file_name,
  drop column if exists combined_pdf_storage_path,
  drop column if exists combined_pdf_file_name,
  drop column if exists contract_template_source,
  drop column if exists contract_template_revision,
  drop column if exists signing_provider,
  drop column if exists signing_status,
  drop column if exists signing_session_reference,
  drop column if exists signed_package_storage_path,
  drop column if exists signing_completed_at,
  drop column if exists signing_declined_at,
  drop column if exists accepted_terms,
  drop column if exists accepted_privacy_policy,
  drop column if exists accepted_at,
  drop column if exists declined_at,
  drop column if exists signed_at,
  drop column if exists signature_name,
  drop column if exists signature_ip,
  drop column if exists signature_user_agent,
  drop column if exists decline_feedback;

create table if not exists public.project_proposal_invoice_snapshots (
  project_proposal_invoice_snapshot_id uuid not null default gen_random_uuid(),
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
  constraint project_proposal_invoice_snapshots_pkey primary key (project_proposal_invoice_snapshot_id),
  constraint project_proposal_invoice_snapshots_project_id_fkey foreign key (project_id) references public.projects (project_id) on delete cascade,
  constraint project_proposal_invoice_snapshots_source_lead_id_fkey foreign key (source_lead_id) references public.leads (lead_id) on delete set null,
  constraint project_proposal_invoice_snapshots_source_floral_proposal_id_fkey foreign key (source_floral_proposal_id) references public.floral_proposals (floral_proposal_id) on delete set null,
  constraint project_proposal_invoice_snapshots_created_by_fkey foreign key (created_by) references public.profiles (id) on delete set null,
  constraint project_proposal_invoice_snapshots_project_version_unique unique (project_id, version)
);

create unique index if not exists idx_project_invoice_snapshots_one_active
on public.project_proposal_invoice_snapshots (project_id)
where is_active;

create index if not exists idx_project_invoice_snapshots_project_id
on public.project_proposal_invoice_snapshots (project_id, created_at desc);

create table if not exists public.project_proposal_document_versions (
  project_proposal_document_version_id uuid not null default gen_random_uuid(),
  project_id uuid not null,
  source_lead_id uuid null,
  source_floral_proposal_id uuid null,
  invoice_snapshot_id uuid null,
  version integer not null,
  file_name text not null,
  storage_bucket text not null default 'floral-proposals'::text,
  storage_path text not null,
  content_type text not null default 'application/pdf'::text,
  file_size_bytes bigint null,
  uploaded_by uuid null,
  submitted_at timestamp with time zone not null default now(),
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint project_proposal_document_versions_pkey primary key (project_proposal_document_version_id),
  constraint project_proposal_document_versions_project_id_fkey foreign key (project_id) references public.projects (project_id) on delete cascade,
  constraint project_proposal_document_versions_source_lead_id_fkey foreign key (source_lead_id) references public.leads (lead_id) on delete set null,
  constraint project_proposal_document_versions_source_floral_proposal_id_fkey foreign key (source_floral_proposal_id) references public.floral_proposals (floral_proposal_id) on delete set null,
  constraint project_proposal_document_versions_invoice_snapshot_id_fkey foreign key (invoice_snapshot_id) references public.project_proposal_invoice_snapshots (project_proposal_invoice_snapshot_id) on delete set null,
  constraint project_proposal_document_versions_uploaded_by_fkey foreign key (uploaded_by) references public.profiles (id) on delete set null,
  constraint project_proposal_document_versions_project_version_unique unique (project_id, version)
);

create unique index if not exists idx_project_document_versions_one_active
on public.project_proposal_document_versions (project_id)
where is_active;

create unique index if not exists idx_project_document_versions_storage_path
on public.project_proposal_document_versions (storage_bucket, storage_path);

create index if not exists idx_project_document_versions_project_id
on public.project_proposal_document_versions (project_id, created_at desc);

alter table if exists public.projects
  add column if not exists active_proposal_invoice_snapshot_id uuid null,
  add column if not exists active_proposal_document_version_id uuid null;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'projects'
      and constraint_name = 'projects_active_proposal_invoice_snapshot_id_fkey'
  ) then
    alter table public.projects
      add constraint projects_active_proposal_invoice_snapshot_id_fkey
      foreign key (active_proposal_invoice_snapshot_id)
      references public.project_proposal_invoice_snapshots (project_proposal_invoice_snapshot_id)
      on delete set null;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'projects'
      and constraint_name = 'projects_active_proposal_document_version_id_fkey'
  ) then
    alter table public.projects
      add constraint projects_active_proposal_document_version_id_fkey
      foreign key (active_proposal_document_version_id)
      references public.project_proposal_document_versions (project_proposal_document_version_id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_projects_active_proposal_invoice_snapshot_id
on public.projects (active_proposal_invoice_snapshot_id);

create index if not exists idx_projects_active_proposal_document_version_id
on public.projects (active_proposal_document_version_id);

alter table public.project_proposal_invoice_snapshots enable row level security;
alter table public.project_proposal_document_versions enable row level security;

drop policy if exists "internal crm users select project proposal invoice snapshots" on public.project_proposal_invoice_snapshots;
create policy "internal crm users select project proposal invoice snapshots"
on public.project_proposal_invoice_snapshots for select to authenticated
using (public.is_internal_crm_user());

drop policy if exists "internal crm users insert project proposal invoice snapshots" on public.project_proposal_invoice_snapshots;
create policy "internal crm users insert project proposal invoice snapshots"
on public.project_proposal_invoice_snapshots for insert to authenticated
with check (public.is_internal_crm_user());

drop policy if exists "internal crm users update project proposal invoice snapshots" on public.project_proposal_invoice_snapshots;
create policy "internal crm users update project proposal invoice snapshots"
on public.project_proposal_invoice_snapshots for update to authenticated
using (public.is_internal_crm_user())
with check (public.is_internal_crm_user());

drop policy if exists "internal crm users delete project proposal invoice snapshots" on public.project_proposal_invoice_snapshots;
create policy "internal crm users delete project proposal invoice snapshots"
on public.project_proposal_invoice_snapshots for delete to authenticated
using (public.is_internal_crm_user());

drop policy if exists "internal crm users select project proposal document versions" on public.project_proposal_document_versions;
create policy "internal crm users select project proposal document versions"
on public.project_proposal_document_versions for select to authenticated
using (public.is_internal_crm_user());

drop policy if exists "internal crm users insert project proposal document versions" on public.project_proposal_document_versions;
create policy "internal crm users insert project proposal document versions"
on public.project_proposal_document_versions for insert to authenticated
with check (public.is_internal_crm_user());

drop policy if exists "internal crm users update project proposal document versions" on public.project_proposal_document_versions;
create policy "internal crm users update project proposal document versions"
on public.project_proposal_document_versions for update to authenticated
using (public.is_internal_crm_user())
with check (public.is_internal_crm_user());

drop policy if exists "internal crm users delete project proposal document versions" on public.project_proposal_document_versions;
create policy "internal crm users delete project proposal document versions"
on public.project_proposal_document_versions for delete to authenticated
using (public.is_internal_crm_user());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('floral-proposals', 'floral-proposals', false, 52428800, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "internal crm users upload floral proposal pdfs" on storage.objects;
drop policy if exists "internal crm users read floral proposal pdfs" on storage.objects;
drop policy if exists "internal crm users update floral proposal pdfs" on storage.objects;
drop policy if exists "internal crm users delete floral proposal pdfs" on storage.objects;
drop policy if exists "internal crm users upload project proposal pdfs" on storage.objects;
drop policy if exists "internal crm users read project proposal pdfs" on storage.objects;
drop policy if exists "internal crm users update project proposal pdfs" on storage.objects;
drop policy if exists "internal crm users delete project proposal pdfs" on storage.objects;

create policy "internal crm users upload project proposal pdfs"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'floral-proposals'
  and public.is_internal_crm_user()
);

create policy "internal crm users read project proposal pdfs"
on storage.objects for select to authenticated
using (
  bucket_id = 'floral-proposals'
  and public.is_internal_crm_user()
);

create policy "internal crm users update project proposal pdfs"
on storage.objects for update to authenticated
using (
  bucket_id = 'floral-proposals'
  and public.is_internal_crm_user()
)
with check (
  bucket_id = 'floral-proposals'
  and public.is_internal_crm_user()
);

create policy "internal crm users delete project proposal pdfs"
on storage.objects for delete to authenticated
using (
  bucket_id = 'floral-proposals'
  and public.is_internal_crm_user()
);
