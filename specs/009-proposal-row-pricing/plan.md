# Implementation Plan: Proposal Catalog Row Pricing

**Branch**: `009-proposal-row-pricing` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-proposal-row-pricing/spec.md`

## Summary

Make the Internal Catalog Composition unit-price cell editable and proposal-row-owned. Selecting a pack-priced catalog item continues to treat `catalog_items.base_unit_cost` as the full pack purchase cost and derives the row's four-decimal per-unit cost by dividing by snapshotted pack quantity. Editing the row cost recalculates marked-up selling price, product-line totals, proposal totals, and a cent-rounded effective pack cost without writing back to the catalog. An explicit reset action refreshes both row cost and pack-quantity snapshot from the current catalog item. Shopping-list generation groups compatible contributions, rounds pack count once after aggregation, and uses the highest contributing per-unit cost when prices differ. Existing submitted snapshots remain immutable and are adapted without catalog repricing.

## Technical Context

**Language/Version**: Angular 19 / TypeScript 5.8 for the authenticated CRM builder and calculation/persistence adapters; PostgreSQL for one precision-only schema migration. No Supabase Edge Function runtime change is required.

**Primary Dependencies**: Angular standalone components, signals, template-driven form bindings, existing `FloralProposalBuilderService`, Supabase client/PostgREST repositories, project revision workspace JSON, Karma/Jasmine, and pgTAP-style PostgreSQL integration checks already used by the repository. No new runtime dependency is required.

**Storage**: Preserve `catalog_items.base_unit_cost numeric(10,2)` as full pack cost and all cent-rounded proposal/shopping totals. Widen only `floral_proposal_components.base_unit_cost` from `numeric(12,2)` to `numeric(14,4)` through `supabase/migrations/20260721010000_proposal_catalog_row_pricing.sql` and the matching declarative table definition, preserving the existing ten-digit integer range while adding two fractional digits. Continue storing pack quantity and effective pack-cost facts in the component snapshot/workspace JSON. No new table, RLS policy, storage policy, or public data path is introduced.

**Testing**: Karma/Jasmine coverage for component input/reset behavior, catalog selection, four-decimal derivation, markup and line rollup, aggregated shopping-list pack rounding, highest-price selection, legacy snapshot adaptation, lead proposal persistence, project revision autosave/resume, and immutable history hydration. PostgreSQL integration coverage verifies the four-decimal column, lossless existing-data conversion, unchanged RLS/grants, and cent precision of persisted totals. No automated Edge Function tests are created because no Edge Function changes.

**Target Platform**: Netlify-hosted Angular CRM admin portal backed by Supabase Postgres. Public website, client proposal/payment pages, SSR routing, and storage delivery are unchanged.

**Project Type**: Brownfield Angular/Supabase CRM. The work is contained in the shared internal floral proposal builder, its calculation/persistence services, proposal models, proposal component schema, and existing proposal/revision tests.

**Performance Goals**: With a representative 100-line proposal, at least 95% of unit-price edits must expose recalculated row, line, proposal, and shopping-list values within 200 ms in the existing builder test environment. A price edit or reset must not add a network request beyond the existing draft/autosave workflow, and shopping-list generation remains one in-memory pass plus bounded grouping.

**Constraints**: Preserve catalog full-pack pricing semantics, pack quantities, reserve behavior, markup/labor/tax calculations, initial lead proposal creation, project revision autosave, submitted snapshot immutability, manual Canva PDF upload, and current proposal/payment linkage. Four-decimal precision applies only to proposal catalog-row per-unit cost; sell prices, pack costs, subtotals, taxes, totals, and catalog costs remain cents. Do not reprice saved rows from live catalog data except through explicit selection of a different item or Reset to Catalog Price. No frontend service-role secret, new public route, shared Edge Function import, Edge Function test, commit, or push.

**Scale/Scope**: One business-owner florist, normal proposal sizes up to the existing representative 100 lines, hundreds of retained proposals and revisions, and multiple catalog-row contributions per shopping item. Affects `/admin/leads/:leadId/floral-proposal-builder`, `/admin/projects/:projectId/proposal-revision`, `floral_proposal_components.base_unit_cost`, component snapshot/workspace JSON adapters, and shopping-list projections. Catalog CRUD, proposal PDFs, customer approval, payment collection, and unrelated line types remain out of scope.

## Constitution Check

*GATE: PASS before Phase 0 research. Re-checked after Phase 1 design below.*

- **Surface classification**: Authenticated CRM admin proposal builder and Supabase proposal persistence only. No public website or client portal content, route, or behavior changes.
- **Brownfield preservation**: Preserve catalog CRUD and pack-cost meaning, catalog search, row quantity/markup/reserve, product-line rollup, labor/tax, lead proposal persistence, revision workspace autosave/resume/discard, submitted proposal versions, shopping-list persistence, manual approved/signed PDF upload, project financial snapshots, and payment calculations. Authorized changes are the editable component cost, reset behavior, precision, and dependent shopping aggregation.
- **Supabase security**: Existing authenticated internal CRM RLS and repository access remain unchanged. Proposal-row overrides are written only through existing proposal/workspace boundaries and never update `catalog_items`. No storage policy, anonymous access, role grant, service-role boundary, or secret changes.
- **Schema migration**: `supabase/migrations/20260721010000_proposal_catalog_row_pricing.sql` applies after `20260721000000_refine_payment_installments.sql`, widens `floral_proposal_components.base_unit_cost` to `numeric(14,4)` with a lossless cast, preserves the existing ten-digit integer range and stored values, and leaves cent-valued columns unchanged. The declarative component table definition mirrors it.
- **Standalone edge functions**: No Edge Function changes. Existing proposal submission functions remain independently deployable and are neither imported nor invoked by automated tests introduced here.
- **Testing plan**: Focused Angular tests cover every touched component/service/repository behavior and contribute meaningful proposal-workflow coverage. Database integration tests cover the changed column contract, migration preservation, and authorization invariance. No Edge Function automated test or harness is permitted or needed.
- **Frontend boundary plan**: Work stays inside private CRM components/services and does not advance or impede future public/client/CRM separation. No routing, Netlify, or SSR deployment change.
- **Proposal workflow rule**: The builder remains the invoice/planning source, submitted snapshots remain historical financial evidence, and manual Canva PDF upload remains the document path. No renderer, template-studio, e-signature, or client delivery scope is added.
- **Security and privacy**: Unit costs, markups, shopping estimates, customer/event context, PDFs, and payment totals retain their existing private boundaries. No new email, passcode, signature, payment credential, provider payload, signed URL, or secret handling.
- **Git publication boundary**: The AI agent will not commit, push, or execute commit/push-capable automation. Source-control publication remains a human handoff.

## Project Structure

### Documentation (this feature)

```text
specs/009-proposal-row-pricing/
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/
    proposal-catalog-row-pricing.md
  checklists/
    requirements.md
```

### Source Code (repository root)

```text
src/app/
  components/private/floral-proposal-builder/
    floral-proposal-builder.component.html
    floral-proposal-builder.component.ts
    floral-proposal-builder.component.spec.ts
  core/models/
    floral-proposal.ts
    project-proposal-revision-workspace.ts
  core/supabase/repositories/
    floral-proposal-repository.service.ts
    floral-proposal-repository.service.spec.ts
  core/supabase/services/
    floral-proposal-builder.service.ts
    floral-proposal-builder.service.spec.ts
    floral-proposal-workflow.service.ts
    floral-proposal-workflow.service.spec.ts
    project-proposal-revision.service.spec.ts

supabase/
  migrations/
    20260721010000_proposal_catalog_row_pricing.sql
  schemas/public/tables/
    floral_proposal_components.sql
  tests/
    proposal_revision_snapshots.sql
```

**Structure Decision**: Extend the existing builder row DTO and centralized calculation service rather than introduce a second pricing model. `base_unit_cost` remains the canonical proposal-row per-unit cost, widened to four decimals only where normalized components persist. The existing JSON snapshot/workspace carries pack quantity and derived effective pack cost, with legacy `purchase_unit_cost` accepted during hydration. Shopping-list calculations remain in `FloralProposalBuilderService`; the component only handles editing and catalog/reset commands.

## Phase 0 Research Outcomes

- Preserve `catalog_items.base_unit_cost` as full pack cost for pack-priced items; do not migrate or reinterpret the catalog.
- Use the existing component `base_unit_cost` as proposal-row per-unit cost and widen its normalized database precision to four decimals.
- Derive effective pack cost from row per-unit cost multiplied by snapshotted pack quantity; do not add a redundant authoritative table column.
- Keep proposal revision schema version 2 because the JSON shape remains backward compatible; adapt legacy `purchase_unit_cost` as an input alias and emit an explicit effective pack-cost snapshot fact.
- Preserve saved row and pack snapshots on hydration; consult live catalog data only for new selection, changed selection, or explicit reset.
- Aggregate compatible shopping contributions before pack rounding and use the highest contributing per-unit cost. Separate entries only when the same catalog identity has incompatible snapshotted pack quantities or unit types, preventing mathematically invalid merging.
- Keep selling price and every customer-facing/financial total cent-rounded while retaining four decimals only for row cost calculations.
- Make no Edge Function, route, storage, catalog CRUD, or payment change.

See [research.md](./research.md) for decisions and rejected alternatives.

## Phase 1 Design Artifacts

- [data-model.md](./data-model.md): catalog pack cost, proposal-row unit cost, pack snapshot, effective pack cost, product-line rollup, workspace/snapshot compatibility, and shopping aggregation.
- [contracts/proposal-catalog-row-pricing.md](./contracts/proposal-catalog-row-pricing.md): builder UI, calculation, reset, persistence, validation, accessibility, and compatibility contracts.
- [quickstart.md](./quickstart.md): migration order, focused tests, build verification, and manual lead/revision/shopping scenarios.

## Migration And Rollout Strategy

1. Export a preflight count and min/max precision summary for `floral_proposal_components.base_unit_cost`; verify no negative values or values beyond the target numeric range.
2. Apply `20260721010000_proposal_catalog_row_pricing.sql` after the payment installment migration. Widen `base_unit_cost` from `numeric(12,2)` to `numeric(14,4)` with an explicit cast so the existing ten-digit integer range is retained; do not modify existing component rows, catalog prices, snapshots, or cent-valued totals.
3. Run database contract checks confirming all existing component costs retain their numeric value, the column accepts four decimals, existing proposal RLS/grants remain unchanged, and submitted snapshots are untouched.
4. Deploy Angular models, adapters, calculation logic, editable input/reset control, and shopping aggregation together. The previous frontend remains compatible with the widened numeric column during staged rollout.
5. Validate new lead proposal creation and project revision resume/submission with both legacy two-decimal and new four-decimal component rows.
6. Observe proposal save failures and calculation mismatches during acceptance; no Edge Function, Cron, secret, storage, or Netlify configuration deployment is required.

**Rollback considerations**: The UI can be rolled back while the widened column remains safely backward compatible. Do not narrow the column back to two decimals after four-decimal rows exist without an explicit precision-loss audit. JSON snapshots and submitted history require no rollback because existing values are preserved and new derived facts are additive.

## Post-Design Constitution Re-Check

**Status**: PASS

- Design remains inside the authenticated CRM proposal boundary.
- The only normalized schema change has a matching executable, data-preserving migration and declarative definition.
- Existing RLS, grants, storage, secret, and catalog-write boundaries remain unchanged.
- Submitted snapshots are never repriced from live catalog data and remain immutable.
- Manual Canva PDF upload, project financial traceability, and future reporting/payment inputs are preserved.
- Angular and database tests cover calculation, persistence, compatibility, and authorization; no prohibited Edge Function tests are introduced.
- No Edge Function, public route, client portal, framework, or external integration change is required.
- Git publication remains human-owned.

## Complexity Tracking

No constitution violations require justification.
