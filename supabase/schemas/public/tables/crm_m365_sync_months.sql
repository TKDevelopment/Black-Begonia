create table public.crm_m365_sync_months (
  connection_id uuid not null references public.crm_m365_calendar_connections(connection_id) on delete cascade,
  month_start date not null check (extract(day from month_start)=1),
  strategy text not null check (strategy in ('primary_delta','full_reconcile')),
  opaque_delta_link text null, last_requested_at timestamptz null,
  last_successful_scan_at timestamptz null, last_error_code text null,
  retry_after_at timestamptz null, scan_generation uuid null,
  primary key(connection_id,month_start)
);
create index crm_m365_months_recent on public.crm_m365_sync_months(connection_id,last_requested_at desc);

alter table public.crm_m365_sync_months enable row level security;
revoke all on public.crm_m365_sync_months from public, anon, authenticated;
grant all on public.crm_m365_sync_months to service_role;

