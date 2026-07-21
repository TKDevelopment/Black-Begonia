create table public.payment_request_obligations (
  payment_request_id uuid not null references public.payment_requests(payment_request_id) on delete cascade,
  obligation_id uuid not null references public.project_payment_records(project_payment_record_id) on delete restrict,
  requested_amount numeric(12,2) not null check (requested_amount > 0),
  display_order smallint not null check (display_order between 1 and 2),
  primary key (payment_request_id, obligation_id),
  unique (payment_request_id, display_order)
);
alter table public.payment_request_obligations enable row level security;
create policy payment_request_obligations_internal_select on public.payment_request_obligations for select to authenticated using (public.is_internal_crm_user());
