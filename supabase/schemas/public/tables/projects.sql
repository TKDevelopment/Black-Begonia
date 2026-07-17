create table public.projects (
  project_id uuid not null default gen_random_uuid (),
  project_name text not null,
  service_type public.service_type not null,
  event_type text null,
  event_date date null,
  ceremony_venue_name text null,
  ceremony_venue_city text null,
  ceremony_venue_state text null,
  budget_range text null,
  guest_count integer null,
  style_notes text null,
  internal_notes text null,
  status public.project_status not null default 'awaiting_deposit'::project_status,
  source_lead_id uuid null,
  primary_contact_id uuid null,
  assigned_user_id uuid null,
  active_proposal_invoice_snapshot_id uuid null,
  active_proposal_document_version_id uuid null,
  booked_at timestamp with time zone null,
  completed_at timestamp with time zone null,
  canceled_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  reception_venue_name text null,
  reception_venue_city text null,
  reception_venue_state text null,
  reception_venue_address text null,
  reception_venue_zipcode text null,
  ceremony_venue_address text null,
  ceremony_venue_zipcode text null,
  constraint projects_pkey primary key (project_id),
  constraint projects_active_proposal_document_version_id_fkey foreign KEY (active_proposal_document_version_id) references project_proposal_document_versions (project_proposal_document_version_id) on delete set null,
  constraint projects_active_proposal_invoice_snapshot_id_fkey foreign KEY (active_proposal_invoice_snapshot_id) references project_proposal_invoice_snapshots (project_proposal_invoice_snapshot_id) on delete set null,
  constraint projects_assigned_user_id_fkey foreign KEY (assigned_user_id) references profiles (id) on delete set null,
  constraint projects_primary_contact_id_fkey foreign KEY (primary_contact_id) references contacts (contact_id) on delete set null,
  constraint projects_source_lead_id_fkey foreign KEY (source_lead_id) references leads (lead_id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_projects_status on public.projects using btree (status) TABLESPACE pg_default;

create index IF not exists idx_projects_event_date on public.projects using btree (event_date) TABLESPACE pg_default;

create index IF not exists idx_projects_primary_contact_id on public.projects using btree (primary_contact_id) TABLESPACE pg_default;

create index IF not exists idx_projects_source_lead_id on public.projects using btree (source_lead_id) TABLESPACE pg_default;

create index IF not exists idx_projects_assigned_user_id on public.projects using btree (assigned_user_id) TABLESPACE pg_default;

create index IF not exists idx_projects_active_proposal_invoice_snapshot_id on public.projects using btree (active_proposal_invoice_snapshot_id) TABLESPACE pg_default;

create index IF not exists idx_projects_active_proposal_document_version_id on public.projects using btree (active_proposal_document_version_id) TABLESPACE pg_default;

create trigger trg_projects_set_updated_at BEFORE
update on projects for EACH row
execute FUNCTION set_updated_at ();
