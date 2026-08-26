create table public.workshop_analytics_outcome_grants (
  workshop_analytics_outcome_grant_id uuid primary key default gen_random_uuid(),
  workshop_booking_id uuid not null references public.workshop_bookings(workshop_booking_id) on delete restrict,
  grant_digest text not null unique check (
    char_length(grant_digest) = 64
    and grant_digest ~ '^[0-9a-f]{64}$'
  ),
  outcome_type text not null check (outcome_type in ('booking_confirmed','waitlist_joined','booking_cancelled')),
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  discarded_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint workshop_analytics_grant_lifetime check (
    expires_at <= created_at + interval '24 hours'
  ),
  constraint workshop_analytics_grant_resolution check (
    (consumed_at is not null)::integer + (discarded_at is not null)::integer <= 1
  )
);
create index idx_workshop_analytics_grant_expiry on public.workshop_analytics_outcome_grants (expires_at)
where consumed_at is null and discarded_at is null;
create unique index uq_workshop_analytics_confirmation_booking
on public.workshop_analytics_outcome_grants (workshop_booking_id, outcome_type);
alter table public.workshop_analytics_outcome_grants enable row level security;
create policy workshop_analytics_grants_internal_select on public.workshop_analytics_outcome_grants for select to authenticated using (public.is_internal_crm_user());
revoke all on public.workshop_analytics_outcome_grants from anon;
grant select on public.workshop_analytics_outcome_grants to authenticated;
