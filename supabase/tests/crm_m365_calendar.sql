-- Run after 20260927010000_crm_m365_calendar.sql in an isolated pgTAP database.
begin;
select no_plan();

select has_function('public','crm_calendar_source_title',array['text','uuid'], 'one canonical source-title helper exists');
select has_function('public','list_crm_calendar_items',array['date','date'], 'month-bounded CRM projection exists');
select has_function('public','get_crm_calendar_item_details',array['text','text'], 'live item details exist');
select ok(not has_function_privilege('anon','public.list_crm_calendar_items(date,date)','EXECUTE'), 'anonymous calendar reads are denied');
select ok(not has_function_privilege('anon','public.get_crm_calendar_item_details(text,text)','EXECUTE'), 'anonymous details are denied');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,
  email_confirmed_at,created_at,updated_at)
values('43000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','calendar-test@example.invalid','',now(),now(),now());
insert into public.profiles(id,email,is_active)
values('43000000-0000-4000-8000-000000000001','calendar-test@example.invalid',true)
on conflict(id) do update set is_active = true;
insert into public.user_roles(user_id, role) values ('43000000-0000-4000-8000-000000000001', 'staff')
on conflict(user_id,role) do nothing;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,
  email_confirmed_at,created_at,updated_at)
values('43000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','calendar-admin-test@example.invalid','',now(),now(),now());
insert into public.profiles(id,email,is_active)
values('43000000-0000-4000-8000-000000000002','calendar-admin-test@example.invalid',true)
on conflict(id) do update set is_active = true;
insert into public.user_roles(user_id,role)
values('43000000-0000-4000-8000-000000000002','admin')
on conflict(user_id,role) do nothing;

do $$
declare v_service public.service_type;
begin
  select enumlabel::public.service_type into v_service from pg_enum
  where enumtypid='public.service_type'::regtype order by enumsortorder limit 1;
  insert into public.leads(lead_id,service_type,first_name,last_name,partner_first_name,email,
    event_date,consultation_scheduled_at,guest_count)
  values('43000000-0000-4000-8000-000000000010',v_service,'Ada','Example','Bea','calendar@example.test',
    '2026-10-17','2026-10-05T14:00:00Z',85);
  insert into public.contacts(contact_id,first_name,last_name)
  values('43000000-0000-4000-8000-000000000011','Ada','Example');
  insert into public.projects(project_id,project_name,service_type,event_date,source_lead_id,primary_contact_id,guest_count)
  values('43000000-0000-4000-8000-000000000012','Ada event',v_service,'2026-10-17',
    '43000000-0000-4000-8000-000000000010','43000000-0000-4000-8000-000000000011',85);
  insert into public.project_payment_records(project_payment_record_id,project_id,payment_kind,due_date,
    status,amount_due,amount_paid,target_amount,credited_principal,outstanding_amount,fulfillment_state)
  values('43000000-0000-4000-8000-000000000013','43000000-0000-4000-8000-000000000012',
    'deposit','2026-10-09','partially_paid',120,20,120,20,100,'partially_paid');
end $$;

insert into public.workshop_definitions(workshop_definition_id,title,theme,advertising_line,description,
  included_materials,default_terms,default_terms_version)
values('43000000-0000-4000-8000-000000000014','Autumn Arrangements','seasonal',
  'Arrange together','Test workshop','Flowers','Terms',1);
insert into public.workshop_occurrences(workshop_occurrence_id,workshop_definition_id,slug,status,
  title_snapshot,advertising_line_snapshot,description_snapshot,included_materials_snapshot,
  terms_snapshot,terms_version,venue_name,address_line_1,locality,region,postal_code,
  timezone,local_start,local_end,utc_offset_minutes,start_at,end_at,
  registration_opens_at,registration_closes_at,capacity,per_booking_limit,price_minor)
values('43000000-0000-4000-8000-000000000015','43000000-0000-4000-8000-000000000014',
  'autumn-arrangements-calendar-test','draft','Autumn Arrangements','Arrange together',
  'Test workshop','Flowers','Terms',1,'Studio','23 Gilman Rd','Hope Valley','RI','02832',
  'America/New_York','2026-10-20 14:00','2026-10-20 16:00',-240,
  '2026-10-20T18:00:00Z','2026-10-20T20:00:00Z',
  '2026-10-01T00:00:00Z','2026-10-19T00:00:00Z',12,4,5000);

set local role authenticated;
set local request.jwt.claims = '{"sub":"43000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(jsonb_array_length(public.list_crm_calendar_items('2026-10-01','2026-11-01')),5,
  'lead, project, consultation, installment, and draft workshop all appear');
select is((select count(*)::integer from jsonb_array_elements(public.list_crm_calendar_items('2026-10-01','2026-11-01')) item
  where item->>'sourceType'='workshop' and item->>'title'='Autumn Arrangements - Workshop'),1,
  'workshop title has canonical format');
select is((select count(*)::integer from jsonb_array_elements(public.list_crm_calendar_items('2026-10-01','2026-11-01')) item
  where item->>'sourceType'='consultation' and item->>'title' like 'Ada & Bea - Consultation'),1,
  'consultation title includes both first names');
select is((select count(*)::integer from jsonb_array_elements(public.list_crm_calendar_items('2026-10-01','2026-11-01')) item
  where item->>'sourceType'='installment' and item->>'title'='Ada & Bea - Deposit'),1,
  'installment title uses the obligation kind');
select is((select count(*)::integer from jsonb_array_elements(public.list_crm_calendar_items('2026-10-01','2026-11-01')) item
  where item->>'sourceType'='installment' and item ? 'outstandingAmount'),0,
  'month projection omits payment amounts');
select is((public.get_crm_calendar_item_details('installment','43000000-0000-4000-8000-000000000013')->>'outstandingAmount')::numeric,
  100::numeric, 'detail reads the current outstanding amount');
select is((public.get_crm_calendar_item_details('consultation','43000000-0000-4000-8000-000000000010')->>'end')::timestamptz,
  '2026-10-05T15:00:00Z'::timestamptz, 'consultation display end is one hour later');
select is((public.get_crm_calendar_item_details('lead_event','43000000-0000-4000-8000-000000000010')->>'guestCount')::integer,
  85,'lead details read current guest count');
select is(public.get_crm_calendar_item_details('project_event','43000000-0000-4000-8000-000000000012')->>'clientFirstName',
  'Ada','project details join the current primary contact');
select is((public.get_crm_calendar_item_details('workshop','43000000-0000-4000-8000-000000000015')->>'capacity')::integer,
  12,'workshop details read capacity');
select is((select item->>'timezone' from jsonb_array_elements(public.list_crm_calendar_items('2026-10-01','2026-11-01')) item
  where item->>'sourceType'='workshop'),'America/New_York',
  'month projection keeps the workshop timezone for timed rendering');
select throws_ok($$select public.get_crm_calendar_item_details('workshop',
  '43000000-0000-4000-8000-000000000099')$$,
  'P0002','calendar_item_not_found','deleted or missing item details return not found');
select is(jsonb_array_length(public.list_crm_calendar_items('2026-11-01','2026-12-01')),0,
  'half-open range excludes other months');
select throws_ok($$select public.list_crm_calendar_items('2026-11-01','2026-10-01')$$,
  '22023', 'invalid_calendar_range', 'reversed range is rejected');

reset role;
insert into public.workshop_occurrences(workshop_occurrence_id,workshop_definition_id,slug,status,
  title_snapshot,advertising_line_snapshot,description_snapshot,included_materials_snapshot,
  terms_snapshot,terms_version,venue_name,address_line_1,locality,region,postal_code,
  timezone,local_start,local_end,utc_offset_minutes,start_at,end_at,
  registration_opens_at,registration_closes_at,capacity,per_booking_limit,price_minor)
values('43000000-0000-4000-8000-000000000017','43000000-0000-4000-8000-000000000014',
  'autumn-arrangements-calendar-overlap','draft','Multi-day Workshop','Arrange together',
  'Test workshop','Flowers','Terms',1,'Studio','23 Gilman Rd','Hope Valley','RI','02832',
  'America/New_York','2026-09-30 14:00','2026-10-02 16:00',-240,
  '2026-09-30T18:00:00Z','2026-10-02T20:00:00Z',
  '2026-09-01T00:00:00Z','2026-09-29T00:00:00Z',12,4,5000);
set local role authenticated;
select is((select count(*)::integer from jsonb_array_elements(
  public.list_crm_calendar_items('2026-10-01','2026-11-01')) item
  where item->>'sourceId'='43000000-0000-4000-8000-000000000017'),1,
  'multi-day workshop overlapping the month is included after its start month');
reset role;
delete from public.workshop_occurrences
  where workshop_occurrence_id='43000000-0000-4000-8000-000000000017';
update public.project_payment_records set status='paid',amount_paid=120,
  credited_principal=120,outstanding_amount=0,fulfillment_state='paid',
  fulfilled_at=now(),paid_date=now(),payment_method='check'
  where project_payment_record_id='43000000-0000-4000-8000-000000000013';
set local role authenticated;
select is(public.get_crm_calendar_item_details('installment',
  '43000000-0000-4000-8000-000000000013')->>'status','paid',
  'paid installment status is current when details open');
select is((public.get_crm_calendar_item_details('installment',
  '43000000-0000-4000-8000-000000000013')->>'outstandingAmount')::numeric,
  0::numeric,'paid installment details show zero outstanding');
reset role;
update public.project_payment_records set status='partially_paid',amount_paid=20,
  credited_principal=20,outstanding_amount=100,fulfillment_state='partially_paid',
  fulfilled_at=null,paid_date=null,payment_method=null
  where project_payment_record_id='43000000-0000-4000-8000-000000000013';
update public.leads set status='declined'
  where lead_id='43000000-0000-4000-8000-000000000010';
update public.projects set status='canceled'
  where project_id='43000000-0000-4000-8000-000000000012';
set local role authenticated;
select is((select (item->>'isInactive')::boolean from jsonb_array_elements(
  public.list_crm_calendar_items('2026-10-01','2026-11-01')) item
  where item->>'sourceType'='lead_event'),true,'declined lead remains visible but inactive');
select is((select (item->>'isInactive')::boolean from jsonb_array_elements(
  public.list_crm_calendar_items('2026-10-01','2026-11-01')) item
  where item->>'sourceType'='project_event'),true,'canceled project remains visible but inactive');
reset role;
update public.leads set status='new'
  where lead_id='43000000-0000-4000-8000-000000000010';
update public.projects set status='awaiting_deposit'
  where project_id='43000000-0000-4000-8000-000000000012';
update public.leads set partner_first_name=null
  where lead_id='43000000-0000-4000-8000-000000000010';
set local role authenticated;
select like((select item->>'title' from jsonb_array_elements(public.list_crm_calendar_items('2026-10-01','2026-11-01')) item
  where item->>'sourceType'='lead_event'),'Ada - %','missing partner omits the ampersand');
select is((select item->>'title' from jsonb_array_elements(public.list_crm_calendar_items('2026-10-01','2026-11-01')) item
  where item->>'sourceType'='consultation'),'Ada - Consultation','consultation uses the same partner fallback');
reset role;
update public.contacts set first_name='' where contact_id='43000000-0000-4000-8000-000000000011';
update public.leads set first_name='' where lead_id='43000000-0000-4000-8000-000000000010';
set local role authenticated;
select like((select item->>'title' from jsonb_array_elements(public.list_crm_calendar_items('2026-10-01','2026-11-01')) item
  where item->>'sourceType'='project_event'),'Ada event - %','project name replaces a missing client name');
select is((select item->>'title' from jsonb_array_elements(public.list_crm_calendar_items('2026-10-01','2026-11-01')) item
  where item->>'sourceType'='installment'),'Ada event - Deposit','installment uses the project-name fallback');
reset role;
update public.contacts set first_name='Ada' where contact_id='43000000-0000-4000-8000-000000000011';
update public.leads set first_name='Ada',partner_first_name='Bea'
  where lead_id='43000000-0000-4000-8000-000000000010';
update public.leads set converted_project_id='43000000-0000-4000-8000-000000000012'
where lead_id='43000000-0000-4000-8000-000000000010';
set local role authenticated;
select is(jsonb_array_length(public.list_crm_calendar_items('2026-10-01','2026-11-01')),4,
  'converted lead event is suppressed but consultation history remains');

set local request.jwt.claims = '{"sub":"43000000-0000-4000-8000-000000000099","role":"authenticated"}';
select throws_ok($$select public.list_crm_calendar_items('2026-10-01','2026-11-01')$$,
  '42501', 'forbidden', 'non-internal user cannot list CRM calendar');
select throws_ok($$select public.get_crm_calendar_item_details('project_event','43000000-0000-4000-8000-000000000012')$$,
  '42501', 'forbidden', 'non-internal user cannot read details');

reset role;
select ok((select relrowsecurity from pg_class where oid='public.crm_m365_calendar_connections'::regclass),
  'connection metadata has RLS');
select ok((select relrowsecurity from pg_class where oid='public.crm_m365_imported_occurrences'::regclass),
  'sanitized imported cache has RLS');
select ok(not has_table_privilege('authenticated','public.crm_m365_event_associations','SELECT'),
  'browser cannot read Graph association identifiers');
select ok(not has_table_privilege('authenticated','public.crm_m365_calendar_connections','INSERT'),
  'browser cannot mutate the shared connection table');
select ok(not has_table_privilege('authenticated','public.crm_m365_imported_occurrences','UPDATE'),
  'browser cannot mutate sanitized Microsoft cache rows');
select ok(not has_function_privilege('authenticated','public.queue_crm_calendar_month(date,uuid)','EXECUTE'),
  'month queue is service-only');
select ok(pg_get_functiondef('public.queue_crm_calendar_month(date,uuid)'::regprocedure) !~* 'net\.http|fetch\(',
  'month queue performs no network dispatch');
set local role authenticated;
set local request.jwt.claims = '{"sub":"43000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public.is_calendar_integration_admin(),false,'staff cannot manage calendar integration');
set local request.jwt.claims = '{"sub":"43000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(public.is_calendar_integration_admin(),true,'administrator can manage calendar integration');
reset role;

insert into public.crm_m365_calendar_connections(connection_id,tenant_id,mailbox_user_id,
  mailbox_upn,calendar_id,calendar_name,is_primary,status,connected_at)
values('43000000-0000-4000-8000-000000000020','sandbox-tenant','calendar@example.test',
  'calendar@example.test','business-calendar','Business Calendar',true,'connected',now());
insert into public.crm_m365_event_associations(connection_id,source_type,source_id,
  graph_event_id,transaction_id,state)
values('43000000-0000-4000-8000-000000000020','project_event',
  '43000000-0000-4000-8000-000000000012','linked-1','txn-1','active');
select is(public.connect_crm_m365_calendar('sandbox-tenant','calendar@example.test',
  'calendar@example.test','business-calendar','Business Calendar',true,
  'America/New_York','43000000-0000-4000-8000-000000000002')->>'connectionId',
  '43000000-0000-4000-8000-000000000020','same-calendar reconnect reuses the connection');
select is((select count(*)::integer from public.crm_m365_event_associations),1,
  'same-calendar reconnect preserves the existing Graph association');
select throws_ok($$select public.connect_crm_m365_calendar('sandbox-tenant',
  'calendar@example.test','calendar@example.test','different-calendar',
  'Second Calendar',false,'America/New_York',
  '43000000-0000-4000-8000-000000000002')$$,
  '23505','calendar_already_connected','a second active calendar is rejected');
select ok((select count(*) from public.crm_m365_calendar_outbox)>0,
  'connection seed queues dated sources for export');
select throws_ok($$insert into public.crm_m365_event_associations(
  connection_id,source_type,source_id,graph_event_id,transaction_id,state)
  values('43000000-0000-4000-8000-000000000020','lead_event',
  '43000000-0000-4000-8000-000000000010','linked-1','txn-duplicate','active')$$,
  '23505',null,'one Graph event cannot link to two CRM sources');
create temporary table crm_outbox_claim as
  select jsonb_array_elements(public.claim_crm_m365_outbox(1)) item;
select is((select count(*)::integer from crm_outbox_claim),1,
  'one coalesced outbox generation can be leased');
select public.enqueue_crm_calendar_source((item->>'source_type')::text,
  (item->>'source_id')::uuid) from crm_outbox_claim;
select public.ack_crm_m365_outbox((item->>'outbox_id')::uuid,
  (item->>'generation')::bigint,true) from crm_outbox_claim;
select is((select q.state from public.crm_m365_calendar_outbox q
  join crm_outbox_claim c on q.outbox_id=(c.item->>'outbox_id')::uuid),
  'pending','an old successful generation leaves a newer source change queued');
delete from public.crm_m365_sync_runs where trigger='manual';
select is(public.queue_crm_calendar_month('2026-10-01','43000000-0000-4000-8000-000000000001')->>'status',
  'queued','first month view queues one durable range run');
select is(public.queue_crm_calendar_month('2026-10-01','43000000-0000-4000-8000-000000000001')->>'coalesced',
  'true','duplicate view coalesces pending work');
select is((select count(*)::integer from public.crm_m365_sync_runs where trigger='range_request'),1,
  'coalescing does not create duplicate runs');
create temporary table crm_calendar_claim as select public.claim_crm_m365_sync_run() payload;
select is((select payload->>'claimed' from crm_calendar_claim),'true','worker lease claims queued range');
select is(public.claim_crm_m365_sync_run()->>'claimed','false',
  'another worker cannot overlap the active connection lease');
select is(public.commit_crm_m365_month_scan(
  (select (payload->>'runId')::uuid from crm_calendar_claim),
  (select (payload->>'owner')::uuid from crm_calendar_claim),
  '2026-10-01','full',
  '[{"id":"public-1","startAt":"2026-10-21T14:00:00Z","endAt":"2026-10-21T15:00:00Z","localStartDate":"2026-10-21","localEndDate":"2026-10-22","isAllDay":false,"isPrivate":false,"isCanceled":true,"title":"Canceled supplier meeting","location":"Studio"},{"id":"private-1","startAt":"2026-10-22T14:00:00Z","endAt":"2026-10-22T15:00:00Z","localStartDate":"2026-10-22","localEndDate":"2026-10-23","isAllDay":false,"isPrivate":true,"isCanceled":true,"title":"Secret meeting","location":"Secret venue"},{"id":"linked-1","startAt":"2026-10-17T14:00:00Z","endAt":"2026-10-17T15:00:00Z","localStartDate":"2026-10-17","localEndDate":"2026-10-18","isAllDay":false,"isPrivate":false,"isCanceled":false,"title":"Mirrored project"}]'::jsonb,
  null),2,'complete range scan atomically imports two minimized occurrences');
select is((select display_title from public.crm_m365_imported_occurrences where graph_occurrence_id='private-1'),
  'Private event','private source subject is discarded before persistence');
select is((select location from public.crm_m365_imported_occurrences where graph_occurrence_id='private-1'),
  null::text,'private source location is discarded before persistence');
select throws_ok($$insert into public.crm_m365_imported_occurrences(
  connection_id,graph_occurrence_id,start_at,end_at,local_start_date,local_end_date,
  is_all_day,display_title,is_private) values(
  '43000000-0000-4000-8000-000000000020','invalid-private',
  '2026-10-23T14:00:00Z','2026-10-23T15:00:00Z','2026-10-23','2026-10-24',
  false,'Leaked title',true)$$, '23514', null, 'private row constraint rejects a leaked title');

set local role authenticated;
set local request.jwt.claims = '{"sub":"43000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::integer from jsonb_array_elements(public.list_crm_calendar_items('2026-10-01','2026-11-01')) item
  where item->>'sourceType'='microsoft'),2,'CRM sees sanitized Microsoft-only occurrences');
select is((select item->>'status' from jsonb_array_elements(public.list_crm_calendar_items('2026-10-01','2026-11-01')) item
  where item->>'title'='Canceled supplier meeting'),'Canceled','public canceled occurrence is visibly inactive');
select is((select item->>'status' from jsonb_array_elements(public.list_crm_calendar_items('2026-10-01','2026-11-01')) item
  where item->>'title'='Private event'),null::text,'canceled private occurrence has no status label');
select is((select item->>'timezone' from jsonb_array_elements(public.list_crm_calendar_items('2026-10-01','2026-11-01')) item
  where item->>'title'='Canceled supplier meeting'),'America/New_York',
  'imported timed items use the selected business timezone');

reset role;
select is(public.commit_crm_m365_month_scan(
  (select (payload->>'runId')::uuid from crm_calendar_claim),
  (select (payload->>'owner')::uuid from crm_calendar_claim),
  '2026-10-01','full','[]'::jsonb,null),0,
  'completed empty range scan removes absent Microsoft-only occurrences');
select is((select count(*)::integer from public.crm_m365_imported_occurrences),0,
  'full reconciliation removes stale imported rows');
select is(public.commit_crm_m365_month_scan(
  (select (payload->>'runId')::uuid from crm_calendar_claim),
  (select (payload->>'owner')::uuid from crm_calendar_claim),
  '2026-10-01','delta',
  '[{"id":"delta-1","startAt":"2026-10-23T14:00:00Z","endAt":"2026-10-23T15:00:00Z","localStartDate":"2026-10-23","localEndDate":"2026-10-24","isAllDay":false,"isPrivate":false,"isCanceled":false,"title":"Supplier meeting","location":"Studio"}]'::jsonb,
  'https://graph.microsoft.com/v1.0/opaque'),1,
  'delta scan imports one changed occurrence');
select is((select opaque_delta_link from public.crm_m365_sync_months
  where month_start='2026-10-01'),'https://graph.microsoft.com/v1.0/opaque',
  'delta cursor advances only with the completed scan');
select is(public.finish_crm_m365_sync_run(
  (select (payload->>'runId')::uuid from crm_calendar_claim),
  (select (payload->>'owner')::uuid from crm_calendar_claim),'succeeded'),true,
  'successful run releases its lease');
set local role authenticated;
set local request.jwt.claims = '{"sub":"43000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public.get_crm_calendar_status('2026-10-01')->>'monthImportStatus',
  'current','fresh completed import is current for this month');
reset role;
update public.crm_m365_sync_months set last_successful_scan_at=now()-interval '20 minutes'
  where month_start='2026-10-01';
select is(public.queue_crm_calendar_month('2026-10-01',
  '43000000-0000-4000-8000-000000000001')->>'status','queued',
  'stale month requests a fresh scan');
update public.crm_m365_sync_runs set requested_at=now()-interval '3 minutes'
  where trigger='range_request' and status='queued';
set local role authenticated;
set local request.jwt.claims = '{"sub":"43000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public.get_crm_calendar_status('2026-10-01')->>'monthImportStatus',
  'delayed','range request becomes delayed after two minutes');
reset role;
insert into public.crm_m365_sync_runs(connection_id,trigger,requested_month,requested_by)
values('43000000-0000-4000-8000-000000000020','range_request','2026-11-01',
  '43000000-0000-4000-8000-000000000001'),
  ('43000000-0000-4000-8000-000000000020','range_request','2026-12-01',
  '43000000-0000-4000-8000-000000000001');
select is(public.queue_crm_calendar_month('2027-01-01',
  '43000000-0000-4000-8000-000000000001')->>'status','rate_limited',
  'a fourth distinct pending on-demand month is rate limited');
delete from public.crm_m365_sync_runs where requested_month in ('2026-11-01','2026-12-01')
  and status='queued';
insert into public.crm_m365_sync_runs(connection_id,trigger,requested_month,
  requested_by,status,finished_at)
select '43000000-0000-4000-8000-000000000020','range_request',
  (date_trunc('month',now() at time zone 'America/New_York')::date
    + make_interval(months=>offset_month))::date,
  '43000000-0000-4000-8000-000000000001','succeeded',now()
from generate_series(3,26) offset_month;
select is(public.queue_crm_calendar_month(
  (date_trunc('month',now() at time zone 'America/New_York')::date
    + interval '30 months')::date,
  '43000000-0000-4000-8000-000000000001')->>'status','rate_limited',
  'the twenty-fifth distinct month request in one hour is rate limited');
insert into public.crm_m365_sync_months(connection_id,month_start,strategy,last_requested_at)
select '43000000-0000-4000-8000-000000000020',
  (date_trunc('month',now() at time zone 'America/New_York')::date
    + make_interval(months=>offset_month))::date,
  'primary_delta',now()-make_interval(mins=>offset_month)
from generate_series(3,15) offset_month
on conflict(connection_id,month_start) do update
  set last_requested_at=excluded.last_requested_at;
select is((select count(*)::integer from public.list_crm_m365_tracked_months()),15,
  'scheduled selector includes current and adjacent months plus twelve recent months');
insert into public.crm_m365_sync_conflicts(conflict_id,association_id,
  remote_change_key,changed_fields,remote_title,is_remote_private)
select '43000000-0000-4000-8000-000000000030',association_id,
  'etag-2',array['start'],'Unexpected remote title',false
from public.crm_m365_event_associations where graph_event_id='linked-1';
select throws_ok($$insert into public.crm_m365_sync_conflicts(
  association_id,remote_change_key,changed_fields)
  select association_id,'etag-3',array['title']
  from public.crm_m365_event_associations where graph_event_id='linked-1'$$,
  '23505',null,'only one open conflict exists for a linked event');
select throws_ok($$select public.list_crm_m365_conflicts(
  '43000000-0000-4000-8000-000000000001')$$,
  '42501','forbidden','staff cannot review administrator conflicts');
select is(jsonb_array_length(public.list_crm_m365_conflicts(
  '43000000-0000-4000-8000-000000000002')),1,
  'administrator can review one open linked-event conflict');
select throws_ok($$select public.restore_crm_m365_conflict(
  '43000000-0000-4000-8000-000000000030',
  '43000000-0000-4000-8000-000000000001')$$,
  '42501','forbidden','staff cannot restore a linked Microsoft event');
select is(public.restore_crm_m365_conflict(
  '43000000-0000-4000-8000-000000000030',
  '43000000-0000-4000-8000-000000000002')->>'status',
  'queued','administrator restoration only queues the current CRM projection');
select is((select status from public.crm_m365_sync_conflicts
  where conflict_id='43000000-0000-4000-8000-000000000030'),
  'restoring','conflict remains tracked until the worker confirms restoration');
select throws_ok($$select public.disconnect_crm_m365_calendar(
  '43000000-0000-4000-8000-000000000001')$$,
  '42501','forbidden','staff cannot disconnect the shared calendar');
insert into public.workshop_occurrences(workshop_occurrence_id,workshop_definition_id,slug,status,
  title_snapshot,advertising_line_snapshot,description_snapshot,included_materials_snapshot,
  terms_snapshot,terms_version,venue_name,address_line_1,locality,region,postal_code,
  timezone,local_start,local_end,utc_offset_minutes,start_at,end_at,
  registration_opens_at,registration_closes_at,capacity,per_booking_limit,price_minor)
values('43000000-0000-4000-8000-000000000016','43000000-0000-4000-8000-000000000014',
  'autumn-arrangements-calendar-replacement','draft','Autumn Arrangements','Arrange together',
  'Test workshop','Flowers','Terms',1,'Studio','23 Gilman Rd','Hope Valley','RI','02832',
  'America/New_York','2026-10-27 14:00','2026-10-27 16:00',-240,
  '2026-10-27T18:00:00Z','2026-10-27T20:00:00Z',
  '2026-10-01T00:00:00Z','2026-10-26T00:00:00Z',12,4,5000);
update public.workshop_occurrences set status='rescheduled',
  replacement_occurrence_id='43000000-0000-4000-8000-000000000016'
  where workshop_occurrence_id='43000000-0000-4000-8000-000000000015';
select is((select count(*)::integer from public.crm_m365_calendar_outbox
  where source_type='workshop' and source_id in (
    '43000000-0000-4000-8000-000000000015',
    '43000000-0000-4000-8000-000000000016')),2,
  'workshop reschedule queues both old and replacement identities');
delete from public.workshop_occurrences
  where workshop_occurrence_id='43000000-0000-4000-8000-000000000015';
select is(public.get_crm_m365_export_projection('workshop',
  '43000000-0000-4000-8000-000000000015')->>'eligible','false',
  'deleted workshop is ineligible for export');
select is((select state from public.crm_m365_calendar_outbox
  where source_type='workshop' and source_id='43000000-0000-4000-8000-000000000015'),
  'pending','source deletion leaves a durable mirror retirement tombstone');
create temporary table crm_revoked_claim as select public.claim_crm_m365_sync_run() payload;
select is((select payload->>'claimed' from crm_revoked_claim),'true',
  'worker can claim the next queued synchronization');
select is(public.finish_crm_m365_sync_run(
  (select (payload->>'runId')::uuid from crm_revoked_claim),
  (select (payload->>'owner')::uuid from crm_revoked_claim),
  'failed','authorization_lost'),true,
  'revoked Microsoft access is recorded as a failed run');
set local role authenticated;
set local request.jwt.claims = '{"sub":"43000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public.get_crm_calendar_status('2026-10-01')->>'connectionStatus',
  'action_required','revoked access visibly requests administrator attention');
reset role;
select is(public.connect_crm_m365_calendar('sandbox-tenant','calendar@example.test',
  'calendar@example.test','business-calendar','Business Calendar',true,
  'America/New_York','43000000-0000-4000-8000-000000000002')->>'connectionId',
  '43000000-0000-4000-8000-000000000020','same-calendar reconnect clears the authorization hold');
select is(public.disconnect_crm_m365_calendar('43000000-0000-4000-8000-000000000002')->>'status',
  'disconnected','admin disconnect marks shared connection inactive');
set local role authenticated;
set local request.jwt.claims = '{"sub":"43000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::integer from jsonb_array_elements(public.list_crm_calendar_items('2026-10-01','2026-11-01')) item
  where item->>'sourceType'='microsoft'),0,'disconnect withholds cached Microsoft occurrences');
select is(public.get_crm_calendar_status('2026-10-01')->>'staleMirrorWarning',
  'true','disconnected linked Outlook copies receive a stale warning');

select * from finish();
rollback;
