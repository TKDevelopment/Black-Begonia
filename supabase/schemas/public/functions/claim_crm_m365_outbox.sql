create or replace function public.claim_crm_m365_outbox(p_limit integer default 25)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_rows jsonb;
begin
  if p_limit<1 or p_limit>100 then raise exception 'invalid_batch_limit' using errcode='22023'; end if;
  with picked as (
    select outbox_id from public.crm_m365_calendar_outbox
    where (state='pending' or (state='leased' and lease_expires_at<now()))
      and next_attempt_at<=now()
    order by changed_at limit p_limit for update skip locked
  ), leased as (
    update public.crm_m365_calendar_outbox q set state='leased',
      lease_expires_at=now()+interval '6 minutes',attempt_count=q.attempt_count+1
    from picked where q.outbox_id=picked.outbox_id
    returning q.outbox_id,q.source_type,q.source_id,q.generation,q.attempt_count
  ) select coalesce(jsonb_agg(to_jsonb(leased)),'[]'::jsonb) into v_rows from leased;
  return v_rows;
end;
$$;
revoke all on function public.claim_crm_m365_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_crm_m365_outbox(integer) to service_role;
