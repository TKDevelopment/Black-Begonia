create view public.workshop_financial_entries
with (security_invoker = true)
as
select
  'transaction'::text as source_type,
  t.workshop_payment_transaction_id as source_id,
  o.workshop_series_id,
  t.workshop_occurrence_id,
  t.occurred_at as entry_date,
  t.transaction_type as entry_category,
  case
    when t.transaction_type in (
      'refund','external_refund','fee','discount','dispute','reversal'
    ) then -abs(t.amount_minor)
    when t.transaction_type = 'correction' then t.amount_minor
    else t.amount_minor
  end as signed_amount_minor,
  t.currency,
  t.provider as method,
  t.state as transaction_state,
  t.payment_reference as traceable_reference
from public.workshop_payment_transactions t
join public.workshop_occurrences o using (workshop_occurrence_id)
union all
select
  'expense'::text,
  e.workshop_expense_id,
  coalesce(e.workshop_series_id, o.workshop_series_id),
  e.workshop_occurrence_id,
  e.incurred_on::timestamptz,
  e.expense_category,
  case when e.is_reversal then abs(e.amount_minor) else -abs(e.amount_minor) end,
  e.currency,
  'expense'::text,
  'recorded'::text,
  e.workshop_expense_id::text
from public.workshop_expenses e
left join public.workshop_occurrences o using (workshop_occurrence_id);

revoke all on public.workshop_financial_entries from anon;
grant select on public.workshop_financial_entries to authenticated;
