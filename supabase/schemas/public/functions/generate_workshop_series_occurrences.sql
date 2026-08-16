create or replace function public.generate_workshop_series_occurrences(
  p_workshop_series_id uuid,
  p_dates jsonb,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_series public.workshop_series;
  v_item jsonb;
  v_draft jsonb;
  v_saved jsonb;
  v_occurrence_ids jsonb := '[]'::jsonb;
  v_replay_ids jsonb;
begin
  if not public.is_internal_crm_user() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_command_key is null or jsonb_typeof(p_dates) <> 'array'
    or jsonb_array_length(p_dates) not between 1 and 100 then
    raise exception 'series dates must contain between 1 and 100 occurrences'
      using errcode = '22023';
  end if;

  select safe_metadata->'occurrenceIds' into v_replay_ids
  from public.workshop_audit_events
  where command_key = p_command_key and event_type = 'series_generated';
  if v_replay_ids is not null then
    return (
      select coalesce(jsonb_agg(to_jsonb(o) order by o.start_at), '[]'::jsonb)
      from public.workshop_occurrences o
      where o.workshop_occurrence_id in (
        select (value #>> '{}')::uuid from jsonb_array_elements(v_replay_ids)
      )
    );
  end if;

  select * into v_series
  from public.workshop_series
  where workshop_series_id = p_workshop_series_id
  for update;
  if not found then
    raise exception 'workshop series not found' using errcode = 'P0002';
  end if;

  for v_item in select value from jsonb_array_elements(p_dates)
  loop
    v_draft := jsonb_set(
      jsonb_set(v_item, '{workshopDefinitionId}', to_jsonb(v_series.workshop_definition_id::text), true),
      '{workshopSeriesId}', to_jsonb(v_series.workshop_series_id::text), true
    );
    v_saved := public.save_workshop_occurrence(v_draft, gen_random_uuid());
    v_occurrence_ids := v_occurrence_ids || jsonb_build_array(
      v_saved->>'workshop_occurrence_id'
    );
  end loop;

  insert into public.workshop_audit_events(
    workshop_definition_id, event_type, actor_type, actor_id, command_key,
    safe_metadata
  ) values (
    v_series.workshop_definition_id, 'series_generated', 'internal', auth.uid(),
    p_command_key, jsonb_build_object(
      'seriesId', v_series.workshop_series_id,
      'occurrenceIds', v_occurrence_ids
    )
  );

  return (
    select coalesce(jsonb_agg(to_jsonb(o) order by o.start_at), '[]'::jsonb)
    from public.workshop_occurrences o
    where o.workshop_occurrence_id in (
      select (value #>> '{}')::uuid from jsonb_array_elements(v_occurrence_ids)
    )
  );
end;
$$;

revoke all on function public.generate_workshop_series_occurrences(uuid,jsonb,uuid) from public;
grant execute on function public.generate_workshop_series_occurrences(uuid,jsonb,uuid) to authenticated;
