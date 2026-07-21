create table public.payment_legal_holds (
  payment_legal_hold_id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(project_id) on delete restrict,
  action text not null check (action in ('placed','released')),
  hold_type text not null check (hold_type in ('legal','dispute')),
  reason text not null check (nullif(btrim(reason),'') is not null),
  command_key uuid not null unique,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index idx_payment_legal_holds_project_created on public.payment_legal_holds(project_id, created_at desc);
alter table public.payment_legal_holds enable row level security;
create policy payment_legal_holds_internal_select on public.payment_legal_holds for select to authenticated using (public.is_internal_crm_user());
