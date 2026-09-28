create or replace function public.get_crm_m365_export_projection(p_source_type text, p_source_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_item jsonb; v_eligible boolean:=false; v_zone text;
begin
  v_item:=public.crm_calendar_source_item(p_source_type,p_source_id);
  if v_item is null then return jsonb_build_object('eligible',false); end if;
  if p_source_type='lead_event' then
    select l.converted_project_id is null and l.status::text <> 'declined'
      into v_eligible from public.leads l where l.lead_id=p_source_id;
  elsif p_source_type='project_event' then
    select p.status::text <> 'canceled' into v_eligible
      from public.projects p where p.project_id=p_source_id;
  elsif p_source_type='consultation' then
    select l.consultation_scheduled_at is not null into v_eligible
      from public.leads l where l.lead_id=p_source_id;
  elsif p_source_type='installment' then
    select r.status not in ('canceled','waived') into v_eligible
      from public.project_payment_records r where r.project_payment_record_id=p_source_id;
  elsif p_source_type='workshop' then
    select o.status in ('published_open','registration_closed','completed','archived')
      and o.published_at is not null into v_eligible
      from public.workshop_occurrences o where o.workshop_occurrence_id=p_source_id;
  end if;
  if not coalesce(v_eligible,false) then return jsonb_build_object('eligible',false); end if;
  select c.business_timezone into v_zone from public.crm_m365_calendar_connections c
    where c.status in ('connected','action_required') order by c.connected_at desc limit 1;
  return jsonb_build_object('eligible',true,'sourceType',p_source_type,'sourceId',p_source_id,
    'title',v_item->>'title','start',v_item->>'start','end',v_item->>'end',
    'allDay',v_item->'allDay','timezone',coalesce(v_item->>'timezone',v_zone,'America/New_York'),
    'isInactive',v_item->'isInactive',
    'fingerprint',md5(concat_ws('|',v_item->>'title',v_item->>'start',v_item->>'end',
      v_item->>'allDay',v_item->>'isInactive')));
end;
$$;
revoke all on function public.get_crm_m365_export_projection(text,uuid) from public, anon, authenticated;
grant execute on function public.get_crm_m365_export_projection(text,uuid) to service_role;
