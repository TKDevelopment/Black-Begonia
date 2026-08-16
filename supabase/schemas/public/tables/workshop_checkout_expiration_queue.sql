create table public.workshop_checkout_expiration_queue (
  workshop_checkout_expiration_queue_id uuid primary key default gen_random_uuid(),
  workshop_payment_attempt_id uuid not null unique
    references public.workshop_payment_attempts(workshop_payment_attempt_id)
    on delete restrict,
  provider_checkout_id text not null,
  state text not null default 'queued'
    check (state in ('queued','claimed','completed','failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz null,
  claimed_by text null,
  last_error_category text null,
  command_key uuid not null unique,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint workshop_checkout_expiration_resolution check (
    (state in ('queued','claimed') and resolved_at is null)
    or (state in ('completed','failed') and resolved_at is not null)
  )
);
create index idx_workshop_checkout_expiration_claim
on public.workshop_checkout_expiration_queue(state,next_attempt_at,created_at)
where state='queued';
alter table public.workshop_checkout_expiration_queue enable row level security;
create policy workshop_checkout_expiration_internal_select
on public.workshop_checkout_expiration_queue for select to authenticated
using(public.is_internal_crm_user());
revoke all on public.workshop_checkout_expiration_queue from anon;
grant select on public.workshop_checkout_expiration_queue to authenticated;
