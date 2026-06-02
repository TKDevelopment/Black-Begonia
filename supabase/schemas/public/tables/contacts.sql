create table public.contacts (
  contact_id uuid not null default gen_random_uuid (),
  first_name text not null,
  last_name text not null,
  email text null,
  phone text null,
  secondary_phone text null,
  preferred_contact_method public.preferred_contact_method null,
  address_line_1 text null,
  address_line_2 text null,
  city text null,
  state text null,
  postal_code text null,
  country text null default 'US'::text,
  contact_type public.contact_type not null default 'client'::contact_type,
  notes text null,
  created_from_lead_id uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  is_archived boolean not null default false,
  archived_at timestamp with time zone null,
  constraint contacts_pkey primary key (contact_id),
  constraint contacts_created_from_lead_id_fkey foreign KEY (created_from_lead_id) references leads (lead_id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_contacts_email on public.contacts using btree (email) TABLESPACE pg_default;

create index IF not exists idx_contacts_last_name on public.contacts using btree (last_name) TABLESPACE pg_default;

create index IF not exists idx_contacts_created_from_lead_id on public.contacts using btree (created_from_lead_id) TABLESPACE pg_default;

create trigger trg_contacts_set_updated_at BEFORE
update on contacts for EACH row
execute FUNCTION set_updated_at ();