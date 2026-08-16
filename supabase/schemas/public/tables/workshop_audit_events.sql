create table public.workshop_audit_events (
  workshop_audit_event_id uuid primary key default gen_random_uuid(),
  workshop_definition_id uuid null references public.workshop_definitions(workshop_definition_id) on delete restrict,
  workshop_occurrence_id uuid null references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  event_type text not null,
  actor_type text not null check (actor_type in ('internal','customer','provider','system')),
  actor_id uuid null,
  command_key uuid null,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint workshop_audit_event_owner check (
    workshop_definition_id is not null or workshop_occurrence_id is not null
  )
);
create unique index uq_workshop_audit_command on public.workshop_audit_events (command_key, event_type)
where command_key is not null;
create index idx_workshop_audit_occurrence on public.workshop_audit_events (workshop_occurrence_id, created_at desc);
alter table public.workshop_audit_events enable row level security;
create policy workshop_audit_internal_select on public.workshop_audit_events for select to authenticated using (public.is_internal_crm_user());
revoke all on public.workshop_audit_events from anon;
grant select on public.workshop_audit_events to authenticated;
