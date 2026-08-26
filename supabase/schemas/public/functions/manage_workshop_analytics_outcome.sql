create or replace function public.manage_workshop_analytics_outcome(
  p_action text,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_digest text := lower(btrim(coalesce(p_payload->>'grantDigest', '')));
  v_status_digest text := btrim(coalesce(
    p_payload->>'statusTokenDigest', ''
  ));
  v_booking public.workshop_bookings;
  v_occurrence public.workshop_occurrences;
  v_grant public.workshop_analytics_outcome_grants;
  v_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and session_user <> 'postgres'
  then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_request';
  end if;

  if p_action = 'expire' then
    update public.workshop_analytics_outcome_grants
    set discarded_at = now()
    where consumed_at is null
      and discarded_at is null
      and expires_at <= now();
    get diagnostics v_count = row_count;
    return jsonb_build_object('state', 'expired', 'count', v_count);
  end if;

  if v_digest !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('state', 'unavailable');
  end if;

  if p_action = 'register_confirmation' then
    if char_length(v_status_digest) < 43 then
      return jsonb_build_object('state', 'unavailable');
    end if;
    select b.* into v_booking
    from public.workshop_bookings b
    where b.status_token_digest = v_status_digest
      and b.status in ('confirmed', 'checked_in', 'transferred')
      and b.payment_state in ('paid', 'partially_refunded')
    for update;
    if not found then
      return jsonb_build_object('state', 'unavailable');
    end if;

    insert into public.workshop_analytics_outcome_grants(
      workshop_booking_id, grant_digest, outcome_type, expires_at
    ) values (
      v_booking.workshop_booking_id, v_digest, 'booking_confirmed',
      now() + interval '24 hours'
    )
    on conflict (workshop_booking_id, outcome_type) do nothing
    returning * into v_grant;
    return jsonb_build_object(
      'state', case when found then 'issued' else 'unavailable' end
    );
  end if;

  select * into v_grant
  from public.workshop_analytics_outcome_grants
  where grant_digest = v_digest
  for update;
  if not found
    or v_grant.consumed_at is not null
    or v_grant.discarded_at is not null
  then
    return jsonb_build_object('state', 'unavailable');
  end if;

  if p_action = 'discard' then
    update public.workshop_analytics_outcome_grants
    set discarded_at = now()
    where workshop_analytics_outcome_grant_id =
      v_grant.workshop_analytics_outcome_grant_id;
    return jsonb_build_object('state', 'discarded');
  end if;

  if p_action <> 'redeem' or v_grant.expires_at <= now()
    or v_grant.outcome_type <> 'booking_confirmed'
  then
    if v_grant.expires_at <= now() then
      update public.workshop_analytics_outcome_grants
      set discarded_at = now()
      where workshop_analytics_outcome_grant_id =
        v_grant.workshop_analytics_outcome_grant_id;
    end if;
    return jsonb_build_object('state', 'unavailable');
  end if;

  select b.* into v_booking
  from public.workshop_bookings b
  where b.workshop_booking_id = v_grant.workshop_booking_id;
  select o.* into v_occurrence
  from public.workshop_occurrences o
  where o.workshop_occurrence_id = v_booking.workshop_occurrence_id;
  if not found then
    return jsonb_build_object('state', 'unavailable');
  end if;

  update public.workshop_analytics_outcome_grants
  set consumed_at = now()
  where workshop_analytics_outcome_grant_id =
    v_grant.workshop_analytics_outcome_grant_id;
  return jsonb_build_object(
    'state', 'redeemed',
    'outcome', jsonb_build_object(
      'event', 'workshop_booking_confirmed',
      'publicContentId', v_occurrence.slug,
      'category', 'workshop',
      'quantity', v_booking.active_quantity,
      'currency', v_booking.currency,
      'valueMinor', v_booking.total_minor_snapshot
    )
  );
end;
$$;

revoke all on function public.manage_workshop_analytics_outcome(text,jsonb)
from public, anon, authenticated;
grant execute on function public.manage_workshop_analytics_outcome(text,jsonb)
to service_role;
