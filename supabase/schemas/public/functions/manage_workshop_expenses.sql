create or replace function public.manage_workshop_expenses(
  p_action text,
  p_payload jsonb,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_existing public.workshop_expenses;
  v_original public.workshop_expenses;
  v_reversal public.workshop_expenses;
  v_expense public.workshop_expenses;
  v_occurrence_id uuid;
  v_series_id uuid;
  v_amount bigint;
  v_category text;
  v_description text;
  v_receipt text;
begin
  if not public.is_internal_crm_user() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_command_key is null or p_action not in ('create','correct') then
    raise exception 'invalid_request';
  end if;
  select * into v_existing from public.workshop_expenses
  where command_key = p_command_key;
  if found then
    return jsonb_build_object(
      'replayed', true, 'expenseId', v_existing.workshop_expense_id
    );
  end if;
  v_occurrence_id := nullif(p_payload->>'occurrenceId', '')::uuid;
  v_series_id := nullif(p_payload->>'seriesId', '')::uuid;
  v_amount := nullif(p_payload->>'amountMinor', '')::bigint;
  v_category := btrim(coalesce(p_payload->>'category', ''));
  v_description := btrim(coalesce(p_payload->>'description', ''));
  v_receipt := nullif(btrim(coalesce(p_payload->>'receiptStoragePath', '')), '');
  if (v_occurrence_id is not null)::integer + (v_series_id is not null)::integer <> 1
    or v_amount is null or v_amount <= 0
    or upper(btrim(coalesce(p_payload->>'currency', ''))) <> 'USD'
    or v_category not in (
      'materials','venue','labor','marketing','travel','equipment','fees','other'
    )
    or char_length(v_description) not between 1 and 500
    or (v_receipt is not null and (
      v_receipt like '%..%' or v_receipt like '/%'
      or v_receipt not like 'workshop-receipts/%'
    ))
  then raise exception 'invalid_request'; end if;
  if p_action = 'correct' then
    select * into v_original from public.workshop_expenses
    where workshop_expense_id =
      nullif(p_payload->>'originalExpenseId', '')::uuid for update;
    if not found or v_original.is_reversal then raise exception 'not_found'; end if;
    insert into public.workshop_expenses(
      workshop_occurrence_id, workshop_series_id, expense_category,
      description, vendor_or_payee, note, amount_minor, currency, incurred_on,
      receipt_storage_path, command_key, correction_of_expense_id, is_reversal,
      created_by
    ) values (
      v_original.workshop_occurrence_id, v_original.workshop_series_id,
      v_original.expense_category, 'Reversal: '||v_original.description,
      v_original.vendor_or_payee, 'Correction reversal',
      v_original.amount_minor, v_original.currency, current_date,
      null, gen_random_uuid(), v_original.workshop_expense_id, true, v_actor
    ) returning * into v_reversal;
  end if;
  insert into public.workshop_expenses(
    workshop_occurrence_id, workshop_series_id, expense_category,
    description, vendor_or_payee, note, amount_minor, currency, incurred_on,
    receipt_storage_path, command_key, correction_of_expense_id, is_reversal,
    created_by
  ) values (
    v_occurrence_id, v_series_id, v_category, v_description,
    nullif(left(btrim(coalesce(p_payload->>'vendorOrPayee', '')), 160), ''),
    nullif(left(btrim(coalesce(p_payload->>'note', '')), 500), ''),
    v_amount, 'USD', (p_payload->>'expenseDate')::date, v_receipt,
    p_command_key, v_original.workshop_expense_id, false, v_actor
  ) returning * into v_expense;
  return jsonb_build_object(
    'replayed', false, 'expenseId', v_expense.workshop_expense_id,
    'reversalExpenseId', v_reversal.workshop_expense_id
  );
end;
$$;

revoke all on function public.manage_workshop_expenses(text,jsonb,uuid)
from public;
grant execute on function public.manage_workshop_expenses(text,jsonb,uuid)
to authenticated;
