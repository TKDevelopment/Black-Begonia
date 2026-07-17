# Tasks: Project Details Workflow

**Input**: Design documents from `/specs/005-project-details-workflow/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/project-details-workflow.md, quickstart.md

**Tests**: Karma/Jasmine unit tests are required for changed Angular components, services, repositories, and workflow logic. Focused manual integration checks are covered by quickstart.md.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after the foundational data/service work is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when files and dependencies do not conflict
- **[Story]**: Which user story this task belongs to, such as US1 or US2
- Include exact file paths in descriptions

## Path Conventions

- Angular app: `src/app/...`
- CRM admin: `src/app/components/private/...`
- Core services/models/guards: `src/app/core/...`
- Shared UI: `src/app/shared/...`
- Supabase tables: `supabase/schemas/public/tables/...`
- Supabase functions: `supabase/schemas/public/functions/...`
- Supabase migrations: `supabase/migrations/...`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm scope, approvals, and affected surfaces before code work.

- [X] T001 Confirm this feature affects only CRM admin and Supabase backend surfaces in `specs/005-project-details-workflow/plan.md`
- [X] T002 Confirm no public website product-owner approval is required because no public routes or SEO content change in `specs/005-project-details-workflow/plan.md`
- [X] T003 [P] Capture brownfield behavior to preserve from leads, contacts, organizations, proposal builder, project linking, and private PDF access in `specs/005-project-details-workflow/quickstart.md`
- [X] T004 [P] Review affected project routes, components, services, repositories, tables, and storage paths listed in `specs/005-project-details-workflow/plan.md`
- [X] T005 [P] Confirm current task branch and active feature directory from `.specify/feature.json`
- [X] T006 Confirm all commit and push actions remain human-operated before implementation begins in `AGENTS.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema, models, repositories, and workflow logic that MUST be complete before user story implementation.

**CRITICAL**: No user story work can begin until this phase is complete.

### Tests for Foundational Work

- [X] T007 [P] Add Karma/Jasmine tests for project repository status refresh and single-project loading in `src/app/core/supabase/repositories/project-repository.service.spec.ts`
- [ ] T008 [P] Add Karma/Jasmine tests for project payment CRUD and query behavior in `src/app/core/supabase/repositories/project-payment-record-repository.service.spec.ts`
- [ ] T009 [P] Add Karma/Jasmine tests for project workflow payment/status transitions in `src/app/core/supabase/services/project-workflow.service.spec.ts`
- [ ] T010 [P] Add Karma/Jasmine tests for project activity reads and writes in `src/app/core/supabase/repositories/activity-repository.service.spec.ts`

### Implementation for Foundational Work

- [X] T011 Add executable migration for project statuses, project payment records, indexes, RLS policies, and status refresh function in `supabase/migrations/20260718000000_project_details_workflow.sql`
- [X] T012 Update project table declaration with approved status default and any status-related constraints in `supabase/schemas/public/tables/projects.sql`
- [X] T013 [P] Add project payment records table declaration in `supabase/schemas/public/tables/project_payment_records.sql`
- [X] T014 [P] Add status refresh function declaration in `supabase/schemas/public/functions/refresh_project_payment_statuses.sql`
- [X] T015 [P] Update activity table/function declarations for project payment, document, revision, snapshot, and status timeline event types in `supabase/schemas/public/tables/activity_log.sql`
- [X] T016 Update project status union, update input type, and editable field typing in `src/app/core/models/project.ts`
- [X] T017 [P] Create project payment record model and input types in `src/app/core/models/project-payment-record.ts`
- [X] T018 [P] Extend activity model event types for project timeline events in `src/app/core/models/activity-log.ts`
- [X] T019 Update project repository with `getProjectById`, status refresh call, safe update payload mapping, and new status defaults in `src/app/core/supabase/repositories/project-repository.service.ts`
- [X] T020 [P] Create project payment record repository in `src/app/core/supabase/repositories/project-payment-record-repository.service.ts`
- [X] T021 Update activity repository with project activity read/write methods in `src/app/core/supabase/repositories/activity-repository.service.ts`
- [X] T022 Create project workflow service for deposit/final-payment status transitions, 45-day refresh orchestration, and activity logging in `src/app/core/supabase/services/project-workflow.service.ts`
- [X] T023 Update proposal submission/revision project creation defaults from booked/legacy statuses to `awaiting_deposit` where appropriate in `src/app/core/supabase/services/floral-proposal-workflow.service.ts`
- [X] T024 Update lead conversion project defaults to `awaiting_deposit` where manual conversion creates projects in `src/app/core/supabase/services/lead-conversion.service.ts`
- [X] T025 [P] Update workflow fixtures for approved project statuses, payment records, invoice snapshots, document versions, and project activity in `src/app/core/testing/workflow-fixtures.ts`
- [X] T026 Confirm no service-role secrets or privileged payment/provider keys are introduced in frontend code under `src/app/core/` and `src/environments/`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Browse And Filter Projects (Priority: P1)

**Goal**: Replace the current projects sidebar/detail split with a CRM-standard searchable, filterable projects table.

**Independent Test**: Open `/admin/projects`, verify the Project, Service Type, Event Date, Status, and Actions columns, search by project text, filter by status/event type/service type, reset filters, and confirm the table exposes a view action for each project.

### Tests for User Story 1

- [X] T027 [P] [US1] Update projects list component tests for table columns, search, filters, reset, empty state, and row navigation in `src/app/components/private/projects/projects.component.spec.ts`
- [X] T028 [P] [US1] Add route smoke test for `/admin/projects` route registration in `src/app/app.routes.spec.ts`

### Implementation for User Story 1

- [X] T029 [US1] Refactor projects component imports and state for search/filter/table behavior in `src/app/components/private/projects/projects.component.ts`
- [X] T030 [US1] Replace projects template with CRM page header, search filter bar, entity table shell, status badge cells, and action column in `src/app/components/private/projects/projects.component.html`
- [X] T031 [US1] Update projects styles for CRM-standard page padding, table spacing, and responsive layout in `src/app/components/private/projects/projects.component.scss`
- [X] T032 [US1] Add status label/tone helpers and project display formatting for approved statuses in `src/app/components/private/projects/projects.component.ts`
- [X] T033 [US1] Add status, event type, and service type filter option computation from loaded projects in `src/app/components/private/projects/projects.component.ts`
- [X] T034 [US1] Implement broad leads-style project search over name, service type, event type, status, event date, and venue/location fields in `src/app/components/private/projects/projects.component.ts`
- [X] T035 [US1] Render project view actions without inline details loading in `src/app/components/private/projects/projects.component.ts`
- [X] T036 [US1] Register or adjust the projects list route in `src/app/app.routes.ts`

**Checkpoint**: User Story 1 is functional and independently testable.

---

## Phase 4: User Story 2 - View Project Details (Priority: P1)

**Goal**: Add a dedicated project details screen with project summary, quick actions, financial summary, activity timeline, and no raw source lead UUID display.

**Independent Test**: Open a project from the table and verify the details page loads project information, hides raw source lead UUID, shows financial summary and activity timeline, and keeps optional sections usable when data is missing.

### Tests for User Story 2

- [ ] T037 [P] [US2] Add project details component tests for loading, error state, source lead UUID hiding, quick actions, and section composition in `src/app/components/private/projects/project-details/project-details.component.spec.ts`
- [ ] T038 [P] [US2] Add financial summary card tests for active total, deposit/final-payment states, unavailable values, zero values, and outstanding balance in `src/app/components/private/projects/components/project-financial-summary-card/project-financial-summary-card.component.spec.ts`
- [ ] T039 [P] [US2] Add payment log modal tests for manual Venmo/check/cash records and validation in `src/app/components/private/projects/components/project-payment-log-modal/project-payment-log-modal.component.spec.ts`
- [ ] T040 [P] [US2] Add activity panel tests for populated and empty project timelines in `src/app/components/private/projects/components/project-activity-panel/project-activity-panel.component.spec.ts`
- [X] T041 [P] [US2] Add route smoke test for `/admin/projects/:projectId` route registration in `src/app/app.routes.spec.ts`

### Implementation for User Story 2

- [X] T042 [US2] Register `/admin/projects/:projectId` project details route in `src/app/app.routes.ts`
- [X] T043 [US2] Wire projects table view action to `/admin/projects/:projectId` navigation in `src/app/components/private/projects/projects.component.ts`
- [X] T044 [US2] Create project details component class with project, payment, snapshot, document, and activity loading orchestration in `src/app/components/private/projects/project-details/project-details.component.ts`
- [X] T045 [US2] Create project details template with header, summary fields, quick actions, financial summary, documents placeholder, and activity panel in `src/app/components/private/projects/project-details/project-details.component.html`
- [X] T046 [US2] Create project details styles matching leads/contacts/organizations page padding and responsive detail layout in `src/app/components/private/projects/project-details/project-details.component.scss`
- [X] T047 [P] [US2] Create financial summary card component class in `src/app/components/private/projects/components/project-financial-summary-card/project-financial-summary-card.component.ts`
- [X] T048 [P] [US2] Create financial summary card template and styles in `src/app/components/private/projects/components/project-financial-summary-card/project-financial-summary-card.component.html`
- [X] T049 [P] [US2] Create financial summary card stylesheet in `src/app/components/private/projects/components/project-financial-summary-card/project-financial-summary-card.component.scss`
- [X] T050 [P] [US2] Create payment log modal component class with manual payment form state and validation in `src/app/components/private/projects/components/project-payment-log-modal/project-payment-log-modal.component.ts`
- [X] T051 [P] [US2] Create payment log modal template and controls in `src/app/components/private/projects/components/project-payment-log-modal/project-payment-log-modal.component.html`
- [X] T052 [P] [US2] Create payment log modal stylesheet in `src/app/components/private/projects/components/project-payment-log-modal/project-payment-log-modal.component.scss`
- [X] T053 [P] [US2] Create project activity panel component class in `src/app/components/private/projects/components/project-activity-panel/project-activity-panel.component.ts`
- [X] T054 [P] [US2] Create project activity panel template and empty state in `src/app/components/private/projects/components/project-activity-panel/project-activity-panel.component.html`
- [X] T055 [P] [US2] Create project activity panel stylesheet in `src/app/components/private/projects/components/project-activity-panel/project-activity-panel.component.scss`
- [X] T056 [US2] Integrate manual payment logging with project workflow service and details reload in `src/app/components/private/projects/project-details/project-details.component.ts`
- [X] T057 [US2] Ensure project details hides `source_lead_id` while preserving revision workflow access internally in `src/app/components/private/projects/project-details/project-details.component.html`
- [X] T058 [US2] Add section-level error handling for missing financial, payment, document, and activity data in `src/app/components/private/projects/project-details/project-details.component.ts`

**Checkpoint**: User Story 2 is functional and independently testable.

---

## Phase 5: User Story 5 - Review Proposal Documents (Priority: P1)

**Goal**: Present initial signed agreement and revised proposal PDFs with correct grouping, active/inactive display, metadata rows, PDF opening, and metadata-only revision comparison.

**Independent Test**: Open projects with one document and with revisions; verify no tabs for a single initial document, tabs for initial/revised documents when revisions exist, correct ordering and active state, Open PDF action, and metadata-only comparison.

### Tests for User Story 5

- [ ] T059 [P] [US5] Add proposal documents section tests for single-document display, tab display, grouping, ordering, status, active/inactive labels, and open PDF event in `src/app/components/private/projects/components/project-proposal-documents-section/project-proposal-documents-section.component.spec.ts`
- [ ] T060 [P] [US5] Add revision comparison modal tests for two-version selection, invoice metadata differences, document metadata differences, and missing snapshot explanations in `src/app/components/private/projects/components/project-revision-comparison-modal/project-revision-comparison-modal.component.spec.ts`
- [X] T061 [P] [US5] Add document repository tests for oldest-to-most-recent project document reads needed by revised proposals in `src/app/core/supabase/repositories/project-proposal-document-version-repository.service.spec.ts`
- [X] T062 [P] [US5] Add invoice snapshot repository tests for comparison data reads in `src/app/core/supabase/repositories/project-proposal-invoice-snapshot-repository.service.spec.ts`

### Implementation for User Story 5

- [X] T063 [US5] Update document version repository with ordered reads and active document lookup support in `src/app/core/supabase/repositories/project-proposal-document-version-repository.service.ts`
- [X] T064 [US5] Update invoice snapshot repository with project snapshot reads for comparison in `src/app/core/supabase/repositories/project-proposal-invoice-snapshot-repository.service.ts`
- [X] T065 [P] [US5] Create proposal documents section component class with initial/revised grouping and active-state derivation in `src/app/components/private/projects/components/project-proposal-documents-section/project-proposal-documents-section.component.ts`
- [X] T066 [P] [US5] Create proposal documents section template with conditional tabs, metadata table, status labels, and Open PDF action in `src/app/components/private/projects/components/project-proposal-documents-section/project-proposal-documents-section.component.html`
- [X] T067 [P] [US5] Create proposal documents section stylesheet in `src/app/components/private/projects/components/project-proposal-documents-section/project-proposal-documents-section.component.scss`
- [X] T068 [P] [US5] Create revision comparison modal component class for invoice/document metadata comparison in `src/app/components/private/projects/components/project-revision-comparison-modal/project-revision-comparison-modal.component.ts`
- [X] T069 [P] [US5] Create revision comparison modal template and empty/missing snapshot states in `src/app/components/private/projects/components/project-revision-comparison-modal/project-revision-comparison-modal.component.html`
- [X] T070 [P] [US5] Create revision comparison modal stylesheet in `src/app/components/private/projects/components/project-revision-comparison-modal/project-revision-comparison-modal.component.scss`
- [X] T071 [US5] Wire proposal documents section and comparison modal into project details in `src/app/components/private/projects/project-details/project-details.component.html`
- [X] T072 [US5] Move private signed URL PDF opening from old projects component into project details/document section flow in `src/app/components/private/projects/project-details/project-details.component.ts`

**Checkpoint**: User Story 5 is functional and independently testable.

---

## Phase 6: User Story 3 - Edit Project Information (Priority: P2)

**Goal**: Allow project-level information edits from project details while excluding source lead, proposal document, invoice snapshot, and payment record relationships.

**Independent Test**: Open a project, launch edit modal, save valid project identity/schedule/venue/note/status changes, confirm details refresh and activity records update, then cancel a second change and confirm no update persists.

### Tests for User Story 3

- [ ] T073 [P] [US3] Add edit project modal tests for prefilled values, allowed fields, validation, save payload, and cancel behavior in `src/app/components/private/projects/components/project-edit-modal/project-edit-modal.component.spec.ts`
- [ ] T074 [P] [US3] Add project details integration tests for opening edit modal, saving changes, reloading details, and logging activity in `src/app/components/private/projects/project-details/project-details.component.spec.ts`
- [ ] T075 [P] [US3] Add project workflow tests for status-change and project-update activity logging in `src/app/core/supabase/services/project-workflow.service.spec.ts`

### Implementation for User Story 3

- [X] T076 [US3] Create project edit modal component class with editable project fields and validation in `src/app/components/private/projects/components/project-edit-modal/project-edit-modal.component.ts`
- [X] T077 [US3] Create project edit modal template for project name, event type, service type, event date, venue/location, style notes, internal notes, and status in `src/app/components/private/projects/components/project-edit-modal/project-edit-modal.component.html`
- [X] T078 [P] [US3] Create project edit modal stylesheet in `src/app/components/private/projects/components/project-edit-modal/project-edit-modal.component.scss`
- [X] T079 [US3] Add project workflow update method that restricts update payloads and logs project/status changes in `src/app/core/supabase/services/project-workflow.service.ts`
- [X] T080 [US3] Integrate edit modal open/save/cancel behavior into project details in `src/app/components/private/projects/project-details/project-details.component.ts`
- [X] T081 [US3] Ensure edit modal does not render or submit source lead, proposal document, invoice snapshot, or payment record fields in `src/app/components/private/projects/components/project-edit-modal/project-edit-modal.component.html`

**Checkpoint**: User Story 3 is functional and independently testable.

---

## Phase 7: User Story 4 - Revise A Project Proposal (Priority: P2)

**Goal**: Move proposal revision access into project details quick actions while preserving the existing proposal builder revision workflow.

**Independent Test**: Open a booked project, click Revise Proposal, confirm routing into the existing proposal builder with project context, complete a revision, and confirm details reflect the active invoice/document after returning.

### Tests for User Story 4

- [ ] T082 [P] [US4] Add project details quick action tests for Revise Proposal routing, missing source lead handling, and active PDF action availability in `src/app/components/private/projects/project-details/project-details.component.spec.ts`
- [ ] T083 [P] [US4] Add floral proposal workflow regression tests for project revision response mapping and active project document/snapshot references in `src/app/core/supabase/services/floral-proposal-workflow.service.spec.ts`
- [ ] T084 [P] [US4] Add projects list regression test confirming revision controls are not exposed from the table row action in `src/app/components/private/projects/projects.component.spec.ts`

### Implementation for User Story 4

- [X] T085 [US4] Implement Revise Proposal quick action routing with internal source lead/project context in `src/app/components/private/projects/project-details/project-details.component.ts`
- [X] T086 [US4] Implement Open Active PDF quick action using the active project document version in `src/app/components/private/projects/project-details/project-details.component.ts`
- [X] T087 [US4] Ensure revise proposal access is removed from the projects table/list UI in `src/app/components/private/projects/projects.component.html`
- [X] T088 [US4] Verify existing proposal builder revision query parameter handling still accepts project context in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.ts`
- [X] T089 [US4] Ensure project details reloads active invoice snapshot and document version after successful revision return/navigation in `src/app/components/private/projects/project-details/project-details.component.ts`

**Checkpoint**: User Story 4 is functional and independently testable.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories.

- [X] T090 [P] Update quickstart validation notes after implementation in `specs/005-project-details-workflow/quickstart.md`
- [ ] T091 [P] Add or update focused regression tests for contacts and organizations project linking after project model/status changes in `src/app/components/private/contacts/contacts.component.spec.ts`
- [ ] T092 [P] Add or update focused regression tests for organizations project linking after project model/status changes in `src/app/components/private/organizations/organizations.component.spec.ts`
- [X] T093 [P] Add or update lead conversion regression tests for Awaiting Deposit default project status in `src/app/core/supabase/services/lead-conversion.service.spec.ts`
- [X] T094 Run Karma/Jasmine test suite defined in `package.json` with `npm run test -- --watch=false --browsers=ChromeHeadless`
- [X] T095 Run production build script defined in `package.json` with `npm run build`
- [ ] T096 Manually execute quickstart scenarios from `specs/005-project-details-workflow/quickstart.md`
- [ ] T097 Validate measurable outcomes SC-002, SC-007, SC-008, SC-009, and SC-010 using the measurable outcomes section in `specs/005-project-details-workflow/quickstart.md`
- [X] T098 Verify public website routes/content/SEO remain unchanged by reviewing `src/app/components/public/` and `src/app/app.routes.ts`
- [X] T099 Verify client proposal-access behavior remains unchanged by reviewing `src/app/components/proposal-access/` and proposal-access routes in `src/app/app.routes.ts`
- [X] T100 Verify no Supabase Edge Function uses `_shared` or cross-function imports under `supabase/edge_functions/`
- [X] T101 Review RLS, storage, secrets, customer data, proposal PDFs, signatures inside PDFs, and payment-related records for privacy compliance in `supabase/migrations/20260718000000_project_details_workflow.sql`
- [X] T102 Prepare human handoff summary and suggested commit message for files changed by this feature in `specs/005-project-details-workflow/tasks.md`

## Human Handoff Summary

Implemented the project details workflow foundation and UI: new operational statuses, payment records, status refresh function, dedicated projects table, project details route, financial summary, manual payment logging, activity panel, proposal document grouping, metadata comparison, edit modal, and project-detail revision/PDF actions.

Validation: `npm run build` succeeds. `npm run test -- --watch=false --browsers=ChromeHeadless` reported `TOTAL: 479 SUCCESS`, but the wrapper process did not exit before the shell timeout; direct retry was blocked by ChromeHeadless GPU/cache locking after the first run.

Open implementation follow-ups: add the remaining dedicated unit specs for new child components and workflow service/payment repository, and run manual quickstart acceptance against a seeded Supabase environment.

Suggested human commit message: `Implement project details workflow`

---

## Dependencies & Execution Order

- Phase 1 Setup has no dependencies.
- Phase 2 Foundational depends on Phase 1 and blocks every user story.
- P1 delivery order: US1 Projects List -> US2 Project Details -> US5 Proposal Documents.
- P2 delivery order: US3 Edit Project Information -> US4 Revise Proposal Entry Point.
- US2 depends on foundational project/payment/activity services and the `/admin/projects/:projectId` route.
- US5 depends on US2 details shell and foundational document/snapshot repositories.
- US3 depends on US2 details shell and foundational project workflow service.
- US4 depends on US2 details shell and existing proposal builder revision behavior.
- Polish depends on all desired user stories being complete.

## Parallel Execution Examples

### User Story 1

```text
T027 and T028 can run in parallel.
T032, T033, and T034 can be implemented together after T029.
```

### User Story 2

```text
T038, T039, T040, and T041 can run in parallel.
T047-T055 can run in parallel because they create separate child component files.
```

### User Story 5

```text
T059-T062 can run in parallel.
T065-T070 can run in parallel because document section and comparison modal files are separate.
```

### User Story 3

```text
T073, T074, and T075 can run in parallel.
T076-T078 can run in parallel after the modal API is agreed in T073.
```

### User Story 4

```text
T082-T084 can run in parallel.
T085 and T086 can run in parallel after project details quick action inputs exist.
```

## Implementation Strategy

### MVP First

Complete Phase 1, Phase 2, and Phase 3 (US1) first. This delivers the CRM-standard Projects table with search, filters, reset, and visible project view actions; the dedicated details route is delivered in US2.

### Incremental Delivery

1. Deliver US1 so users can find projects consistently.
2. Deliver US2 so the details page becomes the operational home with financial summary, manual payments, and activity timeline.
3. Deliver US5 so proposal documents and revision comparison are correct on details.
4. Deliver US3 so project data can be edited in place.
5. Deliver US4 so proposal revision access moves fully into project details.

### Quality Gates

- Tests for a user story should be completed before or alongside implementation.
- Models come before repositories and workflow services.
- Workflow services come before UI workflows.
- Schema changes require both executable migrations and declarative schema files.
- Security/privacy review must complete before final handoff.

## Notes

- [P] tasks must touch different files or have no dependency conflict.
- Each user story remains independently completable and testable after foundational work.
- Avoid public website edits, client portal edits, service-role secret exposure, and payment-provider implementation work.
- Never change a Supabase table schema without a matching executable SQL migration in `supabase/migrations/`.
- Never create or use an `_shared` edge-function directory, local shared edge-function module, or import between Supabase Edge Functions.
- AI agents must never run `git commit`, `git push`, or commit/push-capable automation; include source-control handoff notes for the human operator.
