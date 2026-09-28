create or replace function public.requeue_crm_calendar_sources()
returns integer language plpgsql security definer set search_path = '' as $$
declare x record; v_count integer:=0;
begin
  for x in
    select 'lead_event'::text source_type, lead_id source_id from public.leads where event_date is not null
    union all select 'consultation', lead_id from public.leads where consultation_scheduled_at is not null
    union all select 'project_event', project_id from public.projects where event_date is not null
    union all select 'installment', project_payment_record_id from public.project_payment_records where due_date is not null
    union all select 'workshop', workshop_occurrence_id from public.workshop_occurrences
  loop
    perform public.enqueue_crm_calendar_source(x.source_type,x.source_id);
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.requeue_crm_calendar_sources() from public, anon, authenticated;
grant execute on function public.requeue_crm_calendar_sources() to service_role;
