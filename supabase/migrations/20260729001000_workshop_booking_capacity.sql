-- Workshop booking/capacity slice. Depends only on 20260729000000.
-- Rollback before customer use: drop adjustments, attendees, the hold booking
-- foreign key, bookings, then holds. Never roll back after booking creation.

create table public.workshop_seat_holds (
  workshop_seat_hold_id uuid primary key default gen_random_uuid(),
  workshop_occurrence_id uuid not null references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  booking_id uuid,
  quantity integer not null check(quantity>0),
  state text not null default 'active' check(state in ('active','confirmed','expired','released','cancelled','exception')),
  payment_method text check(payment_method in ('stripe','direct_venmo')),
  normal_expires_at timestamptz not null, effective_expires_at timestamptz not null,
  resolved_at timestamptz, resolution_reason text,
  command_key uuid not null unique, created_at timestamptz not null default now(),
  constraint workshop_seat_holds_expiry check(effective_expires_at<=normal_expires_at),
  constraint workshop_seat_holds_resolution check((state='active' and resolved_at is null) or (state<>'active' and resolved_at is not null))
);
create index idx_workshop_holds_active_capacity on public.workshop_seat_holds(workshop_occurrence_id,effective_expires_at) where state='active';
alter table public.workshop_seat_holds enable row level security;
create policy workshop_holds_internal_select on public.workshop_seat_holds for select to authenticated using(public.is_internal_crm_user());

create table public.workshop_bookings (
  workshop_booking_id uuid primary key default gen_random_uuid(),
  workshop_occurrence_id uuid not null references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  booking_reference text not null unique,
  status_token_digest text not null unique check(char_length(status_token_digest)>=43),
  status_token_expires_at timestamptz not null,
  status_token_rotation_key uuid unique,
  contact_name text not null check(char_length(btrim(contact_name)) between 1 and 160),
  contact_email text not null check(char_length(btrim(contact_email)) between 3 and 320),
  contact_phone text,
  purchased_quantity integer not null check(purchased_quantity>0),
  active_quantity integer not null check(active_quantity between 0 and purchased_quantity),
  status text not null default 'pending_payment' check(status in ('pending_payment','confirmed','checked_in','expired','cancelled','payment_disputed','transfer_action_required','transferred')),
  payment_state text not null default 'unselected' check(payment_state in ('unselected','pending','processing','paid','partially_refunded','refunded','disputed','reversed','exception')),
  price_per_seat_minor_snapshot bigint not null check(price_per_seat_minor_snapshot>=0),
  subtotal_minor_snapshot bigint not null check(subtotal_minor_snapshot>=0),
  total_minor_snapshot bigint not null check(total_minor_snapshot>=0),
  required_charges_minor_snapshot bigint not null default 0 check(required_charges_minor_snapshot>=0),
  currency text not null check(currency='USD'), terms_snapshot text not null,
  terms_version integer not null check(terms_version>0),
  payment_method text check(payment_method in ('stripe','direct_venmo')),
  confirmed_at timestamptz, cancelled_at timestamptz, checked_in_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint workshop_booking_total_snapshot check(subtotal_minor_snapshot=price_per_seat_minor_snapshot*purchased_quantity and total_minor_snapshot=subtotal_minor_snapshot+required_charges_minor_snapshot)
);
alter table public.workshop_seat_holds add constraint workshop_seat_holds_booking_fkey
foreign key(booking_id) references public.workshop_bookings(workshop_booking_id) on delete restrict;
create index idx_workshop_bookings_occurrence on public.workshop_bookings(workshop_occurrence_id,created_at);
create index idx_workshop_bookings_status on public.workshop_bookings(status,payment_state);
create trigger trg_workshop_bookings_updated_at before update on public.workshop_bookings for each row execute function public.set_updated_at();
alter table public.workshop_bookings enable row level security;
create policy workshop_bookings_internal_select on public.workshop_bookings for select to authenticated using(public.is_internal_crm_user());

create table public.workshop_attendees (
  workshop_attendee_id uuid primary key default gen_random_uuid(),
  workshop_booking_id uuid not null references public.workshop_bookings(workshop_booking_id) on delete restrict,
  seat_number smallint not null check(seat_number>0), display_name text, accommodation_details text,
  attendance_state text not null default 'expected' check(attendance_state in ('expected','checked_in','absent','cancelled')),
  checked_in_at timestamptz, checked_in_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(workshop_booking_id,seat_number)
);
create trigger trg_workshop_attendees_updated_at before update on public.workshop_attendees for each row execute function public.set_updated_at();
alter table public.workshop_attendees enable row level security;
create policy workshop_attendees_internal_select on public.workshop_attendees for select to authenticated using(public.is_internal_crm_user());

create table public.workshop_booking_adjustments (
  workshop_booking_adjustment_id uuid primary key default gen_random_uuid(),
  workshop_booking_id uuid not null references public.workshop_bookings(workshop_booking_id) on delete restrict,
  adjustment_type text not null check(adjustment_type in ('partial_cancel','full_cancel','transfer','manual','complimentary','correction')),
  quantity_delta integer not null, amount_minor_delta bigint not null default 0,
  reason text not null check(char_length(btrim(reason))>0), command_key uuid not null unique,
  actor_type text not null check(actor_type in ('customer','internal','system','provider')),
  actor_id uuid, created_at timestamptz not null default now(),
  constraint workshop_booking_adjustment_effect check(quantity_delta<>0 or amount_minor_delta<>0)
);
create index idx_workshop_adjustments_booking on public.workshop_booking_adjustments(workshop_booking_id,created_at);
alter table public.workshop_booking_adjustments enable row level security;
create policy workshop_adjustments_internal_select on public.workshop_booking_adjustments for select to authenticated using(public.is_internal_crm_user());

-- Commands use occurrence row locking. This first command is intentionally
-- service-only and is extended by later story migrations rather than exposing
-- direct anonymous table mutation.
create or replace function public.create_workshop_seat_hold(
  p_occurrence_slug text, p_quantity integer, p_contact_name text,
  p_contact_email text, p_contact_phone text, p_terms_version integer,
  p_status_token_digest text, p_command_key uuid, p_hold_minutes integer default 15
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  o public.workshop_occurrences; prior public.workshop_seat_holds;
  b public.workshop_bookings; h public.workshop_seat_holds;
  v_reserved bigint; v_normal timestamptz; v_effective timestamptz;
begin
  select * into prior from public.workshop_seat_holds where command_key=p_command_key;
  if found then
    select * into b from public.workshop_bookings where workshop_booking_id=prior.booking_id;
    select * into o from public.workshop_occurrences where workshop_occurrence_id=b.workshop_occurrence_id;
    if o.slug is distinct from p_occurrence_slug
      or b.purchased_quantity is distinct from p_quantity
      or b.contact_name is distinct from btrim(p_contact_name)
      or b.contact_email is distinct from lower(btrim(p_contact_email))
      or b.contact_phone is distinct from nullif(btrim(coalesce(p_contact_phone,'')),'')
      or b.terms_version is distinct from p_terms_version
      or b.status_token_digest is distinct from p_status_token_digest then
      raise exception 'command key collision' using errcode='22023';
    end if;
    return jsonb_build_object('replayed',true,'bookingId',b.workshop_booking_id,
      'holdId',prior.workshop_seat_hold_id,'supportReference',b.booking_reference,
      'quantity',b.purchased_quantity,'priceMinor',b.price_per_seat_minor_snapshot,
      'totalMinor',b.total_minor_snapshot,'currency',b.currency,
      'effectiveExpiresAt',prior.effective_expires_at,'methods',
      case when o.stripe_enabled and o.venmo_enabled then jsonb_build_array('stripe','direct_venmo')
        when o.stripe_enabled then jsonb_build_array('stripe')
        when o.venmo_enabled then jsonb_build_array('direct_venmo')
        else '[]'::jsonb end);
  end if;
  if p_quantity<=0 or p_hold_minutes not between 1 and 30
    or char_length(btrim(coalesce(p_contact_name,''))) not between 1 and 160
    or char_length(btrim(coalesce(p_contact_email,''))) not between 3 and 320
    or char_length(coalesce(p_status_token_digest,''))<43 then
    raise exception 'invalid_request';
  end if;
  select * into o from public.workshop_occurrences where slug=p_occurrence_slug for update;
  if not found then raise exception 'unavailable'; end if;
  update public.workshop_seat_holds set state='expired',resolved_at=now(),
    resolution_reason='effective_deadline_elapsed'
  where workshop_occurrence_id=o.workshop_occurrence_id and state='active'
    and effective_expires_at<=now();
  if o.status<>'published_open' or now()<o.registration_opens_at
    or now()>=least(o.registration_closes_at,o.start_at) then
    raise exception 'registration_closed';
  end if;
  if p_terms_version<>o.terms_version then raise exception 'terms_changed'; end if;
  if p_quantity>o.per_booking_limit then raise exception 'quantity_changed'; end if;
  select coalesce(sum(quantity),0) into v_reserved from public.workshop_seat_holds
  where workshop_occurrence_id=o.workshop_occurrence_id
    and(state='confirmed' or(state='active' and effective_expires_at>now()));
  if v_reserved+p_quantity>o.capacity then raise exception 'insufficient_capacity'; end if;
  v_normal:=now()+make_interval(mins=>p_hold_minutes);
  v_effective:=least(v_normal,o.registration_closes_at,o.start_at);
  insert into public.workshop_bookings(workshop_occurrence_id,booking_reference,
    status_token_digest,status_token_expires_at,contact_name,contact_email,
    contact_phone,purchased_quantity,active_quantity,price_per_seat_minor_snapshot,
    subtotal_minor_snapshot,total_minor_snapshot,required_charges_minor_snapshot,
    currency,terms_snapshot,terms_version)
  values(o.workshop_occurrence_id,'BBW-'||to_char(o.start_at,'YYYY')||'-'
    ||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
    p_status_token_digest,o.end_at+interval '30 days',btrim(p_contact_name),
    lower(btrim(p_contact_email)),nullif(btrim(coalesce(p_contact_phone,'')),''),
    p_quantity,p_quantity,o.price_minor,o.price_minor*p_quantity,
    o.price_minor*p_quantity,0,o.currency,o.terms_snapshot,o.terms_version)
  returning * into b;
  insert into public.workshop_seat_holds(workshop_occurrence_id,booking_id,
    quantity,payment_method,normal_expires_at,effective_expires_at,command_key)
  values(o.workshop_occurrence_id,b.workshop_booking_id,p_quantity,null,
    v_normal,v_effective,p_command_key) returning * into h;
  return jsonb_build_object('replayed',false,'bookingId',b.workshop_booking_id,
    'holdId',h.workshop_seat_hold_id,'supportReference',b.booking_reference,
    'quantity',b.purchased_quantity,'priceMinor',b.price_per_seat_minor_snapshot,
    'totalMinor',b.total_minor_snapshot,'currency',b.currency,
    'effectiveExpiresAt',h.effective_expires_at,'methods',
    case when o.stripe_enabled and o.venmo_enabled then jsonb_build_array('stripe','direct_venmo')
      when o.stripe_enabled then jsonb_build_array('stripe')
      when o.venmo_enabled then jsonb_build_array('direct_venmo')
      else '[]'::jsonb end);
end; $$;
revoke all on function public.create_workshop_seat_hold(
  text,integer,text,text,text,integer,text,uuid,integer) from public;
grant execute on function public.create_workshop_seat_hold(
  text,integer,text,text,text,integer,text,uuid,integer) to service_role;

create or replace function public.rotate_workshop_status_token(
  p_current_digest text,p_new_digest text,p_command_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.workshop_bookings; o public.workshop_occurrences;
  v_deadline timestamptz;
begin
  if char_length(coalesce(p_current_digest,''))<43
    or char_length(coalesce(p_new_digest,''))<43
    or p_current_digest=p_new_digest then raise exception 'invalid_request'; end if;
  select * into b from public.workshop_bookings
  where status_token_rotation_key=p_command_key or status_token_digest=p_current_digest
  for update;
  if not found then raise exception 'unavailable'; end if;
  if b.status_token_rotation_key=p_command_key then
    return jsonb_build_object('replayed',true,'bookingId',b.workshop_booking_id,
      'supportReference',b.booking_reference,'expiresAt',b.status_token_expires_at);
  end if;
  select * into o from public.workshop_occurrences
  where workshop_occurrence_id=b.workshop_occurrence_id;
  if to_regclass('public.workshop_reschedule_responses') is not null then
    execute 'select max(response_token_expires_at) from public.workshop_reschedule_responses where workshop_booking_id=$1 and response=''pending'''
      into v_deadline using b.workshop_booking_id;
  end if;
  if to_regclass('public.workshop_payment_exceptions') is not null then
    execute 'select greatest($2,max(customer_action_deadline)) from public.workshop_payment_exceptions where workshop_booking_id=$1 and state in(''open'',''acknowledged'') and customer_action_deadline is not null'
      into v_deadline using b.workshop_booking_id,v_deadline;
  end if;
  update public.workshop_bookings set status_token_digest=p_new_digest,
    status_token_expires_at=greatest(o.end_at,coalesce(v_deadline,o.end_at))+interval '30 days',
    status_token_rotation_key=p_command_key
  where workshop_booking_id=b.workshop_booking_id returning * into b;
  return jsonb_build_object('replayed',false,'bookingId',b.workshop_booking_id,
    'supportReference',b.booking_reference,'expiresAt',b.status_token_expires_at);
end; $$;
revoke all on function public.rotate_workshop_status_token(text,text,uuid) from public;
grant execute on function public.rotate_workshop_status_token(text,text,uuid) to service_role;

revoke all on public.workshop_seat_holds, public.workshop_bookings,
  public.workshop_attendees, public.workshop_booking_adjustments from anon;
grant select on public.workshop_seat_holds, public.workshop_bookings,
  public.workshop_attendees, public.workshop_booking_adjustments to authenticated;

create or replace function public.get_workshop_public_availability(
  p_workshop_occurrence_id uuid
) returns text
language sql stable security definer set search_path=''
as $$
  with facts as (
    select o.status, o.registration_opens_at, o.registration_closes_at,
      o.capacity, o.waitlist_enabled,
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
    when remaining=0 and waitlist_enabled then 'waitlist_available'
    when remaining=0 then 'sold_out'
    when remaining<=greatest(3,ceil(capacity*.25)::integer) then 'limited'
    else 'available'
  end
  from facts;
$$;

alter function public.get_public_workshop_occurrence(text)
  rename to get_public_workshop_occurrence_catalog;
revoke all on function public.get_public_workshop_occurrence_catalog(text) from public;

create or replace function public.get_public_workshop_listing()
returns table("slug" text,"title" text,"advertisingLine" text,"theme" text,
"heroImageUrl" text,"heroAltText" text,"startAt" timestamptz,"endAt" timestamptz,
"timezone" text,"venueName" text,"locality" text,"region" text,"priceMinor" bigint,
"currency" text,"availability" text,"isFeatured" boolean,"featuredOrder" smallint,
"updatedAt" timestamptz)
language sql stable security definer set search_path='' as $$
select o.slug,o.title_snapshot,o.advertising_line_snapshot,d.theme,hero.public_url,
 hero.alt_text,o.start_at,o.end_at,o.timezone,o.venue_name,o.locality,o.region,
 o.price_minor,o.currency,
 public.get_workshop_public_availability(o.workshop_occurrence_id),
 o.is_featured,o.featured_order,o.updated_at
from public.workshop_occurrences o join public.workshop_definitions d using(workshop_definition_id)
join lateral(
 select wm.public_url,wm.alt_text from public.workshop_media wm
 where wm.is_public and wm.media_role='hero' and(
  wm.workshop_occurrence_id=o.workshop_occurrence_id or(
   wm.workshop_occurrence_id is null and wm.workshop_definition_id=o.workshop_definition_id))
 order by(wm.workshop_occurrence_id is not null) desc limit 1
) hero on true
where o.status='published_open' and o.end_at>now() and o.registration_closes_at>now()
order by o.start_at,o.workshop_occurrence_id;
$$;

create or replace function public.get_public_workshop_occurrence(p_slug text)
returns jsonb language sql stable security definer set search_path='' as $$
  select public.get_public_workshop_occurrence_catalog(p_slug)
    || jsonb_build_object(
      'availability',public.get_workshop_public_availability(o.workshop_occurrence_id),
      'waitlistEligible',o.status='published_open' and o.waitlist_enabled
        and public.get_workshop_public_availability(o.workshop_occurrence_id)='waitlist_available'
    )
  from public.workshop_occurrences o where o.slug=p_slug
    and o.status in('published_open','registration_closed','cancelled','rescheduled','completed');
$$;

revoke all on function public.get_workshop_public_availability(uuid) from public;
revoke all on function public.get_public_workshop_listing() from public;
revoke all on function public.get_public_workshop_occurrence(text) from public;
grant execute on function public.get_public_workshop_listing() to anon,authenticated;
grant execute on function public.get_public_workshop_occurrence(text) to anon,authenticated;
