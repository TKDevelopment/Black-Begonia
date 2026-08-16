create table public.workshop_message_outcomes (
  workshop_message_outcome_id uuid primary key default gen_random_uuid(),
  workshop_message_queue_id uuid not null references public.workshop_message_queue(workshop_message_queue_id) on delete restrict,
  outcome text not null check (outcome in ('accepted','retryable','permanent')),
  resulting_state text not null check (resulting_state in ('queued','sent','failed')),
  attempt_count integer not null check (attempt_count between 1 and 10),
  error_category text null,
  command_key uuid not null unique,
  created_at timestamptz not null default now()
);
alter table public.workshop_message_outcomes enable row level security;
create policy workshop_message_outcomes_internal_select
on public.workshop_message_outcomes for select to authenticated
using(public.is_internal_crm_user());
revoke all on public.workshop_message_outcomes from anon;
grant select on public.workshop_message_outcomes to authenticated;
