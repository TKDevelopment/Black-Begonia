create or replace function public.update_workshop_concept(
  p_workshop_definition_id uuid,
  p_patch jsonb,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_definition public.workshop_definitions;
  v_terms_changed boolean;
begin
  if not public.is_internal_crm_user() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_workshop_definition_id is null
    or p_command_key is null
    or jsonb_typeof(p_patch) <> 'object'
    or not (p_patch ?& array[
      'title','theme','advertisingLine','description','includedMaterials','defaultTerms'
    ])
  then
    raise exception 'invalid workshop concept update' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.workshop_audit_events
    where command_key = p_command_key
      and event_type = 'concept_updated'
      and workshop_definition_id = p_workshop_definition_id
  ) then
    return (
      select coalesce(jsonb_agg(to_jsonb(o) order by o.start_at), '[]'::jsonb)
      from public.workshop_occurrences o
      where o.workshop_definition_id = p_workshop_definition_id
    );
  end if;

  select * into v_definition
  from public.workshop_definitions
  where workshop_definition_id = p_workshop_definition_id
  for update;
  if not found then
    raise exception 'workshop concept not found' using errcode = 'P0002';
  end if;

  v_terms_changed := btrim(p_patch->>'defaultTerms') is distinct from v_definition.default_terms;

  update public.workshop_definitions set
    title = btrim(p_patch->>'title'),
    theme = btrim(p_patch->>'theme'),
    advertising_line = btrim(p_patch->>'advertisingLine'),
    description = btrim(p_patch->>'description'),
    included_materials = btrim(p_patch->>'includedMaterials'),
    default_terms = btrim(p_patch->>'defaultTerms'),
    default_terms_version = default_terms_version + case when v_terms_changed then 1 else 0 end,
    updated_by = auth.uid()
  where workshop_definition_id = p_workshop_definition_id
  returning * into v_definition;

  update public.workshop_occurrences set
    title_snapshot = v_definition.title,
    advertising_line_snapshot = v_definition.advertising_line,
    description_snapshot = v_definition.description,
    included_materials_snapshot = v_definition.included_materials,
    terms_snapshot = v_definition.default_terms,
    terms_version = v_definition.default_terms_version,
    updated_by = auth.uid()
  where workshop_definition_id = p_workshop_definition_id;

  insert into public.workshop_audit_events(
    workshop_definition_id, event_type, actor_type, actor_id, command_key,
    safe_metadata
  ) values (
    p_workshop_definition_id, 'concept_updated', 'internal', auth.uid(), p_command_key,
    jsonb_build_object(
      'occurrenceIds', (
        select coalesce(jsonb_agg(o.workshop_occurrence_id order by o.start_at), '[]'::jsonb)
        from public.workshop_occurrences o
        where o.workshop_definition_id = p_workshop_definition_id
      ),
      'changedFields', jsonb_build_array(
        'title','theme','advertisingLine','description','includedMaterials','defaultTerms'
      )
    )
  );

  return (
    select coalesce(jsonb_agg(to_jsonb(o) order by o.start_at), '[]'::jsonb)
    from public.workshop_occurrences o
    where o.workshop_definition_id = p_workshop_definition_id
  );
end;
$$;

revoke all on function public.update_workshop_concept(uuid,jsonb,uuid) from public;
grant execute on function public.update_workshop_concept(uuid,jsonb,uuid) to authenticated;
