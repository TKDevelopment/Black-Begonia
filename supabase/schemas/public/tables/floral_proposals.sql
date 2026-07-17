create table public.floral_proposals (
  floral_proposal_id uuid not null default gen_random_uuid (),
  lead_id uuid not null,
  -- Legacy template linkage retained only for historical records during workflow reset.
  -- New proposal-builder saves and florist-supplied PDF submissions should not rely on this field.
  template_id uuid null,
  tax_region_id uuid null,
  version smallint not null,
  is_active boolean not null default true,
  status public.floral_proposal_status not null default 'draft'::floral_proposal_status,
  customer_email text not null,
  subtotal numeric(12, 2) not null default 0,
  tax_rate numeric(8, 4) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  final_balance_amount numeric(12, 2) not null default 0,
  retainer_amount numeric(12, 2) not null default 0,
  final_balance_due_date date null,
  retainer_due_date date null,
  terms_version text not null default 'v1'::text,
  privacy_policy_version text not null default 'v1'::text,
  finalized_at timestamp with time zone null,
  edit_reopened_at timestamp with time zone null,
  submitted_at timestamp with time zone null,
  submitted_by uuid null,
  finalized_snapshot jsonb null,
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint floral_proposals_pkey primary key (floral_proposal_id),
  constraint floral_proposals_lead_version_unique unique (lead_id, version),
  constraint floral_proposals_created_by_fkey foreign KEY (created_by) references profiles (id) on delete set null,
  constraint floral_proposals_lead_id_fkey foreign KEY (lead_id) references leads (lead_id) on delete CASCADE,
  constraint floral_proposals_tax_region_id_fkey foreign KEY (tax_region_id) references tax_regions (tax_region_id) on delete set null,
  constraint floral_proposals_template_id_fkey foreign KEY (template_id) references document_templates (template_id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_floral_proposals_lead_id on public.floral_proposals using btree (lead_id) TABLESPACE pg_default;

create index IF not exists idx_floral_proposals_active on public.floral_proposals using btree (lead_id, is_active) TABLESPACE pg_default;

create index IF not exists idx_floral_proposals_status on public.floral_proposals using btree (status) TABLESPACE pg_default;

create trigger trg_floral_proposals_set_updated_at BEFORE
update on floral_proposals for EACH row
execute FUNCTION set_updated_at ();
