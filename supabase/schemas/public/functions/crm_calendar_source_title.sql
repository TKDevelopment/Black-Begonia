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
revoke all on function public.crm_calendar_source_title(text, uuid) from public, anon, authenticated;
grant execute on function public.crm_calendar_source_title(text, uuid) to service_role;
