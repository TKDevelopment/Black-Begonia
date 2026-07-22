-- Preserve proposal-row unit costs at four-decimal precision without changing
-- catalog pack-price semantics or any cent-valued proposal totals.
-- Apply after 20260721000000_refine_payment_installments.sql.
-- The preservation check intentionally lives in the same DO statement as the
-- type change so SQL runners that commit individual statements cannot discard
-- intermediate state. This remains safe to rerun when the column is already
-- numeric(14,4).

do $$
declare
  v_negative_count bigint;
  v_before_count bigint;
  v_before_min numeric;
  v_before_max numeric;
  v_after_count bigint;
  v_after_min numeric;
  v_after_max numeric;
begin
  lock table public.floral_proposal_components in access exclusive mode;

  select count(*)::bigint,
         count(*) filter (where base_unit_cost < 0)::bigint,
         min(base_unit_cost),
         max(base_unit_cost)
  into v_before_count, v_negative_count, v_before_min, v_before_max
  from public.floral_proposal_components;

  if v_negative_count > 0 then
    raise exception using
      message = 'Proposal component precision migration stopped: negative base_unit_cost values require review.',
      detail = format('%s floral_proposal_components rows have a negative base_unit_cost.', v_negative_count),
      hint = 'Correct or explicitly approve the affected proposal rows before rerunning this migration.';
  end if;

  execute $ddl$
    alter table public.floral_proposal_components
      alter column base_unit_cost type numeric(14, 4)
      using base_unit_cost::numeric(14, 4)
  $ddl$;

  select count(*)::bigint as component_count,
         min(base_unit_cost) as minimum_cost,
         max(base_unit_cost) as maximum_cost
  into v_after_count, v_after_min, v_after_max
  from public.floral_proposal_components;

  if v_before_count is distinct from v_after_count
     or v_before_min is distinct from v_after_min
     or v_before_max is distinct from v_after_max then
    raise exception using
      message = 'Proposal component precision migration stopped: preservation check failed.',
      detail = format(
        'Before count/min/max: %s/%s/%s. After count/min/max: %s/%s/%s.',
        v_before_count, v_before_min, v_before_max,
        v_after_count, v_after_min, v_after_max
      );
  end if;
end;
$$;

comment on column public.floral_proposal_components.base_unit_cost is
  'Proposal-specific pre-markup cost per catalog unit. Retains up to four decimals; catalog_items.base_unit_cost remains the current full-pack cost when pack_quantity is present.';

notify pgrst, 'reload schema';