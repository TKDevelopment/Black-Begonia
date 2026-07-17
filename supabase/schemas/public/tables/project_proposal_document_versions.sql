create table public.project_proposal_document_versions (
  project_proposal_document_version_id uuid not null default gen_random_uuid (),
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
  constraint project_proposal_document_versions_project_version_unique unique (project_id, version),
  constraint project_proposal_document_versions_invoice_snapshot_id_fkey foreign KEY (invoice_snapshot_id) references project_proposal_invoice_snapshots (project_proposal_invoice_snapshot_id) on delete set null,
  constraint project_proposal_document_versions_project_id_fkey foreign KEY (project_id) references projects (project_id) on delete CASCADE,
  constraint project_proposal_document_versions_source_floral_proposal_id_fkey foreign KEY (source_floral_proposal_id) references floral_proposals (floral_proposal_id) on delete set null,
  constraint project_proposal_document_versions_source_lead_id_fkey foreign KEY (source_lead_id) references leads (lead_id) on delete set null,
  constraint project_proposal_document_versions_uploaded_by_fkey foreign KEY (uploaded_by) references profiles (id) on delete set null
) TABLESPACE pg_default;

create unique index IF not exists idx_project_document_versions_one_active
on public.project_proposal_document_versions using btree (project_id)
where is_active;

create unique index IF not exists idx_project_document_versions_storage_path
on public.project_proposal_document_versions using btree (storage_bucket, storage_path)
TABLESPACE pg_default;

create index IF not exists idx_project_document_versions_project_id
on public.project_proposal_document_versions using btree (project_id, created_at desc)
TABLESPACE pg_default;
