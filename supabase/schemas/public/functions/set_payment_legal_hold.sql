create or replace function public.set_payment_legal_hold(p_project_id uuid,p_hold_type text,p_action text,p_reason text,p_command_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hold public.payment_legal_holds;v_current text;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
  if p_hold_type not in ('legal','dispute') or p_action not in ('placed','released') or nullif(btrim(p_reason),'') is null then raise exception 'Valid hold type, action, and reason are required'; end if;
  select * into v_hold from public.payment_legal_holds where command_key=p_command_key;if found then return to_jsonb(v_hold)||jsonb_build_object('replayed',true);end if;
  perform 1 from public.projects where project_id=p_project_id for update;if not found then raise exception 'Project not found';end if;
  select action into v_current from public.payment_legal_holds where project_id=p_project_id and hold_type=p_hold_type order by created_at desc limit 1;
  if coalesce(v_current,'released')=p_action then raise exception 'Hold is already in the requested state'; end if;
  insert into public.payment_legal_holds(project_id,action,hold_type,reason,command_key,actor_id) values(p_project_id,p_action,p_hold_type,p_reason,p_command_key,auth.uid()) returning * into v_hold;
  perform public.create_payment_activity(p_project_id,'Payment hold '||p_action,initcap(p_hold_type)||' hold was '||p_action||'.','florist',jsonb_build_object('hold_type',p_hold_type,'action',p_action,'reason',p_reason,'hold_id',v_hold.payment_legal_hold_id),auth.uid());
  return to_jsonb(v_hold)||jsonb_build_object('replayed',false);
end; $$;
revoke all on function public.set_payment_legal_hold(uuid,text,text,text,uuid) from public,anon;
grant execute on function public.set_payment_legal_hold(uuid,text,text,text,uuid) to authenticated;
