create or replace function public.list_crm_m365_conflicts(p_actor uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_rows jsonb;
begin
  if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id
    where p.id=p_actor and p.is_active and r.role='admin') then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('conflictId',f.conflict_id,
    'sourceType',a.source_type,'sourceId',a.source_id,
    'sourceTitle',public.crm_calendar_source_title(a.source_type,a.source_id),
    'changedFields',f.changed_fields,'remoteTitle',case when f.is_remote_private then null else f.remote_title end,
    'remoteStartAt',f.remote_start_at,'remoteEndAt',f.remote_end_at,
    'isRemotePrivate',f.is_remote_private,'detectedAt',f.detected_at,'status',f.status)
    order by f.detected_at desc),'[]'::jsonb) into v_rows
  from public.crm_m365_sync_conflicts f
  join public.crm_m365_event_associations a on a.association_id=f.association_id
  join public.crm_m365_calendar_connections c on c.connection_id=a.connection_id
  where c.status in ('connected','action_required') and f.status in ('open','restoring');
  return v_rows;
end;
$$;
revoke all on function public.list_crm_m365_conflicts(uuid) from public, anon, authenticated;
grant execute on function public.list_crm_m365_conflicts(uuid) to service_role;
