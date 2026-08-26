create or replace function public.workshop_tax_rate_basis_points(p_tax_region text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case upper(btrim(coalesce(p_tax_region, '')))
    when 'RI' then 700
    when 'CT' then 635
    when 'MA' then 625
    else null
  end;
$$;

revoke all on function public.workshop_tax_rate_basis_points(text) from public;
