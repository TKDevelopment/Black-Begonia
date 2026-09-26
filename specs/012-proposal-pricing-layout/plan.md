# Implementation Plan: Proposal Effective Pricing and CRM Ultrawide Layout

**Branch**: `012-proposal-pricing-layout` | **Date**: 2026-09-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-proposal-pricing-layout/spec.md`

**Approved amendment (2026-09-26)**: The revision financial reconciliation section below supersedes the original one-migration and unchanged-payment-table assumptions where they conflict. It responds to the reported stale project balance after a submitted revision.

## Summary

Retire percentage-derived labor while preserving optional manual labor lines, add a product-only Actual Unit Price override without changing catalog composition or shopping-list math, and standardize authenticated CRM page shells for useful 34-inch ultrawide expansion. The implementation keeps the existing `unit_price` field as the effective/customer quote for compatibility, stores a nullable product override plus calculated benchmark in private editor snapshots, upgrades mutable proposal state to schema version 3, and lazily converts legacy percentage labor into one idempotently tagged manual line. Submitted history remains immutable. One additive SQL migration updates revision schema defaults and revision-finalization validation; no Edge Function source, storage policy, provider, route, or external dependency changes.

## Technical Context

**Language/Version**: Angular 19.2 / TypeScript 5.8 for the CRM, proposal calculation, persistence adapters, rendering contracts, and responsive layouts; PostgreSQL SQL/PLpgSQL for proposal snapshot-version and finalization validation changes. No Supabase Edge Function source change is required.

**Primary Dependencies**: Angular standalone components, signals, template-driven forms, Angular Router, existing CRM shared page/table primitives, Tailwind utility output plus component SCSS, Supabase JavaScript client/PostgREST repositories, Supabase Postgres JSON snapshots and functions, proposal template renderer contracts, Karma/Jasmine, and the repository's PostgreSQL integration-test workflow. No new runtime dependency is introduced.

**Storage**: Preserve `floral_proposal_line_items.unit_price numeric(12,2)` as the effective quoted price and store `calculated_unit_price` plus nullable `actual_unit_price_override` in the line's existing private `snapshot` JSON. Revision workspace/snapshot JSON moves from schema version 2 to 3 and omits active `labor_percent` and `calculatedLaborAmount`. Change the `project_proposal_revision_workspaces.schema_version` default to 3 and update `finalize_project_proposal_revision` through `supabase/migrations/20260908010000_proposal_effective_pricing_v3.sql` plus matching declarative schemas. Do not rewrite immutable proposal or invoice snapshots, add tables, change RLS, or change storage.

**Testing**: Karma/Jasmine tests cover price state transitions, the visible/accessibly associated following-versus-override indicator, zero versus null, clear-to-reset behavior, component-price isolation, no additional network request for override-only edits, labor retirement/conversion, persistence, rendering privacy, revision recovery, and CRM shell/layout classes. PostgreSQL integration tests cover schema-version-3 finalization, legacy immutable preservation, removal of active percentage labor, effective-price/totals invariants, authorization boundaries, and payment-obligation propagation. A documented route-by-route browser audit covers 1366, 1920, 2560, and 3440-by-1440 viewports, populated/loading/empty/error/authorization-denied states where supported, keyboard/focus, 200% zoom, light/dark theme, and contained table overflow. No automated Edge Function test or harness is created or modified.

**Target Platform**: Netlify-hosted Angular application with authenticated CRM routes and the existing customer proposal/document workflow, backed by Supabase. Modern desktop browsers are primary for ultrawide acceptance; current phone and tablet behavior remains a regression boundary.

**Project Type**: Brownfield Angular/Supabase CRM with shared public, customer-access, and authenticated admin surfaces in one application.

**Performance Goals**: For a representative 100-line proposal with up to 1,000 composition rows, at least 95% of Actual Unit Price edits, clears, and dependent total recalculations expose updated values within 200 ms in the existing test environment and add no network call beyond current save/autosave behavior. Layout-only changes add no data request and must not materially regress route rendering or existing production bundle budgets.

**Constraints**: Preserve spec 009 catalog row cost, markup, reserve, pack, aggregation, and shopping-list behavior; preserve manual labor/fee/discount pricing; keep `unit_price` as the effective customer-facing contract; preserve immutable submitted history, invoice/planning data, payment obligations, renderer bindings, and manual Canva PDF upload. A blank Actual Unit Price means reset, while numeric zero is a valid override. No service-role secret enters frontend code. Every changed database object has executable and declarative SQL. Edge Functions remain standalone and receive no automated tests. Public marketing behavior, customer routes, authentication, and mobile interaction patterns are not redesigned. AI agents do not commit or push.

**Scale/Scope**: One primary florist, normal proposals up to the existing representative 100 lines/1,000 composition rows, existing lead drafts and project revision workspaces, and retained immutable proposal history. Pricing work affects two builder routes, one normalized line snapshot, one revision JSON contract, one proposal revision SQL function, renderer/test fixtures, and downstream totals without changing payment tables. Layout work audits 24 authenticated route patterns across 18 component families, with focused overlays and public/customer pages excluded from the fill requirement.

## Constitution Check

*GATE: PASS before Phase 0 research. Re-checked after Phase 1 design below.*

- **Surface classification**: Cross-cutting approved work across the authenticated CRM proposal builder, mutable proposal/revision persistence, customer-facing proposal data projection, project financial snapshots, and all authenticated CRM page layouts. Public marketing routes and customer navigation are unchanged; customer-facing pricing changes only to use the approved effective quote.
- **Brownfield preservation**: Preserve catalog composition row pricing, catalog records, markups, reserve/pack/shopping calculations, manual labor/fee/discount lines, tax/discount semantics, proposal rendering bindings, lead conversion, project revision autosave/finalization, immutable submitted versions, invoice/planning/payment flows, customer approval/signature records, and Canva PDF upload. Only active percentage labor, product effective-price editing, mutable snapshot schema, server validation, and CRM page-width constraints are authorized to change.
- **Supabase security**: Existing internal-user RLS on proposal/revision records remains unchanged. Pricing metadata stays inside existing proposal-owned JSON and is never written to shared catalog rows. Existing private PDF/image storage policies, signed URL boundaries, customer data access, and service-role use in the standalone submission function remain unchanged.
- **Schema migration**: `supabase/migrations/20260908010000_proposal_effective_pricing_v3.sql` changes the workspace schema default to 3 and replaces `finalize_project_proposal_revision` with schema-version-3/effective-total validation while preserving its signature, grants, security-definer settings, and all existing data. Matching declarative table/function files are updated. Initial lead conversion continues through its unchanged function after the authenticated builder has persisted validated V3 state. Immutable snapshot JSON is never mass-updated.
- **Standalone edge functions**: `submit-floral-proposal` remains source-compatible and unchanged; it transports authoritative proposal/workspace IDs to the existing SQL boundaries and performs no line-price calculation. `preview-floral-proposal-pdf` remains untouched. No `_shared` code, cross-function import, automated Edge Function test, or harness is added. Submission receives documented manual smoke coverage; independent type-check is required only if implementation unexpectedly touches Edge Function source.
- **Testing plan**: Focused Angular tests cover builder/service/workflow/revision/renderer/layout behavior and contribute meaningful coverage toward the 80% target. PostgreSQL suites validate the changed revision function, V3 contracts, history immutability, and unchanged initial-conversion/payment propagation. Visual acceptance records every CRM route family at four widths and key state variants. No prohibited Edge Function test is created or modified.
- **Frontend boundary plan**: Work remains in the current authenticated CRM and shared core model/service boundaries and does not begin the future frontend split. Customer render projection remains a typed core contract. Routes, guards, Netlify configuration, SSR ownership, and deployment topology remain unchanged, so rollback is a coordinated app/database compatibility operation rather than a routing migration.
- **Proposal workflow rule**: Effective `unit_price` continues to feed the customer document, invoice snapshot, planning values, project obligations, and future reports. Calculated price and override state remain private. The approved/signed document lifecycle and manual Canva PDF upload are preserved; acceptance includes a manual check that the uploaded document matches the effective quote because external PDFs cannot be structurally verified by the application.
- **Security and privacy**: Calculated prices, composition costs, markup, shopping projections, and override state remain internal. Customer-facing rendering exposes only `unit_price`. Existing customer details, emails, proposal passcodes, signatures, PDFs, and payment records retain their current boundaries; no secret, credential, email flow, or public record is added.
- **Git publication boundary**: AI agents will not run commit, push, or commit/push-capable automation. Source publication and migration/deployment approval remain human responsibilities.

## Project Structure

### Documentation (this feature)

```text
specs/012-proposal-pricing-layout/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/
    proposal-effective-pricing.md
    crm-ultrawide-layout.md
  checklists/
    requirements.md
```

### Source Code (repository root)

```text
src/
  styles.scss                                  # shared crm-page-frame utility
  app/
    app.routes.ts                              # route inventory; no route behavior change
    core/
      layouts/private-layout/                  # post-navigation content-width boundary
      models/
        floral-proposal.ts
        project-proposal-revision-workspace.ts
      proposal-templates/                      # effective Unit Price projection
      supabase/
        repositories/floral-proposal-repository.service.ts
        services/
          floral-proposal-builder.service.ts
          floral-proposal-workflow.service.ts
          project-proposal-revision.service.ts
      testing/workflow-fixtures.ts
    components/private/
      floral-proposal-builder/
      dashboard/
      leads/
      contacts/
      organizations/
      catalog-items/
      tax-regions/
      projects/
      payments/
      tasks/
      workshops/

supabase/
  migrations/
    20260908010000_proposal_effective_pricing_v3.sql
  schemas/public/
    tables/project_proposal_revision_workspaces.sql
    functions/
      finalize_project_proposal_revision.sql
  tests/
    proposal_revision_snapshots.sql
    integrated_project_payments.sql
```

**Structure Decision**: Extend the existing centralized proposal calculator and JSON snapshot adapters instead of introducing a parallel pricing service or renaming the broadly consumed `unit_price` contract. The mutable editor uses an explicit product price-state union; persistence projects that state into existing line/workspace snapshots, while customer rendering receives only the effective value. A single prefixed global CRM page-frame utility and stable `data-crm-page-shell` marker remove repeated page-width caps and make geometry measurable, with page-specific grid/form rules retained for readability. Database V3 validation stays in the existing revision-finalization boundary; initial conversion continues to trust the validated proposal state persisted by the authenticated builder.

## Phase 0 Research Outcomes

- Keep `unit_price` as the effective Actual Unit Price at persistence, render, customer, and financial boundaries; add `calculated_unit_price` and nullable `actual_unit_price_override` only to private mutable state/snapshots.
- Use null, never truthiness, to represent calculated-following state so a zero override remains valid. Clearing the input writes null and immediately restores the current calculated value.
- Upgrade mutable snapshots/workspaces to V3, remove active percentage-labor properties, and retain V1/V2 read adapters solely for immutable history and one-time mutable conversion.
- Preserve a legacy draft total by converting the recorded percentage surcharge into one tagged quantity-one manual labor line. Reconcile against the recorded subtotal and block with repair guidance on a discrepancy greater than one cent; use durable markers to make conversion crash-safe and idempotent.
- Do not add proposal-line relational columns: the existing effective `unit_price` is queryable, while calculated/override state is product-only editor metadata already suited to the existing private line `snapshot` JSON.
- Keep customer renderer/template bindings on `item.unit_price`; strip private calculated/override metadata from render projection. Project financial/payment functions continue consuming immutable scalar totals.
- Change no Edge Function or initial-conversion SQL source. Enforce mutable V3/effective-total invariants before lead-proposal persistence and in the existing revision-finalization SQL function; retain initial conversion/payment regression coverage because it consumes the resulting scalar totals.
- Standardize page-shell width at the authenticated layout/page boundary, remove fixed 1,180/1,152/1,880-pixel page caps, retain readable inner form/copy limits and focused overlay widths, and contain unavoidable table overflow locally.
- Validate the full registered route inventory rather than only pages found by a max-width search; include loading, empty, error, detail/list, theme, zoom, and mobile regression states.

See [research.md](./research.md) for decisions, rationale, and alternatives.

## Phase 1 Design Artifacts

- [data-model.md](./data-model.md): product calculated/following/override state, effective price, V3 snapshots, legacy labor conversion, render projection, totals, and layout audit entities.
- [contracts/proposal-effective-pricing.md](./contracts/proposal-effective-pricing.md): editor, calculation, persistence, legacy adaptation, customer projection, submission, accessibility, and validation contracts.
- [contracts/crm-ultrawide-layout.md](./contracts/crm-ultrawide-layout.md): route inventory, page-shell geometry, responsive reflow, exclusions, and acceptance evidence.
- [quickstart.md](./quickstart.md): migration/deployment order, focused automated checks, pricing/submission smoke scenarios, full CRM viewport audit, rollback, and human handoff.

## Architecture and Delivery Design

### Effective product pricing flow

1. Composition rows recalculate the product's cent-rounded `calculated_unit_price` under existing spec 009 rules.
2. Mutable product state resolves `unit_price = actual_unit_price_override ?? calculated_unit_price`.
3. Product subtotal becomes `round2(quantity × unit_price)`; manual labor/fee/discount paths remain unchanged.
4. Totals sum line subtotals, with manual labor included normally and no percentage-derived labor term.
5. Autosave and lead-draft persistence store calculated/override metadata privately and effective `unit_price` compatibly.
6. Customer render projection exposes only effective `unit_price`; the immutable submitted snapshot retains the V3 editor facts for future revision adaptation without exposing them to the customer template.
7. Existing invoice and obligation workflows consume the resulting scalar total and require no payment-table redesign.

### Legacy mutable-state upgrade

1. A shared adapter accepts lead drafts, existing V2 workspaces, or immutable V1/V2 baselines being copied into a new workspace.
2. It derives the legacy percentage amount first from a valid recorded calculated-labor breakdown, otherwise from recorded subtotal minus existing line subtotals, and finally from products times recorded percentage; all candidates must reconcile within one cent.
3. For a positive amount, it creates or reuses one manual labor line tagged with stable conversion key `labor-percent-v1`; zero/missing percentages create no line.
4. It writes V3 state without active `labor_percent` or `calculatedLaborAmount`, records conversion metadata, recalculates, and verifies the pre-upgrade total.
5. Marker-only and line-only partial-save states repair each other. A mismatch blocks editing/submission with explicit repair guidance rather than changing financial meaning.
6. Existing V2 workspaces are persisted as V3 immediately after a successful adaptation; immutable source snapshots remain unchanged.

### CRM ultrawide flow

1. `PrivateLayoutComponent` remains the sole sidebar/available-width owner.
2. A shared `.crm-page-frame` contract plus `data-crm-page-shell` marker sets full available width and no arbitrary desktop maximum while preserving responsive inline padding.
3. Each registered CRM component applies the shell at its primary page container. Fixed caps on proposal builder, lists/details, workshop editor, and financials are removed; focused forms, copy, previews, and modals retain task-specific line lengths.
4. Dense grids use bounded `minmax`/auto-fit behavior, and tables scroll only inside their table shell when columns cannot fit.
5. Acceptance measures the rendered primary shell against the post-navigation main area at 3440-by-1440 and checks page-level overflow at all required widths.

## Migration and Deployment Strategy

1. Inventory mutable lead proposals and project revision workspaces by snapshot schema/labor percentage, and export counts plus current financial totals. Do not modify immutable invoice/finalized snapshots.
2. Schedule a short proposal-editing maintenance window so an old frontend cannot submit V2 while the new SQL contract is active.
3. Apply `20260908010000_proposal_effective_pricing_v3.sql`. It changes the workspace default, replaces the revision-finalization function with V3 validation, preserves its signature/grants/security settings, and performs no history rewrite.
4. Run focused PostgreSQL tests and verify existing RLS, row counts, immutable snapshot hashes, and payment records are unchanged.
5. Deploy the Angular application containing V3 adapters, pricing UI/calculation changes, renderer projection, and CRM page-frame changes, then end the maintenance window.
6. Open and save representative legacy lead drafts and existing V2 workspaces, verifying exact one-line conversion and immediate V3 persistence. Submit a new proposal and a revision and compare customer PDF, active invoice snapshot, and obligations.
7. Complete the full route/viewport audit before production acceptance. No Edge Function, secret, storage, Netlify, SSR, email, or provider deployment is required.

**Rollback considerations**: Leave the additive/default/function migration recorded and never rewrite or delete immutable snapshots. An older frontend is unsafe for V3 product overrides because it would recompute effective `unit_price`; if Angular rollback is necessary, place proposal editing/revision submission in read-only maintenance mode until a V3-compatible forward fix is restored. CRM shell CSS may be rolled back independently. If SQL rollback is required during the maintenance window, restore the prior function definitions without altering workspace/snapshot data; do not permit submission of already-upgraded V3 workspaces through a V2-only function.

## Post-Design Constitution Re-Check

**Status**: PASS

- The design remains within the explicitly approved CRM, proposal projection, and financial contract surfaces.
- Mutable V3 conversion is data-preserving and idempotent; immutable history is never rewritten.
- The one database migration has matching declarative revision-function/table updates and retains RLS, grants, and security boundaries.
- Private calculated/override information is excluded from customer rendering while effective totals remain traceable for invoices, planning, payments, and reporting.
- Manual labor, fee, discount, catalog composition, shopping list, Canva PDF, approval/signature, and existing payment behavior remain intact.
- Angular and PostgreSQL coverage plus documented viewport/submission acceptance address every changed boundary; no prohibited Edge Function tests are introduced.
- No new framework, provider, deployment surface, secret, storage path, or public route is added.
- Git publication remains human-owned.

## Complexity Tracking

No constitution violations require justification.

## Implementation amendment: revised project balances (2026-09-26)

The original V3 pricing migration validates the revised snapshot, but an
already paid final obligation can retain an obsolete target after submission.
The additional `20260926010000_reconcile_revision_finances.sql` migration
updates the obligation-kind constraint and active-kind index, replaces the
reconciliation and financial-summary functions, adds an authenticated internal
CRM command for scheduling a revision installment, and repairs existing active
revisions whose obligation basis or target sum is stale. Matching declarative
function and table definitions accompany it. Existing receipt transactions,
allocations, and immutable proposal snapshots are never rewritten.

The builder saves and checks its current V3 totals immediately before PDF
submission. Project details reads the active snapshot and one financial-summary
RPC, displays the current total and outstanding balance, and offers a dated
revision installment only for an unscheduled increase. The deposit and final
amount cards are removed from the summary because the installment table shows
those amounts with status and receipt history.

The PostgreSQL regression fixture covers $3,210 fully paid, $963 partially
paid, and $0 paid against a $4,500 revision; installment scheduling; a later
lower quote; and overpayment after a quote drops below receipts. The migration
must follow the original V3 migration and precede deploying the updated CRM.
The database suite and preflight/hash comparison remain release gates when an
isolated PostgreSQL runtime is available.

## Implementation amendment: reopening revisions with blank lines (2026-09-26)

The builder's draft serializer previously retained unused blank editor rows,
while the revision adapter rejected every unnamed line. The V3 adapter now
removes only inert, zero amount unnamed rows when named lines exist, and
reconciles the remaining rows to the recorded subtotal. A priced or populated
unnamed row stays editable with a repair warning; validation blocks autosave
and submission until it is named. Existing workspaces are upgraded and saved
when valid, while one needing a line name remains an in-memory editable copy
until the florist repairs it. New draft serialization applies the same blank
row rule. Immutable submitted snapshots are not modified.

## Implementation amendment: installment payment email (2026-09-26)

Project Details issues an installment-specific request through the existing
authenticated payment request Edge Function. The service-role SQL command
validates the selected obligation and outstanding cents, stores its obligation
ID on the request, and keeps unrelated active installment requests intact.
Immediate delivery uses the existing payment message processor and secure
`/pay/<token>` checkout route with installment-due email copy. Checkout
resolution and reservation reject stale balances; provider receipt allocation
targets the request's obligation. The function verifies the caller is an active
internal CRM user before using the service-role client.

Apply `20260926020000_installment_payment_email.sql` after the revision-finance
migration and deploy the matching Edge Functions and Angular app together. Run
`supabase/tests/installment_payment_requests.sql` and a customer/provider smoke
payment before enabling the action in production. This amendment supersedes the
original plan's unchanged email and Edge Function assumptions for this follow-up.

## Implementation amendment: customer payment-method switching (2026-09-26)

`create-payment-checkout` now checks for an active Stripe Checkout Session when
the customer chooses Venmo, cash, or check. It reads the provider session,
expires it only while open, and then conditionally marks the local attempt
canceled. A completed session leaves the payment locked for reconciliation. The
card choice can reuse its current session. The `/pay/` component keeps the
method list available after a card return and offers a return button from cash
and check confirmations. The customer service surfaces safe Edge Function error
messages.

`20260926030000_payment_method_switch.sql` preserves a reminder pause when a
manual intention changes, validates Venmo targets in settings, and projects
Venmo only for a usable destination. Apply it after the installment-email
migration, deploy the updated checkout Edge Function and Angular app, then run
`supabase/tests/payment_method_switch.sql` and a Stripe sandbox cancel/switch
smoke test. The provider key must permit retrieving and expiring Checkout
Sessions.
