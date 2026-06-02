create table public.lead_activity (
  lead_activity_id uuid not null default gen_random_uuid (),
  lead_id uuid not null,
  activity_type public.activity_type not null,
  activity_label text not null,
  activity_description text null,
  performed_by uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint lead_activity_pkey primary key (lead_activity_id),
  constraint lead_activity_lead_id_fkey foreign KEY (lead_id) references leads (lead_id) on delete CASCADE,
  constraint lead_activity_performed_by_fkey foreign KEY (performed_by) references profiles (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_lead_activity_lead_id_created_at_desc on public.lead_activity using btree (lead_id, created_at desc) TABLESPACE pg_default;