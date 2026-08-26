create table public.workshop_attendees (
  workshop_attendee_id uuid primary key default gen_random_uuid(),
  workshop_booking_id uuid not null references public.workshop_bookings(workshop_booking_id) on delete restrict,
  seat_number smallint not null check (seat_number > 0),
  display_name text null,
  accommodation_details text null,
  attendance_state text not null default 'expected' check (attendance_state in ('expected','checked_in','absent','cancelled')),
  checked_in_at timestamptz null,
  checked_in_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workshop_booking_id, seat_number)
);
create trigger trg_workshop_attendees_updated_at before update on public.workshop_attendees
for each row execute function public.set_updated_at();
alter table public.workshop_attendees enable row level security;
create policy workshop_attendees_internal_select on public.workshop_attendees for select to authenticated using (public.is_internal_crm_user());
revoke all on public.workshop_attendees from anon;
grant select on public.workshop_attendees to authenticated;
