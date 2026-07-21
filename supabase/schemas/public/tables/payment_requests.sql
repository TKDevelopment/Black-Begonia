create table public.payment_requests (
  payment_request_id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(project_id) on delete cascade,
  request_kind text not null check (request_kind in ('deposit','final_payment','consolidated')),
  status text not null default 'draft' check (status in ('draft','active','fulfilled','superseded','revoked','canceled')),
  token_digest text not null unique,
  token_ciphertext text null,
  token_iv text null,
  token_key_version text null,
  principal_amount numeric(12,2) not null check (principal_amount > 0),
  deposit_amount numeric(12,2) not null default 0,
  final_amount numeric(12,2) not null default 0,
  proposal_snapshot_id uuid null references public.project_proposal_invoice_snapshots(project_proposal_invoice_snapshot_id) on delete set null,
  proposal_version integer null,
  original_recipient_contact_id uuid null references public.contacts(contact_id) on delete set null,
  original_recipient_email text null,
  recipient_fallback_used boolean not null default false,
  cash_instructions text not null default '',
  check_instructions text not null default '',
  supersedes_request_id uuid null references public.payment_requests(payment_request_id) on delete set null,
  superseded_by_request_id uuid null references public.payment_requests(payment_request_id) on delete set null,
  initial_delivery_state text not null default 'not_requested',
  command_key uuid not null unique,
  issued_at timestamptz not null default now(),
  activated_at timestamptz null,
  invalidated_at timestamptz null,
  fulfilled_at timestamptz null,
  revoked_at timestamptz null,
  retention_eligible_at timestamptz null default (now() + interval '7 years'),
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint payment_requests_breakdown_check check (deposit_amount + final_amount = principal_amount),
  constraint payment_requests_inactive_secret_check check (status in ('draft','active') or (token_ciphertext is null and invalidated_at is not null))
);
create unique index uq_payment_requests_active_project_kind on public.payment_requests(project_id, request_kind) where status='active';
alter table public.payment_requests enable row level security;
create policy payment_requests_internal_select on public.payment_requests for select to authenticated using (public.is_internal_crm_user());
revoke all on public.payment_requests from anon;
revoke select on public.payment_requests from authenticated;
grant select(payment_request_id,project_id,request_kind,status,principal_amount,deposit_amount,final_amount,proposal_snapshot_id,proposal_version,original_recipient_contact_id,original_recipient_email,recipient_fallback_used,cash_instructions,check_instructions,supersedes_request_id,superseded_by_request_id,initial_delivery_state,issued_at,activated_at,invalidated_at,fulfilled_at,revoked_at,retention_eligible_at,created_by,created_at) on public.payment_requests to authenticated;
