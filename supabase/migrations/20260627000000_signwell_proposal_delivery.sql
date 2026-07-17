begin;

-- Lead venue data required to populate the SignWell contract template.
alter table if exists public.leads
  add column if not exists ceremony_venue_address text,
  add column if not exists ceremony_venue_zipcode text,
  add column if not exists reception_venue_address text,
  add column if not exists reception_venue_zipcode text;

-- Preserve the complete venue address when a lead is converted to a project.
-- The project street-address columns already exist in the deployed schema.
alter table if exists public.projects
  add column if not exists ceremony_venue_zipcode text,
  add column if not exists reception_venue_zipcode text;

-- Direct SignWell delivery does not create a legacy portal passcode.
alter table if exists public.floral_proposals
  alter column passcode_hash drop not null,
  add column if not exists canva_pdf_storage_path text,
  add column if not exists canva_pdf_file_name text,
  add column if not exists final_balance_amount numeric(12, 2) not null default 0,
  add column if not exists retainer_amount numeric(12, 2) not null default 0,
  add column if not exists final_balance_due_date date,
  add column if not exists retainer_due_date date;

-- Persist draft/send orchestration state so retries remain idempotent.
alter table if exists public.proposal_signing_sessions
  add column if not exists idempotency_key text,
  add column if not exists send_state text not null default 'not_started';

create unique index if not exists idx_proposal_signing_sessions_provider_document_id
  on public.proposal_signing_sessions (provider_document_id)
  where provider_document_id is not null;

create unique index if not exists idx_proposal_signing_sessions_idempotency_key
  on public.proposal_signing_sessions (idempotency_key)
  where idempotency_key is not null;

-- Make newly added columns immediately visible to PostgREST clients.
notify pgrst, 'reload schema';

commit;
