create or replace function public.refresh_project_payment_statuses(target_project_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_project record;
begin
  if auth.role() not in ('service_role','authenticated') or (auth.role()='authenticated' and not public.is_internal_crm_user()) then raise exception 'not authorized'; end if;
  for v_project in
    select p.project_id, p.status
    from public.projects p
    where p.event_date is not null
      and p.event_date <= current_date + 60
      and (target_project_id is null or p.project_id=target_project_id)
      and p.status in ('awaiting_deposit','booked','awaiting_final_payment')
    order by p.project_id for update
  loop
    if not exists(select 1 from public.project_payment_records o where o.project_id=v_project.project_id and o.payment_kind='deposit' and o.outstanding_amount>0 and o.status not in ('waived','canceled'))
       and exists(select 1 from public.project_payment_records o where o.project_id=v_project.project_id and o.payment_kind='final_payment' and o.outstanding_amount>0 and o.status not in ('waived','canceled'))
       and v_project.status='booked' then
      update public.projects set status='awaiting_final_payment',updated_at=now() where project_id=v_project.project_id;
      perform public.create_payment_activity(v_project.project_id,'Final payment collection started','The event is within 60 days and its final balance is now due.','schedule',jsonb_build_object('window_days',60),null);
    end if;
  end loop;
end; $$;
revoke all on function public.refresh_project_payment_statuses(uuid) from public,anon;
grant execute on function public.refresh_project_payment_statuses(uuid) to authenticated,service_role;
