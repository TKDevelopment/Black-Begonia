create or replace function public.ack_crm_m365_outbox(p_outbox_id uuid,p_generation bigint,
  p_success boolean,p_error_code text default null,p_retry_seconds integer default 60)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_success then
    delete from public.crm_m365_calendar_outbox
      where outbox_id=p_outbox_id and generation=p_generation;
    update public.crm_m365_calendar_outbox set state='pending',lease_expires_at=null
      where outbox_id=p_outbox_id and generation<>p_generation;
  else
    update public.crm_m365_calendar_outbox set state='pending',lease_expires_at=null,
      last_error_code=coalesce(p_error_code,'export_failed'),
      next_attempt_at=now()+make_interval(secs=>least(3600,greatest(15,p_retry_seconds)))
      where outbox_id=p_outbox_id and generation=p_generation;
  end if;
end;
$$;
revoke all on function public.ack_crm_m365_outbox(uuid,bigint,boolean,text,integer) from public, anon, authenticated;
grant execute on function public.ack_crm_m365_outbox(uuid,bigint,boolean,text,integer) to service_role;
