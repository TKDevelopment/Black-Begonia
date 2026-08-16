-- Workshop privacy/analytics slice. Depends on all earlier slices.
-- No active retention policy is seeded. Policy activation is a human-confirmed
-- admin action. Rollback is prohibited after grants or privacy requests exist.

create table public.workshop_analytics_outcome_grants (
  workshop_analytics_outcome_grant_id uuid primary key default gen_random_uuid(),
  workshop_booking_id uuid not null references public.workshop_bookings(workshop_booking_id) on delete restrict,
  grant_digest text not null unique check(
    char_length(grant_digest)=64 and grant_digest~'^[0-9a-f]{64}$'
  ),
  outcome_type text not null check(outcome_type in ('booking_confirmed','waitlist_joined','booking_cancelled')),
  expires_at timestamptz not null, consumed_at timestamptz, discarded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint workshop_analytics_grant_lifetime check(expires_at<=created_at+interval '24 hours'),
  constraint workshop_analytics_grant_resolution check((consumed_at is not null)::integer+(discarded_at is not null)::integer<=1)
);
create index idx_workshop_analytics_grant_expiry on public.workshop_analytics_outcome_grants(expires_at) where consumed_at is null and discarded_at is null;
create unique index uq_workshop_analytics_confirmation_booking
on public.workshop_analytics_outcome_grants(workshop_booking_id,outcome_type);
alter table public.workshop_analytics_outcome_grants enable row level security;
create policy workshop_analytics_grants_internal_select on public.workshop_analytics_outcome_grants for select to authenticated using(public.is_internal_crm_user());

create or replace function public.manage_workshop_analytics_outcome(
  p_action text,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_digest text:=lower(btrim(coalesce(p_payload->>'grantDigest','')));
  v_status_digest text:=btrim(coalesce(p_payload->>'statusTokenDigest',''));
  v_booking public.workshop_bookings;
  v_occurrence public.workshop_occurrences;
  v_grant public.workshop_analytics_outcome_grants;
  v_count integer;
begin
  if coalesce(auth.role(),'')<>'service_role' and session_user<>'postgres'
  then raise exception 'not authorized' using errcode='42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object'
  then raise exception 'invalid_request'; end if;
  if p_action='expire' then
    update public.workshop_analytics_outcome_grants set discarded_at=now()
    where consumed_at is null and discarded_at is null and expires_at<=now();
    get diagnostics v_count=row_count;
    return jsonb_build_object('state','expired','count',v_count);
  end if;
  if v_digest!~'^[0-9a-f]{64}$'
  then return jsonb_build_object('state','unavailable'); end if;
  if p_action='register_confirmation' then
    if char_length(v_status_digest)<43
    then return jsonb_build_object('state','unavailable'); end if;
    select b.* into v_booking from public.workshop_bookings b
    where b.status_token_digest=v_status_digest
      and b.status in('confirmed','checked_in','transferred')
      and b.payment_state in('paid','partially_refunded') for update;
    if not found then return jsonb_build_object('state','unavailable'); end if;
    insert into public.workshop_analytics_outcome_grants(
      workshop_booking_id,grant_digest,outcome_type,expires_at
    ) values(v_booking.workshop_booking_id,v_digest,'booking_confirmed',
      now()+interval '24 hours')
    on conflict(workshop_booking_id,outcome_type) do nothing
    returning * into v_grant;
    return jsonb_build_object('state',
      case when found then 'issued' else 'unavailable' end);
  end if;
  select * into v_grant from public.workshop_analytics_outcome_grants
  where grant_digest=v_digest for update;
  if not found or v_grant.consumed_at is not null
    or v_grant.discarded_at is not null
  then return jsonb_build_object('state','unavailable'); end if;
  if p_action='discard' then
    update public.workshop_analytics_outcome_grants set discarded_at=now()
    where workshop_analytics_outcome_grant_id=
      v_grant.workshop_analytics_outcome_grant_id;
    return jsonb_build_object('state','discarded');
  end if;
  if p_action<>'redeem' or v_grant.expires_at<=now()
    or v_grant.outcome_type<>'booking_confirmed'
  then
    if v_grant.expires_at<=now() then
      update public.workshop_analytics_outcome_grants set discarded_at=now()
      where workshop_analytics_outcome_grant_id=
        v_grant.workshop_analytics_outcome_grant_id;
    end if;
    return jsonb_build_object('state','unavailable');
  end if;
  select b.* into v_booking from public.workshop_bookings b
  where b.workshop_booking_id=v_grant.workshop_booking_id;
  select o.* into v_occurrence from public.workshop_occurrences o
  where o.workshop_occurrence_id=v_booking.workshop_occurrence_id;
  if not found then return jsonb_build_object('state','unavailable'); end if;
  update public.workshop_analytics_outcome_grants set consumed_at=now()
  where workshop_analytics_outcome_grant_id=
    v_grant.workshop_analytics_outcome_grant_id;
  return jsonb_build_object('state','redeemed','outcome',jsonb_build_object(
    'event','workshop_booking_confirmed','publicContentId',v_occurrence.slug,
    'category','workshop','quantity',v_booking.active_quantity,
    'currency',v_booking.currency,'valueMinor',v_booking.total_minor_snapshot));
end; $$;
revoke all on function public.manage_workshop_analytics_outcome(text,jsonb)
from public,anon,authenticated;
grant execute on function public.manage_workshop_analytics_outcome(text,jsonb)
to service_role;

create table public.workshop_personal_data_requests (
  workshop_personal_data_request_id uuid primary key default gen_random_uuid(),
  workshop_booking_id uuid not null references public.workshop_bookings(workshop_booking_id) on delete restrict,
  request_type text not null check(request_type in ('correction','minimization')),
  requested_field_categories text[] not null check(cardinality(requested_field_categories)>0),
  protected_proposed_corrections jsonb,
  state text not null default 'pending_verification' check(state in ('pending_verification','verified','approved','deferred','completed','denied','expired')),
  verification_method text not null check(verification_method in ('booking_status_token','email_link')),
  verification_token_digest text unique, verification_expires_at timestamptz, verified_at timestamptz,
  replacement_email_token_digest text unique, replacement_email_expires_at timestamptz,
  replacement_email_confirmed_at timestamptz, retention_policy_version text,
  processed_by uuid references public.profiles(id) on delete set null,
  reason_category text, earliest_eligible_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), processed_at timestamptz,
  constraint workshop_personal_data_email_verification check(verification_method<>'email_link' or (verification_token_digest is not null and verification_expires_at is not null and verification_expires_at<=created_at+interval '24 hours')),
  constraint workshop_personal_data_policy_resolution check(state not in ('approved','deferred','completed','denied') or retention_policy_version is not null),
  constraint workshop_personal_data_deferral check(state<>'deferred' or earliest_eligible_at is not null)
);
create index idx_workshop_personal_data_state on public.workshop_personal_data_requests(state,created_at);
create trigger trg_workshop_personal_data_updated_at before update on public.workshop_personal_data_requests for each row execute function public.set_updated_at();
alter table public.workshop_personal_data_requests enable row level security;
create policy workshop_personal_data_internal_select on public.workshop_personal_data_requests for select to authenticated using(public.is_internal_crm_user() and state<>'pending_verification');

create or replace function public.is_workshop_privacy_admin()
returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.profiles p join public.user_roles ur on ur.user_id=p.id
where p.id=auth.uid() and p.is_active=true and ur.role='admin'); $$;

create table public.workshop_data_retention_policies (
  workshop_data_retention_policy_id uuid primary key default gen_random_uuid(),
  policy_version text not null unique,
  state text not null default 'draft' check(state in ('draft','approved','active','retired')),
  effective_at timestamptz, field_rules jsonb not null default '[]'::jsonb check(jsonb_typeof(field_rules)='array'),
  operational_retention_days integer not null check(operational_retention_days>=0),
  communication_retention_days integer not null check(communication_retention_days>=0),
  financial_retention_days integer not null check(financial_retention_days>=0),
  dispute_retention_days integer not null check(dispute_retention_days>=0),
  audit_retention_days integer not null check(audit_retention_days>=0),
  approved_by uuid references public.profiles(id) on delete restrict, approved_at timestamptz,
  activated_by uuid references public.profiles(id) on delete restrict, activated_at timestamptz,
  retired_by uuid references public.profiles(id) on delete restrict, retired_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint workshop_retention_approval check(state='draft' or (approved_by is not null and approved_at is not null)),
  constraint workshop_retention_activation check(state not in ('active','retired') or (effective_at is not null and activated_by is not null and activated_at is not null)),
  constraint workshop_retention_retirement check(state<>'retired' or (retired_by is not null and retired_at is not null))
);
create unique index uq_workshop_retention_active on public.workshop_data_retention_policies((state)) where state='active';
create or replace function public.enforce_workshop_retention_policy_immutability()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'Workshop retention policies cannot be deleted.' using errcode='55000'; end if;
  if old.state='retired' then raise exception 'Retired workshop retention policies are immutable.' using errcode='55000'; end if;
  if old.state='active' and (
    new.state is distinct from 'retired' or new.policy_version is distinct from old.policy_version
    or new.field_rules is distinct from old.field_rules
    or new.operational_retention_days is distinct from old.operational_retention_days
    or new.communication_retention_days is distinct from old.communication_retention_days
    or new.financial_retention_days is distinct from old.financial_retention_days
    or new.dispute_retention_days is distinct from old.dispute_retention_days
    or new.audit_retention_days is distinct from old.audit_retention_days
    or new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at
    or new.activated_by is distinct from old.activated_by or new.activated_at is distinct from old.activated_at
    or new.effective_at is distinct from old.effective_at or new.retired_by is null or new.retired_at is null
  ) then raise exception 'Active workshop retention policy content is immutable; only controlled retirement is allowed.' using errcode='55000'; end if;
  return new;
end; $$;
create trigger trg_workshop_retention_policy_immutability before update or delete on public.workshop_data_retention_policies for each row execute function public.enforce_workshop_retention_policy_immutability();
create trigger trg_workshop_data_retention_updated_at before update on public.workshop_data_retention_policies for each row execute function public.set_updated_at();
alter table public.workshop_data_retention_policies enable row level security;
create policy workshop_retention_internal_select on public.workshop_data_retention_policies for select to authenticated using(public.is_internal_crm_user());
create policy workshop_retention_admin_insert on public.workshop_data_retention_policies for insert to authenticated with check(public.is_workshop_privacy_admin());
create policy workshop_retention_admin_update on public.workshop_data_retention_policies for update to authenticated using(public.is_workshop_privacy_admin()) with check(public.is_workshop_privacy_admin());
revoke all on function public.is_workshop_privacy_admin() from public;
grant execute on function public.is_workshop_privacy_admin() to authenticated;

revoke all on public.workshop_analytics_outcome_grants,
  public.workshop_personal_data_requests,
  public.workshop_data_retention_policies from anon;
grant select on public.workshop_analytics_outcome_grants,
  public.workshop_personal_data_requests,
  public.workshop_data_retention_policies to authenticated;
grant insert, update on public.workshop_data_retention_policies to authenticated;
