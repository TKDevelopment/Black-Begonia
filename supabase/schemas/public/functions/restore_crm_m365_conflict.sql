create or replace function public.restore_crm_m365_conflict(p_conflict_id uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_association public.crm_m365_event_associations%rowtype;
  v_status text;
begin
  if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id
    where p.id=p_actor and p.is_active and r.role='admin') then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select a.* into v_association from public.crm_m365_sync_conflicts f
    join public.crm_m365_event_associations a on a.association_id=f.association_id
    join public.crm_m365_calendar_connections c on c.connection_id=a.connection_id
    where f.conflict_id=p_conflict_id and f.status='open' and c.status='connected'
    for update of f,a;
  if v_association.association_id is null then
    raise exception 'calendar_conflict_not_found' using errcode='P0002';
  end if;
  update public.crm_m365_sync_conflicts set status='restoring',reviewed_by=p_actor,
    reviewed_at=now() where conflict_id=p_conflict_id;
  insert into public.crm_m365_calendar_outbox(source_type,source_id)
    values(v_association.source_type,v_association.source_id)
    on conflict(source_type,source_id) do update set
      generation=public.crm_m365_calendar_outbox.generation+1,
      state='pending',next_attempt_at=now(),lease_expires_at=null;
  return jsonb_build_object('status','queued','conflictId',p_conflict_id);
end;
$$;
revoke all on function public.restore_crm_m365_conflict(uuid,uuid) from public, anon, authenticated;
grant execute on function public.restore_crm_m365_conflict(uuid,uuid) to service_role;
