create or replace function public.list_crm_m365_tracked_months()
returns table(month_start date) language sql stable security definer set search_path = '' as $$
  with c as (select connection_id,business_timezone from public.crm_m365_calendar_connections
    where status='connected' order by connected_at desc limit 1),
  base as (select (date_trunc('month',now() at time zone c.business_timezone)::date
      + make_interval(months=>offset_month))::date as month_start from c
      cross join generate_series(-1,1) offset_month),
  recent as (select m.month_start from public.crm_m365_sync_months m join c using(connection_id)
    where m.last_requested_at>now()-interval '30 days'
      and m.month_start not in (select base.month_start from base)
    order by m.last_requested_at desc limit 12)
  select base.month_start from base union select recent.month_start from recent;
$$;
revoke all on function public.list_crm_m365_tracked_months() from public, anon, authenticated;
grant execute on function public.list_crm_m365_tracked_months() to service_role;
