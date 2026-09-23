---

description: "Dependency-ordered implementation tasks for proposal effective pricing and CRM ultrawide layout"
---

# Tasks: Proposal Effective Pricing and CRM Ultrawide Layout

**Input**: Design documents from `/specs/012-proposal-pricing-layout/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/`, and `quickstart.md`

**Tests**: Follow the repository's Karma/Jasmine and PostgreSQL integration-test
requirements. Write focused tests before the implementation they cover where
practical. Do not create, modify, import, invoke, or simulate an automated test
harness for a Supabase Edge Function.

**Organization**: Tasks are grouped by user story. User Stories 1, 2, and 3 are
all P1; their phase order below reflects technical dependencies rather than a
difference in business priority. User Story 4 is P2 and can proceed in parallel
with the proposal-pricing stream after the shared foundation is ready.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: May run in parallel because the task touches different files and does
  not depend on unfinished work in the same phase.
- **[Story]**: The user story served by the task.
- Every task names the exact file or files it changes or verifies.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish an auditable brownfield baseline and confirm the approved
surface before changing pricing or page geometry.

- [X] T001 Create the implementation acceptance record with the approved CRM, customer-render projection, Supabase, and excluded public/Edge Function surfaces in `specs/012-proposal-pricing-layout/acceptance.md`
- [X] T002 Record the 24 authenticated route patterns, 18 component families, representative record fixtures, and supported populated/loading/empty/error/authorization-denied states from `src/app/app.routes.ts` and `specs/012-proposal-pricing-layout/contracts/crm-ultrawide-layout.md` in `specs/012-proposal-pricing-layout/acceptance.md`
- [X] T003 Run and record the pre-implementation Angular proposal baseline command containing only existing non-Edge-Function specs, the existing CRM layout suites, and the production-build baseline listed in `specs/012-proposal-pricing-layout/quickstart.md` in `specs/012-proposal-pricing-layout/acceptance.md`; reserve feature-created specs and the approved coverage command for T064-T065
- [ ] T004 Export the mutable schema/labor counts, proposal/line/workspace row counts, representative obligation values, and immutable snapshot counts/hashes defined in `specs/012-proposal-pricing-layout/quickstart.md` to `specs/012-proposal-pricing-layout/acceptance.md`
- [X] T005 Verify that manual Canva PDF upload remains the primary proposal-document path, that `supabase/edge_functions/submit-floral-proposal.ts` and `supabase/schemas/public/functions/convert_lead_to_project_with_payments.sql` require no source change, and record the boundary in `specs/012-proposal-pricing-layout/acceptance.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared V3 types, fixtures, safety rules, and CRM page
contract required by all story phases.

**CRITICAL**: Complete this phase before user-story implementation. Do not deploy
the V3 database contract until the Angular V3 reader/writer is complete.

- [X] T006 Define the schema-version-3 editable snapshot, product price-state union, legacy labor conversion metadata/result types, and V1/V2 compatibility input types in `src/app/core/models/floral-proposal.ts` and `src/app/core/models/project-proposal-revision-workspace.ts`
- [X] T007 [P] Add reusable following, overridden, zero-price, invalid-price, legacy labor, partial-conversion, immutable-history, and 100-line/1,000-component fixtures in `src/app/core/testing/workflow-fixtures.ts`
- [X] T008 [P] Add the shared `.crm-page-frame` full-width/min-inline-size-zero/border-box/gutter contract without a global max-width override in `src/styles.scss`
- [X] T009 [P] Add a private-layout regression test that defines the post-navigation measurement boundary without changing navigation geometry in `src/app/core/layouts/private-layout/private-layout.component.spec.ts`
- [X] T010 Document the coordinated migration/application deployment order, unchanged RLS/storage/secrets boundary, read-only rollback requirement for V3 proposals, and human-only commit/push handoff in `specs/012-proposal-pricing-layout/acceptance.md`

**Checkpoint**: Shared V3 vocabulary, deterministic fixtures, and the reusable
page-frame contract are ready.

---

## Phase 3: User Story 1 - Quote an Intentional Client Price (Priority: P1)

**Goal**: Let the florist view the calculated product price, override the actual
quoted price, and reset to following behavior without changing composition or
shopping-list facts.

**Independent Test**: For a product calculated at $100 with quantity 3, enter an
Actual Unit Price of $125 and verify a $375 subtotal while the calculated price,
component rows, catalog data, and shopping list remain unchanged; clear the field
and verify following resumes.

### Tests for User Story 1

- [X] T011 [P] [US1] Add failing calculator tests for calculated-following, explicit override including zero/equal-to-calculated, clear-to-reset, cent rounding, quantity zero, and product/item/type replacement in `src/app/core/supabase/services/floral-proposal-builder.service.spec.ts`
- [X] T012 [US1] Add failing isolation and scale tests proving Actual Unit Price edits do not mutate component costs, markup, reserve, pack, aggregation, catalog records, or shopping-list purchasing totals and meet the 95%-within-200ms target in `src/app/core/supabase/services/floral-proposal-builder.service.spec.ts`
- [X] T013 [P] [US1] Add failing component tests for product-only column order, read-only Calculated Unit Price, editable Actual Unit Price, visible/programmatically associated Following calculated price and Manual override states including equal-valued overrides, no repository/workflow request beyond existing save/autosave behavior, manual-line Unit Price behavior, keyboard clearing, accessible errors, and save/finalize blocking in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts`

### Implementation for User Story 1

- [X] T014 [US1] Centralize product calculated/following/overridden transitions in `src/app/core/supabase/services/floral-proposal-builder.service.ts`, resolving effective `unit_price` with null-aware override logic and preserving existing manual-line semantics
- [X] T015 [US1] Add raw Actual Unit Price input handling and line-level validation for blank reset, zero, nonnegative cents, negative, nonnumeric, nonfinite, and over-precision values in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.ts`
- [X] T016 [US1] Render product columns as Item, Qty, Calculated Unit Price, Actual Unit Price, Subtotal, and Actions; add a visible and programmatically associated Following calculated price or Manual override label derived from override nullability; retain one editable Unit Price control for labor/fee/discount lines and contained narrow-screen overflow in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.html`
- [X] T017 [US1] Add focused styles for read-only versus editable price state, line validation, and table width/focus containment in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.scss`
- [ ] T018 [US1] Run the US1 service/component suites and record intentional-price, equal-valued override identification, clear-to-follow, shopping-isolation, no-extra-network-request, performance, and under-30-second florist acceptance results in `specs/012-proposal-pricing-layout/acceptance.md`

**Checkpoint**: User Story 1 works in memory and is independently testable
without requiring persistence or submission.

---

## Phase 4: User Story 3 - Price Proposals Without Percentage-Based Labor (Priority: P1)

**Goal**: Remove active percentage-derived labor while preserving optional manual
labor and converting a legacy mutable surcharge exactly once without changing its
recorded total.

**Independent Test**: Open a new proposal and a nonzero legacy mutable proposal;
verify that no percentage input or Calculated Labor row exists, the new proposal
has no calculated surcharge, and the legacy proposal receives exactly one tagged
manual labor line with cent-identical totals across reload and autosave recovery.

### Tests for User Story 3

- [X] T019 [P] [US3] Add failing totals and adapter tests for no active percentage labor, manual labor-only totals, zero/missing legacy percentages, one-time conversion, marker-only and line-only repair, mismatch blocking, and immutable-source preservation in `src/app/core/supabase/services/floral-proposal-builder.service.spec.ts`
- [X] T020 [P] [US3] Add failing builder tests proving Labor Percentage and Calculated Labor are absent while manual labor, fee, and discount controls remain unchanged in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts`
- [X] T021 [P] [US3] Add failing pure snapshot-projection and renderer tests proving active labor-percentage fields and calculated-labor values are excluded while explicit manual labor remains customer-visible in `src/app/core/supabase/services/floral-proposal-workflow.snapshot.spec.ts` and `src/app/core/supabase/services/floral-proposal-renderer.service.spec.ts`; do not target, invoke, or simulate an Edge Function

### Implementation for User Story 3

- [X] T022 [US3] Implement the shared mutable V1/V2-to-V3 adapter with conversion key `labor-percent-v1`, cent reconciliation, durable line/top-level markers, partial-state repair, and blocking repair guidance in `src/app/core/supabase/services/floral-proposal-builder.service.ts`
- [X] T023 [US3] Remove active labor-percentage initialization, editing, total arguments, and summary state while keeping manual labor creation/editing in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.ts`
- [X] T024 [US3] Remove the Labor Percentage control and Calculated Labor total row without removing explicit manual labor rows in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.html`
- [X] T025 [US3] Remove percentage labor from mutable proposal/render projections, calculate `laborTotal` from manual labor lines only, and preserve legacy immutable reads in `src/app/core/supabase/services/floral-proposal-workflow.service.ts` and `src/app/core/supabase/services/floral-proposal-renderer.service.ts`
- [ ] T026 [US3] Run the US3 adapter/component/workflow/renderer suites and record conversion idempotency, total reconciliation, manual-line preservation, and immutable hash evidence in `specs/012-proposal-pricing-layout/acceptance.md`

**Checkpoint**: User Story 3 is independently functional; percentage labor is
retired from active editing, and legacy mutable totals are preserved safely.

---

## Phase 5: User Story 2 - Preserve Effective Pricing Through Submission (Priority: P1)

**Goal**: Round-trip calculated and override state through lead drafts and project
revision workspaces while exposing only effective Unit Price to customers and
using it for immutable snapshots, financials, and obligations.

**Independent Test**: Override a product line, save/reopen a lead draft and a
revision, preview and submit each path, and verify private V3 state round-trips
while customer output, immutable snapshots, and obligations consistently use the
effective price.

### Tests for User Story 2

- [X] T027 [P] [US2] Add failing normalized-line round-trip tests for merged snapshot metadata, nullable/zero overrides, effective `unit_price`, and non-product metadata omission in `src/app/core/supabase/repositories/floral-proposal-repository.service.spec.ts`
- [X] T028 [P] [US2] Add failing pure lead snapshot/save validation tests for V3, consistent effective subtotals/scalars, invalid-price blocking, and no percentage labor in `src/app/core/supabase/services/floral-proposal-workflow.snapshot.spec.ts`; do not target, invoke, or simulate Edge Function request/response behavior
- [X] T029 [P] [US2] Add failing revision tests for new V3 workspaces, adaptation and immediate persistence of existing V2 workspaces, immutable baseline copies, autosave recovery, repair blocking, and submission idempotency in `src/app/core/supabase/services/project-proposal-revision.service.spec.ts` and `src/app/core/supabase/repositories/project-proposal-revision-workspace-repository.service.spec.ts`
- [X] T030 [P] [US2] Add failing privacy/compatibility tests proving customer render/template values contain only effective Unit Price and subtotal while V1/V2 immutable proposals retain recorded values in `src/app/core/supabase/services/floral-proposal-renderer.service.spec.ts` and `src/app/core/proposal-templates/proposal-template-scene-renderer.service.spec.ts`
- [X] T031 [P] [US2] Update PostgreSQL tests to require V3 finalization, validate null/zero/overridden effective pricing and scalar totals, reject malformed/percentage-bearing snapshots atomically, preserve old immutable history, and retain idempotency in `supabase/tests/proposal_revision_snapshots.sql`

### Implementation for User Story 2

- [X] T032 [US2] Persist effective `unit_price` and subtotal plus product-only `calculated_unit_price` and nullable `actual_unit_price_override` in merged private line snapshots in `src/app/core/supabase/repositories/floral-proposal-repository.service.ts`
- [X] T033 [US2] Build and validate V3 lead proposal snapshots before save/submission, strip ephemeral input/error state, preserve component/shopping snapshots, and keep the `submit-floral-proposal` payload contract unchanged in `src/app/core/supabase/services/floral-proposal-workflow.service.ts`
- [X] T034 [US2] Adapt immutable V1/V2 baselines and existing mutable V2 workspaces through the shared adapter, persist successful upgrades immediately, and autosave only validated V3 state in `src/app/core/supabase/services/project-proposal-revision.service.ts`
- [X] T035 [US2] Wire builder load, save, autosave, retry, preview, and submit paths to validated V3 state while retaining actionable line/conversion errors and current retry behavior in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.ts`
- [X] T036 [US2] Project only effective `unit_price`, subtotal, and ordinary manual lines into customer merge data while excluding calculated price, override, conversion, and retired labor metadata in `src/app/core/supabase/services/floral-proposal-renderer.service.ts` and `src/app/core/proposal-templates/proposal-template-scene-renderer.service.ts`
- [X] T037 [US2] Create `supabase/migrations/20260908010000_proposal_effective_pricing_v3.sql` and mirror it in `supabase/schemas/public/tables/project_proposal_revision_workspaces.sql` and `supabase/schemas/public/functions/finalize_project_proposal_revision.sql`, changing the workspace default to 3 and enforcing V3/effective-total invariants while preserving function signature, security definer, search path, revokes, grants, RLS, and existing rows
- [X] T038 [US2] Extend initial conversion/payment regression coverage so effective proposal totals drive immutable invoice snapshots, deposit/final obligations, project financial summaries, received-payment preservation, and replay idempotency in `supabase/tests/integrated_project_payments.sql`
- [ ] T039 [US2] Run focused Angular and pgTAP suites and record lead/revision round trips, customer privacy, initial/revision submission, unchanged historical hashes, and payment propagation in `specs/012-proposal-pricing-layout/acceptance.md`
- [ ] T040 [US2] Manually compare the stored effective quote with the Canva PDF, submit one initial proposal and one revision through the unchanged boundary, and record the document/snapshot/obligation/idempotency results in `specs/012-proposal-pricing-layout/acceptance.md`

**Checkpoint**: User Stories 1, 2, and 3 form a complete V3 pricing and submission
flow without changing Edge Function source or immutable history.

---

## Phase 6: User Story 4 - Use the Full CRM on an Ultrawide Display (Priority: P2)

**Goal**: Make every authenticated CRM page use at least 90% of its available
post-navigation width at 3440-by-1440 without page overflow or regressions at
desktop, tablet, mobile, zoom, theme, and supported UI states.

**Independent Test**: Visit every route family at 3440-by-1440 and verify the
unique page shell ratio is at least 0.90; repeat overflow/action/clipping checks at
1366, 1920, 2560, and 3440 pixels plus mobile and 200% zoom smoke coverage, including
each supported populated, loading, empty, error, and authorization-denied state.

### Tests for User Story 4

- [X] T041 [P] [US4] Add shared marker, min-width, and contained-overflow regression tests in `src/app/core/layouts/private-layout/private-layout.component.spec.ts`, `src/app/shared/components/private/entity-table-shell/entity-table-shell.component.spec.ts`, `src/app/shared/components/private/entity-detail-shell/entity-detail-shell.component.spec.ts`, `src/app/shared/components/private/search-filter-bar/search-filter-bar.component.spec.ts`, and `src/app/shared/components/private/crm-page-header/crm-page-header.component.spec.ts`
- [X] T042 [P] [US4] Add dashboard and leads list/detail tests requiring one `data-crm-page-shell` root across populated and supported loading/empty/error/authorization-denied branches in `src/app/components/private/dashboard/dashboard.component.spec.ts`, `src/app/components/private/leads/leads.component.spec.ts`, and `src/app/components/private/leads/lead-detail/lead-detail.component.spec.ts`
- [X] T043 [P] [US4] Add contacts and organizations list/detail tests requiring one `data-crm-page-shell` root across populated and supported loading/empty/error/authorization-denied branches in `src/app/components/private/contacts/contacts.component.spec.ts` and `src/app/components/private/organizations/organizations.component.spec.ts`
- [X] T044 [P] [US4] Add catalog and tax-region list/detail tests requiring one `data-crm-page-shell` root across populated and supported loading/empty/error/authorization-denied branches in `src/app/components/private/catalog-items/catalog-items.component.spec.ts` and `src/app/components/private/tax-regions/tax-regions.component.spec.ts`
- [X] T045 [P] [US4] Add projects list/detail tests for the shared shell, responsive split view, contained table overflow, and supported populated/loading/empty/error/authorization-denied branches in `src/app/components/private/projects/projects.component.spec.ts` and `src/app/components/private/projects/project-details/project-details.component.spec.ts`
- [X] T046 [P] [US4] Add payments and tasks tests for the shared shell, retained filters/sorting/editing, contained table overflow, and supported populated/loading/empty/error/authorization-denied branches in `src/app/components/private/payments/payments.component.spec.ts` and `src/app/components/private/tasks/tasks.component.spec.ts`
- [X] T047 [P] [US4] Add proposal-builder tests for the shared shell, retained pricing/table behavior, contained overflow, and supported loading/error/authorization-denied branches in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts`
- [X] T048 [P] [US4] Add workshop list/editor tests for the shared shell, intentional inner width limits, preserved editing, and supported populated/loading/empty/error/authorization-denied branches in `src/app/components/private/workshops/workshops.component.spec.ts` and `src/app/components/private/workshops/workshop-editor/workshop-editor.component.spec.ts`
- [X] T049 [P] [US4] Add workshop roster/financial tests for the shared shell, contained table overflow, preserved spec 011 mobile behavior, and supported populated/loading/empty/error/authorization-denied branches in `src/app/components/private/workshops/workshop-roster/workshop-roster.component.spec.ts` and `src/app/components/private/workshops/workshop-financials/workshop-financials.component.spec.ts`
- [X] T050 [P] [US4] Add workshop occurrence/retention tests for the shared shell, intentional form widths, existing permissions, and supported populated/loading/empty/error/authorization-denied branches in `src/app/components/private/workshops/workshop-occurrence-detail/workshop-occurrence-detail.component.spec.ts` and `src/app/components/private/workshops/workshop-data-retention-policy/workshop-data-retention-policy.component.spec.ts`

### Implementation for User Story 4

- [X] T051 [P] [US4] Apply the shared page frame to dashboard and leads list/detail while removing only page-level 1,880px caps in `src/app/components/private/dashboard/dashboard.component.html`, `src/app/components/private/leads/leads.component.html`, and `src/app/components/private/leads/lead-detail/lead-detail.component.html`
- [X] T052 [P] [US4] Apply the shared page frame to contacts and organizations list/detail branches while removing only page-level 1,880px caps in `src/app/components/private/contacts/contacts.component.html` and `src/app/components/private/organizations/organizations.component.html`
- [X] T053 [P] [US4] Apply the shared page frame to catalog and tax-region list/detail branches while removing only page-level 1,880px caps in `src/app/components/private/catalog-items/catalog-items.component.html` and `src/app/components/private/tax-regions/tax-regions.component.html`
- [X] T054 [P] [US4] Apply the shared page frame and remove only page-level 1,880px caps from projects list/detail while preserving the fluid-main/bounded-aside layout and modal widths in `src/app/components/private/projects/projects.component.html` and `src/app/components/private/projects/project-details/project-details.component.html`
- [X] T055 [P] [US4] Apply the shared page frame and remove only page-level 1,880px caps from payments and tasks while preserving filters, sorting, editing, contained tables, and modal widths in `src/app/components/private/payments/payments.component.html` and `src/app/components/private/tasks/tasks.component.html`
- [X] T056 [US4] Apply the shared page frame and remove the page-level 1,880px cap from both lead and project-revision builder routes without changing focused copy, action overflow, or pricing table containment in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.html`
- [X] T057 [P] [US4] Apply the shared page frame and remove the page-level 1,880px cap from the workshop list while preserving card-grid and state behavior in `src/app/components/private/workshops/workshops.component.html` and `src/app/components/private/workshops/workshops.component.scss`
- [X] T058 [P] [US4] Apply the shared page frame, remove the 1,152px page cap, and let operational form grids gain useful width while retaining narrative and preview limits in `src/app/components/private/workshops/workshop-editor/workshop-editor.component.html` and `src/app/components/private/workshops/workshop-editor/workshop-editor.component.scss`
- [X] T059 [P] [US4] Apply the shared page frame, remove the 1,180px page cap, expand operational metric/two-column regions, and retain focused data-entry widths in `src/app/components/private/workshops/workshop-financials/workshop-financials.component.html` and `src/app/components/private/workshops/workshop-financials/workshop-financials.component.scss`
- [X] T060 [P] [US4] Adopt the shared frame on the already-fluid roster while preserving the spec 011 mobile count grid, toolbar, table, focus, and contained-overflow rules in `src/app/components/private/workshops/workshop-roster/workshop-roster.component.html` and `src/app/components/private/workshops/workshop-roster/workshop-roster.component.scss`
- [X] T061 [P] [US4] Adopt the shared frame on the already-fluid occurrence-detail page while preserving the focused 38rem form and current mobile breakpoints in `src/app/components/private/workshops/workshop-occurrence-detail/workshop-occurrence-detail.component.html` and `src/app/components/private/workshops/workshop-occurrence-detail/workshop-occurrence-detail.component.scss`
- [X] T062 [P] [US4] Adopt the shared frame on the already-fluid retention page while preserving permission behavior, focused controls, and current mobile breakpoints in `src/app/components/private/workshops/workshop-data-retention-policy/workshop-data-retention-policy.component.html` and `src/app/components/private/workshops/workshop-data-retention-policy/workshop-data-retention-policy.component.scss`
- [ ] T063 [US4] Run the routed layout suites and complete the route/state/theme/viewport evidence matrix, including supported authorization-denied states, retained navigation/permissions/filters/sorting/editing behavior, computed 3440 page-frame ratios, desktop overflow checks, primary-action visibility, contained overflow ownership, 390-by-844 and 768-by-1024 smoke tests, keyboard focus, 200% zoom, and light/dark results in `specs/012-proposal-pricing-layout/acceptance.md`

**Checkpoint**: User Story 4 satisfies the measurable ultrawide contract across
the complete authenticated route inventory without redesigning focused overlays
or smaller-screen interaction patterns.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate the integrated release, privacy/security boundaries, and
human deployment handoff.

- [X] T064 Re-run all focused proposal, persistence, renderer, routed-layout, and shared-shell Karma/Jasmine suites from `specs/012-proposal-pricing-layout/quickstart.md` and record results in `specs/012-proposal-pricing-layout/acceptance.md`
- [X] T065 Run the Angular coverage command documented in `specs/012-proposal-pricing-layout/quickstart.md` with pre-existing Edge Function request/response simulation specs excluded, verify meaningful coverage toward the repository's 80% target for changed logic, and record totals plus pre-existing failures in `specs/012-proposal-pricing-layout/acceptance.md`
- [X] T066 Run `npm run build:prod` and record bundle budgets, warnings, and confirmation that layout-only changes add no data request or runtime dependency in `specs/012-proposal-pricing-layout/acceptance.md`
- [ ] T067 Run the isolated Supabase reset/pgTAP workflow against `supabase/tests/proposal_revision_snapshots.sql` and `supabase/tests/integrated_project_payments.sql`, then compare RLS, row counts, immutable hashes, and payment records with the preflight evidence in `specs/012-proposal-pricing-layout/acceptance.md`
- [X] T068 Verify no calculated price, override/conversion metadata, component cost, markup, service-role secret, or retired percentage labor leaks through customer render values, documents, browser output, or frontend configuration, and record the review of `src/app/core/supabase/services/floral-proposal-renderer.service.ts`, `src/app/core/proposal-templates/proposal-template-scene-renderer.service.ts`, and `src/environments/` in `specs/012-proposal-pricing-layout/acceptance.md`
- [X] T069 Verify public website routes/content/SEO, customer authentication/passcodes/signatures, proposal document storage, payment-provider contracts, and standalone Edge Function source remain unchanged by reviewing `src/app/app.routes.ts`, `src/app/components/public/`, `src/app/components/proposal-access/`, and `supabase/edge_functions/` and recording the result in `specs/012-proposal-pricing-layout/acceptance.md`
- [X] T070 Run `git diff --check`, review the final change set against `specs/012-proposal-pricing-layout/spec.md`, and record any approved deviations or pre-existing failures in `specs/012-proposal-pricing-layout/acceptance.md`
- [X] T071 Prepare the human-operated maintenance/deployment/rollback checklist and suggested commit summary without running commit or push in `specs/012-proposal-pricing-layout/acceptance.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No implementation dependency; establishes the evidence
  baseline and approved surface.
- **Foundational (Phase 2)**: Depends on Setup and blocks every story phase.
- **User Story 1 (Phase 3)**: Depends on Foundational. This is the recommended
  MVP because the in-memory product pricing behavior can be tested independently.
- **User Story 3 (Phase 4)**: Depends on Foundational and may overlap late US1
  work where file conflicts are coordinated. It must finish before the US2
  submission checkpoint because V3 forbids active percentage labor.
- **User Story 2 (Phase 5)**: Depends on US1's effective-price state and US3's
  active-labor retirement. The database migration is applied only after the
  compatible Angular reader/writer is ready and during the approved maintenance
  window.
- **User Story 4 (Phase 6)**: Depends only on Foundational and may run alongside
  the pricing phases, except T056 must follow US1/US3 edits to the proposal-builder
  template.
- **Polish (Phase 7)**: Depends on every story selected for release.

### User Story Dependency Graph

```text
Setup -> Foundation -> US1 ---------+
                     US3 -----------+-> US2 -> Integrated release
                     US4 --------------------->+
```

- **US1** is independently testable in the mutable editor before persistence.
- **US3** is independently testable with new and legacy mutable fixtures.
- **US2** is an end-to-end persistence/submission story and intentionally composes
  the completed US1 and US3 contracts.
- **US4** is independently testable across routed CRM surfaces.

### Within Each Story

- Write the focused tests first and confirm they fail for the intended reason.
- Update models before services, services before UI/workflow boundaries, and
  client validation before enabling save/finalization.
- Keep normalized `unit_price` effective, private metadata proposal-scoped, and
  immutable submitted state untouched.
- Do not create Edge Function tests; use the unchanged boundary plus documented
  manual submission smoke evidence.

## Parallel Execution Examples

### User Story 1

```text
Parallel: T011 calculator transitions + T013 component accessibility/UI tests
Then:     T014 calculator implementation -> T015 input handling -> T016/T017 UI
Parallel after T014: T012 shopping isolation/performance verification
```

### User Story 3

```text
Parallel: T019 adapter/totals tests + T020 component tests + T021 render tests
Then:     T022 shared adapter -> T023/T024 builder cleanup -> T025 projections
```

### User Story 2

```text
Parallel: T027 repository tests + T028 workflow tests + T029 revision tests
          + T030 render tests + T031 PostgreSQL tests
Then:     T032/T033/T034/T036 implementations
Then:     T035 builder integration + T037 migration/declarative SQL + T038 payments
Finally:  T039 automated evidence -> T040 manual end-to-end smoke
```

### User Story 4

```text
Parallel: T041 shared tests + T042-T050 routed component-family tests
Parallel after tests: T051-T055 entity/operations pages + T057-T062 workshop pages
Then: T056 proposal builder frame after pricing template work -> T063 full audit
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases.
2. Complete User Story 1 and demonstrate intentional product pricing, clear-to-
   follow behavior, manual-line regression safety, composition isolation, and the
   performance target without enabling V3 database finalization.
3. Pause for validation if a smaller review increment is desired.

### Complete P1 Pricing Release

1. Complete User Story 3 so active percentage labor is absent and legacy mutable
   totals convert safely.
2. Complete User Story 2 so every mutable/save/render/submission/database boundary
   agrees on V3 and effective pricing.
3. Use the coordinated maintenance window; do not expose V3 workspaces to an old
   frontend or V2 finalizer.

### P2 Ultrawide Increment

1. Implement the global page-frame utility and route-level marker once.
2. Remove only page-level caps, preserving focused inner constraints.
3. Complete the route evidence matrix before acceptance; unit tests alone do not
   prove computed browser geometry.

## Notes

- `[P]` tasks are parallel only when their listed files are not being edited by
  another active task.
- Existing user changes and unrelated dirty-worktree files must be preserved.
- No table, RLS policy, storage policy, Edge Function, route behavior, runtime
  dependency, or public-site redesign is authorized.
- Every database change must exist in both the executable migration and matching
  declarative schema files.
- AI agents must not run `git commit`, `git push`, or commit/push-capable
  automation. The human operator owns publication and deployment.
