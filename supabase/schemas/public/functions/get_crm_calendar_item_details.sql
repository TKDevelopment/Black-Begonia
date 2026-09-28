create or replace function public.get_crm_calendar_item_details(p_source_type text,p_source_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_item jsonb; v_connection uuid; v_graph_id text;
begin
  if not public.is_internal_crm_user() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_source_type='microsoft' then
    if p_source_id !~* '^microsoft:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:.+$' then
      raise exception 'invalid_calendar_identity' using errcode='22023';
    end if;
    v_connection:=split_part(p_source_id,':',2)::uuid;
    v_graph_id:=substring(p_source_id from 48);
    select jsonb_build_object('id',p_source_id,'sourceType','microsoft','sourceId',null,
      'title',i.display_title,
      'start',case when i.is_all_day then to_jsonb(i.local_start_date::text) else to_jsonb(i.start_at) end,
      'end',case when i.is_all_day then to_jsonb(i.local_end_date::text) else to_jsonb(i.end_at) end,
      'allDay',i.is_all_day,'localDate',i.local_start_date,
      'status',case when i.is_private then null when i.provider_status='canceled' then 'Canceled' else null end,
      'isInactive',not i.is_private and i.provider_status='canceled',
      'colorType','microsoft','destination',null,'isPrivate',i.is_private,
      'venueName',case when i.is_private then null else i.location end,
      'outlookWebUrl',i.outlook_web_url,'timezone',c.business_timezone)
      into v_item from public.crm_m365_imported_occurrences i
      join public.crm_m365_calendar_connections c on c.connection_id=i.connection_id
      where i.connection_id=v_connection and i.graph_occurrence_id=v_graph_id
        and c.status in ('connected','action_required')
        and not exists(select 1 from public.crm_m365_event_associations a
          where a.connection_id=i.connection_id and a.graph_event_id=i.graph_occurrence_id);
  elsif p_source_type in ('lead_event','project_event','consultation','installment','workshop')
    and p_source_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_item:=public.crm_calendar_source_item(p_source_type,p_source_id::uuid);
  else
    raise exception 'invalid_calendar_identity' using errcode='22023';
  end if;
  if v_item is null then raise exception 'calendar_item_not_found' using errcode='P0002'; end if;
  return v_item;
end;
$$;
revoke all on function public.get_crm_calendar_item_details(text,text) from public, anon, authenticated;
grant execute on function public.get_crm_calendar_item_details(text,text) to authenticated;
