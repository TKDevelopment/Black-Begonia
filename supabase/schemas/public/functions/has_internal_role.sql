
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _uid
      and ur.role in ('admin', 'staff')
  );
