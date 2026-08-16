create table public.workshop_waitlist_offers (
  workshop_waitlist_offer_id uuid primary key default gen_random_uuid(),
  workshop_waitlist_entry_id uuid not null references public.workshop_waitlist_entries(workshop_waitlist_entry_id) on delete restrict,
  workshop_occurrence_id uuid not null references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  workshop_seat_hold_id uuid not null references public.workshop_seat_holds(workshop_seat_hold_id) on delete restrict,
  quantity integer not null check (quantity > 0),
  state text not null default 'active' check (state in ('active','accepted','expired','cancelled')),
  offer_token_digest text not null unique check (char_length(offer_token_digest) >= 43),
  expires_at timestamptz not null,
  resolved_at timestamptz null,
  command_key uuid not null unique,
  resolution_command_key uuid null unique,
  created_at timestamptz not null default now(),
  constraint workshop_waitlist_offer_resolution check (
    (state = 'active' and resolved_at is null) or (state <> 'active' and resolved_at is not null)
  )
);
create unique index uq_workshop_waitlist_active_offer
on public.workshop_waitlist_offers (workshop_waitlist_entry_id) where state = 'active';
create index idx_workshop_waitlist_offer_expiry on public.workshop_waitlist_offers (expires_at) where state = 'active';
alter table public.workshop_waitlist_offers enable row level security;
create policy workshop_waitlist_offers_internal_select on public.workshop_waitlist_offers for select to authenticated using (public.is_internal_crm_user());
revoke all on public.workshop_waitlist_offers from anon;
grant select on public.workshop_waitlist_offers to authenticated;
