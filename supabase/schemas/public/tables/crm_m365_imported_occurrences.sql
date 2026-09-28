create table public.crm_m365_imported_occurrences (
  connection_id uuid not null references public.crm_m365_calendar_connections(connection_id) on delete cascade,
  graph_occurrence_id text not null, series_master_id text null,
  start_at timestamptz not null, end_at timestamptz not null,
  local_start_date date not null, local_end_date date not null,
  is_all_day boolean not null, display_title text not null,
  location text null, outlook_web_url text null,
  is_private boolean not null default false,
  provider_status text not null default 'active' check (provider_status in ('active','canceled')),
  last_seen_scan_id uuid null, updated_at timestamptz not null default now(),
  primary key (connection_id,graph_occurrence_id),
  check (end_at > start_at and local_end_date > local_start_date),
  check (not is_private or (display_title = 'Private event' and location is null)),
  check (outlook_web_url is null or outlook_web_url ~ '^https://outlook\.(office|office365)\.com/'),
  check (char_length(display_title) between 1 and 240)
);
create index crm_m365_imported_range on public.crm_m365_imported_occurrences(connection_id,local_start_date,local_end_date);

alter table public.crm_m365_imported_occurrences enable row level security;
revoke all on public.crm_m365_imported_occurrences from public, anon, authenticated;
grant all on public.crm_m365_imported_occurrences to service_role;

