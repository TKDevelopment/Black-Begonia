-- CRM calendar read model. Microsoft synchronization tables and commands are added below
-- before this migration is applied to any environment.
create or replace function public.crm_calendar_source_title(p_source_type text, p_source_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v_first text;
  v_partner text;
  v_type text;
  v_names text;
begin
  if p_source_type in ('lead_event', 'consultation') then
    select nullif(btrim(l.first_name), ''), nullif(btrim(l.partner_first_name), ''),
      l.service_type::text into v_first, v_partner, v_type
    from public.leads l where l.lead_id = p_source_id;
  elsif p_source_type in ('project_event', 'installment') then
    select coalesce(nullif(btrim(c.first_name), ''), nullif(btrim(l.first_name), ''),
        nullif(btrim(p.project_name), '')),
      coalesce(nullif(btrim(pc.partner_first_name), ''), nullif(btrim(l.partner_first_name), '')),
      p.service_type::text
    into v_first, v_partner, v_type
    from public.projects p
    left join public.contacts c on c.contact_id = p.primary_contact_id
    left join public.leads l on l.lead_id = p.source_lead_id
    left join lateral (
      select c2.first_name as partner_first_name
      from public.project_contacts x join public.contacts c2 on c2.contact_id = x.contact_id
      where x.project_id = p.project_id and x.relationship_type = 'partner'
        and x.contact_id is distinct from p.primary_contact_id
      order by x.created_at, x.project_contact_id limit 1
    ) pc on true
    where p.project_id = case when p_source_type = 'installment' then
      (select r.project_id from public.project_payment_records r where r.project_payment_record_id = p_source_id)
      else p_source_id end;
  elsif p_source_type = 'workshop' then
    select nullif(btrim(title_snapshot), '') into v_first
    from public.workshop_occurrences where workshop_occurrence_id = p_source_id;
    return coalesce(v_first, 'Untitled') || ' - Workshop';
  else
    return 'Calendar item';
  end if;
  v_first := coalesce(v_first, 'Client');
  v_names := v_first || case when v_partner is null then '' else ' & ' || v_partner end;
  if p_source_type = 'consultation' then
    return v_names || ' - Consultation';
  elsif p_source_type = 'installment' then
    return v_names || ' - ' || coalesce((
      select case r.payment_kind when 'deposit' then 'Deposit'
        when 'final_payment' then 'Final Payment' when 'revision_balance' then 'Revision Balance'
        else initcap(replace(r.payment_kind, '_', ' ')) end
      from public.project_payment_records r where r.project_payment_record_id = p_source_id
    ), 'Installment');
  end if;
  return v_names || ' - ' ||
    initcap(replace(coalesce(v_type, 'Event'), '_', ' '));
end;
$$;

create or replace function public.crm_calendar_source_item(p_source_type text, p_source_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb;
  d date;
  s timestamptz;
  e timestamptz;
  v_status text;
  v_destination text;
  v_color text;
  v_inactive boolean;
begin
  if p_source_type = 'lead_event' then
    select l.event_date, l.status::text, '/admin/leads/' || l.lead_id::text,
      l.status::text in ('declined', 'converted'),
      jsonb_build_object('clientFirstName', l.first_name, 'partnerFirstName', l.partner_first_name,
        'serviceType', l.service_type::text, 'guestCount', l.guest_count,
        'venueName', coalesce(l.reception_venue_name, l.ceremony_venue_name),
        'venueAddress', coalesce(l.reception_venue_address, l.ceremony_venue_address))
    into d, v_status, v_destination, v_inactive, v
    from public.leads l where l.lead_id = p_source_id and l.converted_project_id is null;
    v_color := 'lead';
  elsif p_source_type = 'project_event' then
    select p.event_date, p.status::text, '/admin/projects/' || p.project_id::text,
      p.status::text in ('canceled', 'completed'),
      jsonb_build_object('serviceType', p.service_type::text, 'guestCount', p.guest_count,
        'venueName', coalesce(p.reception_venue_name, p.ceremony_venue_name),
        'venueAddress', coalesce(p.reception_venue_address, p.ceremony_venue_address))
    into d, v_status, v_destination, v_inactive, v
    from public.projects p where p.project_id = p_source_id;
    v_color := 'project';
  elsif p_source_type = 'consultation' then
    select l.consultation_scheduled_at, l.status::text,
      '/admin/leads/' || l.lead_id::text, l.consultation_completed_at is not null,
      jsonb_build_object('clientFirstName', l.first_name, 'partnerFirstName', l.partner_first_name,
        'serviceType', l.service_type::text, 'guestCount', l.guest_count,
        'venueName', coalesce(l.reception_venue_name, l.ceremony_venue_name))
    into s, v_status, v_destination, v_inactive, v
    from public.leads l where l.lead_id = p_source_id;
    if s is not null then d := (s at time zone 'America/New_York')::date; e := s + interval '1 hour'; end if;
    v_color := 'consultation';
  elsif p_source_type = 'installment' then
    select r.due_date, r.fulfillment_state, '/admin/projects/' || r.project_id::text,
      r.fulfillment_state in ('paid', 'waived', 'canceled'),
      jsonb_build_object('paymentKind', r.payment_kind, 'targetAmount', r.target_amount,
        'creditedAmount', r.credited_principal, 'outstandingAmount', r.outstanding_amount,
        'paidDate', r.paid_date, 'paymentMethod', r.payment_method)
    into d, v_status, v_destination, v_inactive, v
    from public.project_payment_records r where r.project_payment_record_id = p_source_id;
    v_color := 'installment';
  elsif p_source_type = 'workshop' then
    select o.start_at, o.end_at, o.local_start::date, o.status,
      '/admin/workshops/' || o.workshop_occurrence_id::text,
      o.status in ('cancelled', 'rescheduled', 'completed', 'archived'),
      jsonb_build_object('venueName', o.venue_name, 'venueAddress',
        concat_ws(', ', o.address_line_1, o.locality, o.region, o.postal_code),
        'timezone', o.timezone, 'capacity', o.capacity)
    into s, e, d, v_status, v_destination, v_inactive, v
    from public.workshop_occurrences o where o.workshop_occurrence_id = p_source_id;
    v_color := 'workshop';
  else
    return null;
  end if;
  if d is null then return null; end if;
  if p_source_type in ('project_event', 'installment') then
    v := v || coalesce((
      select jsonb_build_object(
        'clientFirstName', coalesce(nullif(btrim(c.first_name),''),
          nullif(btrim(l.first_name),''),nullif(btrim(p.project_name),'')),
        'partnerFirstName', coalesce(nullif(btrim(pc.first_name),''),
          nullif(btrim(l.partner_first_name),'')))
      from public.projects p
      left join public.contacts c on c.contact_id = p.primary_contact_id
      left join public.leads l on l.lead_id = p.source_lead_id
      left join lateral (
        select c2.first_name from public.project_contacts x
        join public.contacts c2 on c2.contact_id = x.contact_id
        where x.project_id = p.project_id and x.relationship_type = 'partner'
          and x.contact_id is distinct from p.primary_contact_id
        order by x.created_at, x.project_contact_id limit 1
      ) pc on true
      where p.project_id = case when p_source_type = 'installment' then
        (select r.project_id from public.project_payment_records r where r.project_payment_record_id = p_source_id)
        else p_source_id end
    ), '{}'::jsonb);
  end if;
  return jsonb_build_object('id', p_source_type || ':' || p_source_id::text,
    'sourceType', p_source_type, 'sourceId', p_source_id, 'title',
    public.crm_calendar_source_title(p_source_type, p_source_id),
    'start', case when s is null then to_jsonb(d::text) else to_jsonb(s) end,
    'end', case when s is null then to_jsonb((d + 1)::text) else to_jsonb(e) end,
    'allDay', s is null, 'localDate', d, 'status', v_status,
    'isInactive', coalesce(v_inactive, false), 'colorType', v_color,
    'destination', v_destination) || coalesce(v, '{}'::jsonb);
end;
$$;

create index if not exists crm_calendar_workshop_local_range
  on public.workshop_occurrences (local_start, local_end);

create or replace function public.list_crm_calendar_items(p_start_date date, p_end_date date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_internal_crm_user() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date <= p_start_date
    or p_end_date > p_start_date + 62 then
    raise exception 'invalid_calendar_range' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(item - 'clientFirstName' - 'partnerFirstName' - 'serviceType'
      - 'guestCount' - 'venueName' - 'venueAddress' - 'paymentKind' - 'targetAmount'
      - 'creditedAmount' - 'outstandingAmount' - 'paidDate' - 'paymentMethod'
      - 'timezone' - 'capacity' order by item->>'start', item->>'id'), '[]'::jsonb)
    into result from (
      select public.crm_calendar_source_item('lead_event', l.lead_id) item
      from public.leads l where l.event_date >= p_start_date and l.event_date < p_end_date
        and l.converted_project_id is null
      union all
      select public.crm_calendar_source_item('project_event', p.project_id)
      from public.projects p where p.event_date >= p_start_date and p.event_date < p_end_date
      union all
      select public.crm_calendar_source_item('consultation', l.lead_id)
      from public.leads l where l.consultation_scheduled_at >= (p_start_date::timestamp at time zone 'America/New_York')
        and l.consultation_scheduled_at < (p_end_date::timestamp at time zone 'America/New_York')
      union all
      select public.crm_calendar_source_item('installment', r.project_payment_record_id)
      from public.project_payment_records r where r.due_date >= p_start_date and r.due_date < p_end_date
      union all
      select public.crm_calendar_source_item('workshop', o.workshop_occurrence_id)
      from public.workshop_occurrences o where o.local_start < p_end_date::timestamp
        and o.local_end > p_start_date::timestamp
    ) rows where item is not null;
  return result;
end;
$$;

create or replace function public.get_crm_calendar_item_details(p_source_type text, p_source_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_item jsonb;
begin
  if not public.is_internal_crm_user() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_source_type not in ('lead_event', 'project_event', 'consultation', 'installment', 'workshop')
    or p_source_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'invalid_calendar_identity' using errcode = '22023';
  end if;
  v_item := public.crm_calendar_source_item(p_source_type, p_source_id::uuid);
  if v_item is null then raise exception 'calendar_item_not_found' using errcode = 'P0002'; end if;
  return v_item;
end;
$$;

revoke all on function public.crm_calendar_source_title(text, uuid) from public, anon, authenticated;
revoke all on function public.crm_calendar_source_item(text, uuid) from public, anon, authenticated;
revoke all on function public.list_crm_calendar_items(date, date) from public, anon;
revoke all on function public.get_crm_calendar_item_details(text, text) from public, anon;
grant execute on function public.crm_calendar_source_title(text, uuid) to service_role;
grant execute on function public.crm_calendar_source_item(text, uuid) to service_role;
grant execute on function public.list_crm_calendar_items(date, date) to authenticated;
grant execute on function public.get_crm_calendar_item_details(text, text) to authenticated;

-- Server-owned Microsoft synchronization state. Raw identifiers, cursors, and payload
-- correlation values are never granted to browser roles.
create table public.crm_m365_calendar_connections (
  connection_id uuid primary key default gen_random_uuid(),
  tenant_id text not null, mailbox_user_id text not null, mailbox_upn text not null,
  calendar_id text not null, calendar_name text not null, is_primary boolean not null,
  business_timezone text not null default 'America/New_York',
  status text not null default 'disconnected' check (status in ('connected','action_required','disconnected')),
  connected_by uuid null references public.profiles(id) on delete set null,
  connected_at timestamptz null, disconnected_at timestamptz null,
  last_successful_sync_at timestamptz null, last_error_code text null,
  lease_owner uuid null, lease_expires_at timestamptz null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (tenant_id, mailbox_user_id, calendar_id)
);
create unique index crm_m365_one_active_connection on public.crm_m365_calendar_connections ((true))
  where status in ('connected','action_required');

create table public.crm_m365_calendar_outbox (
  outbox_id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('lead_event','project_event','consultation','installment','workshop')),
  source_id uuid not null, generation bigint not null default 1 check (generation > 0),
  changed_at timestamptz not null default now(), attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(), last_error_code text null,
  state text not null default 'pending' check (state in ('pending','leased','blocked_conflict')),
  lease_expires_at timestamptz null, unique (source_type, source_id)
);
create index crm_m365_outbox_ready on public.crm_m365_calendar_outbox(state,next_attempt_at,lease_expires_at);

create table public.crm_m365_event_associations (
  association_id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.crm_m365_calendar_connections(connection_id) on delete restrict,
  source_type text not null check (source_type in ('lead_event','project_event','consultation','installment','workshop')),
  source_id uuid not null, graph_event_id text null, transaction_id text not null,
  last_export_fingerprint text null, last_export_change_key text null,
  state text not null default 'creating' check (state in ('creating','active','conflict','retired')),
  last_exported_at timestamptz null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (connection_id,source_type,source_id), unique(connection_id,transaction_id)
);
create unique index crm_m365_graph_association_unique on public.crm_m365_event_associations(connection_id,graph_event_id)
  where graph_event_id is not null;

create table public.crm_m365_imported_occurrences (
  connection_id uuid not null references public.crm_m365_calendar_connections(connection_id) on delete cascade,
  graph_occurrence_id text not null, series_master_id text null,
  start_at timestamptz not null, end_at timestamptz not null,
  local_start_date date not null, local_end_date date not null,
  is_all_day boolean not null, display_title text not null,
  location text null, outlook_web_url text null,
  is_private boolean not null default false,
  provider_status text not null default 'active' check (provider_status in ('active','canceled')),
  last_seen_scan_id uuid null, updated_at timestamptz not null default now(),
  primary key (connection_id,graph_occurrence_id),
  check (end_at > start_at and local_end_date > local_start_date),
  check (not is_private or (display_title = 'Private event' and location is null)),
  check (outlook_web_url is null or outlook_web_url ~ '^https://outlook\.(office|office365)\.com/'),
  check (char_length(display_title) between 1 and 240)
);
create index crm_m365_imported_range on public.crm_m365_imported_occurrences(connection_id,local_start_date,local_end_date);

create table public.crm_m365_sync_months (
  connection_id uuid not null references public.crm_m365_calendar_connections(connection_id) on delete cascade,
  month_start date not null check (extract(day from month_start)=1),
  strategy text not null check (strategy in ('primary_delta','full_reconcile')),
  opaque_delta_link text null, last_requested_at timestamptz null,
  last_successful_scan_at timestamptz null, last_error_code text null,
  retry_after_at timestamptz null, scan_generation uuid null,
  primary key(connection_id,month_start)
);
create index crm_m365_months_recent on public.crm_m365_sync_months(connection_id,last_requested_at desc);

create table public.crm_m365_sync_conflicts (
  conflict_id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.crm_m365_event_associations(association_id) on delete cascade,
  remote_change_key text null, changed_fields text[] not null default '{}',
  remote_start_at timestamptz null, remote_end_at timestamptz null,
  remote_title text null, is_remote_private boolean not null default false,
  detected_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open','restoring','resolved')),
  reviewed_by uuid null references public.profiles(id) on delete set null,
  reviewed_at timestamptz null, resolved_at timestamptz null,
  check (not is_remote_private or remote_title is null)
);
create unique index crm_m365_one_open_conflict on public.crm_m365_sync_conflicts(association_id)
  where status in ('open','restoring');

create table public.crm_m365_sync_runs (
  run_id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.crm_m365_calendar_connections(connection_id) on delete cascade,
  trigger text not null check (trigger in ('scheduled','manual','range_request')),
  requested_month date null, requested_by uuid null references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  started_at timestamptz null, finished_at timestamptz null,
  exported_count integer not null default 0, imported_count integer not null default 0,
  conflict_count integer not null default 0, last_error_code text null,
  check (trigger <> 'range_request' or requested_month is not null)
);
create index crm_m365_runs_queue on public.crm_m365_sync_runs(connection_id,status,requested_at);
create index crm_m365_runs_user_hour on public.crm_m365_sync_runs(requested_by,requested_at)
  where trigger='range_request';

alter table public.crm_m365_calendar_connections enable row level security;
alter table public.crm_m365_calendar_outbox enable row level security;
alter table public.crm_m365_event_associations enable row level security;
alter table public.crm_m365_imported_occurrences enable row level security;
alter table public.crm_m365_sync_months enable row level security;
alter table public.crm_m365_sync_conflicts enable row level security;
alter table public.crm_m365_sync_runs enable row level security;
revoke all on public.crm_m365_calendar_connections, public.crm_m365_calendar_outbox,
  public.crm_m365_event_associations, public.crm_m365_imported_occurrences,
  public.crm_m365_sync_months, public.crm_m365_sync_conflicts,
  public.crm_m365_sync_runs from public, anon, authenticated;
grant all on public.crm_m365_calendar_connections, public.crm_m365_calendar_outbox,
  public.crm_m365_event_associations, public.crm_m365_imported_occurrences,
  public.crm_m365_sync_months, public.crm_m365_sync_conflicts,
  public.crm_m365_sync_runs to service_role;

create or replace function public.is_calendar_integration_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p
    join public.user_roles r on r.user_id = p.id
    where p.id = auth.uid() and p.is_active and r.role = 'admin');
$$;
revoke all on function public.is_calendar_integration_admin() from public, anon;
grant execute on function public.is_calendar_integration_admin() to authenticated;

create or replace function public.enqueue_crm_calendar_source(p_source_type text, p_source_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_source_id is null or p_source_type not in
    ('lead_event','project_event','consultation','installment','workshop') then
    raise exception 'invalid_calendar_source' using errcode='22023';
  end if;
  insert into public.crm_m365_calendar_outbox(source_type,source_id)
  values(p_source_type,p_source_id)
  on conflict(source_type,source_id) do update set
    generation=public.crm_m365_calendar_outbox.generation+1,
    changed_at=now(), attempt_count=0, next_attempt_at=now(), last_error_code=null,
    state=case when public.crm_m365_calendar_outbox.state='blocked_conflict'
      then 'blocked_conflict' else 'pending' end,
    lease_expires_at=null;
end;
$$;

create or replace function public.enqueue_crm_calendar_source_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_project uuid; v_contact uuid; x record;
begin
  if tg_table_name='leads' then
    v_id:=case when tg_op='DELETE' then old.lead_id else new.lead_id end;
    perform public.enqueue_crm_calendar_source('lead_event',v_id);
    perform public.enqueue_crm_calendar_source('consultation',v_id);
    v_project:=case when tg_op='DELETE' then old.converted_project_id else new.converted_project_id end;
    if v_project is not null then
      perform public.enqueue_crm_calendar_source('project_event',v_project);
      for v_id in select project_payment_record_id from public.project_payment_records
        where project_id=v_project loop
        perform public.enqueue_crm_calendar_source('installment',v_id);
      end loop;
    end if;
  elsif tg_table_name='projects' then
    v_id:=case when tg_op='DELETE' then old.project_id else new.project_id end;
    perform public.enqueue_crm_calendar_source('project_event',v_id);
    for x in select project_payment_record_id from public.project_payment_records
      where project_id=v_id loop
      perform public.enqueue_crm_calendar_source('installment',x.project_payment_record_id);
    end loop;
  elsif tg_table_name='project_payment_records' then
    v_id:=case when tg_op='DELETE' then old.project_payment_record_id else new.project_payment_record_id end;
    perform public.enqueue_crm_calendar_source('installment',v_id);
  elsif tg_table_name='workshop_occurrences' then
    v_id:=case when tg_op='DELETE' then old.workshop_occurrence_id else new.workshop_occurrence_id end;
    perform public.enqueue_crm_calendar_source('workshop',v_id);
  elsif tg_table_name='contacts' then
    v_contact:=case when tg_op='DELETE' then old.contact_id else new.contact_id end;
    for x in select distinct p.project_id from public.projects p
      left join public.project_contacts pc on pc.project_id=p.project_id
      where p.primary_contact_id=v_contact or pc.contact_id=v_contact loop
      perform public.enqueue_crm_calendar_source('project_event',x.project_id);
      for v_id in select project_payment_record_id from public.project_payment_records
        where project_id=x.project_id loop
        perform public.enqueue_crm_calendar_source('installment',v_id);
      end loop;
    end loop;
  elsif tg_table_name='project_contacts' then
    v_project:=case when tg_op='DELETE' then old.project_id else new.project_id end;
    perform public.enqueue_crm_calendar_source('project_event',v_project);
    for v_id in select project_payment_record_id from public.project_payment_records
      where project_id=v_project loop
      perform public.enqueue_crm_calendar_source('installment',v_id);
    end loop;
  end if;
  return null;
end;
$$;
create trigger trg_crm_calendar_leads after insert or update or delete on public.leads
  for each row execute function public.enqueue_crm_calendar_source_change();
create trigger trg_crm_calendar_projects after insert or update or delete on public.projects
  for each row execute function public.enqueue_crm_calendar_source_change();
create trigger trg_crm_calendar_installments after insert or update or delete on public.project_payment_records
  for each row execute function public.enqueue_crm_calendar_source_change();
create trigger trg_crm_calendar_workshops after insert or update or delete on public.workshop_occurrences
  for each row execute function public.enqueue_crm_calendar_source_change();
create trigger trg_crm_calendar_contacts after update of first_name, last_name or delete on public.contacts
  for each row execute function public.enqueue_crm_calendar_source_change();
create trigger trg_crm_calendar_project_contacts after insert or update or delete on public.project_contacts
  for each row execute function public.enqueue_crm_calendar_source_change();
revoke all on function public.enqueue_crm_calendar_source(text,uuid) from public,anon,authenticated;
revoke all on function public.enqueue_crm_calendar_source_change() from public,anon,authenticated;
grant execute on function public.enqueue_crm_calendar_source(text,uuid) to service_role;

create or replace function public.requeue_crm_calendar_sources()
returns integer language plpgsql security definer set search_path = '' as $$
declare x record; v_count integer:=0;
begin
  for x in
    select 'lead_event'::text source_type, lead_id source_id from public.leads where event_date is not null
    union all select 'consultation', lead_id from public.leads where consultation_scheduled_at is not null
    union all select 'project_event', project_id from public.projects where event_date is not null
    union all select 'installment', project_payment_record_id from public.project_payment_records where due_date is not null
    union all select 'workshop', workshop_occurrence_id from public.workshop_occurrences
  loop
    perform public.enqueue_crm_calendar_source(x.source_type,x.source_id);
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.requeue_crm_calendar_sources() from public,anon,authenticated;
grant execute on function public.requeue_crm_calendar_sources() to service_role;

create or replace function public.connect_crm_m365_calendar(
  p_tenant_id text,p_mailbox_user_id text,p_mailbox_upn text,
  p_calendar_id text,p_calendar_name text,p_is_primary boolean,
  p_timezone text,p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.crm_m365_calendar_connections%rowtype; v_active uuid; v_run uuid; v_queued integer;
begin
  if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id
    where p.id=p_actor and p.is_active and r.role='admin') then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if nullif(btrim(p_tenant_id),'') is null or nullif(btrim(p_mailbox_user_id),'') is null
    or nullif(btrim(p_mailbox_upn),'') is null or nullif(btrim(p_calendar_id),'') is null
    or nullif(btrim(p_calendar_name),'') is null or nullif(btrim(p_timezone),'') is null
    or length(p_calendar_id)>512 or length(p_calendar_name)>160 then
    raise exception 'invalid_calendar_connection' using errcode='22023';
  end if;
  select connection_id into v_active from public.crm_m365_calendar_connections
    where status in ('connected','action_required') limit 1 for update;
  if v_active is not null and not exists(select 1 from public.crm_m365_calendar_connections
    where connection_id=v_active and tenant_id=p_tenant_id and mailbox_user_id=p_mailbox_user_id
      and calendar_id=p_calendar_id) then
    raise exception 'calendar_already_connected' using errcode='23505';
  end if;
  insert into public.crm_m365_calendar_connections(tenant_id,mailbox_user_id,mailbox_upn,
    calendar_id,calendar_name,is_primary,business_timezone,status,connected_by,connected_at)
  values(p_tenant_id,p_mailbox_user_id,p_mailbox_upn,p_calendar_id,p_calendar_name,
    p_is_primary,p_timezone,'connected',p_actor,now())
  on conflict(tenant_id,mailbox_user_id,calendar_id) do update set
    calendar_name=excluded.calendar_name,is_primary=excluded.is_primary,
    business_timezone=excluded.business_timezone,status='connected',
    connected_by=p_actor,connected_at=now(),disconnected_at=null,
    updated_at=now() returning * into c;
  v_queued:=public.requeue_crm_calendar_sources();
  insert into public.crm_m365_sync_runs(connection_id,trigger)
    values(c.connection_id,'manual') returning run_id into v_run;
  return jsonb_build_object('connectionId',c.connection_id,'calendarDisplayName',c.calendar_name,
    'status','connected','runId',v_run,'queuedSources',v_queued);
end;
$$;
revoke all on function public.connect_crm_m365_calendar(text,text,text,text,text,boolean,text,uuid)
  from public,anon,authenticated;
grant execute on function public.connect_crm_m365_calendar(text,text,text,text,text,boolean,text,uuid)
  to service_role;

create or replace function public.disconnect_crm_m365_calendar(p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id
    where p.id=p_actor and p.is_active and r.role='admin') then
    raise exception 'forbidden' using errcode='42501';
  end if;
  update public.crm_m365_calendar_connections set status='disconnected',
    disconnected_at=now(),lease_owner=null,lease_expires_at=null,updated_at=now()
    where status in ('connected','action_required') returning connection_id into v_id;
  if v_id is null then raise exception 'calendar_not_connected' using errcode='P0002'; end if;
  update public.crm_m365_sync_runs set status='failed',finished_at=now(),
    last_error_code='disconnected' where connection_id=v_id and status in ('queued','running');
  return jsonb_build_object('status','disconnected','staleMirrorWarning',true);
end;
$$;
revoke all on function public.disconnect_crm_m365_calendar(uuid) from public,anon,authenticated;
grant execute on function public.disconnect_crm_m365_calendar(uuid) to service_role;

create or replace function public.queue_crm_m365_manual_sync(p_actor uuid,p_month date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_connection uuid; v_run uuid;
begin
  if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id
    where p.id=p_actor and p.is_active and r.role='admin') then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_month is not null and extract(day from p_month)<>1 then
    raise exception 'invalid_calendar_month' using errcode='22023';
  end if;
  select connection_id into v_connection from public.crm_m365_calendar_connections
    where status='connected' limit 1 for update;
  if v_connection is null then raise exception 'calendar_not_connected' using errcode='P0002'; end if;
  select run_id into v_run from public.crm_m365_sync_runs
    where connection_id=v_connection and trigger='manual' and status in ('queued','running')
    order by requested_at desc limit 1;
  if v_run is null then
    insert into public.crm_m365_sync_runs(connection_id,trigger,requested_month,requested_by)
      values(v_connection,'manual',p_month,p_actor) returning run_id into v_run;
  end if;
  return jsonb_build_object('status','queued','runId',v_run);
end;
$$;
revoke all on function public.queue_crm_m365_manual_sync(uuid,date) from public,anon,authenticated;
grant execute on function public.queue_crm_m365_manual_sync(uuid,date) to service_role;

create or replace function public.get_crm_m365_export_projection(p_source_type text, p_source_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_item jsonb; v_eligible boolean:=false; v_zone text;
begin
  v_item:=public.crm_calendar_source_item(p_source_type,p_source_id);
  if v_item is null then return jsonb_build_object('eligible',false); end if;
  if p_source_type='lead_event' then
    select l.converted_project_id is null and l.status::text <> 'declined'
      into v_eligible from public.leads l where l.lead_id=p_source_id;
  elsif p_source_type='project_event' then
    select p.status::text <> 'canceled' into v_eligible
      from public.projects p where p.project_id=p_source_id;
  elsif p_source_type='consultation' then
    select l.consultation_scheduled_at is not null into v_eligible
      from public.leads l where l.lead_id=p_source_id;
  elsif p_source_type='installment' then
    select r.status not in ('canceled','waived') into v_eligible
      from public.project_payment_records r where r.project_payment_record_id=p_source_id;
  elsif p_source_type='workshop' then
    select o.status in ('published_open','registration_closed','completed','archived')
      and o.published_at is not null into v_eligible
      from public.workshop_occurrences o where o.workshop_occurrence_id=p_source_id;
  end if;
  if not coalesce(v_eligible,false) then return jsonb_build_object('eligible',false); end if;
  select c.business_timezone into v_zone from public.crm_m365_calendar_connections c
    where c.status in ('connected','action_required') order by c.connected_at desc limit 1;
  return jsonb_build_object('eligible',true,'sourceType',p_source_type,'sourceId',p_source_id,
    'title',v_item->>'title','start',v_item->>'start','end',v_item->>'end',
    'allDay',v_item->'allDay','timezone',coalesce(v_item->>'timezone',v_zone,'America/New_York'),
    'isInactive',v_item->'isInactive',
    'fingerprint',md5(concat_ws('|',v_item->>'title',v_item->>'start',v_item->>'end',
      v_item->>'allDay',v_item->>'isInactive')));
end;
$$;
revoke all on function public.get_crm_m365_export_projection(text,uuid) from public,anon,authenticated;
grant execute on function public.get_crm_m365_export_projection(text,uuid) to service_role;

create or replace function public.queue_crm_calendar_month(p_month date,p_requested_by uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.crm_m365_calendar_connections%rowtype; m public.crm_m365_sync_months%rowtype;
  v_run uuid; v_count integer; v_retry timestamptz; v_now timestamptz:=now();
begin
  if p_month is null or extract(day from p_month)<>1 or p_requested_by is null then
    raise exception 'invalid_calendar_month' using errcode='22023';
  end if;
  if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id
    where p.id=p_requested_by and p.is_active and r.role in ('admin','staff')) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select * into c from public.crm_m365_calendar_connections
    where status in ('connected','action_required') order by connected_at desc limit 1 for update;
  if c.connection_id is null or c.status <> 'connected' then
    return jsonb_build_object('status','disconnected');
  end if;
  select * into m from public.crm_m365_sync_months
    where connection_id=c.connection_id and month_start=p_month;
  if m.last_successful_scan_at >= v_now-interval '15 minutes'
    and m.last_error_code is null then
    update public.crm_m365_sync_months set last_requested_at=v_now
      where connection_id=c.connection_id and month_start=p_month;
    return jsonb_build_object('status','current');
  end if;
  select run_id into v_run from public.crm_m365_sync_runs
    where connection_id=c.connection_id and trigger='range_request'
      and requested_month=p_month and status in ('queued','running')
    order by requested_at desc limit 1;
  if v_run is not null then
    update public.crm_m365_sync_months set last_requested_at=v_now
      where connection_id=c.connection_id and month_start=p_month;
    return jsonb_build_object('status','queued','runId',v_run,'coalesced',true);
  end if;
  if not exists(select 1 from public.crm_m365_sync_runs
    where requested_by=p_requested_by and trigger='range_request' and requested_month=p_month
      and requested_at>v_now-interval '1 hour') then
    select count(distinct requested_month), min(requested_at)+interval '1 hour'
      into v_count,v_retry from public.crm_m365_sync_runs
      where requested_by=p_requested_by and trigger='range_request'
        and requested_at>v_now-interval '1 hour';
    if v_count>=24 then
      return jsonb_build_object('status','rate_limited','retryAt',v_retry);
    end if;
  end if;
  select count(*) into v_count from public.crm_m365_sync_runs
    where connection_id=c.connection_id and trigger='range_request'
      and status in ('queued','running');
  if v_count>=3 then
    return jsonb_build_object('status','rate_limited','retryAt',v_now+interval '2 minutes');
  end if;
  insert into public.crm_m365_sync_months(connection_id,month_start,strategy,last_requested_at)
    values(c.connection_id,p_month,case when c.is_primary then 'primary_delta' else 'full_reconcile' end,v_now)
    on conflict(connection_id,month_start) do update set last_requested_at=excluded.last_requested_at;
  insert into public.crm_m365_sync_runs(connection_id,trigger,requested_month,requested_by)
    values(c.connection_id,'range_request',p_month,p_requested_by) returning run_id into v_run;
  return jsonb_build_object('status','queued','runId',v_run,'coalesced',false);
end;
$$;
revoke all on function public.queue_crm_calendar_month(date,uuid) from public,anon,authenticated;
grant execute on function public.queue_crm_calendar_month(date,uuid) to service_role;

create or replace function public.list_crm_m365_tracked_months()
returns table(month_start date) language sql stable security definer set search_path = '' as $$
  with c as (select connection_id,business_timezone from public.crm_m365_calendar_connections
    where status='connected' order by connected_at desc limit 1),
  base as (select (date_trunc('month',now() at time zone c.business_timezone)::date
      + make_interval(months=>offset_month))::date as month_start from c
      cross join generate_series(-1,1) offset_month),
  recent as (select m.month_start from public.crm_m365_sync_months m join c using(connection_id)
    where m.last_requested_at>now()-interval '30 days'
      and m.month_start not in (select base.month_start from base)
    order by m.last_requested_at desc limit 12)
  select base.month_start from base union select recent.month_start from recent;
$$;
revoke all on function public.list_crm_m365_tracked_months() from public,anon,authenticated;
grant execute on function public.list_crm_m365_tracked_months() to service_role;

create or replace function public.get_crm_calendar_status(p_month date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c public.crm_m365_calendar_connections%rowtype;
  m public.crm_m365_sync_months%rowtype; r public.crm_m365_sync_runs%rowtype;
  v_month_status text:='not_loaded'; v_conflicts integer:=0; v_last_run_status text;
begin
  if not public.is_internal_crm_user() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_month is not null and extract(day from p_month)<>1 then
    raise exception 'invalid_calendar_month' using errcode='22023';
  end if;
  select * into c from public.crm_m365_calendar_connections
    order by case when status in ('connected','action_required') then 0 else 1 end,
      connected_at desc nulls last limit 1;
  if c.connection_id is not null then
    select * into r from public.crm_m365_sync_runs where connection_id=c.connection_id
      order by requested_at desc limit 1;
    v_last_run_status:=r.status;
    select count(*) into v_conflicts from public.crm_m365_sync_conflicts f
      join public.crm_m365_event_associations a on a.association_id=f.association_id
      where a.connection_id=c.connection_id and f.status in ('open','restoring');
    if p_month is not null then
      select * into m from public.crm_m365_sync_months
        where connection_id=c.connection_id and month_start=p_month;
      if c.status <> 'connected' then v_month_status:='stale';
      elsif m.connection_id is null then v_month_status:='not_loaded';
      else
        select * into r from public.crm_m365_sync_runs
          where connection_id=c.connection_id and trigger='range_request' and requested_month=p_month
          order by requested_at desc limit 1;
        if r.status in ('queued','running') and r.requested_at < now()-interval '2 minutes' then
          v_month_status:='delayed';
        elsif r.status in ('queued','running') then v_month_status:='loading';
        elsif r.status='failed' and r.requested_at>=coalesce(m.last_successful_scan_at,'-infinity'::timestamptz) then
          v_month_status:='failed';
        elsif m.last_successful_scan_at>=now()-interval '15 minutes'
          and m.last_error_code is null then v_month_status:='current';
        else v_month_status:='stale'; end if;
      end if;
    end if;
  end if;
  return jsonb_build_object(
    'connectionStatus',coalesce(c.status,'disconnected'),
    'calendarDisplayName',c.calendar_name,
    'lastSuccessfulSyncAt',c.last_successful_sync_at,
    'lastRunStatus',v_last_run_status,
    'lastErrorCode',case when c.last_error_code in
      ('graph_unavailable','graph_throttled','authorization_lost','scan_failed','export_failed')
      then c.last_error_code when c.last_error_code is not null then 'sync_unavailable' else null end,
    'openConflictCount',v_conflicts,
    'staleMirrorWarning',coalesce(c.status='disconnected' and exists(
      select 1 from public.crm_m365_event_associations a where a.connection_id=c.connection_id),false),
    'requestedMonth',p_month,'monthImportStatus',v_month_status,
    'monthLastSuccessfulScanAt',m.last_successful_scan_at);
end;
$$;
revoke all on function public.get_crm_calendar_status(date) from public,anon;
grant execute on function public.get_crm_calendar_status(date) to authenticated;

create or replace function public.claim_crm_m365_sync_run()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.crm_m365_calendar_connections%rowtype;
  r public.crm_m365_sync_runs%rowtype; v_owner uuid:=gen_random_uuid();
begin
  select * into c from public.crm_m365_calendar_connections where status='connected'
    order by connected_at desc limit 1 for update skip locked;
  if c.connection_id is null or c.lease_expires_at>now() then
    return jsonb_build_object('claimed',false);
  end if;
  update public.crm_m365_sync_runs set status='queued',started_at=null
    where connection_id=c.connection_id and status='running';
  select * into r from public.crm_m365_sync_runs
    where connection_id=c.connection_id and status='queued'
    order by requested_at limit 1 for update skip locked;
  if r.run_id is null then
    insert into public.crm_m365_sync_runs(connection_id,trigger,status,started_at)
      values(c.connection_id,'scheduled','running',now()) returning * into r;
  else
    update public.crm_m365_sync_runs set status='running',started_at=now()
      where run_id=r.run_id returning * into r;
  end if;
  update public.crm_m365_calendar_connections set lease_owner=v_owner,
    lease_expires_at=now()+interval '6 minutes',updated_at=now()
    where connection_id=c.connection_id;
  return jsonb_build_object('claimed',true,'owner',v_owner,'runId',r.run_id,
    'connectionId',c.connection_id,'mailboxUpn',c.mailbox_upn,
    'calendarId',c.calendar_id,'isPrimary',c.is_primary,
    'timezone',c.business_timezone,'trigger',r.trigger,'requestedMonth',r.requested_month);
end;
$$;
revoke all on function public.claim_crm_m365_sync_run() from public,anon,authenticated;
grant execute on function public.claim_crm_m365_sync_run() to service_role;

create or replace function public.finish_crm_m365_sync_run(
  p_run uuid,p_owner uuid,p_status text,p_error_code text default null,
  p_exported integer default 0,p_imported integer default 0,p_conflicts integer default 0)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_connection uuid;
begin
  if p_status not in ('succeeded','failed') then raise exception 'invalid_run_status' using errcode='22023'; end if;
  select r.connection_id into v_connection from public.crm_m365_sync_runs r
    join public.crm_m365_calendar_connections c on c.connection_id=r.connection_id
    where r.run_id=p_run and r.status='running' and c.lease_owner=p_owner
    for update of r,c;
  if v_connection is null then return false; end if;
  update public.crm_m365_sync_runs set status=p_status,finished_at=now(),
    exported_count=greatest(0,p_exported),imported_count=greatest(0,p_imported),
    conflict_count=greatest(0,p_conflicts),
    last_error_code=case when p_status='failed' then coalesce(p_error_code,'sync_unavailable') else null end
    where run_id=p_run;
  update public.crm_m365_calendar_connections set lease_owner=null,lease_expires_at=null,
    status=case when p_status='failed' and p_error_code='authorization_lost'
      then 'action_required' else status end,
    last_successful_sync_at=case when p_status='succeeded' then now() else last_successful_sync_at end,
    last_error_code=case when p_status='succeeded' then null else coalesce(p_error_code,'sync_unavailable') end,
    updated_at=now() where connection_id=v_connection;
  return true;
end;
$$;
revoke all on function public.finish_crm_m365_sync_run(uuid,uuid,text,text,integer,integer,integer)
  from public,anon,authenticated;
grant execute on function public.finish_crm_m365_sync_run(uuid,uuid,text,text,integer,integer,integer)
  to service_role;

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
revoke all on function public.claim_crm_m365_outbox(integer) from public,anon,authenticated;
grant execute on function public.claim_crm_m365_outbox(integer) to service_role;

create or replace function public.ack_crm_m365_outbox(p_outbox_id uuid,p_generation bigint,
  p_success boolean,p_error_code text default null,p_retry_seconds integer default 60)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_success then
    delete from public.crm_m365_calendar_outbox
      where outbox_id=p_outbox_id and generation=p_generation;
    update public.crm_m365_calendar_outbox set state='pending',lease_expires_at=null
      where outbox_id=p_outbox_id and generation<>p_generation;
  else
    update public.crm_m365_calendar_outbox set state='pending',lease_expires_at=null,
      last_error_code=coalesce(p_error_code,'export_failed'),
      next_attempt_at=now()+make_interval(secs=>least(3600,greatest(15,p_retry_seconds)))
      where outbox_id=p_outbox_id and generation=p_generation;
  end if;
end;
$$;
revoke all on function public.ack_crm_m365_outbox(uuid,bigint,boolean,text,integer)
  from public,anon,authenticated;
grant execute on function public.ack_crm_m365_outbox(uuid,bigint,boolean,text,integer)
  to service_role;

create or replace function public.commit_crm_m365_month_scan(
  p_run uuid,p_owner uuid,p_month date,p_mode text,p_changes jsonb,p_delta_link text default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare c public.crm_m365_calendar_connections%rowtype;
  v_scan uuid:=gen_random_uuid(); v_row jsonb; v_count integer:=0;
begin
  if p_month is null or extract(day from p_month)<>1 or p_mode not in ('full','delta')
    or jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes)>1000
    or (p_delta_link is not null and p_delta_link !~ '^https://graph\.microsoft\.com/v1\.0/') then
    raise exception 'invalid_calendar_scan' using errcode='22023';
  end if;
  select c.* into c from public.crm_m365_sync_runs r
    join public.crm_m365_calendar_connections c on c.connection_id=r.connection_id
    where r.run_id=p_run and r.status='running' and c.lease_owner=p_owner
      and c.status='connected' for update of c;
  if c.connection_id is null then raise exception 'calendar_scan_lease_lost' using errcode='55000'; end if;
  for v_row in select value from jsonb_array_elements(p_changes) loop
    if nullif(v_row->>'id','') is null or length(v_row->>'id')>512 then
      raise exception 'invalid_calendar_occurrence' using errcode='22023';
    end if;
    if coalesce((v_row->>'deleted')::boolean,false) then
      delete from public.crm_m365_imported_occurrences
        where connection_id=c.connection_id and graph_occurrence_id=v_row->>'id';
      continue;
    end if;
    if exists(select 1 from public.crm_m365_event_associations a
      where a.connection_id=c.connection_id and a.graph_event_id=v_row->>'id') then
      delete from public.crm_m365_imported_occurrences
        where connection_id=c.connection_id and graph_occurrence_id=v_row->>'id';
      continue;
    end if;
    insert into public.crm_m365_imported_occurrences(
      connection_id,graph_occurrence_id,series_master_id,start_at,end_at,
      local_start_date,local_end_date,is_all_day,display_title,location,
      outlook_web_url,is_private,provider_status,last_seen_scan_id)
    values(c.connection_id,v_row->>'id',nullif(v_row->>'seriesMasterId',''),
      (v_row->>'startAt')::timestamptz,(v_row->>'endAt')::timestamptz,
      (v_row->>'localStartDate')::date,(v_row->>'localEndDate')::date,
      (v_row->>'isAllDay')::boolean,
      case when (v_row->>'isPrivate')::boolean then 'Private event'
        else left(coalesce(nullif(btrim(v_row->>'title'),''),'Untitled event'),240) end,
      case when (v_row->>'isPrivate')::boolean then null else nullif(v_row->>'location','') end,
      nullif(v_row->>'outlookWebUrl',''),(v_row->>'isPrivate')::boolean,
      case when (v_row->>'isCanceled')::boolean then 'canceled' else 'active' end,v_scan)
    on conflict(connection_id,graph_occurrence_id) do update set
      series_master_id=excluded.series_master_id,start_at=excluded.start_at,end_at=excluded.end_at,
      local_start_date=excluded.local_start_date,local_end_date=excluded.local_end_date,
      is_all_day=excluded.is_all_day,display_title=excluded.display_title,
      location=excluded.location,outlook_web_url=excluded.outlook_web_url,
      is_private=excluded.is_private,provider_status=excluded.provider_status,
      last_seen_scan_id=v_scan,updated_at=now();
    v_count:=v_count+1;
  end loop;
  if p_mode='full' then
    delete from public.crm_m365_imported_occurrences i
      where i.connection_id=c.connection_id and i.local_start_date<p_month+interval '1 month'
        and i.local_end_date>p_month and i.last_seen_scan_id is distinct from v_scan;
  end if;
  insert into public.crm_m365_sync_months(connection_id,month_start,strategy,
    opaque_delta_link,last_successful_scan_at,last_error_code,scan_generation)
    values(c.connection_id,p_month,case when c.is_primary then 'primary_delta' else 'full_reconcile' end,
      p_delta_link,now(),null,v_scan)
    on conflict(connection_id,month_start) do update set
      opaque_delta_link=excluded.opaque_delta_link,last_successful_scan_at=now(),
      last_error_code=null,retry_after_at=null,scan_generation=v_scan;
  return v_count;
end;
$$;
revoke all on function public.commit_crm_m365_month_scan(uuid,uuid,date,text,jsonb,text)
  from public,anon,authenticated;
grant execute on function public.commit_crm_m365_month_scan(uuid,uuid,date,text,jsonb,text)
  to service_role;

-- Final list/detail projections include sanitized Graph-only occurrences only
-- while the shared connection remains visible to CRM users.
create or replace function public.list_crm_calendar_items(p_start_date date,p_end_date date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_crm jsonb; v_imported jsonb;
begin
  if not public.is_internal_crm_user() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_start_date is null or p_end_date is null or p_end_date<=p_start_date
    or p_end_date>p_start_date+62 then
    raise exception 'invalid_calendar_range' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(item - 'clientFirstName' - 'partnerFirstName' - 'serviceType'
      - 'guestCount' - 'venueName' - 'venueAddress' - 'paymentKind' - 'targetAmount'
      - 'creditedAmount' - 'outstandingAmount' - 'paidDate' - 'paymentMethod'
      - 'capacity' order by item->>'start',item->>'id'),'[]'::jsonb)
  into v_crm from (
    select public.crm_calendar_source_item('lead_event',l.lead_id) item
      from public.leads l where l.event_date>=p_start_date and l.event_date<p_end_date
        and l.converted_project_id is null
    union all select public.crm_calendar_source_item('project_event',p.project_id)
      from public.projects p where p.event_date>=p_start_date and p.event_date<p_end_date
    union all select public.crm_calendar_source_item('consultation',l.lead_id)
      from public.leads l where l.consultation_scheduled_at>=(p_start_date::timestamp at time zone 'America/New_York')
        and l.consultation_scheduled_at<(p_end_date::timestamp at time zone 'America/New_York')
    union all select public.crm_calendar_source_item('installment',r.project_payment_record_id)
      from public.project_payment_records r where r.due_date>=p_start_date and r.due_date<p_end_date
    union all select public.crm_calendar_source_item('workshop',o.workshop_occurrence_id)
      from public.workshop_occurrences o where o.local_start<p_end_date::timestamp
        and o.local_end>p_start_date::timestamp
  ) sources where item is not null;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id','microsoft:'||i.connection_id::text||':'||i.graph_occurrence_id,
    'sourceType','microsoft','sourceId',null,'title',i.display_title,
    'start',case when i.is_all_day then to_jsonb(i.local_start_date::text) else to_jsonb(i.start_at) end,
    'end',case when i.is_all_day then to_jsonb(i.local_end_date::text) else to_jsonb(i.end_at) end,
    'allDay',i.is_all_day,'localDate',i.local_start_date,
    'timezone',c.business_timezone,
    'status',case when i.is_private then null when i.provider_status='canceled' then 'Canceled' else null end,
    'isInactive',not i.is_private and i.provider_status='canceled',
    'colorType','microsoft','destination',null,'isPrivate',i.is_private,
    'isStale',c.status<>'connected' or coalesce(c.last_successful_sync_at<now()-interval '15 minutes',true))
    order by i.local_start_date,i.graph_occurrence_id),'[]'::jsonb)
  into v_imported
  from public.crm_m365_imported_occurrences i
  join public.crm_m365_calendar_connections c on c.connection_id=i.connection_id
  where c.status in ('connected','action_required')
    and i.local_start_date<p_end_date and i.local_end_date>p_start_date
    and not exists(select 1 from public.crm_m365_event_associations a
      where a.connection_id=i.connection_id and a.graph_event_id=i.graph_occurrence_id);
  return v_crm||v_imported;
end;
$$;

create or replace function public.get_crm_calendar_item_details(p_source_type text,p_source_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_item jsonb; v_connection uuid; v_graph_id text;
begin
  if not public.is_internal_crm_user() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_source_type='microsoft' then
    if p_source_id !~* '^microsoft:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:.+$' then
      raise exception 'invalid_calendar_identity' using errcode='22023';
    end if;
    v_connection:=split_part(p_source_id,':',2)::uuid;
    v_graph_id:=substring(p_source_id from 48);
    select jsonb_build_object('id',p_source_id,'sourceType','microsoft','sourceId',null,
      'title',i.display_title,
      'start',case when i.is_all_day then to_jsonb(i.local_start_date::text) else to_jsonb(i.start_at) end,
      'end',case when i.is_all_day then to_jsonb(i.local_end_date::text) else to_jsonb(i.end_at) end,
      'allDay',i.is_all_day,'localDate',i.local_start_date,
      'status',case when i.is_private then null when i.provider_status='canceled' then 'Canceled' else null end,
      'isInactive',not i.is_private and i.provider_status='canceled',
      'colorType','microsoft','destination',null,'isPrivate',i.is_private,
      'venueName',case when i.is_private then null else i.location end,
      'outlookWebUrl',i.outlook_web_url,'timezone',c.business_timezone)
      into v_item from public.crm_m365_imported_occurrences i
      join public.crm_m365_calendar_connections c on c.connection_id=i.connection_id
      where i.connection_id=v_connection and i.graph_occurrence_id=v_graph_id
        and c.status in ('connected','action_required')
        and not exists(select 1 from public.crm_m365_event_associations a
          where a.connection_id=i.connection_id and a.graph_event_id=i.graph_occurrence_id);
  elsif p_source_type in ('lead_event','project_event','consultation','installment','workshop')
    and p_source_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_item:=public.crm_calendar_source_item(p_source_type,p_source_id::uuid);
  else
    raise exception 'invalid_calendar_identity' using errcode='22023';
  end if;
  if v_item is null then raise exception 'calendar_item_not_found' using errcode='P0002'; end if;
  return v_item;
end;
$$;

create or replace function public.list_crm_m365_conflicts(p_actor uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_rows jsonb;
begin
  if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id
    where p.id=p_actor and p.is_active and r.role='admin') then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('conflictId',f.conflict_id,
    'sourceType',a.source_type,'sourceId',a.source_id,
    'sourceTitle',public.crm_calendar_source_title(a.source_type,a.source_id),
    'changedFields',f.changed_fields,'remoteTitle',case when f.is_remote_private then null else f.remote_title end,
    'remoteStartAt',f.remote_start_at,'remoteEndAt',f.remote_end_at,
    'isRemotePrivate',f.is_remote_private,'detectedAt',f.detected_at,'status',f.status)
    order by f.detected_at desc),'[]'::jsonb) into v_rows
  from public.crm_m365_sync_conflicts f
  join public.crm_m365_event_associations a on a.association_id=f.association_id
  join public.crm_m365_calendar_connections c on c.connection_id=a.connection_id
  where c.status in ('connected','action_required') and f.status in ('open','restoring');
  return v_rows;
end;
$$;
revoke all on function public.list_crm_m365_conflicts(uuid) from public,anon,authenticated;
grant execute on function public.list_crm_m365_conflicts(uuid) to service_role;

create or replace function public.restore_crm_m365_conflict(p_conflict_id uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_association public.crm_m365_event_associations%rowtype;
  v_status text;
begin
  if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id
    where p.id=p_actor and p.is_active and r.role='admin') then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select a.* into v_association from public.crm_m365_sync_conflicts f
    join public.crm_m365_event_associations a on a.association_id=f.association_id
    join public.crm_m365_calendar_connections c on c.connection_id=a.connection_id
    where f.conflict_id=p_conflict_id and f.status='open' and c.status='connected'
    for update of f,a;
  if v_association.association_id is null then
    raise exception 'calendar_conflict_not_found' using errcode='P0002';
  end if;
  update public.crm_m365_sync_conflicts set status='restoring',reviewed_by=p_actor,
    reviewed_at=now() where conflict_id=p_conflict_id;
  insert into public.crm_m365_calendar_outbox(source_type,source_id)
    values(v_association.source_type,v_association.source_id)
    on conflict(source_type,source_id) do update set
      generation=public.crm_m365_calendar_outbox.generation+1,
      state='pending',next_attempt_at=now(),lease_expires_at=null;
  return jsonb_build_object('status','queued','conflictId',p_conflict_id);
end;
$$;
revoke all on function public.restore_crm_m365_conflict(uuid,uuid) from public,anon,authenticated;
grant execute on function public.restore_crm_m365_conflict(uuid,uuid) to service_role;

create or replace function public.dispatch_crm_m365_sync_job()
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_project_url text; v_secret text; v_request_id bigint;
begin
  select nullif(btrim(decrypted_secret),'') into v_project_url
    from vault.decrypted_secrets where name='project_url' limit 1;
  select nullif(btrim(decrypted_secret),'') into v_secret
    from vault.decrypted_secrets where name='crm_m365_scheduler_secret' limit 1;
  if v_project_url !~ '^https://[a-z0-9-]+\.supabase\.co/?$'
    or v_secret is null or length(v_secret)<32 then
    raise exception 'calendar_scheduler_not_configured' using errcode='55000';
  end if;
  select net.http_post(url:=rtrim(v_project_url,'/')||'/functions/v1/crm-m365-calendar-sync',
    headers:=jsonb_build_object('Content-Type','application/json','x-crm-m365-scheduler-secret',v_secret),
    body:='{}'::jsonb,timeout_milliseconds:=10000) into v_request_id;
  return v_request_id;
end;
$$;
revoke all on function public.dispatch_crm_m365_sync_job() from public,anon,authenticated;
grant execute on function public.dispatch_crm_m365_sync_job() to service_role;

create or replace function public.install_crm_m365_sync_job()
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_job_id bigint;
begin
  if to_regclass('cron.job') is null or to_regnamespace('net') is null
    or to_regclass('vault.decrypted_secrets') is null then
    raise exception 'calendar_scheduler_extensions_missing' using errcode='55000';
  end if;
  if not exists(select 1 from vault.decrypted_secrets where name='project_url'
    and decrypted_secret ~ '^https://[a-z0-9-]+\.supabase\.co/?$')
    or not exists(select 1 from vault.decrypted_secrets where name='crm_m365_scheduler_secret'
      and length(decrypted_secret)>=32) then
    raise exception 'calendar_scheduler_secrets_missing' using errcode='55000';
  end if;
  for v_job_id in select jobid from cron.job where jobname='sync-crm-m365-calendar-5m' loop
    perform cron.unschedule(v_job_id);
  end loop;
  return cron.schedule('sync-crm-m365-calendar-5m','*/5 * * * *',
    'select public.dispatch_crm_m365_sync_job();');
end;
$$;
revoke all on function public.install_crm_m365_sync_job() from public,anon,authenticated;
grant execute on function public.install_crm_m365_sync_job() to service_role;
