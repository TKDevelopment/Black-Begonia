create or replace function public.enqueue_crm_calendar_source_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_project uuid; v_contact uuid; x record;
begin
  if tg_table_name='leads' then
    v_id:=case when tg_op='DELETE' then old.lead_id else new.lead_id end;
    perform public.enqueue_crm_calendar_source('lead_event',v_id);
    perform public.enqueue_crm_calendar_source('consultation',v_id);
    v_project:=case when tg_op='DELETE' then old.converted_project_id else new.converted_project_id end;
    if v_project is not null then
      perform public.enqueue_crm_calendar_source('project_event',v_project);
      for v_id in select project_payment_record_id from public.project_payment_records
        where project_id=v_project loop
        perform public.enqueue_crm_calendar_source('installment',v_id);
      end loop;
    end if;
  elsif tg_table_name='projects' then
    v_id:=case when tg_op='DELETE' then old.project_id else new.project_id end;
    perform public.enqueue_crm_calendar_source('project_event',v_id);
    for x in select project_payment_record_id from public.project_payment_records
      where project_id=v_id loop
      perform public.enqueue_crm_calendar_source('installment',x.project_payment_record_id);
    end loop;
  elsif tg_table_name='project_payment_records' then
    v_id:=case when tg_op='DELETE' then old.project_payment_record_id else new.project_payment_record_id end;
    perform public.enqueue_crm_calendar_source('installment',v_id);
  elsif tg_table_name='workshop_occurrences' then
    v_id:=case when tg_op='DELETE' then old.workshop_occurrence_id else new.workshop_occurrence_id end;
    perform public.enqueue_crm_calendar_source('workshop',v_id);
  elsif tg_table_name='contacts' then
    v_contact:=case when tg_op='DELETE' then old.contact_id else new.contact_id end;
    for x in select distinct p.project_id from public.projects p
      left join public.project_contacts pc on pc.project_id=p.project_id
      where p.primary_contact_id=v_contact or pc.contact_id=v_contact loop
      perform public.enqueue_crm_calendar_source('project_event',x.project_id);
      for v_id in select project_payment_record_id from public.project_payment_records
        where project_id=x.project_id loop
        perform public.enqueue_crm_calendar_source('installment',v_id);
      end loop;
    end loop;
  elsif tg_table_name='project_contacts' then
    v_project:=case when tg_op='DELETE' then old.project_id else new.project_id end;
    perform public.enqueue_crm_calendar_source('project_event',v_project);
    for v_id in select project_payment_record_id from public.project_payment_records
      where project_id=v_project loop
      perform public.enqueue_crm_calendar_source('installment',v_id);
    end loop;
  end if;
  return null;
end;
$$;
revoke all on function public.enqueue_crm_calendar_source_change() from public, anon, authenticated;
