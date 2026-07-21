create or replace function public.convert_lead_to_project_with_payments(
  p_lead_id uuid, p_project_fields jsonb, p_contact_fields jsonb,
  p_command_key uuid, p_test_fail_after_stage text default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_lead public.leads; v_proposal public.floral_proposals; v_project public.projects;
v_primary public.contacts; v_partner public.contacts; v_planner public.contacts; v_snapshot public.project_proposal_invoice_snapshots;
v_deposit public.project_payment_records; v_final public.project_payment_records; v_test boolean:=coalesce(current_setting('app.payment_test_mode',true),'off')='on';
begin
  if not public.is_internal_crm_user() and not v_test then raise exception 'not authorized'; end if;
  select * into v_lead from public.leads where lead_id=p_lead_id for update;
  if not found then raise exception 'Lead not found'; end if;
  if v_lead.payment_conversion_command_key=p_command_key and v_lead.converted_project_id is not null then
    return (select jsonb_build_object('project',to_jsonb(p),'primaryContactId',v_lead.converted_primary_contact_id,'partnerContactId',null,'plannerContactId',null,'depositObligationId',(select project_payment_record_id from public.project_payment_records where project_id=p.project_id and payment_kind='deposit' and status<>'canceled'),'finalObligationId',(select project_payment_record_id from public.project_payment_records where project_id=p.project_id and payment_kind='final_payment' and status<>'canceled'),'replayed',true) from public.projects p where p.project_id=v_lead.converted_project_id);
  end if;
  if v_lead.status<>'proposal_accepted' then raise exception 'Only accepted proposal leads can be converted'; end if;
  select * into v_proposal from public.floral_proposals where lead_id=p_lead_id and is_active and status='accepted' order by version desc limit 1 for update;
  if not found or v_proposal.total_amount<=0 then raise exception 'An accepted active proposal with a positive total is required'; end if;
  insert into public.contacts(first_name,last_name,email,phone,preferred_contact_method,contact_type,notes,created_from_lead_id)
  values(v_lead.first_name,v_lead.last_name,lower(v_lead.email),v_lead.phone,v_lead.preferred_contact_method,'client','Primary client contact created from lead conversion.',v_lead.lead_id) returning * into v_primary;
  if p_test_fail_after_stage='contact' and v_test then raise exception 'forced conversion failure after contact'; end if;
  if nullif(btrim(v_lead.partner_first_name),'') is not null or nullif(btrim(v_lead.partner_last_name),'') is not null then
    insert into public.contacts(first_name,last_name,contact_type,notes,created_from_lead_id) values(coalesce(nullif(btrim(v_lead.partner_first_name),''),'Partner'),coalesce(nullif(btrim(v_lead.partner_last_name),''),v_lead.last_name),'partner','Partner contact created from lead conversion.',v_lead.lead_id) returning * into v_partner;
  end if;
  if nullif(btrim(v_lead.planner_name),'') is not null or nullif(btrim(v_lead.planner_email),'') is not null or nullif(btrim(v_lead.planner_phone),'') is not null then
    insert into public.contacts(first_name,last_name,email,phone,contact_type,notes,created_from_lead_id) values(coalesce(nullif(split_part(btrim(v_lead.planner_name),' ',1),''),'Event'),coalesce(nullif(btrim(regexp_replace(v_lead.planner_name,'^\S+\s*','')),''),'Planner'),nullif(lower(btrim(v_lead.planner_email)),''),nullif(btrim(v_lead.planner_phone),''),'planner','Planner contact created from lead conversion.',v_lead.lead_id) returning * into v_planner;
  end if;
  insert into public.projects(project_name,service_type,event_type,event_date,ceremony_venue_name,ceremony_venue_city,ceremony_venue_state,ceremony_venue_address,ceremony_venue_zipcode,reception_venue_name,reception_venue_city,reception_venue_state,reception_venue_address,reception_venue_zipcode,budget_range,guest_count,style_notes,internal_notes,status,source_lead_id,primary_contact_id,assigned_user_id)
  values(coalesce(nullif(btrim(p_project_fields->>'project_name'),''),v_lead.first_name||' '||v_lead.last_name||' Event'),v_lead.service_type,v_lead.event_type,v_lead.event_date,v_lead.ceremony_venue_name,v_lead.ceremony_venue_city,v_lead.ceremony_venue_state,v_lead.ceremony_venue_address,v_lead.ceremony_venue_zipcode,v_lead.reception_venue_name,v_lead.reception_venue_city,v_lead.reception_venue_state,v_lead.reception_venue_address,v_lead.reception_venue_zipcode,v_lead.budget_range,v_lead.guest_count,v_lead.inquiry_message,nullif(btrim(p_project_fields->>'internal_notes'),''),'awaiting_deposit',v_lead.lead_id,v_primary.contact_id,v_lead.assigned_user_id) returning * into v_project;
  if p_test_fail_after_stage='project' and v_test then raise exception 'forced conversion failure after project'; end if;
  insert into public.project_contacts(project_id,contact_id,relationship_type,is_primary) values(v_project.project_id,v_primary.contact_id,'client',true);
  if v_partner.contact_id is not null then insert into public.project_contacts(project_id,contact_id,relationship_type) values(v_project.project_id,v_partner.contact_id,'partner'); end if;
  if v_planner.contact_id is not null then insert into public.project_contacts(project_id,contact_id,relationship_type) values(v_project.project_id,v_planner.contact_id,'planner'); end if;
  insert into public.project_proposal_invoice_snapshots(project_id,source_lead_id,source_floral_proposal_id,version,snapshot,subtotal,tax_rate,tax_amount,total_amount,retainer_amount,final_balance_amount,retainer_due_date,final_balance_due_date,created_by,is_active)
  values(v_project.project_id,v_lead.lead_id,v_proposal.floral_proposal_id,v_proposal.version,v_proposal.snapshot,v_proposal.subtotal,v_proposal.tax_rate,v_proposal.tax_amount,v_proposal.total_amount,round(v_proposal.total_amount*.30,2),v_proposal.total_amount-round(v_proposal.total_amount*.30,2),current_date,coalesce(v_proposal.final_balance_due_date,v_lead.event_date-30),auth.uid(),true) returning * into v_snapshot;
  update public.projects set active_proposal_invoice_snapshot_id=v_snapshot.project_proposal_invoice_snapshot_id where project_id=v_project.project_id returning * into v_project;
  if p_test_fail_after_stage='proposal_pointer' and v_test then raise exception 'forced conversion failure after proposal pointer'; end if;
  insert into public.project_payment_records(project_id,payment_kind,status,amount_due,amount_paid,due_date,payment_source,basis_snapshot_id,basis_version,basis_total,target_amount,credited_principal,outstanding_amount,fulfillment_state,migration_state)
  values(v_project.project_id,'deposit','due',v_snapshot.retainer_amount,0,current_date,'manual',v_snapshot.project_proposal_invoice_snapshot_id,v_snapshot.version,v_snapshot.total_amount,v_snapshot.retainer_amount,0,v_snapshot.retainer_amount,'due','native') returning * into v_deposit;
  insert into public.project_payment_records(project_id,payment_kind,status,amount_due,amount_paid,due_date,payment_source,basis_snapshot_id,basis_version,basis_total,target_amount,credited_principal,outstanding_amount,fulfillment_state,migration_state)
  values(v_project.project_id,'final_payment','not_due',v_snapshot.final_balance_amount,0,v_snapshot.final_balance_due_date,'manual',v_snapshot.project_proposal_invoice_snapshot_id,v_snapshot.version,v_snapshot.total_amount,v_snapshot.final_balance_amount,0,v_snapshot.final_balance_amount,'not_due','native') returning * into v_final;
  if p_test_fail_after_stage='obligation' and v_test then raise exception 'forced conversion failure after obligation'; end if;
  update public.leads set status='converted',converted_project_id=v_project.project_id,converted_primary_contact_id=v_primary.contact_id,converted_at=now(),payment_conversion_command_key=p_command_key,updated_at=now() where lead_id=v_lead.lead_id;
  if p_test_fail_after_stage='lead_state' and v_test then raise exception 'forced conversion failure after lead state'; end if;
  perform public.create_payment_activity(v_project.project_id,'Project awaiting deposit','A 30% deposit obligation was created during lead conversion.','florist',jsonb_build_object('deposit_amount',v_snapshot.retainer_amount,'proposal_version',v_snapshot.version),auth.uid());
  insert into public.lead_activity(lead_id,activity_type,activity_label,activity_description,performed_by,metadata) values(v_lead.lead_id,'converted','Lead converted to project',coalesce(nullif(btrim(p_project_fields->>'internal_notes'),''),'Lead converted into project "'||v_project.project_name||'".'),auth.uid(),jsonb_build_object('project_id',v_project.project_id,'primary_contact_id',v_primary.contact_id));
  if p_test_fail_after_stage='activity' and v_test then raise exception 'forced conversion failure after activity'; end if;
  return jsonb_build_object('project',to_jsonb(v_project),'primaryContactId',v_primary.contact_id,'partnerContactId',v_partner.contact_id,'plannerContactId',v_planner.contact_id,'depositObligationId',v_deposit.project_payment_record_id,'finalObligationId',v_final.project_payment_record_id,'replayed',false);
end; $$;
revoke all on function public.convert_lead_to_project_with_payments(uuid,jsonb,jsonb,uuid,text) from public,anon;
grant execute on function public.convert_lead_to_project_with_payments(uuid,jsonb,jsonb,uuid,text) to authenticated;
