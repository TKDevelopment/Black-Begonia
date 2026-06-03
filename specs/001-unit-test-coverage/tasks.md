# Tasks: Unit Test Coverage

**Input**: Design documents from `/specs/001-unit-test-coverage/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/coverage-report-contract.md](./contracts/coverage-report-contract.md), [quickstart.md](./quickstart.md)

**Tests**: Tests are required by the feature. Use Karma/Jasmine and colocated `.spec.ts` files.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the coverage baseline, workflow inventory, and reporting structure that all stories depend on.

- [X] T001 Confirm cross-cutting affected surface and no public behavior approval requirement in specs/001-unit-test-coverage/plan.md
- [X] T002 Run baseline coverage command and save summary notes in specs/001-unit-test-coverage/coverage-baseline.md
- [X] T003 [P] Inventory eligible frontend units under src/app in specs/001-unit-test-coverage/coverage-manifest.md
- [X] T004 [P] Inventory existing spec files and creation-only specs under src/app in specs/001-unit-test-coverage/coverage-manifest.md
- [X] T005 [P] Map critical workflow files to inquiry, lead generation/CRM, proposal building/review, and authorization/access buckets in specs/001-unit-test-coverage/coverage-manifest.md
- [X] T006 Add documented exclusion format and initial generated/type-only/static/bootstrap candidates in specs/001-unit-test-coverage/coverage-manifest.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Make coverage measurable, repeatable, and safe before expanding story-specific tests.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T007 Configure Angular/Karma coverage to include eligible untested source files in angular.json
- [X] T008 Update test TypeScript inclusion strategy for eligible source visibility in tsconfig.spec.json
- [X] T009 Add repeatable coverage script or document equivalent command in package.json
- [X] T010 [P] Create shared synthetic lead, inquiry, proposal, auth, and route fixtures in src/app/core/testing/workflow-fixtures.ts
- [X] T011 [P] Create reusable Supabase repository/client test doubles in src/app/core/testing/supabase-testing.ts
- [X] T012 [P] Create reusable Router, ActivatedRoute, and guard test helpers in src/app/core/testing/router-testing.ts
- [X] T013 Create coverage bucket verification helper or documentation in specs/001-unit-test-coverage/coverage-manifest.md
- [X] T014 Run `npm run test -- --watch=false --browsers=ChromeHeadless --code-coverage` and record foundation issues in specs/001-unit-test-coverage/coverage-baseline.md

**Checkpoint**: Coverage reporting is repeatable and exposes eligible source gaps.

---

## Phase 3: User Story 1 - Establish Project-Wide Unit Test Confidence (Priority: P1)

**Goal**: Reach a reliable project-wide testing baseline by expanding missing and shallow specs across eligible frontend code.

**Independent Test**: Run the headless coverage command and verify overall statements, branches, functions, and lines are at least 80%, with 95% of eligible units having a spec or documented exclusion.

### Tests for User Story 1

- [X] T015 [P] [US1] Expand app shell behavioral tests in src/app/app.component.spec.ts
- [X] T016 [P] [US1] Expand public layout tests in src/app/core/layouts/public-layout/public-layout.component.spec.ts
- [X] T017 [P] [US1] Expand private layout tests in src/app/core/layouts/private-layout/private-layout.component.spec.ts
- [X] T018 [P] [US1] Expand shared public header/footer tests in src/app/shared/components/public/header/header.component.spec.ts and src/app/shared/components/public/footer/footer.component.spec.ts
- [X] T019 [P] [US1] Expand shared private shell component tests in src/app/shared/components/private/entity-table-shell/entity-table-shell.component.spec.ts
- [X] T020 [P] [US1] Expand shared feedback state component tests in src/app/shared/components/private/loading-state-block/loading-state-block.component.spec.ts and src/app/shared/components/private/error-state-block/error-state-block.component.spec.ts
- [X] T021 [P] [US1] Add or expand toast behavior tests in src/app/core/services/toast.service.spec.ts and src/app/shared/components/toast/toast.component.spec.ts

### Implementation for User Story 1

- [X] T022 [US1] Review all src/app/**/*.spec.ts files and mark creation-only specs in specs/001-unit-test-coverage/coverage-manifest.md
- [X] T023 [US1] Add missing colocated specs for eligible shared/private UI units listed in specs/001-unit-test-coverage/coverage-manifest.md
- [X] T024 [US1] Add missing colocated specs for eligible public route components listed in specs/001-unit-test-coverage/coverage-manifest.md
- [X] T025 [US1] Update documented exclusions in specs/001-unit-test-coverage/coverage-manifest.md with path, reason, and notes
- [X] T026 [US1] Run final US1 coverage command and record overall coverage plus eligible-unit ratio in specs/001-unit-test-coverage/coverage-baseline.md

**Checkpoint**: Overall coverage and eligible-unit evidence can be validated independently of workflow-specific work.

---

## Phase 4: User Story 2 - Validate Inquiry and Lead Generation Journeys (Priority: P1)

**Goal**: Cover inquiry submission and lead generation/CRM behavior for success, validation failure, dependency failure, status changes, conversion, decline, activity behavior, and user feedback.

**Independent Test**: Run focused inquiry and lead specs plus coverage verification for inquiry and lead generation/CRM buckets.

### Tests for User Story 2

- [X] T027 [P] [US2] Expand inquiry service success and failure tests in src/app/core/supabase/services/inquiry.service.spec.ts
- [X] T028 [P] [US2] Expand general inquiry form validation and submission tests in src/app/components/public/general-inquiries/general-inquiries.component.spec.ts
- [X] T029 [P] [US2] Expand wedding inquiry form validation and submission tests in src/app/components/public/wedding-inquiries/wedding-inquiries.component.spec.ts
- [X] T030 [P] [US2] Expand inquiry routing and success-state tests in src/app/components/public/inquiries/inquiries.component.spec.ts and src/app/components/public/inquiries/inquiry-success/inquiry-success.component.spec.ts
- [X] T031 [P] [US2] Expand lead workflow success, validation, and repository failure tests in src/app/core/supabase/services/lead-workflow.service.spec.ts
- [X] T032 [P] [US2] Expand lead conversion success and failure tests in src/app/core/supabase/services/lead-conversion.service.spec.ts
- [X] T033 [P] [US2] Expand lead repository query and mutation tests in src/app/core/supabase/repositories/lead-repository.service.spec.ts
- [X] T034 [P] [US2] Expand lead list and loading/error/empty state tests in src/app/components/private/leads/leads.component.spec.ts
- [X] T035 [P] [US2] Expand lead detail workflow tests in src/app/components/private/leads/lead-detail/lead-detail.component.spec.ts
- [X] T036 [P] [US2] Expand lead modal and status component tests in src/app/components/private/leads/components/lead-convert-modal/lead-convert-modal.component.spec.ts, src/app/components/private/leads/components/lead-decline-modal/lead-decline-modal.component.spec.ts, and src/app/components/private/leads/components/lead-status-selector/lead-status-selector.component.spec.ts

### Implementation for User Story 2

- [X] T037 [US2] Add missing specs for lead upsert, lead note, and lead proposal history components in src/app/components/private/leads/components/lead-upsert-modal/lead-upsert-modal.component.spec.ts, src/app/components/private/leads/components/lead-note-modal/lead-note-modal.component.spec.ts, and src/app/components/private/leads/components/lead-proposal-history-card/lead-proposal-history-card.component.spec.ts
- [X] T038 [US2] Add or expand synthetic lead and inquiry fixtures in src/app/core/testing/workflow-fixtures.ts
- [X] T039 [US2] Update inquiry and lead workflow bucket evidence in specs/001-unit-test-coverage/coverage-manifest.md
- [X] T040 [US2] Run focused inquiry and lead specs with coverage and record bucket results in specs/001-unit-test-coverage/coverage-baseline.md

**Checkpoint**: Inquiry and lead generation/CRM buckets meet the 80% per-area target with success and failure path assertions.

---

## Phase 5: User Story 3 - Validate Proposal Building and Review Journeys (Priority: P1)

**Goal**: Cover proposal builder calculations, proposal workflow state, client access, review outcomes, persistence intent, and error handling.

**Independent Test**: Run focused proposal specs plus coverage verification for the proposal building/review bucket.

### Tests for User Story 3

- [X] T041 [P] [US3] Add proposal builder service tests in src/app/core/supabase/services/floral-proposal-builder.service.spec.ts
- [X] T042 [P] [US3] Add proposal workflow service tests in src/app/core/supabase/services/floral-proposal-workflow.service.spec.ts
- [X] T043 [P] [US3] Add proposal renderer service tests in src/app/core/supabase/services/floral-proposal-renderer.service.spec.ts
- [X] T044 [P] [US3] Add floral proposal repository tests in src/app/core/supabase/repositories/floral-proposal-repository.service.spec.ts
- [X] T047 [P] [US3] Add proposal access service tests in src/app/core/proposal-access/proposal-access.service.spec.ts
- [X] T048 [P] [US3] Add proposal auth component tests in src/app/components/proposal-access/proposal-auth/proposal-auth.component.spec.ts
- [X] T049 [P] [US3] Add proposal review component tests in src/app/components/proposal-access/proposal-review/proposal-review.component.spec.ts
- [X] T050 [P] [US3] Add floral proposal builder component tests in src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts

### Implementation for User Story 3

- [X] T052 [US3] Add or expand synthetic proposal fixtures in src/app/core/testing/workflow-fixtures.ts
- [X] T053 [US3] Add Canva, storage, and browser popup test doubles in src/app/core/testing/proposal-testing.ts
- [X] T054 [US3] Update proposal building/review workflow bucket evidence in specs/001-unit-test-coverage/coverage-manifest.md
- [X] T055 [US3] Run focused proposal specs with coverage and record bucket results in specs/001-unit-test-coverage/coverage-baseline.md

**Checkpoint**: Proposal building/review bucket meets the 80% per-area target with calculation, access, review, and dependency failure assertions.

---

## Phase 6: User Story 4 - Validate Environment-Specific Frontend Behavior (Priority: P2)

**Goal**: Cover behavior that changes across default, development, and production environment configurations without duplicating identical behavior.

**Independent Test**: Run environment-dependent specs and verify all applicable environment contexts are represented.

### Tests for User Story 4

- [X] T056 [P] [US4] Expand Supabase environment validation tests in src/app/core/supabase/clients/supabase.service.spec.ts
- [X] T057 [P] [US4] Add environment configuration tests in src/environments/environment.spec.ts
- [X] T058 [P] [US4] Add environment dev configuration tests in src/environments/environment.dev.spec.ts
- [X] T059 [P] [US4] Add environment prod configuration tests in src/environments/environment.prod.spec.ts

### Implementation for User Story 4

- [X] T060 [US4] Document which runtime behaviors differ by environment in specs/001-unit-test-coverage/coverage-manifest.md
- [X] T061 [US4] Run focused environment specs with coverage and record results in specs/001-unit-test-coverage/coverage-baseline.md

**Checkpoint**: Environment-specific behavior is covered where applicable and no artificial duplication is required for identical behavior.

---

## Phase 7: User Story 5 - Enforce Testing for Future Code (Priority: P2)

**Goal**: Preserve the coverage standard for future frontend changes through documented expectations and repeatable verification.

**Independent Test**: Review project guidance and coverage contract, then confirm future changes have a clear test or exclusion requirement.

### Tests for User Story 5

- [X] T062 [P] [US5] Expand auth service behavior tests in src/app/core/auth/auth.service.spec.ts
- [X] T063 [P] [US5] Expand auth guard tests in src/app/core/guards/auth.guard.spec.ts
- [X] T064 [P] [US5] Expand guest guard tests in src/app/core/guards/guest.guard.spec.ts
- [X] T065 [P] [US5] Expand admin role guard tests in src/app/core/guards/admin-role.guard.spec.ts
- [X] T066 [P] [US5] Add proposal access guard tests in src/app/core/guards/proposal-access.guard.spec.ts

### Implementation for User Story 5

- [X] T067 [US5] Add future-code unit test expectations to README.md
- [X] T068 [US5] Add coverage gate documentation to specs/001-unit-test-coverage/contracts/coverage-report-contract.md
- [X] T069 [US5] Update authorization/access workflow bucket evidence in specs/001-unit-test-coverage/coverage-manifest.md
- [X] T070 [US5] Run focused authorization specs with coverage and record bucket results in specs/001-unit-test-coverage/coverage-baseline.md

**Checkpoint**: Authorization/access bucket meets the 80% per-area target and future code test expectations are documented.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, cleanup, and acceptance evidence across all stories.

- [X] T071 [P] Update quickstart verification notes in specs/001-unit-test-coverage/quickstart.md
- [X] T072 [P] Normalize repeated fixtures and mocks across src/app/core/testing
- [X] T073 Remove obsolete skipped or duplicate tests from src/app/**/*.spec.ts
- [X] T074 Verify no tests depend on live Supabase, Mailgun, Canva, storage, browser popup, production credentials, or real customer data in src/app/**/*.spec.ts
- [X] T075 Run `npm run test -- --watch=false --browsers=ChromeHeadless --code-coverage` and save final coverage evidence in specs/001-unit-test-coverage/coverage-baseline.md
- [X] T076 Verify overall 80% coverage and per-critical-workflow 80% coverage against specs/001-unit-test-coverage/contracts/coverage-report-contract.md
- [X] T077 Verify at least 95% of eligible frontend units have a spec or documented exclusion in specs/001-unit-test-coverage/coverage-manifest.md
- [X] T078 Verify public website routes, content, styling, SEO metadata, Supabase schemas, RLS policies, storage policies, and edge functions remain unchanged unless separately approved

---

## Phase 9: User Story 6 - Close Remaining Coverage Gaps by Risk and Impact (Priority: P1)

**Goal**: Resolve the latest branch-heavy coverage backlog so coverage moves from 63.29% statements, 40.08% branches, 63.58% functions, and 64.81% lines toward the 80% target.

**Independent Test**: Run `npm run test:coverage` and verify the prioritized coverage gap backlog in specs/001-unit-test-coverage/coverage-manifest.md is resolved by behavioral tests or documented exclusions, with branch coverage materially improved from the 40.08% baseline.

### Tests for User Story 6

- [X] T079 [P] [US6] Add lead inspiration URL repository query, empty-result, create/delete payload, and Supabase error tests in src/app/core/supabase/repositories/lead-inspiration-url-repository.service.spec.ts
- [X] T081 [P] [US6] Expand task repository query, mutation, empty-result, and Supabase error tests in src/app/core/supabase/repositories/task-repository.service.spec.ts
- [X] T082 [P] [US6] Expand contact repository query, mutation, empty-result, and Supabase error tests in src/app/core/supabase/repositories/contact-repository.service.spec.ts
- [X] T083 [P] [US6] Expand organization repository query, mutation, empty-result, and Supabase error tests in src/app/core/supabase/repositories/organization-repository.service.spec.ts
- [X] T084 [P] [US6] Expand activity repository query, create payload, empty-result, and Supabase error tests in src/app/core/supabase/repositories/activity-repository.service.spec.ts
- [X] T085 [P] [US6] Add catalog item repository query, create/update/delete payload, empty-result, and Supabase error tests in src/app/core/supabase/repositories/catalog-item-repository.service.spec.ts
- [X] T086 [P] [US6] Add tax region repository query, create/update/delete payload, empty-result, and Supabase error tests in src/app/core/supabase/repositories/tax-region-repository.service.spec.ts
- [X] T087 [P] [US6] Add activity log repository query, create payload, empty-result, and Supabase error tests in src/app/core/supabase/repositories/activity-log-repository.service.spec.ts
- [X] T088 [P] [US6] Expand contacts page load, loading, empty, search/filter, create/edit/delete, linked-project, toast, and repository failure tests in src/app/components/private/contacts/contacts.component.spec.ts
- [X] T089 [P] [US6] Expand organizations page load, loading, empty, search/filter, create/edit/delete, linked-project, toast, and repository failure tests in src/app/components/private/organizations/organizations.component.spec.ts
- [X] T090 [P] [US6] Expand tasks page load, loading, empty, search/filter, create/edit/delete, linked-contact/organization/project, toast, and repository failure tests in src/app/components/private/tasks/tasks.component.spec.ts
- [X] T091 [P] [US6] Add contact upsert modal create/edit hydration, validation, payload normalization, close guard, save guard, and emit tests in src/app/components/private/contacts/components/contact-upsert-modal/contact-upsert-modal.component.spec.ts
- [X] T092 [P] [US6] Add contact project link modal hydration, validation, linked project selection, close guard, save guard, and emit tests in src/app/components/private/contacts/components/contact-project-link-modal/contact-project-link-modal.component.spec.ts
- [X] T093 [P] [US6] Add organization upsert modal create/edit hydration, validation, payload normalization, close guard, save guard, and emit tests in src/app/components/private/organizations/components/organization-upsert-modal/organization-upsert-modal.component.spec.ts
- [X] T094 [P] [US6] Add organization project link modal hydration, validation, linked project selection, close guard, save guard, and emit tests in src/app/components/private/organizations/components/organization-project-link-modal/organization-project-link-modal.component.spec.ts
- [X] T095 [P] [US6] Add task upsert modal create/edit hydration, validation, linked contact/organization/project normalization, close guard, save guard, and emit tests in src/app/components/private/tasks/components/task-upsert-modal/task-upsert-modal.component.spec.ts
- [X] T100 [P] [US6] Expand lead detail branch tests for alternate proposal statuses, null linked data, date/format helper edges, cancel flows, delete branches, and repository failures in src/app/components/private/leads/lead-detail/lead-detail.component.spec.ts
- [X] T101 [P] [US6] Expand floral proposal builder branch tests for alternate proposal statuses, empty linked data, helper edge cases, cancel/delete branches, image failure paths, and proposal workflow failures in src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts
- [X] T102 [P] [US6] Expand portfolio detail loading, empty gallery, failed gallery fetch, navigation, and missing portfolio tests in src/app/components/public/portfolio-detail/portfolio-detail.component.spec.ts
- [X] T103 [P] [US6] Expand portfolio list loading, empty state, failed gallery fetch, filtering, and navigation tests in src/app/components/public/portfolio/portfolio.component.spec.ts
- [X] T104 [P] [US6] Expand login form validation, authentication errors, session failure, internal-user navigation, and non-internal denial tests in src/app/components/public/login/login.component.spec.ts
- [X] T105 [P] [US6] Expand password recovery validation, auth error, success feedback, and navigation tests in src/app/components/public/password-recovery/password-recovery.component.spec.ts
- [X] T106 [P] [US6] Expand change password validation, session failure, auth update error, success feedback, and navigation tests in src/app/components/public/change-password/change-password.component.spec.ts
- [X] T107 [P] [US6] Add catalog items page load, loading, empty, search/filter, create/edit/delete, toast, and repository failure tests in src/app/components/private/catalog-items/catalog-items.component.spec.ts
- [X] T108 [P] [US6] Add catalog item upsert modal create/edit hydration, validation, payload normalization, close guard, save guard, and emit tests in src/app/components/private/catalog-items/components/catalog-item-upsert-modal/catalog-item-upsert-modal.component.spec.ts
- [X] T109 [P] [US6] Add tax regions page load, loading, empty, create/edit/delete, toast, and repository failure tests in src/app/components/private/tax-regions/tax-regions.component.spec.ts
- [X] T110 [P] [US6] Add tax region upsert modal create/edit hydration, validation, payload normalization, close guard, save guard, and emit tests in src/app/components/private/tax-regions/components/tax-region-upsert-modal/tax-region-upsert-modal.component.spec.ts

### Implementation for User Story 6

- [X] T111 [US6] Add or expand CRM repository fixtures for contacts, organizations, tasks, activities, catalog items, tax regions, activity logs, document templates, and lead inspiration URLs in src/app/core/testing/workflow-fixtures.ts
- [X] T112 [US6] Add reusable Supabase query-chain helpers for select/single/maybeSingle/insert/update/delete/upsert repository branches in src/app/core/testing/supabase-testing.ts
- [X] T113 [US6] Add or expand CRM page test helpers for table loading, empty state, toast assertions, and modal event assertions in src/app/core/testing/crm-testing.ts
- [X] T115 [US6] Update specs/001-unit-test-coverage/coverage-manifest.md with resolution evidence for Supabase repository backlog items
- [X] T116 [US6] Update specs/001-unit-test-coverage/coverage-manifest.md with resolution evidence for CRM contacts, organizations, tasks, catalog items, and tax regions page backlog items
- [X] T117 [US6] Update specs/001-unit-test-coverage/coverage-manifest.md with resolution evidence for CRM modal backlog items
- [X] T119 [US6] Update specs/001-unit-test-coverage/coverage-manifest.md with resolution evidence for lead detail and floral proposal builder branch-expansion backlog items
- [X] T120 [US6] Update specs/001-unit-test-coverage/coverage-manifest.md with resolution evidence for public auth and portfolio backlog items
- [X] T121 [US6] Record any approved exclusions for remaining missing colocated specs in specs/001-unit-test-coverage/coverage-manifest.md
- [X] T122 [US6] Run focused repository specs with coverage and record results in specs/001-unit-test-coverage/coverage-baseline.md
- [X] T123 [US6] Run focused CRM contacts, organizations, tasks, catalog items, and tax regions specs with coverage and record results in specs/001-unit-test-coverage/coverage-baseline.md
- [X] T124 [US6] Run focused CRM modal specs with coverage and record results in specs/001-unit-test-coverage/coverage-baseline.md
- [X] T126 [US6] Run focused lead detail and floral proposal builder specs with coverage and record results in specs/001-unit-test-coverage/coverage-baseline.md
- [X] T127 [US6] Run focused public auth and portfolio specs with coverage and record results in specs/001-unit-test-coverage/coverage-baseline.md
- [X] T128 [US6] Run `npm run test:coverage` and record updated overall coverage in specs/001-unit-test-coverage/coverage-baseline.md
- [X] T129 [US6] Verify prioritized backlog resolution against specs/001-unit-test-coverage/contracts/coverage-report-contract.md and update specs/001-unit-test-coverage/coverage-manifest.md
- [X] T130 [US6] Verify no new tests use live Supabase, Mailgun, Canva, storage, browser popup, production credentials, service-role keys, or real customer data in src/app/**/*.spec.ts

**Checkpoint**: The latest coverage gap backlog is resolved by behavioral tests or documented exclusions, branch coverage is materially improved from 40.08%, and final evidence identifies remaining distance to the 80% target if any remains.

---

## Dependencies & Execution Order

- Phase 1 setup has no dependencies.
- Phase 2 foundational tasks depend on Phase 1 and block all user story phases.
- US1 establishes overall coverage confidence and should complete before polishing, but US2 and US3 may start after Phase 2 because their workflow files are mostly separate.
- US2 and US3 are both P1 critical workflow phases and may proceed in parallel after Phase 2.
- US4 depends on Phase 2 and can proceed after or alongside P1 workflow phases because it touches environment-specific files.
- US5 depends on Phase 2 and should finish before final acceptance so future-code expectations and authorization/access coverage are complete.
- US6 depends on Phase 2 and the latest coverage analysis in plan.md, data-model.md, quickstart.md, and coverage-baseline.md. It can proceed after the original story phases and should be prioritized before any additional polish because it targets the current 80% blockers.
- Phase 8 depends on all selected original user story phases. Phase 9 is the follow-up coverage-gap phase added after the latest analysis.

## Parallel Execution Examples

- **Setup**: T003, T004, and T005 can run in parallel because they update different sections of specs/001-unit-test-coverage/coverage-manifest.md if coordinated by section.
- **Foundation**: T010, T011, and T012 can run in parallel because they create separate helper files under src/app/core/testing.
- **US1**: T015 through T021 can run in parallel because they touch distinct spec files.
- **US2**: T027 through T036 can run in parallel across inquiry service, inquiry components, lead services, repositories, and lead UI specs.
- **US3**: T041 through T050 can run in parallel because each adds or expands a separate proposal spec file.
- **US4**: T056 through T059 can run in parallel across Supabase client and environment specs.
- **US5**: T062 through T066 can run in parallel across auth service and guard specs.
- **US6 repositories**: T079, T081 through T087 can run in parallel because each touches a separate repository spec file.
- **US6 CRM pages**: T088 through T090 and T107 through T110 can run in parallel because each touches a separate page or modal spec file.
- **US6 modals**: T091 through T095 can run in parallel because each touches a separate modal spec file.
- **US6 public pages**: T102 through T106 can run in parallel because each touches a separate public component spec file.

## Implementation Strategy

### MVP First

Complete Phase 1, Phase 2, and US1 to establish reliable coverage reporting, an eligible-unit manifest, documented exclusions, and project-wide coverage confidence.

### Critical Workflow Increment

Complete US2 and US3 next because inquiry, lead, and proposal behavior are the highest business-risk workflows.

### Release Hardening

Complete US4 and US5, then Phase 8 final verification to lock environment behavior, authorization/access coverage, future-code expectations, and final coverage evidence.

### Coverage Gap Follow-Up

Complete US6 after the latest coverage analysis to attack branch-heavy gaps first: repositories, CRM pages/modals, lead detail/proposal builder branches, and public auth/portfolio pages.

## Notes

- [P] tasks must touch different files or coordinated sections and must not depend on incomplete prior tasks.
- Every user story has an independent coverage checkpoint.
- Prefer behavioral assertions over creation-only tests.
- Keep tests deterministic with synthetic fixtures and typed test doubles.
- Do not change public behavior, Supabase policies, edge functions, routing, SEO, proposal delivery, or production data boundaries without separate approval.
