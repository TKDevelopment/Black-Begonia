create table public.project_organizations (
  project_organization_id uuid not null default gen_random_uuid (),
  project_id uuid not null,
  organization_id uuid not null,
  relationship_type public.project_organization_relationship not null,
  created_at timestamp with time zone not null default now(),
  constraint project_organizations_pkey primary key (project_organization_id),
  constraint project_organizations_unique unique (project_id, organization_id, relationship_type),
  constraint project_organizations_organization_id_fkey foreign KEY (organization_id) references organizations (organization_id) on delete CASCADE,
  constraint project_organizations_project_id_fkey foreign KEY (project_id) references projects (project_id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_project_organizations_project_id on public.project_organizations using btree (project_id) TABLESPACE pg_default;

create index IF not exists idx_project_organizations_organization_id on public.project_organizations using btree (organization_id) TABLESPACE pg_default;