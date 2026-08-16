create table public.workshop_reschedule_responses (
  workshop_reschedule_response_id uuid primary key default gen_random_uuid(),
  workshop_booking_id uuid not null references public.workshop_bookings(workshop_booking_id) on delete restrict,
  source_occurrence_id uuid not null references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  replacement_occurrence_id uuid not null references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  replacement_hold_id uuid not null unique
    references public.workshop_seat_holds(workshop_seat_hold_id) on delete restrict,
  protected_quantity integer not null check (protected_quantity > 0),
  response text not null default 'pending'
    check (response in ('pending','accepted','declined','expired','staff_resolved')),
  response_token_digest text not null unique check (char_length(response_token_digest) >= 43),
  response_token_expires_at timestamptz not null,
  responded_at timestamptz null,
  resolved_by uuid null references public.profiles(id) on delete set null,
  resolution_command_key uuid null unique,
  command_key uuid not null unique,
  created_at timestamptz not null default now(),
  constraint workshop_reschedule_distinct_occurrences check (source_occurrence_id <> replacement_occurrence_id),
  constraint workshop_reschedule_response_time check (
    (response = 'pending' and responded_at is null) or
    (response <> 'pending' and responded_at is not null)
  )
);
create unique index uq_workshop_reschedule_pending_booking
on public.workshop_reschedule_responses (workshop_booking_id) where response = 'pending';
alter table public.workshop_reschedule_responses enable row level security;
create policy workshop_reschedule_internal_select on public.workshop_reschedule_responses for select to authenticated using (public.is_internal_crm_user());
revoke all on public.workshop_reschedule_responses from anon;
grant select on public.workshop_reschedule_responses to authenticated;
