create table public.proposal_contract_templates (
  proposal_contract_template_id uuid not null default gen_random_uuid (),
  provider text not null default 'signwell'::text,
  provider_template_id text not null,
  provider_template_name text not null,
  provider_template_revision text null,
  is_active boolean not null default false,
  display_name text not null,
  description text null,
  required_field_map jsonb not null default '{}'::jsonb,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint proposal_contract_templates_pkey primary key (proposal_contract_template_id),
  constraint proposal_contract_templates_provider_template_unique unique (provider, provider_template_id),
  constraint proposal_contract_templates_created_by_fkey foreign KEY (created_by) references profiles (id) on delete set null
) TABLESPACE pg_default;

create unique index IF not exists idx_proposal_contract_templates_single_active
on public.proposal_contract_templates using btree (provider)
TABLESPACE pg_default
where
  (is_active = true);

create index IF not exists idx_proposal_contract_templates_display_name
on public.proposal_contract_templates using btree (display_name)
TABLESPACE pg_default;

create trigger trg_proposal_contract_templates_set_updated_at BEFORE
update on proposal_contract_templates for EACH row
execute FUNCTION set_updated_at ();
