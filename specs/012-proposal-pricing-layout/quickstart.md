# Quickstart: Proposal Effective Pricing and CRM Ultrawide Layout

## 1. Scope and Release Shape

This feature requires one coordinated PostgreSQL migration and Angular deployment. It does not add an Edge Function, table, route, dependency, storage bucket/policy, secret, email/provider integration, or Netlify/SSR configuration.

The migration and Angular release must occur during a short proposal-editing maintenance window because an old frontend can overwrite V3 effective prices and the new frontend requires V3 finalization.

## 2. Preflight

Export these results from the target environment before applying the migration:

```sql
select schema_version, count(*)
from public.project_proposal_revision_workspaces
group by schema_version
order by schema_version;

select count(*) as workspaces_with_labor_percent
from public.project_proposal_revision_workspaces
where coalesce((draft_snapshot->>'labor_percent')::numeric, 0) <> 0;

select count(*) as editable_lead_proposals_with_labor_percent
from public.floral_proposals
where status = 'draft'
  and coalesce((snapshot->>'labor_percent')::numeric, 0) <> 0;

select count(*) as invoice_snapshot_count,
       md5(coalesce(string_agg(
         project_proposal_invoice_snapshot_id::text || ':' || snapshot::text,
         '|' order by project_proposal_invoice_snapshot_id
       ), '')) as invoice_snapshot_hash
from public.project_proposal_invoice_snapshots;

select count(*) as finalized_proposal_count,
       md5(coalesce(string_agg(
         floral_proposal_id::text || ':' || finalized_snapshot::text,
         '|' order by floral_proposal_id
       ), '')) as finalized_proposal_hash
from public.floral_proposals
where finalized_snapshot is not null;
```

Also retain:

- proposal, normalized line, and workspace row counts;
- active invoice snapshot IDs and project obligation amounts for representative projects;
- one new draft, one zero-percent legacy draft, one nonzero-percent legacy draft, one existing V2 revision workspace, and one immutable V2 submitted snapshot;
- one proposal with product, manual labor, fee, and discount lines;
- catalog/component fixtures from spec 009, including pack and reserve data.

## 3. Apply Database Contract

1. Announce and begin proposal-editing/submission maintenance.
2. Confirm migrations through `20260908000000_workshop_expired_booking_deletion.sql` are present.
3. Apply `supabase/migrations/20260908010000_proposal_effective_pricing_v3.sql`.
4. Confirm `project_proposal_revision_workspaces.schema_version` defaults to `3`.
5. Confirm the replaced `finalize_project_proposal_revision` function preserves its prior signature, `SECURITY DEFINER`, `search_path`, revokes, and service-role grant; confirm initial conversion function definitions remain unchanged.
6. Run `supabase/tests/proposal_revision_snapshots.sql` and `supabase/tests/integrated_project_payments.sql` through the repository's isolated Supabase/PostgreSQL pgTAP workflow.
7. Re-run the immutable snapshot counts/hashes. They must match preflight exactly.
8. Keep proposal editing closed until the V3 Angular deployment completes.

When a configured local Supabase runtime is available, use the established repository flow:

```powershell
npx --yes supabase@latest db reset --local --no-seed
npx --yes supabase@latest test db
```

If local Docker/database access is unavailable, record the block and run the SQL suites in the authorized isolated environment before production deployment.

## 4. Focused Angular Verification

Before implementation, run the baseline command using only existing specs that do not target, invoke, or simulate Edge Function request/response behavior:

```powershell
npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include=src/app/core/supabase/services/floral-proposal-builder.service.spec.ts --include=src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts --include=src/app/core/supabase/repositories/floral-proposal-repository.service.spec.ts --include=src/app/core/supabase/services/project-proposal-revision.service.spec.ts --include=src/app/core/supabase/services/floral-proposal-renderer.service.spec.ts
```

After the feature test files have been created, run the focused pricing/persistence/rendering suites:

```powershell
npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include=src/app/core/supabase/services/floral-proposal-builder.service.spec.ts --include=src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts --include=src/app/core/supabase/repositories/floral-proposal-repository.service.spec.ts --include=src/app/core/supabase/services/floral-proposal-workflow.snapshot.spec.ts --include=src/app/core/supabase/services/project-proposal-revision.service.spec.ts --include=src/app/core/supabase/services/floral-proposal-renderer.service.spec.ts --include=src/app/core/proposal-templates/proposal-template-scene-renderer.service.spec.ts
```

Run routed CRM layout/regression suites for every affected component that has a spec, including the private layout, list/detail views, proposal builder, workshop editor/roster/financials/occurrence/retention, and shared entity shells.

Then run:

```powershell
npx ng test --watch=false --browsers=ChromeHeadless --code-coverage --exclude=src/app/core/supabase/services/floral-proposal-workflow.service.spec.ts
npm run build:prod
git diff --check
```

Record baseline totals, focused totals, approved coverage-suite totals, build budgets/warnings, the deliberate request/response simulation exclusion, and any pre-existing failures separately from feature regressions.

No automated test or harness may target, import, invoke, or simulate a Supabase Edge Function. The feature-specific snapshot tests live in `floral-proposal-workflow.snapshot.spec.ts`; do not add to or run the pre-existing request/response simulation cases in `floral-proposal-workflow.service.spec.ts` as part of this feature. `submit-floral-proposal` source is unchanged; perform the manual submission smoke tests below. Independently type-check it only if implementation unexpectedly changes its source.

## 5. Product Price-Following Scenario

1. Open `/admin/leads/:leadId/floral-proposal-builder` with a product line whose composition calculates to `$100.00`.
2. Confirm the columns read Calculated Unit Price, Actual Unit Price, and Subtotal in that order.
3. Confirm Calculated Unit Price is read-only and Actual Unit Price displays `$100.00`.
4. Confirm the row visibly and accessibly reports `Following calculated price`.
5. Set quantity to `3`; confirm subtotal is `$300.00`.
6. Change a component cost or markup so calculated becomes `$110.00`.
7. Confirm Actual follows to `$110.00` and subtotal becomes `$330.00`.
8. Confirm no additional network request occurs beyond existing save/autosave behavior.

## 6. Override, Zero, Validation, and Clear Scenarios

1. With quantity `3` and calculated price `$100.00`, enter Actual Unit Price `$125.00`.
2. Confirm subtotal becomes `$375.00` and proposal tax/total update.
3. Confirm the row visibly and accessibly reports `Manual override`.
4. Change composition/markup; confirm Calculated changes but Actual remains `$125.00`.
5. Enter `0`; confirm it remains a valid override through save/reopen and subtotal is `$0.00`.
6. Test negative, nonnumeric, nonfinite, and more-than-two-decimal input; confirm actionable line-level error, no lost valid edits, and save/finalize blocked.
7. Clear the Actual field. Confirm it repopulates the current calculated value, resumes following, reports `Following calculated price`, and shows no separate reset control.
8. Enter the same value as Calculated and confirm the row still reports `Manual override`; then change composition and confirm it remains a deliberate override until cleared.
9. Time a representative florist interaction from locating Actual Unit Price through confirming the subtotal and state label; confirm completion in under 30 seconds.

## 7. Composition and Shopping Isolation

1. Record every component row cost, markup, quantity, reserve, pack quantity, effective pack cost, and shopping-list result.
2. Change only Actual Unit Price.
3. Confirm all recorded internal values and shared catalog data remain byte/numerically unchanged.
4. Confirm only product subtotal, proposal totals, and downstream effective financial values change.
5. Exercise Reset to Catalog Price inside a composition row and confirm that spec 009 behavior remains distinct from clearing Actual Unit Price.
6. Replace the product or change its line type; confirm the prior Actual override is not carried to the replacement.

## 8. Manual Line and Labor Retirement

1. Confirm Labor Percentage is absent from controls and summary.
2. Confirm Calculated Labor is absent from Totals.
3. Add manual labor, fee, and discount lines; confirm their existing Unit Price fields and sign/totals behavior remain unchanged.
4. Confirm `laborTotal` equals manual labor only and no percentage term appears in V3 mutable state or customer render data.

## 9. Legacy Mutable Conversion

For a legacy draft/workspace with a known nonzero percentage:

1. Record line subtotals, calculated labor, subtotal, tax, and total.
2. Open it once in the V3 application.
3. Confirm exactly one quantity-one line named `Labor (converted from legacy percentage)` or the approved equivalent appears.
4. Confirm its tagged amount matches the recorded legacy surcharge and every pre-conversion financial total is preserved to cents.
5. Confirm active labor percentage/calculated-labor properties are absent and V3 saves immediately.
6. Refresh repeatedly and exercise autosave recovery; confirm no duplicate conversion line.
7. Test marker-only and line-only partial fixtures; confirm repair to exactly one line.
8. Test a mismatched/duplicate fixture; confirm editing/submission blocks with repair guidance and source data remains unchanged.
9. Test zero/missing percentage; confirm no conversion line.
10. Confirm the immutable source invoice/finalized snapshot hash remains unchanged.

## 10. Revision, Submission, Customer, and Payments

1. Save/reopen an overridden lead draft and V3 project revision; confirm calculated, nullable override, effective price, and totals round-trip.
2. Let revision autosave complete, reload, and confirm V3 state remains intact.
3. Generate/preview any in-app render and confirm the customer data contains only `Unit Price = effective unit_price`; search output for calculated/override metadata and expect none.
4. Manually compare the Canva PDF's quoted line amounts and total with the saved effective proposal values before upload.
5. Submit one initial proposal and one revision through the unchanged `submit-floral-proposal` boundary.
6. Confirm the immutable active invoice snapshot records effective line prices and matching scalar totals while prior snapshots remain unchanged.
7. Confirm deposit/final obligations and project financial summary derive from the new active total and preserve existing received-payment behavior.
8. Replay submission with the same idempotency key and confirm no duplicate snapshot, document, obligation, or activity.

## 11. Proposal Performance

1. Seed a representative 100-line proposal with up to 1,000 composition rows.
2. Perform at least 20 mixed Actual edits and clears.
3. Measure from input handling to visible subtotal/total state.
4. Confirm at least 95% complete within 200ms in the documented test environment.
5. Confirm shopping data remains unchanged for override-only edits and no per-edit network call is introduced.

## 12. CRM Ultrawide Route Audit

Use the route inventory in [contracts/crm-ultrawide-layout.md](./contracts/crm-ultrawide-layout.md). For each route family, exercise a representative populated state and every supported loading, empty, error, and authorization-denied state.

At 3440-by-1440, evaluate:

```js
const page = document.querySelector('[data-crm-page-shell]');
const main = document.querySelector('.crm-shell-app main');
const mainStyle = getComputedStyle(main);
const availableWidth = main.clientWidth
  - parseFloat(mainStyle.paddingInlineStart || '0')
  - parseFloat(mainStyle.paddingInlineEnd || '0');
const ratio = page.getBoundingClientRect().width / availableWidth;
({ availableWidth, pageWidth: page.getBoundingClientRect().width, ratio, pass: ratio >= 0.9 });
```

At 1366, 1920, 2560, and 3440 widths, evaluate:

```js
({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
  pass: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
});
```

Record this matrix:

| Route family | State/theme | Viewport | Frame ratio at 3440 | Page overflow | Primary action visible | Overlap/clipping | Contained overflow notes | Result |
|---|---|---:|---:|---|---|---|---|---|
| Populate during acceptance | | | | | | | | |

Special checks:

- Confirm formerly 1,880px-capped pages use at least 90% of post-navigation width.
- Confirm workshop editor and financials no longer stop near 1,152/1,180px and their grids gain useful space.
- Confirm roster, occurrence, and retention remain fluid with no regression.
- Confirm dashboard uses the standard shell without adding new dashboard functionality.
- Confirm modal, preview, copy, and focused-form maximum widths remain intentional.
- Confirm tables scroll only inside their named wrappers when necessary.

## 13. Mobile, Zoom, Theme, and Accessibility Regression

1. Smoke every route family at 390-by-844 and representative routes at 768-by-1024.
2. Repeat dense builder, roster, project detail, and workshop editor checks at 200% browser zoom.
3. Confirm no page-level two-dimensional scroll except contained data regions.
4. Tab through page actions and overflow regions; confirm DOM order is logical, focus remains visible, and reflow did not reorder interaction.
5. Confirm headings, landmarks, labels, tables, loading/error live semantics, and light/dark contrast remain intact.
6. Recheck the spec 011 mobile roster grid/toolbar/table refinements after the shared page-frame change.

## 14. Rollback

- Do not drop V3 metadata, rewrite workspaces backward, or alter immutable snapshot history.
- CRM page-frame CSS can be reverted independently if it causes layout regression.
- An old frontend must not edit V3 proposals because its product recalculation can erase Actual overrides. If Angular rollback is required, keep proposal editing/revision submission in maintenance/read-only mode until a V3-compatible forward fix is deployed.
- If SQL functions must be restored during the release window, do not submit V3 workspaces through V2-only validation. Preserve all rows and investigate rather than coercing schema versions.
- Existing customer documents, invoice snapshots, payments, signatures, and catalog/shopping facts remain authoritative throughout rollback.

## 15. Human Handoff

The human operator:

1. reviews the plan, migration, tests, and immutable preflight evidence;
2. controls the maintenance window and database/application deployment;
3. completes the browser and Canva PDF acceptance record;
4. commits and pushes approved changes.

AI agents must not commit or push.
