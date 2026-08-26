create table public.workshop_seat_holds (
  workshop_seat_hold_id uuid primary key default gen_random_uuid(),
  workshop_occurrence_id uuid not null references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  booking_id uuid null,
  quantity integer not null check (quantity > 0),
  state text not null default 'active' check (state in ('active','confirmed','expired','released','cancelled','exception')),
  payment_method text null check (payment_method in ('stripe','direct_venmo')),
  normal_expires_at timestamptz not null,
  effective_expires_at timestamptz not null,
  resolved_at timestamptz null,
  resolution_reason text null,
  command_key uuid not null unique,
  created_at timestamptz not null default now(),
  constraint workshop_seat_holds_expiry check (effective_expires_at <= normal_expires_at),
  constraint workshop_seat_holds_resolution check (
    (state = 'active' and resolved_at is null)
    or (state <> 'active' and resolved_at is not null)
  )
);
create index idx_workshop_holds_active_capacity on public.workshop_seat_holds (workshop_occurrence_id, effective_expires_at)
where state = 'active';
alter table public.workshop_seat_holds enable row level security;
create policy workshop_holds_internal_select on public.workshop_seat_holds for select to authenticated using (public.is_internal_crm_user());
revoke all on public.workshop_seat_holds from anon;
grant select on public.workshop_seat_holds to authenticated;
