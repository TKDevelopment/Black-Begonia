
  select exists (
    select 1
    from public.profiles p
    join public.user_roles ur
      on ur.user_id = p.id
    where p.id = auth.uid()
      and p.is_active = true
      and ur.role in ('admin', 'staff')
  );
