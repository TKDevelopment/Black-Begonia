create or replace function public.publish_workshop_occurrence(
  p_workshop_occurrence_id uuid,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_occurrence public.workshop_occurrences;
  v_replay_id uuid;
begin
  if not public.is_internal_crm_user() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select (safe_metadata->>'occurrenceId')::uuid into v_replay_id
  from public.workshop_audit_events
  where command_key=p_command_key and event_type='occurrence_published';
  if v_replay_id is not null then
    select * into v_occurrence from public.workshop_occurrences
    where workshop_occurrence_id=v_replay_id;
    return to_jsonb(v_occurrence);
  end if;

  select * into v_occurrence from public.workshop_occurrences
  where workshop_occurrence_id=p_workshop_occurrence_id for update;
  if not found then raise exception 'workshop occurrence not found' using errcode='P0002'; end if;
  if v_occurrence.status not in ('draft','registration_closed') then
    raise exception 'workshop occurrence cannot be published' using errcode='55000';
  end if;
  if nullif(btrim(v_occurrence.included_materials_snapshot),'') is null then
    raise exception 'included materials are required' using errcode='22023';
  end if;
  if nullif(btrim(v_occurrence.terms_snapshot),'') is null
    or nullif(btrim(v_occurrence.venue_name),'') is null
    or nullif(btrim(v_occurrence.address_line_1),'') is null
    or nullif(btrim(v_occurrence.locality),'') is null
    or nullif(btrim(v_occurrence.region),'') is null
    or nullif(btrim(v_occurrence.postal_code),'') is null then
    raise exception 'address and terms are required' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.workshop_media m
    where m.is_public and m.media_role='hero' and nullif(btrim(m.alt_text),'') is not null
      and (
        m.workshop_occurrence_id=v_occurrence.workshop_occurrence_id
        or (
          m.workshop_definition_id=v_occurrence.workshop_definition_id
          and not exists(
            select 1 from public.workshop_media override_media
            where override_media.workshop_occurrence_id=v_occurrence.workshop_occurrence_id
              and override_media.media_role='hero'
          )
        )
      )
  ) then
    raise exception 'effective hero image is required' using errcode='22023';
  end if;
  if v_occurrence.stripe_enabled and not exists (
    select 1 from public.workshop_stripe_price_versions p
    join public.workshop_definitions d using(workshop_definition_id)
    where p.workshop_stripe_price_version_id=v_occurrence.stripe_price_version_id
      and p.state='active' and p.amount_minor=v_occurrence.price_minor
      and p.currency=v_occurrence.currency and d.stripe_catalog_state='ready'
  ) then
    raise exception 'Stripe catalog is not ready' using errcode='22023';
  end if;

  update public.workshop_occurrences
  set status='published_open', published_at=coalesce(published_at,now()), updated_by=auth.uid()
  where workshop_occurrence_id=p_workshop_occurrence_id
  returning * into v_occurrence;
  insert into public.workshop_audit_events(
    workshop_definition_id,workshop_occurrence_id,event_type,actor_type,
    actor_id,command_key,safe_metadata
  ) values (
    v_occurrence.workshop_definition_id,v_occurrence.workshop_occurrence_id,
    'occurrence_published','internal',auth.uid(),p_command_key,
    jsonb_build_object('occurrenceId',v_occurrence.workshop_occurrence_id)
  );
  return to_jsonb(v_occurrence);
end;
$$;

create or replace function public.archive_workshop_occurrence(
  p_workshop_occurrence_id uuid,
  p_command_key uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_occurrence public.workshop_occurrences;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized' using errcode='42501'; end if;
  select * into v_occurrence from public.workshop_occurrences
    where workshop_occurrence_id=p_workshop_occurrence_id for update;
  if not found then raise exception 'workshop occurrence not found' using errcode='P0002'; end if;
  if v_occurrence.status not in ('cancelled','rescheduled','completed') then
    raise exception 'only terminal workshop occurrences can be archived' using errcode='55000';
  end if;
  update public.workshop_occurrences set status='archived',archived_at=now(),updated_by=auth.uid()
    where workshop_occurrence_id=p_workshop_occurrence_id returning * into v_occurrence;
  insert into public.workshop_audit_events(workshop_definition_id,workshop_occurrence_id,event_type,actor_type,actor_id,command_key,safe_metadata)
  values(v_occurrence.workshop_definition_id,v_occurrence.workshop_occurrence_id,'occurrence_archived','internal',auth.uid(),p_command_key,jsonb_build_object('occurrenceId',v_occurrence.workshop_occurrence_id));
  return to_jsonb(v_occurrence);
end; $$;

create or replace function public.delete_workshop_occurrence(
  p_workshop_occurrence_id uuid,
  p_command_key uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_occurrence public.workshop_occurrences;
begin
  if not public.is_internal_crm_user() then raise exception 'not authorized' using errcode='42501'; end if;
  select * into v_occurrence from public.workshop_occurrences
    where workshop_occurrence_id=p_workshop_occurrence_id for update;
  if not found then return jsonb_build_object('deleted',true); end if;
  if v_occurrence.status<>'draft' or v_occurrence.published_at is not null
    or exists(select 1 from public.workshop_audit_events a
      where a.workshop_occurrence_id=p_workshop_occurrence_id
        and a.event_type<>'occurrence_saved') then
    raise exception 'workshop occurrence has history' using errcode='55000';
  end if;
  delete from public.workshop_media where workshop_occurrence_id=p_workshop_occurrence_id;
  delete from public.workshop_audit_events where workshop_occurrence_id=p_workshop_occurrence_id;
  delete from public.workshop_occurrences where workshop_occurrence_id=p_workshop_occurrence_id;
  return jsonb_build_object('deleted',true,'commandKey',p_command_key);
end; $$;

revoke all on function public.publish_workshop_occurrence(uuid,uuid) from public;
revoke all on function public.archive_workshop_occurrence(uuid,uuid) from public;
revoke all on function public.delete_workshop_occurrence(uuid,uuid) from public;
grant execute on function public.publish_workshop_occurrence(uuid,uuid) to authenticated;
grant execute on function public.archive_workshop_occurrence(uuid,uuid) to authenticated;
grant execute on function public.delete_workshop_occurrence(uuid,uuid) to authenticated;
