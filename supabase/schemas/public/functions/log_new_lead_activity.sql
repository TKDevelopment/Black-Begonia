
begin
  insert into public.lead_activity (
    lead_id,
    activity_type,
    activity_label,
    activity_description,
    performed_by,
    metadata
  )
  values (
    new.lead_id,
    'created',
    'Lead created',
    'Lead was created from inquiry submission.',
    null,
    jsonb_build_object('source', new.source)
  );

  insert into public.activity_log (
    entity_type,
    entity_id,
    activity_type,
    activity_label,
    description,
    performed_by,
    metadata
  )
  values (
    'lead',
    new.lead_id,
    'created',
    'Lead created',
    'Lead was created from inquiry submission.',
    null,
    jsonb_build_object('source', new.source)
  );

  return new;
end;
