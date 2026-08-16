create table public.workshop_communication_suppressions (
  workshop_communication_suppression_id uuid primary key default gen_random_uuid(),
  workshop_booking_id uuid not null references public.workshop_bookings(workshop_booking_id) on delete restrict,
  scope text not null default 'non_required' check (scope = 'non_required'),
  reason_category text not null check (reason_category in ('verified_minimization','customer_request')),
  command_key uuid not null unique,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_workshop_communication_suppressions_booking
on public.workshop_communication_suppressions(workshop_booking_id,created_at desc);
alter table public.workshop_communication_suppressions enable row level security;
create policy workshop_communication_suppressions_internal_select
on public.workshop_communication_suppressions for select to authenticated
using(public.is_internal_crm_user());
revoke all on public.workshop_communication_suppressions from anon;
grant select on public.workshop_communication_suppressions to authenticated;
