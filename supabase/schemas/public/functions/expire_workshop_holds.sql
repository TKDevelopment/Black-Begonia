create or replace function public.expire_workshop_holds(
  p_limit integer default 100
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold_ids uuid[];
  v_count integer;
begin
  if p_limit not between 1 and 500 then
    raise exception 'invalid_request';
  end if;

  select array_agg(due.workshop_seat_hold_id)
  into v_hold_ids
  from (
    select h.workshop_seat_hold_id
    from public.workshop_seat_holds h
    where h.state = 'active'
      and h.effective_expires_at <= now()
    order by h.effective_expires_at, h.workshop_seat_hold_id
    limit p_limit
    for update skip locked
  ) due;

  if v_hold_ids is null then
    return jsonb_build_object('expiredCount', 0);
  end if;

  update public.workshop_seat_holds
  set state = 'expired',
      resolved_at = now(),
      resolution_reason = 'effective_deadline_elapsed'
  where workshop_seat_hold_id = any(v_hold_ids);
  get diagnostics v_count = row_count;

  update public.workshop_payment_attempts
  set state = 'expired',
      resolved_at = now()
  where workshop_seat_hold_id = any(v_hold_ids)
    and state in ('creating', 'active');

  update public.workshop_bookings b
  set status = 'expired',
      payment_state = case when b.payment_state = 'unselected' then 'unselected' else 'exception' end
  where b.workshop_booking_id in (
    select h.booking_id
    from public.workshop_seat_holds h
    where h.workshop_seat_hold_id = any(v_hold_ids)
  )
    and b.status = 'pending_payment'
    and b.payment_state not in ('paid', 'processing');

  return jsonb_build_object('expiredCount', v_count);
end;
$$;

revoke all on function public.expire_workshop_holds(integer) from public;
grant execute on function public.expire_workshop_holds(integer) to service_role;
