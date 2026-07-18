# Tasks: Proposal Revision Snapshots

**Input**: Design documents from `/specs/006-proposal-revision-snapshots/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/proposal-revision-snapshots.md`, `quickstart.md`

**Tests**: Karma/Jasmine coverage is required for changed Angular components, repositories, services, and workflow logic. Focused Supabase integration checks are required for proposal revision transactions, RLS, immutability, idempotency, authorization, and state transitions.

**Organization**: Tasks are grouped by user story so each business journey can be implemented and validated as a coherent increment after the shared foundation is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and does not depend on another incomplete task in the same group.
- **[Story]**: Maps the task to a user story from `spec.md`.
- Every implementation task names its exact target path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the brownfield boundary, prerequisites, and validation baseline before schema or application changes.

- [X] T001 Confirm CRM-admin/Supabase-only scope, preserved initial-booking behavior, migration order, and human-owned Git publication against `specs/006-proposal-revision-snapshots/plan.md`
- [X] T002 [P] Inventory the existing project revision route, builder lock, save/finalize behavior, and current test baseline in `src/app/app.routes.ts`, `src/app/components/private/projects/project-details/project-details.component.ts`, and `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.ts`
- [X] T003 [P] Inventory current active-pointer, RLS, storage, and sequential submission behavior in `supabase/schemas/public/tables/project_proposal_invoice_snapshots.sql`, `supabase/schemas/public/tables/project_proposal_document_versions.sql`, `supabase/schemas/storage/floral_proposals.sql`, and `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T004 Record the pre-implementation Angular test/build and standalone edge-function type-check results in `specs/006-proposal-revision-snapshots/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared workspace storage, immutable-history protections, idempotency fields, security boundaries, and integration-test infrastructure required by every story.

**CRITICAL**: No user story implementation begins until this phase is complete.

- [X] T005 [P] Add typed workspace, editable snapshot schema, autosave state, pending submission metadata, and active-proposal validity unions in `src/app/core/models/project-proposal-revision-workspace.ts`
- [X] T006 [P] Extend snapshot types with schema/idempotency metadata in `src/app/core/models/project-proposal-invoice-snapshot.ts`
- [X] T007 [P] Extend document version types with submission idempotency and strict snapshot-link metadata in `src/app/core/models/project-proposal-document-version.ts`
- [X] T008 Create the declarative one-row-per-project workspace table, indexes, relationships, updated-at trigger, and RLS policies using `public.is_internal_crm_user()` in `supabase/schemas/public/tables/project_proposal_revision_workspaces.sql`
- [X] T009 [P] Add idempotency, immutable-history, and active-version declarations to `supabase/schemas/public/tables/project_proposal_invoice_snapshots.sql`
- [X] T010 [P] Add idempotency, required new-revision snapshot pairing, immutable-history, and superseded lifecycle declarations to `supabase/schemas/public/tables/project_proposal_document_versions.sql`
- [X] T011 [P] Define snapshot content-immutability/no-delete triggers that permit lifecycle-only supersession only for the migration-owner role with transaction-local `app.proposal_revision_activation=on` in `supabase/schemas/public/functions/enforce_project_proposal_snapshot_immutability.sql`
- [X] T012 [P] Define document content-immutability/no-delete triggers that permit lifecycle-only supersession only for the migration-owner role with transaction-local `app.proposal_revision_activation=on` in `supabase/schemas/public/functions/enforce_project_proposal_document_immutability.sql`
- [X] T013 Restrict ordinary authenticated update/delete access while preserving internal insert/read and server cleanup paths in `supabase/schemas/storage/floral_proposals.sql`
- [X] T014 Create executable migration preflight diagnostics, workspace schema, idempotency columns/indexes, legacy-link validation, immutable triggers, RLS/policy changes, storage policy changes, and application-order comments in `supabase/migrations/20260718000002_proposal_revision_snapshots.sql`
- [X] T015 Create isolated Supabase integration-test fixtures and assertions for workspace uniqueness and `is_internal_crm_user()` RLS, legacy preflight, submitted-history update/delete rejection including direct service-role lifecycle attempts without the owner guard, and private PDF policy behavior in `supabase/tests/proposal_revision_snapshots.sql`
- [X] T016 Verify the affected function remains standalone with no `_shared`, local shared-function, or cross-function import and document the check beside deployment validation in `specs/006-proposal-revision-snapshots/quickstart.md`

**Checkpoint**: Workspace persistence and immutable submitted-history boundaries exist and are testable before any UI consumes them.

---

## Phase 3: User Story 1 - Open An Editable Revision (Priority: P1)

**Goal**: Open a project-owned proposal revision from the exact active snapshot, resume or create its workspace, preserve recorded catalog/tax values, and make every supported builder field editable without changing submitted history.

**Independent Test**: Open a valid project, select Revise Proposal, compare every builder value with the active snapshot, edit all builder-supported categories, and confirm invalid active state disables revision while the submitted snapshot and Financial Summary remain unchanged.

### Tests for User Story 1

- [X] T017 [P] [US1] Add revision-eligibility tests proving each active workflow status with valid snapshot state enables revision, `completed`/`canceled` or missing/conflicting/broken/inactive snapshot state disables it, and missing/broken/inactive/snapshot-mismatched document state disables only Open Active PDF when status/snapshot remain eligible, in `src/app/components/private/projects/project-details/project-details.component.spec.ts`
- [X] T018 [P] [US1] Add complete v2 snapshot round-trip, legacy adaptation, invalid-core-data, inactive-tax, retired-catalog, and no-silent-repricing tests in `src/app/core/supabase/services/floral-proposal-builder.service.spec.ts`
- [X] T019 [P] [US1] Add workspace get/initialize/unique-conflict/error-propagation repository tests in `src/app/core/supabase/repositories/project-proposal-revision-workspace-repository.service.spec.ts`
- [X] T020 [P] [US1] Add project revision route, workspace hydration, accepted-project editability, compatibility warning, and catalog replacement tests in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts`
- [X] T021 [P] [US1] Add eligible-versus-terminal project status, separate active-snapshot/active-document validation, and snapshot-only workspace initialization/resume orchestration tests in `src/app/core/supabase/services/project-proposal-revision.service.spec.ts`

### Implementation for User Story 1

- [X] T022 [US1] Implement workspace get/create and typed error propagation in `src/app/core/supabase/repositories/project-proposal-revision-workspace-repository.service.ts`
- [X] T023 [US1] Implement project-status eligibility plus separate strict active-snapshot and active-document state resolution, using only an eligible project with a valid adaptable snapshot for workspace initialization/resume, in `src/app/core/supabase/services/project-proposal-revision.service.ts`
- [X] T024 [US1] Implement lossless v2 serialization, recorded-value hydration, legacy compatibility validation, inactive tax context, and non-repricing adapters in `src/app/core/supabase/services/floral-proposal-builder.service.ts`
- [X] T025 [US1] Add `/admin/projects/:projectId/proposal-revision` before the generic project details route while preserving the lead builder route in `src/app/app.routes.ts`
- [X] T026 [US1] Replace source-lead/query-parameter revision navigation with the project route, strict project-status/snapshot eligibility state, disabled action, and status-versus-data-repair guidance in `src/app/components/private/projects/project-details/project-details.component.ts`
- [X] T027 [US1] Render enabled/disabled Revise Proposal behavior and actionable invalid-state guidance in `src/app/components/private/projects/project-details/project-details.component.html`
- [X] T028 [US1] Branch builder initialization by route ownership, load/resume the project workspace from the active snapshot, and bypass accepted lead-proposal locking only for valid project revision state in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.ts`
- [X] T029 [US1] Add revision title/context, compatibility warnings, recorded inactive-tax display, explicit catalog replacement controls, and editable builder state in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.html`
- [X] T030 [US1] Separate free-text component editing from explicit catalog replacement so focus/blur cannot apply current catalog pricing in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.ts`
- [X] T031 [US1] Run the focused US1 Karma/Jasmine specs and record the independently testable hydration/editability result in `specs/006-proposal-revision-snapshots/quickstart.md`

**Checkpoint**: A valid project opens an editable snapshot-backed revision, while invalid active state never falls back to mutable or historical data.

---

## Phase 4: User Story 2 - Finalize A New Proposal Version (Priority: P1)

**Goal**: Confirm an externally approved/signed PDF and atomically activate exactly one new immutable snapshot/document pair with version traceability, idempotent replay, preserved project operational state, and one activity entry.

**Independent Test**: Finalize changed revision data with a valid approved/signed PDF and verify one linked new pair becomes active, the prior pair remains retained/superseded, project status/booked time remain unchanged, the workspace is consumed, and retry returns the same result.

### Tests for User Story 2

- [ ] T032 [P] [US2] Add transaction success with and without a valid prior document; supported workspace schema, required line/tax/event context, and calculated-total validation; post-lock eligible-status rejection; shared version/link; baseline validation; server-derived baseline `source_floral_proposal_id`; idempotent replay; actor activity; workspace consumption; and project status/booked-at preservation assertions in `supabase/tests/proposal_revision_snapshots.sql`
- [X] T033 [P] [US2] Add revision request/response, immediate pre-RPC authorization recheck, stable idempotency key, terminal-project and typed conflict handling, and initial-booking regression tests in `src/app/core/supabase/services/floral-proposal-workflow.service.spec.ts`
- [X] T034 [P] [US2] Add revision-specific approved/signed acknowledgement, validation, cancel, progress, and initial-booking copy tests in `src/app/components/private/floral-proposal-builder/components/proposal-document-submission-modal/proposal-document-submission-modal.component.spec.ts`
- [X] T035 [P] [US2] Add builder finalization flush, pending attempt reuse, revision success navigation, and revision-specific toast/progress tests in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts`

### Implementation for User Story 2

- [X] T036 [US2] Implement project locking and completed-key replay; for new attempts, post-lock rejection of `completed`/`canceled` projects plus persisted workspace supported-schema, required line/tax/event context, and calculated-total validation; exact active-snapshot/baseline validation; optional prior-document resolution; baseline-derived `source_floral_proposal_id`; version allocation; new snapshot/document insertion; guarded prior-state supersession; pointer update; actor activity insertion; workspace consumption; and result return in `supabase/schemas/public/functions/finalize_project_proposal_revision.sql`
- [X] T037 [US2] Install the fixed-search-path migration-owner `SECURITY DEFINER` finalization function, revoke execution from `PUBLIC`/`authenticated`, grant only `service_role`, and install pairing/idempotency constraints plus owner-and-transaction-guard lifecycle permissions in `supabase/migrations/20260718000002_proposal_revision_snapshots.sql`
- [X] T038 [US2] Refactor only the `project_revision` branch to revalidate `public.is_internal_crm_user()` immediately before RPC invocation, validate workspace/baseline/pending key, verify the staged PDF, invoke the finalization RPC once, replay completed submissions, preserve project operational fields, and clean unreferenced staged objects best-effort in `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T039 [US2] Extend revision finalization request/result types and RPC error mapping while preserving initial booking behavior in `src/app/core/supabase/services/floral-proposal-workflow.service.ts`
- [X] T040 [US2] Implement pending submission key/path persistence and finalized request preparation in `src/app/core/supabase/services/project-proposal-revision.service.ts`
- [X] T041 [US2] Add externally approved/signed confirmation input and mode-specific booking-versus-revision copy in `src/app/components/private/floral-proposal-builder/components/proposal-document-submission-modal/proposal-document-submission-modal.component.ts`
- [X] T042 [US2] Render the required approved/signed acknowledgement, revision validation feedback, and mode-specific progress/actions in `src/app/components/private/floral-proposal-builder/components/proposal-document-submission-modal/proposal-document-submission-modal.component.html`
- [X] T043 [US2] Flush the saved workspace, reuse its pending attempt, submit the revision contract, preserve the selected file during in-page retry, and navigate to `/admin/projects/:projectId` after success in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.ts`
- [X] T044 [US2] Load and render revision activity with submitting florist (`profiles.display_name`, then email, then `Unknown user`), version, and submission time in `src/app/core/supabase/repositories/activity-repository.service.ts`, `src/app/components/private/projects/components/project-activity-panel/project-activity-panel.component.ts`, and `src/app/components/private/projects/components/project-activity-panel/project-activity-panel.component.html`
- [ ] T045 [US2] Run the focused US2 Angular, edge-function type-check, and Supabase transaction/idempotency checks and record results in `specs/006-proposal-revision-snapshots/quickstart.md`

**Checkpoint**: Confirmed revision submission creates one atomic, traceable active pair and leaves all prior history and operational project state intact.

---

## Phase 5: User Story 3 - Preserve Active State Until Success (Priority: P1)

**Goal**: Auto-save and resume working revisions, explicitly discard drafts, and ensure validation/upload/transaction failures never expose partial current state or lose recoverable proposal edits.

**Independent Test**: Exercise refresh, sign-out/resume, discard cancel/confirm, autosave failure/retry, invalid PDFs, and injected transaction failures; verify the old pair remains active, workspace recovery is clear, and no partial version appears.

### Tests for User Story 3

- [X] T046 [P] [US3] Add debounced autosave, latest-write sequencing, save-state, retry, resume, discard cancel/confirm, and pending-key invalidation tests in `src/app/core/supabase/services/project-proposal-revision.service.spec.ts`
- [X] T047 [P] [US3] Add workspace update/delete/pending-metadata and submitted-record isolation repository tests in `src/app/core/supabase/repositories/project-proposal-revision-workspace-repository.service.spec.ts`
- [X] T048 [P] [US3] Add builder autosave UI, navigation flush, refresh resume, discard, local PDF reselection, and actionable failure tests in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts`
- [ ] T049 [P] [US3] Add injected-failure rollback assertions at snapshot, document, supersession, pointer, activity, and workspace-consumption boundaries in `supabase/tests/proposal_revision_snapshots.sql`

### Implementation for User Story 3

- [X] T050 [US3] Implement workspace update, pending-attempt reset, and project-scoped delete/discard methods with typed failures in `src/app/core/supabase/repositories/project-proposal-revision-workspace-repository.service.ts`
- [X] T051 [US3] Implement approximately 750 ms debounced autosave, ordered writes, flush-before-boundary, retry state, resume, confirmed discard, and pending-key invalidation in `src/app/core/supabase/services/project-proposal-revision.service.ts`
- [X] T052 [US3] Wire all builder mutations to autosave, expose Saving/Saved/Save failed state, flush on finalization/navigation, and implement confirmed Discard Revision in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.ts`
- [X] T053 [US3] Render autosave state, retry action, discard warning/action, resumable failure guidance, and local PDF reselection messaging in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.html`
- [X] T054 [US3] Map PDF validation, active-state conflict, completed/canceled project, lost authorization, workspace failure, staged upload cleanup/retry, and unexpected transaction errors to actionable revision messages in `src/app/core/supabase/services/floral-proposal-workflow.service.ts`
- [ ] T055 [US3] Verify each rollback case keeps the prior active snapshot/project snapshot pointer unchanged, preserves a previously valid document or leaves pre-existing invalid document state unchanged, and retains the resumable workspace, then record US3 independent-test results in `specs/006-proposal-revision-snapshots/quickstart.md`

**Checkpoint**: Draft recovery and failure handling are reliable, and only a fully successful confirmed submission can change current project proposal state.

---

## Phase 6: User Story 4 - Use The Active Snapshot For Financial Reporting (Priority: P1)

**Goal**: Make Financial Summary and the future-dashboard read contract consume only the strictly validated active snapshot, while Active PDF/document status independently consume the validated active document linked to it; neither uses workspaces or historical recency.

**Independent Test**: Seed inactive v1, active v2, and a materially different unsubmitted workspace; confirm current views remain v2 until successful v3 activation, distinguish zero from unavailable, and reject broken current pointers without fallback.

### Tests for User Story 4

- [X] T056 [P] [US4] Add Financial Summary tests for active-pointer totals, workspace isolation, zero-versus-unavailable display, payments, and post-activation refresh in `src/app/components/private/projects/components/project-financial-summary-card/project-financial-summary-card.component.spec.ts`
- [X] T057 [P] [US4] Add proposal document tests proving active/superseded display uses stored project-pointer state rather than newest-version inference in `src/app/components/private/projects/components/project-proposal-documents-section/project-proposal-documents-section.component.spec.ts`
- [X] T058 [P] [US4] Add project details tests for independent strict snapshot-backed Financial Summary/revision and document-backed Active PDF consumers, section load errors, no history fallback, and automatic post-submission refresh in `src/app/components/private/projects/project-details/project-details.component.spec.ts`
- [X] T059 [P] [US4] Add repository tests that distinguish missing/current/load-error states and select the project-pointer snapshot/document fields in `src/app/core/supabase/repositories/project-proposal-invoice-snapshot-repository.service.spec.ts` and `src/app/core/supabase/repositories/project-proposal-document-version-repository.service.spec.ts`

### Implementation for User Story 4

- [X] T060 [US4] Add strict pointer-based snapshot reads with typed missing/load errors and no latest-version fallback in `src/app/core/supabase/repositories/project-proposal-invoice-snapshot-repository.service.ts`
- [X] T061 [US4] Add strict pointer-based document reads, snapshot-pair validation data, typed missing/load errors, and retained history listing in `src/app/core/supabase/repositories/project-proposal-document-version-repository.service.ts`
- [X] T062 [US4] Replace fallback computed current records with separate validated active-snapshot state for Financial Summary/Revise Proposal and active-document state for Open Active PDF, including post-submission reload handling, in `src/app/components/private/projects/project-details/project-details.component.ts`
- [X] T063 [US4] Display current proposal total/version only for validated active state and distinguish zero from unavailable/corrupt state in `src/app/components/private/projects/components/project-financial-summary-card/project-financial-summary-card.component.ts` and `src/app/components/private/projects/components/project-financial-summary-card/project-financial-summary-card.component.html`
- [X] T064 [US4] Replace newest-revision-derived document status/active indicators with stored active/superseded state and exact snapshot linkage in `src/app/components/private/projects/components/project-proposal-documents-section/project-proposal-documents-section.component.ts`
- [X] T065 [US4] Document and verify the project-pointer active snapshot query contract for future income/expense consumers in `specs/006-proposal-revision-snapshots/contracts/proposal-revision-snapshots.md` and `supabase/tests/proposal_revision_snapshots.sql`
- [X] T066 [US4] Run the focused US4 Karma/Jasmine and financial-contract checks and record the v1/v2/workspace/v3 results in `specs/006-proposal-revision-snapshots/quickstart.md`

**Checkpoint**: Every current project financial/document consumer agrees on the exact active pair, and working/history records cannot leak into current reporting.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Complete regression, security, performance, documentation, and deployment verification across all stories.

- [X] T067 [P] Add focused activity actor fallback/version/time, sensitive-metadata minimization, and signed-URL regression coverage in `src/app/core/supabase/repositories/activity-repository.service.spec.ts` and `src/app/components/private/projects/components/project-activity-panel/project-activity-panel.component.spec.ts`
- [X] T068 [P] Verify initial lead proposal creation/finalization, lead-to-project booking, builder calculations, and manual PDF upload remain unchanged in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts` and `src/app/core/supabase/services/floral-proposal-workflow.service.spec.ts`
- [X] T069 Validate `is_internal_crm_user()` workspace RLS, RPC revokes/grant, owner-plus-transaction-local lifecycle guard including direct service-role rejection, immutable content/no-delete history, private PDF mutation restrictions, and absence of frontend privileged secrets using `supabase/tests/proposal_revision_snapshots.sql` and `src/app/core/supabase/clients/supabase.service.ts`
- [X] T070 Verify at least 95% of edit recalculations complete within 200 ms for a representative 100-line proposal in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts`; verify autosave dispatches 750 +/- 150 ms after the last edit with one payload, reaches Saved/error within 2 seconds, and workspace creation/resume exposes editable state within 2 seconds in `src/app/core/supabase/services/project-proposal-revision.service.spec.ts`
- [X] T071 Run the full non-watch Karma/Jasmine suite and production Angular build using `package.json`, recording results in `specs/006-proposal-revision-snapshots/quickstart.md`
- [ ] T072 Type-check `supabase/edge_functions/submit-floral-proposal.ts` with `supabase/deno.json` and run the isolated migration/RPC integration suite from `supabase/tests/proposal_revision_snapshots.sql`
- [ ] T073 Execute every manual scenario and regression check in `specs/006-proposal-revision-snapshots/quickstart.md`, including a timed typical revision-to-success journey within 5 minutes excluding external PDF preparation
- [X] T074 Review `git diff`, confirm no public/client surface or unrelated brownfield changes, and write a human-operated source-control handoff summary in `specs/006-proposal-revision-snapshots/quickstart.md`
- [X] T075 Apply the product-owner builder UX revisions for the single-row actions, deprecated PDF-export removal, themed revision messaging/discard action, dynamic catalog typeahead, and streamlined line-item composition UI; add focused regression coverage in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.*` and record validation in `specs/006-proposal-revision-snapshots/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundation**: Depends on Setup and blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundation; establishes the route, strict active-state contract, workspace initialization, and editable hydration.
- **US2 (Phase 4)**: Depends on US1 workspace/hydration and Foundation database fields; delivers the successful finalization path.
- **US3 (Phase 5)**: Depends on US1 workspace lifecycle and US2 transaction/error contract; adds autosave/discard and proves failure recovery.
- **US4 (Phase 6)**: Depends on US1 strict active state; final post-activation checks also depend on US2. It can begin its component/repository tests in parallel with US3 after US2 contracts stabilize.
- **Polish (Phase 7)**: Depends on all selected user stories.

### User Story Dependency Graph

```text
Setup -> Foundation -> US1 -> US2 -> US3
                         \      \
                          \      -> US4
                           --------> US4

US3 and US4 can proceed in parallel after US2 when separate files are assigned.
```

### Within Each User Story

- Write focused tests first where practical and confirm they fail for the intended gap.
- Complete models/contracts before repositories and services.
- Complete repositories/services before component orchestration and templates.
- Complete validation/security/error behavior before the story checkpoint.
- Run the story's independent test before advancing.

## Parallel Execution Examples

### User Story 1

```text
Parallel test work: T017, T018, T019, T020, T021
After T022-T024: T025 route work can proceed alongside T026-T027 project details work
After T024: T028-T030 builder work proceeds sequentially in the shared component files
```

### User Story 2

```text
Parallel test work: T032, T033, T034, T035
After T036 contract is fixed: T038 edge work, T039 workflow-service work, and T041-T042 modal work can proceed in parallel
T043 integrates the completed backend/workflow/modal paths
```

### User Story 3

```text
Parallel test work: T046, T047, T048, T049
After T050-T051: T052-T053 builder UI work can proceed while T054 refines workflow error mapping
T055 validates the combined recovery increment
```

### User Story 4

```text
Parallel test work: T056, T057, T058, T059
T060 and T061 can run in parallel in separate repositories
After repository contracts: T063 Financial Summary, T064 document status, and T044 activity presentation remain separate concerns; complete T062 before T066 integration verification
```

## Implementation Strategy

### MVP First

The minimum useful increment is **Foundation + User Story 1**:

1. Establish the secure workspace and immutable-history schema.
2. Resolve active project proposal state strictly.
3. Open the project route from the exact active snapshot.
4. Make recorded proposal data editable without catalog repricing or submitted-history mutation.

This MVP fixes the observed builder lock and proves the safe working-copy boundary, but it must not be deployed as a complete revision workflow until US2 atomic finalization is also ready.

### Incremental Delivery

1. **US1**: Editable, snapshot-backed working revision.
2. **US2**: Atomic approved/signed PDF finalization and version activation.
3. **US3**: Autosave/resume/discard and failure recovery hardening.
4. **US4**: Strict Financial Summary/document/future-dashboard consumers.
5. **Polish**: Full regression, performance, security, deployment, and manual validation.

## Notes

- `[P]` tasks touch distinct files or independent test surfaces; do not parallelize tasks that append to the same migration, component, or test file.
- Submitted snapshots/documents and referenced PDFs are immutable; only the controlled finalization lifecycle may supersede them.
- The staged PDF upload remains outside the database transaction, so retry/cleanup behavior must be verified explicitly.
- Do not use mutable lead proposal rows, inactive snapshots, maximum version, or newest document as fallback current project state.
- Do not reset project status, `booked_at`, payments, or event state during proposal revision.
- Do not introduce `_shared` edge-function code, frontend privileged secrets, public/client changes, e-signature, PDF generation, dashboard UI, or multi-user edit locking.
- Every table/function/policy/trigger/storage change must be present in `supabase/migrations/20260718000002_proposal_revision_snapshots.sql` and matching declarative schema files.
- AI agents must not run `git commit`, `git push`, or commit/push-capable automation; source-control publication remains human-operated.
