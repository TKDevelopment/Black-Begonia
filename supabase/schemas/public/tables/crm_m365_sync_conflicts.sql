create table public.crm_m365_sync_conflicts (
  conflict_id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.crm_m365_event_associations(association_id) on delete cascade,
  remote_change_key text null, changed_fields text[] not null default '{}',
  remote_start_at timestamptz null, remote_end_at timestamptz null,
  remote_title text null, is_remote_private boolean not null default false,
  detected_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open','restoring','resolved')),
  reviewed_by uuid null references public.profiles(id) on delete set null,
  reviewed_at timestamptz null, resolved_at timestamptz null,
  check (not is_remote_private or remote_title is null)
);
create unique index crm_m365_one_open_conflict on public.crm_m365_sync_conflicts(association_id)
  where status in ('open','restoring');

alter table public.crm_m365_sync_conflicts enable row level security;
revoke all on public.crm_m365_sync_conflicts from public, anon, authenticated;
grant all on public.crm_m365_sync_conflicts to service_role;

