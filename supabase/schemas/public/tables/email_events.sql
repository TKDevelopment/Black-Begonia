create table public.email_events (
  email_event_id uuid not null default gen_random_uuid (),
  email_message_id uuid not null,
  provider text not null default 'mailgun'::text,
  provider_event_id text null,
  provider_message_id text null,
  event_type text not null,
  event_timestamp timestamp with time zone null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint email_events_pkey primary key (email_event_id),
  constraint email_events_email_message_id_fkey foreign KEY (email_message_id) references email_messages (email_message_id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_email_events_message_id on public.email_events using btree (email_message_id) TABLESPACE pg_default;

create index IF not exists idx_email_events_provider_message_id on public.email_events using btree (provider_message_id) TABLESPACE pg_default;

create index IF not exists idx_email_events_event_type on public.email_events using btree (event_type) TABLESPACE pg_default;