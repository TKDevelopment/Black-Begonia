# Tasks: Manual Proposal Booking

**Input**: Design documents from `/specs/004-manual-proposal-booking/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/manual-proposal-booking.md](./contracts/manual-proposal-booking.md), [quickstart.md](./quickstart.md)

**Tests**: Required for changed Angular components, guards, services, repositories, workflow logic, Supabase schemas, and edge-function contracts touched by this proposal refactor.

**Organization**: Tasks are grouped by independently testable user stories. All user stories are P1 in the spec, so ordering follows the safest implementation path: preserve builder, upload PDF, convert lead, retire signing workflow, then support booked-project revisions.

## Phase 1: Setup

**Purpose**: Lock the branch, inventory, and safety boundaries before implementation work.

- [X] T001 Confirm the working branch is `004-manual-proposal-booking` and record that AI agents must not run commit or push commands in `specs/004-manual-proposal-booking/tasks.md`
- [X] T002 [P] Capture the proposal workflow inventory from `src/app/app.routes.ts`, `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.ts`, `src/app/core/supabase/services/floral-proposal-workflow.service.ts`, and `supabase/edge_functions/`
- [X] T003 [P] Capture the Supabase schema cleanup inventory from `supabase/schemas/public/tables/floral_proposals.sql`, `supabase/schemas/public/tables/projects.sql`, `supabase/schemas/public/tables/leads.sql`, and `supabase/schemas/public/tables/proposal_signing_sessions.sql`
- [X] T004 [P] Capture current proposal-access frontend removal targets in `src/app/components/proposal-access/`, `src/app/core/proposal-access/`, `src/app/core/guards/proposal-access.guard.ts`, and `src/app/core/layouts/proposal-access-layout/`
- [X] T005 [P] Confirm private PDF storage policy impact in `supabase/schemas/storage/floral_proposals.sql`
- [X] T006 Produce explicit keep/refactor/delete/migrate Supabase artifact classification inventory in `specs/004-manual-proposal-booking/supabase-artifact-classification.md`

## Phase 2: Foundational

**Purpose**: Create shared schema, model, repository, and edge-function foundations that block all user stories.

**CRITICAL**: No user story implementation should begin until this phase is complete.

- [X] T007 Add executable cleanup migration `supabase/migrations/20260717000000_manual_proposal_booking_cleanup.sql` for signing/portal deletion and project proposal snapshot/version schema
- [X] T008 Document RLS roles, access paths, and policy intent for project proposal snapshots, document versions, and changed project relationships in `specs/004-manual-proposal-booking/supabase-rls-design.md`
- [X] T009 Implement RLS enablement and policy statements for project proposal snapshots, document versions, and changed project relationships in `supabase/migrations/20260717000000_manual_proposal_booking_cleanup.sql`
- [X] T010 Update final project table declaration with active snapshot/version references in `supabase/schemas/public/tables/projects.sql`
- [X] T011 Add project proposal invoice snapshot table declaration in `supabase/schemas/public/tables/project_proposal_invoice_snapshots.sql`
- [X] T012 Add project proposal document version table declaration in `supabase/schemas/public/tables/project_proposal_document_versions.sql`
- [X] T013 Remove signing/portal-only columns from the final proposal table declaration in `supabase/schemas/public/tables/floral_proposals.sql`
- [X] T014 Remove signing session table declaration from `supabase/schemas/public/tables/proposal_signing_sessions.sql`
- [X] T015 Update private PDF bucket policies for project-owned proposal documents in `supabase/schemas/storage/floral_proposals.sql`
- [X] T016 [P] Add project proposal invoice snapshot model types in `src/app/core/models/project-proposal-invoice-snapshot.ts`
- [X] T017 [P] Add project proposal document version model types in `src/app/core/models/project-proposal-document-version.ts`
- [X] T018 Update project model active snapshot/version fields in `src/app/core/models/project.ts`
- [X] T019 Remove signing/provider/passcode fields from proposal model types in `src/app/core/models/floral-proposal.ts`
- [X] T020 Delete retired signing session model references from `src/app/core/models/proposal-signing-session.ts`
- [X] T021 [P] Add project proposal invoice snapshot repository in `src/app/core/supabase/repositories/project-proposal-invoice-snapshot-repository.service.ts`
- [X] T022 [P] Add project proposal document version repository in `src/app/core/supabase/repositories/project-proposal-document-version-repository.service.ts`
- [X] T023 Update project repository mapping for active snapshot/version relationships in `src/app/core/supabase/repositories/project-repository.service.ts`
- [X] T024 Update floral proposal repository mapping after signing field removal in `src/app/core/supabase/repositories/floral-proposal-repository.service.ts`
- [X] T025 Refactor `submit-floral-proposal` request and response types away from SignWell in `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T026 Confirm remaining Supabase edge functions are standalone and document removals in `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T027 [P] Update shared workflow fixtures for manual booking data in `src/app/core/testing/workflow-fixtures.ts`

**Checkpoint**: Database shape, TypeScript models, and backend submission contract are ready for story implementation.

## Phase 3: User Story 1 - Build Proposal Invoice Data

**Goal**: Preserve the existing proposal builder workflow through finalization with no client delivery or signing side effects.

**Independent Test**: Start from an eligible lead, open the floral proposal builder, edit markup/labor/tax/line items/arrangements, and verify totals and shopping list preview still update before finalization.

### Tests for User Story 1

- [X] T028 [P] [US1] Update builder preservation tests in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts`
- [X] T029 [P] [US1] Update proposal builder service tests for totals and shopping list preservation in `src/app/core/supabase/services/floral-proposal-builder.service.spec.ts`
- [X] T030 [P] [US1] Update lead detail proposal navigation tests in `src/app/components/private/leads/lead-detail/lead-detail.component.spec.ts`

### Implementation for User Story 1

- [X] T031 [US1] Remove pre-finalization SignWell/client-delivery progress copy from `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.ts`
- [X] T032 [US1] Preserve builder edit controls and finalize entry point in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.html`
- [X] T033 [US1] Ensure proposal builder service does not invoke client email or signing behavior while editing in `src/app/core/supabase/services/floral-proposal-builder.service.ts`
- [X] T034 [US1] Ensure lead detail still opens builder from eligible leads in `src/app/components/private/leads/lead-detail/lead-detail.component.ts`

**Checkpoint**: User Story 1 is functional and independently testable.

## Phase 4: User Story 2 - Upload Signed Proposal Package

**Goal**: Replace finalization with a signed PDF upload modal, explicit confirmation, storage validation, and no conversion when canceled.

**Independent Test**: Click `Finalize Proposal`, upload a valid PDF by drag/drop or file picker, confirm the warning, and verify storage/conversion starts only after confirmation.

### Tests for User Story 2

- [X] T035 [P] [US2] Update modal validation tests in `src/app/components/private/floral-proposal-builder/components/proposal-document-submission-modal/proposal-document-submission-modal.component.spec.ts`
- [X] T036 [P] [US2] Update workflow service submission contract tests in `src/app/core/supabase/services/floral-proposal-workflow.service.spec.ts`
- [X] T037 [P] [US2] Add edge-function request validation checks for missing, non-PDF, corrupt, password-protected, empty, and oversized PDF submissions in `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T038 [P] [US2] Add modal validation tests for missing, non-PDF, empty, and oversized PDF files in `src/app/components/private/floral-proposal-builder/components/proposal-document-submission-modal/proposal-document-submission-modal.component.spec.ts`

### Implementation for User Story 2

- [X] T039 [US2] Refactor PDF drag/drop and file picker behavior in `src/app/components/private/floral-proposal-builder/components/proposal-document-submission-modal/proposal-document-submission-modal.component.ts`
- [X] T040 [US2] Update signed PDF modal markup and user-facing copy in `src/app/components/private/floral-proposal-builder/components/proposal-document-submission-modal/proposal-document-submission-modal.component.html`
- [X] T041 [US2] Wire finalize button to manual signed PDF submission modal in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.ts`
- [X] T042 [US2] Replace SignWell submission invocation with manual PDF submission payload in `src/app/core/supabase/services/floral-proposal-workflow.service.ts`
- [X] T043 [US2] Implement PDF storage path creation and missing, non-PDF, empty, and oversized upload validation in `src/app/core/supabase/services/floral-proposal-workflow.service.ts`
- [X] T044 [US2] Implement corrupt and password-protected PDF rejection in `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T045 [US2] Implement authenticated PDF storage verification in `supabase/edge_functions/submit-floral-proposal.ts`

**Checkpoint**: User Stories 1 and 2 work independently.

## Phase 5: User Story 3 - Convert Lead to Booked Project

**Goal**: Convert a confirmed signed PDF submission into exactly one booked project with lead history and project-owned document/snapshot records.

**Independent Test**: Submit a signed PDF for a lead and verify one booked project, converted lead history, active project document version, and active invoice snapshot.

### Tests for User Story 3

- [X] T046 [P] [US3] Add project repository tests for active snapshot/version mapping in `src/app/core/supabase/repositories/project-repository.service.spec.ts`
- [X] T047 [P] [US3] Add floral proposal workflow conversion tests in `src/app/core/supabase/services/floral-proposal-workflow.service.spec.ts`
- [X] T048 [P] [US3] Add lead pipeline exclusion tests in `src/app/components/private/leads/lead-detail/lead-detail.component.spec.ts`
- [X] T049 [P] [US3] Add project document history display tests in `src/app/components/private/projects/projects.component.spec.ts`

### Implementation for User Story 3

- [X] T050 [US3] Implement lead-to-booked-project transaction in `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T051 [US3] Implement idempotency and duplicate-project prevention in `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T052 [US3] Create active invoice snapshot during booking in `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T053 [US3] Create active proposal document version during booking in `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T054 [US3] Update lead repository or workflow mapping for converted lead history in `src/app/core/supabase/repositories/lead-repository.service.ts`
- [X] T055 [US3] Exclude converted leads from active lead pipeline actions in `src/app/components/private/leads/leads.component.ts`
- [X] T056 [US3] Add booked project success navigation and failure feedback in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.ts`
- [X] T057 [US3] Display project-owned proposal PDF history entry points in `src/app/components/private/projects/projects.component.html`

**Checkpoint**: User Stories 1, 2, and 3 work independently.

## Phase 6: User Story 4 - Retire Client Signing Workflow

**Goal**: Remove active SignWell, client proposal portal, proposal email, passcode, and webhook behavior from the proposal workflow.

**Independent Test**: Verify finalization creates no provider documents, sends no proposal-access emails, exposes no passcode/signing UI, and legacy portal URLs are inaccessible.

### Tests for User Story 4

- [X] T058 [P] [US4] Update route tests to assert proposal-access routes are removed in `src/app/app.routes.spec.ts`
- [X] T059 [P] [US4] Remove or replace proposal-access service tests in `src/app/core/proposal-access/proposal-access.service.spec.ts`
- [X] T060 [P] [US4] Remove or replace proposal-access guard tests in `src/app/core/guards/proposal-access.guard.spec.ts`
- [X] T061 [P] [US4] Remove SignWell expectations from builder tests in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts`
- [X] T062 [P] [US4] Remove SignWell expectations from workflow service tests in `src/app/core/supabase/services/floral-proposal-workflow.service.spec.ts`

### Implementation for User Story 4

- [X] T063 [US4] Remove proposal-access routes and imports from `src/app/app.routes.ts`
- [X] T064 [US4] Delete retired proposal-access auth component files in `src/app/components/proposal-access/proposal-auth/`
- [X] T065 [US4] Delete retired proposal-access review component files in `src/app/components/proposal-access/proposal-review/`
- [X] T066 [US4] Delete retired proposal-access service and models in `src/app/core/proposal-access/`
- [X] T067 [US4] Delete retired proposal-access guard in `src/app/core/guards/proposal-access.guard.ts`
- [X] T068 [US4] Delete retired proposal-access layout files in `src/app/core/layouts/proposal-access-layout/`
- [X] T069 [US4] Delete retired signing session repository in `src/app/core/supabase/repositories/proposal-signing-session-repository.service.ts`
- [X] T070 [US4] Delete retired edge function source file `supabase/edge_functions/signwell-webhook.ts`
- [X] T071 [US4] Delete retired edge function source file `supabase/edge_functions/verify-floral-proposal-access.ts`
- [X] T072 [US4] Delete retired edge function source file `supabase/edge_functions/submit-floral-proposal-response.ts`
- [X] T073 [US4] Delete retired edge function source file `supabase/edge_functions/send-proposal-email.ts`
- [X] T074 [US4] Delete retired edge function source file `supabase/edge_functions/resend-floral-proposal-email.ts`
- [X] T075 [US4] Remove SignWell/provider/passcode environment references from `src/environments/environment.model.ts`
- [X] T076 [US4] Remove SignWell/provider/passcode setup guidance from `README.md`

**Checkpoint**: User Stories 1 through 4 work independently and the retired client signing workflow is inaccessible.

## Phase 7: User Story 5 - Revise Booked Project Proposal Data

**Goal**: Allow booked projects to revise proposal invoice data and activate new invoice snapshots/PDF versions without deleting history.

**Independent Test**: Open a booked project, edit proposal invoice data, submit a revised signed PDF, and verify active snapshot/version updates while prior PDFs remain viewable.

### Tests for User Story 5

- [X] T077 [P] [US5] Add project proposal revision tests in `src/app/components/private/projects/projects.component.spec.ts`
- [X] T078 [P] [US5] Add project proposal document version repository tests in `src/app/core/supabase/repositories/project-proposal-document-version-repository.service.spec.ts`
- [X] T079 [P] [US5] Add project proposal invoice snapshot repository tests in `src/app/core/supabase/repositories/project-proposal-invoice-snapshot-repository.service.spec.ts`
- [X] T080 [P] [US5] Add project revision workflow tests in `src/app/core/supabase/services/floral-proposal-workflow.service.spec.ts`

### Implementation for User Story 5

- [X] T081 [US5] Add project-mode route or resolver support for proposal builder in `src/app/app.routes.ts`
- [X] T082 [US5] Add project-mode loading and editing support in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.ts`
- [X] T083 [US5] Add project proposal revision entry action in `src/app/components/private/projects/projects.component.html`
- [X] T084 [US5] Add project proposal document history UI in `src/app/components/private/projects/projects.component.ts`
- [X] T085 [US5] Implement project revision submission mode in `src/app/core/supabase/services/floral-proposal-workflow.service.ts`
- [X] T086 [US5] Implement project revision transaction and active snapshot replacement in `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T087 [US5] Ensure unconfirmed builder edits do not replace active snapshot in `src/app/core/supabase/services/floral-proposal-builder.service.ts`

**Checkpoint**: All user stories are independently functional.

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup, and human handoff.

- [X] T088 [P] Remove obsolete SignWell/client-portal copy from `src/app/components/private/leads/components/lead-proposal-history-card/lead-proposal-history-card.component.html`
- [X] T089 [P] Update proposal history tests for manual booking terminology in `src/app/components/private/leads/components/lead-proposal-history-card/lead-proposal-history-card.component.spec.ts`
- [X] T090 [P] Review internal preview behavior and remove obsolete contract-signing assumptions in `supabase/edge_functions/preview-floral-proposal-pdf.ts`
- [X] T091 [P] Run TypeScript app check with `npx tsc -p tsconfig.app.json --noEmit`
- [X] T092 [P] Run TypeScript spec check with `npx tsc -p tsconfig.spec.json --noEmit`
- [X] T093 Run Karma/Jasmine test suite with `npx ng test --watch=false --browsers=ChromeHeadless`
- [X] T094 Run Supabase edge type check with `npx -y deno check --config supabase/deno.json supabase/edge_functions/submit-floral-proposal.ts`
- [X] T095 Run production build check with `npx ng build --configuration dev`
- [ ] T096 Execute manual quickstart validation from `specs/004-manual-proposal-booking/quickstart.md`
- [X] T097 Produce human source-control handoff summary for changed files and suggested commit message in `specs/004-manual-proposal-booking/tasks.md`

## Dependencies & Execution Order

- Phase 1 setup has no dependencies.
- Phase 2 foundational schema/model/contract work depends on Phase 1 and blocks all user stories.
- US1 should complete first because it protects the existing builder behavior.
- US2 depends on US1 and the foundational submission contract.
- US3 depends on US2 because conversion is triggered by confirmed signed PDF submission.
- US4 can run after foundational work, but final verification should happen after US2 and US3 to prove no retired workflow is invoked.
- US5 depends on US3 because revisions require a booked project and project-owned active snapshot/version records.
- Phase 8 depends on the selected user stories being complete.

## Parallel Execution Examples

- Setup inventory can run in parallel: T002, T003, T004, and T005 touch different surfaces.
- Foundational model/repository work can run in parallel after T007: T016, T017, T021, T022, and T027.
- US1 tests can run in parallel: T028, T029, and T030.
- US2 tests can run in parallel: T035, T036, and T037.
- US3 tests can run in parallel: T046, T047, T048, and T049.
- US4 removals can be split by surface after route tests are updated: T064 through T074.
- US5 repository tests can run in parallel: T077, T078, T079, and T080.
- Final static checks T091, T092, and T094 can run in parallel when no file edits are in progress.

## Implementation Strategy

### MVP First

Complete Phases 1 and 2, then deliver US1, US2, and US3. This preserves the builder, accepts a signed PDF, and converts a lead to one booked project with an active project-owned document and invoice snapshot.

### Incremental Delivery

1. Preserve builder behavior and remove finalization side effects.
2. Replace finalization with signed PDF upload and confirmation.
3. Convert confirmed submissions into booked projects with project-owned records.
4. Remove retired SignWell/client portal/email paths.
5. Add booked-project proposal revision support and version history.

### Human Git Handoff

AI agents must not run `git commit`, `git push`, or commit/push-capable automation. The human operator owns committing, pushing, and opening any PR after reviewing the source-control summary.

### Source-Control Summary

Current source-control changes implement the manual proposal booking workflow:

- Supabase cleanup: adds `20260717000000_manual_proposal_booking_cleanup.sql`, removes signing/session schema, adds project proposal invoice snapshot and document version schema, updates project active snapshot/document references, and replaces storage policy names for private project proposal PDFs.
- Edge functions: refactors `submit-floral-proposal` into the authenticated manual booking/revision submission function with PDF validation, lead-to-project booking, idempotency by storage path, active invoice snapshot creation, and active document version creation; deletes retired SignWell, proposal-access, proposal-response, and proposal-email functions.
- Angular proposal flow: updates finalization to require a signed PDF upload and confirmation, sends the new manual submission contract, supports project revision mode via `projectId`, and navigates to the project workspace after booking.
- Projects workspace: replaces the placeholder Projects page with project selection, proposal document history, signed PDF opening through private signed URLs, and a revise-proposal entry point.
- Retired portal removal: removes public proposal-access routes, guard, layout, components, service/model files, resend/open proposal actions, proposal portal environment keys, and old README/setup references.
- Models/repositories/tests: adds project proposal snapshot/document models and repositories with tests, updates project/proposal models and repositories, removes signing fields from fixtures and tests, and expands route/workflow/builder/modal/projects coverage.
- Spec Kit and governance artifacts: includes the 004 spec/plan/tasks/design artifacts, the RLS and Supabase artifact inventories, and prior constitution/template updates requiring humans to own commits and pushes.

Suggested commit message for the human operator:

```text
Refactor proposal finalization to manual signed PDF booking
```

