create table public.document_templates (
  template_id uuid not null default gen_random_uuid (),
  name text not null,
  template_key text not null,
  template_kind public.document_template_kind not null default 'floral_proposal'::document_template_kind,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  is_default boolean not null default false,
  logo_storage_path text null,
  logo_url text null,
  show_terms_section boolean not null default true,
  show_privacy_section boolean not null default true,
  show_signature_section boolean not null default true,
  template_config jsonb not null default '{}'::jsonb,
  constraint document_templates_pkey primary key (template_id),
  constraint document_templates_template_key_key unique (template_key)
) TABLESPACE pg_default;

create index IF not exists idx_document_templates_kind_active on public.document_templates using btree (template_kind, is_active) TABLESPACE pg_default;

create unique INDEX IF not exists idx_document_templates_single_default on public.document_templates using btree (template_kind) TABLESPACE pg_default
where
  (is_default = true);

create trigger trg_document_templates_set_updated_at BEFORE
update on document_templates for EACH row
execute FUNCTION set_updated_at ();