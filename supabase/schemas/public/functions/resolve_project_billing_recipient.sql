create or replace function public.resolve_project_billing_recipient(p_project_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  with candidate as (
    select c.contact_id, c.email,
           (c.contact_id <> p.primary_contact_id) as fallback_used,
           row_number() over(order by (c.contact_id = p.primary_contact_id) desc, pc.is_primary desc, pc.created_at) as rank
    from public.projects p
    join public.project_contacts pc on pc.project_id=p.project_id
    join public.contacts c on c.contact_id=pc.contact_id
    where p.project_id=p_project_id and nullif(btrim(c.email),'') is not null and not c.is_archived
  )
  select coalesce((select jsonb_build_object('contact_id',contact_id,'email',lower(email),'fallback_used',fallback_used) from candidate where rank=1),
                  jsonb_build_object('contact_id',null,'email',null,'fallback_used',false));
$$;
revoke all on function public.resolve_project_billing_recipient(uuid) from public, anon;
grant execute on function public.resolve_project_billing_recipient(uuid) to authenticated, service_role;
