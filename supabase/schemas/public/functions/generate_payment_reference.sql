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
