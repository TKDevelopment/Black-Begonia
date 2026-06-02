create table public.organizations (
  organization_id uuid not null default gen_random_uuid (),
  name text not null,
  organization_type public.organization_type not null,
  email text null,
  phone text null,
  website text null,
  address_line_1 text null,
  address_line_2 text null,
  city text null,
  state text null,
  postal_code text null,
  country text null default 'US'::text,
  notes text null,
  created_from_lead_id uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  is_archived boolean not null default false,
  archived_at timestamp with time zone null,
  constraint organizations_pkey primary key (organization_id),
  constraint organizations_created_from_lead_id_fkey foreign KEY (created_from_lead_id) references leads (lead_id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_organizations_name on public.organizations using btree (name) TABLESPACE pg_default;

create index IF not exists idx_organizations_type on public.organizations using btree (organization_type) TABLESPACE pg_default;

create trigger trg_organizations_set_updated_at BEFORE
update on organizations for EACH row
execute FUNCTION set_updated_at ();