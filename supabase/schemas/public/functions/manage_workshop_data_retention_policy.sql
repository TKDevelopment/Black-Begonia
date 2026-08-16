create or replace function public.manage_workshop_data_retention_policy(
  p_action text,
  p_payload jsonb,
  p_command_key uuid
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_policy public.workshop_data_retention_policies;
  v_result jsonb;
  v_existing_type text;
begin
  if not public.is_workshop_privacy_admin() then
    raise exception 'not authorized' using errcode='42501';
  end if;
  if p_command_key is null then
    raise exception 'invalid request' using errcode='22023';
  end if;
  select result,command_type into v_result,v_existing_type
  from public.workshop_privacy_commands
  where command_key=p_command_key;
  if found then
    if v_existing_type<>'retention_policy_'||p_action then
      raise exception 'command key collision' using errcode='22023';
    end if;
    return v_result||jsonb_build_object('replayed',true);
  end if;

  if p_action='create_draft' then
    if nullif(btrim(p_payload->>'policyVersion'),'') is null
      or jsonb_typeof(p_payload->'fieldRules')<>'array'
      or jsonb_array_length(p_payload->'fieldRules')=0
      or exists(
        select 1 from jsonb_array_elements(p_payload->'fieldRules') r
        where r->>'fieldCategory' not in (
          'contact_email','contact_phone','attendee_name','accommodation_details'
        )
          or jsonb_typeof(r->'permittedActions')<>'array'
          or exists(
            select 1 from jsonb_array_elements_text(r->'permittedActions') a
            where a not in ('correct','minimize','retain')
          )
          or coalesce((r->>'minimumAgeDays')::integer,-1)<0
          or jsonb_typeof(r->'prerequisites')<>'array'
      )
      or (
        select count(*)<>count(distinct r->>'fieldCategory')
        from jsonb_array_elements(p_payload->'fieldRules') r
      ) then
      raise exception 'invalid policy' using errcode='22023';
    end if;
    insert into public.workshop_data_retention_policies(
      policy_version,field_rules,operational_retention_days,
      communication_retention_days,financial_retention_days,
      dispute_retention_days,audit_retention_days
    ) values (
      btrim(p_payload->>'policyVersion'),p_payload->'fieldRules',
      (p_payload->>'operationalRetentionDays')::integer,
      (p_payload->>'communicationRetentionDays')::integer,
      (p_payload->>'financialRetentionDays')::integer,
      (p_payload->>'disputeRetentionDays')::integer,
      (p_payload->>'auditRetentionDays')::integer
    ) returning * into v_policy;
  elsif p_action='approve' then
    select * into v_policy from public.workshop_data_retention_policies
    where workshop_data_retention_policy_id=(p_payload->>'policyId')::uuid for update;
    if not found or v_policy.state<>'draft' then
      raise exception 'policy cannot be approved' using errcode='P0001';
    end if;
    update public.workshop_data_retention_policies set
      state='approved',approved_by=auth.uid(),approved_at=now()
    where workshop_data_retention_policy_id=v_policy.workshop_data_retention_policy_id
    returning * into v_policy;
  elsif p_action='activate' then
    select * into v_policy from public.workshop_data_retention_policies
    where workshop_data_retention_policy_id=(p_payload->>'policyId')::uuid for update;
    if not found or v_policy.state<>'approved'
      or coalesce((p_payload->>'confirmed')::boolean,false) is not true
      or coalesce((p_payload->>'effectiveAt')::timestamptz,now())>now()
    then raise exception 'policy cannot be activated' using errcode='P0001'; end if;
    update public.workshop_data_retention_policies set state='retired',
      retired_by=auth.uid(),retired_at=now()
    where state='active';
    update public.workshop_data_retention_policies set
      state='active',effective_at=coalesce((p_payload->>'effectiveAt')::timestamptz,now()),
      activated_by=auth.uid(),activated_at=now()
    where workshop_data_retention_policy_id=v_policy.workshop_data_retention_policy_id
    returning * into v_policy;
  elsif p_action='retire' then
    select * into v_policy from public.workshop_data_retention_policies
    where workshop_data_retention_policy_id=(p_payload->>'policyId')::uuid for update;
    if not found or v_policy.state<>'active' then
      raise exception 'policy cannot be retired' using errcode='P0001';
    end if;
    update public.workshop_data_retention_policies set
      state='retired',retired_by=auth.uid(),retired_at=now()
    where workshop_data_retention_policy_id=v_policy.workshop_data_retention_policy_id
    returning * into v_policy;
  else
    raise exception 'unsupported action' using errcode='22023';
  end if;
  v_result := jsonb_build_object(
    'replayed',false,'policyId',v_policy.workshop_data_retention_policy_id,
    'policyVersion',v_policy.policy_version,'state',v_policy.state
  );
  insert into public.workshop_privacy_commands(command_key,command_type,result,actor_id)
  values(p_command_key,'retention_policy_'||p_action,v_result,auth.uid());
  return v_result;
end;
$$;
revoke all on function public.manage_workshop_data_retention_policy(text,jsonb,uuid) from public;
grant execute on function public.manage_workshop_data_retention_policy(text,jsonb,uuid)
to authenticated;
