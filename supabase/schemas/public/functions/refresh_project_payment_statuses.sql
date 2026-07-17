create or replace function public.refresh_project_payment_statuses(target_project_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.projects p
  set status = 'awaiting_final_payment'::public.project_status,
      updated_at = now()
  where p.status = 'booked'::public.project_status
    and p.event_date is not null
    and p.event_date <= (current_date + interval '45 days')::date
    and (target_project_id is null or p.project_id = target_project_id)
    and not exists (
      select 1
      from public.project_payment_records r
      where r.project_id = p.project_id
        and r.payment_kind = 'final_payment'
        and r.status = 'paid'
    );
end;
$$;
