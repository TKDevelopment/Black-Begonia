create table public.workshop_cancellation_refund_jobs (
  workshop_cancellation_refund_job_id uuid primary key default gen_random_uuid(),
  workshop_refund_request_id uuid not null unique
    references public.workshop_refund_requests(workshop_refund_request_id)
    on delete restrict,
  workshop_occurrence_id uuid not null
    references public.workshop_occurrences(workshop_occurrence_id)
    on delete restrict,
  state text not null default 'queued' check (state in (
    'queued','claimed','provider_accepted','failed'
  )),
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz null,
  claimed_by text null,
  last_error_category text null,
  command_key uuid not null unique,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint workshop_cancellation_refund_job_resolution check (
    (state in ('queued','claimed') and resolved_at is null)
    or (state in ('provider_accepted','failed') and resolved_at is not null)
  )
);

create index idx_workshop_cancellation_refund_jobs_claim
on public.workshop_cancellation_refund_jobs(state,next_attempt_at,created_at)
where state='queued';

alter table public.workshop_cancellation_refund_jobs enable row level security;
create policy workshop_cancellation_refund_jobs_internal_select
on public.workshop_cancellation_refund_jobs for select to authenticated
using(public.is_internal_crm_user());
revoke all on public.workshop_cancellation_refund_jobs from anon;
grant select on public.workshop_cancellation_refund_jobs to authenticated;
