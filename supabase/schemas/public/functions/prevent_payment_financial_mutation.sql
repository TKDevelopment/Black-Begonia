create or replace function public.prevent_payment_financial_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'postgres'
     and current_setting('app.project_cascade_delete', true) = 'on' then
    return old;
  end if;

  raise exception 'Payment financial history is immutable';
end;
$$;
