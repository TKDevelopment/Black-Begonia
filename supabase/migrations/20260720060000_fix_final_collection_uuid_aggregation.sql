-- PostgreSQL does not provide max(uuid). Use deterministic UUID-safe array
-- selection for the canonical deposit and final obligation identifiers.
create or replace function public.activate_project_final_collection(p_project_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_project public.projects; v_deposit uuid; v_final uuid; v_deposit_due numeric(12,2); v_final_due numeric(12,2);
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  perform public.refresh_project_payment_statuses(p_project_id);
  select * into v_project from public.projects where project_id=p_project_id for update;
  if not found or v_project.event_date is null or v_project.event_date>current_date+60 or v_project.status in ('completed','canceled') then return jsonb_build_object('eligible',false); end if;
  select (array_agg(project_payment_record_id order by created_at,project_payment_record_id) filter(where payment_kind='deposit' and outstanding_amount>0 and status not in ('waived','canceled')))[1],
         (array_agg(project_payment_record_id order by created_at,project_payment_record_id) filter(where payment_kind='final_payment' and outstanding_amount>0 and status not in ('waived','canceled')))[1],
         coalesce(sum(outstanding_amount) filter(where payment_kind='deposit' and status not in ('waived','canceled')),0),
         coalesce(sum(outstanding_amount) filter(where payment_kind='final_payment' and status not in ('waived','canceled')),0)
  into v_deposit,v_final,v_deposit_due,v_final_due from public.project_payment_records where project_id=p_project_id;
  if v_deposit_due+v_final_due<=0 then return jsonb_build_object('eligible',false); end if;
  return jsonb_build_object('eligible',true,'projectId',p_project_id,'kind',case when v_deposit_due>0 and v_final_due>0 then 'consolidated' when v_deposit_due>0 then 'deposit' else 'final_payment' end,
    'obligationIds',case when v_deposit_due>0 and v_final_due>0 then jsonb_build_array(v_deposit,v_final) when v_deposit_due>0 then jsonb_build_array(v_deposit) else jsonb_build_array(v_final) end,
    'principalCents',round((v_deposit_due+v_final_due)*100)::bigint);
end; $$;
revoke all on function public.activate_project_final_collection(uuid) from public,anon,authenticated;
grant execute on function public.activate_project_final_collection(uuid) to service_role;
