-- Workshop catalog/media slice. Additive; preserves all existing workshop
-- inquiry, project, proposal, and payment records.
-- Rollback before publication: remove the workshop-media policies/bucket, then
-- drop the public projection functions and these six tables in reverse order.

create table public.workshop_definitions (
  workshop_definition_id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  theme text not null check (char_length(btrim(theme)) between 1 and 80),
  advertising_line text not null check (char_length(btrim(advertising_line)) between 1 and 240),
  description text not null check (char_length(btrim(description)) between 1 and 10000),
  included_materials text not null default '',
  accessibility_guidance text, contact_guidance text,
  default_terms text not null default '',
  default_terms_version integer not null default 1 check (default_terms_version > 0),
  default_currency text not null default 'USD' check (default_currency = 'USD'),
  stripe_product_id text unique,
  stripe_catalog_state text not null default 'not_configured'
    check (stripe_catalog_state in ('not_configured','pending','ready','failed')),
  stripe_catalog_error text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_workshop_definitions_title on public.workshop_definitions(title);
create trigger trg_workshop_definitions_updated_at before update on public.workshop_definitions
for each row execute function public.set_updated_at();
alter table public.workshop_definitions enable row level security;
create policy workshop_definitions_internal_select on public.workshop_definitions for select to authenticated using (public.is_internal_crm_user());
create policy workshop_definitions_internal_insert on public.workshop_definitions for insert to authenticated with check (public.is_internal_crm_user());
create policy workshop_definitions_internal_update on public.workshop_definitions for update to authenticated using (public.is_internal_crm_user()) with check (public.is_internal_crm_user());
create policy workshop_definitions_internal_delete on public.workshop_definitions for delete to authenticated using (public.is_internal_crm_user());

create table public.workshop_series (
  workshop_series_id uuid primary key default gen_random_uuid(),
  workshop_definition_id uuid not null references public.workshop_definitions(workshop_definition_id) on delete restrict,
  series_label text not null check (char_length(btrim(series_label)) between 1 and 160),
  default_capacity integer not null check (default_capacity > 0),
  default_price_minor bigint not null check (default_price_minor >= 0),
  default_currency text not null default 'USD' check (default_currency = 'USD'),
  default_venue_name text not null, default_address_line_1 text not null,
  default_address_line_2 text, default_locality text not null,
  default_region text not null, default_postal_code text not null,
  default_country text not null default 'US', default_timezone text not null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index idx_workshop_series_definition on public.workshop_series(workshop_definition_id);
create trigger trg_workshop_series_updated_at before update on public.workshop_series
for each row execute function public.set_updated_at();
alter table public.workshop_series enable row level security;
create policy workshop_series_internal_select on public.workshop_series for select to authenticated using (public.is_internal_crm_user());
create policy workshop_series_internal_insert on public.workshop_series for insert to authenticated with check (public.is_internal_crm_user());
create policy workshop_series_internal_update on public.workshop_series for update to authenticated using (public.is_internal_crm_user()) with check (public.is_internal_crm_user());
create policy workshop_series_internal_delete on public.workshop_series for delete to authenticated using (public.is_internal_crm_user());

create table public.workshop_stripe_price_versions (
  workshop_stripe_price_version_id uuid primary key default gen_random_uuid(),
  workshop_definition_id uuid not null references public.workshop_definitions(workshop_definition_id) on delete restrict,
  stripe_product_id text not null, stripe_price_id text not null unique,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency = 'USD'),
  state text not null check (state in ('pending','active','inactive','failed')),
  provider_created_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), deactivated_at timestamptz,
  constraint workshop_stripe_price_versions_deactivation check ((state='inactive' and deactivated_at is not null) or state<>'inactive')
);
create index idx_workshop_stripe_prices_definition on public.workshop_stripe_price_versions(workshop_definition_id,state);
alter table public.workshop_stripe_price_versions enable row level security;
create policy workshop_stripe_prices_internal_select on public.workshop_stripe_price_versions for select to authenticated using (public.is_internal_crm_user());

create table public.workshop_occurrences (
  workshop_occurrence_id uuid primary key default gen_random_uuid(),
  workshop_definition_id uuid not null references public.workshop_definitions(workshop_definition_id) on delete restrict,
  workshop_series_id uuid references public.workshop_series(workshop_series_id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'draft' check (status in ('draft','published_open','registration_closed','cancelled','rescheduled','completed','archived')),
  title_snapshot text not null check (char_length(btrim(title_snapshot)) between 1 and 160),
  advertising_line_snapshot text not null check (char_length(btrim(advertising_line_snapshot)) between 1 and 240),
  description_snapshot text not null, included_materials_snapshot text not null,
  terms_snapshot text not null, terms_version integer not null check (terms_version > 0),
  venue_name text not null, address_line_1 text not null, address_line_2 text,
  locality text not null, region text not null, postal_code text not null,
  country text not null default 'US', timezone text not null,
  local_start timestamp not null, local_end timestamp not null,
  utc_offset_minutes smallint not null check (utc_offset_minutes between -840 and 840),
  start_at timestamptz not null, end_at timestamptz not null,
  registration_opens_at timestamptz not null, registration_closes_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  per_booking_limit integer not null check (per_booking_limit > 0 and per_booking_limit <= capacity),
  price_minor bigint not null check (price_minor >= 0),
  currency text not null default 'USD' check (currency='USD'),
  stripe_price_version_id uuid references public.workshop_stripe_price_versions(workshop_stripe_price_version_id) on delete restrict,
  stripe_enabled boolean not null default false, venmo_enabled boolean not null default false,
  waitlist_enabled boolean not null default false,
  waitlist_offer_duration_minutes integer not null default 1440 check (waitlist_offer_duration_minutes between 60 and 4320),
  is_featured boolean not null default false, featured_order smallint check (featured_order >= 0),
  published_at timestamptz, completed_at timestamptz, cancelled_at timestamptz, archived_at timestamptz,
  replacement_occurrence_id uuid references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  status_page_expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint workshop_occurrences_time_order check (local_end>local_start and end_at>start_at and registration_closes_at>registration_opens_at and registration_closes_at<=start_at),
  constraint workshop_occurrences_stripe_price check (not stripe_enabled or stripe_price_version_id is not null),
  constraint workshop_occurrences_replacement check (replacement_occurrence_id is null or replacement_occurrence_id<>workshop_occurrence_id)
);
create index idx_workshop_occurrences_public on public.workshop_occurrences(status,start_at);
create index idx_workshop_occurrences_series on public.workshop_occurrences(workshop_series_id,start_at);
create index idx_workshop_occurrences_featured on public.workshop_occurrences(is_featured,featured_order,start_at);
create trigger trg_workshop_occurrences_updated_at before update on public.workshop_occurrences
for each row execute function public.set_updated_at();
alter table public.workshop_occurrences enable row level security;
create policy workshop_occurrences_internal_select on public.workshop_occurrences for select to authenticated using (public.is_internal_crm_user());

create table public.workshop_media (
  workshop_media_id uuid primary key default gen_random_uuid(),
  workshop_definition_id uuid references public.workshop_definitions(workshop_definition_id) on delete restrict,
  workshop_occurrence_id uuid references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  media_role text not null check (media_role in ('hero','gallery')),
  storage_path text not null unique, public_url text not null, alt_text text not null default '',
  display_order smallint not null default 0 check (display_order>=0), is_public boolean not null default false,
  width integer not null check (width>0), height integer not null check (height>0),
  byte_size integer not null check (byte_size>0 and byte_size<=10485760),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/avif')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint workshop_media_one_owner check ((workshop_definition_id is not null)::integer+(workshop_occurrence_id is not null)::integer=1),
  constraint workshop_media_public_alt check (not is_public or char_length(btrim(alt_text))>0)
);
create unique index uq_workshop_media_definition_hero on public.workshop_media(workshop_definition_id) where workshop_definition_id is not null and media_role='hero';
create unique index uq_workshop_media_occurrence_hero on public.workshop_media(workshop_occurrence_id) where workshop_occurrence_id is not null and media_role='hero';
create index idx_workshop_media_definition_order on public.workshop_media(workshop_definition_id,media_role,display_order);
create index idx_workshop_media_occurrence_order on public.workshop_media(workshop_occurrence_id,media_role,display_order);
create trigger trg_workshop_media_updated_at before update on public.workshop_media for each row execute function public.set_updated_at();
alter table public.workshop_media enable row level security;
create policy workshop_media_internal_select on public.workshop_media for select to authenticated using (public.is_internal_crm_user());
create policy workshop_media_internal_insert on public.workshop_media for insert to authenticated with check (public.is_internal_crm_user());
create policy workshop_media_internal_update on public.workshop_media for update to authenticated using (public.is_internal_crm_user()) with check (public.is_internal_crm_user());
create policy workshop_media_internal_delete on public.workshop_media for delete to authenticated using (public.is_internal_crm_user());

create table public.workshop_audit_events (
  workshop_audit_event_id uuid primary key default gen_random_uuid(),
  workshop_definition_id uuid references public.workshop_definitions(workshop_definition_id) on delete restrict,
  workshop_occurrence_id uuid references public.workshop_occurrences(workshop_occurrence_id) on delete restrict,
  event_type text not null, actor_type text not null check (actor_type in ('internal','customer','provider','system')),
  actor_id uuid, command_key uuid, safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint workshop_audit_event_owner check (workshop_definition_id is not null or workshop_occurrence_id is not null)
);
create unique index uq_workshop_audit_command on public.workshop_audit_events(command_key,event_type) where command_key is not null;
create index idx_workshop_audit_occurrence on public.workshop_audit_events(workshop_occurrence_id,created_at desc);
alter table public.workshop_audit_events enable row level security;
create policy workshop_audit_internal_select on public.workshop_audit_events for select to authenticated using (public.is_internal_crm_user());

create or replace function public.get_public_workshop_listing()
returns table ("slug" text,"title" text,"advertisingLine" text,"theme" text,"heroImageUrl" text,"heroAltText" text,"startAt" timestamptz,"endAt" timestamptz,"timezone" text,"venueName" text,"locality" text,"region" text,"priceMinor" bigint,"currency" text,"availability" text,"isFeatured" boolean,"featuredOrder" smallint,"updatedAt" timestamptz)
language sql stable security definer set search_path='' as $$
select o.slug,o.title_snapshot,o.advertising_line_snapshot,d.theme,m.public_url,m.alt_text,o.start_at,o.end_at,o.timezone,o.venue_name,o.locality,o.region,o.price_minor,o.currency,
case when o.registration_closes_at<=now() then 'closed' else 'available' end,o.is_featured,o.featured_order,o.updated_at
from public.workshop_occurrences o join public.workshop_definitions d using(workshop_definition_id)
join lateral (select wm.public_url,wm.alt_text from public.workshop_media wm where wm.is_public and wm.media_role='hero' and (wm.workshop_occurrence_id=o.workshop_occurrence_id or (wm.workshop_occurrence_id is null and wm.workshop_definition_id=o.workshop_definition_id)) order by (wm.workshop_occurrence_id is not null) desc limit 1) m on true
where o.status='published_open' and o.end_at>now() order by o.start_at;
$$;

create or replace function public.get_public_workshop_occurrence(p_slug text)
returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object(
'slug',o.slug,'title',o.title_snapshot,'advertisingLine',o.advertising_line_snapshot,'theme',d.theme,
'description',o.description_snapshot,'includedMaterials',o.included_materials_snapshot,
'accessibilityGuidance',d.accessibility_guidance,'contactGuidance',d.contact_guidance,
'terms',o.terms_snapshot,'termsVersion',o.terms_version,'startAt',o.start_at,'endAt',o.end_at,
'timezone',o.timezone,'venueName',o.venue_name,'addressLine1',o.address_line_1,'addressLine2',o.address_line_2,
'locality',o.locality,'region',o.region,'postalCode',o.postal_code,'country',o.country,
'priceMinor',o.price_minor,'currency',o.currency,'perBookingLimit',o.per_booking_limit,
'stripeEnabled',o.stripe_enabled,'venmoEnabled',o.venmo_enabled,'waitlistEligible',false,
'availability',case when o.status<>'published_open' or o.registration_closes_at<=now() then 'closed' else 'available' end,
'isFeatured',o.is_featured,'featuredOrder',o.featured_order,'updatedAt',o.updated_at,
'seoStatus',case when o.status in ('cancelled','rescheduled') and o.status_page_expires_at<=now() then 'redirect' when o.status='archived' then 'noindex' else 'index' end,
'replacementUrl',r.slug,'redirectUrl',case when o.status_page_expires_at<=now() then '/workshops' else null end,
'media',coalesce((select jsonb_agg(jsonb_build_object('role',wm.media_role,'url',wm.public_url,'altText',wm.alt_text,'displayOrder',wm.display_order) order by wm.media_role desc,wm.display_order)
from public.workshop_media wm where wm.is_public and (wm.workshop_occurrence_id=o.workshop_occurrence_id or (wm.workshop_definition_id=o.workshop_definition_id and not exists(select 1 from public.workshop_media ov where ov.workshop_occurrence_id=o.workshop_occurrence_id and ov.media_role=wm.media_role)))),'[]'::jsonb))
from public.workshop_occurrences o join public.workshop_definitions d using(workshop_definition_id)
left join public.workshop_occurrences r on r.workshop_occurrence_id=o.replacement_occurrence_id
where o.slug=p_slug and o.status in ('published_open','registration_closed','cancelled','rescheduled','completed');
$$;
revoke all on function public.get_public_workshop_listing() from public;
revoke all on function public.get_public_workshop_occurrence(text) from public;
grant execute on function public.get_public_workshop_listing() to anon,authenticated;
grant execute on function public.get_public_workshop_occurrence(text) to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('workshop-media','workshop-media',true,10485760,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "public reads workshop media" on storage.objects for select to public using(bucket_id='workshop-media');
create policy "internal users upload workshop media" on storage.objects for insert to authenticated with check(bucket_id='workshop-media' and public.is_internal_crm_user());
create policy "internal users update workshop media" on storage.objects for update to authenticated using(bucket_id='workshop-media' and public.is_internal_crm_user()) with check(bucket_id='workshop-media' and public.is_internal_crm_user());
create policy "internal users delete workshop media" on storage.objects for delete to authenticated using(bucket_id='workshop-media' and public.is_internal_crm_user());

revoke all on public.workshop_definitions, public.workshop_series,
  public.workshop_stripe_price_versions, public.workshop_occurrences,
  public.workshop_media, public.workshop_audit_events from anon;
grant select on public.workshop_definitions, public.workshop_series,
  public.workshop_stripe_price_versions, public.workshop_occurrences,
  public.workshop_media, public.workshop_audit_events to authenticated;
grant insert, update, delete on public.workshop_definitions,
  public.workshop_series, public.workshop_media to authenticated;

create or replace function public.save_workshop_occurrence(p_draft jsonb,p_command_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_existing_id uuid; v_occurrence_id uuid;
 v_definition_id uuid:=(p_draft->>'workshopDefinitionId')::uuid;
 v_series_id uuid:=nullif(p_draft->>'workshopSeriesId','')::uuid;
 v_timezone text:=nullif(btrim(p_draft->>'timezone'),'');
 v_local_start timestamp:=(p_draft->>'localStart')::timestamp;
 v_local_end timestamp:=(p_draft->>'localEnd')::timestamp;
 v_offset smallint:=(p_draft->>'utcOffsetMinutes')::smallint;
 v_start_at timestamptz; v_end_at timestamptz;
 v_occurrence public.workshop_occurrences;
begin
 if not public.is_internal_crm_user() then raise exception 'not authorized' using errcode='42501'; end if;
 if p_command_key is null or v_definition_id is null then raise exception 'invalid request' using errcode='22023'; end if;
 select (safe_metadata->>'occurrenceId')::uuid into v_existing_id from public.workshop_audit_events
 where command_key=p_command_key and event_type='occurrence_saved';
 if v_existing_id is not null then
  select * into v_occurrence from public.workshop_occurrences where workshop_occurrence_id=v_existing_id;
  return to_jsonb(v_occurrence);
 end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=v_timezone) then
  raise exception 'invalid timezone' using errcode='22023';
 end if;
 if v_local_end<=v_local_start then raise exception 'invalid schedule' using errcode='22023'; end if;
 v_start_at:=to_timestamp(extract(epoch from v_local_start)-(v_offset*60));
 v_end_at:=to_timestamp(extract(epoch from v_local_end)-(v_offset*60));
 if (v_start_at at time zone v_timezone)<>v_local_start or (v_end_at at time zone v_timezone)<>v_local_end then
  raise exception 'invalid timezone offset' using errcode='22023';
 end if;
 if nullif(btrim(p_draft->>'title'),'') is null
  or nullif(btrim(p_draft->>'advertisingLine'),'') is null
  or nullif(btrim(p_draft->>'description'),'') is null then
  raise exception 'missing workshop content' using errcode='22023';
 end if;
 v_occurrence_id:=nullif(p_draft->>'workshopOccurrenceId','')::uuid;
 if v_occurrence_id is null then
  insert into public.workshop_occurrences(
   workshop_definition_id,workshop_series_id,slug,title_snapshot,advertising_line_snapshot,
   description_snapshot,included_materials_snapshot,terms_snapshot,terms_version,
   venue_name,address_line_1,address_line_2,locality,region,postal_code,country,timezone,
   local_start,local_end,utc_offset_minutes,start_at,end_at,registration_opens_at,
   registration_closes_at,capacity,per_booking_limit,price_minor,currency,
   stripe_price_version_id,stripe_enabled,venmo_enabled,waitlist_enabled,is_featured,
   featured_order,created_by,updated_by
  ) values(
   v_definition_id,v_series_id,lower(btrim(p_draft->>'slug')),btrim(p_draft->>'title'),
   btrim(p_draft->>'advertisingLine'),btrim(p_draft->>'description'),
   coalesce(btrim(p_draft->>'includedMaterials'),''),coalesce(btrim(p_draft->>'terms'),''),
   (p_draft->>'termsVersion')::integer,coalesce(btrim(p_draft->>'venueName'),''),
   coalesce(btrim(p_draft->>'addressLine1'),''),nullif(btrim(p_draft->>'addressLine2'),''),
   coalesce(btrim(p_draft->>'locality'),''),coalesce(btrim(p_draft->>'region'),''),
   coalesce(btrim(p_draft->>'postalCode'),''),coalesce(nullif(upper(btrim(p_draft->>'country')),''),'US'),
   v_timezone,v_local_start,v_local_end,v_offset,v_start_at,v_end_at,
   (p_draft->>'registrationOpensAt')::timestamptz,(p_draft->>'registrationClosesAt')::timestamptz,
   (p_draft->>'capacity')::integer,(p_draft->>'perBookingLimit')::integer,
   (p_draft->>'priceMinor')::bigint,upper(p_draft->>'currency'),
   nullif(p_draft->>'stripePriceVersionId','')::uuid,
   coalesce((p_draft->>'stripeEnabled')::boolean,false),
   coalesce((p_draft->>'venmoEnabled')::boolean,false),
   coalesce((p_draft->>'waitlistEnabled')::boolean,false),
   coalesce((p_draft->>'isFeatured')::boolean,false),
   nullif(p_draft->>'featuredOrder','')::smallint,auth.uid(),auth.uid()
  ) returning * into v_occurrence;
 else
  update public.workshop_occurrences set
   workshop_series_id=v_series_id,slug=lower(btrim(p_draft->>'slug')),
   title_snapshot=btrim(p_draft->>'title'),advertising_line_snapshot=btrim(p_draft->>'advertisingLine'),
   description_snapshot=btrim(p_draft->>'description'),
   included_materials_snapshot=coalesce(btrim(p_draft->>'includedMaterials'),''),
   terms_snapshot=coalesce(btrim(p_draft->>'terms'),''),terms_version=(p_draft->>'termsVersion')::integer,
   venue_name=coalesce(btrim(p_draft->>'venueName'),''),address_line_1=coalesce(btrim(p_draft->>'addressLine1'),''),
   address_line_2=nullif(btrim(p_draft->>'addressLine2'),''),locality=coalesce(btrim(p_draft->>'locality'),''),
   region=coalesce(btrim(p_draft->>'region'),''),postal_code=coalesce(btrim(p_draft->>'postalCode'),''),
   country=coalesce(nullif(upper(btrim(p_draft->>'country')),''),'US'),timezone=v_timezone,
   local_start=v_local_start,local_end=v_local_end,utc_offset_minutes=v_offset,
   start_at=v_start_at,end_at=v_end_at,
   registration_opens_at=(p_draft->>'registrationOpensAt')::timestamptz,
   registration_closes_at=(p_draft->>'registrationClosesAt')::timestamptz,
   capacity=(p_draft->>'capacity')::integer,per_booking_limit=(p_draft->>'perBookingLimit')::integer,
   price_minor=(p_draft->>'priceMinor')::bigint,currency=upper(p_draft->>'currency'),
   stripe_price_version_id=nullif(p_draft->>'stripePriceVersionId','')::uuid,
   stripe_enabled=coalesce((p_draft->>'stripeEnabled')::boolean,false),
   venmo_enabled=coalesce((p_draft->>'venmoEnabled')::boolean,false),
   waitlist_enabled=coalesce((p_draft->>'waitlistEnabled')::boolean,false),
   is_featured=coalesce((p_draft->>'isFeatured')::boolean,false),
   featured_order=nullif(p_draft->>'featuredOrder','')::smallint,updated_by=auth.uid()
  where workshop_occurrence_id=v_occurrence_id and workshop_definition_id=v_definition_id
   and status in('draft','published_open','registration_closed') returning * into v_occurrence;
  if not found then raise exception 'workshop occurrence cannot be edited' using errcode='55000'; end if;
 end if;
 insert into public.workshop_audit_events(workshop_definition_id,workshop_occurrence_id,event_type,actor_type,actor_id,command_key,safe_metadata)
 values(v_occurrence.workshop_definition_id,v_occurrence.workshop_occurrence_id,'occurrence_saved','internal',auth.uid(),p_command_key,jsonb_build_object('occurrenceId',v_occurrence.workshop_occurrence_id));
 return to_jsonb(v_occurrence);
end; $$;

create or replace function public.publish_workshop_occurrence(p_workshop_occurrence_id uuid,p_command_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_occurrence public.workshop_occurrences; v_replay_id uuid;
begin
 if not public.is_internal_crm_user() then raise exception 'not authorized' using errcode='42501'; end if;
 select (safe_metadata->>'occurrenceId')::uuid into v_replay_id from public.workshop_audit_events
  where command_key=p_command_key and event_type='occurrence_published';
 if v_replay_id is not null then
  select * into v_occurrence from public.workshop_occurrences where workshop_occurrence_id=v_replay_id;
  return to_jsonb(v_occurrence);
 end if;
 select * into v_occurrence from public.workshop_occurrences where workshop_occurrence_id=p_workshop_occurrence_id for update;
 if not found then raise exception 'workshop occurrence not found' using errcode='P0002'; end if;
 if v_occurrence.status not in('draft','registration_closed') then raise exception 'workshop occurrence cannot be published' using errcode='55000'; end if;
 if nullif(btrim(v_occurrence.included_materials_snapshot),'') is null then raise exception 'included materials are required' using errcode='22023'; end if;
 if nullif(btrim(v_occurrence.terms_snapshot),'') is null or nullif(btrim(v_occurrence.venue_name),'') is null
  or nullif(btrim(v_occurrence.address_line_1),'') is null or nullif(btrim(v_occurrence.locality),'') is null
  or nullif(btrim(v_occurrence.region),'') is null or nullif(btrim(v_occurrence.postal_code),'') is null then
  raise exception 'address and terms are required' using errcode='22023';
 end if;
 if not exists(select 1 from public.workshop_media m where m.is_public and m.media_role='hero'
  and nullif(btrim(m.alt_text),'') is not null and (m.workshop_occurrence_id=v_occurrence.workshop_occurrence_id
  or (m.workshop_definition_id=v_occurrence.workshop_definition_id and not exists(
   select 1 from public.workshop_media ov where ov.workshop_occurrence_id=v_occurrence.workshop_occurrence_id and ov.media_role='hero')))) then
  raise exception 'effective hero image is required' using errcode='22023';
 end if;
 if v_occurrence.stripe_enabled and not exists(
  select 1 from public.workshop_stripe_price_versions p join public.workshop_definitions d using(workshop_definition_id)
  where p.workshop_stripe_price_version_id=v_occurrence.stripe_price_version_id and p.state='active'
   and p.amount_minor=v_occurrence.price_minor and p.currency=v_occurrence.currency and d.stripe_catalog_state='ready') then
  raise exception 'Stripe catalog is not ready' using errcode='22023';
 end if;
 update public.workshop_occurrences set status='published_open',published_at=coalesce(published_at,now()),updated_by=auth.uid()
  where workshop_occurrence_id=p_workshop_occurrence_id returning * into v_occurrence;
 insert into public.workshop_audit_events(workshop_definition_id,workshop_occurrence_id,event_type,actor_type,actor_id,command_key,safe_metadata)
 values(v_occurrence.workshop_definition_id,v_occurrence.workshop_occurrence_id,'occurrence_published','internal',auth.uid(),p_command_key,jsonb_build_object('occurrenceId',v_occurrence.workshop_occurrence_id));
 return to_jsonb(v_occurrence);
end; $$;

create or replace function public.archive_workshop_occurrence(p_workshop_occurrence_id uuid,p_command_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_occurrence public.workshop_occurrences;
begin
 if not public.is_internal_crm_user() then raise exception 'not authorized' using errcode='42501'; end if;
 select * into v_occurrence from public.workshop_occurrences where workshop_occurrence_id=p_workshop_occurrence_id for update;
 if not found then raise exception 'workshop occurrence not found' using errcode='P0002'; end if;
 if v_occurrence.status not in('cancelled','rescheduled','completed') then raise exception 'only terminal workshop occurrences can be archived' using errcode='55000'; end if;
 update public.workshop_occurrences set status='archived',archived_at=now(),updated_by=auth.uid()
  where workshop_occurrence_id=p_workshop_occurrence_id returning * into v_occurrence;
 insert into public.workshop_audit_events(workshop_definition_id,workshop_occurrence_id,event_type,actor_type,actor_id,command_key,safe_metadata)
 values(v_occurrence.workshop_definition_id,v_occurrence.workshop_occurrence_id,'occurrence_archived','internal',auth.uid(),p_command_key,jsonb_build_object('occurrenceId',v_occurrence.workshop_occurrence_id));
 return to_jsonb(v_occurrence);
end; $$;

create or replace function public.delete_workshop_occurrence(p_workshop_occurrence_id uuid,p_command_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_occurrence public.workshop_occurrences;
begin
 if not public.is_internal_crm_user() then raise exception 'not authorized' using errcode='42501'; end if;
 select * into v_occurrence from public.workshop_occurrences where workshop_occurrence_id=p_workshop_occurrence_id for update;
 if not found then return jsonb_build_object('deleted',true); end if;
 if v_occurrence.status<>'draft' or v_occurrence.published_at is not null or exists(
  select 1 from public.workshop_audit_events a where a.workshop_occurrence_id=p_workshop_occurrence_id and a.event_type<>'occurrence_saved') then
  raise exception 'workshop occurrence has history' using errcode='55000';
 end if;
 delete from public.workshop_media where workshop_occurrence_id=p_workshop_occurrence_id;
 delete from public.workshop_audit_events where workshop_occurrence_id=p_workshop_occurrence_id;
 delete from public.workshop_occurrences where workshop_occurrence_id=p_workshop_occurrence_id;
 return jsonb_build_object('deleted',true,'commandKey',p_command_key);
end; $$;

revoke all on function public.save_workshop_occurrence(jsonb,uuid) from public;
revoke all on function public.publish_workshop_occurrence(uuid,uuid) from public;
revoke all on function public.archive_workshop_occurrence(uuid,uuid) from public;
revoke all on function public.delete_workshop_occurrence(uuid,uuid) from public;
grant execute on function public.save_workshop_occurrence(jsonb,uuid) to authenticated;
grant execute on function public.publish_workshop_occurrence(uuid,uuid) to authenticated;
grant execute on function public.archive_workshop_occurrence(uuid,uuid) to authenticated;
grant execute on function public.delete_workshop_occurrence(uuid,uuid) to authenticated;

create or replace function public.generate_workshop_series_occurrences(
 p_workshop_series_id uuid,p_dates jsonb,p_command_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_series public.workshop_series; v_item jsonb; v_draft jsonb; v_saved jsonb;
 v_occurrence_ids jsonb:='[]'::jsonb; v_replay_ids jsonb;
begin
 if not public.is_internal_crm_user() then raise exception 'not authorized' using errcode='42501'; end if;
 if p_command_key is null or jsonb_typeof(p_dates)<>'array' or jsonb_array_length(p_dates) not between 1 and 100 then
  raise exception 'series dates must contain between 1 and 100 occurrences' using errcode='22023';
 end if;
 select safe_metadata->'occurrenceIds' into v_replay_ids from public.workshop_audit_events
 where command_key=p_command_key and event_type='series_generated';
 if v_replay_ids is not null then
  return (select coalesce(jsonb_agg(to_jsonb(o) order by o.start_at),'[]'::jsonb)
   from public.workshop_occurrences o where o.workshop_occurrence_id in(
    select (value #>> '{}')::uuid from jsonb_array_elements(v_replay_ids)));
 end if;
 select * into v_series from public.workshop_series where workshop_series_id=p_workshop_series_id for update;
 if not found then raise exception 'workshop series not found' using errcode='P0002'; end if;
 for v_item in select value from jsonb_array_elements(p_dates) loop
  v_draft:=jsonb_set(jsonb_set(v_item,'{workshopDefinitionId}',to_jsonb(v_series.workshop_definition_id::text),true),
   '{workshopSeriesId}',to_jsonb(v_series.workshop_series_id::text),true);
  v_saved:=public.save_workshop_occurrence(v_draft,gen_random_uuid());
  v_occurrence_ids:=v_occurrence_ids||jsonb_build_array(v_saved->>'workshop_occurrence_id');
 end loop;
 insert into public.workshop_audit_events(workshop_definition_id,event_type,actor_type,actor_id,command_key,safe_metadata)
 values(v_series.workshop_definition_id,'series_generated','internal',auth.uid(),p_command_key,
  jsonb_build_object('seriesId',v_series.workshop_series_id,'occurrenceIds',v_occurrence_ids));
 return (select coalesce(jsonb_agg(to_jsonb(o) order by o.start_at),'[]'::jsonb)
  from public.workshop_occurrences o where o.workshop_occurrence_id in(
   select (value #>> '{}')::uuid from jsonb_array_elements(v_occurrence_ids)));
end; $$;

create or replace function public.apply_workshop_series_update(
 p_workshop_series_id uuid,p_occurrence_ids uuid[],p_patch jsonb,p_command_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_series public.workshop_series; v_target_ids uuid[]; v_booked_ids uuid[];
 v_confirmed_ids uuid[]:=coalesce(array(select (value #>> '{}')::uuid from jsonb_array_elements(
  coalesce(p_patch->'confirmedBookedOccurrenceIds','[]'::jsonb))),'{}'::uuid[]);
 v_material boolean:=p_patch ?| array['priceMinor','capacity','venueName','addressLine1',
  'addressLine2','locality','region','postalCode','country','terms'];
 v_replay jsonb;
begin
 if not public.is_internal_crm_user() then raise exception 'not authorized' using errcode='42501'; end if;
 if p_command_key is null or jsonb_typeof(p_patch)<>'object' then raise exception 'invalid series update' using errcode='22023'; end if;
 select safe_metadata into v_replay from public.workshop_audit_events
 where command_key=p_command_key and event_type='series_updated';
 if v_replay is not null then
  return v_replay||jsonb_build_object('occurrences',(select coalesce(jsonb_agg(to_jsonb(o) order by o.start_at),'[]'::jsonb)
   from public.workshop_occurrences o where o.workshop_occurrence_id in(
    select (value #>> '{}')::uuid from jsonb_array_elements(v_replay->'occurrenceIds'))));
 end if;
 select * into v_series from public.workshop_series where workshop_series_id=p_workshop_series_id for update;
 if not found then raise exception 'workshop series not found' using errcode='P0002'; end if;
 if p_patch->>'scope'='all_future' then
  select coalesce(array_agg(workshop_occurrence_id order by start_at),'{}'::uuid[]) into v_target_ids
  from public.workshop_occurrences where workshop_series_id=p_workshop_series_id and start_at>now()
   and status in('draft','published_open','registration_closed');
 else
  select coalesce(array_agg(workshop_occurrence_id order by start_at),'{}'::uuid[]) into v_target_ids
  from public.workshop_occurrences where workshop_series_id=p_workshop_series_id
   and workshop_occurrence_id=any(coalesce(p_occurrence_ids,'{}'::uuid[]))
   and status in('draft','published_open','registration_closed');
 end if;
 if cardinality(v_target_ids)=0 then raise exception 'series update has no eligible occurrences' using errcode='22023'; end if;
 select coalesce(array_agg(distinct workshop_occurrence_id),'{}'::uuid[]) into v_booked_ids
 from public.workshop_audit_events where workshop_occurrence_id=any(v_target_ids)
  and event_type in('booking_created','booking_confirmed','manual_booking_created');
 if coalesce((p_patch->>'previewOnly')::boolean,false) then
  return jsonb_build_object('previewOnly',true,'occurrenceIds',to_jsonb(v_target_ids),'bookedOccurrenceIds',to_jsonb(v_booked_ids));
 end if;
 if v_material and not v_booked_ids<@v_confirmed_ids then
  raise exception 'booked occurrence confirmation required' using errcode='55000',detail=array_to_string(v_booked_ids,',');
 end if;
 update public.workshop_occurrences set
  title_snapshot=case when p_patch?'title' then btrim(p_patch->>'title') else title_snapshot end,
  advertising_line_snapshot=case when p_patch?'advertisingLine' then btrim(p_patch->>'advertisingLine') else advertising_line_snapshot end,
  description_snapshot=case when p_patch?'description' then btrim(p_patch->>'description') else description_snapshot end,
  included_materials_snapshot=case when p_patch?'includedMaterials' then btrim(p_patch->>'includedMaterials') else included_materials_snapshot end,
  terms_snapshot=case when p_patch?'terms' then btrim(p_patch->>'terms') else terms_snapshot end,
  terms_version=case when p_patch?'termsVersion' then (p_patch->>'termsVersion')::integer else terms_version end,
  venue_name=case when p_patch?'venueName' then btrim(p_patch->>'venueName') else venue_name end,
  address_line_1=case when p_patch?'addressLine1' then btrim(p_patch->>'addressLine1') else address_line_1 end,
  address_line_2=case when p_patch?'addressLine2' then nullif(btrim(p_patch->>'addressLine2'),'') else address_line_2 end,
  locality=case when p_patch?'locality' then btrim(p_patch->>'locality') else locality end,
  region=case when p_patch?'region' then btrim(p_patch->>'region') else region end,
  postal_code=case when p_patch?'postalCode' then btrim(p_patch->>'postalCode') else postal_code end,
  country=case when p_patch?'country' then upper(btrim(p_patch->>'country')) else country end,
  capacity=case when p_patch?'capacity' then (p_patch->>'capacity')::integer else capacity end,
  per_booking_limit=case when p_patch?'perBookingLimit' then (p_patch->>'perBookingLimit')::integer else per_booking_limit end,
  price_minor=case when p_patch?'priceMinor' then (p_patch->>'priceMinor')::bigint else price_minor end,
  stripe_price_version_id=case when p_patch?'stripePriceVersionId' then nullif(p_patch->>'stripePriceVersionId','')::uuid else stripe_price_version_id end,
  stripe_enabled=case when p_patch?'stripeEnabled' then (p_patch->>'stripeEnabled')::boolean else stripe_enabled end,
  venmo_enabled=case when p_patch?'venmoEnabled' then (p_patch->>'venmoEnabled')::boolean else venmo_enabled end,
  waitlist_enabled=case when p_patch?'waitlistEnabled' then (p_patch->>'waitlistEnabled')::boolean else waitlist_enabled end,
  updated_by=auth.uid() where workshop_occurrence_id=any(v_target_ids);
 insert into public.workshop_audit_events(workshop_definition_id,event_type,actor_type,actor_id,command_key,safe_metadata)
 values(v_series.workshop_definition_id,'series_updated','internal',auth.uid(),p_command_key,jsonb_build_object(
  'seriesId',p_workshop_series_id,'occurrenceIds',to_jsonb(v_target_ids),'bookedOccurrenceIds',to_jsonb(v_booked_ids),
  'changedFields',(select coalesce(jsonb_agg(key order by key),'[]'::jsonb) from jsonb_object_keys(p_patch) key
   where key not in('scope','previewOnly','confirmedBookedOccurrenceIds')))) returning safe_metadata into v_replay;
 return v_replay||jsonb_build_object('occurrences',(select coalesce(jsonb_agg(to_jsonb(o) order by o.start_at),'[]'::jsonb)
  from public.workshop_occurrences o where o.workshop_occurrence_id=any(v_target_ids)));
end; $$;

revoke all on function public.generate_workshop_series_occurrences(uuid,jsonb,uuid) from public;
revoke all on function public.apply_workshop_series_update(uuid,uuid[],jsonb,uuid) from public;
grant execute on function public.generate_workshop_series_occurrences(uuid,jsonb,uuid) to authenticated;
grant execute on function public.apply_workshop_series_update(uuid,uuid[],jsonb,uuid) to authenticated;

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
 case when o.registration_closes_at<=now() then 'closed' else 'available' end,
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
select jsonb_build_object(
'slug',o.slug,'title',o.title_snapshot,'advertisingLine',o.advertising_line_snapshot,
'theme',d.theme,'heroImageUrl',hero.public_url,'heroAltText',hero.alt_text,
'lifecycleStatus',o.status,'description',o.description_snapshot,
'includedMaterials',o.included_materials_snapshot,'accessibilityGuidance',d.accessibility_guidance,
'contactGuidance',d.contact_guidance,'terms',o.terms_snapshot,'termsVersion',o.terms_version,
'startAt',o.start_at,'endAt',o.end_at,'timezone',o.timezone,'venueName',o.venue_name,
'addressLine1',o.address_line_1,'addressLine2',o.address_line_2,'locality',o.locality,
'region',o.region,'postalCode',o.postal_code,'country',o.country,'priceMinor',o.price_minor,
'currency',o.currency,'perBookingLimit',o.per_booking_limit,'stripeEnabled',o.stripe_enabled,
'venmoEnabled',o.venmo_enabled,'waitlistEligible',false,
'availability',case when o.status<>'published_open' or o.registration_closes_at<=now() then 'closed' else 'available' end,
'isFeatured',o.is_featured,'featuredOrder',o.featured_order,'updatedAt',o.updated_at,
'seoStatus',case when o.status in('cancelled','rescheduled') and o.status_page_expires_at<=now() then 'redirect'
 when o.status in('cancelled','rescheduled') then 'noindex' else 'index' end,
'replacementUrl',case when replacement.slug is not null then '/workshops/'||replacement.slug else null end,
'redirectUrl',case when o.status_page_expires_at<=now() then coalesce('/workshops/'||replacement.slug,'/workshops') else null end,
'media',coalesce((select jsonb_agg(jsonb_build_object('role',wm.media_role,'url',wm.public_url,
 'altText',wm.alt_text,'displayOrder',wm.display_order)
 order by case wm.media_role when 'hero' then 0 else 1 end,wm.display_order)
 from public.workshop_media wm where wm.is_public and(
  wm.workshop_occurrence_id=o.workshop_occurrence_id or(
   wm.workshop_definition_id=o.workshop_definition_id and not exists(
    select 1 from public.workshop_media ov where ov.workshop_occurrence_id=o.workshop_occurrence_id
     and ov.media_role=wm.media_role)))),'[]'::jsonb))
from public.workshop_occurrences o join public.workshop_definitions d using(workshop_definition_id)
join lateral(select wm.public_url,wm.alt_text from public.workshop_media wm
 where wm.is_public and wm.media_role='hero' and(
  wm.workshop_occurrence_id=o.workshop_occurrence_id or(
   wm.workshop_occurrence_id is null and wm.workshop_definition_id=o.workshop_definition_id))
 order by(wm.workshop_occurrence_id is not null) desc limit 1) hero on true
left join public.workshop_occurrences replacement on replacement.workshop_occurrence_id=o.replacement_occurrence_id
where o.slug=p_slug and o.status in('published_open','registration_closed','cancelled','rescheduled','completed');
$$;

revoke all on function public.get_public_workshop_listing() from public;
revoke all on function public.get_public_workshop_occurrence(text) from public;
grant execute on function public.get_public_workshop_listing() to anon,authenticated;
grant execute on function public.get_public_workshop_occurrence(text) to anon,authenticated;
