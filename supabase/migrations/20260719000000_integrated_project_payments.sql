begin;

alter table public.leads add column if not exists payment_conversion_command_key uuid null;
create unique index if not exists idx_leads_payment_conversion_command_key on public.leads(payment_conversion_command_key) where payment_conversion_command_key is not null;

-- Integrated project payments is additive. Apply after
-- 20260718000002_proposal_revision_snapshots.sql. Provider/reminder switches
-- are inserted disabled and no legacy financial row is deleted.

alter table public.project_payment_records drop constraint if exists project_payment_records_status_check;
alter table public.project_payment_records
  add column if not exists basis_snapshot_id uuid null references public.project_proposal_invoice_snapshots(project_proposal_invoice_snapshot_id) on delete set null,
  add column if not exists basis_version integer null,
  add column if not exists basis_total numeric(12,2) null,
  add column if not exists target_amount numeric(12,2) not null default 0,
  add column if not exists credited_principal numeric(12,2) not null default 0,
  add column if not exists outstanding_amount numeric(12,2) not null default 0,
  add column if not exists fulfillment_state text not null default 'not_due',
  add column if not exists deposit_target_frozen_at timestamptz null,
  add column if not exists reminder_enabled boolean not null default true,
  add column if not exists reminder_paused_until timestamptz null,
  add column if not exists reminder_pause_reason text null,
  add column if not exists reminder_pause_actor uuid null references public.profiles(id) on delete set null,
  add column if not exists migration_state text not null default 'native',
  add column if not exists fulfilled_at timestamptz null,
  add column if not exists waived_at timestamptz null,
  add column if not exists canceled_at timestamptz null,
  add column if not exists retention_eligible_at timestamptz null,
  add column if not exists last_method text null,
  add column if not exists last_intention_method text null;
alter table public.project_payment_records add constraint project_payment_records_status_check
  check (status in ('not_due','due','partially_paid','paid','overpaid','waived','canceled','review_required'));

update public.project_payment_records o set
  basis_snapshot_id=p.active_proposal_invoice_snapshot_id,
  basis_version=s.version,
  basis_total=s.total_amount,
  target_amount=case when o.amount_due>0 then o.amount_due when o.payment_kind='deposit' then round(s.total_amount*.30,2) else s.total_amount-round(s.total_amount*.30,2) end,
  credited_principal=greatest(o.amount_paid,0),
  outstanding_amount=greatest((case when o.amount_due>0 then o.amount_due when o.payment_kind='deposit' then round(s.total_amount*.30,2) else s.total_amount-round(s.total_amount*.30,2) end)-greatest(o.amount_paid,0),0),
  fulfillment_state=case when o.status='paid' then 'paid' when o.amount_paid>0 then 'partially_paid' else o.status end,
  migration_state=case when s.project_proposal_invoice_snapshot_id is null then 'ambiguous' else 'classified' end,
  fulfilled_at=case when o.status='paid' then coalesce(o.paid_date,o.updated_at) end,
  last_method=o.payment_method
from public.projects p left join public.project_proposal_invoice_snapshots s
  on s.project_proposal_invoice_snapshot_id=p.active_proposal_invoice_snapshot_id and s.project_id=p.project_id
where p.project_id=o.project_id and o.migration_state='native';

with ranked as (
  select project_payment_record_id,row_number() over(partition by project_id,payment_kind order by (status='paid') desc,updated_at desc,created_at desc) rn
  from public.project_payment_records where status<>'canceled'
)
update public.project_payment_records o set status='canceled',fulfillment_state='canceled',migration_state='ambiguous',canceled_at=now()
from ranked r where r.project_payment_record_id=o.project_payment_record_id and r.rn>1;
create unique index if not exists uq_project_payment_records_active_kind on public.project_payment_records(project_id,payment_kind) where status<>'canceled';

create table if not exists public.payment_collection_settings (
  settings_id boolean primary key default true check(settings_id), business_timezone text not null default 'America/New_York',
  send_window_start time not null default '09:00', send_window_end time not null default '17:00', cash_instructions text not null default '',
  check_instructions text not null default '', venmo_business_target text null, venmo_qr_url text null,
  stripe_enabled boolean not null default false, venmo_enabled boolean not null default false, reminders_enabled boolean not null default false,
  collection_enabled boolean not null default false, provider_environment text not null default 'sandbox' check(provider_environment in ('sandbox','production')),
  updated_by uuid null references public.profiles(id) on delete set null, updated_at timestamptz not null default now()
);
insert into public.payment_collection_settings(settings_id) values(true) on conflict(settings_id) do nothing;

create table if not exists public.payment_requests (
  payment_request_id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(project_id) on delete cascade,
  request_kind text not null check(request_kind in ('deposit','final_payment','consolidated')), status text not null default 'draft' check(status in ('draft','active','fulfilled','superseded','revoked','canceled')),
  token_digest text not null unique, token_ciphertext text null, token_iv text null, token_key_version text null,
  principal_amount numeric(12,2) not null check(principal_amount>0), deposit_amount numeric(12,2) not null default 0, final_amount numeric(12,2) not null default 0,
  proposal_snapshot_id uuid null references public.project_proposal_invoice_snapshots(project_proposal_invoice_snapshot_id) on delete set null, proposal_version integer null,
  original_recipient_contact_id uuid null references public.contacts(contact_id) on delete set null, original_recipient_email text null, recipient_fallback_used boolean not null default false,
  cash_instructions text not null default '', check_instructions text not null default '', supersedes_request_id uuid null references public.payment_requests(payment_request_id) on delete set null,
  superseded_by_request_id uuid null references public.payment_requests(payment_request_id) on delete set null, initial_delivery_state text not null default 'not_requested', command_key uuid not null unique,
  issued_at timestamptz not null default now(), activated_at timestamptz null, invalidated_at timestamptz null, fulfilled_at timestamptz null, revoked_at timestamptz null,
  retention_eligible_at timestamptz null, created_by uuid null references public.profiles(id) on delete set null, created_at timestamptz not null default now(),
  check(deposit_amount+final_amount=principal_amount), check(status in ('draft','active') or (token_ciphertext is null and invalidated_at is not null))
);
create unique index if not exists uq_payment_requests_active_project_kind on public.payment_requests(project_id,request_kind) where status='active';
create table if not exists public.payment_request_obligations (
  payment_request_id uuid not null references public.payment_requests(payment_request_id) on delete cascade,
  obligation_id uuid not null references public.project_payment_records(project_payment_record_id) on delete restrict,
  requested_amount numeric(12,2) not null check(requested_amount>0), display_order smallint not null check(display_order between 1 and 2),
  primary key(payment_request_id,obligation_id), unique(payment_request_id,display_order)
);
create table if not exists public.payment_checkout_attempts (
  payment_checkout_attempt_id uuid primary key default gen_random_uuid(), payment_request_id uuid not null references public.payment_requests(payment_request_id) on delete cascade,
  project_id uuid not null references public.projects(project_id) on delete cascade, method text not null check(method in ('stripe_card','paypal_venmo')),
  status text not null default 'creating' check(status in ('creating','active','processing','paid','failed','expired','canceled')),
  principal_amount numeric(12,2) not null check(principal_amount>0), customer_fee numeric(12,2) not null default 0 check(customer_fee=0), charge_amount numeric(12,2) not null check(charge_amount=principal_amount),
  fee_policy_decision text not null default 'disabled' check(fee_policy_decision='disabled'), fee_policy_reason text not null default 'Customer card surcharging is disabled for this release.',
  provider_session_id text null unique, provider_order_id text null unique, provider_payment_id text null unique, provider_capture_id text null unique,
  provider_handoff_url text null, provider_client_token text null, create_idempotency_key text not null unique, capture_idempotency_key text null unique,
  expires_at timestamptz not null, resolved_at timestamptz null, canceled_at timestamptz null, canceled_by uuid null references public.profiles(id) on delete set null,
  canceled_reason text null,last_verified_state text null,retention_eligible_at timestamptz null,created_at timestamptz not null default now()
);
create unique index if not exists uq_payment_checkout_attempts_active_request on public.payment_checkout_attempts(payment_request_id) where status in ('creating','active','processing');

create sequence if not exists public.payment_reference_sequence;
create table if not exists public.payment_transactions (
  payment_transaction_id uuid primary key default gen_random_uuid(),payment_reference text not null unique,project_id uuid not null references public.projects(project_id) on delete restrict,
  payment_request_id uuid null references public.payment_requests(payment_request_id) on delete set null,payment_checkout_attempt_id uuid null references public.payment_checkout_attempts(payment_checkout_attempt_id) on delete set null,
  kind text not null check(kind in ('receipt','refund','reversal','dispute','void','correction','credit_allocation','external_refund')),status text not null check(status in ('pending','confirmed','failed','resolved')),
  principal_amount numeric(12,2) not null,customer_fee numeric(12,2) not null default 0,merchant_fee numeric(12,2) null,method text not null,source text not null check(source in ('manual','stripe','paypal','imported','system')),
  occurred_at timestamptz not null,recorded_at timestamptz not null default now(),actor_type text not null check(actor_type in ('florist','customer','provider','schedule','system')),actor_id uuid null,
  provider_reference text null,command_key uuid null unique,duplicate_override boolean not null default false,duplicate_override_reason text null,suspected_reference text null,
  customer_notice_policy text not null default 'none' check(customer_notice_policy in ('required','optional','none')),customer_notice_state text not null default 'not_queued',note text null,payload_digest text null,
  normalized_facts jsonb not null default '{}'::jsonb,retention_eligible_at timestamptz null,
  check(not duplicate_override or (nullif(btrim(duplicate_override_reason),'') is not null and nullif(btrim(suspected_reference),'') is not null))
);
create unique index if not exists uq_payment_transactions_provider_reference on public.payment_transactions(source,provider_reference) where provider_reference is not null;
create table if not exists public.payment_transaction_allocations (
  payment_transaction_allocation_id uuid primary key default gen_random_uuid(),payment_transaction_id uuid not null references public.payment_transactions(payment_transaction_id) on delete restrict,
  obligation_id uuid not null references public.project_payment_records(project_payment_record_id) on delete restrict,allocated_principal numeric(12,2) not null check(allocated_principal<>0),
  sequence smallint not null check(sequence between 1 and 2),created_at timestamptz not null default now(),unique(payment_transaction_id,obligation_id,sequence)
);

create table if not exists public.payment_intentions (
  payment_intention_id uuid primary key default gen_random_uuid(),payment_request_id uuid not null references public.payment_requests(payment_request_id) on delete cascade,
  project_id uuid not null references public.projects(project_id) on delete cascade,obligation_id uuid null references public.project_payment_records(project_payment_record_id) on delete set null,
  method text not null check(method in ('cash','check','venmo_business_profile')),state text not null default 'active' check(state in ('active','superseded','fulfilled','expired')),
  instruction_snapshot text null,reference text null,pause_started_at timestamptz not null default now(),pause_ends_at timestamptz not null,superseded_at timestamptz null,fulfilled_at timestamptz null,created_at timestamptz not null default now(),
  check(pause_ends_at=pause_started_at+interval '7 days')
);
create unique index if not exists uq_payment_intentions_active_request on public.payment_intentions(payment_request_id) where state='active';
create table if not exists public.payment_message_deliveries (
  payment_message_delivery_id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(project_id) on delete cascade,
  obligation_id uuid null references public.project_payment_records(project_payment_record_id) on delete set null,payment_request_id uuid null references public.payment_requests(payment_request_id) on delete set null,
  payment_transaction_id uuid null references public.payment_transactions(payment_transaction_id) on delete set null,delivery_kind text not null check(delivery_kind in ('initial_request','deposit_reminder','final_reminder','receipt','adjustment_notice')),
  occurrence_key text not null,scheduled_local_date date null,scheduled_timezone text null,recipient_contact_id uuid null references public.contacts(contact_id) on delete set null,recipient_email text null,recipient_fallback_used boolean not null default false,
  principal_amount numeric(12,2) not null default 0,customer_fee numeric(12,2) not null default 0,status text not null default 'queued' check(status in ('queued','claimed','accepted','delivered','temporary_failed','permanent_failed','suppressed','delivery_unknown','canceled')),
  attempt_number integer not null default 1,retry_of_delivery_id uuid null references public.payment_message_deliveries(payment_message_delivery_id) on delete set null,mailgun_message_id text null unique,
  claimed_at timestamptz null,sent_at timestamptz null,accepted_at timestamptz null,delivered_at timestamptz null,failed_at timestamptz null,failure_class text null,redacted_error text null,suppression_reason text null,
  retention_eligible_at timestamptz null,created_at timestamptz not null default now(),unique(occurrence_key,attempt_number)
);
create index if not exists idx_payment_message_deliveries_claim on public.payment_message_deliveries(status,scheduled_local_date,created_at);
create table if not exists public.payment_message_delivery_events (
  payment_message_delivery_event_id uuid primary key default gen_random_uuid(),payment_message_delivery_id uuid not null references public.payment_message_deliveries(payment_message_delivery_id) on delete cascade,
  provider_event_identity text not null unique,event_type text not null,provider_timestamp timestamptz not null,signature_verified_at timestamptz not null,payload_digest text not null,
  normalized_facts jsonb not null default '{}'::jsonb,received_at timestamptz not null default now()
);
create table if not exists public.payment_provider_events (
  payment_provider_event_id uuid primary key default gen_random_uuid(),provider text not null check(provider in ('stripe','paypal')),provider_event_id text not null,provider_object_id text null,provider_object_type text null,
  event_type text not null,event_occurred_at timestamptz not null,signature_verified_at timestamptz not null,payload_digest text not null,normalized_facts jsonb not null default '{}'::jsonb,
  processing_state text not null default 'received' check(processing_state in ('received','processed','duplicate','failed','unmatched')),processing_error text null,
  payment_checkout_attempt_id uuid null references public.payment_checkout_attempts(payment_checkout_attempt_id) on delete set null,payment_transaction_id uuid null references public.payment_transactions(payment_transaction_id) on delete set null,
  received_at timestamptz not null default now(),processed_at timestamptz null,retention_eligible_at timestamptz null,unique(provider,provider_event_id)
);
create unique index if not exists uq_payment_provider_events_object_effect on public.payment_provider_events(provider,provider_object_id,event_type) where provider_object_id is not null and processing_state='processed';
create table if not exists public.payment_exceptions (
  payment_exception_id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(project_id) on delete cascade,obligation_id uuid null references public.project_payment_records(project_payment_record_id) on delete set null,
  payment_request_id uuid null references public.payment_requests(payment_request_id) on delete set null,payment_checkout_attempt_id uuid null references public.payment_checkout_attempts(payment_checkout_attempt_id) on delete set null,
  payment_transaction_id uuid null references public.payment_transactions(payment_transaction_id) on delete set null,payment_provider_event_id uuid null references public.payment_provider_events(payment_provider_event_id) on delete set null,
  exception_type text not null check(exception_type in ('legacy_ambiguity','unmatched_provider_event','suspected_duplicate','overpayment','adjustment_reopened_balance','delivery_unknown','reconciliation_failure','status_transition_failure')),
  urgency text not null default 'normal' check(urgency in ('normal','urgent')),state text not null default 'open' check(state in ('open','acknowledged','resolved')),amount numeric(12,2) null,summary text not null,redacted_detail text null,
  resolution text null check(resolution is null or resolution in ('external_refund','retained_credit','correction','matched','dismissed','status_reviewed')),resolution_reference text null,retained_unapplied_credit numeric(12,2) not null default 0,
  resolved_by uuid null references public.profiles(id) on delete set null,resolved_at timestamptz null,retention_eligible_at timestamptz null,created_at timestamptz not null default now()
);
create index if not exists idx_payment_exceptions_open on public.payment_exceptions(state,urgency,created_at);
create table if not exists public.payment_legal_holds (
  payment_legal_hold_id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(project_id) on delete restrict,action text not null check(action in ('placed','released')),
  hold_type text not null check(hold_type in ('legal','dispute')),reason text not null check(nullif(btrim(reason),'') is not null),command_key uuid not null unique,
  actor_id uuid not null references public.profiles(id) on delete restrict,created_at timestamptz not null default now()
);
create index if not exists idx_payment_legal_holds_project_created on public.payment_legal_holds(project_id,created_at desc);

alter table public.payment_requests alter column retention_eligible_at set default (now()+interval '7 years');
alter table public.payment_checkout_attempts alter column retention_eligible_at set default (now()+interval '7 years');
alter table public.payment_transactions alter column retention_eligible_at set default (now()+interval '7 years');
alter table public.payment_message_deliveries alter column retention_eligible_at set default (now()+interval '7 years');
alter table public.payment_provider_events alter column retention_eligible_at set default (now()+interval '7 years');
alter table public.payment_exceptions alter column retention_eligible_at set default (now()+interval '7 years');

-- Import evidence-backed legacy paid amounts into immutable receipts.
insert into public.payment_transactions(payment_reference,project_id,kind,status,principal_amount,method,source,occurred_at,actor_type,actor_id,provider_reference,note)
select 'BBP-LEGACY-'||replace(o.project_payment_record_id::text,'-',''),o.project_id,'receipt','confirmed',o.amount_paid,coalesce(o.payment_method,'other'),'imported',coalesce(o.paid_date,o.updated_at),'system',o.recorded_by,o.external_payment_id,'Imported from legacy project payment record'
from public.project_payment_records o where o.amount_paid>0 and o.migration_state='classified'
on conflict(payment_reference) do nothing;
insert into public.payment_transaction_allocations(payment_transaction_id,obligation_id,allocated_principal,sequence)
select t.payment_transaction_id,o.project_payment_record_id,least(t.principal_amount,o.target_amount),case when o.payment_kind='deposit' then 1 else 2 end
from public.project_payment_records o join public.payment_transactions t on t.payment_reference='BBP-LEGACY-'||replace(o.project_payment_record_id::text,'-','')
on conflict do nothing;
insert into public.payment_exceptions(project_id,obligation_id,exception_type,urgency,summary,redacted_detail)
select project_id,project_payment_record_id,'legacy_ambiguity','urgent','Legacy payment record requires review','Active proposal basis or duplicate legacy evidence was ambiguous.'
from public.project_payment_records where migration_state='ambiguous'
and not exists(select 1 from public.payment_exceptions e where e.obligation_id=project_payment_record_id and e.exception_type='legacy_ambiguity');

-- Tables are read-only to authenticated users; all mutation is through narrow
-- security-definer commands. Service role bypasses RLS for verified callbacks.
do $$ declare t text; begin foreach t in array array['payment_collection_settings','payment_requests','payment_request_obligations','payment_checkout_attempts','payment_transactions','payment_transaction_allocations','payment_intentions','payment_message_deliveries','payment_message_delivery_events','payment_provider_events','payment_exceptions','payment_legal_holds'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists %I on public.%I',t||'_internal_select',t);
  execute format('create policy %I on public.%I for select to authenticated using (public.is_internal_crm_user())',t||'_internal_select',t);
end loop; end $$;

create or replace function public.prevent_payment_financial_mutation() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Payment financial history is immutable'; end; $$;
drop trigger if exists trg_payment_transactions_immutable on public.payment_transactions;
create trigger trg_payment_transactions_immutable before update or delete on public.payment_transactions for each row execute function public.prevent_payment_financial_mutation();
drop trigger if exists trg_payment_allocations_immutable on public.payment_transaction_allocations;
create trigger trg_payment_allocations_immutable before update or delete on public.payment_transaction_allocations for each row execute function public.prevent_payment_financial_mutation();
drop trigger if exists trg_payment_provider_events_no_delete on public.payment_provider_events;
create trigger trg_payment_provider_events_no_delete before delete on public.payment_provider_events for each row execute function public.prevent_payment_financial_mutation();

revoke all on public.payment_collection_settings,public.payment_requests,public.payment_request_obligations,public.payment_checkout_attempts,public.payment_transactions,public.payment_transaction_allocations,public.payment_intentions,public.payment_message_deliveries,public.payment_message_delivery_events,public.payment_provider_events,public.payment_exceptions,public.payment_legal_holds from anon;
revoke all on public.project_payment_records from anon;
revoke insert,update,delete on public.project_payment_records,public.payment_collection_settings,public.payment_requests,public.payment_request_obligations,public.payment_checkout_attempts,public.payment_transactions,public.payment_transaction_allocations,public.payment_intentions,public.payment_message_deliveries,public.payment_message_delivery_events,public.payment_provider_events,public.payment_exceptions,public.payment_legal_holds from authenticated;
grant select on public.project_payment_records,public.payment_collection_settings,public.payment_requests,public.payment_request_obligations,public.payment_checkout_attempts,public.payment_transactions,public.payment_transaction_allocations,public.payment_intentions,public.payment_message_deliveries,public.payment_message_delivery_events,public.payment_provider_events,public.payment_exceptions,public.payment_legal_holds to authenticated;
revoke select on public.payment_requests from authenticated;
grant select(payment_request_id,project_id,request_kind,status,principal_amount,deposit_amount,final_amount,proposal_snapshot_id,proposal_version,original_recipient_contact_id,original_recipient_email,recipient_fallback_used,cash_instructions,check_instructions,supersedes_request_id,superseded_by_request_id,initial_delivery_state,issued_at,activated_at,invalidated_at,fulfilled_at,revoked_at,retention_eligible_at,created_by,created_at) on public.payment_requests to authenticated;

create or replace function public.generate_payment_reference()
returns text
language sql
security definer
set search_path = ''
as $$
  select 'BBP-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.payment_reference_sequence')::text, 8, '0');
$$;
revoke all on function public.generate_payment_reference() from public, anon, authenticated;
grant execute on function public.generate_payment_reference() to service_role;

create or replace function public.create_payment_activity(
  p_project_id uuid,
  p_label text,
  p_description text,
  p_actor_type text,
  p_metadata jsonb default '{}'::jsonb,
  p_actor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if p_metadata ?| array['token','url','raw_payload','provider_payload','email_body'] then
    raise exception 'Sensitive payment activity metadata is prohibited';
  end if;
  insert into public.activity_log(entity_type, entity_id, activity_type, activity_label, description, performed_by, metadata)
  values ('project'::public.activity_entity_type, p_project_id, 'payment_recorded'::public.activity_type,
          p_label, p_description, p_actor_id,
          coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('actor_type', p_actor_type))
  returning activity_log_id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_payment_activity(uuid,text,text,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.create_payment_activity(uuid,text,text,text,jsonb,uuid) to service_role;

create or replace function public.resolve_project_billing_recipient(p_project_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  with candidate as (
    select c.contact_id, c.email,
           (c.contact_id <> p.primary_contact_id) as fallback_used,
           row_number() over(order by (c.contact_id = p.primary_contact_id) desc, pc.is_primary desc, pc.created_at) as rank
    from public.projects p
    join public.project_contacts pc on pc.project_id=p.project_id
    join public.contacts c on c.contact_id=pc.contact_id
    where p.project_id=p_project_id and nullif(btrim(c.email),'') is not null and not c.is_archived
  )
  select coalesce((select jsonb_build_object('contact_id',contact_id,'email',lower(email),'fallback_used',fallback_used) from candidate where rank=1),
                  jsonb_build_object('contact_id',null,'email',null,'fallback_used',false));
$$;
revoke all on function public.resolve_project_billing_recipient(uuid) from public, anon;
grant execute on function public.resolve_project_billing_recipient(uuid) to authenticated, service_role;

create or replace function public.resolve_project_payment_basis(p_project_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'available', s.project_proposal_invoice_snapshot_id is not null,
    'snapshot_id', s.project_proposal_invoice_snapshot_id,
    'version', s.version,
    'total', s.total_amount,
    'deposit', round(s.total_amount * .30, 2),
    'final', s.total_amount - round(s.total_amount * .30, 2),
    'final_due_date', coalesce(s.final_balance_due_date, p.event_date - 30)
  )
  from public.projects p
  left join public.project_proposal_invoice_snapshots s
    on s.project_proposal_invoice_snapshot_id=p.active_proposal_invoice_snapshot_id
   and s.project_id=p.project_id and s.is_active
  where p.project_id=p_project_id;
$$;
revoke all on function public.resolve_project_payment_basis(uuid) from public, anon;
grant execute on function public.resolve_project_payment_basis(uuid) to authenticated, service_role;

create or replace function public.recompute_project_payment_obligations(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.project_payment_records o
  set credited_principal=greatest(coalesce(a.credited,0),0),
      amount_paid=greatest(coalesce(a.credited,0),0),
      outstanding_amount=greatest(o.target_amount-coalesce(a.credited,0),0),
      status=case when o.status in ('waived','canceled','review_required') then o.status
                  when coalesce(a.credited,0)<=0 then case when o.due_date<=current_date then 'due' else 'not_due' end
                  when coalesce(a.credited,0)<o.target_amount then 'partially_paid'
                  when coalesce(a.credited,0)=o.target_amount then 'paid' else 'overpaid' end,
      fulfillment_state=case when o.status in ('waived','canceled','review_required') then o.status
                  when coalesce(a.credited,0)<=0 then case when o.due_date<=current_date then 'due' else 'not_due' end
                  when coalesce(a.credited,0)<o.target_amount then 'partially_paid'
                  when coalesce(a.credited,0)=o.target_amount then 'paid' else 'overpaid' end,
      fulfilled_at=case when coalesce(a.credited,0)>=o.target_amount and o.target_amount>0 then coalesce(o.fulfilled_at,now()) else null end,
      updated_at=now()
  from (select obligation_id, sum(allocated_principal) credited from public.payment_transaction_allocations group by obligation_id) a
  where o.project_id=p_project_id and a.obligation_id=o.project_payment_record_id;

  update public.project_payment_records set credited_principal=0, amount_paid=0,
    outstanding_amount=target_amount,
    status=case when status in ('waived','canceled','review_required') then status when due_date<=current_date then 'due' else 'not_due' end,
    fulfillment_state=case when fulfillment_state in ('waived','canceled','review_required') then fulfillment_state when due_date<=current_date then 'due' else 'not_due' end,
    fulfilled_at=null, updated_at=now()
  where project_id=p_project_id and not exists(select 1 from public.payment_transaction_allocations a where a.obligation_id=project_payment_record_id);
end;
$$;
revoke all on function public.recompute_project_payment_obligations(uuid) from public, anon, authenticated;
grant execute on function public.recompute_project_payment_obligations(uuid) to service_role;

create or replace function public.list_payment_obligations(
  p_search text default null,
  p_kind text default null,
  p_state text default null,
  p_method text default null,
  p_due_timing text default null,
  p_sort text default 'event_date',
  p_direction text default 'asc',
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare v_rows jsonb; v_total bigint;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
  with filtered as (
    select o.*, p.project_name, p.event_date, p.primary_contact_id,
      trim(concat(c.first_name,' ',c.last_name)) customer_name, c.email customer_email,
      exists(select 1 from public.payment_exceptions e where e.obligation_id=o.project_payment_record_id and e.state<>'resolved') has_exception,
      exists(select 1 from public.payment_message_deliveries d where d.obligation_id=o.project_payment_record_id and d.status in ('temporary_failed','permanent_failed','delivery_unknown')) has_delivery_issue
    from public.project_payment_records o join public.projects p on p.project_id=o.project_id
    left join public.contacts c on c.contact_id=p.primary_contact_id
    where o.status<>'canceled'
      and (p_search is null or p_search='' or p.project_name ilike '%'||p_search||'%' or trim(concat(c.first_name,' ',c.last_name)) ilike '%'||p_search||'%' or c.email ilike '%'||p_search||'%')
      and (p_kind is null or o.payment_kind=p_kind)
      and (p_state is null or o.fulfillment_state=p_state)
      and (p_method is null or o.last_method=p_method or o.last_intention_method=p_method)
      and (p_due_timing is null or (p_due_timing='overdue' and o.due_date<current_date and o.outstanding_amount>0) or (p_due_timing='upcoming' and o.due_date>=current_date))
  ), paged as (
    select * from filtered order by
      case when p_sort='event_date' and p_direction='asc' then event_date end asc nulls last,
      case when p_sort='event_date' and p_direction='desc' then event_date end desc nulls last,
      case when p_sort='due_date' and p_direction='asc' then due_date end asc nulls last,
      case when p_sort='due_date' and p_direction='desc' then due_date end desc nulls last,
      created_at desc
    limit least(greatest(p_page_size,1),100) offset greatest(p_page-1,0)*least(greatest(p_page_size,1),100)
  )
  select coalesce(jsonb_agg(to_jsonb(paged)),'[]'::jsonb) into v_rows from paged;
  select count(*) into v_total from filtered;
  return jsonb_build_object('rows',v_rows,'total',v_total,'page',greatest(p_page,1),'pageSize',least(greatest(p_page_size,1),100));
end;
$$;
revoke all on function public.list_payment_obligations(text,text,text,text,text,text,text,integer,integer) from public, anon;
grant execute on function public.list_payment_obligations(text,text,text,text,text,text,text,integer,integer) to authenticated;

create or replace function public.get_payment_obligation_detail(p_obligation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare v_project_id uuid; v_result jsonb;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
  select project_id into v_project_id from public.project_payment_records where project_payment_record_id=p_obligation_id;
  if v_project_id is null then return null; end if;
  select jsonb_build_object(
    'obligation',to_jsonb(o), 'project',jsonb_build_object('project_id',p.project_id,'project_name',p.project_name,'event_date',p.event_date,'status',p.status),
    'requests',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.payment_request_obligations ro join public.payment_requests r using(payment_request_id) where ro.obligation_id=o.project_payment_record_id),'[]'::jsonb),
    'checkouts',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.payment_checkout_attempts a where a.project_id=o.project_id),'[]'::jsonb),
    'intentions',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from public.payment_intentions i where i.project_id=o.project_id and (i.obligation_id is null or i.obligation_id=o.project_payment_record_id)),'[]'::jsonb),
    'transactions',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('allocations',(select coalesce(jsonb_agg(to_jsonb(a) order by a.sequence),'[]'::jsonb) from public.payment_transaction_allocations a where a.payment_transaction_id=t.payment_transaction_id)) order by t.occurred_at desc) from public.payment_transactions t where t.project_id=o.project_id),'[]'::jsonb),
    'deliveries',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from public.payment_message_deliveries d where d.project_id=o.project_id and (d.obligation_id is null or d.obligation_id=o.project_payment_record_id)),'[]'::jsonb),
    'exceptions',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from public.payment_exceptions e where e.project_id=o.project_id and (e.obligation_id is null or e.obligation_id=o.project_payment_record_id)),'[]'::jsonb),
    'legalHolds',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc) from public.payment_legal_holds h where h.project_id=o.project_id),'[]'::jsonb),
    'activity',coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from public.activity_log l where l.entity_type='project' and l.entity_id=o.project_id),'[]'::jsonb)
  ) into v_result from public.project_payment_records o join public.projects p on p.project_id=o.project_id where o.project_payment_record_id=p_obligation_id;
  return v_result;
end;
$$;
revoke all on function public.get_payment_obligation_detail(uuid) from public, anon;
grant execute on function public.get_payment_obligation_detail(uuid) to authenticated;

create or replace function public.get_project_financial_summary(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare v_result jsonb;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'available',s.project_proposal_invoice_snapshot_id is not null,
    'proposalTotal',s.total_amount,
    'depositTarget',coalesce(max(o.target_amount) filter(where o.payment_kind='deposit'),0),
    'finalTarget',coalesce(max(o.target_amount) filter(where o.payment_kind='final_payment'),0),
    'creditedPrincipal',coalesce(sum(o.credited_principal),0),
    'outstanding',coalesce(sum(o.outstanding_amount),0),
    'customerFees',coalesce((select sum(t.customer_fee) from public.payment_transactions t where t.project_id=p_project_id and t.status='confirmed'),0),
    'merchantFees',coalesce((select sum(t.merchant_fee) from public.payment_transactions t where t.project_id=p_project_id and t.status='confirmed'),0),
    'overpayment',coalesce((select sum(e.amount) from public.payment_exceptions e where e.project_id=p_project_id and e.exception_type='overpayment' and e.state<>'resolved'),0),
    'obligations',coalesce(jsonb_agg(to_jsonb(o) order by o.payment_kind),'[]'::jsonb)
  ) into v_result from public.projects p
  left join public.project_proposal_invoice_snapshots s on s.project_proposal_invoice_snapshot_id=p.active_proposal_invoice_snapshot_id and s.project_id=p.project_id
  left join public.project_payment_records o on o.project_id=p.project_id and o.status<>'canceled'
  where p.project_id=p_project_id group by s.project_proposal_invoice_snapshot_id,s.total_amount;
  return coalesce(v_result,jsonb_build_object('available',false));
end;
$$;
revoke all on function public.get_project_financial_summary(uuid) from public, anon;
grant execute on function public.get_project_financial_summary(uuid) to authenticated;


create or replace function public.record_manual_payment(
  p_project_id uuid, p_obligation_id uuid, p_amount_cents bigint, p_method text,
  p_received_at timestamptz, p_note text, p_suspected_reference text default null,
  p_override_reason text default null, p_command_key uuid default gen_random_uuid(),
  p_confirm_overpayment boolean default false
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_existing public.payment_transactions; v_duplicate public.payment_transactions;
v_transaction public.payment_transactions; v_amount numeric(12,2):=p_amount_cents/100.0; v_remaining numeric(12,2); v_project_outstanding numeric(12,2);
v_obligation public.project_payment_records; v_row public.project_payment_records; v_alloc numeric(12,2); v_sequence int:=0; v_overpayment numeric(12,2):=0;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
  if p_amount_cents<=0 then raise exception 'Amount must be greater than zero'; end if;
  if p_received_at is null or p_received_at>now()+interval '5 minutes' then raise exception 'Receipt date is invalid'; end if;
  if p_method not in ('venmo','check','cash','other','stripe') then raise exception 'Unsupported payment method'; end if;
  select * into v_existing from public.payment_transactions where command_key=p_command_key;
  if found then return jsonb_build_object('state','recorded','transaction',to_jsonb(v_existing),'replayed',true); end if;
  select * into v_obligation from public.project_payment_records where project_payment_record_id=p_obligation_id and project_id=p_project_id and status not in ('canceled','waived') for update;
  if not found then raise exception 'Payment obligation is unavailable'; end if;
  select * into v_duplicate from public.payment_transactions where project_id=p_project_id and status='confirmed' and kind='receipt' and principal_amount=v_amount and method=p_method and occurred_at between p_received_at-interval '1 day' and p_received_at+interval '1 day' order by occurred_at desc limit 1;
  if found and (nullif(btrim(p_override_reason),'') is null or p_suspected_reference is distinct from v_duplicate.payment_reference) then
    return jsonb_build_object('state','duplicate_warning','suspectedReference',v_duplicate.payment_reference);
  end if;
  select coalesce(sum(outstanding_amount),0) into v_project_outstanding from public.project_payment_records where project_id=p_project_id and status not in ('canceled','waived');
  if v_amount>v_project_outstanding and not p_confirm_overpayment then return jsonb_build_object('state','overpayment_warning','overpaymentAmount',v_amount-v_project_outstanding); end if;
  insert into public.payment_transactions(payment_reference,project_id,kind,status,principal_amount,method,source,occurred_at,actor_type,actor_id,command_key,duplicate_override,duplicate_override_reason,suspected_reference,customer_notice_policy,customer_notice_state,note)
  values(public.generate_payment_reference(),p_project_id,'receipt','confirmed',v_amount,p_method,'manual',p_received_at,'florist',v_actor,p_command_key,v_duplicate.payment_transaction_id is not null,p_override_reason,p_suspected_reference,'required','queued',nullif(btrim(p_note),'')) returning * into v_transaction;
  v_remaining:=least(v_amount,v_project_outstanding);
  for v_row in select * from public.project_payment_records where project_id=p_project_id and status not in ('canceled','waived') order by case payment_kind when 'deposit' then 1 else 2 end for update loop
    exit when v_remaining<=0; v_alloc:=least(v_remaining,v_row.outstanding_amount);
    if v_alloc>0 then v_sequence:=v_sequence+1; insert into public.payment_transaction_allocations(payment_transaction_id,obligation_id,allocated_principal,sequence) values(v_transaction.payment_transaction_id,v_row.project_payment_record_id,v_alloc,v_sequence); v_remaining:=v_remaining-v_alloc; end if;
  end loop;
  perform public.recompute_project_payment_obligations(p_project_id);
  select greatest(v_amount-v_project_outstanding,0) into v_overpayment;
  if v_overpayment>0 then insert into public.payment_exceptions(project_id,payment_transaction_id,exception_type,urgency,amount,summary) values(p_project_id,v_transaction.payment_transaction_id,'overpayment','urgent',v_overpayment,'Payment exceeds the complete project balance'); end if;
  update public.projects p set status=case
      when p.status='awaiting_deposit' and not exists(select 1 from public.project_payment_records o where o.project_id=p.project_id and o.payment_kind='deposit' and o.outstanding_amount>0 and o.status not in ('waived','canceled'))
        then case when exists(select 1 from public.project_payment_records o where o.project_id=p.project_id and o.payment_kind='final_payment' and o.outstanding_amount>0 and o.status not in ('waived','canceled')) then 'booked'::public.project_status else 'final_prep'::public.project_status end
      when p.status='awaiting_final_payment' and not exists(select 1 from public.project_payment_records o where o.project_id=p.project_id and o.outstanding_amount>0 and o.status not in ('waived','canceled')) then 'final_prep'::public.project_status
      else p.status end,
    booked_at=case when p.status='awaiting_deposit' then coalesce(p.booked_at,now()) else p.booked_at end, updated_at=now()
  where p.project_id=p_project_id and p.status not in ('completed','canceled');
  perform public.create_payment_activity(p_project_id,'Payment recorded',initcap(replace(v_obligation.payment_kind,'_',' '))||' payment '||v_transaction.payment_reference||' was recorded.','florist',jsonb_build_object('payment_reference',v_transaction.payment_reference,'payment_kind',v_obligation.payment_kind,'method',p_method,'principal_amount',v_amount),v_actor);
  insert into public.payment_message_deliveries(project_id,obligation_id,payment_transaction_id,delivery_kind,occurrence_key,principal_amount,status)
  values(p_project_id,p_obligation_id,v_transaction.payment_transaction_id,'receipt','receipt:'||v_transaction.payment_transaction_id,v_amount,'queued');
  return jsonb_build_object('state','recorded','transaction',to_jsonb(v_transaction),'overpaymentAmount',v_overpayment,'replayed',false);
end; $$;
revoke all on function public.record_manual_payment(uuid,uuid,bigint,text,timestamptz,text,text,text,uuid,boolean) from public,anon;
grant execute on function public.record_manual_payment(uuid,uuid,bigint,text,timestamptz,text,text,text,uuid,boolean) to authenticated;

create or replace function public.set_payment_obligation_state(p_obligation_id uuid,p_state text,p_reason text,p_command_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row public.project_payment_records; begin
 if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
 if p_state not in ('waived','canceled') or nullif(btrim(p_reason),'') is null then raise exception 'A valid state and reason are required'; end if;
 update public.project_payment_records set status=p_state,fulfillment_state=p_state,waived_at=case when p_state='waived' then now() end,canceled_at=case when p_state='canceled' then now() end,updated_at=now()
 where project_payment_record_id=p_obligation_id and status not in ('paid','waived','canceled') returning * into v_row;
 if not found then raise exception 'Obligation cannot be changed'; end if;
 perform public.create_payment_activity(v_row.project_id,'Payment obligation '||p_state,p_reason,'florist',jsonb_build_object('obligation_id',p_obligation_id,'command_key',p_command_key),auth.uid());
 return to_jsonb(v_row);
end; $$;
revoke all on function public.set_payment_obligation_state(uuid,text,text,uuid) from public,anon;
grant execute on function public.set_payment_obligation_state(uuid,text,text,uuid) to authenticated;


create or replace function public.convert_lead_to_project_with_payments(
  p_lead_id uuid, p_project_fields jsonb, p_contact_fields jsonb,
  p_command_key uuid, p_test_fail_after_stage text default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_lead public.leads; v_proposal public.floral_proposals; v_project public.projects;
v_primary public.contacts; v_partner public.contacts; v_planner public.contacts; v_snapshot public.project_proposal_invoice_snapshots;
v_deposit public.project_payment_records; v_final public.project_payment_records; v_test boolean:=coalesce(current_setting('app.payment_test_mode',true),'off')='on';
begin
  if not public.is_internal_crm_user() and not v_test then raise exception 'not authorized'; end if;
  select * into v_lead from public.leads where lead_id=p_lead_id for update;
  if not found then raise exception 'Lead not found'; end if;
  if v_lead.payment_conversion_command_key=p_command_key and v_lead.converted_project_id is not null then
    return (select jsonb_build_object('project',to_jsonb(p),'primaryContactId',v_lead.converted_primary_contact_id,'partnerContactId',null,'plannerContactId',null,'depositObligationId',(select project_payment_record_id from public.project_payment_records where project_id=p.project_id and payment_kind='deposit' and status<>'canceled'),'finalObligationId',(select project_payment_record_id from public.project_payment_records where project_id=p.project_id and payment_kind='final_payment' and status<>'canceled'),'replayed',true) from public.projects p where p.project_id=v_lead.converted_project_id);
  end if;
  if v_lead.status<>'proposal_accepted' then raise exception 'Only accepted proposal leads can be converted'; end if;
  select * into v_proposal from public.floral_proposals where lead_id=p_lead_id and is_active and status='accepted' order by version desc limit 1 for update;
  if not found or v_proposal.total_amount<=0 then raise exception 'An accepted active proposal with a positive total is required'; end if;
  insert into public.contacts(first_name,last_name,email,phone,preferred_contact_method,contact_type,notes,created_from_lead_id)
  values(v_lead.first_name,v_lead.last_name,lower(v_lead.email),v_lead.phone,v_lead.preferred_contact_method,'client','Primary client contact created from lead conversion.',v_lead.lead_id) returning * into v_primary;
  if p_test_fail_after_stage='contact' and v_test then raise exception 'forced conversion failure after contact'; end if;
  if nullif(btrim(v_lead.partner_first_name),'') is not null or nullif(btrim(v_lead.partner_last_name),'') is not null then
    insert into public.contacts(first_name,last_name,contact_type,notes,created_from_lead_id) values(coalesce(nullif(btrim(v_lead.partner_first_name),''),'Partner'),coalesce(nullif(btrim(v_lead.partner_last_name),''),v_lead.last_name),'partner','Partner contact created from lead conversion.',v_lead.lead_id) returning * into v_partner;
  end if;
  if nullif(btrim(v_lead.planner_name),'') is not null or nullif(btrim(v_lead.planner_email),'') is not null or nullif(btrim(v_lead.planner_phone),'') is not null then
    insert into public.contacts(first_name,last_name,email,phone,contact_type,notes,created_from_lead_id) values(coalesce(nullif(split_part(btrim(v_lead.planner_name),' ',1),''),'Event'),coalesce(nullif(btrim(regexp_replace(v_lead.planner_name,'^\S+\s*','')),''),'Planner'),nullif(lower(btrim(v_lead.planner_email)),''),nullif(btrim(v_lead.planner_phone),''),'planner','Planner contact created from lead conversion.',v_lead.lead_id) returning * into v_planner;
  end if;
  insert into public.projects(project_name,service_type,event_type,event_date,ceremony_venue_name,ceremony_venue_city,ceremony_venue_state,ceremony_venue_address,ceremony_venue_zipcode,reception_venue_name,reception_venue_city,reception_venue_state,reception_venue_address,reception_venue_zipcode,budget_range,guest_count,style_notes,internal_notes,status,source_lead_id,primary_contact_id,assigned_user_id)
  values(coalesce(nullif(btrim(p_project_fields->>'project_name'),''),v_lead.first_name||' '||v_lead.last_name||' Event'),v_lead.service_type,v_lead.event_type,v_lead.event_date,v_lead.ceremony_venue_name,v_lead.ceremony_venue_city,v_lead.ceremony_venue_state,v_lead.ceremony_venue_address,v_lead.ceremony_venue_zipcode,v_lead.reception_venue_name,v_lead.reception_venue_city,v_lead.reception_venue_state,v_lead.reception_venue_address,v_lead.reception_venue_zipcode,v_lead.budget_range,v_lead.guest_count,v_lead.inquiry_message,nullif(btrim(p_project_fields->>'internal_notes'),''),'awaiting_deposit',v_lead.lead_id,v_primary.contact_id,v_lead.assigned_user_id) returning * into v_project;
  if p_test_fail_after_stage='project' and v_test then raise exception 'forced conversion failure after project'; end if;
  insert into public.project_contacts(project_id,contact_id,relationship_type,is_primary) values(v_project.project_id,v_primary.contact_id,'client',true);
  if v_partner.contact_id is not null then insert into public.project_contacts(project_id,contact_id,relationship_type) values(v_project.project_id,v_partner.contact_id,'partner'); end if;
  if v_planner.contact_id is not null then insert into public.project_contacts(project_id,contact_id,relationship_type) values(v_project.project_id,v_planner.contact_id,'planner'); end if;
  insert into public.project_proposal_invoice_snapshots(project_id,source_lead_id,source_floral_proposal_id,version,snapshot,subtotal,tax_rate,tax_amount,total_amount,retainer_amount,final_balance_amount,retainer_due_date,final_balance_due_date,created_by,is_active)
  values(v_project.project_id,v_lead.lead_id,v_proposal.floral_proposal_id,v_proposal.version,v_proposal.snapshot,v_proposal.subtotal,v_proposal.tax_rate,v_proposal.tax_amount,v_proposal.total_amount,round(v_proposal.total_amount*.30,2),v_proposal.total_amount-round(v_proposal.total_amount*.30,2),current_date,coalesce(v_proposal.final_balance_due_date,v_lead.event_date-30),auth.uid(),true) returning * into v_snapshot;
  update public.projects set active_proposal_invoice_snapshot_id=v_snapshot.project_proposal_invoice_snapshot_id where project_id=v_project.project_id returning * into v_project;
  if p_test_fail_after_stage='proposal_pointer' and v_test then raise exception 'forced conversion failure after proposal pointer'; end if;
  insert into public.project_payment_records(project_id,payment_kind,status,amount_due,amount_paid,due_date,payment_source,basis_snapshot_id,basis_version,basis_total,target_amount,credited_principal,outstanding_amount,fulfillment_state,migration_state)
  values(v_project.project_id,'deposit','due',v_snapshot.retainer_amount,0,current_date,'manual',v_snapshot.project_proposal_invoice_snapshot_id,v_snapshot.version,v_snapshot.total_amount,v_snapshot.retainer_amount,0,v_snapshot.retainer_amount,'due','native') returning * into v_deposit;
  insert into public.project_payment_records(project_id,payment_kind,status,amount_due,amount_paid,due_date,payment_source,basis_snapshot_id,basis_version,basis_total,target_amount,credited_principal,outstanding_amount,fulfillment_state,migration_state)
  values(v_project.project_id,'final_payment','not_due',v_snapshot.final_balance_amount,0,v_snapshot.final_balance_due_date,'manual',v_snapshot.project_proposal_invoice_snapshot_id,v_snapshot.version,v_snapshot.total_amount,v_snapshot.final_balance_amount,0,v_snapshot.final_balance_amount,'not_due','native') returning * into v_final;
  if p_test_fail_after_stage='obligation' and v_test then raise exception 'forced conversion failure after obligation'; end if;
  update public.leads set status='converted',converted_project_id=v_project.project_id,converted_primary_contact_id=v_primary.contact_id,converted_at=now(),payment_conversion_command_key=p_command_key,updated_at=now() where lead_id=v_lead.lead_id;
  if p_test_fail_after_stage='lead_state' and v_test then raise exception 'forced conversion failure after lead state'; end if;
  perform public.create_payment_activity(v_project.project_id,'Project awaiting deposit','A 30% deposit obligation was created during lead conversion.','florist',jsonb_build_object('deposit_amount',v_snapshot.retainer_amount,'proposal_version',v_snapshot.version),auth.uid());
  insert into public.lead_activity(lead_id,activity_type,activity_label,activity_description,performed_by,metadata) values(v_lead.lead_id,'converted','Lead converted to project',coalesce(nullif(btrim(p_project_fields->>'internal_notes'),''),'Lead converted into project "'||v_project.project_name||'".'),auth.uid(),jsonb_build_object('project_id',v_project.project_id,'primary_contact_id',v_primary.contact_id));
  if p_test_fail_after_stage='activity' and v_test then raise exception 'forced conversion failure after activity'; end if;
  return jsonb_build_object('project',to_jsonb(v_project),'primaryContactId',v_primary.contact_id,'partnerContactId',v_partner.contact_id,'plannerContactId',v_planner.contact_id,'depositObligationId',v_deposit.project_payment_record_id,'finalObligationId',v_final.project_payment_record_id,'replayed',false);
end; $$;
revoke all on function public.convert_lead_to_project_with_payments(uuid,jsonb,jsonb,uuid,text) from public,anon;
grant execute on function public.convert_lead_to_project_with_payments(uuid,jsonb,jsonb,uuid,text) to authenticated;
create or replace function public.issue_payment_request(
  p_obligation_ids uuid[], p_principal_cents bigint, p_kind text,
  p_token_digest text, p_token_ciphertext text, p_token_iv text,
  p_token_key_version text, p_command_key uuid
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_request public.payment_requests; v_existing public.payment_requests;
v_project_id uuid; v_outstanding numeric(12,2); v_principal numeric(12,2):=p_principal_cents/100.0;
v_deposit numeric(12,2); v_final numeric(12,2); v_recipient jsonb; v_settings public.payment_collection_settings;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  select * into v_existing from public.payment_requests where command_key=p_command_key;
  if found then return jsonb_build_object('paymentRequestId',v_existing.payment_request_id,'projectId',v_existing.project_id,'replayed',true); end if;
  if cardinality(p_obligation_ids) not between 1 and 2 or p_kind not in ('deposit','final_payment','consolidated') or p_principal_cents<=0 then raise exception 'Invalid request'; end if;
  perform 1 from public.project_payment_records where project_payment_record_id=any(p_obligation_ids) order by case payment_kind when 'deposit' then 1 else 2 end for update;
  select (array_agg(project_id))[1],sum(outstanding_amount),sum(case when payment_kind='deposit' then least(outstanding_amount,v_principal) else 0 end),sum(case when payment_kind='final_payment' then outstanding_amount else 0 end)
  into v_project_id,v_outstanding,v_deposit,v_final from public.project_payment_records where project_payment_record_id=any(p_obligation_ids) and status not in ('paid','waived','canceled');
  if v_project_id is null or exists(select 1 from public.project_payment_records where project_payment_record_id=any(p_obligation_ids) and project_id<>v_project_id) or v_principal>v_outstanding then raise exception 'Obligations or amount are unavailable'; end if;
  if p_kind='deposit' then v_deposit:=v_principal;v_final:=0; elsif p_kind='final_payment' then v_final:=v_principal;v_deposit:=0; else v_deposit:=least(coalesce(v_deposit,0),v_principal);v_final:=v_principal-v_deposit; end if;
  select * into v_settings from public.payment_collection_settings where settings_id;
  v_recipient:=public.resolve_project_billing_recipient(v_project_id);
  if nullif(v_recipient->>'email','') is null then raise exception 'No eligible payment recipient'; end if;
  update public.payment_requests set status='superseded',invalidated_at=now(),token_ciphertext=null,token_iv=null,token_key_version=null
  where project_id=v_project_id and status='active' and request_kind in (p_kind,'consolidated');
  insert into public.payment_requests(project_id,request_kind,status,token_digest,token_ciphertext,token_iv,token_key_version,principal_amount,deposit_amount,final_amount,proposal_snapshot_id,proposal_version,original_recipient_contact_id,original_recipient_email,recipient_fallback_used,cash_instructions,check_instructions,initial_delivery_state,command_key,activated_at,created_by)
  select v_project_id,p_kind,'active',p_token_digest,p_token_ciphertext,p_token_iv,p_token_key_version,v_principal,v_deposit,v_final,p.active_proposal_invoice_snapshot_id,s.version,(v_recipient->>'contact_id')::uuid,v_recipient->>'email',(v_recipient->>'fallback_used')::boolean,coalesce(v_settings.cash_instructions,''),coalesce(v_settings.check_instructions,''),'queued',p_command_key,now(),v_actor
  from public.projects p left join public.project_proposal_invoice_snapshots s on s.project_proposal_invoice_snapshot_id=p.active_proposal_invoice_snapshot_id where p.project_id=v_project_id returning * into v_request;
  insert into public.payment_request_obligations(payment_request_id,obligation_id,requested_amount,display_order)
  select v_request.payment_request_id,o.project_payment_record_id,case when o.payment_kind='deposit' then v_deposit else v_final end,case when o.payment_kind='deposit' then 1 else 2 end
  from public.project_payment_records o where o.project_payment_record_id=any(p_obligation_ids) and case when o.payment_kind='deposit' then v_deposit else v_final end>0;
  insert into public.payment_message_deliveries(project_id,obligation_id,payment_request_id,delivery_kind,occurrence_key,recipient_contact_id,recipient_email,recipient_fallback_used,principal_amount,status,scheduled_timezone)
  values(v_project_id,p_obligation_ids[1],v_request.payment_request_id,'initial_request','initial:'||v_request.payment_request_id,(v_recipient->>'contact_id')::uuid,v_recipient->>'email',(v_recipient->>'fallback_used')::boolean,v_principal,'queued',v_settings.business_timezone);
  perform public.create_payment_activity(v_project_id,'Payment request created',initcap(replace(p_kind,'_',' '))||' payment request was created.','florist',jsonb_build_object('payment_request_id',v_request.payment_request_id,'principal_amount',v_principal),v_actor);
  return jsonb_build_object('paymentRequestId',v_request.payment_request_id,'projectId',v_project_id,'replayed',false);
end; $$;
revoke all on function public.issue_payment_request(uuid[],bigint,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.issue_payment_request(uuid[],bigint,text,text,text,text,text,uuid) to service_role;

create or replace function public.retry_payment_delivery(p_delivery_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_source public.payment_message_deliveries; v_retry public.payment_message_deliveries; begin
 if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'Retry reason is required'; end if;
 select * into v_source from public.payment_message_deliveries where payment_message_delivery_id=p_delivery_id and status in ('temporary_failed','permanent_failed','delivery_unknown') for update;
 if not found then raise exception 'Delivery is not retryable'; end if;
 insert into public.payment_message_deliveries(project_id,obligation_id,payment_request_id,payment_transaction_id,delivery_kind,occurrence_key,scheduled_local_date,scheduled_timezone,recipient_contact_id,recipient_email,recipient_fallback_used,principal_amount,customer_fee,status,attempt_number,retry_of_delivery_id)
 values(v_source.project_id,v_source.obligation_id,v_source.payment_request_id,v_source.payment_transaction_id,v_source.delivery_kind,v_source.occurrence_key,v_source.scheduled_local_date,v_source.scheduled_timezone,v_source.recipient_contact_id,v_source.recipient_email,v_source.recipient_fallback_used,v_source.principal_amount,v_source.customer_fee,'queued',v_source.attempt_number+1,v_source.payment_message_delivery_id) returning * into v_retry;
 perform public.create_payment_activity(v_source.project_id,'Payment email retry queued','A florist queued an explicit retry after a failed or unknown delivery.','florist',jsonb_build_object('delivery_id',v_retry.payment_message_delivery_id,'reason',p_reason),auth.uid());
 return to_jsonb(v_retry);
end; $$;
revoke all on function public.retry_payment_delivery(uuid,text) from public,anon;
grant execute on function public.retry_payment_delivery(uuid,text) to authenticated;


create or replace function public.resolve_payment_request_projection(p_token_digest text,p_attempt_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare r public.payment_requests; a public.payment_checkout_attempts; p public.projects; s public.payment_collection_settings; i public.payment_intentions;
begin
 if auth.role()<>'service_role' then raise exception 'service role required'; end if;
 select * into r from public.payment_requests where token_digest=p_token_digest and status='active' and invalidated_at is null;
 if not found then return jsonb_build_object('state','unavailable'); end if;
 select * into p from public.projects where project_id=r.project_id and status not in ('completed','canceled');
 if not found then return jsonb_build_object('state','unavailable'); end if;
 select * into a from public.payment_checkout_attempts where payment_request_id=r.payment_request_id and (p_attempt_id is null or payment_checkout_attempt_id=p_attempt_id) order by created_at desc limit 1;
 select * into i from public.payment_intentions where payment_request_id=r.payment_request_id and state='active' order by created_at desc limit 1;
 select * into s from public.payment_collection_settings where settings_id;
 return jsonb_build_object('state',case when a.status='paid' then 'confirmed' when a.status in ('creating','active','processing') then 'processing' when r.principal_amount<=0 then 'confirmed' else 'active' end,
   'brand','Black Begonia Florals','purpose',r.request_kind,'projectLabel',p.project_name,'eventDate',p.event_date,'currency','USD','principalCents',round(r.principal_amount*100)::bigint,
   'depositCents',round(r.deposit_amount*100)::bigint,'finalCents',round(r.final_amount*100)::bigint,
   'methods',to_jsonb(array_remove(array[case when s.collection_enabled and s.stripe_enabled then 'stripe_card' end,case when s.collection_enabled then 'venmo' end,'cash','check'],null)),
   'activeAttempt',case when a.status in ('creating','active','processing') then a.payment_checkout_attempt_id end,
   'intention',case when i.payment_intention_id is not null then jsonb_build_object('method',i.method,'pauseEndsAt',i.pause_ends_at) end,
   'instructionSnapshots',jsonb_build_object('cash',r.cash_instructions,'check',r.check_instructions));
end; $$;
revoke all on function public.resolve_payment_request_projection(text,uuid) from public,anon,authenticated;
grant execute on function public.resolve_payment_request_projection(text,uuid) to service_role;

create or replace function public.revoke_payment_request(p_request_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare r public.payment_requests; begin
 if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'Reason is required'; end if;
 update public.payment_requests set status='revoked',revoked_at=now(),invalidated_at=now(),token_ciphertext=null,token_iv=null,token_key_version=null where payment_request_id=p_request_id and status='active' returning * into r;
 if not found then raise exception 'Request is not active'; end if;
 update public.payment_checkout_attempts set status='canceled',canceled_at=now(),canceled_by=auth.uid(),canceled_reason=p_reason where payment_request_id=p_request_id and status in ('creating','active','processing');
 update public.payment_message_deliveries set status='canceled',suppression_reason=p_reason where payment_request_id=p_request_id and status in ('queued','claimed');
 perform public.create_payment_activity(r.project_id,'Payment request revoked',p_reason,'florist',jsonb_build_object('payment_request_id',p_request_id),auth.uid()); return to_jsonb(r);
end; $$;
revoke all on function public.revoke_payment_request(uuid,text) from public,anon;
grant execute on function public.revoke_payment_request(uuid,text) to authenticated;

create or replace function public.reserve_payment_checkout(p_token_digest text,p_method text,p_command_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.payment_requests; a public.payment_checkout_attempts; s public.payment_collection_settings; begin
 if auth.role()<>'service_role' then raise exception 'service role required'; end if;
 if p_method not in ('stripe_card','paypal_venmo') then raise exception 'Unsupported checkout method'; end if;
 select * into r from public.payment_requests where token_digest=p_token_digest and status='active' and invalidated_at is null for update;
 if not found then raise exception 'Request unavailable'; end if;
 select * into s from public.payment_collection_settings where settings_id;
 if not s.collection_enabled or (p_method='stripe_card' and not s.stripe_enabled) or (p_method='paypal_venmo' and not s.venmo_enabled) then raise exception 'Provider unavailable'; end if;
 select * into a from public.payment_checkout_attempts where payment_request_id=r.payment_request_id and status in ('creating','active','processing') for update;
 if found then
   if a.method<>p_method then return jsonb_build_object('state','method_locked','attemptId',a.payment_checkout_attempt_id); end if;
   return jsonb_build_object('state','existing','attempt',to_jsonb(a));
 end if;
 insert into public.payment_checkout_attempts(payment_request_id,project_id,method,principal_amount,charge_amount,create_idempotency_key,expires_at)
 values(r.payment_request_id,r.project_id,p_method,r.principal_amount,r.principal_amount,p_command_key,now()+interval '30 minutes') returning * into a;
 return jsonb_build_object('state','reserved','attempt',to_jsonb(a));
end; $$;
revoke all on function public.reserve_payment_checkout(text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_payment_checkout(text,text,text) to service_role;

create or replace function public.finalize_payment_checkout(p_attempt_id uuid,p_state text,p_provider_id text default null,p_handoff_url text default null,p_client_token text default null,p_error text default null)
returns jsonb language plpgsql security definer set search_path='' as $$ declare a public.payment_checkout_attempts; begin
 if auth.role()<>'service_role' then raise exception 'service role required'; end if;
 if p_state not in ('active','failed','expired','canceled') then raise exception 'Invalid checkout state'; end if;
 update public.payment_checkout_attempts set status=p_state,provider_session_id=case when method='stripe_card' then p_provider_id else provider_session_id end,provider_order_id=case when method='paypal_venmo' then p_provider_id else provider_order_id end,provider_handoff_url=p_handoff_url,provider_client_token=p_client_token,last_verified_state=coalesce(p_error,p_state),resolved_at=case when p_state<>'active' then now() end where payment_checkout_attempt_id=p_attempt_id and status='creating' returning * into a;
 if not found then select * into a from public.payment_checkout_attempts where payment_checkout_attempt_id=p_attempt_id; end if; return to_jsonb(a);
end; $$;
revoke all on function public.finalize_payment_checkout(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.finalize_payment_checkout(uuid,text,text,text,text,text) to service_role;

create or replace function public.record_payment_intention(p_token_digest text,p_method text,p_command_key text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare r public.payment_requests;i public.payment_intentions;begin
 if auth.role()<>'service_role' then raise exception 'service role required'; end if;
 if p_method not in ('cash','check','venmo_business_profile') then raise exception 'Unsupported intention'; end if;
 select * into r from public.payment_requests where token_digest=p_token_digest and status='active' and invalidated_at is null for update;
 if not found then raise exception 'Request unavailable'; end if;
 if exists(select 1 from public.payment_checkout_attempts where payment_request_id=r.payment_request_id and status in ('creating','active','processing')) then raise exception 'PAYMENT_METHOD_LOCKED'; end if;
 select * into i from public.payment_intentions where payment_request_id=r.payment_request_id and state='active' and pause_ends_at>now();
 if found then return to_jsonb(i); end if;
 update public.payment_intentions set state='expired' where payment_request_id=r.payment_request_id and state='active';
 insert into public.payment_intentions(payment_request_id,project_id,method,instruction_snapshot,reference,pause_ends_at)
 values(r.payment_request_id,r.project_id,p_method,case p_method when 'cash' then r.cash_instructions when 'check' then r.check_instructions else null end,'BB-'||upper(substr(replace(r.payment_request_id::text,'-',''),1,10)),now()+interval '7 days') returning * into i;
 perform public.create_payment_activity(r.project_id,'Payment intention recorded','Customer plans to pay by '||replace(p_method,'_',' ')||'.','customer',jsonb_build_object('payment_intention_id',i.payment_intention_id,'method',p_method,'pause_ends_at',i.pause_ends_at),null); return to_jsonb(i);
end; $$;
revoke all on function public.record_payment_intention(text,text,text) from public,anon,authenticated;
grant execute on function public.record_payment_intention(text,text,text) to service_role;


-- Provider-event reconciliation and internal exception resolution.
create or replace function public.reconcile_payment_event(p_provider_event_id uuid,p_facts jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.payment_provider_events;a public.payment_checkout_attempts;r public.payment_requests;t public.payment_transactions;original public.payment_transactions;
v_kind text:=coalesce(p_facts->>'kind','receipt');v_status text:=coalesce(p_facts->>'status','confirmed');v_amount numeric(12,2):=coalesce((p_facts->>'principalCents')::bigint,0)/100.0;
v_remaining numeric(12,2);o public.project_payment_records;v_alloc numeric(12,2);v_seq int:=0;v_project_outstanding numeric(12,2);v_effect_key text;
begin
 if auth.role()<>'service_role' then raise exception 'service role required'; end if;
 select * into e from public.payment_provider_events where payment_provider_event_id=p_provider_event_id for update;
 if not found then raise exception 'Provider event is unavailable'; end if;
 if e.processing_state in ('processed','duplicate') then return jsonb_build_object('state','duplicate','transactionId',e.payment_transaction_id); end if;
 select * into a from public.payment_checkout_attempts where payment_checkout_attempt_id=coalesce((p_facts->>'attemptId')::uuid,e.payment_checkout_attempt_id) for update;
 if not found then update public.payment_provider_events set processing_state='unmatched',processed_at=now() where payment_provider_event_id=e.payment_provider_event_id; raise exception 'Payment attempt is unmatched'; end if;
 select * into r from public.payment_requests where payment_request_id=a.payment_request_id for update;
 if upper(coalesce(p_facts->>'currency',''))<>'USD' or v_amount<=0 or (v_kind='receipt' and v_amount<>a.principal_amount) or coalesce(p_facts->>'merchantId','')<>coalesce(p_facts->>'expectedMerchantId',p_facts->>'merchantId','') then raise exception 'Provider amount, currency, or merchant mismatch'; end if;
 v_effect_key:=e.provider||':'||coalesce(e.provider_object_id,e.provider_event_id)||':'||v_kind;
 if exists(select 1 from public.payment_transactions where provider_reference=v_effect_key) then update public.payment_provider_events set processing_state='duplicate',processed_at=now() where payment_provider_event_id=e.payment_provider_event_id; return jsonb_build_object('state','duplicate'); end if;
 insert into public.payment_transactions(payment_reference,project_id,payment_request_id,payment_checkout_attempt_id,kind,status,principal_amount,customer_fee,merchant_fee,method,source,occurred_at,actor_type,provider_reference,customer_notice_policy,customer_notice_state,payload_digest,normalized_facts)
 values(public.generate_payment_reference(),a.project_id,r.payment_request_id,a.payment_checkout_attempt_id,v_kind,v_status,case when v_kind in ('refund','reversal','void') then -v_amount else v_amount end,0,(p_facts->>'merchantFeeCents')::bigint/100.0,a.method,case when e.provider='stripe' then 'stripe' else 'paypal' end,e.event_occurred_at,'provider',v_effect_key,case when v_kind in ('receipt','refund','reversal') then 'required' when v_kind in ('dispute','correction') then 'optional' else 'none' end,'queued',e.payload_digest,p_facts) returning * into t;
 if v_kind='receipt' and v_status='confirmed' then
   perform 1
   from public.project_payment_records
   where project_id = a.project_id
     and status not in ('waived', 'canceled')
   order by case payment_kind when 'deposit' then 1 else 2 end,
            project_payment_record_id
   for update;
   select coalesce(sum(outstanding_amount), 0)
   into v_project_outstanding
   from public.project_payment_records
   where project_id = a.project_id
     and status not in ('waived', 'canceled');
   v_remaining:=least(v_amount,v_project_outstanding);
   for o in select * from public.project_payment_records where project_id=a.project_id and status not in ('waived','canceled') order by case payment_kind when 'deposit' then 1 else 2 end for update loop exit when v_remaining<=0;v_alloc:=least(v_remaining,o.outstanding_amount);if v_alloc>0 then v_seq:=v_seq+1;insert into public.payment_transaction_allocations(payment_transaction_id,obligation_id,allocated_principal,sequence) values(t.payment_transaction_id,o.project_payment_record_id,v_alloc,v_seq);v_remaining:=v_remaining-v_alloc;end if;end loop;
   if v_amount>v_project_outstanding then insert into public.payment_exceptions(project_id,payment_transaction_id,payment_provider_event_id,exception_type,urgency,amount,summary) values(a.project_id,t.payment_transaction_id,e.payment_provider_event_id,'overpayment','urgent',v_amount-v_project_outstanding,'Provider payment exceeds the complete project balance');end if;
   update public.payment_checkout_attempts set status='paid',resolved_at=now(),last_verified_state=e.event_type where payment_checkout_attempt_id=a.payment_checkout_attempt_id;
   update public.payment_requests set status='fulfilled',fulfilled_at=now(),invalidated_at=now(),token_ciphertext=null,token_iv=null,token_key_version=null where payment_request_id=r.payment_request_id;
   update public.payment_intentions set state='fulfilled',fulfilled_at=now() where payment_request_id=r.payment_request_id and state='active';
 else
   select * into original from public.payment_transactions where project_id=a.project_id and kind='receipt' and status='confirmed' order by occurred_at desc limit 1;
   if original.payment_transaction_id is not null then insert into public.payment_transaction_allocations(payment_transaction_id,obligation_id,allocated_principal,sequence) select t.payment_transaction_id,x.obligation_id,-least(abs(x.allocated_principal),v_amount),x.sequence from public.payment_transaction_allocations x where x.payment_transaction_id=original.payment_transaction_id order by x.sequence limit 1;end if;
   insert into public.payment_exceptions(project_id,payment_transaction_id,payment_provider_event_id,exception_type,urgency,amount,summary) values(a.project_id,t.payment_transaction_id,e.payment_provider_event_id,'adjustment_reopened_balance','urgent',v_amount,'Provider adjustment reopened a project balance');
 end if;
 perform public.recompute_project_payment_obligations(a.project_id);
 update public.projects p set status=case when p.status='awaiting_deposit' and not exists(select 1 from public.project_payment_records o2 where o2.project_id=p.project_id and o2.payment_kind='deposit' and o2.outstanding_amount>0 and o2.status not in ('waived','canceled')) then case when exists(select 1 from public.project_payment_records o2 where o2.project_id=p.project_id and o2.payment_kind='final_payment' and o2.outstanding_amount>0 and o2.status not in ('waived','canceled')) then 'booked'::public.project_status else 'final_prep'::public.project_status end when p.status='awaiting_final_payment' and not exists(select 1 from public.project_payment_records o2 where o2.project_id=p.project_id and o2.outstanding_amount>0 and o2.status not in ('waived','canceled')) then 'final_prep'::public.project_status else p.status end,booked_at=case when p.status='awaiting_deposit' then coalesce(p.booked_at,now()) else p.booked_at end,updated_at=now() where p.project_id=a.project_id and p.status not in ('completed','canceled');
 update public.payment_provider_events set processing_state='processed',payment_checkout_attempt_id=a.payment_checkout_attempt_id,payment_transaction_id=t.payment_transaction_id,processed_at=now() where payment_provider_event_id=e.payment_provider_event_id;
 perform public.create_payment_activity(a.project_id,case when v_kind='receipt' then 'Payment confirmed' else 'Payment adjusted' end,initcap(replace(v_kind,'_',' '))||' '||t.payment_reference||' was recorded.','provider',jsonb_build_object('payment_reference',t.payment_reference,'method',a.method,'principal_amount',t.principal_amount,'provider_event_id',e.payment_provider_event_id),null);
 if t.customer_notice_policy='required' then insert into public.payment_message_deliveries(project_id,payment_request_id,payment_transaction_id,delivery_kind,occurrence_key,principal_amount,status) values(a.project_id,r.payment_request_id,t.payment_transaction_id,case when v_kind='receipt' then 'receipt' else 'adjustment_notice' end,case when v_kind='receipt' then 'receipt:' else 'adjustment:' end||t.payment_transaction_id,abs(t.principal_amount),'queued');end if;
 return jsonb_build_object('state','processed','transactionId',t.payment_transaction_id,'paymentReference',t.payment_reference);
exception when others then update public.payment_provider_events set processing_state='failed',processing_error=left(sqlerrm,300),processed_at=now() where payment_provider_event_id=p_provider_event_id;raise;end; $$;
revoke all on function public.reconcile_payment_event(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.reconcile_payment_event(uuid,jsonb) to service_role;

create or replace function public.resolve_payment_exception(p_exception_id uuid,p_resolution text,p_reference_or_note text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare e public.payment_exceptions;t public.payment_transactions;begin
 if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
 if p_resolution not in ('external_refund','retained_credit','correction','matched','dismissed','status_reviewed') or nullif(btrim(p_reference_or_note),'') is null then raise exception 'Resolution and reference or note are required'; end if;
 select * into e from public.payment_exceptions where payment_exception_id=p_exception_id and state<>'resolved' for update;if not found then raise exception 'Exception is not open';end if;
 update public.payment_exceptions set state='resolved',resolution=p_resolution,resolution_reference=p_reference_or_note,retained_unapplied_credit=case when p_resolution='retained_credit' then coalesce(amount,0) else 0 end,resolved_by=auth.uid(),resolved_at=now() where payment_exception_id=p_exception_id returning * into e;
 if p_resolution in ('external_refund','correction') then insert into public.payment_transactions(payment_reference,project_id,kind,status,principal_amount,method,source,occurred_at,actor_type,actor_id,customer_notice_policy,customer_notice_state,note) values(public.generate_payment_reference(),e.project_id,case when p_resolution='external_refund' then 'external_refund' else 'correction' end,'resolved',-coalesce(e.amount,0),'other','manual',now(),'florist',auth.uid(),case when p_resolution='external_refund' then 'required' else 'optional' end,'queued',p_reference_or_note) returning * into t;end if;
 perform public.create_payment_activity(e.project_id,'Payment exception resolved','A florist resolved '||replace(e.exception_type,'_',' ')||'.','florist',jsonb_build_object('payment_exception_id',e.payment_exception_id,'resolution',p_resolution,'reference',p_reference_or_note),auth.uid());return to_jsonb(e);
end; $$;
revoke all on function public.resolve_payment_exception(uuid,text,text) from public,anon;
grant execute on function public.resolve_payment_exception(uuid,text,text) to authenticated;

-- Final-collection activation and payment message outbox processing.
create or replace function public.refresh_project_payment_statuses(target_project_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_project record;
begin
  if auth.role() not in ('service_role','authenticated') then raise exception 'not authorized'; end if;
  for v_project in
    select p.project_id, p.status
    from public.projects p
    where p.event_date is not null
      and p.event_date <= current_date + 60
      and (target_project_id is null or p.project_id=target_project_id)
      and p.status in ('awaiting_deposit','booked','awaiting_final_payment')
    order by p.project_id for update
  loop
    if not exists(select 1 from public.project_payment_records o where o.project_id=v_project.project_id and o.payment_kind='deposit' and o.outstanding_amount>0 and o.status not in ('waived','canceled'))
       and exists(select 1 from public.project_payment_records o where o.project_id=v_project.project_id and o.payment_kind='final_payment' and o.outstanding_amount>0 and o.status not in ('waived','canceled'))
       and v_project.status='booked' then
      update public.projects set status='awaiting_final_payment',updated_at=now() where project_id=v_project.project_id;
      perform public.create_payment_activity(v_project.project_id,'Final payment collection started','The event is within 60 days and its final balance is now due.','schedule',jsonb_build_object('window_days',60),null);
    end if;
  end loop;
end; $$;
revoke all on function public.refresh_project_payment_statuses(uuid) from public,anon;
grant execute on function public.refresh_project_payment_statuses(uuid) to authenticated,service_role;

create or replace function public.activate_project_final_collection(p_project_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_project public.projects; v_deposit uuid; v_final uuid; v_deposit_due numeric(12,2); v_final_due numeric(12,2);
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  perform public.refresh_project_payment_statuses(p_project_id);
  select * into v_project from public.projects where project_id=p_project_id for update;
  if not found or v_project.event_date is null or v_project.event_date>current_date+60 or v_project.status in ('completed','canceled') then return jsonb_build_object('eligible',false); end if;
  select (array_agg(project_payment_record_id order by created_at,project_payment_record_id) filter(where payment_kind='deposit' and outstanding_amount>0 and status not in ('waived','canceled')))[1],
         (array_agg(project_payment_record_id order by created_at,project_payment_record_id) filter(where payment_kind='final_payment' and outstanding_amount>0 and status not in ('waived','canceled')))[1],
         coalesce(sum(outstanding_amount) filter(where payment_kind='deposit' and status not in ('waived','canceled')),0),
         coalesce(sum(outstanding_amount) filter(where payment_kind='final_payment' and status not in ('waived','canceled')),0)
  into v_deposit,v_final,v_deposit_due,v_final_due from public.project_payment_records where project_id=p_project_id;
  if v_deposit_due+v_final_due<=0 then return jsonb_build_object('eligible',false); end if;
  return jsonb_build_object('eligible',true,'projectId',p_project_id,'kind',case when v_deposit_due>0 and v_final_due>0 then 'consolidated' when v_deposit_due>0 then 'deposit' else 'final_payment' end,
    'obligationIds',case when v_deposit_due>0 and v_final_due>0 then jsonb_build_array(v_deposit,v_final) when v_deposit_due>0 then jsonb_build_array(v_deposit) else jsonb_build_array(v_final) end,
    'principalCents',round((v_deposit_due+v_final_due)*100)::bigint);
end; $$;
revoke all on function public.activate_project_final_collection(uuid) from public,anon,authenticated;
grant execute on function public.activate_project_final_collection(uuid) to service_role;

create or replace function public.claim_payment_deliveries(p_limit integer default 25)
returns setof jsonb language plpgsql security definer set search_path='' as $$
declare v_settings public.payment_collection_settings; v_local_date date; v_local_time time; v_row record; v_recipient jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  select * into v_settings from public.payment_collection_settings where settings_id;
  v_local_date := (now() at time zone v_settings.business_timezone)::date;
  v_local_time := (now() at time zone v_settings.business_timezone)::time;

  if v_settings.reminders_enabled and v_settings.collection_enabled then
    insert into public.payment_message_deliveries(project_id,obligation_id,payment_request_id,delivery_kind,occurrence_key,scheduled_local_date,scheduled_timezone,principal_amount,status)
    select r.project_id,ro.obligation_id,r.payment_request_id,'final_reminder',
           'final:'||r.payment_request_id||':'||v_local_date,v_local_date,v_settings.business_timezone,r.principal_amount,'queued'
    from public.payment_requests r
    join public.payment_request_obligations ro on ro.payment_request_id=r.payment_request_id
    join public.project_payment_records o on o.project_payment_record_id=ro.obligation_id and o.payment_kind='final_payment'
    join public.projects p on p.project_id=r.project_id
    where r.status='active' and o.outstanding_amount>0 and o.status not in ('waived','canceled')
      and p.event_date-v_local_date in (60,45,38,31) or
          (r.status='active' and o.outstanding_amount>0 and o.status not in ('waived','canceled') and p.event_date-v_local_date between 0 and 30)
    on conflict(occurrence_key,attempt_number) do nothing;

    insert into public.payment_message_deliveries(project_id,obligation_id,payment_request_id,delivery_kind,occurrence_key,scheduled_local_date,scheduled_timezone,principal_amount,status)
    select r.project_id,ro.obligation_id,r.payment_request_id,'deposit_reminder',
           'deposit:'||r.payment_request_id||':'||v_local_date,v_local_date,v_settings.business_timezone,r.principal_amount,'queued'
    from public.payment_requests r
    join public.payment_request_obligations ro on ro.payment_request_id=r.payment_request_id
    join public.project_payment_records o on o.project_payment_record_id=ro.obligation_id and o.payment_kind='deposit'
    join lateral (select min(d.accepted_at at time zone v_settings.business_timezone)::date anchor from public.payment_message_deliveries d where d.payment_request_id=r.payment_request_id and d.delivery_kind='initial_request' and d.accepted_at is not null) a on a.anchor is not null
    where r.status='active' and o.outstanding_amount>0 and o.status not in ('waived','canceled') and o.reminder_enabled
      and (o.reminder_paused_until is null or o.reminder_paused_until<=now()) and v_local_date>=a.anchor+7 and mod(v_local_date-a.anchor,7)=0
      and not exists(select 1 from public.payment_intentions i where i.obligation_id=o.project_payment_record_id and i.state='active' and i.pause_ends_at>now())
    on conflict(occurrence_key,attempt_number) do nothing;
  end if;

  for v_row in
    select d.*,r.token_ciphertext,r.token_iv,r.token_key_version from public.payment_message_deliveries d
    left join public.payment_requests r on r.payment_request_id=d.payment_request_id
    left join public.project_payment_records o on o.project_payment_record_id=d.obligation_id
    where d.status='queued'
      and (d.scheduled_local_date is null or d.scheduled_local_date<=v_local_date)
      and (d.delivery_kind not in ('deposit_reminder','final_reminder') or (v_settings.reminders_enabled and v_settings.collection_enabled))
      and (d.delivery_kind not in ('initial_request','deposit_reminder','final_reminder') or r.status='active')
      and (d.obligation_id is null or o.status not in ('paid','waived','canceled') or d.delivery_kind in ('receipt','adjustment_notice'))
      and (d.delivery_kind in ('receipt','adjustment_notice') or v_local_time between v_settings.send_window_start and v_settings.send_window_end)
    order by d.created_at for update of d skip locked limit least(greatest(p_limit,1),100)
  loop
    v_recipient:=public.resolve_project_billing_recipient(v_row.project_id);
    if nullif(v_recipient->>'email','') is null then
      update public.payment_message_deliveries set status='suppressed',suppression_reason='no_current_billing_recipient' where payment_message_delivery_id=v_row.payment_message_delivery_id;
      perform public.create_payment_activity(v_row.project_id,'Payment email suppressed','No current billing recipient had a usable email address.','schedule',jsonb_build_object('delivery_id',v_row.payment_message_delivery_id),null);
    else
      update public.payment_message_deliveries set status='claimed',claimed_at=now(),recipient_contact_id=(v_recipient->>'contact_id')::uuid,recipient_email=v_recipient->>'email',recipient_fallback_used=(v_recipient->>'fallback_used')::boolean where payment_message_delivery_id=v_row.payment_message_delivery_id;
      return next jsonb_build_object('deliveryId',v_row.payment_message_delivery_id,'projectId',v_row.project_id,'obligationId',v_row.obligation_id,'requestId',v_row.payment_request_id,'transactionId',v_row.payment_transaction_id,'kind',v_row.delivery_kind,'recipientEmail',v_recipient->>'email','principalCents',round(v_row.principal_amount*100)::bigint,'customerFeeCents',round(v_row.customer_fee*100)::bigint,'tokenCiphertext',v_row.token_ciphertext,'tokenIv',v_row.token_iv,'tokenKeyVersion',v_row.token_key_version);
    end if;
  end loop;
  return;
end; $$;
revoke all on function public.claim_payment_deliveries(integer) from public,anon,authenticated;
grant execute on function public.claim_payment_deliveries(integer) to service_role;

create or replace function public.record_payment_delivery_outcome(p_delivery_id uuid,p_status text,p_mailgun_message_id text,p_failure_class text default null,p_redacted_error text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_delivery public.payment_message_deliveries;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  if p_status not in ('accepted','temporary_failed','permanent_failed','delivery_unknown') then raise exception 'Invalid delivery outcome'; end if;
  update public.payment_message_deliveries set status=p_status,mailgun_message_id=nullif(p_mailgun_message_id,''),sent_at=now(),accepted_at=case when p_status='accepted' then now() else accepted_at end,failed_at=case when p_status in ('temporary_failed','permanent_failed') then now() else failed_at end,failure_class=p_failure_class,redacted_error=left(p_redacted_error,200)
  where payment_message_delivery_id=p_delivery_id and status='claimed' returning * into v_delivery;
  if not found then return; end if;
  if v_delivery.payment_request_id is not null and v_delivery.delivery_kind='initial_request' then update public.payment_requests set initial_delivery_state=p_status where payment_request_id=v_delivery.payment_request_id; end if;
  perform public.create_payment_activity(v_delivery.project_id,case when p_status='accepted' then 'Payment email accepted' else 'Payment email needs attention' end,case when p_status='accepted' then 'The payment email provider accepted the message.' else 'A payment email was not confirmed as accepted.' end,'schedule',jsonb_strip_nulls(jsonb_build_object('delivery_id',v_delivery.payment_message_delivery_id,'delivery_kind',v_delivery.delivery_kind,'outcome',p_status,'failure_class',p_failure_class,'redacted_error',left(p_redacted_error,200))),null);
end; $$;
revoke all on function public.record_payment_delivery_outcome(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_payment_delivery_outcome(uuid,text,text,text,text) to service_role;

-- Proposal revisions preserve credited principal and freeze the deposit target after the first receipt.
create or replace function public.recalculate_project_obligations_for_snapshot(p_project_id uuid,p_snapshot_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_snapshot public.project_proposal_invoice_snapshots;v_deposit public.project_payment_records;v_final public.project_payment_records;v_has_receipt boolean;v_deposit_target numeric(12,2);v_final_target numeric(12,2);
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  select * into v_snapshot from public.project_proposal_invoice_snapshots where project_proposal_invoice_snapshot_id=p_snapshot_id and project_id=p_project_id and is_active for update;
  if not found then raise exception 'An active proposal snapshot is required'; end if;
  select * into v_deposit from public.project_payment_records where project_id=p_project_id and payment_kind='deposit' and status<>'canceled' for update;
  select * into v_final from public.project_payment_records where project_id=p_project_id and payment_kind='final_payment' and status<>'canceled' for update;
  if v_deposit.project_payment_record_id is null or v_final.project_payment_record_id is null then raise exception 'Both project payment obligations are required'; end if;
  select exists(select 1 from public.payment_transaction_allocations a join public.payment_transactions t using(payment_transaction_id) where a.obligation_id in (v_deposit.project_payment_record_id,v_final.project_payment_record_id) and t.kind='receipt' and t.status='confirmed') into v_has_receipt;
  v_deposit_target:=case when v_has_receipt then v_deposit.target_amount else round(v_snapshot.total_amount*.30,2) end;
  v_final_target:=greatest(v_snapshot.total_amount-v_deposit_target,0);
  update public.project_payment_records set basis_snapshot_id=p_snapshot_id,basis_version=v_snapshot.version,basis_total=v_snapshot.total_amount,target_amount=case when payment_kind='deposit' then v_deposit_target else v_final_target end,amount_due=case when payment_kind='deposit' then v_deposit_target else v_final_target end,deposit_target_frozen_at=case when payment_kind='deposit' and v_has_receipt then coalesce(deposit_target_frozen_at,now()) else deposit_target_frozen_at end,updated_at=now() where project_id=p_project_id and project_payment_record_id in (v_deposit.project_payment_record_id,v_final.project_payment_record_id);
  perform public.recompute_project_payment_obligations(p_project_id);
  update public.payment_requests set status='superseded',invalidated_at=now(),token_ciphertext=null,token_iv=null,token_key_version=null where project_id=p_project_id and status='active';
  update public.payment_checkout_attempts set status='canceled',canceled_at=now(),canceled_reason='proposal_revision' where project_id=p_project_id and status in ('creating','active','processing');
  perform public.create_payment_activity(p_project_id,'Payment obligations recalculated',case when v_has_receipt then 'The deposit target stayed frozen while the final balance was recalculated.' else 'Deposit and final targets were recalculated from the revised proposal.' end,'system',jsonb_build_object('snapshot_id',p_snapshot_id,'proposal_version',v_snapshot.version,'deposit_target',v_deposit_target,'final_target',v_final_target,'deposit_frozen',v_has_receipt),null);
  return jsonb_build_object('projectId',p_project_id,'snapshotId',p_snapshot_id,'depositTarget',v_deposit_target,'finalTarget',v_final_target,'depositFrozen',v_has_receipt);
end; $$;
revoke all on function public.recalculate_project_obligations_for_snapshot(uuid,uuid) from public,anon,authenticated;
grant execute on function public.recalculate_project_obligations_for_snapshot(uuid,uuid) to service_role;

create or replace function public.finalize_project_proposal_revision(
  p_project_id uuid,
  p_workspace_id uuid,
  p_baseline_snapshot_id uuid,
  p_idempotency_key uuid,
  p_pdf_bucket text,
  p_pdf_storage_path text,
  p_pdf_file_name text,
  p_pdf_content_type text,
  p_pdf_file_size_bytes bigint,
  p_submitted_by uuid,
  p_submitted_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_project public.projects%rowtype;
  v_workspace public.project_proposal_revision_workspaces%rowtype;
  v_baseline public.project_proposal_invoice_snapshots%rowtype;
  v_existing_snapshot public.project_proposal_invoice_snapshots%rowtype;
  v_existing_document public.project_proposal_document_versions%rowtype;
  v_new_snapshot_id uuid;
  v_new_document_id uuid;
  v_version integer;
  v_active_snapshot_count integer;
  v_line_count integer;
  v_total_line_count integer;
  v_json_subtotal numeric(12,2);
  v_json_tax_amount numeric(12,2);
  v_json_total numeric(12,2);
begin
  if p_idempotency_key is null then
    raise exception 'A submission idempotency key is required.' using errcode = '22023';
  end if;

  select * into v_project
  from public.projects
  where project_id = p_project_id
  for update;

  if not found then
    raise exception 'The selected project could not be found.' using errcode = 'P0002';
  end if;

  select * into v_existing_snapshot
  from public.project_proposal_invoice_snapshots
  where submission_idempotency_key = p_idempotency_key;

  if found then
    select * into v_existing_document
    from public.project_proposal_document_versions
    where submission_idempotency_key = p_idempotency_key;

    if not found or v_existing_snapshot.project_id <> p_project_id then
      raise exception 'The completed submission key does not match this project.' using errcode = '23505';
    end if;

    return jsonb_build_object(
      'success', true,
      'project_id', v_existing_snapshot.project_id,
      'revision_workspace_id', p_workspace_id,
      'proposal_document_version_id', v_existing_document.project_proposal_document_version_id,
      'active_invoice_snapshot_id', v_existing_snapshot.project_proposal_invoice_snapshot_id,
      'version', v_existing_snapshot.version,
      'signed_pdf_storage_path', v_existing_document.storage_path,
      'submitted_at', v_existing_document.submitted_at,
      'idempotent_replay', true
    );
  end if;

  if v_project.status in ('completed'::public.project_status, 'canceled'::public.project_status) then
    raise exception 'Completed or canceled projects cannot be revised.' using errcode = '55000';
  end if;

  if v_project.event_date is null then
    raise exception 'The project requires an event date before proposal finalization.' using errcode = '22023';
  end if;

  select * into v_workspace
  from public.project_proposal_revision_workspaces
  where project_proposal_revision_workspace_id = p_workspace_id
    and project_id = p_project_id
  for update;

  if not found then
    raise exception 'The proposal revision workspace could not be found.' using errcode = 'P0002';
  end if;

  if v_workspace.pending_submission_key is distinct from p_idempotency_key
     or v_workspace.pending_pdf_storage_path is distinct from p_pdf_storage_path
     or v_workspace.pending_pdf_file_name is distinct from p_pdf_file_name then
    raise exception 'The saved revision pending submission does not match the finalization request.' using errcode = '40001';
  end if;

  if v_workspace.baseline_invoice_snapshot_id <> p_baseline_snapshot_id
     or v_project.active_proposal_invoice_snapshot_id <> p_baseline_snapshot_id then
    raise exception 'The active proposal changed after this revision started.' using errcode = '40001';
  end if;

  select * into v_baseline
  from public.project_proposal_invoice_snapshots
  where project_proposal_invoice_snapshot_id = p_baseline_snapshot_id
    and project_id = p_project_id
    and is_active = true
  for update;

  if not found then
    raise exception 'The revision baseline is not the active project snapshot.' using errcode = '40001';
  end if;

  select count(*) into v_active_snapshot_count
  from public.project_proposal_invoice_snapshots
  where project_id = p_project_id and is_active = true;

  if v_active_snapshot_count <> 1 then
    raise exception 'The project must have exactly one active invoice snapshot.' using errcode = '55000';
  end if;

  if v_workspace.schema_version <> 2
     or coalesce((v_workspace.draft_snapshot->>'schema_version')::integer, 0) <> 2
     or jsonb_typeof(v_workspace.draft_snapshot->'line_items') <> 'array'
     or jsonb_typeof(v_workspace.draft_snapshot->'tax_region') <> 'object'
     or jsonb_typeof(v_workspace.draft_snapshot->'totals') <> 'object' then
    raise exception 'The saved revision uses an unsupported proposal schema.' using errcode = '22023';
  end if;

  select count(*) into v_line_count
  from jsonb_array_elements(v_workspace.draft_snapshot->'line_items') line
  where nullif(btrim(line->>'item_name'), '') is not null;

  select count(*) into v_total_line_count
  from jsonb_array_elements(v_workspace.draft_snapshot->'line_items');

  if v_line_count < 1 or v_line_count <> v_total_line_count then
    raise exception 'The saved revision requires at least one valid line item.' using errcode = '22023';
  end if;

  if nullif(v_workspace.draft_snapshot->'tax_region'->>'tax_rate', '') is null then
    raise exception 'The saved revision requires recorded tax context.' using errcode = '22023';
  end if;

  v_json_subtotal := round((v_workspace.draft_snapshot->'totals'->>'subtotal')::numeric, 2);
  v_json_tax_amount := round((v_workspace.draft_snapshot->'totals'->>'taxAmount')::numeric, 2);
  v_json_total := round((v_workspace.draft_snapshot->'totals'->>'totalAmount')::numeric, 2);

  if v_json_subtotal is distinct from round(v_workspace.subtotal, 2)
     or v_json_tax_amount is distinct from round(v_workspace.tax_amount, 2)
     or v_json_total is distinct from round(v_workspace.total_amount, 2)
     or round(v_workspace.subtotal + v_workspace.tax_amount, 2) is distinct from round(v_workspace.total_amount, 2)
     or round(v_workspace.subtotal * v_workspace.tax_rate, 2) is distinct from round(v_workspace.tax_amount, 2)
     or round((v_workspace.draft_snapshot->'tax_region'->>'tax_rate')::numeric, 6) is distinct from round(v_workspace.tax_rate, 6)
     or least(v_workspace.subtotal, v_workspace.tax_amount, v_workspace.total_amount, v_workspace.retainer_amount, v_workspace.final_balance_amount) < 0 then
    raise exception 'The saved revision totals are inconsistent.' using errcode = '22023';
  end if;

  select greatest(
    coalesce((select max(version) from public.project_proposal_invoice_snapshots where project_id = p_project_id), 0),
    coalesce((select max(version) from public.project_proposal_document_versions where project_id = p_project_id), 0)
  ) + 1 into v_version;

  perform set_config('app.proposal_revision_activation', 'on', true);

  update public.project_proposal_invoice_snapshots
  set is_active = false
  where project_proposal_invoice_snapshot_id = v_baseline.project_proposal_invoice_snapshot_id;

  update public.project_proposal_document_versions
  set is_active = false, status = 'superseded'
  where project_id = p_project_id and is_active = true;

  insert into public.project_proposal_invoice_snapshots (
    project_id, source_lead_id, source_floral_proposal_id, version, snapshot,
    subtotal, tax_rate, tax_amount, total_amount, retainer_amount,
    final_balance_amount, retainer_due_date, final_balance_due_date,
    created_by, is_active, submission_idempotency_key
  ) values (
    p_project_id, v_baseline.source_lead_id, v_baseline.source_floral_proposal_id,
    v_version, v_workspace.draft_snapshot || jsonb_build_object(
      'proposal_status', 'finalized',
      'submitted_at', p_submitted_at,
      'submitted_pdf_file_name', p_pdf_file_name,
      'submitted_pdf_storage_path', p_pdf_storage_path,
      'submission_mode', 'project_revision'
    ),
    v_workspace.subtotal, v_workspace.tax_rate, v_workspace.tax_amount,
    v_workspace.total_amount, v_workspace.retainer_amount,
    v_workspace.final_balance_amount, v_workspace.retainer_due_date,
    v_workspace.final_balance_due_date, p_submitted_by, true, p_idempotency_key
  ) returning project_proposal_invoice_snapshot_id into v_new_snapshot_id;

  insert into public.project_proposal_document_versions (
    project_id, source_lead_id, source_floral_proposal_id, invoice_snapshot_id,
    version, file_name, storage_bucket, storage_path, content_type,
    file_size_bytes, uploaded_by, submitted_at, is_active, status,
    submission_idempotency_key
  ) values (
    p_project_id, v_baseline.source_lead_id, v_baseline.source_floral_proposal_id,
    v_new_snapshot_id, v_version, p_pdf_file_name, p_pdf_bucket,
    p_pdf_storage_path, p_pdf_content_type, p_pdf_file_size_bytes,
    p_submitted_by, p_submitted_at, true, 'submitted', p_idempotency_key
  ) returning project_proposal_document_version_id into v_new_document_id;

  update public.projects
  set active_proposal_invoice_snapshot_id = v_new_snapshot_id,
      active_proposal_document_version_id = v_new_document_id,
      updated_at = p_submitted_at
  where project_id = p_project_id;

  perform public.recalculate_project_obligations_for_snapshot(p_project_id, v_new_snapshot_id);

  insert into public.activity_log (
    entity_type, entity_id, activity_type, activity_label, description,
    performed_by, metadata, created_at
  ) values (
    'project', p_project_id, 'proposal_revision_submitted',
    'Proposal revision v' || v_version || ' submitted',
    'A revised proposal and approved PDF became the active project version.',
    p_submitted_by,
    jsonb_build_object(
      'replaced_snapshot_id', v_baseline.project_proposal_invoice_snapshot_id,
      'replaced_version', v_baseline.version,
      'new_snapshot_id', v_new_snapshot_id,
      'new_document_id', v_new_document_id,
      'new_version', v_version,
      'prior_total', v_baseline.total_amount,
      'new_total', v_workspace.total_amount,
      'submission_idempotency_key', p_idempotency_key,
      'submission_mode', 'project_revision'
    ),
    p_submitted_at
  );

  delete from public.project_proposal_revision_workspaces
  where project_proposal_revision_workspace_id = p_workspace_id;

  return jsonb_build_object(
    'success', true,
    'project_id', p_project_id,
    'revision_workspace_id', p_workspace_id,
    'proposal_document_version_id', v_new_document_id,
    'active_invoice_snapshot_id', v_new_snapshot_id,
    'version', v_version,
    'signed_pdf_storage_path', p_pdf_storage_path,
    'submitted_at', p_submitted_at,
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.finalize_project_proposal_revision(uuid, uuid, uuid, uuid, text, text, text, text, bigint, uuid, timestamptz) from public;
revoke all on function public.finalize_project_proposal_revision(uuid, uuid, uuid, uuid, text, text, text, text, bigint, uuid, timestamptz) from authenticated;
grant execute on function public.finalize_project_proposal_revision(uuid, uuid, uuid, uuid, text, text, text, text, bigint, uuid, timestamptz) to service_role;

-- Audited reminder, collection-settings, and legal-hold commands.
create or replace function public.set_payment_reminder_control(p_project_id uuid,p_obligation_id uuid,p_enabled boolean,p_paused_until timestamptz,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'A reason is required'; end if;
  update public.project_payment_records set reminder_enabled=p_enabled,reminder_paused_until=case when p_enabled then p_paused_until else null end,reminder_pause_reason=p_reason,reminder_pause_actor=auth.uid(),updated_at=now()
  where project_id=p_project_id and (p_obligation_id is null or project_payment_record_id=p_obligation_id) and status not in ('paid','waived','canceled');
  get diagnostics v_count=row_count;
  if v_count=0 then raise exception 'No eligible obligation was found'; end if;
  perform public.create_payment_activity(p_project_id,'Payment reminders updated',case when p_enabled then 'A florist resumed or scheduled payment reminders.' else 'A florist paused payment reminders.' end,'florist',jsonb_build_object('obligation_id',p_obligation_id,'enabled',p_enabled,'paused_until',p_paused_until,'reason',p_reason),auth.uid());
  return jsonb_build_object('updated',v_count);
end; $$;
revoke all on function public.set_payment_reminder_control(uuid,uuid,boolean,timestamptz,text) from public,anon;
grant execute on function public.set_payment_reminder_control(uuid,uuid,boolean,timestamptz,text) to authenticated;

create or replace function public.update_payment_collection_settings(p_business_timezone text,p_send_window_start time,p_send_window_end time,p_cash_instructions text,p_check_instructions text,p_venmo_business_target text,p_stripe_enabled boolean,p_venmo_enabled boolean,p_reminders_enabled boolean,p_collection_enabled boolean,p_provider_environment text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_settings public.payment_collection_settings;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_business_timezone) then raise exception 'Invalid IANA timezone'; end if;
  if p_send_window_start>=p_send_window_end then raise exception 'Send window end must follow its start'; end if;
  if p_provider_environment not in ('sandbox','production') then raise exception 'Invalid provider environment'; end if;
  if p_venmo_enabled and nullif(btrim(p_venmo_business_target),'') is null then raise exception 'Venmo target is required when Venmo is enabled'; end if;
  insert into public.payment_collection_settings(settings_id,business_timezone,send_window_start,send_window_end,cash_instructions,check_instructions,venmo_business_target,stripe_enabled,venmo_enabled,reminders_enabled,collection_enabled,provider_environment,updated_by,updated_at)
  values(true,p_business_timezone,p_send_window_start,p_send_window_end,coalesce(p_cash_instructions,''),coalesce(p_check_instructions,''),nullif(btrim(p_venmo_business_target),''),p_stripe_enabled,p_venmo_enabled,p_reminders_enabled,p_collection_enabled,p_provider_environment,auth.uid(),now())
  on conflict(settings_id) do update set business_timezone=excluded.business_timezone,send_window_start=excluded.send_window_start,send_window_end=excluded.send_window_end,cash_instructions=excluded.cash_instructions,check_instructions=excluded.check_instructions,venmo_business_target=excluded.venmo_business_target,stripe_enabled=excluded.stripe_enabled,venmo_enabled=excluded.venmo_enabled,reminders_enabled=excluded.reminders_enabled,collection_enabled=excluded.collection_enabled,provider_environment=excluded.provider_environment,updated_by=excluded.updated_by,updated_at=excluded.updated_at returning * into v_settings;
  return to_jsonb(v_settings)||jsonb_build_object('customer_card_fee_policy','fixed_off','customer_card_fee_percent',0);
end; $$;
revoke all on function public.update_payment_collection_settings(text,time,time,text,text,text,boolean,boolean,boolean,boolean,text) from public,anon;
grant execute on function public.update_payment_collection_settings(text,time,time,text,text,text,boolean,boolean,boolean,boolean,text) to authenticated;

create or replace function public.set_payment_legal_hold(p_project_id uuid,p_hold_type text,p_action text,p_reason text,p_command_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hold public.payment_legal_holds;v_current text;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
  if p_hold_type not in ('legal','dispute') or p_action not in ('placed','released') or nullif(btrim(p_reason),'') is null then raise exception 'Valid hold type, action, and reason are required'; end if;
  select * into v_hold from public.payment_legal_holds where command_key=p_command_key;if found then return to_jsonb(v_hold)||jsonb_build_object('replayed',true);end if;
  perform 1 from public.projects where project_id=p_project_id for update;if not found then raise exception 'Project not found';end if;
  select action into v_current from public.payment_legal_holds where project_id=p_project_id and hold_type=p_hold_type order by created_at desc limit 1;
  if coalesce(v_current,'released')=p_action then raise exception 'Hold is already in the requested state'; end if;
  insert into public.payment_legal_holds(project_id,action,hold_type,reason,command_key,actor_id) values(p_project_id,p_action,p_hold_type,p_reason,p_command_key,auth.uid()) returning * into v_hold;
  perform public.create_payment_activity(p_project_id,'Payment hold '||p_action,initcap(p_hold_type)||' hold was '||p_action||'.','florist',jsonb_build_object('hold_type',p_hold_type,'action',p_action,'reason',p_reason,'hold_id',v_hold.payment_legal_hold_id),auth.uid());
  return to_jsonb(v_hold)||jsonb_build_object('replayed',false);
end; $$;
revoke all on function public.set_payment_legal_hold(uuid,text,text,text,uuid) from public,anon;
grant execute on function public.set_payment_legal_hold(uuid,text,text,text,uuid) to authenticated;

-- Final reminder occurrence and consolidated-suppression definition.
create or replace function public.claim_payment_deliveries(p_limit integer default 25)
returns setof jsonb language plpgsql security definer set search_path='' as $$
declare v_settings public.payment_collection_settings; v_local_date date; v_local_time time; v_row record; v_recipient jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  select * into v_settings from public.payment_collection_settings where settings_id;
  v_local_date := (now() at time zone v_settings.business_timezone)::date;
  v_local_time := (now() at time zone v_settings.business_timezone)::time;

  if v_settings.reminders_enabled and v_settings.collection_enabled then
    insert into public.payment_message_deliveries(project_id,obligation_id,payment_request_id,delivery_kind,occurrence_key,scheduled_local_date,scheduled_timezone,principal_amount,status)
    select r.project_id,ro.obligation_id,r.payment_request_id,'final_reminder',
           'final:'||r.payment_request_id||':'||v_local_date,v_local_date,v_settings.business_timezone,r.principal_amount,'queued'
    from public.payment_requests r
    join public.payment_request_obligations ro on ro.payment_request_id=r.payment_request_id
    join public.project_payment_records o on o.project_payment_record_id=ro.obligation_id and o.payment_kind='final_payment'
    join public.projects p on p.project_id=r.project_id
    where r.status='active' and o.outstanding_amount>0 and o.status not in ('waived','canceled')
      and (p.event_date-v_local_date in (60,45,38,31) or p.event_date-v_local_date between 0 and 30)
      and not exists(select 1 from public.payment_message_deliveries initial where initial.payment_request_id=r.payment_request_id and initial.delivery_kind='initial_request' and (initial.created_at at time zone v_settings.business_timezone)::date=v_local_date)
    on conflict(occurrence_key,attempt_number) do nothing;

    insert into public.payment_message_deliveries(project_id,obligation_id,payment_request_id,delivery_kind,occurrence_key,scheduled_local_date,scheduled_timezone,principal_amount,status)
    select r.project_id,ro.obligation_id,r.payment_request_id,'deposit_reminder',
           'deposit:'||r.payment_request_id||':'||v_local_date,v_local_date,v_settings.business_timezone,r.principal_amount,'queued'
    from public.payment_requests r
    join public.payment_request_obligations ro on ro.payment_request_id=r.payment_request_id
    join public.project_payment_records o on o.project_payment_record_id=ro.obligation_id and o.payment_kind='deposit'
    join lateral (select min(d.accepted_at at time zone v_settings.business_timezone)::date anchor from public.payment_message_deliveries d where d.payment_request_id=r.payment_request_id and d.delivery_kind='initial_request' and d.accepted_at is not null) a on a.anchor is not null
    where r.status='active' and r.request_kind='deposit' and o.outstanding_amount>0 and o.status not in ('waived','canceled') and o.reminder_enabled
      and (o.reminder_paused_until is null or o.reminder_paused_until<=now()) and v_local_date>=a.anchor+7 and mod(v_local_date-a.anchor,7)=0
      and not exists(select 1 from public.payment_intentions i where i.obligation_id=o.project_payment_record_id and i.state='active' and i.pause_ends_at>now())
    on conflict(occurrence_key,attempt_number) do nothing;
  end if;

  for v_row in
    select d.*,r.token_ciphertext,r.token_iv,r.token_key_version from public.payment_message_deliveries d
    left join public.payment_requests r on r.payment_request_id=d.payment_request_id
    left join public.project_payment_records o on o.project_payment_record_id=d.obligation_id
    where d.status='queued'
      and (d.scheduled_local_date is null or d.scheduled_local_date<=v_local_date)
      and (d.delivery_kind not in ('deposit_reminder','final_reminder') or (v_settings.reminders_enabled and v_settings.collection_enabled))
      and (d.delivery_kind not in ('initial_request','deposit_reminder','final_reminder') or r.status='active')
      and (d.obligation_id is null or o.status not in ('paid','waived','canceled') or d.delivery_kind in ('receipt','adjustment_notice'))
      and (d.delivery_kind in ('receipt','adjustment_notice') or v_local_time between v_settings.send_window_start and v_settings.send_window_end)
    order by d.created_at for update of d skip locked limit least(greatest(p_limit,1),100)
  loop
    v_recipient:=public.resolve_project_billing_recipient(v_row.project_id);
    if nullif(v_recipient->>'email','') is null then
      update public.payment_message_deliveries set status='suppressed',suppression_reason='no_current_billing_recipient' where payment_message_delivery_id=v_row.payment_message_delivery_id;
      perform public.create_payment_activity(v_row.project_id,'Payment email suppressed','No current billing recipient had a usable email address.','schedule',jsonb_build_object('delivery_id',v_row.payment_message_delivery_id),null);
    else
      update public.payment_message_deliveries set status='claimed',claimed_at=now(),recipient_contact_id=(v_recipient->>'contact_id')::uuid,recipient_email=v_recipient->>'email',recipient_fallback_used=(v_recipient->>'fallback_used')::boolean where payment_message_delivery_id=v_row.payment_message_delivery_id;
      return next jsonb_build_object('deliveryId',v_row.payment_message_delivery_id,'projectId',v_row.project_id,'obligationId',v_row.obligation_id,'requestId',v_row.payment_request_id,'transactionId',v_row.payment_transaction_id,'kind',v_row.delivery_kind,'recipientEmail',v_recipient->>'email','principalCents',round(v_row.principal_amount*100)::bigint,'customerFeeCents',round(v_row.customer_fee*100)::bigint,'tokenCiphertext',v_row.token_ciphertext,'tokenIv',v_row.token_iv,'tokenKeyVersion',v_row.token_key_version);
    end if;
  end loop;
  return;
end; $$;
revoke all on function public.claim_payment_deliveries(integer) from public,anon,authenticated;
grant execute on function public.claim_payment_deliveries(integer) to service_role;

-- Final delivery claim rechecks project lifecycle and event date.
create or replace function public.claim_payment_deliveries(p_limit integer default 25)
returns setof jsonb language plpgsql security definer set search_path='' as $$
declare v_settings public.payment_collection_settings; v_local_date date; v_local_time time; v_row record; v_recipient jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  select * into v_settings from public.payment_collection_settings where settings_id;
  v_local_date := (now() at time zone v_settings.business_timezone)::date;
  v_local_time := (now() at time zone v_settings.business_timezone)::time;

  if v_settings.reminders_enabled and v_settings.collection_enabled then
    insert into public.payment_message_deliveries(project_id,obligation_id,payment_request_id,delivery_kind,occurrence_key,scheduled_local_date,scheduled_timezone,principal_amount,status)
    select r.project_id,ro.obligation_id,r.payment_request_id,'final_reminder',
           'final:'||r.payment_request_id||':'||v_local_date,v_local_date,v_settings.business_timezone,r.principal_amount,'queued'
    from public.payment_requests r
    join public.payment_request_obligations ro on ro.payment_request_id=r.payment_request_id
    join public.project_payment_records o on o.project_payment_record_id=ro.obligation_id and o.payment_kind='final_payment'
    join public.projects p on p.project_id=r.project_id
    where r.status='active' and o.outstanding_amount>0 and o.status not in ('waived','canceled')
      and (p.event_date-v_local_date in (60,45,38,31) or p.event_date-v_local_date between 0 and 30)
      and not exists(select 1 from public.payment_message_deliveries initial where initial.payment_request_id=r.payment_request_id and initial.delivery_kind='initial_request' and (initial.created_at at time zone v_settings.business_timezone)::date=v_local_date)
    on conflict(occurrence_key,attempt_number) do nothing;

    insert into public.payment_message_deliveries(project_id,obligation_id,payment_request_id,delivery_kind,occurrence_key,scheduled_local_date,scheduled_timezone,principal_amount,status)
    select r.project_id,ro.obligation_id,r.payment_request_id,'deposit_reminder',
           'deposit:'||r.payment_request_id||':'||v_local_date,v_local_date,v_settings.business_timezone,r.principal_amount,'queued'
    from public.payment_requests r
    join public.payment_request_obligations ro on ro.payment_request_id=r.payment_request_id
    join public.project_payment_records o on o.project_payment_record_id=ro.obligation_id and o.payment_kind='deposit'
    join lateral (select min(d.accepted_at at time zone v_settings.business_timezone)::date anchor from public.payment_message_deliveries d where d.payment_request_id=r.payment_request_id and d.delivery_kind='initial_request' and d.accepted_at is not null) a on a.anchor is not null
    where r.status='active' and r.request_kind='deposit' and o.outstanding_amount>0 and o.status not in ('waived','canceled') and o.reminder_enabled
      and (o.reminder_paused_until is null or o.reminder_paused_until<=now()) and v_local_date>=a.anchor+7 and mod(v_local_date-a.anchor,7)=0
      and not exists(select 1 from public.payment_intentions i where i.obligation_id=o.project_payment_record_id and i.state='active' and i.pause_ends_at>now())
    on conflict(occurrence_key,attempt_number) do nothing;
  end if;

  for v_row in
    select d.*,r.token_ciphertext,r.token_iv,r.token_key_version from public.payment_message_deliveries d
    left join public.payment_requests r on r.payment_request_id=d.payment_request_id
    left join public.project_payment_records o on o.project_payment_record_id=d.obligation_id
    left join public.projects p on p.project_id=d.project_id
    where d.status='queued'
      and (d.scheduled_local_date is null or d.scheduled_local_date<=v_local_date)
      and (d.delivery_kind not in ('deposit_reminder','final_reminder') or (v_settings.reminders_enabled and v_settings.collection_enabled))
      and (d.delivery_kind not in ('initial_request','deposit_reminder','final_reminder') or r.status='active')
      and (d.delivery_kind not in ('deposit_reminder','final_reminder') or (p.event_date>=v_local_date and p.status not in ('completed','canceled')))
      and (d.obligation_id is null or o.status not in ('paid','waived','canceled') or d.delivery_kind in ('receipt','adjustment_notice'))
      and (d.delivery_kind in ('receipt','adjustment_notice') or v_local_time between v_settings.send_window_start and v_settings.send_window_end)
    order by d.created_at for update of d skip locked limit least(greatest(p_limit,1),100)
  loop
    v_recipient:=public.resolve_project_billing_recipient(v_row.project_id);
    if nullif(v_recipient->>'email','') is null then
      update public.payment_message_deliveries set status='suppressed',suppression_reason='no_current_billing_recipient' where payment_message_delivery_id=v_row.payment_message_delivery_id;
      perform public.create_payment_activity(v_row.project_id,'Payment email suppressed','No current billing recipient had a usable email address.','schedule',jsonb_build_object('delivery_id',v_row.payment_message_delivery_id),null);
    else
      update public.payment_message_deliveries set status='claimed',claimed_at=now(),recipient_contact_id=(v_recipient->>'contact_id')::uuid,recipient_email=v_recipient->>'email',recipient_fallback_used=(v_recipient->>'fallback_used')::boolean where payment_message_delivery_id=v_row.payment_message_delivery_id;
      return next jsonb_build_object('deliveryId',v_row.payment_message_delivery_id,'projectId',v_row.project_id,'obligationId',v_row.obligation_id,'requestId',v_row.payment_request_id,'transactionId',v_row.payment_transaction_id,'kind',v_row.delivery_kind,'recipientEmail',v_recipient->>'email','principalCents',round(v_row.principal_amount*100)::bigint,'customerFeeCents',round(v_row.customer_fee*100)::bigint,'tokenCiphertext',v_row.token_ciphertext,'tokenIv',v_row.token_iv,'tokenKeyVersion',v_row.token_key_version);
    end if;
  end loop;
  return;
end; $$;
revoke all on function public.claim_payment_deliveries(integer) from public,anon,authenticated;
grant execute on function public.claim_payment_deliveries(integer) to service_role;

-- Final request replacement lineage definition.
create or replace function public.issue_payment_request(
  p_obligation_ids uuid[], p_principal_cents bigint, p_kind text,
  p_token_digest text, p_token_ciphertext text, p_token_iv text,
  p_token_key_version text, p_command_key uuid
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_request public.payment_requests; v_existing public.payment_requests;
v_project_id uuid; v_outstanding numeric(12,2); v_principal numeric(12,2):=p_principal_cents/100.0;
v_deposit numeric(12,2); v_final numeric(12,2); v_recipient jsonb; v_settings public.payment_collection_settings;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  select * into v_existing from public.payment_requests where command_key=p_command_key;
  if found then return jsonb_build_object('paymentRequestId',v_existing.payment_request_id,'projectId',v_existing.project_id,'replayed',true); end if;
  if cardinality(p_obligation_ids) not between 1 and 2 or p_kind not in ('deposit','final_payment','consolidated') or p_principal_cents<=0 then raise exception 'Invalid request'; end if;
  perform 1 from public.project_payment_records where project_payment_record_id=any(p_obligation_ids) order by case payment_kind when 'deposit' then 1 else 2 end for update;
  select (array_agg(project_id))[1],sum(outstanding_amount),sum(case when payment_kind='deposit' then least(outstanding_amount,v_principal) else 0 end),sum(case when payment_kind='final_payment' then outstanding_amount else 0 end)
  into v_project_id,v_outstanding,v_deposit,v_final from public.project_payment_records where project_payment_record_id=any(p_obligation_ids) and status not in ('paid','waived','canceled');
  if v_project_id is null or exists(select 1 from public.project_payment_records where project_payment_record_id=any(p_obligation_ids) and project_id<>v_project_id) or v_principal>v_outstanding then raise exception 'Obligations or amount are unavailable'; end if;
  if p_kind='deposit' then v_deposit:=v_principal;v_final:=0; elsif p_kind='final_payment' then v_final:=v_principal;v_deposit:=0; else v_deposit:=least(coalesce(v_deposit,0),v_principal);v_final:=v_principal-v_deposit; end if;
  select * into v_settings from public.payment_collection_settings where settings_id;
  v_recipient:=public.resolve_project_billing_recipient(v_project_id);
  if nullif(v_recipient->>'email','') is null then raise exception 'No eligible payment recipient'; end if;
  select * into v_existing from public.payment_requests where project_id=v_project_id and status='active' and (p_kind='consolidated' or request_kind in (p_kind,'consolidated')) order by created_at desc limit 1 for update;
  update public.payment_requests set status='superseded',invalidated_at=now(),token_ciphertext=null,token_iv=null,token_key_version=null
  where project_id=v_project_id and status='active' and (p_kind='consolidated' or request_kind in (p_kind,'consolidated'));
  insert into public.payment_requests(project_id,request_kind,status,token_digest,token_ciphertext,token_iv,token_key_version,principal_amount,deposit_amount,final_amount,proposal_snapshot_id,proposal_version,original_recipient_contact_id,original_recipient_email,recipient_fallback_used,cash_instructions,check_instructions,supersedes_request_id,initial_delivery_state,command_key,activated_at,created_by)
  select v_project_id,p_kind,'active',p_token_digest,p_token_ciphertext,p_token_iv,p_token_key_version,v_principal,v_deposit,v_final,p.active_proposal_invoice_snapshot_id,s.version,(v_recipient->>'contact_id')::uuid,v_recipient->>'email',(v_recipient->>'fallback_used')::boolean,coalesce(v_settings.cash_instructions,''),coalesce(v_settings.check_instructions,''),v_existing.payment_request_id,'queued',p_command_key,now(),v_actor
  from public.projects p left join public.project_proposal_invoice_snapshots s on s.project_proposal_invoice_snapshot_id=p.active_proposal_invoice_snapshot_id where p.project_id=v_project_id returning * into v_request;
  if v_existing.payment_request_id is not null then update public.payment_requests set superseded_by_request_id=v_request.payment_request_id where payment_request_id=v_existing.payment_request_id; end if;
  insert into public.payment_request_obligations(payment_request_id,obligation_id,requested_amount,display_order)
  select v_request.payment_request_id,o.project_payment_record_id,case when o.payment_kind='deposit' then v_deposit else v_final end,case when o.payment_kind='deposit' then 1 else 2 end
  from public.project_payment_records o where o.project_payment_record_id=any(p_obligation_ids) and case when o.payment_kind='deposit' then v_deposit else v_final end>0;
  insert into public.payment_message_deliveries(project_id,obligation_id,payment_request_id,delivery_kind,occurrence_key,recipient_contact_id,recipient_email,recipient_fallback_used,principal_amount,status,scheduled_timezone)
  values(v_project_id,p_obligation_ids[1],v_request.payment_request_id,'initial_request','initial:'||v_request.payment_request_id,(v_recipient->>'contact_id')::uuid,v_recipient->>'email',(v_recipient->>'fallback_used')::boolean,v_principal,'queued',v_settings.business_timezone);
  perform public.create_payment_activity(v_project_id,'Payment request created',initcap(replace(p_kind,'_',' '))||' payment request was created.','florist',jsonb_build_object('payment_request_id',v_request.payment_request_id,'principal_amount',v_principal),v_actor);
  return jsonb_build_object('paymentRequestId',v_request.payment_request_id,'projectId',v_project_id,'replayed',false);
end; $$;
revoke all on function public.issue_payment_request(uuid[],bigint,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.issue_payment_request(uuid[],bigint,text,text,text,text,text,uuid) to service_role;

-- Final customer projection and checkout expiry definitions.
create or replace function public.resolve_payment_request_projection(p_token_digest text,p_attempt_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare r public.payment_requests; a public.payment_checkout_attempts; p public.projects; s public.payment_collection_settings; i public.payment_intentions;
begin
 if auth.role()<>'service_role' then raise exception 'service role required'; end if;
 select * into r from public.payment_requests where token_digest=p_token_digest;
 if not found then return jsonb_build_object('state','unavailable'); end if;
 if r.status='fulfilled' then
   select * into p from public.projects where project_id=r.project_id;
   return jsonb_build_object('state','confirmed','brand','Black Begonia Florals','purpose',r.request_kind,'projectLabel',p.project_name,'eventDate',p.event_date,'currency','USD','principalCents',round(r.principal_amount*100)::bigint);
 end if;
 if r.status<>'active' or r.invalidated_at is not null then return jsonb_build_object('state','unavailable'); end if;
 select * into p from public.projects where project_id=r.project_id and status not in ('completed','canceled');
 if not found then return jsonb_build_object('state','unavailable'); end if;
 select * into a from public.payment_checkout_attempts where payment_request_id=r.payment_request_id and (p_attempt_id is null or payment_checkout_attempt_id=p_attempt_id) order by created_at desc limit 1;
 select * into i from public.payment_intentions where payment_request_id=r.payment_request_id and state='active' order by created_at desc limit 1;
 select * into s from public.payment_collection_settings where settings_id;
 return jsonb_build_object('state',case when a.status='paid' then 'confirmed' when a.status in ('creating','active','processing') then 'processing' else 'active' end,
   'brand','Black Begonia Florals','purpose',r.request_kind,'projectLabel',p.project_name,'eventDate',p.event_date,'currency','USD','principalCents',round(r.principal_amount*100)::bigint,
   'depositCents',round(r.deposit_amount*100)::bigint,'finalCents',round(r.final_amount*100)::bigint,
   'methods',to_jsonb(array_remove(array[case when s.collection_enabled and s.stripe_enabled then 'stripe_card' end,case when s.collection_enabled then 'venmo' end,'cash','check'],null)),
   'activeAttempt',case when a.status in ('creating','active','processing') then a.payment_checkout_attempt_id end,
   'intention',case when i.payment_intention_id is not null then jsonb_build_object('method',i.method,'pauseEndsAt',i.pause_ends_at) end,
   'instructionSnapshots',jsonb_build_object('cash',r.cash_instructions,'check',r.check_instructions));
end; $$;
revoke all on function public.resolve_payment_request_projection(text,uuid) from public,anon,authenticated;
grant execute on function public.resolve_payment_request_projection(text,uuid) to service_role;

create or replace function public.reserve_payment_checkout(p_token_digest text,p_method text,p_command_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.payment_requests; a public.payment_checkout_attempts; s public.payment_collection_settings; begin
 if auth.role()<>'service_role' then raise exception 'service role required'; end if;
 if p_method not in ('stripe_card','paypal_venmo') then raise exception 'Unsupported checkout method'; end if;
 select * into r from public.payment_requests where token_digest=p_token_digest and status='active' and invalidated_at is null for update;
 if not found then raise exception 'Request unavailable'; end if;
 select * into s from public.payment_collection_settings where settings_id;
 if not s.collection_enabled or (p_method='stripe_card' and not s.stripe_enabled) or (p_method='paypal_venmo' and not s.venmo_enabled) then raise exception 'Provider unavailable'; end if;
 update public.payment_checkout_attempts set status='expired',resolved_at=now(),last_verified_state='expired_locally' where payment_request_id=r.payment_request_id and status in ('creating','active','processing') and expires_at<=now();
 select * into a from public.payment_checkout_attempts where payment_request_id=r.payment_request_id and status in ('creating','active','processing') for update;
 if found then
   if a.method<>p_method then return jsonb_build_object('state','method_locked','attemptId',a.payment_checkout_attempt_id); end if;
   return jsonb_build_object('state','existing','attempt',to_jsonb(a));
 end if;
 insert into public.payment_checkout_attempts(payment_request_id,project_id,method,principal_amount,charge_amount,create_idempotency_key,expires_at)
 values(r.payment_request_id,r.project_id,p_method,r.principal_amount,r.principal_amount,p_command_key,now()+interval '30 minutes') returning * into a;
 return jsonb_build_object('state','reserved','attempt',to_jsonb(a));
end; $$;
revoke all on function public.reserve_payment_checkout(text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_payment_checkout(text,text,text) to service_role;

-- Final obligation state command cancels obsolete collection work atomically.
create or replace function public.set_payment_obligation_state(p_obligation_id uuid,p_state text,p_reason text,p_command_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row public.project_payment_records; begin
 if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
 if p_state not in ('waived','canceled') or nullif(btrim(p_reason),'') is null then raise exception 'A valid state and reason are required'; end if;
 update public.project_payment_records set status=p_state,fulfillment_state=p_state,waived_at=case when p_state='waived' then now() end,canceled_at=case when p_state='canceled' then now() end,updated_at=now()
 where project_payment_record_id=p_obligation_id and status not in ('paid','waived','canceled') returning * into v_row;
 if not found then raise exception 'Obligation cannot be changed'; end if;
 update public.payment_requests r set status='canceled',invalidated_at=now(),token_ciphertext=null,token_iv=null,token_key_version=null where r.status='active' and exists(select 1 from public.payment_request_obligations ro where ro.payment_request_id=r.payment_request_id and ro.obligation_id=p_obligation_id);
 update public.payment_checkout_attempts a set status='canceled',canceled_at=now(),canceled_by=auth.uid(),canceled_reason=p_reason where a.status in ('creating','active','processing') and exists(select 1 from public.payment_request_obligations ro where ro.payment_request_id=a.payment_request_id and ro.obligation_id=p_obligation_id);
 update public.payment_message_deliveries set status='canceled',suppression_reason=p_reason where obligation_id=p_obligation_id and status in ('queued','claimed');
 update public.projects p set status=case when p.status='awaiting_deposit' and not exists(select 1 from public.project_payment_records o where o.project_id=p.project_id and o.payment_kind='deposit' and o.outstanding_amount>0 and o.status not in ('waived','canceled')) then case when exists(select 1 from public.project_payment_records o where o.project_id=p.project_id and o.payment_kind='final_payment' and o.outstanding_amount>0 and o.status not in ('waived','canceled')) then 'booked'::public.project_status else 'final_prep'::public.project_status end when p.status='awaiting_final_payment' and not exists(select 1 from public.project_payment_records o where o.project_id=p.project_id and o.outstanding_amount>0 and o.status not in ('waived','canceled')) then 'final_prep'::public.project_status else p.status end,updated_at=now() where p.project_id=v_row.project_id and p.status not in ('completed','canceled');
 perform public.create_payment_activity(v_row.project_id,'Payment obligation '||p_state,p_reason,'florist',jsonb_build_object('obligation_id',p_obligation_id,'command_key',p_command_key),auth.uid());
 return to_jsonb(v_row);
end; $$;
revoke all on function public.set_payment_obligation_state(uuid,text,text,uuid) from public,anon;
grant execute on function public.set_payment_obligation_state(uuid,text,text,uuid) to authenticated;

-- Final concurrency-safe receipt, provider-reconciliation, and status-refresh definitions.
create or replace function public.record_manual_payment(
  p_project_id uuid, p_obligation_id uuid, p_amount_cents bigint, p_method text,
  p_received_at timestamptz, p_note text, p_suspected_reference text default null,
  p_override_reason text default null, p_command_key uuid default gen_random_uuid(),
  p_confirm_overpayment boolean default false
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_existing public.payment_transactions; v_duplicate public.payment_transactions;
v_transaction public.payment_transactions; v_amount numeric(12,2):=p_amount_cents/100.0; v_remaining numeric(12,2); v_project_outstanding numeric(12,2);
v_obligation public.project_payment_records; v_row public.project_payment_records; v_alloc numeric(12,2); v_sequence int:=0; v_overpayment numeric(12,2):=0;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
  if p_amount_cents<=0 then raise exception 'Amount must be greater than zero'; end if;
  if p_received_at is null or p_received_at>now()+interval '5 minutes' then raise exception 'Receipt date is invalid'; end if;
  if p_method not in ('venmo','check','cash','other','stripe') then raise exception 'Unsupported payment method'; end if;
  select * into v_existing from public.payment_transactions where command_key=p_command_key;
  if found then return jsonb_build_object('state','recorded','transaction',to_jsonb(v_existing),'replayed',true); end if;
  perform 1 from public.project_payment_records where project_id=p_project_id and status not in ('canceled','waived') order by case payment_kind when 'deposit' then 1 else 2 end,project_payment_record_id for update;
  select * into v_obligation from public.project_payment_records where project_payment_record_id=p_obligation_id and project_id=p_project_id and status not in ('canceled','waived');
  if not found then raise exception 'Payment obligation is unavailable'; end if;
  select * into v_duplicate from public.payment_transactions where project_id=p_project_id and status='confirmed' and kind='receipt' and principal_amount=v_amount and method=p_method and occurred_at between p_received_at-interval '1 day' and p_received_at+interval '1 day' order by occurred_at desc limit 1;
  if found and (nullif(btrim(p_override_reason),'') is null or p_suspected_reference is distinct from v_duplicate.payment_reference) then
    return jsonb_build_object('state','duplicate_warning','suspectedReference',v_duplicate.payment_reference);
  end if;
  select coalesce(sum(outstanding_amount),0) into v_project_outstanding from public.project_payment_records where project_id=p_project_id and status not in ('canceled','waived');
  if v_amount>v_project_outstanding and not p_confirm_overpayment then return jsonb_build_object('state','overpayment_warning','overpaymentAmount',v_amount-v_project_outstanding); end if;
  insert into public.payment_transactions(payment_reference,project_id,kind,status,principal_amount,method,source,occurred_at,actor_type,actor_id,command_key,duplicate_override,duplicate_override_reason,suspected_reference,customer_notice_policy,customer_notice_state,note)
  values(public.generate_payment_reference(),p_project_id,'receipt','confirmed',v_amount,p_method,'manual',p_received_at,'florist',v_actor,p_command_key,v_duplicate.payment_transaction_id is not null,p_override_reason,p_suspected_reference,'required','queued',nullif(btrim(p_note),'')) returning * into v_transaction;
  v_remaining:=least(v_amount,v_project_outstanding);
  for v_row in select * from public.project_payment_records where project_id=p_project_id and status not in ('canceled','waived') order by case payment_kind when 'deposit' then 1 else 2 end for update loop
    exit when v_remaining<=0; v_alloc:=least(v_remaining,v_row.outstanding_amount);
    if v_alloc>0 then v_sequence:=v_sequence+1; insert into public.payment_transaction_allocations(payment_transaction_id,obligation_id,allocated_principal,sequence) values(v_transaction.payment_transaction_id,v_row.project_payment_record_id,v_alloc,v_sequence); v_remaining:=v_remaining-v_alloc; end if;
  end loop;
  perform public.recompute_project_payment_obligations(p_project_id);
  select greatest(v_amount-v_project_outstanding,0) into v_overpayment;
  if v_overpayment>0 then insert into public.payment_exceptions(project_id,payment_transaction_id,exception_type,urgency,amount,summary) values(p_project_id,v_transaction.payment_transaction_id,'overpayment','urgent',v_overpayment,'Payment exceeds the complete project balance'); end if;
  update public.projects p set status=case
      when p.status='awaiting_deposit' and not exists(select 1 from public.project_payment_records o where o.project_id=p.project_id and o.payment_kind='deposit' and o.outstanding_amount>0 and o.status not in ('waived','canceled'))
        then case when exists(select 1 from public.project_payment_records o where o.project_id=p.project_id and o.payment_kind='final_payment' and o.outstanding_amount>0 and o.status not in ('waived','canceled')) then 'booked'::public.project_status else 'final_prep'::public.project_status end
      when p.status='awaiting_final_payment' and not exists(select 1 from public.project_payment_records o where o.project_id=p.project_id and o.outstanding_amount>0 and o.status not in ('waived','canceled')) then 'final_prep'::public.project_status
      else p.status end,
    booked_at=case when p.status='awaiting_deposit' then coalesce(p.booked_at,now()) else p.booked_at end, updated_at=now()
  where p.project_id=p_project_id and p.status not in ('completed','canceled');
  perform public.create_payment_activity(p_project_id,'Payment recorded',initcap(replace(v_obligation.payment_kind,'_',' '))||' payment '||v_transaction.payment_reference||' was recorded.','florist',jsonb_build_object('payment_reference',v_transaction.payment_reference,'payment_kind',v_obligation.payment_kind,'method',p_method,'principal_amount',v_amount),v_actor);
  insert into public.payment_message_deliveries(project_id,obligation_id,payment_transaction_id,delivery_kind,occurrence_key,principal_amount,status)
  values(p_project_id,p_obligation_id,v_transaction.payment_transaction_id,'receipt','receipt:'||v_transaction.payment_transaction_id,v_amount,'queued');
  return jsonb_build_object('state','recorded','transaction',to_jsonb(v_transaction),'overpaymentAmount',v_overpayment,'replayed',false);
end; $$;
revoke all on function public.record_manual_payment(uuid,uuid,bigint,text,timestamptz,text,text,text,uuid,boolean) from public,anon;
grant execute on function public.record_manual_payment(uuid,uuid,bigint,text,timestamptz,text,text,text,uuid,boolean) to authenticated;

create or replace function public.reconcile_payment_event(p_provider_event_id uuid,p_facts jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.payment_provider_events;a public.payment_checkout_attempts;r public.payment_requests;t public.payment_transactions;original public.payment_transactions;
v_kind text:=coalesce(p_facts->>'kind','receipt');v_status text:=coalesce(p_facts->>'status','confirmed');v_amount numeric(12,2):=coalesce((p_facts->>'principalCents')::bigint,0)/100.0;
v_remaining numeric(12,2);o public.project_payment_records;x record;v_alloc numeric(12,2);v_seq int:=0;v_project_outstanding numeric(12,2);v_effect_key text;
begin
 if auth.role()<>'service_role' then raise exception 'service role required'; end if;
 select * into e from public.payment_provider_events where payment_provider_event_id=p_provider_event_id for update;
 if not found then raise exception 'Provider event is unavailable'; end if;
 if e.processing_state in ('processed','duplicate') then return jsonb_build_object('state','duplicate','transactionId',e.payment_transaction_id); end if;
 select * into a from public.payment_checkout_attempts where payment_checkout_attempt_id=coalesce((p_facts->>'attemptId')::uuid,e.payment_checkout_attempt_id) for update;
 if not found then update public.payment_provider_events set processing_state='unmatched',processed_at=now() where payment_provider_event_id=e.payment_provider_event_id; raise exception 'Payment attempt is unmatched'; end if;
 select * into r from public.payment_requests where payment_request_id=a.payment_request_id for update;
 if upper(coalesce(p_facts->>'currency',''))<>'USD' or v_amount<=0 or (v_kind='receipt' and v_amount<>a.principal_amount) or coalesce(p_facts->>'merchantId','')<>coalesce(p_facts->>'expectedMerchantId',p_facts->>'merchantId','') then raise exception 'Provider amount, currency, or merchant mismatch'; end if;
 v_effect_key:=e.provider||':'||coalesce(e.provider_object_id,e.provider_event_id)||':'||v_kind;
 if exists(select 1 from public.payment_transactions where provider_reference=v_effect_key) then update public.payment_provider_events set processing_state='duplicate',processed_at=now() where payment_provider_event_id=e.payment_provider_event_id; return jsonb_build_object('state','duplicate'); end if;
 insert into public.payment_transactions(payment_reference,project_id,payment_request_id,payment_checkout_attempt_id,kind,status,principal_amount,customer_fee,merchant_fee,method,source,occurred_at,actor_type,provider_reference,customer_notice_policy,customer_notice_state,payload_digest,normalized_facts)
 values(public.generate_payment_reference(),a.project_id,r.payment_request_id,a.payment_checkout_attempt_id,v_kind,v_status,case when v_kind in ('refund','reversal','void') then -v_amount else v_amount end,0,(p_facts->>'merchantFeeCents')::bigint/100.0,a.method,case when e.provider='stripe' then 'stripe' else 'paypal' end,e.event_occurred_at,'provider',v_effect_key,case when v_kind='receipt' and v_status='confirmed' then 'required' when v_kind in ('refund','reversal') and v_status in ('confirmed','resolved') then 'required' when v_kind in ('dispute','correction') then 'optional' else 'none' end,'queued',e.payload_digest,p_facts) returning * into t;
 if v_kind='receipt' and v_status='confirmed' then
   perform 1
   from public.project_payment_records
   where project_id = a.project_id
     and status not in ('waived', 'canceled')
   order by case payment_kind when 'deposit' then 1 else 2 end,
            project_payment_record_id
   for update;
   select coalesce(sum(outstanding_amount), 0)
   into v_project_outstanding
   from public.project_payment_records
   where project_id = a.project_id
     and status not in ('waived', 'canceled');
   v_remaining:=least(v_amount,v_project_outstanding);
   for o in select * from public.project_payment_records where project_id=a.project_id and status not in ('waived','canceled') order by case payment_kind when 'deposit' then 1 else 2 end for update loop exit when v_remaining<=0;v_alloc:=least(v_remaining,o.outstanding_amount);if v_alloc>0 then v_seq:=v_seq+1;insert into public.payment_transaction_allocations(payment_transaction_id,obligation_id,allocated_principal,sequence) values(t.payment_transaction_id,o.project_payment_record_id,v_alloc,v_seq);v_remaining:=v_remaining-v_alloc;end if;end loop;
   if v_amount>v_project_outstanding then insert into public.payment_exceptions(project_id,payment_transaction_id,payment_provider_event_id,exception_type,urgency,amount,summary) values(a.project_id,t.payment_transaction_id,e.payment_provider_event_id,'overpayment','urgent',v_amount-v_project_outstanding,'Provider payment exceeds the complete project balance');end if;
   update public.payment_checkout_attempts set status='paid',resolved_at=now(),last_verified_state=e.event_type where payment_checkout_attempt_id=a.payment_checkout_attempt_id;
   update public.payment_requests set status='fulfilled',fulfilled_at=now(),invalidated_at=now(),token_ciphertext=null,token_iv=null,token_key_version=null where payment_request_id=r.payment_request_id;
   update public.payment_intentions set state='fulfilled',fulfilled_at=now() where payment_request_id=r.payment_request_id and state='active';
 elsif v_kind<>'receipt' and v_status in ('confirmed','resolved') then
   select * into original from public.payment_transactions where project_id=a.project_id and kind='receipt' and status='confirmed' order by occurred_at desc limit 1;
   v_remaining:=v_amount;
   if original.payment_transaction_id is not null then
     for x in select * from public.payment_transaction_allocations pa where pa.payment_transaction_id=original.payment_transaction_id order by pa.sequence desc loop
       exit when v_remaining<=0;v_alloc:=least(abs(x.allocated_principal),v_remaining);v_seq:=v_seq+1;
       insert into public.payment_transaction_allocations(payment_transaction_id,obligation_id,allocated_principal,sequence) values(t.payment_transaction_id,x.obligation_id,-v_alloc,v_seq);v_remaining:=v_remaining-v_alloc;
     end loop;
   end if;
   insert into public.payment_exceptions(project_id,payment_transaction_id,payment_provider_event_id,exception_type,urgency,amount,summary) values(a.project_id,t.payment_transaction_id,e.payment_provider_event_id,'adjustment_reopened_balance','urgent',v_amount,'Provider adjustment reopened a project balance');
 else
   update public.payment_checkout_attempts set status=case when v_status='pending' then 'processing' else 'failed' end,resolved_at=case when v_status='failed' then now() else null end,last_verified_state=e.event_type where payment_checkout_attempt_id=a.payment_checkout_attempt_id;
 end if;
 perform public.recompute_project_payment_obligations(a.project_id);
 update public.projects p set status=case when p.status='awaiting_deposit' and not exists(select 1 from public.project_payment_records o2 where o2.project_id=p.project_id and o2.payment_kind='deposit' and o2.outstanding_amount>0 and o2.status not in ('waived','canceled')) then case when exists(select 1 from public.project_payment_records o2 where o2.project_id=p.project_id and o2.payment_kind='final_payment' and o2.outstanding_amount>0 and o2.status not in ('waived','canceled')) then 'booked'::public.project_status else 'final_prep'::public.project_status end when p.status='awaiting_final_payment' and not exists(select 1 from public.project_payment_records o2 where o2.project_id=p.project_id and o2.outstanding_amount>0 and o2.status not in ('waived','canceled')) then 'final_prep'::public.project_status else p.status end,booked_at=case when p.status='awaiting_deposit' then coalesce(p.booked_at,now()) else p.booked_at end,updated_at=now() where p.project_id=a.project_id and p.status not in ('completed','canceled');
 update public.payment_provider_events set processing_state='processed',payment_checkout_attempt_id=a.payment_checkout_attempt_id,payment_transaction_id=t.payment_transaction_id,processed_at=now() where payment_provider_event_id=e.payment_provider_event_id;
 perform public.create_payment_activity(a.project_id,case when v_kind='receipt' then 'Payment confirmed' else 'Payment adjusted' end,initcap(replace(v_kind,'_',' '))||' '||t.payment_reference||' was recorded.','provider',jsonb_build_object('payment_reference',t.payment_reference,'method',a.method,'principal_amount',t.principal_amount,'provider_event_id',e.payment_provider_event_id),null);
 if t.customer_notice_policy='required' then insert into public.payment_message_deliveries(project_id,payment_request_id,payment_transaction_id,delivery_kind,occurrence_key,principal_amount,status) values(a.project_id,r.payment_request_id,t.payment_transaction_id,case when v_kind='receipt' then 'receipt' else 'adjustment_notice' end,case when v_kind='receipt' then 'receipt:' else 'adjustment:' end||t.payment_transaction_id,abs(t.principal_amount),'queued');end if;
 return jsonb_build_object('state','processed','transactionId',t.payment_transaction_id,'paymentReference',t.payment_reference);
exception when others then update public.payment_provider_events set processing_state='failed',processing_error=left(sqlerrm,300),processed_at=now() where payment_provider_event_id=p_provider_event_id;raise;end; $$;
revoke all on function public.reconcile_payment_event(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.reconcile_payment_event(uuid,jsonb) to service_role;

create or replace function public.refresh_project_payment_statuses(target_project_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_project record;
begin
  if auth.role() not in ('service_role','authenticated') or (auth.role()='authenticated' and not public.is_internal_crm_user()) then raise exception 'not authorized'; end if;
  for v_project in
    select p.project_id, p.status
    from public.projects p
    where p.event_date is not null
      and p.event_date <= current_date + 60
      and (target_project_id is null or p.project_id=target_project_id)
      and p.status in ('awaiting_deposit','booked','awaiting_final_payment')
    order by p.project_id for update
  loop
    if not exists(select 1 from public.project_payment_records o where o.project_id=v_project.project_id and o.payment_kind='deposit' and o.outstanding_amount>0 and o.status not in ('waived','canceled'))
       and exists(select 1 from public.project_payment_records o where o.project_id=v_project.project_id and o.payment_kind='final_payment' and o.outstanding_amount>0 and o.status not in ('waived','canceled'))
       and v_project.status='booked' then
      update public.projects set status='awaiting_final_payment',updated_at=now() where project_id=v_project.project_id;
      perform public.create_payment_activity(v_project.project_id,'Final payment collection started','The event is within 60 days and its final balance is now due.','schedule',jsonb_build_object('window_days',60),null);
    end if;
  end loop;
end; $$;
revoke all on function public.refresh_project_payment_statuses(uuid) from public,anon;
grant execute on function public.refresh_project_payment_statuses(uuid) to authenticated,service_role;

-- Persist provider reconciliation failures before returning a retryable callback result.
create or replace function public.reconcile_payment_event(p_provider_event_id uuid,p_facts jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.payment_provider_events;a public.payment_checkout_attempts;r public.payment_requests;t public.payment_transactions;original public.payment_transactions;
v_kind text:=coalesce(p_facts->>'kind','receipt');v_status text:=coalesce(p_facts->>'status','confirmed');v_amount numeric(12,2):=coalesce((p_facts->>'principalCents')::bigint,0)/100.0;
v_remaining numeric(12,2);o public.project_payment_records;x record;v_alloc numeric(12,2);v_seq int:=0;v_project_outstanding numeric(12,2);v_effect_key text;
begin
 if auth.role()<>'service_role' then raise exception 'service role required'; end if;
 select * into e from public.payment_provider_events where payment_provider_event_id=p_provider_event_id for update;
 if not found then raise exception 'Provider event is unavailable'; end if;
 if e.processing_state in ('processed','duplicate') then return jsonb_build_object('state','duplicate','transactionId',e.payment_transaction_id); end if;
 select * into a from public.payment_checkout_attempts where payment_checkout_attempt_id=coalesce((p_facts->>'attemptId')::uuid,e.payment_checkout_attempt_id) for update;
 if not found then update public.payment_provider_events set processing_state='unmatched',processed_at=now() where payment_provider_event_id=e.payment_provider_event_id; raise exception 'Payment attempt is unmatched'; end if;
 select * into r from public.payment_requests where payment_request_id=a.payment_request_id for update;
 if upper(coalesce(p_facts->>'currency',''))<>'USD' or v_amount<=0 or (v_kind='receipt' and v_amount<>a.principal_amount) or coalesce(p_facts->>'merchantId','')<>coalesce(p_facts->>'expectedMerchantId',p_facts->>'merchantId','') then raise exception 'Provider amount, currency, or merchant mismatch'; end if;
 v_effect_key:=e.provider||':'||coalesce(e.provider_object_id,e.provider_event_id)||':'||v_kind;
 if exists(select 1 from public.payment_transactions where provider_reference=v_effect_key) then update public.payment_provider_events set processing_state='duplicate',processed_at=now() where payment_provider_event_id=e.payment_provider_event_id; return jsonb_build_object('state','duplicate'); end if;
 insert into public.payment_transactions(payment_reference,project_id,payment_request_id,payment_checkout_attempt_id,kind,status,principal_amount,customer_fee,merchant_fee,method,source,occurred_at,actor_type,provider_reference,customer_notice_policy,customer_notice_state,payload_digest,normalized_facts)
 values(public.generate_payment_reference(),a.project_id,r.payment_request_id,a.payment_checkout_attempt_id,v_kind,v_status,case when v_kind in ('refund','reversal','void') then -v_amount else v_amount end,0,(p_facts->>'merchantFeeCents')::bigint/100.0,a.method,case when e.provider='stripe' then 'stripe' else 'paypal' end,e.event_occurred_at,'provider',v_effect_key,case when v_kind='receipt' and v_status='confirmed' then 'required' when v_kind in ('refund','reversal') and v_status in ('confirmed','resolved') then 'required' when v_kind in ('dispute','correction') then 'optional' else 'none' end,'queued',e.payload_digest,p_facts) returning * into t;
 if v_kind='receipt' and v_status='confirmed' then
   perform 1
   from public.project_payment_records
   where project_id = a.project_id
     and status not in ('waived', 'canceled')
   order by case payment_kind when 'deposit' then 1 else 2 end,
            project_payment_record_id
   for update;
   select coalesce(sum(outstanding_amount), 0)
   into v_project_outstanding
   from public.project_payment_records
   where project_id = a.project_id
     and status not in ('waived', 'canceled');
   v_remaining:=least(v_amount,v_project_outstanding);
   for o in select * from public.project_payment_records where project_id=a.project_id and status not in ('waived','canceled') order by case payment_kind when 'deposit' then 1 else 2 end for update loop exit when v_remaining<=0;v_alloc:=least(v_remaining,o.outstanding_amount);if v_alloc>0 then v_seq:=v_seq+1;insert into public.payment_transaction_allocations(payment_transaction_id,obligation_id,allocated_principal,sequence) values(t.payment_transaction_id,o.project_payment_record_id,v_alloc,v_seq);v_remaining:=v_remaining-v_alloc;end if;end loop;
   if v_amount>v_project_outstanding then insert into public.payment_exceptions(project_id,payment_transaction_id,payment_provider_event_id,exception_type,urgency,amount,summary) values(a.project_id,t.payment_transaction_id,e.payment_provider_event_id,'overpayment','urgent',v_amount-v_project_outstanding,'Provider payment exceeds the complete project balance');end if;
   update public.payment_checkout_attempts set status='paid',resolved_at=now(),last_verified_state=e.event_type where payment_checkout_attempt_id=a.payment_checkout_attempt_id;
   update public.payment_requests set status='fulfilled',fulfilled_at=now(),invalidated_at=now(),token_ciphertext=null,token_iv=null,token_key_version=null where payment_request_id=r.payment_request_id;
   update public.payment_intentions set state='fulfilled',fulfilled_at=now() where payment_request_id=r.payment_request_id and state='active';
 elsif v_kind<>'receipt' and v_status in ('confirmed','resolved') then
   select * into original from public.payment_transactions where project_id=a.project_id and kind='receipt' and status='confirmed' order by occurred_at desc limit 1;
   v_remaining:=v_amount;
   if original.payment_transaction_id is not null then
     for x in select * from public.payment_transaction_allocations pa where pa.payment_transaction_id=original.payment_transaction_id order by pa.sequence desc loop
       exit when v_remaining<=0;v_alloc:=least(abs(x.allocated_principal),v_remaining);v_seq:=v_seq+1;
       insert into public.payment_transaction_allocations(payment_transaction_id,obligation_id,allocated_principal,sequence) values(t.payment_transaction_id,x.obligation_id,-v_alloc,v_seq);v_remaining:=v_remaining-v_alloc;
     end loop;
   end if;
   insert into public.payment_exceptions(project_id,payment_transaction_id,payment_provider_event_id,exception_type,urgency,amount,summary) values(a.project_id,t.payment_transaction_id,e.payment_provider_event_id,'adjustment_reopened_balance','urgent',v_amount,'Provider adjustment reopened a project balance');
 else
   update public.payment_checkout_attempts set status=case when v_status='pending' then 'processing' else 'failed' end,resolved_at=case when v_status='failed' then now() else null end,last_verified_state=e.event_type where payment_checkout_attempt_id=a.payment_checkout_attempt_id;
 end if;
 perform public.recompute_project_payment_obligations(a.project_id);
 update public.projects p set status=case when p.status='awaiting_deposit' and not exists(select 1 from public.project_payment_records o2 where o2.project_id=p.project_id and o2.payment_kind='deposit' and o2.outstanding_amount>0 and o2.status not in ('waived','canceled')) then case when exists(select 1 from public.project_payment_records o2 where o2.project_id=p.project_id and o2.payment_kind='final_payment' and o2.outstanding_amount>0 and o2.status not in ('waived','canceled')) then 'booked'::public.project_status else 'final_prep'::public.project_status end when p.status='awaiting_final_payment' and not exists(select 1 from public.project_payment_records o2 where o2.project_id=p.project_id and o2.outstanding_amount>0 and o2.status not in ('waived','canceled')) then 'final_prep'::public.project_status else p.status end,booked_at=case when p.status='awaiting_deposit' then coalesce(p.booked_at,now()) else p.booked_at end,updated_at=now() where p.project_id=a.project_id and p.status not in ('completed','canceled');
 update public.payment_provider_events set processing_state='processed',payment_checkout_attempt_id=a.payment_checkout_attempt_id,payment_transaction_id=t.payment_transaction_id,processed_at=now() where payment_provider_event_id=e.payment_provider_event_id;
 perform public.create_payment_activity(a.project_id,case when v_kind='receipt' then 'Payment confirmed' else 'Payment adjusted' end,initcap(replace(v_kind,'_',' '))||' '||t.payment_reference||' was recorded.','provider',jsonb_build_object('payment_reference',t.payment_reference,'method',a.method,'principal_amount',t.principal_amount,'provider_event_id',e.payment_provider_event_id),null);
 if t.customer_notice_policy='required' then insert into public.payment_message_deliveries(project_id,payment_request_id,payment_transaction_id,delivery_kind,occurrence_key,principal_amount,status) values(a.project_id,r.payment_request_id,t.payment_transaction_id,case when v_kind='receipt' then 'receipt' else 'adjustment_notice' end,case when v_kind='receipt' then 'receipt:' else 'adjustment:' end||t.payment_transaction_id,abs(t.principal_amount),'queued');end if;
 return jsonb_build_object('state','processed','transactionId',t.payment_transaction_id,'paymentReference',t.payment_reference);
exception when others then update public.payment_provider_events set processing_state='failed',processing_error=left(sqlerrm,300),processed_at=now() where payment_provider_event_id=p_provider_event_id;return jsonb_build_object('state','failed','error','reconciliation_failed');end; $$;
revoke all on function public.reconcile_payment_event(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.reconcile_payment_event(uuid,jsonb) to service_role;

-- Final obligation aggregate freezes the deposit target at first credited receipt.
create or replace function public.recompute_project_payment_obligations(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.project_payment_records o
  set credited_principal=greatest(coalesce(a.credited,0),0),
      amount_paid=greatest(coalesce(a.credited,0),0),
      outstanding_amount=greatest(o.target_amount-coalesce(a.credited,0),0),
      status=case when o.status in ('waived','canceled','review_required') then o.status
                  when coalesce(a.credited,0)<=0 then case when o.due_date<=current_date then 'due' else 'not_due' end
                  when coalesce(a.credited,0)<o.target_amount then 'partially_paid'
                  when coalesce(a.credited,0)=o.target_amount then 'paid' else 'overpaid' end,
      fulfillment_state=case when o.status in ('waived','canceled','review_required') then o.status
                  when coalesce(a.credited,0)<=0 then case when o.due_date<=current_date then 'due' else 'not_due' end
                  when coalesce(a.credited,0)<o.target_amount then 'partially_paid'
                  when coalesce(a.credited,0)=o.target_amount then 'paid' else 'overpaid' end,
      deposit_target_frozen_at=case when o.payment_kind='deposit' and coalesce(a.credited,0)>0 then coalesce(o.deposit_target_frozen_at,now()) else o.deposit_target_frozen_at end,
      fulfilled_at=case when coalesce(a.credited,0)>=o.target_amount and o.target_amount>0 then coalesce(o.fulfilled_at,now()) else null end,
      updated_at=now()
  from (select obligation_id, sum(allocated_principal) credited from public.payment_transaction_allocations group by obligation_id) a
  where o.project_id=p_project_id and a.obligation_id=o.project_payment_record_id;

  update public.project_payment_records set credited_principal=0, amount_paid=0,
    outstanding_amount=target_amount,
    status=case when status in ('waived','canceled','review_required') then status when due_date<=current_date then 'due' else 'not_due' end,
    fulfillment_state=case when fulfillment_state in ('waived','canceled','review_required') then fulfillment_state when due_date<=current_date then 'due' else 'not_due' end,
    fulfilled_at=null, updated_at=now()
  where project_id=p_project_id and not exists(select 1 from public.payment_transaction_allocations a where a.obligation_id=project_payment_record_id);
end;
$$;
revoke all on function public.recompute_project_payment_obligations(uuid) from public, anon, authenticated;
grant execute on function public.recompute_project_payment_obligations(uuid) to service_role;

-- Final manual receipt booking timestamp gate definition.
create or replace function public.record_manual_payment(
  p_project_id uuid, p_obligation_id uuid, p_amount_cents bigint, p_method text,
  p_received_at timestamptz, p_note text, p_suspected_reference text default null,
  p_override_reason text default null, p_command_key uuid default gen_random_uuid(),
  p_confirm_overpayment boolean default false
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_existing public.payment_transactions; v_duplicate public.payment_transactions;
v_transaction public.payment_transactions; v_amount numeric(12,2):=p_amount_cents/100.0; v_remaining numeric(12,2); v_project_outstanding numeric(12,2);
v_obligation public.project_payment_records; v_row public.project_payment_records; v_alloc numeric(12,2); v_sequence int:=0; v_overpayment numeric(12,2):=0;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
  if p_amount_cents<=0 then raise exception 'Amount must be greater than zero'; end if;
  if p_received_at is null or p_received_at>now()+interval '5 minutes' then raise exception 'Receipt date is invalid'; end if;
  if p_method not in ('venmo','check','cash','other','stripe') then raise exception 'Unsupported payment method'; end if;
  select * into v_existing from public.payment_transactions where command_key=p_command_key;
  if found then return jsonb_build_object('state','recorded','transaction',to_jsonb(v_existing),'replayed',true); end if;
  perform 1 from public.project_payment_records where project_id=p_project_id and status not in ('canceled','waived') order by case payment_kind when 'deposit' then 1 else 2 end,project_payment_record_id for update;
  select * into v_obligation from public.project_payment_records where project_payment_record_id=p_obligation_id and project_id=p_project_id and status not in ('canceled','waived');
  if not found then raise exception 'Payment obligation is unavailable'; end if;
  select * into v_duplicate from public.payment_transactions where project_id=p_project_id and status='confirmed' and kind='receipt' and principal_amount=v_amount and method=p_method and occurred_at between p_received_at-interval '1 day' and p_received_at+interval '1 day' order by occurred_at desc limit 1;
  if found and (nullif(btrim(p_override_reason),'') is null or p_suspected_reference is distinct from v_duplicate.payment_reference) then
    return jsonb_build_object('state','duplicate_warning','suspectedReference',v_duplicate.payment_reference);
  end if;
  select coalesce(sum(outstanding_amount),0) into v_project_outstanding from public.project_payment_records where project_id=p_project_id and status not in ('canceled','waived');
  if v_amount>v_project_outstanding and not p_confirm_overpayment then return jsonb_build_object('state','overpayment_warning','overpaymentAmount',v_amount-v_project_outstanding); end if;
  insert into public.payment_transactions(payment_reference,project_id,kind,status,principal_amount,method,source,occurred_at,actor_type,actor_id,command_key,duplicate_override,duplicate_override_reason,suspected_reference,customer_notice_policy,customer_notice_state,note)
  values(public.generate_payment_reference(),p_project_id,'receipt','confirmed',v_amount,p_method,'manual',p_received_at,'florist',v_actor,p_command_key,v_duplicate.payment_transaction_id is not null,p_override_reason,p_suspected_reference,'required','queued',nullif(btrim(p_note),'')) returning * into v_transaction;
  v_remaining:=least(v_amount,v_project_outstanding);
  for v_row in select * from public.project_payment_records where project_id=p_project_id and status not in ('canceled','waived') order by case payment_kind when 'deposit' then 1 else 2 end for update loop
    exit when v_remaining<=0; v_alloc:=least(v_remaining,v_row.outstanding_amount);
    if v_alloc>0 then v_sequence:=v_sequence+1; insert into public.payment_transaction_allocations(payment_transaction_id,obligation_id,allocated_principal,sequence) values(v_transaction.payment_transaction_id,v_row.project_payment_record_id,v_alloc,v_sequence); v_remaining:=v_remaining-v_alloc; end if;
  end loop;
  perform public.recompute_project_payment_obligations(p_project_id);
  select greatest(v_amount-v_project_outstanding,0) into v_overpayment;
  if v_overpayment>0 then insert into public.payment_exceptions(project_id,payment_transaction_id,exception_type,urgency,amount,summary) values(p_project_id,v_transaction.payment_transaction_id,'overpayment','urgent',v_overpayment,'Payment exceeds the complete project balance'); end if;
  update public.projects p set status=case
      when p.status='awaiting_deposit' and not exists(select 1 from public.project_payment_records o where o.project_id=p.project_id and o.payment_kind='deposit' and o.outstanding_amount>0 and o.status not in ('waived','canceled'))
        then case when exists(select 1 from public.project_payment_records o where o.project_id=p.project_id and o.payment_kind='final_payment' and o.outstanding_amount>0 and o.status not in ('waived','canceled')) then 'booked'::public.project_status else 'final_prep'::public.project_status end
      when p.status='awaiting_final_payment' and not exists(select 1 from public.project_payment_records o where o.project_id=p.project_id and o.outstanding_amount>0 and o.status not in ('waived','canceled')) then 'final_prep'::public.project_status
      else p.status end,
    booked_at=case when p.status='awaiting_deposit' and not exists(select 1 from public.project_payment_records o where o.project_id=p.project_id and o.payment_kind='deposit' and o.outstanding_amount>0 and o.status not in ('waived','canceled')) then coalesce(p.booked_at,now()) else p.booked_at end, updated_at=now()
  where p.project_id=p_project_id and p.status not in ('completed','canceled');
  perform public.create_payment_activity(p_project_id,'Payment recorded',initcap(replace(v_obligation.payment_kind,'_',' '))||' payment '||v_transaction.payment_reference||' was recorded.','florist',jsonb_build_object('payment_reference',v_transaction.payment_reference,'payment_kind',v_obligation.payment_kind,'method',p_method,'principal_amount',v_amount),v_actor);
  insert into public.payment_message_deliveries(project_id,obligation_id,payment_transaction_id,delivery_kind,occurrence_key,principal_amount,status)
  values(p_project_id,p_obligation_id,v_transaction.payment_transaction_id,'receipt','receipt:'||v_transaction.payment_transaction_id,v_amount,'queued');
  return jsonb_build_object('state','recorded','transaction',to_jsonb(v_transaction),'overpaymentAmount',v_overpayment,'replayed',false);
end; $$;
revoke all on function public.record_manual_payment(uuid,uuid,bigint,text,timestamptz,text,text,text,uuid,boolean) from public,anon;
grant execute on function public.record_manual_payment(uuid,uuid,bigint,text,timestamptz,text,text,text,uuid,boolean) to authenticated;

-- Final provider status transition gate definition.
create or replace function public.reconcile_payment_event(p_provider_event_id uuid,p_facts jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.payment_provider_events;a public.payment_checkout_attempts;r public.payment_requests;t public.payment_transactions;original public.payment_transactions;
v_kind text:=coalesce(p_facts->>'kind','receipt');v_status text:=coalesce(p_facts->>'status','confirmed');v_amount numeric(12,2):=coalesce((p_facts->>'principalCents')::bigint,0)/100.0;
v_remaining numeric(12,2);o public.project_payment_records;x record;v_alloc numeric(12,2);v_seq int:=0;v_project_outstanding numeric(12,2);v_effect_key text;
begin
 if auth.role()<>'service_role' then raise exception 'service role required'; end if;
 select * into e from public.payment_provider_events where payment_provider_event_id=p_provider_event_id for update;
 if not found then raise exception 'Provider event is unavailable'; end if;
 if e.processing_state in ('processed','duplicate') then return jsonb_build_object('state','duplicate','transactionId',e.payment_transaction_id); end if;
 select * into a from public.payment_checkout_attempts where payment_checkout_attempt_id=coalesce((p_facts->>'attemptId')::uuid,e.payment_checkout_attempt_id) for update;
 if not found then update public.payment_provider_events set processing_state='unmatched',processed_at=now() where payment_provider_event_id=e.payment_provider_event_id; raise exception 'Payment attempt is unmatched'; end if;
 select * into r from public.payment_requests where payment_request_id=a.payment_request_id for update;
 if upper(coalesce(p_facts->>'currency',''))<>'USD' or v_amount<=0 or (v_kind='receipt' and v_amount<>a.principal_amount) or coalesce(p_facts->>'merchantId','')<>coalesce(p_facts->>'expectedMerchantId',p_facts->>'merchantId','') then raise exception 'Provider amount, currency, or merchant mismatch'; end if;
 v_effect_key:=e.provider||':'||coalesce(e.provider_object_id,e.provider_event_id)||':'||v_kind;
 if exists(select 1 from public.payment_transactions where provider_reference=v_effect_key) then update public.payment_provider_events set processing_state='duplicate',processed_at=now() where payment_provider_event_id=e.payment_provider_event_id; return jsonb_build_object('state','duplicate'); end if;
 insert into public.payment_transactions(payment_reference,project_id,payment_request_id,payment_checkout_attempt_id,kind,status,principal_amount,customer_fee,merchant_fee,method,source,occurred_at,actor_type,provider_reference,customer_notice_policy,customer_notice_state,payload_digest,normalized_facts)
 values(public.generate_payment_reference(),a.project_id,r.payment_request_id,a.payment_checkout_attempt_id,v_kind,v_status,case when v_kind in ('refund','reversal','void') then -v_amount else v_amount end,0,(p_facts->>'merchantFeeCents')::bigint/100.0,a.method,case when e.provider='stripe' then 'stripe' else 'paypal' end,e.event_occurred_at,'provider',v_effect_key,case when v_kind='receipt' and v_status='confirmed' then 'required' when v_kind in ('refund','reversal') and v_status in ('confirmed','resolved') then 'required' when v_kind in ('dispute','correction') then 'optional' else 'none' end,'queued',e.payload_digest,p_facts) returning * into t;
 if v_kind='receipt' and v_status='confirmed' then
   perform 1
   from public.project_payment_records
   where project_id = a.project_id
     and status not in ('waived', 'canceled')
   order by case payment_kind when 'deposit' then 1 else 2 end,
            project_payment_record_id
   for update;
   select coalesce(sum(outstanding_amount), 0)
   into v_project_outstanding
   from public.project_payment_records
   where project_id = a.project_id
     and status not in ('waived', 'canceled');
   v_remaining:=least(v_amount,v_project_outstanding);
   for o in select * from public.project_payment_records where project_id=a.project_id and status not in ('waived','canceled') order by case payment_kind when 'deposit' then 1 else 2 end for update loop exit when v_remaining<=0;v_alloc:=least(v_remaining,o.outstanding_amount);if v_alloc>0 then v_seq:=v_seq+1;insert into public.payment_transaction_allocations(payment_transaction_id,obligation_id,allocated_principal,sequence) values(t.payment_transaction_id,o.project_payment_record_id,v_alloc,v_seq);v_remaining:=v_remaining-v_alloc;end if;end loop;
   if v_amount>v_project_outstanding then insert into public.payment_exceptions(project_id,payment_transaction_id,payment_provider_event_id,exception_type,urgency,amount,summary) values(a.project_id,t.payment_transaction_id,e.payment_provider_event_id,'overpayment','urgent',v_amount-v_project_outstanding,'Provider payment exceeds the complete project balance');end if;
   update public.payment_checkout_attempts set status='paid',resolved_at=now(),last_verified_state=e.event_type where payment_checkout_attempt_id=a.payment_checkout_attempt_id;
   update public.payment_requests set status='fulfilled',fulfilled_at=now(),invalidated_at=now(),token_ciphertext=null,token_iv=null,token_key_version=null where payment_request_id=r.payment_request_id;
   update public.payment_intentions set state='fulfilled',fulfilled_at=now() where payment_request_id=r.payment_request_id and state='active';
 elsif v_kind<>'receipt' and v_status in ('confirmed','resolved') then
   select * into original from public.payment_transactions where project_id=a.project_id and kind='receipt' and status='confirmed' order by occurred_at desc limit 1;
   v_remaining:=v_amount;
   if original.payment_transaction_id is not null then
     for x in select * from public.payment_transaction_allocations pa where pa.payment_transaction_id=original.payment_transaction_id order by pa.sequence desc loop
       exit when v_remaining<=0;v_alloc:=least(abs(x.allocated_principal),v_remaining);v_seq:=v_seq+1;
       insert into public.payment_transaction_allocations(payment_transaction_id,obligation_id,allocated_principal,sequence) values(t.payment_transaction_id,x.obligation_id,-v_alloc,v_seq);v_remaining:=v_remaining-v_alloc;
     end loop;
   end if;
   insert into public.payment_exceptions(project_id,payment_transaction_id,payment_provider_event_id,exception_type,urgency,amount,summary) values(a.project_id,t.payment_transaction_id,e.payment_provider_event_id,'adjustment_reopened_balance','urgent',v_amount,'Provider adjustment reopened a project balance');
 else
   update public.payment_checkout_attempts set status=case when v_status='pending' then 'processing' else 'failed' end,resolved_at=case when v_status='failed' then now() else null end,last_verified_state=e.event_type where payment_checkout_attempt_id=a.payment_checkout_attempt_id;
 end if;
 perform public.recompute_project_payment_obligations(a.project_id);
 update public.projects p set status=case when p.status='awaiting_deposit' and not exists(select 1 from public.project_payment_records o2 where o2.project_id=p.project_id and o2.payment_kind='deposit' and o2.outstanding_amount>0 and o2.status not in ('waived','canceled')) then case when exists(select 1 from public.project_payment_records o2 where o2.project_id=p.project_id and o2.payment_kind='final_payment' and o2.outstanding_amount>0 and o2.status not in ('waived','canceled')) then 'booked'::public.project_status else 'final_prep'::public.project_status end when p.status='awaiting_final_payment' and not exists(select 1 from public.project_payment_records o2 where o2.project_id=p.project_id and o2.outstanding_amount>0 and o2.status not in ('waived','canceled')) then 'final_prep'::public.project_status else p.status end,booked_at=case when p.status='awaiting_deposit' then coalesce(p.booked_at,now()) else p.booked_at end,updated_at=now() where p.project_id=a.project_id and p.status not in ('completed','canceled') and v_kind='receipt' and v_status='confirmed';
 update public.payment_provider_events set processing_state='processed',payment_checkout_attempt_id=a.payment_checkout_attempt_id,payment_transaction_id=t.payment_transaction_id,processed_at=now() where payment_provider_event_id=e.payment_provider_event_id;
 perform public.create_payment_activity(a.project_id,case when v_kind='receipt' then 'Payment confirmed' else 'Payment adjusted' end,initcap(replace(v_kind,'_',' '))||' '||t.payment_reference||' was recorded.','provider',jsonb_build_object('payment_reference',t.payment_reference,'method',a.method,'principal_amount',t.principal_amount,'provider_event_id',e.payment_provider_event_id),null);
 if t.customer_notice_policy='required' then insert into public.payment_message_deliveries(project_id,payment_request_id,payment_transaction_id,delivery_kind,occurrence_key,principal_amount,status) values(a.project_id,r.payment_request_id,t.payment_transaction_id,case when v_kind='receipt' then 'receipt' else 'adjustment_notice' end,case when v_kind='receipt' then 'receipt:' else 'adjustment:' end||t.payment_transaction_id,abs(t.principal_amount),'queued');end if;
 return jsonb_build_object('state','processed','transactionId',t.payment_transaction_id,'paymentReference',t.payment_reference);
exception when others then update public.payment_provider_events set processing_state='failed',processing_error=left(sqlerrm,300),processed_at=now() where payment_provider_event_id=p_provider_event_id;return jsonb_build_object('state','failed','error','reconciliation_failed');end; $$;
revoke all on function public.reconcile_payment_event(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.reconcile_payment_event(uuid,jsonb) to service_role;

-- Final server-backed payment list definition.
create or replace function public.list_payment_obligations(
  p_search text default null,
  p_kind text default null,
  p_state text default null,
  p_method text default null,
  p_due_timing text default null,
  p_sort text default 'event_date',
  p_direction text default 'asc',
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare v_rows jsonb; v_total bigint;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
  select count(*) into v_total
  from public.project_payment_records o join public.projects p on p.project_id=o.project_id
  left join public.contacts c on c.contact_id=p.primary_contact_id
  where o.status<>'canceled'
    and (p_search is null or p_search='' or p.project_name ilike '%'||p_search||'%' or trim(concat(c.first_name,' ',c.last_name)) ilike '%'||p_search||'%' or c.email ilike '%'||p_search||'%')
    and (p_kind is null or o.payment_kind=p_kind)
    and (p_state is null or o.fulfillment_state=p_state)
    and (p_method is null or o.last_method=p_method or o.last_intention_method=p_method)
    and (p_due_timing is null or (p_due_timing='overdue' and o.due_date<current_date and o.outstanding_amount>0) or (p_due_timing='upcoming' and o.due_date>=current_date));
  with filtered as (
    select o.*, p.project_name, p.event_date, p.primary_contact_id,
      trim(concat(c.first_name,' ',c.last_name)) customer_name, c.email customer_email,
      exists(select 1 from public.payment_exceptions e where e.obligation_id=o.project_payment_record_id and e.state<>'resolved') has_exception,
      exists(select 1 from public.payment_message_deliveries d where d.obligation_id=o.project_payment_record_id and d.status in ('temporary_failed','permanent_failed','delivery_unknown')) has_delivery_issue
    from public.project_payment_records o join public.projects p on p.project_id=o.project_id
    left join public.contacts c on c.contact_id=p.primary_contact_id
    where o.status<>'canceled'
      and (p_search is null or p_search='' or p.project_name ilike '%'||p_search||'%' or trim(concat(c.first_name,' ',c.last_name)) ilike '%'||p_search||'%' or c.email ilike '%'||p_search||'%')
      and (p_kind is null or o.payment_kind=p_kind)
      and (p_state is null or o.fulfillment_state=p_state)
      and (p_method is null or o.last_method=p_method or o.last_intention_method=p_method)
      and (p_due_timing is null or (p_due_timing='overdue' and o.due_date<current_date and o.outstanding_amount>0) or (p_due_timing='upcoming' and o.due_date>=current_date))
  ), paged as (
    select * from filtered order by
      case when p_sort='event_date' and p_direction='asc' then event_date end asc nulls last,
      case when p_sort='event_date' and p_direction='desc' then event_date end desc nulls last,
      case when p_sort='due_date' and p_direction='asc' then due_date end asc nulls last,
      case when p_sort='due_date' and p_direction='desc' then due_date end desc nulls last,
      created_at desc
    limit least(greatest(p_page_size,1),100) offset greatest(p_page-1,0)*least(greatest(p_page_size,1),100)
  )
  select coalesce(jsonb_agg(to_jsonb(paged)),'[]'::jsonb) into v_rows from paged;
  return jsonb_build_object('rows',v_rows,'total',v_total,'page',greatest(p_page,1),'pageSize',least(greatest(p_page_size,1),100));
end;
$$;
revoke all on function public.list_payment_obligations(text,text,text,text,text,text,text,integer,integer) from public, anon;
grant execute on function public.list_payment_obligations(text,text,text,text,text,text,text,integer,integer) to authenticated;

-- Operational health and secret-only minimization retain immutable financial evidence.
create or replace function public.get_payment_operational_health()
returns jsonb language plpgsql security definer set search_path='' stable as $$
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
  return jsonb_build_object(
    'providerEvents',jsonb_build_object('failed',(select count(*) from public.payment_provider_events where processing_state='failed'),'unmatched',(select count(*) from public.payment_provider_events where processing_state='unmatched'),'receivedStale',(select count(*) from public.payment_provider_events where processing_state='received' and received_at<now()-interval '10 minutes')),
    'checkoutAttempts',jsonb_build_object('stale',(select count(*) from public.payment_checkout_attempts where status in ('creating','active','processing') and expires_at<now())),
    'deliveries',jsonb_build_object('failed',(select count(*) from public.payment_message_deliveries where status in ('temporary_failed','permanent_failed')),'unknown',(select count(*) from public.payment_message_deliveries where status='delivery_unknown'),'claimedStale',(select count(*) from public.payment_message_deliveries where status='claimed' and claimed_at<now()-interval '30 minutes')),
    'exceptions',jsonb_build_object('urgentOpen',(select count(*) from public.payment_exceptions where urgency='urgent' and state<>'resolved')),
    'aggregateParity',jsonb_build_object('mismatches',(select count(*) from public.project_payment_records o where abs(o.credited_principal-coalesce((select sum(a.allocated_principal) from public.payment_transaction_allocations a join public.payment_transactions t using(payment_transaction_id) where a.obligation_id=o.project_payment_record_id and t.status in ('confirmed','resolved')),0))>.005)),
    'generatedAt',now()
  );
end; $$;
revoke all on function public.get_payment_operational_health() from public,anon;
grant execute on function public.get_payment_operational_health() to authenticated;

create or replace function public.purge_expired_payment_secrets(p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_requests integer;v_checkouts integer;v_provider integer;v_transactions integer;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  update public.payment_requests r set token_ciphertext=null,token_iv=null,token_key_version=null
  where (r.status not in ('draft','active') or r.invalidated_at<p_now) and (r.token_ciphertext is not null or r.token_iv is not null);
  get diagnostics v_requests=row_count;
  update public.payment_checkout_attempts a set provider_client_token=null,provider_handoff_url=null
  where a.expires_at<p_now and (a.provider_client_token is not null or a.provider_handoff_url is not null);
  get diagnostics v_checkouts=row_count;
  update public.payment_provider_events e set normalized_facts=jsonb_strip_nulls(jsonb_build_object('attemptId',e.normalized_facts->'attemptId','kind',e.normalized_facts->'kind','status',e.normalized_facts->'status','principalCents',e.normalized_facts->'principalCents','currency',e.normalized_facts->'currency','providerObjectId',e.normalized_facts->'providerObjectId'))
  where e.received_at<p_now-interval '30 days' and not exists(select 1 from public.payment_legal_holds h where h.project_id=(select a.project_id from public.payment_checkout_attempts a where a.payment_checkout_attempt_id=e.payment_checkout_attempt_id) and h.action='placed' and not exists(select 1 from public.payment_legal_holds r where r.project_id=h.project_id and r.hold_type=h.hold_type and r.action='released' and r.created_at>h.created_at));
  get diagnostics v_provider=row_count;
  update public.payment_transactions t set normalized_facts='{}'::jsonb
  where t.retention_eligible_at is not null and t.retention_eligible_at<=p_now and t.normalized_facts<>'{}'::jsonb and not exists(select 1 from public.payment_legal_holds h where h.project_id=t.project_id and h.action='placed' and not exists(select 1 from public.payment_legal_holds r where r.project_id=h.project_id and r.hold_type=h.hold_type and r.action='released' and r.created_at>h.created_at));
  get diagnostics v_transactions=row_count;
  return jsonb_build_object('requests',v_requests,'checkouts',v_checkouts,'providerEvents',v_provider,'transactions',v_transactions);
end; $$;
revoke all on function public.purge_expired_payment_secrets(timestamptz) from public,anon,authenticated;
grant execute on function public.purge_expired_payment_secrets(timestamptz) to service_role;

-- Final secret cleanup never mutates immutable transaction evidence.
create or replace function public.purge_expired_payment_secrets(p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_requests integer;v_checkouts integer;v_provider integer;v_transactions integer:=0;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  update public.payment_requests r set token_ciphertext=null,token_iv=null,token_key_version=null
  where (r.status not in ('draft','active') or r.invalidated_at<p_now) and (r.token_ciphertext is not null or r.token_iv is not null);
  get diagnostics v_requests=row_count;
  update public.payment_checkout_attempts a set provider_client_token=null,provider_handoff_url=null
  where a.expires_at<p_now and (a.provider_client_token is not null or a.provider_handoff_url is not null);
  get diagnostics v_checkouts=row_count;
  update public.payment_provider_events e set normalized_facts=jsonb_strip_nulls(jsonb_build_object('attemptId',e.normalized_facts->'attemptId','kind',e.normalized_facts->'kind','status',e.normalized_facts->'status','principalCents',e.normalized_facts->'principalCents','currency',e.normalized_facts->'currency','providerObjectId',e.normalized_facts->'providerObjectId'))
  where e.received_at<p_now-interval '30 days' and not exists(select 1 from public.payment_legal_holds h where h.project_id=(select a.project_id from public.payment_checkout_attempts a where a.payment_checkout_attempt_id=e.payment_checkout_attempt_id) and h.action='placed' and not exists(select 1 from public.payment_legal_holds r where r.project_id=h.project_id and r.hold_type=h.hold_type and r.action='released' and r.created_at>h.created_at));
  get diagnostics v_provider=row_count;
  -- Immutable financial transaction rows are never updated or deleted here.
  return jsonb_build_object('requests',v_requests,'checkouts',v_checkouts,'providerEvents',v_provider,'transactions',v_transactions);
end; $$;
revoke all on function public.purge_expired_payment_secrets(timestamptz) from public,anon,authenticated;
grant execute on function public.purge_expired_payment_secrets(timestamptz) to service_role;

-- Install the reminder processor only after its Vault inputs exist. Collection and
-- reminders remain disabled in payment_collection_settings until a florist enables them.
create or replace function public.enqueue_payment_message_processor(p_delivery_id uuid default null)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_project_url text; v_service_role_key text; v_cron_secret text; v_request_id bigint;
begin
  select nullif(decrypted_secret,'') into v_project_url from vault.decrypted_secrets where name='project_url' limit 1;
  select nullif(decrypted_secret,'') into v_service_role_key from vault.decrypted_secrets where name='service_role_key' limit 1;
  select nullif(decrypted_secret,'') into v_cron_secret from vault.decrypted_secrets where name='payment_cron_secret' limit 1;
  if v_project_url is null then raise exception 'Payment processor Vault project_url is missing'; end if;
  if v_service_role_key is null then raise exception 'Payment processor Vault service_role_key is missing'; end if;
  if v_cron_secret is null then raise exception 'Payment processor Vault payment_cron_secret is missing'; end if;
  v_project_url:=regexp_replace(v_project_url,'/+$','');
  if v_project_url !~ '^https://[a-z0-9-]+\.supabase\.co$' then raise exception 'Payment processor Vault project_url is invalid'; end if;
  select net.http_post(url:=v_project_url||'/functions/v1/process-payment-messages',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_service_role_key,'x-cron-secret',v_cron_secret),body:=case when p_delivery_id is null then '{}'::jsonb else jsonb_build_object('requestedDeliveryId',p_delivery_id::text) end,timeout_milliseconds:=10000) into v_request_id;
  return v_request_id;
end; $$;
revoke all on function public.enqueue_payment_message_processor(uuid) from public,anon,authenticated;
grant execute on function public.enqueue_payment_message_processor(uuid) to service_role;

do $payment_cron$
declare v_job_id bigint;
begin
  if to_regclass('cron.job') is null or to_regclass('vault.decrypted_secrets') is null then
    raise warning 'Payment reminder Cron not installed: pg_cron/pg_net/Vault preflight failed';
    return;
  end if;
  if not exists(select 1 from vault.decrypted_secrets where name='project_url' and nullif(decrypted_secret,'') is not null)
     or not exists(select 1 from vault.decrypted_secrets where name='service_role_key' and nullif(decrypted_secret,'') is not null)
     or not exists(select 1 from vault.decrypted_secrets where name='payment_cron_secret' and nullif(decrypted_secret,'') is not null) then
    raise warning 'Payment reminder Cron not installed: project_url, service_role_key, and payment_cron_secret Vault values are required';
    return;
  end if;
  select jobid into v_job_id from cron.job where jobname='process-project-payment-messages-15m';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule('process-project-payment-messages-15m','*/15 * * * *',$cron_body$
    select public.enqueue_payment_message_processor(null);
  $cron_body$);
end $payment_cron$;

commit;
