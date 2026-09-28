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
revoke all on function public.crm_calendar_source_item(text, uuid) from public, anon, authenticated;
grant execute on function public.crm_calendar_source_item(text, uuid) to service_role;
