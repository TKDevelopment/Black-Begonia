create table public.activity_log (
  activity_log_id uuid not null default gen_random_uuid (),
  entity_type public.activity_entity_type not null,
  entity_id uuid not null,
  activity_type public.activity_type not null,
  activity_label text not null,
  description text null,
  performed_by uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint activity_log_pkey primary key (activity_log_id),
  constraint activity_log_performed_by_fkey foreign KEY (performed_by) references profiles (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_activity_log_entity_created_at_desc on public.activity_log using btree (entity_type, entity_id, created_at desc) TABLESPACE pg_default;