create table public.project_contacts (
  project_contact_id uuid not null default gen_random_uuid (),
  project_id uuid not null,
  contact_id uuid not null,
  relationship_type public.project_contact_relationship not null,
  is_primary boolean not null default false,
  created_at timestamp with time zone not null default now(),
  constraint project_contacts_pkey primary key (project_contact_id),
  constraint project_contacts_unique unique (project_id, contact_id, relationship_type),
  constraint project_contacts_contact_id_fkey foreign KEY (contact_id) references contacts (contact_id) on delete CASCADE,
  constraint project_contacts_project_id_fkey foreign KEY (project_id) references projects (project_id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_project_contacts_project_id on public.project_contacts using btree (project_id) TABLESPACE pg_default;

create index IF not exists idx_project_contacts_contact_id on public.project_contacts using btree (contact_id) TABLESPACE pg_default;