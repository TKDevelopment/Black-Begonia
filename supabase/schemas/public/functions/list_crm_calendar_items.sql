create or replace function public.list_crm_calendar_items(p_start_date date,p_end_date date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_crm jsonb; v_imported jsonb;
begin
  if not public.is_internal_crm_user() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_start_date is null or p_end_date is null or p_end_date<=p_start_date
    or p_end_date>p_start_date+62 then
    raise exception 'invalid_calendar_range' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(item - 'clientFirstName' - 'partnerFirstName' - 'serviceType'
      - 'guestCount' - 'venueName' - 'venueAddress' - 'paymentKind' - 'targetAmount'
      - 'creditedAmount' - 'outstandingAmount' - 'paidDate' - 'paymentMethod'
      - 'capacity' order by item->>'start',item->>'id'),'[]'::jsonb)
  into v_crm from (
    select public.crm_calendar_source_item('lead_event',l.lead_id) item
      from public.leads l where l.event_date>=p_start_date and l.event_date<p_end_date
        and l.converted_project_id is null
    union all select public.crm_calendar_source_item('project_event',p.project_id)
      from public.projects p where p.event_date>=p_start_date and p.event_date<p_end_date
    union all select public.crm_calendar_source_item('consultation',l.lead_id)
      from public.leads l where l.consultation_scheduled_at>=(p_start_date::timestamp at time zone 'America/New_York')
        and l.consultation_scheduled_at<(p_end_date::timestamp at time zone 'America/New_York')
    union all select public.crm_calendar_source_item('installment',r.project_payment_record_id)
      from public.project_payment_records r where r.due_date>=p_start_date and r.due_date<p_end_date
    union all select public.crm_calendar_source_item('workshop',o.workshop_occurrence_id)
      from public.workshop_occurrences o where o.local_start<p_end_date::timestamp
        and o.local_end>p_start_date::timestamp
  ) sources where item is not null;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id','microsoft:'||i.connection_id::text||':'||i.graph_occurrence_id,
    'sourceType','microsoft','sourceId',null,'title',i.display_title,
    'start',case when i.is_all_day then to_jsonb(i.local_start_date::text) else to_jsonb(i.start_at) end,
    'end',case when i.is_all_day then to_jsonb(i.local_end_date::text) else to_jsonb(i.end_at) end,
    'allDay',i.is_all_day,'localDate',i.local_start_date,
    'timezone',c.business_timezone,
    'status',case when i.is_private then null when i.provider_status='canceled' then 'Canceled' else null end,
    'isInactive',not i.is_private and i.provider_status='canceled',
    'colorType','microsoft','destination',null,'isPrivate',i.is_private,
    'isStale',c.status<>'connected' or coalesce(c.last_successful_sync_at<now()-interval '15 minutes',true))
    order by i.local_start_date,i.graph_occurrence_id),'[]'::jsonb)
  into v_imported
  from public.crm_m365_imported_occurrences i
  join public.crm_m365_calendar_connections c on c.connection_id=i.connection_id
  where c.status in ('connected','action_required')
    and i.local_start_date<p_end_date and i.local_end_date>p_start_date
    and not exists(select 1 from public.crm_m365_event_associations a
      where a.connection_id=i.connection_id and a.graph_event_id=i.graph_occurrence_id);
  return v_crm||v_imported;
end;
$$;
revoke all on function public.list_crm_calendar_items(date,date) from public, anon, authenticated;
grant execute on function public.list_crm_calendar_items(date,date) to authenticated;
