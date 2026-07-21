create table public.payment_collection_settings (
  settings_id boolean primary key default true check (settings_id),
  business_timezone text not null default 'America/New_York',
  send_window_start time not null default '09:00',
  send_window_end time not null default '17:00',
  cash_instructions text not null default '',
  check_instructions text not null default '',
  venmo_business_target text null,
  venmo_qr_url text null,
  stripe_enabled boolean not null default false,
  venmo_enabled boolean not null default false,
  reminders_enabled boolean not null default false,
  collection_enabled boolean not null default false,
  provider_environment text not null default 'sandbox' check (provider_environment in ('sandbox','production')),
  updated_by uuid null references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.payment_collection_settings enable row level security;
create policy payment_collection_settings_internal_select on public.payment_collection_settings for select to authenticated using (public.is_internal_crm_user());
