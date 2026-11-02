create or replace function public.guard_workshop_checkout_mode_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.external_checkout_url is distinct from old.external_checkout_url
    and new.external_checkout_url is not null
    and exists (
      select 1 from public.workshop_seat_holds h
      where h.workshop_occurrence_id = old.workshop_occurrence_id
        and h.state = 'active' and h.effective_expires_at > now()
    ) then
    raise exception 'Wait for active reservations to expire before changing checkout providers.' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_workshop_checkout_mode_change() from public;
create trigger guard_workshop_checkout_mode_change
before update of external_checkout_url on public.workshop_occurrences
for each row execute function public.guard_workshop_checkout_mode_change();
