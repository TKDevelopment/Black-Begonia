create or replace function public.enqueue_confirmed_workshop_booking_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'confirmed'
    and (tg_op = 'INSERT' or old.status is distinct from 'confirmed') then
    perform public.queue_workshop_communication(
      'booking_confirmation', 'booking_contact', 'v1',
      new.workshop_booking_id, null, null, 'status_access', true,
      now() + interval '24 hours', new.workshop_booking_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_workshop_booking_confirmation_message
on public.workshop_bookings;
create trigger trg_workshop_booking_confirmation_message
after insert or update of status on public.workshop_bookings
for each row execute function public.enqueue_confirmed_workshop_booking_message();
