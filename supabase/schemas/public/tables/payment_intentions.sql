create table public.payment_intentions (
  payment_intention_id uuid primary key default gen_random_uuid(),
  payment_request_id uuid not null references public.payment_requests(payment_request_id) on delete cascade,
  project_id uuid not null references public.projects(project_id) on delete cascade,
  obligation_id uuid null references public.project_payment_records(project_payment_record_id) on delete set null,
  method text not null check (method in ('cash','check','venmo_business_profile')),
  state text not null default 'active' check (state in ('active','superseded','fulfilled','expired')),
  instruction_snapshot text null,
  reference text null,
  pause_started_at timestamptz not null default now(),
  pause_ends_at timestamptz not null,
  superseded_at timestamptz null,
  fulfilled_at timestamptz null,
  created_at timestamptz not null default now(),
  check (pause_ends_at = pause_started_at + interval '7 days')
);
create unique index uq_payment_intentions_active_request on public.payment_intentions(payment_request_id) where state='active';
alter table public.payment_intentions enable row level security;
create policy payment_intentions_internal_select on public.payment_intentions for select to authenticated using (public.is_internal_crm_user());
