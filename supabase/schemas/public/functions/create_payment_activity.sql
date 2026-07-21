create or replace function public.create_payment_activity(
  p_project_id uuid,
  p_label text,
  p_description text,
  p_actor_type text,
  p_metadata jsonb default '{}'::jsonb,
  p_actor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if p_metadata ?| array['token','url','raw_payload','provider_payload','email_body'] then
    raise exception 'Sensitive payment activity metadata is prohibited';
  end if;
  insert into public.activity_log(entity_type, entity_id, activity_type, activity_label, description, performed_by, metadata)
  values ('project'::public.activity_entity_type, p_project_id, 'payment_recorded'::public.activity_type,
          p_label, p_description, p_actor_id,
          coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('actor_type', p_actor_type))
  returning activity_log_id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_payment_activity(uuid,text,text,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.create_payment_activity(uuid,text,text,text,jsonb,uuid) to service_role;
