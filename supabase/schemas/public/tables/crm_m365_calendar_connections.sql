create table public.crm_m365_calendar_connections (
  connection_id uuid primary key default gen_random_uuid(),
  tenant_id text not null, mailbox_user_id text not null, mailbox_upn text not null,
  calendar_id text not null, calendar_name text not null, is_primary boolean not null,
  business_timezone text not null default 'America/New_York',
  status text not null default 'disconnected' check (status in ('connected','action_required','disconnected')),
  connected_by uuid null references public.profiles(id) on delete set null,
  connected_at timestamptz null, disconnected_at timestamptz null,
  last_successful_sync_at timestamptz null, last_error_code text null,
  lease_owner uuid null, lease_expires_at timestamptz null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (tenant_id, mailbox_user_id, calendar_id)
);
create unique index crm_m365_one_active_connection on public.crm_m365_calendar_connections ((true))
  where status in ('connected','action_required');

alter table public.crm_m365_calendar_connections enable row level security;
revoke all on public.crm_m365_calendar_connections from public, anon, authenticated;
grant all on public.crm_m365_calendar_connections to service_role;

