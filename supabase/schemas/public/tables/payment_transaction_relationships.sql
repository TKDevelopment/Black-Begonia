create table public.payment_transaction_relationships (
  payment_transaction_relationship_id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(project_id) on delete restrict,
  parent_transaction_id uuid not null references public.payment_transactions(payment_transaction_id) on delete restrict,
  child_transaction_id uuid not null references public.payment_transactions(payment_transaction_id) on delete restrict,
  relationship_type text not null default 'adjusts' check (relationship_type = 'adjusts'),
  evidence_source text not null check (evidence_source in ('provider_correlation','request_correlation','checkout_correlation','migration_exact_match','authorized_resolution')),
  created_at timestamptz not null default now(),
  check (parent_transaction_id <> child_transaction_id)
);

create unique index uq_payment_transaction_relationships_adjustment
  on public.payment_transaction_relationships(child_transaction_id)
  where relationship_type = 'adjusts';
create index idx_payment_transaction_relationships_parent
  on public.payment_transaction_relationships(parent_transaction_id, child_transaction_id);

create or replace function public.validate_payment_transaction_relationship()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_parent public.payment_transactions;
  v_child public.payment_transactions;
begin
  select * into v_parent from public.payment_transactions where payment_transaction_id = new.parent_transaction_id;
  select * into v_child from public.payment_transactions where payment_transaction_id = new.child_transaction_id;
  if v_parent.payment_transaction_id is null or v_child.payment_transaction_id is null then
    raise exception 'Related payment transaction is unavailable';
  end if;
  if v_parent.project_id <> new.project_id or v_child.project_id <> new.project_id then
    raise exception 'Related payment transactions must belong to the same project';
  end if;
  if v_parent.kind <> 'receipt' or v_child.kind = 'receipt' then
    raise exception 'Adjustment relationships require a receipt parent and adjustment child';
  end if;
  return new;
end;
$$;

create trigger trg_payment_transaction_relationships_validate
before insert on public.payment_transaction_relationships
for each row execute function public.validate_payment_transaction_relationship();

create trigger trg_payment_transaction_relationships_immutable
before update or delete on public.payment_transaction_relationships
for each row execute function public.prevent_payment_financial_mutation();

alter table public.payment_transaction_relationships enable row level security;
create policy payment_transaction_relationships_internal_select
on public.payment_transaction_relationships for select to authenticated
using (public.is_internal_crm_user());
revoke all on public.payment_transaction_relationships from public, anon, authenticated;
grant select on public.payment_transaction_relationships to authenticated;
