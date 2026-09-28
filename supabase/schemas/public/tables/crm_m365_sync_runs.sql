create table public.crm_m365_sync_runs (
  run_id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.crm_m365_calendar_connections(connection_id) on delete cascade,
  trigger text not null check (trigger in ('scheduled','manual','range_request')),
  requested_month date null, requested_by uuid null references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  started_at timestamptz null, finished_at timestamptz null,
  exported_count integer not null default 0, imported_count integer not null default 0,
  conflict_count integer not null default 0, last_error_code text null,
  check (trigger <> 'range_request' or requested_month is not null)
);
create index crm_m365_runs_queue on public.crm_m365_sync_runs(connection_id,status,requested_at);
create index crm_m365_runs_user_hour on public.crm_m365_sync_runs(requested_by,requested_at)
  where trigger='range_request';

alter table public.crm_m365_sync_runs enable row level security;
revoke all on public.crm_m365_sync_runs from public, anon, authenticated;
grant all on public.crm_m365_sync_runs to service_role;

