create table public.workshop_communications (
  workshop_communication_id uuid primary key default gen_random_uuid(),
  workshop_booking_id uuid null references public.workshop_bookings(workshop_booking_id) on delete restrict,
  workshop_waitlist_entry_id uuid null references public.workshop_waitlist_entries(workshop_waitlist_entry_id) on delete restrict,
  communication_type text not null,
  delivery_channel text not null default 'email' check (delivery_channel = 'email'),
  recipient_digest text not null,
  template_version text not null,
  payload_digest text not null,
  provider_message_id text null,
  delivery_state text not null default 'queued' check (delivery_state in ('queued','claimed','sent','delivered','failed','suppressed')),
  occurred_at timestamptz not null default now(),
  command_key uuid not null unique,
  created_at timestamptz not null default now(),
  constraint workshop_communication_owner check (
    (workshop_booking_id is not null)::integer + (workshop_waitlist_entry_id is not null)::integer = 1
  )
);
create index idx_workshop_communications_delivery on public.workshop_communications (delivery_state, occurred_at);
create trigger trg_workshop_communications_immutable
before update or delete on public.workshop_communications
for each row execute function public.reject_workshop_immutable_change();
alter table public.workshop_communications enable row level security;
create policy workshop_communications_internal_select on public.workshop_communications for select to authenticated using (public.is_internal_crm_user());
revoke all on public.workshop_communications from anon;
grant select on public.workshop_communications to authenticated;
