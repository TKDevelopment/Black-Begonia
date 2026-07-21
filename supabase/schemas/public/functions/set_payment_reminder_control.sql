create or replace function public.set_payment_reminder_control(p_project_id uuid,p_obligation_id uuid,p_enabled boolean,p_paused_until timestamptz,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'A reason is required'; end if;
  update public.project_payment_records set reminder_enabled=p_enabled,reminder_paused_until=case when p_enabled then p_paused_until else null end,reminder_pause_reason=p_reason,reminder_pause_actor=auth.uid(),updated_at=now()
  where project_id=p_project_id and (p_obligation_id is null or project_payment_record_id=p_obligation_id) and status not in ('paid','waived','canceled');
  get diagnostics v_count=row_count;
  if v_count=0 then raise exception 'No eligible obligation was found'; end if;
  perform public.create_payment_activity(p_project_id,'Payment reminders updated',case when p_enabled then 'A florist resumed or scheduled payment reminders.' else 'A florist paused payment reminders.' end,'florist',jsonb_build_object('obligation_id',p_obligation_id,'enabled',p_enabled,'paused_until',p_paused_until,'reason',p_reason),auth.uid());
  return jsonb_build_object('updated',v_count);
end; $$;
revoke all on function public.set_payment_reminder_control(uuid,uuid,boolean,timestamptz,text) from public,anon;
grant execute on function public.set_payment_reminder_control(uuid,uuid,boolean,timestamptz,text) to authenticated;
