# Tasks: Proposal Workflow Reset

**Input**: Design documents from `/specs/002-proposal-workflow-reset/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/proposal-document-submission-contract.md](./contracts/proposal-document-submission-contract.md), [quickstart.md](./quickstart.md)

**Tests**: Tests are required by the feature. Use Karma/Jasmine and colocated `.spec.ts` files for all changed Angular components, services, repositories, guards, and workflow logic, plus focused integration-style checks for finalize, submit, decline, edit, and resubmit flows.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the exact proposal workflow surface, retirement scope, and protected brownfield behavior before code changes begin.

- [X] T001 Confirm CRM admin, client proposal-access, Supabase backend, and cross-cutting workflow scope in specs/002-proposal-workflow-reset/plan.md
- [X] T002 Confirm no public website routes, SEO, or content changes are authorized in specs/002-proposal-workflow-reset/plan.md
- [X] T003 [P] Inventory proposal-template routes, sidebar entries, components, services, repositories, models, and tests to retire in specs/002-proposal-workflow-reset/research.md
- [X] T004 [P] Inventory floral proposal builder, proposal-access, edge-function, schema, and storage paths that must remain intact in specs/002-proposal-workflow-reset/quickstart.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the data-state, security, and submission boundaries that every user story depends on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Define finalized proposal-data state, re-finalization cycle, and document-submission invariants in src/app/core/models/floral-proposal.ts
- [X] T006 Define builder-to-submission workflow boundaries and florist action rules in src/app/core/supabase/services/floral-proposal-workflow.service.ts
- [X] T007 Define Supabase proposal submission payload changes for florist-supplied PDFs in supabase/edge_functions/submit-floral-proposal.ts
- [X] T008 [P] Define test coverage scope for builder, workflow service, proposal-access continuity, and retired template domain in specs/002-proposal-workflow-reset/quickstart.md
- [X] T009 [P] Document staged schema cleanup expectations for template retirement in specs/002-proposal-workflow-reset/research.md
- [X] T010 Confirm manual PDF upload remains the required primary submission path and Canva import stays optional in specs/002-proposal-workflow-reset/contracts/proposal-document-submission-contract.md

**Checkpoint**: Finalization, submission, security, and template-retirement boundaries are locked and user story implementation can begin.

---

## Phase 3: User Story 1 - Retire In-App Proposal Templates (Priority: P1)

**Goal**: Remove all template-studio, template-management, and generated-template proposal paths so the CRM no longer presents in-app proposal authoring.

**Independent Test**: Confirm users can no longer reach proposal-template routes, sidebar entries, template CRUD screens, template-studio UI, or generated-template proposal actions anywhere in the CRM or proposal workflow.

### Tests for User Story 1

- [X] T011 [P] [US1] Add route and navigation cleanup tests in src/app/app.routes.spec.ts and src/app/shared/components/private/sidebar/sidebar.component.spec.ts
- [X] T012 [P] [US1] Add or update workflow service tests for removed template dependencies in src/app/core/supabase/services/floral-proposal-workflow.service.spec.ts
- [ ] T013 [P] [US1] Add retirement coverage for template-facing UI removal in src/app/components/private/proposal-templates/proposal-templates.component.spec.ts and src/app/components/private/proposal-templates/template-studio/proposal-template-studio.component.spec.ts

### Implementation for User Story 1

- [X] T014 [US1] Remove proposal-template admin routes from src/app/app.routes.ts
- [X] T015 [US1] Remove proposal-template navigation entries and active-route checks from src/app/shared/components/private/sidebar/sidebar.component.ts
- [X] T016 [US1] Remove retired template UI components under src/app/components/private/proposal-templates/
- [ ] T017 [US1] Remove or narrow retired template-domain services and helpers under src/app/core/proposal-templates/
- [X] T018 [US1] Remove obsolete template repository/service usage from src/app/core/supabase/repositories/document-template-repository.service.ts and src/app/core/supabase/services/document-template.service.ts
- [X] T019 [US1] Remove generated-template rendering and preview dependencies from src/app/core/supabase/services/floral-proposal-renderer.service.ts and src/app/core/supabase/services/floral-proposal-workflow.service.ts
- [X] T020 [US1] Update any surviving proposal model fields that still imply required template selection in src/app/core/models/floral-proposal.ts and src/app/core/floral-services/floral-service-catalog.ts
- [X] T021 [US1] Verify no florist-visible template authoring actions remain in src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.html and related workflow triggers

**Checkpoint**: Template authoring is removed and the CRM no longer exposes in-app proposal-template workflows.

---

## Phase 4: User Story 2 - Finalize and Maintain Proposal Data (Priority: P1)

**Goal**: Preserve the builder as the structured proposal-data system of record while adding explicit finalize, lock, edit, and re-finalize state transitions.

**Independent Test**: Build a proposal, save a draft, finalize the proposal data, verify only `Edit Proposal Data` and `Submit Proposal Document` remain available, then reopen editing and re-finalize successfully.

### Tests for User Story 2

- [X] T022 [P] [US2] Expand builder state-transition tests in src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts
- [X] T023 [P] [US2] Expand proposal builder service calculation and state-shaping tests in src/app/core/supabase/services/floral-proposal-builder.service.spec.ts
- [X] T024 [P] [US2] Expand floral proposal repository persistence tests for finalized proposal states in src/app/core/supabase/repositories/floral-proposal-repository.service.spec.ts
- [X] T025 [P] [US2] Expand lead detail entry-point tests for `Build Floral Proposal` workflow access in src/app/components/private/leads/lead-detail/lead-detail.component.spec.ts

### Implementation for User Story 2

- [X] T026 [US2] Add finalized and re-finalization proposal state support in src/app/core/models/floral-proposal.ts
- [X] T027 [US2] Refactor builder read-only and allowed-action logic in src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.ts
- [X] T028 [US2] Update builder UI to show finalize, locked-state, edit, and re-finalize actions in src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.html
- [X] T029 [US2] Preserve existing markup, labor, tax region, line item, catalog, shopping list, summary, and totals behavior while decoupling from template requirements in src/app/core/supabase/services/floral-proposal-builder.service.ts
- [X] T030 [US2] Update draft, finalized, and active proposal persistence rules in src/app/core/supabase/repositories/floral-proposal-repository.service.ts
- [X] T031 [US2] Update builder orchestration to record finalized snapshots and reopened edit cycles in src/app/core/supabase/services/floral-proposal-workflow.service.ts
- [X] T032 [US2] Ensure lead-to-builder entry remains intact and aligned with allowed statuses in src/app/components/private/leads/lead-detail/lead-detail.component.ts

**Checkpoint**: The florist can manage proposal data through draft, finalized, edit, and re-finalize states without losing existing builder capabilities.

---

## Phase 5: User Story 3 - Submit Canva Proposal PDFs for Client Review (Priority: P1)

**Goal**: Let the florist submit a finalized proposal PDF through manual upload, keep optional Canva import secondary, and preserve the current client approval/decline cycle including required edit-and-re-finalize resubmission.

**Independent Test**: Finalize proposal data, submit a valid PDF, confirm the existing client review flow begins, then simulate a decline and verify the florist must edit and re-finalize before a replacement PDF can be submitted.

### Tests for User Story 3

- [X] T033 [P] [US3] Add document-submission modal tests for manual PDF validation and optional Canva affordance in src/app/components/private/floral-proposal-builder/components/proposal-document-submission-modal/proposal-document-submission-modal.component.spec.ts
- [X] T034 [P] [US3] Expand workflow-service submission and resubmission tests in src/app/core/supabase/services/floral-proposal-workflow.service.spec.ts
- [X] T035 [P] [US3] Expand proposal-access service and review continuity tests in src/app/core/proposal-access/proposal-access.service.spec.ts and src/app/components/proposal-access/proposal-review/proposal-review.component.spec.ts
- [X] T036 [P] [US3] Verify florist-supplied PDF submission through standalone-function review and deployed smoke scenarios

### Implementation for User Story 3

- [X] T037 [US3] Create the proposal document submission modal in src/app/components/private/floral-proposal-builder/components/proposal-document-submission-modal/
- [X] T038 [US3] Integrate finalized-only submit actions and modal launch flow in src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.ts and src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.html
- [X] T039 [US3] Refactor submission payload building to accept florist-supplied PDFs instead of generated template output in src/app/core/supabase/services/floral-proposal-workflow.service.ts
- [X] T040 [US3] Remove server-generated HTML/PDF submission requirements and enforce finalized-state PDF validation in supabase/edge_functions/submit-floral-proposal.ts
- [X] T041 [US3] Preserve client email, passcode, lead status, and proposal-review continuity while switching to uploaded PDFs in supabase/edge_functions/submit-floral-proposal.ts and src/app/core/proposal-access/proposal-access.service.ts
- [X] T042 [US3] Enforce decline -> edit -> re-finalize -> replacement submission gating in src/app/core/supabase/services/floral-proposal-workflow.service.ts and src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.ts
- [X] T043 [US3] Stage template-schema decoupling by stopping required writes to template-driven fields in src/app/core/supabase/repositories/floral-proposal-repository.service.ts and supabase/schemas/public/tables/floral_proposals.sql
- [X] T044 [US3] If feasible without reviving template-studio behavior, narrow Canva connection reuse to optional PDF import support in src/app/core/proposal-templates/proposal-template-canva.service.ts or remove the dependency from the first release path

**Checkpoint**: Finalized proposal data can be submitted as a florist-supplied PDF and the existing client approval or decline cycle continues, including required re-finalization before resubmission.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish cleanup, harden cross-story behavior, and verify the full workflow end to end.

- [X] T045 [P] Remove or update obsolete proposal-template documentation references in specs/002-proposal-workflow-reset/quickstart.md and other local docs
- [X] T046 [P] Add or normalize synthetic proposal workflow fixtures in src/app/core/testing/proposal-testing.ts
- [ ] T047 Remove dead imports, unused tests, and stale proposal-template references across src/app/**/*.ts and src/app/**/*.spec.ts
- [X] T048 Harden PDF validation, customer-data handling, and error messaging in src/app/components/private/floral-proposal-builder/ and supabase/edge_functions/submit-floral-proposal.ts
- [X] T049 Verify public website behavior remains unchanged and client proposal-auth/review continuity still holds after the workflow refactor in src/app/components/proposal-access/
- [ ] T050 Run `npm run test -- --watch=false --browsers=ChromeHeadless` and record final verification notes in specs/002-proposal-workflow-reset/quickstart.md
- [ ] T051 Run `npm run build` and record any proposal-workflow follow-up notes in specs/002-proposal-workflow-reset/quickstart.md

---

## Dependencies & Execution Order

- Phase 1 has no dependencies and establishes exact scope.
- Phase 2 depends on Phase 1 and blocks all user story work.
- US1 should begin first after Phase 2 because template-route and service retirement removes the old conflicting workflow.
- US2 depends on Phase 2 and can begin after the core retirement boundaries are understood; it should complete before US3 because document submission depends on finalized proposal-data states.
- US3 depends on Phase 2 and US2 because submission and resubmission require the finalized/edit/re-finalize workflow to exist.
- Phase 6 depends on all selected user stories being complete.

## Parallel Execution Examples

- **Setup**: T003 and T004 can run in parallel because they inventory different artifact groups.
- **Foundational**: T008 and T009 can run in parallel because they update different planning artifacts.
- **US1**: T011, T012, and T013 can run in parallel because they touch separate spec files and validation areas.
- **US1 implementation**: T014 and T015 can run in parallel, and T016 and T017 can run in parallel once route removal is underway.
- **US2 tests**: T022 through T025 can run in parallel because they cover separate components/services/repositories.
- **US3 tests**: T033 through T036 can run in parallel because they target separate files and boundaries.
- **Polish**: T045 and T046 can run in parallel because they touch different documentation and test-helper files.

## Implementation Strategy

### MVP First

Complete Phase 1, Phase 2, and US1 to remove the conflicting template-authoring workflow and establish the new allowed proposal path.

### Builder State Increment

Complete US2 next so the builder can act as the explicit draft/finalized/edit/re-finalize system of record before any document submission changes are layered on.

### Submission Increment

Complete US3 after US2 to swap generated-template submission for florist-supplied PDF submission while preserving client approval/decline continuity.

### Hardening

Complete Phase 6 to remove stale references, verify security and PDF validation behavior, and run the final test/build checks.

## Notes

- [P] tasks must touch different files or have no dependency conflict.
- Each user story remains independently testable.
- Manual PDF upload is the only required release path; optional Canva import must never block implementation.
- Replacement proposal documents must always follow edit plus re-finalization first.
