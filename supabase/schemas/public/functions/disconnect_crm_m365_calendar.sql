create or replace function public.disconnect_crm_m365_calendar(p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id
    where p.id=p_actor and p.is_active and r.role='admin') then
    raise exception 'forbidden' using errcode='42501';
  end if;
  update public.crm_m365_calendar_connections set status='disconnected',
    disconnected_at=now(),lease_owner=null,lease_expires_at=null,updated_at=now()
    where status in ('connected','action_required') returning connection_id into v_id;
  if v_id is null then raise exception 'calendar_not_connected' using errcode='P0002'; end if;
  update public.crm_m365_sync_runs set status='failed',finished_at=now(),
    last_error_code='disconnected' where connection_id=v_id and status in ('queued','running');
  return jsonb_build_object('status','disconnected','staleMirrorWarning',true);
end;
$$;
revoke all on function public.disconnect_crm_m365_calendar(uuid) from public, anon, authenticated;
grant execute on function public.disconnect_crm_m365_calendar(uuid) to service_role;
