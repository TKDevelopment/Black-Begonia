create or replace function public.enqueue_crm_calendar_source(p_source_type text, p_source_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_source_id is null or p_source_type not in
    ('lead_event','project_event','consultation','installment','workshop') then
    raise exception 'invalid_calendar_source' using errcode='22023';
  end if;
  insert into public.crm_m365_calendar_outbox(source_type,source_id)
  values(p_source_type,p_source_id)
  on conflict(source_type,source_id) do update set
    generation=public.crm_m365_calendar_outbox.generation+1,
    changed_at=now(), attempt_count=0, next_attempt_at=now(), last_error_code=null,
    state=case when public.crm_m365_calendar_outbox.state='blocked_conflict'
      then 'blocked_conflict' else 'pending' end,
    lease_expires_at=null;
end;
$$;
revoke all on function public.enqueue_crm_calendar_source(text,uuid) from public, anon, authenticated;
grant execute on function public.enqueue_crm_calendar_source(text,uuid) to service_role;
