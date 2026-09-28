create or replace function public.is_calendar_integration_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p
    join public.user_roles r on r.user_id = p.id
    where p.id = auth.uid() and p.is_active and r.role = 'admin');
$$;
revoke all on function public.is_calendar_integration_admin() from public, anon, authenticated;
grant execute on function public.is_calendar_integration_admin() to authenticated;
