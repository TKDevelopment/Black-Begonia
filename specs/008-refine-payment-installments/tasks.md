# Tasks: Refine Payment Installments

**Input**: Design documents from `/specs/008-refine-payment-installments/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/payment-installments.md`, and `quickstart.md`

**Tests**: Use test-first PostgreSQL integration and Angular Karma/Jasmine tasks.
No Supabase Edge Function is changed, and no automated Edge Function test or
harness may be created.

**Organization**: Tasks are grouped by user story so each story can be
implemented and validated as an independently useful increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches a different file and has no
  dependency on an incomplete task
- **[Story]**: Maps a task to US1, US2, US3, or US4 from `spec.md`
- Every task includes an exact file path

## Phase 1: Setup (Shared Safety And Baseline)

**Purpose**: Capture the production defect baseline and protect the approved
brownfield scope before changing financial behavior.

- [ ] T001 Run and export the preflight diagnostics for duplicate installments, aggregate parity, unsupported paid rows, unlinked adjustments, and uncovered intentions using `specs/008-refine-payment-installments/quickstart.md`
- [X] T002 [P] Record the existing manual-payment RPC shape, financial-summary projection, canonical installment counts, and project-status behavior as brownfield fixtures in `supabase/tests/integrated_project_payments.sql`
- [X] T003 [P] Confirm the implementation inventory excludes public routes, proposal/PDF behavior, Cron, secrets, and Supabase Edge Functions in `specs/008-refine-payment-installments/quickstart.md`

---

## Phase 2: Foundational (Blocking Data Integrity)

**Purpose**: Establish the ledger-aligned installment invariant and immutable
adjustment relationship needed by every story.

**CRITICAL**: No user-story implementation begins until this phase passes.

- [ ] T004 Add failing PostgreSQL coverage for the repaired Paid/Overpaid constraint, conservative compatibility projections, exact-evidence legacy repair, ambiguous-history preservation, relationship validation, relationship immutability, and RLS in `supabase/tests/integrated_project_payments.sql`
- [X] T005 [P] Define the append-only adjustment-to-receipt relationship table, same-project/type validation, restrictive foreign keys, unique adjustment parent, immutability trigger, RLS, grants, and indexes in `supabase/schemas/public/tables/payment_transaction_relationships.sql`
- [X] T006 [P] Replace the legacy single-method/single-date paid check with target, credited, outstanding, and fulfilled timestamp validation in `supabase/schemas/public/tables/project_payment_records.sql`
- [X] T007 [P] Add the bounded project-history index in `supabase/schemas/public/tables/payment_transactions.sql` and the allocation-by-installment lookup index in `supabase/schemas/public/tables/payment_transaction_allocations.sql`; keep relationship indexes with their relationship-table definition
- [X] T008 Create the ordered schema, constraint replacement, evidence-backed relationship repair, ambiguous-case exception handling, recomputation, grants, and schema-cache reload foundation in `supabase/migrations/20260721000000_refine_payment_installments.sql`

**Checkpoint**: Existing projects retain their canonical rows and immutable
ledger history, valid fulfilled installments satisfy the repaired invariant,
and adjustment links can be added without mutating transactions.

---

## Phase 3: User Story 1 - Record A Manual Installment Receipt (Priority: P1)

**Goal**: Record one immutable manual receipt against the selected canonical
installment, support partial/full payments and confirmed spillover, and advance
eligible project status atomically.

**Independent Test**: Record the full unpaid deposit as cash dated 2026-07-19;
the existing deposit becomes Paid with zero outstanding, no installment is
created, the final installment is unchanged, and the project becomes Booked.

### Tests for User Story 1

- [ ] T009 [US1] Add failing PostgreSQL cases for full and partial manual receipts, selected-installment-first allocation, no-write spillover warning, confirmed spillover, concurrent submissions, invalid dates/amounts, ineligible installments, and cross-project IDs; verify Awaiting Final Payment advances to Final Prep when final principal is fulfilled, simultaneous deposit/final fulfillment advances Awaiting Deposit directly to Final Prep, future final reminders stop, and protected/terminal statuses remain unchanged; replay the same command key five times and assert exactly one receipt, allocation set, credited result, payment activity, customer receipt delivery, intention-fulfillment effect, and project-status transition; force failure at receipt, allocation, recompute, intention, activity, customer receipt-delivery enqueue, and status-transition stages and assert complete rollback in `supabase/tests/integrated_project_payments.sql`
- [X] T010 [P] [US1] Add failing service tests for `confirmSpillover`, stable command-key replay, warning/result mapping, affected installment IDs, and safe RPC failures in `src/app/core/supabase/services/project-workflow.service.spec.ts`
- [X] T011 [P] [US1] Add failing form tests for the Record Payment title/copy, eligible installment selection, supported received methods, spillover confirmation, retained values, and disabled zero-target submission in `src/app/components/private/projects/components/project-payment-log-modal/project-payment-log-modal.component.spec.ts`
- [X] T012 [P] [US1] Add failing project workflow tests for opening Record Payment, refreshing financial/activity/status data after success, and distinguishing failed saves in `src/app/components/private/projects/project-details/project-details.component.spec.ts`

### Implementation for User Story 1

- [X] T013 [P] [US1] Recompute canonical installment credit, outstanding, fulfillment, conservative legacy method/date projections, Awaiting Final Payment-to-Final Prep and direct Awaiting Deposit-to-Final Prep gates, reminder suppression, and protected-status preservation from immutable allocations in `supabase/schemas/public/functions/recompute_project_payment_obligations.sql`
- [X] T014 [US1] Implement authorized selected-installment locking, idempotent replay, deterministic proposal calculation, no-write spillover warning, explicit spillover confirmation, atomic receipt/allocation effects, applicable active-intention fulfillment, eligible forward status gates, and safe results in `supabase/schemas/public/functions/record_manual_payment.sql`
- [X] T015 [US1] Mirror the US1 recomputation and manual-command function replacements, defaulted final parameter, least-privilege grants, and schema-cache reload in `supabase/migrations/20260721000000_refine_payment_installments.sql`
- [X] T016 [P] [US1] Extend manual-payment request/result types for spillover proposals, confirmations, exact allocations, replay state, and affected installment IDs in `src/app/core/models/payment-transaction.ts`
- [X] T017 [US1] Pass the selected installment and confirmation flags, preserve a stable command key across warning resubmissions, and map safe RPC results in `src/app/core/supabase/services/project-workflow.service.ts`
- [X] T018 [US1] Implement Record Payment form state, received-payment guidance, validation, spillover proposal confirmation, zero-target guard, and value retention after warnings/errors in `src/app/components/private/projects/components/project-payment-log-modal/project-payment-log-modal.component.ts`
- [X] T019 [US1] Render the Record Payment copy, selected installment, editable receipt fields, warning confirmations, safe errors, and theme-consistent controls in `src/app/components/private/projects/components/project-payment-log-modal/project-payment-log-modal.component.html`
- [X] T020 [US1] Style the Record Payment modal warning, validation, and responsive states without changing public UI in `src/app/components/private/projects/components/project-payment-log-modal/project-payment-log-modal.component.scss`
- [X] T021 [US1] Wire Record Payment success/failure handling, financial/activity/status refresh, and affected-installment handoff into `src/app/components/private/projects/project-details/project-details.component.ts`

**Checkpoint**: US1 records valid receipts exactly once and preserves all
financial/project state on warnings or failures.

---

## Phase 4: User Story 2 - Distinguish Planned And Received Methods (Priority: P1)

**Goal**: Show cash/check intentions as planned on every covered outstanding
installment without treating them as funds, then prefer actual receipt evidence.

**Independent Test**: Select Cash on a consolidated request, verify every
covered outstanding installment shows `Cash (planned)` with unchanged credit,
then record a receipt and verify the actual method replaces the planned label.

### Tests for User Story 2

- [ ] T022 [US2] Add failing PostgreSQL cases for request-to-installment intention coverage, consolidated requests, zero-credit planned methods, expiration/supersession, actual-method precedence, intention fulfillment, activity preservation, exact seven-calendar-day cash/check/Venmo-fallback pause boundaries, repeated-selection non-extension, and next-eligible reminder resumption without backfill in `supabase/tests/integrated_project_payments.sql`
- [X] T023 [P] [US2] Add failing repository tests for none/planned/received/multiple method-state mapping and redaction of payment secrets/provider payloads in `src/app/core/supabase/repositories/project-payment-record-repository.service.spec.ts`
- [X] T024 [P] [US2] Add failing Record Payment tests for planned cash/check preselection, editable actual method, and no stale default after intention expiry in `src/app/components/private/projects/components/project-payment-log-modal/project-payment-log-modal.component.spec.ts`
- [X] T025 [P] [US2] Add failing project-details tests for planned qualifiers on every covered installment and unchanged credited/status values in `src/app/components/private/projects/project-details/project-details.component.spec.ts`

### Implementation for User Story 2

- [X] T026 [P] [US2] Resolve intention scope through `payment_request_obligations`, preserve one active intention lifecycle, reuse the existing exact seven-calendar-day pause without stacking or extension, and avoid financial mutations in `supabase/schemas/public/functions/record_payment_intention.sql`
- [X] T027 [P] [US2] Make payment-delivery/reminder claiming honor request-level installment coverage, exact seven-calendar-day active-intention pauses, receipt fulfillment, and next-eligible-occurrence resumption without backfill while preserving existing schedules in `supabase/schemas/public/functions/claim_payment_deliveries.sql`
- [X] T028 [US2] Project active planned methods and persisted intention history to every covered outstanding installment without fulfilling intentions or mutating financial, reminder, activity, or project state in `supabase/schemas/public/functions/get_project_financial_summary.sql`
- [X] T029 [US2] Mirror the intention, reminder, projection, grants, and schema-cache changes in `supabase/migrations/20260721000000_refine_payment_installments.sql`
- [X] T030 [P] [US2] Add planned-method and method-summary DTOs while preserving existing installment fields in `src/app/core/models/project-payment-record.ts`
- [X] T031 [US2] Map the enriched internal-only planned/received method projection from the single summary RPC in `src/app/core/supabase/repositories/project-payment-record-repository.service.ts`
- [X] T032 [US2] Preselect an active planned cash/check method while keeping the actual received method editable in `src/app/components/private/projects/components/project-payment-log-modal/project-payment-log-modal.component.ts`
- [X] T033 [US2] Render `Cash (planned)`, `Check (planned)`, actual method, `Multiple`, and not-selected states without implying receipt in `src/app/components/private/projects/project-details/project-details.component.html`

**Checkpoint**: US2 makes intention and receipt evidence visibly distinct while
preserving all reminder and financial behavior.

---

## Phase 5: User Story 3 - Understand Payments As Invoice Installments (Priority: P2)

**Goal**: Present Deposit and Final Payment as expandable installment parents
whose child rows expose receipt allocations and nested adjustments.

**Independent Test**: Load a project with a $600 installment funded by $300
Venmo and $300 cash; the parent remains the single installment, reads Multiple,
and expands to two correctly valued receipt rows.

### Tests for User Story 3

- [ ] T034 [US3] Add failing PostgreSQL read-contract cases for exactly two canonical parents, invoice cent parity, partial/full/zero targets, mixed methods, shared spillover references, allocated child amounts, ordered nested adjustments, bounded 250-event history, and one-call output in `supabase/tests/integrated_project_payments.sql`
- [X] T035 [P] [US3] Add failing repository tests for nested receipt/allocation/adjustment DTO mapping, compatibility keys, ordering, and unavailable/inconsistent projections in `src/app/core/supabase/repositories/project-payment-record-repository.service.spec.ts`
- [X] T036 [P] [US3] Add failing project-details tests for Payments / Installments terminology, preserved parent columns, initial collapsed state, keyboard disclosure ARIA, child receipt rows, nested adjustments, shared references, Multiple summary, Not Required rows, and automatic affected-row expansion in `src/app/components/private/projects/project-details/project-details.component.spec.ts`

### Implementation for User Story 3

- [X] T037 [US3] Complete the single-call installment-centric financial summary with ordered receipt allocations, exact per-installment amounts, shared receipt references, method aggregation, nested linked adjustments, zero-target display state, compatibility keys, and safe bounded history in `supabase/schemas/public/functions/get_project_financial_summary.sql`
- [X] T038 [US3] Mirror the completed read projection, supporting indexes, grants, and schema-cache reload in `supabase/migrations/20260721000000_refine_payment_installments.sql`
- [X] T039 [P] [US3] Add typed installment receipt and nested adjustment projections with safe internal fields in `src/app/core/models/payment-transaction.ts`
- [X] T040 [US3] Complete the one-RPC nested financial-summary mapping without per-row history calls in `src/app/core/supabase/repositories/project-payment-record-repository.service.ts`
- [X] T041 [US3] Implement collapsed-row state, accessible toggle IDs, affected-row auto-expansion after refresh, Not Required eligibility, and receipt/adjustment view helpers in `src/app/components/private/projects/project-details/project-details.component.ts`
- [X] T042 [US3] Replace payment-log presentation with the Payments / Installments table, canonical summary rows, disclosure buttons, receipt allocation children, and nested adjustment rows in `src/app/components/private/projects/project-details/project-details.component.html`
- [X] T043 [US3] Style the expandable hierarchy, focus states, light/dark themes, horizontal scrolling, and supported mobile widths in `src/app/components/private/projects/project-details/project-details.component.scss`

**Checkpoint**: US3 presents a reconciled, accessible two-installment view with
all receipt evidence available without additional network calls.

---

## Phase 6: User Story 4 - Recover From Warnings And Failures (Priority: P2)

**Goal**: Make duplicate, overpayment, persistence, and adjustment exceptions
recoverable without ambiguous writes or automatic project-status regression.

**Independent Test**: Exercise duplicate, overpayment, and forced-save failure
paths, then reconcile an exact refund; no warning/failure partially writes,
modal values persist, the balance reopens, status stays forward, and one alert
appears with the adjustment nested under its original receipt.

### Tests for User Story 4

- [ ] T044 [US4] Add failing PostgreSQL cases for duplicate/overpayment warning precedence, confirmation requirements, forced rollback at every side-effect stage, exact adjustment linkage, ambiguous-match exceptions, relationship uniqueness, reopened balances, one active alert, and no project-status regression in `supabase/tests/integrated_project_payments.sql`
- [X] T045 [P] [US4] Add failing workflow-service tests for duplicate/overpayment/spillover warning combinations and sanitized persistence errors in `src/app/core/supabase/services/project-workflow.service.spec.ts`
- [X] T046 [P] [US4] Add failing modal tests for confirmation reasons, combined warnings, retained fields after rejection, and close-only-on-recorded behavior in `src/app/components/private/projects/components/project-payment-log-modal/project-payment-log-modal.component.spec.ts`
- [X] T047 [P] [US4] Add failing project-details tests for one prominent reopened-balance alert, unchanged operational status, refreshed summary/activity agreement, and nested adjustment status in `src/app/components/private/projects/project-details/project-details.component.spec.ts`

### Implementation for User Story 4

- [X] T048 [P] [US4] Fulfill applicable intentions for trusted provider receipts; remove latest-receipt guessing for adjustments, resolve adjustment parents only from exact evidence, insert immutable relationships, and create/reuse review exceptions for ambiguity in `supabase/schemas/public/functions/reconcile_payment_event.sql`
- [X] T049 [P] [US4] Preserve existing duplicate/overpayment safeguards, require all applicable confirmations, sanitize errors, and guarantee transaction-wide rollback in `supabase/schemas/public/functions/record_manual_payment.sql`
- [X] T050 [US4] Aggregate open reopened-balance/reconciliation exceptions into one safe needs-attention projection while retaining detailed adjustment history in `supabase/schemas/public/functions/get_project_financial_summary.sql`
- [X] T051 [US4] Mirror the reconciliation, warning, rollback, alert, grants, and schema-cache changes in `supabase/migrations/20260721000000_refine_payment_installments.sql`
- [X] T052 [US4] Preserve form values and command identity through warnings/errors, collect required confirmation reasons, and close only on a recorded result in `src/app/components/private/projects/components/project-payment-log-modal/project-payment-log-modal.component.ts`
- [X] T053 [US4] Display sanitized actionable warning/error content and explicit confirmation controls in `src/app/components/private/projects/components/project-payment-log-modal/project-payment-log-modal.component.html`
- [X] T054 [US4] Surface one prominent needs-attention alert without changing the project's operational status presentation in `src/app/components/private/projects/project-details/project-details.component.html`

**Checkpoint**: US4 leaves financial state certain after every warning, failure,
or adjustment and gives the florist a clear recovery path.

---

## Phase 7: Polish & Cross-Cutting Validation

**Purpose**: Prove migration parity, performance, accessibility, security, and
brownfield preservation across all completed stories.

- [X] T055 Verify declarative schema/function definitions exactly match the executable deployment order and final grants in `supabase/migrations/20260721000000_refine_payment_installments.sql`
- [ ] T056 Run the complete PostgreSQL suite and record zero parity mismatches, exactly two canonical installments, authorization/RLS results, rollback results, and migration repair classifications in `specs/008-refine-payment-installments/quickstart.md`
- [X] T057 Run the four focused Karma/Jasmine suites plus coverage and record results for the affected models, repository, workflow, modal, and project details in `specs/008-refine-payment-installments/quickstart.md`
- [ ] T058 Verify the enriched summary with 250 receipt/adjustment events uses one RPC, meets the p95/read-render goals, and has no unbounded or per-row queries using `specs/008-refine-payment-installments/quickstart.md`
- [ ] T059 Complete keyboard, screen-reader disclosure, focus, light/dark contrast, responsive table, and automatic-expansion acceptance checks in `specs/008-refine-payment-installments/quickstart.md`
- [ ] T060 Verify anonymous denial, internal authorization, redacted DTOs, immutable ledger/relationships, no frontend privileged secrets, unchanged public/provider behavior, and absence of Edge Function changes/tests using `specs/008-refine-payment-installments/quickstart.md`
- [ ] T061 Run the production Angular build and the full CRM acceptance matrix, then document rollout/rollback observations in `specs/008-refine-payment-installments/quickstart.md`
- [X] T062 Prepare a human-operated source-control handoff summarizing changed files, migration order, validation evidence, and suggested commit message in `specs/008-refine-payment-installments/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundational (Phase 2)**: Depends on Setup and blocks every user story.
- **US1 (Phase 3)**: Depends on Foundation; this is the recommended MVP.
- **US2 (Phase 4)**: Depends on Foundation and uses the receipt evidence/command
  established by US1 when fulfilling an intention.
- **US3 (Phase 5)**: Depends on Foundation; integrates the US1 receipt result and
  US2 planned-method projection into the complete expandable read model.
- **US4 (Phase 6)**: Depends on US1 for command warnings and on US3 for nested
  adjustment/alert presentation.
- **Polish (Phase 7)**: Depends on every story included in the release.

### User Story Dependency Graph

```text
Setup -> Foundation -> US1 (MVP)
                    -> US2
US1 + US2 ----------> US3
US1 + US3 ----------> US4
US1 + US2 + US3 + US4 -> Polish
```

### Within Each User Story

1. Add the story's failing PostgreSQL and Angular tests.
2. Implement declarative database definitions and functions.
3. Mirror every database change into the single ordered migration.
4. Extend models before repository/service consumers.
5. Complete service/repository behavior before component integration.
6. Pass the independent story test before advancing.

## Parallel Execution Examples

### User Story 1

After T009 establishes the database contract, T010, T011, T012, T013, and T016
can proceed in parallel because they touch separate service, modal, component,
function, and model files. T014 then feeds T015, while T017-T021 integrate the
Angular layers in dependency order.

### User Story 2

T023-T025 can be authored in parallel. After those tests fail, T026, T027, and
T030 can proceed in parallel; T028-T033 then integrate projection, migration,
repository, modal, and display behavior.

### User Story 3

T035 and T036 can proceed in parallel after T034. T039 can run alongside T037;
T038 and T040-T043 then integrate the finalized database contract into the UI.

### User Story 4

T045-T047 can proceed in parallel after T044. T048 and T049 can proceed in
parallel because they change separate SQL functions; T050-T054 then consolidate
the migration, alert projection, and recovery UI.

## Implementation Strategy

### MVP First

1. Complete Setup and Foundation.
2. Complete US1 and its independent full-cash-deposit test.
3. Validate that the original `project_payment_records_paid_check` failure is
   fixed without adding installment rows or weakening ledger integrity.
4. Deploy only after the migration and Angular US1 paths pass together.

### Incremental Delivery

1. **US1** restores trustworthy manual receipt recording.
2. **US2** prevents planned cash/check choices from being mistaken for funds.
3. **US3** adds the complete expandable Payments / Installments experience.
4. **US4** adds adjustment traceability and robust recovery UX.
5. **Polish** verifies the combined production rollout and human handoff.

## Notes

- `[P]` tasks use different files or have no dependency conflict.
- Do not create a third installment when recording a receipt.
- Do not mutate existing transactions or allocations; corrections are additive.
- Do not infer missing methods, dates, or adjustment relationships.
- Every declarative Supabase change must be present in the executable migration.
- Do not modify or test Supabase Edge Functions for this feature.
- Do not run `git commit`, `git push`, or commit/push-capable automation.
