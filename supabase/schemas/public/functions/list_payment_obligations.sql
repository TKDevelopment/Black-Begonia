create or replace function public.list_payment_obligations(
  p_search text default null,
  p_kind text default null,
  p_state text default null,
  p_method text default null,
  p_due_timing text default null,
  p_sort text default 'event_date',
  p_direction text default 'asc',
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare v_rows jsonb; v_total bigint;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
  select count(*) into v_total
  from public.project_payment_records o join public.projects p on p.project_id=o.project_id
  left join public.contacts c on c.contact_id=p.primary_contact_id
  where o.status<>'canceled'
    and (p_search is null or p_search='' or p.project_name ilike '%'||p_search||'%' or trim(concat(c.first_name,' ',c.last_name)) ilike '%'||p_search||'%' or c.email ilike '%'||p_search||'%')
    and (p_kind is null or o.payment_kind=p_kind)
    and (p_state is null or o.fulfillment_state=p_state)
    and (p_method is null or o.last_method=p_method or o.last_intention_method=p_method)
    and (p_due_timing is null or (p_due_timing='overdue' and o.due_date<current_date and o.outstanding_amount>0) or (p_due_timing='upcoming' and o.due_date>=current_date));
  with filtered as (
    select o.*, p.project_name, p.event_date, p.primary_contact_id,
      trim(concat(c.first_name,' ',c.last_name)) customer_name, c.email customer_email,
      exists(select 1 from public.payment_exceptions e where e.obligation_id=o.project_payment_record_id and e.state<>'resolved') has_exception,
      exists(select 1 from public.payment_message_deliveries d where d.obligation_id=o.project_payment_record_id and d.status in ('temporary_failed','permanent_failed','delivery_unknown')) has_delivery_issue
    from public.project_payment_records o join public.projects p on p.project_id=o.project_id
    left join public.contacts c on c.contact_id=p.primary_contact_id
    where o.status<>'canceled'
      and (p_search is null or p_search='' or p.project_name ilike '%'||p_search||'%' or trim(concat(c.first_name,' ',c.last_name)) ilike '%'||p_search||'%' or c.email ilike '%'||p_search||'%')
      and (p_kind is null or o.payment_kind=p_kind)
      and (p_state is null or o.fulfillment_state=p_state)
      and (p_method is null or o.last_method=p_method or o.last_intention_method=p_method)
      and (p_due_timing is null or (p_due_timing='overdue' and o.due_date<current_date and o.outstanding_amount>0) or (p_due_timing='upcoming' and o.due_date>=current_date))
  ), paged as (
    select * from filtered order by
      case when p_sort='event_date' and p_direction='asc' then event_date end asc nulls last,
      case when p_sort='event_date' and p_direction='desc' then event_date end desc nulls last,
      case when p_sort='due_date' and p_direction='asc' then due_date end asc nulls last,
      case when p_sort='due_date' and p_direction='desc' then due_date end desc nulls last,
      created_at desc
    limit least(greatest(p_page_size,1),100) offset greatest(p_page-1,0)*least(greatest(p_page_size,1),100)
  )
  select coalesce(jsonb_agg(to_jsonb(paged)),'[]'::jsonb) into v_rows from paged;
  return jsonb_build_object('rows',v_rows,'total',v_total,'page',greatest(p_page,1),'pageSize',least(greatest(p_page_size,1),100));
end;
$$;
revoke all on function public.list_payment_obligations(text,text,text,text,text,text,text,integer,integer) from public, anon;
grant execute on function public.list_payment_obligations(text,text,text,text,text,text,text,integer,integer) to authenticated;
