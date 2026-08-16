begin;
select no_plan();

select ok(to_regclass('public.workshop_definitions') is not null, 'workshop definitions exist');
select has_column('public','workshop_definitions','is_reusable','definitions expose reusable-concept state');
select has_column('public','workshop_definitions','reusable_retired_at','definitions distinguish staged concepts from retired concepts');
select ok(to_regclass('public.workshop_series') is not null, 'workshop series exist');
select ok(to_regclass('public.workshop_occurrences') is not null, 'workshop occurrences exist');
select ok(to_regclass('public.workshop_media') is not null, 'workshop media exists');
select ok(to_regclass('public.workshop_stripe_price_versions') is not null, 'Stripe price versions exist');
select ok(to_regclass('public.workshop_audit_events') is not null, 'shared workshop audit exists');
select has_index('public','workshop_occurrences','idx_workshop_occurrences_public','public occurrence query is indexed');
select has_index('public','workshop_media','uq_workshop_media_occurrence_hero','occurrence hero is unique');
select has_function('public','get_public_workshop_listing',array[]::text[],'public listing projection exists');
select has_function('public','get_public_workshop_occurrence',array['text'],'public detail projection exists');
select ok((select relrowsecurity from pg_class where oid='public.workshop_occurrences'::regclass),'occurrences enforce RLS');
select ok((select relrowsecurity from pg_class where oid='public.workshop_media'::regclass),'media metadata enforces RLS');
select ok(not has_table_privilege('anon','public.workshop_occurrences','SELECT'),'anonymous users cannot read occurrence base rows');
select ok(not has_table_privilege('anon','public.workshop_media','SELECT'),'anonymous users cannot read media base rows');
select ok(has_function_privilege('anon','public.get_public_workshop_listing()','EXECUTE'),'anonymous users can execute safe listing projection');
select ok(has_function_privilege('anon','public.get_public_workshop_occurrence(text)','EXECUTE'),'anonymous users can execute safe detail projection');
select is((select public from storage.buckets where id='workshop-media'),true,'workshop media bucket is public');
select is((select file_size_limit from storage.buckets where id='workshop-media'),10485760::bigint,'media upload size is bounded');
select ok(exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='internal users upload workshop media'),'internal upload storage policy exists');
select has_function('public','save_workshop_occurrence',array['jsonb','uuid'],'occurrence save command exists');
select has_function('public','allocate_workshop_occurrence_slug',array[]::text[],'collision-safe slug allocator exists');
select has_function(
  'public','get_public_workshop_occurrence_route',array['text','text'],
  'public occurrence route resolves a series slug and local date'
);
select has_trigger('public','workshop_occurrences','allocate_workshop_occurrence_slug','occurrence writes allocate unique slugs');
select has_function('public','publish_workshop_occurrence',array['uuid','uuid'],'publication command exists');
select has_function('public','archive_workshop_occurrence',array['uuid','uuid'],'archive command exists');
select has_function('public','delete_workshop_occurrence',array['uuid','uuid'],'guarded delete command exists');
select ok(
  pg_get_functiondef('public.save_workshop_occurrence(jsonb,uuid)'::regprocedure)
    like '%at time zone%',
  'save command validates explicit timezone and UTC offset resolution'
);
select ok(
  pg_get_functiondef('public.publish_workshop_occurrence(uuid,uuid)'::regprocedure)
    like '%effective hero%',
  'publication requires effective public hero media'
);
select ok(
  pg_get_functiondef('public.promote_published_workshop_definition()'::regprocedure)
    like '%reusable_retired_at is null%',
  'publication cannot reactivate an intentionally retired reusable concept'
);
select ok(
  pg_get_functiondef('public.publish_workshop_occurrence(uuid,uuid)'::regprocedure)
    like '%included materials%',
  'publication requires included-materials copy'
);
select ok(
  pg_get_functiondef('public.delete_workshop_occurrence(uuid,uuid)'::regprocedure)
    like '%history%',
  'delete command guards historical occurrences'
);

insert into public.profiles(id, is_active)
values ('20000000-0000-4000-8000-000000000001', true)
on conflict (id) do update set is_active = true;
insert into public.user_roles(user_id, role)
values ('20000000-0000-4000-8000-000000000001', 'admin')
on conflict (user_id, role) do nothing;
insert into public.workshop_definitions(
  workshop_definition_id, title, theme, advertising_line, description,
  included_materials, default_terms, default_terms_version
) values (
  '20000000-0000-4000-8000-000000000010',
  'Garden Centerpiece', 'seasonal', 'Design with the season.',
  'A hands-on floral workshop.', 'Flowers, vessel, and tools.',
  'Published cancellation terms.', 1
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$select public.save_workshop_occurrence(
    '{
      "workshopDefinitionId":"20000000-0000-4000-8000-000000000010",
      "slug":"garden-centerpiece-2026-11-08",
      "title":"Garden Centerpiece",
      "advertisingLine":"Design with the season.",
      "description":"A hands-on floral workshop.",
      "includedMaterials":"Flowers, vessel, and tools.",
      "terms":"Published cancellation terms.",
      "termsVersion":1,
      "venueName":"Black Begonia Studio",
      "addressLine1":"100 Flower Lane",
      "locality":"Richmond",
      "region":"VA",
      "postalCode":"23220",
      "country":"US",
      "timezone":"America/New_York",
      "localStart":"2026-11-08T13:00:00",
      "localEnd":"2026-11-08T15:00:00",
      "utcOffsetMinutes":-300,
      "registrationOpensAt":"2026-09-01T12:00:00Z",
      "registrationClosesAt":"2026-11-08T17:00:00Z",
      "capacity":12,
      "perBookingLimit":4,
      "priceMinor":8500,
      "currency":"USD",
      "stripeEnabled":false,
      "venmoEnabled":true,
      "waitlistEnabled":true,
      "isFeatured":true
    }'::jsonb,
    '20000000-0000-4000-8000-000000000020'
  )$$,
  'valid explicit-offset occurrence saves'
);
select is(
  (select count(*)::integer from public.workshop_occurrences
   where slug = 'garden-centerpiece-2026-11-08'),
  1,
  'save command creates one occurrence'
);
select lives_ok(
  $$select public.save_workshop_occurrence(
    jsonb_build_object(
      'workshopOccurrenceId',
        (select workshop_occurrence_id from public.workshop_occurrences
         where slug='garden-centerpiece-2026-11-08'),
      'workshopDefinitionId','20000000-0000-4000-8000-000000000010',
      'slug','garden-centerpiece-2026-11-08',
      'title','Garden Centerpiece',
      'advertisingLine','Design with the season.',
      'description','A hands-on floral workshop.',
      'includedMaterials','Flowers, vessel, and tools.',
      'terms','Published cancellation terms.',
      'termsVersion',1,
      'venueName','Black Begonia Studio',
      'addressLine1','100 Flower Lane',
      'locality','Richmond','region','VA','postalCode','23220','country','US',
      'timezone','America/New_York',
      'localStart','2026-11-08T13:00:00','localEnd','2026-11-08T15:00:00',
      'utcOffsetMinutes',-300,
      'registrationOpensAt','2026-09-01T12:00:00Z',
      'registrationClosesAt','2026-11-08T17:00:00Z',
      'capacity',12,'perBookingLimit',4,'priceMinor',8500,'currency','USD',
      'stripeEnabled',false,'venmoEnabled',true,'waitlistEnabled',true,
      'isFeatured',true
    ),
    '20000000-0000-4000-8000-000000000020'
  )$$,
  'replayed save command is safe'
);
select is(
  (select count(*)::integer from public.workshop_occurrences
   where slug = 'garden-centerpiece-2026-11-08'),
  1,
  'save replay does not duplicate an occurrence'
);
select lives_ok(
  $$select public.save_workshop_occurrence(
    '{
      "workshopDefinitionId":"20000000-0000-4000-8000-000000000010",
      "slug":"garden-centerpiece-2026-11-08",
      "title":"Garden Centerpiece",
      "advertisingLine":"Design with the season.",
      "description":"A hands-on floral workshop.",
      "includedMaterials":"Flowers, vessel, and tools.",
      "terms":"Published cancellation terms.",
      "termsVersion":1,
      "venueName":"Black Begonia Studio",
      "addressLine1":"100 Flower Lane",
      "locality":"Richmond",
      "region":"VA",
      "postalCode":"23220",
      "country":"US",
      "timezone":"America/New_York",
      "localStart":"2026-11-08T13:00:00",
      "localEnd":"2026-11-08T15:00:00",
      "utcOffsetMinutes":-300,
      "registrationOpensAt":"2026-09-01T12:00:00Z",
      "registrationClosesAt":"2026-11-08T17:00:00Z",
      "capacity":12,
      "perBookingLimit":4,
      "priceMinor":8500,
      "currency":"USD",
      "stripeEnabled":false,
      "venmoEnabled":true,
      "waitlistEnabled":true,
      "isFeatured":true
    }'::jsonb,
    '20000000-0000-4000-8000-000000000022'
  )$$,
  'a colliding generated slug receives a suffix instead of failing the series'
);
select is(
  (select slug from public.workshop_occurrences
   where slug = 'garden-centerpiece-2026-11-08-2'),
  'garden-centerpiece-2026-11-08-2',
  'the first collision receives the deterministic -2 suffix'
);
select throws_ok(
  $$select public.save_workshop_occurrence(
    jsonb_build_object(
      'workshopDefinitionId','20000000-0000-4000-8000-000000000010',
      'slug','invalid-dst-offset','title','Invalid DST','advertisingLine','Invalid',
      'description','Invalid offset test','includedMaterials','Materials',
      'terms','Terms','termsVersion',1,'venueName','Studio',
      'addressLine1','100 Flower Lane','locality','Richmond','region','VA',
      'postalCode','23220','country','US','timezone','America/New_York',
      'localStart','2026-07-10T13:00:00','localEnd','2026-07-10T15:00:00',
      'utcOffsetMinutes',-300,'registrationOpensAt','2026-06-01T12:00:00Z',
      'registrationClosesAt','2026-07-10T16:00:00Z','capacity',12,
      'perBookingLimit',4,'priceMinor',8500,'currency','USD',
      'stripeEnabled',false,'venmoEnabled',true,'waitlistEnabled',false,
      'isFeatured',false
    ),
    '20000000-0000-4000-8000-000000000021'
  )$$,
  '22023',
  'invalid timezone offset',
  'invalid seasonal UTC offset is rejected'
);
reset role;

insert into public.workshop_media(
  workshop_occurrence_id, media_role, storage_path, public_url, alt_text,
  display_order, is_public, width, height, byte_size, mime_type
)
select workshop_occurrence_id, 'hero', 'workshops/garden/hero.webp',
  'https://example.test/workshops/garden/hero.webp',
  'Seasonal garden centerpiece', 0, true, 1600, 1000, 120000, 'image/webp'
from public.workshop_occurrences where slug='garden-centerpiece-2026-11-08';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$select public.publish_workshop_occurrence(
    (select workshop_occurrence_id from public.workshop_occurrences
     where slug='garden-centerpiece-2026-11-08'),
    '20000000-0000-4000-8000-000000000030'
  )$$,
  'valid occurrence publishes'
);
select is(
  (select status from public.workshop_occurrences
   where slug='garden-centerpiece-2026-11-08'),
  'published_open',
  'publication changes lifecycle state'
);
select is(
  (select is_reusable from public.workshop_definitions
   where workshop_definition_id='20000000-0000-4000-8000-000000000010'),
  true,
  'successful publication promotes its staged definition into the reusable concept library'
);
select throws_ok(
  $$select public.delete_workshop_occurrence(
    (select workshop_occurrence_id from public.workshop_occurrences
     where slug='garden-centerpiece-2026-11-08'),
    '20000000-0000-4000-8000-000000000031'
  )$$,
  '55000',
  'workshop occurrence has history',
  'published occurrence deletion is blocked'
);
reset role;

select has_function(
  'public','generate_workshop_series_occurrences',array['uuid','jsonb','uuid'],
  'atomic series generation command exists'
);
select has_function(
  'public','apply_workshop_series_update',array['uuid','uuid[]','jsonb','uuid'],
  'previewed series update command exists'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into public.workshop_series(
  workshop_series_id, workshop_definition_id, series_label,
  default_capacity, default_price_minor, default_currency,
  default_venue_name, default_address_line_1, default_locality,
  default_region, default_postal_code, default_country, default_timezone
) values (
  '20000000-0000-4000-8000-000000000040',
  '20000000-0000-4000-8000-000000000010',
  'Garden Centerpiece Series', 12, 8500, 'USD',
  'Black Begonia Studio', '100 Flower Lane', 'Richmond',
  'VA', '23220', 'US', 'America/New_York'
);

select lives_ok(
  $$select public.generate_workshop_series_occurrences(
    '20000000-0000-4000-8000-000000000040',
    jsonb_build_array(
      jsonb_build_object(
        'slug','garden-series-2027-01-16','title','Garden Centerpiece',
        'advertisingLine','Design with the season.',
        'description','A hands-on floral workshop.',
        'includedMaterials','Flowers, vessel, and tools.',
        'terms','Published cancellation terms.','termsVersion',1,
        'venueName','Black Begonia Studio','addressLine1','100 Flower Lane',
        'locality','Richmond','region','VA','postalCode','23220','country','US',
        'timezone','America/New_York','localStart','2027-01-16T13:00:00',
        'localEnd','2027-01-16T15:00:00','utcOffsetMinutes',-300,
        'registrationOpensAt','2026-12-01T12:00:00Z',
        'registrationClosesAt','2027-01-16T17:00:00Z',
        'capacity',12,'perBookingLimit',4,'priceMinor',8500,'currency','USD',
        'stripeEnabled',false,'venmoEnabled',true,'waitlistEnabled',true,
        'isFeatured',false
      ),
      jsonb_build_object(
        'slug','garden-series-2027-06-19','title','Garden Centerpiece',
        'advertisingLine','Design with the season.',
        'description','A hands-on floral workshop.',
        'includedMaterials','Flowers, vessel, and tools.',
        'terms','Published cancellation terms.','termsVersion',1,
        'venueName','Black Begonia Studio','addressLine1','100 Flower Lane',
        'locality','Richmond','region','VA','postalCode','23220','country','US',
        'timezone','America/New_York','localStart','2027-06-19T13:00:00',
        'localEnd','2027-06-19T15:00:00','utcOffsetMinutes',-240,
        'registrationOpensAt','2027-05-01T12:00:00Z',
        'registrationClosesAt','2027-06-19T16:00:00Z',
        'capacity',12,'perBookingLimit',4,'priceMinor',8500,'currency','USD',
        'stripeEnabled',false,'venmoEnabled',true,'waitlistEnabled',true,
        'isFeatured',false
      )
    ),
    '20000000-0000-4000-8000-000000000041'
  )$$,
  'series generation creates multiple dates atomically'
);
select is(
  (select count(*)::integer from public.workshop_occurrences
   where workshop_series_id='20000000-0000-4000-8000-000000000040'),
  2,
  'series generation creates one independent row per date'
);
select is(
  (select count(distinct workshop_occurrence_id)::integer
   from public.workshop_occurrences
   where workshop_series_id='20000000-0000-4000-8000-000000000040'),
  2,
  'generated occurrences retain independent identities'
);
select lives_ok(
  $$select public.generate_workshop_series_occurrences(
    '20000000-0000-4000-8000-000000000040','[{}]'::jsonb,
    '20000000-0000-4000-8000-000000000041'
  )$$,
  'series generation replay returns the original occurrences'
);
select is(
  (select count(*)::integer from public.workshop_occurrences
   where workshop_series_id='20000000-0000-4000-8000-000000000040'),
  2,
  'series replay never duplicates dates'
);

select lives_ok(
  $$select public.apply_workshop_series_update(
    '20000000-0000-4000-8000-000000000040',
    array[(select workshop_occurrence_id from public.workshop_occurrences
      where slug='garden-series-2027-01-16')],
    '{"scope":"selected","priceMinor":9500}'::jsonb,
    '20000000-0000-4000-8000-000000000042'
  )$$,
  'selected occurrence update applies independently'
);
select is(
  (select price_minor from public.workshop_occurrences
   where slug='garden-series-2027-01-16'),
  9500::bigint,
  'selected occurrence price becomes an explicit exception'
);
select lives_ok(
  $$select public.apply_workshop_series_update(
    '20000000-0000-4000-8000-000000000040',
    '{}'::uuid[],
    '{"scope":"all_future","venueName":"Garden Annex"}'::jsonb,
    '20000000-0000-4000-8000-000000000043'
  )$$,
  'all-future scope applies to eligible future occurrences'
);
select is(
  (select count(*)::integer from public.workshop_occurrences
   where workshop_series_id='20000000-0000-4000-8000-000000000040'
     and venue_name='Garden Annex'),
  2,
  'all-future scope selected both future dates'
);
select is(
  (select price_minor from public.workshop_occurrences
   where slug='garden-series-2027-01-16'),
  9500::bigint,
  'patch-only bulk updates preserve an existing price exception'
);
reset role;

insert into public.workshop_audit_events(
  workshop_definition_id, workshop_occurrence_id, event_type, actor_type,
  safe_metadata
) select
  workshop_definition_id, workshop_occurrence_id, 'booking_confirmed',
  'customer', '{}'::jsonb
from public.workshop_occurrences where slug='garden-series-2027-06-19';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}';
select ok(
  (public.apply_workshop_series_update(
    '20000000-0000-4000-8000-000000000040',
    array[(select workshop_occurrence_id from public.workshop_occurrences
      where slug='garden-series-2027-06-19')],
    '{"scope":"selected","capacity":14,"previewOnly":true}'::jsonb,
    '20000000-0000-4000-8000-000000000044'
  )->'bookedOccurrenceIds') @> jsonb_build_array(
    (select workshop_occurrence_id::text from public.workshop_occurrences
     where slug='garden-series-2027-06-19')
  ),
  'series preview identifies affected booked occurrences'
);
select throws_ok(
  $$select public.apply_workshop_series_update(
    '20000000-0000-4000-8000-000000000040',
    array[(select workshop_occurrence_id from public.workshop_occurrences
      where slug='garden-series-2027-06-19')],
    '{"scope":"selected","capacity":14}'::jsonb,
    '20000000-0000-4000-8000-000000000045'
  )$$,
  '55000',
  'booked occurrence confirmation required',
  'material booked-occurrence update requires explicit confirmation'
);
select lives_ok(
  $$select public.apply_workshop_series_update(
    '20000000-0000-4000-8000-000000000040',
    array[(select workshop_occurrence_id from public.workshop_occurrences
      where slug='garden-series-2027-06-19')],
    jsonb_build_object(
      'scope','selected','capacity',14,
      'confirmedBookedOccurrenceIds',jsonb_build_array(
        (select workshop_occurrence_id::text from public.workshop_occurrences
         where slug='garden-series-2027-06-19')
      )
    ),
    '20000000-0000-4000-8000-000000000046'
  )$$,
  'confirmed material change applies to a booked occurrence'
);
reset role;

insert into public.workshop_media(
  workshop_definition_id, media_role, storage_path, public_url, alt_text,
  display_order, is_public, width, height, byte_size, mime_type
) values (
  '20000000-0000-4000-8000-000000000010', 'hero',
  'workshops/garden/default-hero.webp',
  'https://example.test/workshops/garden/default-hero.webp',
  'Florist demonstrating a seasonal centerpiece', 0, true,
  1600, 1000, 125000, 'image/webp'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$select public.publish_workshop_occurrence(
    (select workshop_occurrence_id from public.workshop_occurrences
     where slug='garden-series-2027-01-16'),
    '20000000-0000-4000-8000-000000000050'
  )$$,
  'a generated future occurrence publishes with inherited hero media'
);
select lives_ok(
  $$select public.publish_workshop_occurrence(
    (select workshop_occurrence_id from public.workshop_occurrences
     where slug='garden-series-2027-06-19'),
    '20000000-0000-4000-8000-000000000051'
  )$$,
  'a second generated future occurrence publishes'
);
reset role;

update public.workshop_occurrences set
  is_featured=true, featured_order=0,
  registration_opens_at=now()-interval '1 day'
where slug='garden-series-2027-01-16';
update public.workshop_occurrences set
  status='cancelled', cancelled_at=now(), status_page_expires_at=now()+interval '30 days'
where slug='garden-series-2027-06-19';

select is(
  (select array_agg("slug" order by "startAt")
   from public.get_public_workshop_listing()),
  array['garden-centerpiece-2026-11-08','garden-series-2027-01-16']::text[],
  'upcoming listing is chronological and excludes drafts, closed dates, and cancelled sources'
);
select is(
  (select "featuredOrder" from public.get_public_workshop_listing()
   where "slug"='garden-series-2027-01-16'),
  0::smallint,
  'listing preserves explicit featured carousel ordering'
);
select is(
  (select "seriesSlug" from public.get_public_workshop_listing()
   where "slug"='garden-series-2027-01-16'),
  'garden-centerpiece',
  'listing groups public workshop series by a stable title slug'
);
select is(
  (select "workshopDate" from public.get_public_workshop_listing()
   where "slug"='garden-series-2027-01-16'),
  '2027-01-16',
  'listing exposes the occurrence local date used by public routes'
);
select is(
  public.get_public_workshop_occurrence_route(
    'garden-centerpiece','2027-01-16'
  )->>'slug',
  'garden-series-2027-01-16',
  'series/date route resolves the authoritative occurrence'
);
select is(
  (select count(*)::integer from public.get_public_workshop_sitemap()
   where "slug"='garden-centerpiece'),
  1,
  'sitemap exposes one canonical series page regardless of occurrence count'
);
select is(
  (select "heroImageUrl" from public.get_public_workshop_listing()
   where "slug"='garden-centerpiece-2026-11-08'),
  'https://example.test/workshops/garden/hero.webp',
  'occurrence hero overrides definition hero in public listing'
);
select is(
  public.get_public_workshop_occurrence('garden-series-2027-06-19')->>'lifecycleStatus',
  'cancelled',
  'a retained cancelled status page remains directly accessible'
);
select is(
  public.get_public_workshop_occurrence('garden-series-2027-06-19')->>'seoStatus',
  'noindex',
  'retained cancelled status pages are explicitly noindex'
);
select is(
  public.get_public_workshop_occurrence('garden-series-2027-01-16')->>'availability',
  'available',
  'pre-booking public availability is derived from lifecycle and registration'
);
select ok(
  public.get_public_workshop_occurrence('garden-series-2027-01-16')
    ?& array['heroImageUrl','heroAltText','media','terms','lifecycleStatus'],
  'public detail contains required resolved presentation fields'
);
select ok(
  not (
    public.get_public_workshop_occurrence('garden-series-2027-01-16')
      ?| array['contact_email','contact_phone','created_by','updated_by','stripe_price_version_id']
  ),
  'public detail excludes internal and customer-private fields'
);

select * from finish();
rollback;
