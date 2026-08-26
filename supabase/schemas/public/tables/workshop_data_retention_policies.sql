create or replace function public.is_workshop_privacy_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    where p.id = auth.uid() and p.is_active = true and ur.role = 'admin'
  );
$$;

create table public.workshop_data_retention_policies (
  workshop_data_retention_policy_id uuid primary key default gen_random_uuid(),
  policy_version text not null unique,
  state text not null default 'draft' check (state in ('draft','approved','active','retired')),
  effective_at timestamptz null,
  field_rules jsonb not null default '[]'::jsonb check (jsonb_typeof(field_rules) = 'array'),
  operational_retention_days integer not null check (operational_retention_days >= 0),
  communication_retention_days integer not null check (communication_retention_days >= 0),
  financial_retention_days integer not null check (financial_retention_days >= 0),
  dispute_retention_days integer not null check (dispute_retention_days >= 0),
  audit_retention_days integer not null check (audit_retention_days >= 0),
  approved_by uuid null references public.profiles(id) on delete restrict,
  approved_at timestamptz null,
  activated_by uuid null references public.profiles(id) on delete restrict,
  activated_at timestamptz null,
  retired_by uuid null references public.profiles(id) on delete restrict,
  retired_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workshop_retention_approval check (
    state = 'draft' or (approved_by is not null and approved_at is not null)
  ),
  constraint workshop_retention_activation check (
    state not in ('active','retired')
    or (effective_at is not null and activated_by is not null and activated_at is not null)
  ),
  constraint workshop_retention_retirement check (
    state <> 'retired' or (retired_by is not null and retired_at is not null)
  )
);
create unique index uq_workshop_retention_active on public.workshop_data_retention_policies ((state))
where state = 'active';

create or replace function public.enforce_workshop_retention_policy_immutability()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Workshop retention policies cannot be deleted.' using errcode = '55000';
  end if;
  if old.state = 'retired' then
    raise exception 'Retired workshop retention policies are immutable.' using errcode = '55000';
  end if;
  if old.state = 'approved' then
    if new.state is distinct from 'active'
      or new.policy_version is distinct from old.policy_version
      or new.field_rules is distinct from old.field_rules
      or new.operational_retention_days is distinct from old.operational_retention_days
      or new.communication_retention_days is distinct from old.communication_retention_days
      or new.financial_retention_days is distinct from old.financial_retention_days
      or new.dispute_retention_days is distinct from old.dispute_retention_days
      or new.audit_retention_days is distinct from old.audit_retention_days
      or new.approved_by is distinct from old.approved_by
      or new.approved_at is distinct from old.approved_at
    then
      raise exception 'Approved workshop retention policy content is immutable; only controlled activation is allowed.'
        using errcode = '55000';
    end if;
  end if;
  if old.state = 'active' then
    if new.state is distinct from 'retired'
      or new.policy_version is distinct from old.policy_version
      or new.field_rules is distinct from old.field_rules
      or new.operational_retention_days is distinct from old.operational_retention_days
      or new.communication_retention_days is distinct from old.communication_retention_days
      or new.financial_retention_days is distinct from old.financial_retention_days
      or new.dispute_retention_days is distinct from old.dispute_retention_days
      or new.audit_retention_days is distinct from old.audit_retention_days
      or new.approved_by is distinct from old.approved_by
      or new.approved_at is distinct from old.approved_at
      or new.activated_by is distinct from old.activated_by
      or new.activated_at is distinct from old.activated_at
      or new.effective_at is distinct from old.effective_at
      or new.retired_by is null
      or new.retired_at is null then
      raise exception 'Approved workshop retention policy content is immutable; only controlled activation or retirement is allowed.'
        using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_workshop_retention_policy_immutability
before update or delete on public.workshop_data_retention_policies
for each row execute function public.enforce_workshop_retention_policy_immutability();
create trigger trg_workshop_data_retention_updated_at before update on public.workshop_data_retention_policies
for each row execute function public.set_updated_at();
alter table public.workshop_data_retention_policies enable row level security;
create policy workshop_retention_internal_select on public.workshop_data_retention_policies
for select to authenticated using (public.is_internal_crm_user());
create policy workshop_retention_admin_insert on public.workshop_data_retention_policies
for insert to authenticated with check (public.is_workshop_privacy_admin());
create policy workshop_retention_admin_update on public.workshop_data_retention_policies
for update to authenticated using (public.is_workshop_privacy_admin()) with check (public.is_workshop_privacy_admin());
revoke all on function public.is_workshop_privacy_admin() from public;
grant execute on function public.is_workshop_privacy_admin() to authenticated;
revoke all on public.workshop_data_retention_policies from anon;
grant select, insert, update on public.workshop_data_retention_policies to authenticated;
