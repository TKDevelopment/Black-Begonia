create table public.workshop_message_queue (
  workshop_message_queue_id uuid primary key default gen_random_uuid(),
  workshop_booking_id uuid null references public.workshop_bookings(workshop_booking_id) on delete restrict,
  workshop_waitlist_entry_id uuid null references public.workshop_waitlist_entries(workshop_waitlist_entry_id) on delete restrict,
  workshop_personal_data_request_id uuid null references public.workshop_personal_data_requests(workshop_personal_data_request_id) on delete restrict,
  communication_type text not null check (communication_type in (
    'booking_confirmation','replacement_status_access','waitlist_offer',
    'current_address_privacy_verification','proposed_email_confirmation',
    'cancellation_notice','reschedule_prompt','refund_notice'
  )),
  recipient_source text not null check (recipient_source in (
    'booking_contact','waitlist_contact','proposed_correction_email'
  )),
  token_purpose text null check (token_purpose in (
    'status_access','waitlist_offer','reschedule_response',
    'privacy_verification','replacement_email'
  )),
  template_version text not null,
  is_required boolean not null default true,
  state text not null default 'queued' check (state in (
    'queued','claimed','sent','failed','suppressed'
  )),
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  next_attempt_at timestamptz not null default now(),
  expires_at timestamptz null,
  claimed_at timestamptz null,
  claimed_by text null,
  provider_message_id text null,
  last_error_category text null,
  command_key uuid not null unique,
  token_registration_key uuid null unique,
  outcome_command_key uuid null unique,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint workshop_message_queue_owner check (
    (workshop_booking_id is not null)::integer
      +(workshop_waitlist_entry_id is not null)::integer
      +(workshop_personal_data_request_id is not null)::integer=1
  ),
  constraint workshop_message_queue_resolution check (
    (state in ('queued','claimed') and resolved_at is null)
    or (state in ('sent','failed','suppressed') and resolved_at is not null)
  )
);
create index idx_workshop_message_queue_claim
on public.workshop_message_queue(state,next_attempt_at,created_at)
where state='queued';
alter table public.workshop_message_queue enable row level security;
create policy workshop_message_queue_internal_select
on public.workshop_message_queue for select to authenticated
using(public.is_internal_crm_user());
revoke all on public.workshop_message_queue from anon;
grant select on public.workshop_message_queue to authenticated;
