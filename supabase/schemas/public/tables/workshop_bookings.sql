create table public.workshop_bookings (
  workshop_booking_id uuid primary key default gen_random_uuid(),
  workshop_occurrence_id uuid not null references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  booking_reference text not null unique,
  status_token_digest text not null unique check (char_length(status_token_digest) >= 43),
  status_token_expires_at timestamptz not null,
  status_token_rotation_key uuid null unique,
  contact_name text not null check (char_length(btrim(contact_name)) between 1 and 160),
  contact_email text null check (
    contact_email is null or char_length(btrim(contact_email)) between 3 and 320
  ),
  contact_phone text null,
  purchased_quantity integer not null check (purchased_quantity > 0),
  active_quantity integer not null check (active_quantity between 0 and purchased_quantity),
  status text not null default 'pending_payment' check (status in (
    'pending_payment','confirmed','checked_in','expired','cancelled','payment_disputed',
    'transfer_action_required','transferred'
  )),
  payment_state text not null default 'unselected' check (payment_state in (
    'unselected','pending','processing','paid','partially_refunded','refunded','disputed','reversed','exception'
  )),
  price_per_seat_minor_snapshot bigint not null check (price_per_seat_minor_snapshot >= 0),
  subtotal_minor_snapshot bigint not null check (subtotal_minor_snapshot >= 0),
  total_minor_snapshot bigint not null check (total_minor_snapshot >= 0),
  required_charges_minor_snapshot bigint not null default 0 check (required_charges_minor_snapshot >= 0),
  currency text not null check (currency = 'USD'),
  terms_snapshot text not null,
  terms_version integer not null check (terms_version > 0),
  payment_method text null check (payment_method in ('stripe','direct_venmo')),
  confirmed_at timestamptz null,
  cancelled_at timestamptz null,
  checked_in_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workshop_booking_total_snapshot check (
    subtotal_minor_snapshot = price_per_seat_minor_snapshot * purchased_quantity
    and total_minor_snapshot = subtotal_minor_snapshot + required_charges_minor_snapshot
  )
);
alter table public.workshop_seat_holds
  add constraint workshop_seat_holds_booking_fkey foreign key (booking_id)
  references public.workshop_bookings(workshop_booking_id) on delete restrict;
create index idx_workshop_bookings_occurrence on public.workshop_bookings (workshop_occurrence_id, created_at);
create index idx_workshop_bookings_status on public.workshop_bookings (status, payment_state);
create trigger trg_workshop_bookings_updated_at before update on public.workshop_bookings
for each row execute function public.set_updated_at();
alter table public.workshop_bookings enable row level security;
create policy workshop_bookings_internal_select on public.workshop_bookings for select to authenticated using (public.is_internal_crm_user());
revoke all on public.workshop_bookings from anon;
grant select on public.workshop_bookings to authenticated;
