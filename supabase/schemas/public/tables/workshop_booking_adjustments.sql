create table public.workshop_booking_adjustments (
  workshop_booking_adjustment_id uuid primary key default gen_random_uuid(),
  workshop_booking_id uuid not null references public.workshop_bookings(workshop_booking_id) on delete restrict,
  adjustment_type text not null check (adjustment_type in ('partial_cancel','full_cancel','transfer','manual','complimentary','correction')),
  quantity_delta integer not null,
  amount_minor_delta bigint not null default 0,
  reason text not null check (char_length(btrim(reason)) > 0),
  command_key uuid not null unique,
  actor_type text not null check (actor_type in ('customer','internal','system','provider')),
  actor_id uuid null,
  created_at timestamptz not null default now(),
  constraint workshop_booking_adjustment_effect check (
    quantity_delta <> 0 or amount_minor_delta <> 0
    or adjustment_type = 'transfer'
  )
);
create index idx_workshop_adjustments_booking on public.workshop_booking_adjustments (workshop_booking_id, created_at);
alter table public.workshop_booking_adjustments enable row level security;
create policy workshop_adjustments_internal_select on public.workshop_booking_adjustments for select to authenticated using (public.is_internal_crm_user());
revoke all on public.workshop_booking_adjustments from anon;
grant select on public.workshop_booking_adjustments to authenticated;
