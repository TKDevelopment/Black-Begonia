create table public.crm_m365_calendar_outbox (
  outbox_id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('lead_event','project_event','consultation','installment','workshop')),
  source_id uuid not null, generation bigint not null default 1 check (generation > 0),
  changed_at timestamptz not null default now(), attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(), last_error_code text null,
  state text not null default 'pending' check (state in ('pending','leased','blocked_conflict')),
  lease_expires_at timestamptz null, unique (source_type, source_id)
);
create index crm_m365_outbox_ready on public.crm_m365_calendar_outbox(state,next_attempt_at,lease_expires_at);

alter table public.crm_m365_calendar_outbox enable row level security;
revoke all on public.crm_m365_calendar_outbox from public, anon, authenticated;
grant all on public.crm_m365_calendar_outbox to service_role;

