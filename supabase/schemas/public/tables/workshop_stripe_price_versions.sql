create table public.workshop_stripe_price_versions (
  workshop_stripe_price_version_id uuid primary key default gen_random_uuid(),
  workshop_definition_id uuid not null references public.workshop_definitions(workshop_definition_id) on delete restrict,
  stripe_product_id text not null,
  stripe_price_id text not null unique,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency = 'USD'),
  state text not null check (state in ('pending','active','inactive','failed')),
  provider_created_at timestamptz not null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deactivated_at timestamptz null,
  constraint workshop_stripe_price_versions_deactivation check (
    (state = 'inactive' and deactivated_at is not null) or state <> 'inactive'
  )
);
create index idx_workshop_stripe_prices_definition on public.workshop_stripe_price_versions (workshop_definition_id, state);
alter table public.workshop_stripe_price_versions enable row level security;
create policy workshop_stripe_prices_internal_select on public.workshop_stripe_price_versions for select to authenticated using (public.is_internal_crm_user());
revoke all on public.workshop_stripe_price_versions from anon;
grant select on public.workshop_stripe_price_versions to authenticated;
