create table public.email_messages (
  email_message_id uuid not null default gen_random_uuid (),
  related_table text null,
  related_id uuid null,
  inquiry_type text null,
  provider text not null default 'mailgun'::text,
  provider_message_id text null,
  provider_event_id text null,
  to_email text not null,
  to_name text null,
  from_email text not null,
  subject text not null,
  template_key text not null,
  message_role text not null,
  status public.email_status not null default 'pending'::email_status,
  failure_reason text null,
  failure_severity text null,
  mailgun_region text null,
  tags text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  sent_at timestamp with time zone null,
  accepted_at timestamp with time zone null,
  delivered_at timestamp with time zone null,
  failed_at timestamp with time zone null,
  last_event_at timestamp with time zone null,
  reply_to_email text null,
  constraint email_messages_pkey primary key (email_message_id),
  constraint email_messages_provider_message_id_key unique (provider_message_id)
) TABLESPACE pg_default;

create index IF not exists idx_email_messages_status on public.email_messages using btree (status) TABLESPACE pg_default;

create index IF not exists idx_email_messages_related on public.email_messages using btree (related_table, related_id) TABLESPACE pg_default;

create index IF not exists idx_email_messages_to_email on public.email_messages using btree (to_email) TABLESPACE pg_default;

create index IF not exists idx_email_messages_created_at on public.email_messages using btree (created_at desc) TABLESPACE pg_default;