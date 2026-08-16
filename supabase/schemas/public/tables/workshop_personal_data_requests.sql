create table public.workshop_personal_data_requests (
  workshop_personal_data_request_id uuid primary key default gen_random_uuid(),
  workshop_booking_id uuid not null references public.workshop_bookings(workshop_booking_id) on delete restrict,
  request_type text not null check (request_type in ('correction','minimization')),
  requested_field_categories text[] not null check (cardinality(requested_field_categories) > 0),
  protected_proposed_corrections jsonb null,
  state text not null default 'pending_verification' check (state in (
    'pending_verification','verified','approved','deferred','completed','denied','expired'
  )),
  verification_method text not null check (verification_method in ('booking_status_token','email_link')),
  verification_token_digest text null unique,
  verification_expires_at timestamptz null,
  verified_at timestamptz null,
  replacement_email_token_digest text null unique,
  replacement_email_expires_at timestamptz null,
  replacement_email_confirmed_at timestamptz null,
  retention_policy_version text null,
  processed_by uuid null references public.profiles(id) on delete set null,
  reason_category text null,
  earliest_eligible_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz null,
  constraint workshop_personal_data_email_verification check (
    verification_method <> 'email_link'
    or state <> 'pending_verification'
    or (verification_token_digest is null and verification_expires_at is null)
    or (
      verification_token_digest is not null
      and verification_expires_at is not null
      and verification_expires_at <= created_at + interval '24 hours'
    )
  ),
  constraint workshop_personal_data_policy_resolution check (
    state not in ('approved','deferred','completed','denied')
    or request_type = 'correction'
    or retention_policy_version is not null
  ),
  constraint workshop_personal_data_deferral check (
    state <> 'deferred' or earliest_eligible_at is not null
  )
);
create index idx_workshop_personal_data_state on public.workshop_personal_data_requests (state, created_at);
create trigger trg_workshop_personal_data_updated_at before update on public.workshop_personal_data_requests
for each row execute function public.set_updated_at();
alter table public.workshop_personal_data_requests enable row level security;
create policy workshop_personal_data_internal_select on public.workshop_personal_data_requests for select to authenticated
using (public.is_internal_crm_user() and state <> 'pending_verification');
revoke all on public.workshop_personal_data_requests from anon;
grant select on public.workshop_personal_data_requests to authenticated;
