create table public.proposal_signing_sessions (
  proposal_signing_session_id uuid not null default gen_random_uuid (),
  floral_proposal_id uuid not null,
  provider text not null default 'signwell'::text,
  provider_document_id text null,
  idempotency_key text null,
  send_state text not null default 'not_started'::text,
  provider_embedded_session_id text null,
  provider_signer_reference text null,
  status text not null default 'not_started'::text,
  last_synced_at timestamp with time zone null,
  last_error_message text null,
  webhook_payload_snapshot jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint proposal_signing_sessions_pkey primary key (proposal_signing_session_id),
  constraint proposal_signing_sessions_floral_proposal_id_fkey foreign KEY (floral_proposal_id) references floral_proposals (floral_proposal_id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_proposal_signing_sessions_floral_proposal_id
on public.proposal_signing_sessions using btree (floral_proposal_id, created_at desc)
TABLESPACE pg_default;

create unique index IF not exists idx_proposal_signing_sessions_provider_document_id
on public.proposal_signing_sessions using btree (provider_document_id)
where provider_document_id is not null;

create unique index IF not exists idx_proposal_signing_sessions_idempotency_key
on public.proposal_signing_sessions using btree (idempotency_key)
where idempotency_key is not null;

create trigger trg_proposal_signing_sessions_set_updated_at BEFORE
update on proposal_signing_sessions for EACH row
execute FUNCTION set_updated_at ();
