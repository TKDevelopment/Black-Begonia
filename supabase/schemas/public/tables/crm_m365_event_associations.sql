create table public.crm_m365_event_associations (
  association_id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.crm_m365_calendar_connections(connection_id) on delete restrict,
  source_type text not null check (source_type in ('lead_event','project_event','consultation','installment','workshop')),
  source_id uuid not null, graph_event_id text null, transaction_id text not null,
  last_export_fingerprint text null, last_export_change_key text null,
  state text not null default 'creating' check (state in ('creating','active','conflict','retired')),
  last_exported_at timestamptz null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (connection_id,source_type,source_id), unique(connection_id,transaction_id)
);
create unique index crm_m365_graph_association_unique on public.crm_m365_event_associations(connection_id,graph_event_id)
  where graph_event_id is not null;

alter table public.crm_m365_event_associations enable row level security;
revoke all on public.crm_m365_event_associations from public, anon, authenticated;
grant all on public.crm_m365_event_associations to service_role;

