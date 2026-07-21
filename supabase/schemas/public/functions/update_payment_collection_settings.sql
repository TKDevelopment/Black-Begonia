create or replace function public.update_payment_collection_settings(p_business_timezone text,p_send_window_start time,p_send_window_end time,p_cash_instructions text,p_check_instructions text,p_venmo_business_target text,p_stripe_enabled boolean,p_venmo_enabled boolean,p_reminders_enabled boolean,p_collection_enabled boolean,p_provider_environment text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_settings public.payment_collection_settings;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_business_timezone) then raise exception 'Invalid IANA timezone'; end if;
  if p_send_window_start>=p_send_window_end then raise exception 'Send window end must follow its start'; end if;
  if p_provider_environment not in ('sandbox','production') then raise exception 'Invalid provider environment'; end if;
  if p_venmo_enabled and nullif(btrim(p_venmo_business_target),'') is null then raise exception 'Venmo target is required when Venmo is enabled'; end if;
  insert into public.payment_collection_settings(settings_id,business_timezone,send_window_start,send_window_end,cash_instructions,check_instructions,venmo_business_target,stripe_enabled,venmo_enabled,reminders_enabled,collection_enabled,provider_environment,updated_by,updated_at)
  values(true,p_business_timezone,p_send_window_start,p_send_window_end,coalesce(p_cash_instructions,''),coalesce(p_check_instructions,''),nullif(btrim(p_venmo_business_target),''),p_stripe_enabled,p_venmo_enabled,p_reminders_enabled,p_collection_enabled,p_provider_environment,auth.uid(),now())
  on conflict(settings_id) do update set business_timezone=excluded.business_timezone,send_window_start=excluded.send_window_start,send_window_end=excluded.send_window_end,cash_instructions=excluded.cash_instructions,check_instructions=excluded.check_instructions,venmo_business_target=excluded.venmo_business_target,stripe_enabled=excluded.stripe_enabled,venmo_enabled=excluded.venmo_enabled,reminders_enabled=excluded.reminders_enabled,collection_enabled=excluded.collection_enabled,provider_environment=excluded.provider_environment,updated_by=excluded.updated_by,updated_at=excluded.updated_at returning * into v_settings;
  return to_jsonb(v_settings)||jsonb_build_object('customer_card_fee_policy','fixed_off','customer_card_fee_percent',0);
end; $$;
revoke all on function public.update_payment_collection_settings(text,time,time,text,text,text,boolean,boolean,boolean,boolean,text) from public,anon;
grant execute on function public.update_payment_collection_settings(text,time,time,text,text,text,boolean,boolean,boolean,boolean,text) to authenticated;
