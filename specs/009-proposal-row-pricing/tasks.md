# Tasks: Proposal Catalog Row Pricing

**Input**: Design documents from `/specs/009-proposal-row-pricing/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/proposal-catalog-row-pricing.md`, and `quickstart.md`

**Tests**: Use test-first Karma/Jasmine coverage for every changed Angular component, service, model adapter, repository, and workflow boundary. Add focused PostgreSQL integration checks for the precision migration and durable proposal contract. No Supabase Edge Function is changed, and no automated Edge Function test or harness may be created.

**Organization**: Tasks are grouped by user story so editable row pricing, shopping aggregation, catalog reset, and historical preservation can be implemented and validated as reviewable increments.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches a different file and has no dependency on an incomplete task
- **[Story]**: Maps to US1, US2, US3, or US4 in `spec.md`
- Every task includes an exact file path

## Phase 1: Setup (Scope And Baseline)

**Purpose**: Capture the current pricing/persistence baseline and protect the approved brownfield boundary.

- [ ] T001 Run and record the component-count, cost-range, numeric-scale, and negative-value preflight from `specs/009-proposal-row-pricing/quickstart.md`
- [X] T002 [P] Capture the existing `$30 / 10 = $3` catalog-selection behavior, two-decimal normalized persistence, current shopping pack rounding, and legacy `purchase_unit_cost` hydration as baseline fixtures in `src/app/core/supabase/services/floral-proposal-builder.service.spec.ts`
- [X] T003 [P] Confirm the implementation inventory excludes public/client routes, catalog CRUD semantics, proposal PDFs, payments, secrets, storage policies, Cron, Netlify configuration, and all Supabase Edge Functions in `specs/009-proposal-row-pricing/quickstart.md`

---

## Phase 2: Foundational (Blocking Precision And Shared Contracts)

**Purpose**: Establish lossless four-decimal row-cost persistence and the shared DTO contract required by every story.

**CRITICAL**: No user-story implementation begins until this phase passes.

- [X] T004 Add failing PostgreSQL assertions for `numeric(14,4)` component cost precision, preservation of the existing ten-digit integer range, existing numeric values and row count, unchanged component RLS/grants/triggers, and unchanged cent-valued proposal/shopping columns in `supabase/tests/proposal_revision_snapshots.sql`
- [X] T005 [P] Widen the declarative `base_unit_cost` definition from `numeric(12,2)` to `numeric(14,4)` without changing relationships, RLS, triggers, or other money columns in `supabase/schemas/public/tables/floral_proposal_components.sql`
- [X] T006 Create the ordered, lossless precision migration with preflight guards/comments and explicit cast in `supabase/migrations/20260721010000_proposal_catalog_row_pricing.sql`
- [X] T007 [P] Extend proposal component and shopping DTO documentation/types with proposal-row four-decimal cost and derived effective-pack-cost semantics in `src/app/core/models/floral-proposal.ts`
- [X] T008 [P] Extend editable revision component snapshot types with additive effective-pack-cost metadata while keeping schema version 2 in `src/app/core/models/project-proposal-revision-workspace.ts`

**Checkpoint**: Existing component values remain unchanged, four-decimal row costs are persistable, and the shared model distinguishes row cost from derived pack cost.

---

## Phase 3: User Story 1 - Set A Catalog Row Unit Price (Priority: P1) 🎯 MVP

**Goal**: Let the florist edit a proposal-owned per-unit catalog-row cost and immediately recalculate marked-up row, product-line, proposal, and persisted values without changing the shared catalog.

**Independent Test**: Select Red Freedom Rose, enter quantity, four-decimal Row Unit Price, and markup, and verify every dependent proposal value recalculates, saves, and reopens with the catalog record unchanged.

### Tests for User Story 1

- [X] T009 [P] [US1] Add failing calculation tests for four-decimal row-cost normalization, explicit zero, cent-rounded sell/subtotal/line/tax totals, and invalid nonfinite/negative values in `src/app/core/supabase/services/floral-proposal-builder.service.spec.ts`
- [X] T010 [P] [US1] Add failing builder tests for editable Unit Price input, four-decimal step/labels, immediate recalculation, blank-versus-zero validation, retained values after validation, and no catalog mutation call in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts`
- [X] T011 [P] [US1] Add failing repository tests proving four-decimal `base_unit_cost` and effective pack metadata map through normalized component replacement without rounding or catalog updates in `src/app/core/supabase/repositories/floral-proposal-repository.service.spec.ts`
- [X] T012 [P] [US1] Add failing workflow tests proving lead proposal payloads retain four-decimal component cost while all financial totals remain cents in `src/app/core/supabase/services/floral-proposal-workflow.service.spec.ts`

### Implementation for User Story 1

- [X] T013 [US1] Add separate four-decimal row-cost normalization and cent-rounding boundaries, derive effective pack cost, and recalculate component/line/proposal values in `src/app/core/supabase/services/floral-proposal-builder.service.ts`
- [X] T014 [US1] Implement proposal component unit-price edit state, valid-input handling, recalculation, shopping refresh, and row-specific validation without catalog writes in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.ts`
- [X] T015 [US1] Replace the read-only composition Unit Price cell with an accessible four-decimal numeric input and actionable inline validation in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.html`
- [X] T016 [US1] Map four-decimal component cost plus derived effective-pack-cost snapshot metadata through normalized proposal persistence in `src/app/core/supabase/repositories/floral-proposal-repository.service.ts`
- [X] T017 [US1] Preserve four-decimal component cost/effective pack metadata in lead proposal render and save payloads while retaining cent-valued totals in `src/app/core/supabase/services/floral-proposal-workflow.service.ts`

**Checkpoint**: US1 independently delivers editable, proposal-owned catalog-row pricing with correct persistence and no catalog mutation.

---

## Phase 4: User Story 3 - Calculate Shopping Purchases By Pack (Priority: P1)

**Goal**: Aggregate compatible catalog contributions once, round whole-pack requirements after aggregation, and value purchasing with the highest contributing row cost.

**Independent Test**: Use the same 10-unit pack item in `$3` and `$4` rows, confirm one compatible shopping entry, one aggregate pack rounding, `$40` pack cost, and conservative total; confirm incompatible pack snapshots remain separate.

### Tests for User Story 3

- [X] T018 [P] [US3] Add failing service tests for compatible grouping, aggregate reserve/pack rounding, highest-price selection, non-pack totals, explicit zero, and incompatible unit/pack separation in `src/app/core/supabase/services/floral-proposal-builder.service.spec.ts`
- [X] T019 [P] [US3] Add failing builder tests for immediate shopping-preview refresh, one compatible mixed-price item, separate incompatible-pack entries, and cent-formatted pack/total costs in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts`
- [X] T020 [P] [US3] Add failing repository tests for persisted aggregated units, one rounded pack count, highest effective pack cost, total cost, and compatibility notes in `src/app/core/supabase/repositories/floral-proposal-repository.service.spec.ts`

### Implementation for User Story 3

- [X] T021 [US3] Refactor shopping-list generation into contribution collection and compatible-group finalization with highest-row-cost pricing and one post-aggregation pack rounding in `src/app/core/supabase/services/floral-proposal-builder.service.ts`
- [X] T022 [US3] Preserve existing shopping preview columns while rendering compatible aggregate and incompatible-pack guidance from the revised projection in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.html`
- [X] T023 [US3] Persist the revised shopping-list projection without changing cent-valued table contracts or repository error semantics in `src/app/core/supabase/repositories/floral-proposal-repository.service.ts`

**Checkpoint**: US3 independently produces conservative, nonduplicated pack purchasing estimates from proposal-owned row costs.

---

## Phase 5: User Story 2 - Override The Catalog-Derived Starting Price (Priority: P2)

**Goal**: Derive a four-decimal starting row price from current catalog pack cost and expose an explicit reset that refreshes both row price and pack snapshot without accidental repricing.

**Independent Test**: Select a `$30 / 10` item, override `$3` to `$4`, change catalog to `$36 / 12`, verify reopen preserves `$4 / 10`, then reset and verify `$3 / 12` plus `$36` effective pack cost.

### Tests for User Story 2

- [X] T024 [P] [US2] Add failing service tests for four-decimal catalog derivation, non-pack derivation, invalid pack protection, explicit reset of cost/pack snapshot, and current-catalog unavailability in `src/app/core/supabase/services/floral-proposal-builder.service.spec.ts`
- [X] T025 [P] [US2] Add failing builder tests for same-item override preservation, different-item replacement, Reset to Catalog Price behavior, retired/unavailable disabled guidance, keyboard operation, and light/dark theme states in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts`

### Implementation for User Story 2

- [X] T026 [US2] Update catalog application and reset helpers to derive four-decimal row cost, snapshot current pack quantity, and recalculate effective pack cost without changing `catalog_items` in `src/app/core/supabase/services/floral-proposal-builder.service.ts`
- [X] T027 [US2] Implement same-item preservation, different-item replacement, current-item lookup, explicit reset orchestration, and unavailable reset state in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.ts`
- [X] T028 [US2] Add the accessible Reset to Catalog Price control and non-color-only unavailable guidance beside the editable Unit Price input in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.html`
- [X] T029 [US2] Style unit-price validation/reset controls for CRM light/dark themes, table scrolling, focus visibility, and supported mobile widths in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.scss`

**Checkpoint**: US2 independently provides intentional catalog-derived initialization and reset without silent draft or catalog changes.

---

## Phase 6: User Story 4 - Preserve Submitted Proposal History (Priority: P2)

**Goal**: Preserve recorded costs and pack facts across legacy hydration, revision autosave/resume, and immutable submission without live catalog repricing.

**Independent Test**: Open a legacy two-decimal submitted version, change the live catalog, verify recorded values remain unchanged, save a four-decimal revision, reopen/finalize it, and verify both old and new immutable versions retain their exact facts.

### Tests for User Story 4

- [X] T030 [P] [US4] Add failing adapter tests proving editable legacy rows derive effective pack cost from recorded row cost and valid pack quantity; stale `purchase_unit_cost` cannot override that calculation; immutable submitted history retains its recorded legacy facts; missing pack metadata produces an individual-unit projection; and retired items never trigger live catalog repricing in `src/app/core/supabase/services/floral-proposal-builder.service.spec.ts`
- [X] T031 [P] [US4] Add failing revision-workspace tests for four-decimal autosave/resume, additive effective-pack metadata, schema version 2 preservation, and save failure retention in `src/app/core/supabase/services/project-proposal-revision.service.spec.ts`
- [X] T032 [P] [US4] Add failing workflow tests for immutable submitted snapshot payloads retaining row cost, pack quantity, and effective pack cost with cent totals in `src/app/core/supabase/services/floral-proposal-workflow.service.spec.ts`
- [X] T033 [P] [US4] Extend database integration coverage for unchanged submitted history, accepted schema version 2 workspaces, four-decimal component persistence, and existing authorization boundaries in `supabase/tests/proposal_revision_snapshots.sql`

### Implementation for User Story 4

- [X] T034 [US4] Adapt legacy normalized and snapshot rows by deriving editable effective pack cost from recorded row cost and valid pack quantity, retaining legacy purchase-cost metadata for historical compatibility, preserving immutable submitted facts and schema version 2, and never consulting the live catalog during hydration in `src/app/core/supabase/services/floral-proposal-builder.service.ts`
- [X] T035 [US4] Emit complete four-decimal row cost, pack quantity, effective pack cost, and legacy-safe snapshot facts from builder-to-workspace/submission adapters in `src/app/core/supabase/services/floral-proposal-builder.service.ts`
- [X] T036 [US4] Preserve additive pricing facts through revision workspace save/resume mapping without catalog lookups or schema-version changes in `src/app/core/supabase/services/project-proposal-revision.service.ts`
- [X] T037 [US4] Preserve additive component pricing facts through final workflow request mapping while leaving the standalone submission Edge Function contract unchanged in `src/app/core/supabase/services/floral-proposal-workflow.service.ts`

**Checkpoint**: US4 independently proves historical values remain immutable and new revision values survive every existing persistence boundary.

---

## Phase 7: Polish & Cross-Cutting Validation

**Purpose**: Prove migration safety, performance, accessibility, regression stability, and deployment readiness across all stories.

- [X] T038 Verify declarative/migration parity, lossless existing-value conversion, unchanged RLS/grants/triggers, and no unexpected schema changes using `supabase/migrations/20260721010000_proposal_catalog_row_pricing.sql`
- [X] T039 [P] Add a representative 100-line/20-edit performance test asserting at least 95% of row-price recalculations complete within 200 ms and no per-row network call is introduced in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts`
- [X] T040 [P] Add regression coverage for fee, discount, manual labor, markup, reserve, tax, and catalog nonmutation in `src/app/core/supabase/services/floral-proposal-builder.service.spec.ts`; initial lead save in `src/app/core/supabase/services/floral-proposal-workflow.service.spec.ts`; and revision autosave/discard in `src/app/core/supabase/services/project-proposal-revision.service.spec.ts`
- [ ] T041 Run the focused Angular suites, full coverage suite, and production build documented in `specs/009-proposal-row-pricing/quickstart.md`
- [ ] T042 Run `supabase/tests/proposal_revision_snapshots.sql` in an isolated Supabase/PostgreSQL environment and record precision, preservation, authorization, and history results in `specs/009-proposal-row-pricing/quickstart.md`
- [ ] T043 Complete and record the catalog-derived, override, reset, mixed-price, incompatible-pack, legacy revision, accessibility, theme, 30-second row-entry, and 200-millisecond recalculation acceptance scenarios in `specs/009-proposal-row-pricing/quickstart.md`
- [X] T044 Audit the final diff for public/client/payment/PDF/secret/storage/Edge Function exclusions and record the human-operated migration/deployment handoff in `specs/009-proposal-row-pricing/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies; captures the production and test baseline.
- **Phase 2 (Foundational)**: Depends on Setup and blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundational and is the MVP.
- **US3 (Phase 4)**: Depends on US1 row-cost/effective-pack calculations, but remains independently testable through the shopping projection.
- **US2 (Phase 5)**: Depends on US1 edit/recalculation primitives; it can proceed in parallel with US3 after US1 completes because its final changes are isolated to catalog/reset behavior and UI controls.
- **US4 (Phase 6)**: Depends on US1's additive pricing model; compatibility tests may begin after Foundational, while final workflow assertions should run after US2/US3 calculations stabilize.
- **Polish (Phase 7)**: Depends on all selected stories.

### User Story Dependency Graph

```text
Setup -> Foundational -> US1 (MVP)
                         |---> US3 (shopping aggregation) --|
                         |---> US2 (catalog reset) ---------|--> US4 final compatibility -> Polish
                         `---> US4 compatibility tests -----|
```

### Within Each User Story

1. Write focused failing tests before the implementation they describe.
2. Update shared model/calculation behavior before component UI wiring.
3. Complete persistence mapping before save/reopen acceptance.
4. Complete validation, accessibility, and failure-state behavior before the story checkpoint.

## Parallel Execution Examples

### Foundational

```text
Parallel after T004 defines the expected database contract:
- T005: declarative component precision
- T007: normalized proposal DTOs
- T008: revision snapshot DTOs
Then T006: executable migration aligned with T005/T004
```

### User Story 1

```text
Parallel test-first work:
- T009: calculation tests
- T010: builder UI tests
- T011: repository tests
- T012: workflow tests
Then T013 -> T014/T15 and T016/T017 by dependency.
```

### User Story 3

```text
Parallel test-first work:
- T018: aggregation service tests
- T019: builder preview tests
- T020: repository projection tests
Then T021 -> T022/T023.
```

### User Story 2

```text
Parallel test-first work:
- T024: derivation/reset service tests
- T025: reset UI/accessibility tests
Then T026 -> T027 -> T028/T029.
```

### User Story 4

```text
Parallel test-first work:
- T030: compatibility adapter tests
- T031: revision autosave tests
- T032: workflow snapshot tests
- T033: database history tests
Then T034/T035 -> T036/T037.
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases.
2. Complete US1 so the florist can directly set and persist proposal-row unit prices.
3. Validate the `$30 / 10`, four-decimal override, markup, total, save, and catalog-nonmutation scenarios.
4. Pause for florist review before expanding shopping/reset/history behavior if incremental delivery is desired.

### Incremental Delivery

1. **MVP**: US1 editable row pricing.
2. **Purchasing accuracy**: US3 aggregate shopping-list pack math.
3. **Catalog convenience**: US2 current-catalog reset behavior.
4. **Historical assurance**: US4 legacy and immutable revision coverage.
5. **Release**: Phase 7 database, full-suite, build, manual, accessibility, performance, and scope validation.

## Notes

- `[P]` tasks touch different files or can proceed without incomplete same-file work; tasks sharing a source file remain sequential.
- `catalog_items.base_unit_cost` remains the full pack price and is never modified by proposal editing.
- `floral_proposal_components.base_unit_cost` is proposal-row per-unit cost and is the only normalized column widened to four decimals.
- Existing financial and shopping money columns remain cents.
- Existing snapshot schema version remains 2; do not reprice saved data from the live catalog.
- Do not modify or test any Supabase Edge Function for this feature.
- Do not run git commit, git push, or commit/push-capable automation; publication is a human responsibility.
