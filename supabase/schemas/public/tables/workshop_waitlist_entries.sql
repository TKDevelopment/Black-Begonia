create table public.workshop_waitlist_entries (
  workshop_waitlist_entry_id uuid primary key default gen_random_uuid(),
  workshop_occurrence_id uuid not null references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  contact_name text not null,
  contact_email text not null,
  requested_quantity integer not null check (requested_quantity > 0),
  state text not null default 'waiting' check (state in ('waiting','offered','converted','expired','withdrawn')),
  withdrawal_token_digest text not null unique check (char_length(withdrawal_token_digest) >= 43),
  command_key uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_workshop_waitlist_queue on public.workshop_waitlist_entries (workshop_occurrence_id, created_at)
where state = 'waiting';
create trigger trg_workshop_waitlist_entries_updated_at before update on public.workshop_waitlist_entries
for each row execute function public.set_updated_at();
alter table public.workshop_waitlist_entries enable row level security;
create policy workshop_waitlist_entries_internal_select on public.workshop_waitlist_entries for select to authenticated using (public.is_internal_crm_user());
revoke all on public.workshop_waitlist_entries from anon;
grant select on public.workshop_waitlist_entries to authenticated;
