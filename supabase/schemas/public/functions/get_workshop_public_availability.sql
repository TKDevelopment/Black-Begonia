create or replace function public.get_workshop_public_availability(
  p_workshop_occurrence_id uuid
) returns text
language sql stable security definer set search_path=''
as $$
  with facts as (
    select o.status, o.registration_opens_at, o.registration_closes_at,
      o.capacity, o.waitlist_enabled, o.external_checkout_url,
      greatest(o.capacity - coalesce((
        select sum(h.quantity)
        from public.workshop_seat_holds h
        where h.workshop_occurrence_id=o.workshop_occurrence_id
          and (
            h.state='confirmed'
            or (h.state='active' and h.effective_expires_at>now())
          )
      ),0),0)::integer as remaining
    from public.workshop_occurrences o
    where o.workshop_occurrence_id=p_workshop_occurrence_id
  )
  select case
    when status<>'published_open'
      or now()<registration_opens_at or now()>=registration_closes_at then 'closed'
    when external_checkout_url is not null then 'available'
    when remaining=0 and waitlist_enabled then 'waitlist_available'
    when remaining=0 then 'sold_out'
    when remaining<=greatest(3,ceil(capacity*.25)::integer) then 'limited'
    else 'available'
  end
  from facts;
$$;

revoke all on function public.get_workshop_public_availability(uuid) from public;
