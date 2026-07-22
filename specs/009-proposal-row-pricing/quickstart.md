# Quickstart: Proposal Catalog Row Pricing

## 1. Scope

This feature requires one data-preserving Supabase precision migration and one Angular deployment. It does not require an Edge Function, Cron, secret, storage policy, public route, client portal, email, PDF, payment-provider, or Netlify configuration change.

## 2. Preflight

Run against the target Supabase environment and export the results before migration.

```sql
select count(*) as component_count,
       min(base_unit_cost) as minimum_cost,
       max(base_unit_cost) as maximum_cost,
       count(*) filter (where base_unit_cost < 0) as negative_costs
from public.floral_proposal_components;

select data_type, numeric_precision, numeric_scale
from information_schema.columns
where table_schema = 'public'
  and table_name = 'floral_proposal_components'
  and column_name = 'base_unit_cost';
```

Expected before migration: numeric precision `12`, scale `2`, and no negative costs. Retain the row count and min/max values for comparison.

Also identify acceptance fixtures:

- catalog item `$30.00`, pack quantity `10`;
- catalog item `$35.00`, pack quantity `12`;
- same item used by multiple rows with different overrides;
- saved revision workspace and submitted snapshot using legacy two-decimal component costs;
- retired catalog item recorded in an existing proposal.

## 3. Apply Migration

1. Confirm migrations through `20260721000000_refine_payment_installments.sql` are applied.
2. Apply `supabase/migrations/20260721010000_proposal_catalog_row_pricing.sql`.
3. Verify `floral_proposal_components.base_unit_cost` is `numeric(14,4)` and retains the prior ten-digit integer capacity.
4. Compare component row count and numeric values with the preflight export.
5. Confirm no catalog, proposal line, shopping-list, workspace, snapshot, trigger, RLS policy, or grant changed unexpectedly.

The migration is safe to rerun if an earlier SQL Editor attempt stopped after
widening the column. Its preservation snapshot, type change, and comparison now
execute inside one `DO` statement and do not depend on a temporary relation
surviving between statements.

Post-migration checks:

```sql
select data_type, numeric_precision, numeric_scale
from information_schema.columns
where table_schema = 'public'
  and table_name = 'floral_proposal_components'
  and column_name = 'base_unit_cost';

begin;
update public.floral_proposal_components
set base_unit_cost = 2.9167
where floral_proposal_component_id = (
  select floral_proposal_component_id
  from public.floral_proposal_components
  limit 1
);
select base_unit_cost
from public.floral_proposal_components
where base_unit_cost = 2.9167;
rollback;
```

Use an isolated/test row for the precision probe. Expected scale is `4`; rollback leaves production data unchanged.

## 4. Automated Verification

Run focused Angular tests:

```powershell
npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include=src/app/core/supabase/services/floral-proposal-builder.service.spec.ts
npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include=src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts
npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include=src/app/core/supabase/repositories/floral-proposal-repository.service.spec.ts
npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include=src/app/core/supabase/services/floral-proposal-workflow.service.spec.ts
npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include=src/app/core/supabase/services/project-proposal-revision.service.spec.ts
```

Then run:

```powershell
npm run test:coverage
npm run build:prod
```

Run `supabase/tests/proposal_revision_snapshots.sql` through the repository's isolated PostgreSQL/pgTAP workflow after adding precision/preservation assertions.

No automated Edge Function test or harness may be created or run for this feature.

## 5. Catalog-Derived Price Scenario

1. Open an eligible lead proposal builder.
2. Add a product line and catalog composition row.
3. Select a catalog item with full-pack Base Unit Cost `$30.00` and pack quantity `10`.
4. Confirm Row Unit Price displays `3.0000` or an equivalent input representation retaining four-decimal capability.
5. Confirm Effective Pack Cost/shopping estimate is `$30.00`.
6. Confirm the catalog record remains `$30.00`.

## 6. Override Scenario

1. Change the row price from `3.0000` to `4.0000`.
2. Confirm marked-up row price, component subtotal, parent product line, labor, tax, proposal total, and shopping list refresh immediately.
3. Confirm Effective Pack Cost becomes `$40.00` for pack quantity `10`.
4. Save, refresh, and reopen the proposal.
5. Confirm `4.0000` and pack quantity `10` remain recorded.
6. Confirm the shared catalog Base Unit Cost remains `$30.00`.

## 7. Reset Scenario

1. With the overridden row still saved, change the catalog item in catalog management to Base Unit Cost `$36.00` and pack quantity `12`.
2. Reopen the proposal and confirm its saved row remains `4.0000` with pack quantity `10`.
3. Activate Reset to Catalog Price.
4. Confirm Row Unit Price becomes `3.0000`, row pack quantity becomes `12`, and Effective Pack Cost becomes `$36.00`.
5. Confirm all dependent proposal and shopping values refresh.
6. For a retired/unavailable item, confirm reset is unavailable with guidance and recorded row values remain editable and unchanged.

## 8. Non-Even Precision Scenario

1. Select the `$35.00` / `12` item.
2. Confirm derived Row Unit Price retains `2.9167` for calculation.
3. Confirm Effective Pack Cost rounds to `$35.00`.
4. Apply representative markup and quantities.
5. Independently calculate expected cent-rounded sell price, line subtotal, tax, and total; confirm exact agreement.
6. Save and reopen; confirm four-decimal row cost is retained.

## 9. Mixed Price Shopping Scenario

1. Add the same catalog item to two product rows using the same unit type and pack quantity.
2. Set row costs to `$3.00` and `$4.00`.
3. Confirm proposal line calculations retain their independent prices.
4. Confirm the shopping list creates one compatible item, aggregates required/reserve-adjusted units, and rounds pack count once.
5. Confirm estimated pack and total purchasing cost use `$4.00`, the highest contributing row price.
6. Repeat with different snapshotted pack quantities and confirm separate, clearly noted shopping entries rather than invalid merging.

## 10. Persistence And History

### Initial lead proposal

1. Save a lead proposal containing a four-decimal row cost.
2. Read the normalized component and confirm `base_unit_cost` retains four decimals.
3. Confirm sell price, subtotals, shopping costs, tax, and total remain cents.
4. Reopen and confirm no live catalog repricing.

### Project revision

1. Open a revision from a legacy submitted snapshot.
2. Confirm existing recorded two-decimal row costs and pack facts load unchanged.
3. Override one row with a four-decimal cost and allow autosave to complete.
4. Refresh and confirm the workspace restores the exact value.
5. Finalize through the unchanged approved/signed PDF workflow.
6. Confirm the new immutable snapshot retains recorded row cost, pack quantity, and effective pack cost while prior history is unchanged.

## 11. Validation And Failure States

- Blank input is invalid and does not silently become zero.
- Explicit zero remains zero across recalculate/save/reopen.
- Negative, nonnumeric, nonfinite, and more-than-four-decimal values show actionable row validation and are not persisted.
- Invalid pack quantity never produces division by zero, Infinity, or NaN.
- Save/autosave failure retains the open edited values and existing error state.
- Selecting a different item applies its current catalog cost and pack quantity.
- Re-selecting the same item does not overwrite an intentional saved override.

## 12. Accessibility, Theme, And Performance

- Navigate Row Unit Price and Reset to Catalog Price using keyboard only.
- Confirm item-specific accessible names, visible focus, and non-color-only validation/reset states.
- Verify light/dark CRM themes and horizontal-scroll/mobile table behavior.
- Starting with an empty composition row, time a florist selecting a catalog item, entering quantity, entering or confirming unit price, and entering markup. Confirm the row is completely priced with valid recalculated totals in under 30 seconds.
- Seed a representative 100-line proposal; record at least 20 unit-price edits and confirm at least 95% expose all dependent recalculations within 200 ms.
- Confirm edits add no per-row network call beyond existing save/autosave behavior.

## 13. Regression Checks

- Catalog create/edit/list behavior and full-pack prices remain unchanged.
- Pack quantity and reserve behavior remain available.
- Fee, discount, and manual labor unit prices remain editable through their existing path.
- Lead proposal creation, project revision autosave/discard/finalization, and immutable version history remain operational.
- Manual Canva PDF upload and proposal document history remain unchanged.
- Project financial/payment totals consume the same cent-rounded submitted proposal totals.
- Public website, client payment/proposal access, secrets, storage, Cron, and email behavior remain unchanged.

## 14. Rollback And Human Handoff

- Angular can be rolled back independently; the widened numeric column remains backward compatible.
- Do not narrow the database column after four-decimal values exist without exporting and approving a precision-loss report.
- No submitted snapshots or component records should be rewritten during rollback.
- The human operator reviews, commits, pushes, applies the migration, and deploys the Angular build.

## 15. Implementation Verification Record (2026-07-21)

### Completed locally

- Feature checklist: `16/16` requirements complete before implementation.
- All five focused Angular areas pass with `ChromeHeadlessNoSandbox`: builder calculations, builder UI, normalized repository mapping, lead workflow mapping, and project revision autosave/resume.
- The builder service focused suite passes `17/17`; the builder component suite passes `26/26`, including native clear-then-replace unit-price editing, catalog replacement/reset accessibility and theme states, plus the representative 100-line/20-edit performance boundary and no-network-call assertion.
- `npm run build:prod` passes. Existing bundle-size warnings remain, including the proposal builder component stylesheet warning; no compilation or template error remains.
- `git diff --check` passes.
- Static scope audit confirms no public/client route, payment behavior, PDF workflow, secret, storage policy, Cron, Netlify, or Supabase Edge Function file was added or modified for this feature.
- Declarative schema and migration both define only `floral_proposal_components.base_unit_cost` as `numeric(14,4)`. The migration records and verifies component count/min/max around the conversion, rejects negative values, and leaves cent-valued columns untouched. The SQL integration test checks precision, RLS, trigger, grant parity, and cent-valued column contracts.
- Supabase SQL Editor compatibility repair: the migration no longer passes preservation state through an `ON COMMIT DROP` temporary table. It locks the component table, captures the before-state, performs the idempotent precision change, and validates the after-state inside one `DO` statement.

### Known repository-wide test baseline

- The literal `npm run test:coverage` command could not start the default Chrome launcher in this Windows environment because its GPU/sandbox process terminated.
- The equivalent full suite ran with `ChromeHeadlessNoSandbox` and executed all `585` tests: `581` passed and `4` pre-existing, out-of-scope payment/conversion tests failed. The failing specs are `lead-convert-modal.component.spec.ts`, `payments.component.spec.ts`, `payment-obligation-modal.component.spec.ts`, and `payment-status.component.spec.ts`; none of their source or spec files is changed by feature 009.

### Pending environment/manual gates

- T001 target-environment preflight is pending because this workspace has no configured Supabase CLI or `psql` connection.
- T042 isolated PostgreSQL execution is pending because the local Docker daemon is unavailable. Run `supabase/tests/proposal_revision_snapshots.sql` against the isolated post-migration database before deployment.
- T043 browser acceptance remains for the florist/operator, including save/reopen, live catalog reset, retired-item guidance, keyboard/theme/mobile checks, and the timed under-30-second row-entry scenario.

### Human deployment order

1. Export and retain the target preflight row count/min/max/negative-count and current precision.
2. Review and apply `20260721010000_proposal_catalog_row_pricing.sql` after migration `20260721000000`.
3. Run the post-migration precision probe and isolated SQL integration test; compare row count/min/max with the export.
4. Complete the recorded manual acceptance scenarios.
5. Have the human operator commit, push, and deploy the passing Angular production build.
