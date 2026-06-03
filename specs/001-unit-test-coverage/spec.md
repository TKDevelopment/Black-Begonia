# Feature Specification: Unit Test Coverage

**Feature Branch**: `001-unit-test-coverage`

**Created**: 2026-06-02

**Status**: Draft

**Input**: User description: "Build comprehensive unit tests throughout the project to cover at least 80% of the codebase. Validate the inquiry workflow, lead generation workflow, proposal building workflow, and related frontend workflows across all three applicable environments. Reuse existing spec files for components, services, guards, and similar units where present. Require unit test cases for all code moving forward."

**Latest Scope Update**: 2026-06-02 coverage gap analysis added follow-up scope for repository tests, CRM contacts/organizations/tasks page tests, CRM modal tests, proposal template renderer/studio tests, lead detail/proposal builder branch expansion, and public auth/portfolio page tests. Current measured coverage is 63.29% statements, 40.08% branches, 63.58% functions, and 64.81% lines; branch coverage is the largest gap to the 80% target.

## Clarifications

### Session 2026-06-02

- Q: Should the 80% coverage target apply only to the aggregate frontend codebase, to every eligible file, or also to each critical workflow area? -> A: 80% aggregate coverage plus 80% minimum for each critical workflow area.
- Q: Which workflow areas count as critical for the per-area 80% coverage target? -> A: Inquiry, lead generation/CRM, proposal building/review, and authorization/access.
- Coverage update: The latest report shows 63.29% statements (3154/4983), 40.08% branches (1203/3001), 63.58% functions (716/1126), and 64.81% lines (3037/4686). Reaching 80% requires roughly 833 additional covered statements, 1,198 additional covered branches, 185 additional covered functions, and 712 additional covered lines. Follow-up work must prioritize branch-heavy gaps first.

## User Scenarios & Testing *(mandatory)*

User stories are prioritized as independently testable journeys. P1 is the most critical.

### User Story 1 - Establish Project-Wide Unit Test Confidence (Priority: P1)

As the product owner, I want the frontend codebase to have meaningful unit test coverage across public, private, shared, routing, guard, service, and workflow code so that future changes can be delivered with lower regression risk.

**Why this priority**: Broad, reliable coverage is the foundation for validating every user-facing workflow and for making future development safer.

**Independent Test**: Review the project coverage report and confirm that total statement, branch, function, and line coverage meet the agreed minimum, with critical workflows represented by behavioral assertions rather than only creation tests.

**Acceptance Scenarios**:

1. **Given** the application has existing units with and without spec files, **When** the unit test suite is expanded, **Then** each eligible unit has a corresponding test file or documented exclusion.
2. **Given** the complete frontend unit suite runs, **When** coverage is measured, **Then** overall coverage is at least 80% for statements, branches, functions, and lines, and each critical workflow area also meets at least 80%.
3. **Given** a unit already has a spec file, **When** new coverage is added for that unit, **Then** the existing file is extended instead of creating duplicate or competing test files.

---

### User Story 2 - Validate Inquiry and Lead Generation Journeys (Priority: P1)

As a business operator, I want the inquiry and lead generation workflows tested from form entry through lead creation, conversion, decline, status updates, and visible CRM states so that client requests are not lost or mishandled.

**Why this priority**: Inquiry capture and lead handling are central revenue workflows, and failures directly affect client response and booking opportunities.

**Independent Test**: Execute focused unit tests for public inquiry experiences, lead workflow services, lead conversion behavior, lead status handling, and CRM lead detail states using controlled inputs and mocked dependencies.

**Acceptance Scenarios**:

1. **Given** a visitor submits a complete inquiry, **When** the workflow processes the submission, **Then** the expected lead-facing data, success state, and notification behavior are validated.
2. **Given** a visitor submits incomplete or invalid inquiry information, **When** validation runs, **Then** submission is blocked and actionable validation feedback is represented in tests.
3. **Given** an operator converts, declines, or updates a lead, **When** the lead workflow completes successfully or fails, **Then** the CRM state, activity behavior, and user feedback paths are tested.

---

### User Story 3 - Validate Proposal Building and Review Journeys (Priority: P1)

As a business operator, I want proposal building, template preparation, proposal access, and proposal review behavior tested so that proposal data, pricing, client access, and review outcomes remain trustworthy.

**Why this priority**: Proposal workflows connect sales, client review, and future invoice or payment activity; regressions could disrupt bookings and client trust.

**Independent Test**: Execute focused unit tests for proposal builder calculations, proposal workflow state changes, template document behavior, client access validation, review states, and error handling using representative proposal payloads.

**Acceptance Scenarios**:

1. **Given** an operator builds proposal line items and components, **When** totals, shopping lists, and render payloads are produced, **Then** calculations and derived data are validated against expected results.
2. **Given** proposal template content is drafted, imported, saved, or published, **When** the workflow accepts or rejects changes, **Then** validation, persistence intent, and user feedback paths are covered.
3. **Given** a client accesses a proposal review route, **When** access is valid, expired, invalid, accepted, or declined, **Then** the resulting route behavior and review states are tested.

---

### User Story 4 - Validate Environment-Specific Frontend Behavior (Priority: P2)

As a release owner, I want applicable unit tests to account for the supported default, development, and production runtime contexts so that environment-dependent frontend behavior remains predictable before release.

**Why this priority**: Environment-specific configuration can affect integrations, routing assumptions, and safety checks, but it supports rather than replaces workflow-level coverage.

**Independent Test**: Review tests for configuration-dependent services and behaviors, confirming that each applicable runtime context is represented where behavior changes by environment.

**Acceptance Scenarios**:

1. **Given** a frontend unit reads runtime configuration, **When** behavior differs across supported contexts, **Then** tests cover each applicable context.
2. **Given** a behavior is identical across supported contexts, **When** tests are reviewed, **Then** the shared behavior is tested once with no artificial environment duplication.

---

### User Story 5 - Enforce Testing for Future Code (Priority: P2)

As a development team member, I want new frontend code to include meaningful unit tests as part of the normal delivery expectation so that coverage does not decay after this feature is completed.

**Why this priority**: The initial coverage push only stays valuable if new code keeps the same standard.

**Independent Test**: Review future feature changes and confirm that new or changed components, services, guards, models, and workflow logic include unit tests or a documented reason for exclusion.

**Acceptance Scenarios**:

1. **Given** new frontend behavior is introduced, **When** the change is prepared for review, **Then** the related unit test coverage is included with the change.
2. **Given** code is excluded from unit testing, **When** the exclusion is reviewed, **Then** the reason is explicit and limited to cases where unit testing is not practical or useful.

---

### User Story 6 - Close Remaining Coverage Gaps by Risk and Impact (Priority: P1)

As the product owner, I want the remaining low-coverage areas prioritized by workflow risk and branch impact so that the next testing pass moves the application materially closer to the 80% target instead of spreading effort thinly.

**Why this priority**: The latest report shows branch coverage is far behind the target, and the largest gaps sit in data access, CRM operations, proposal template behavior, and public access flows that support important business workflows.

**Independent Test**: Review the follow-up coverage backlog and confirm that the highest-impact uncovered areas have targeted tests or documented exclusions, with branch-heavy success, empty, validation, cancellation, and failure paths represented.

**Acceptance Scenarios**:

1. **Given** repository behavior remains under-covered, **When** follow-up tests are added, **Then** query intent, successful results, empty results, mutation payloads, and service failure paths are validated for the prioritized data-access units.
2. **Given** CRM contacts, organizations, and tasks pages are shallowly covered, **When** follow-up tests are added, **Then** loading, empty, search, filter, create, edit, delete, linked-record, feedback, and repository-failure paths are represented.
3. **Given** CRM and proposal-template modals contain create and edit decision paths, **When** follow-up tests are added, **Then** hydration, required-field validation, normalized save payloads, close guards, save guards, and emitted outcomes are covered.
4. **Given** proposal template rendering and studio workflows have major coverage gaps, **When** follow-up tests are added, **Then** template node rendering, unsafe or missing content handling, layout behavior, preset selection, save, publish, validation, and error states are represented.
5. **Given** lead detail, proposal builder, auth, and portfolio pages already have partial tests, **When** follow-up tests are added, **Then** remaining conditional states, alternate statuses, helper edge cases, empty linked data, navigation, session failures, gallery states, cancellation, deletion, and failure branches are covered.

### Edge Cases

- Existing spec files may only verify that a component or service can be created; those tests must be expanded when the unit contains meaningful behavior.
- Some files may be type-only definitions, configuration constants, generated output, or bootstrap wiring; those files may be excluded from the coverage target only when the exclusion is documented.
- Workflow tests must cover success, validation failure, dependency failure, empty state, loading state, and permission or access denial where those paths exist.
- Tests must avoid relying on live external services, real customer data, real email delivery, or production-only credentials.
- Large UI units with many responsibilities may need focused coverage around observable behavior before deeper refactoring is considered.
- Remaining branch gaps may be hidden behind alternate statuses, nullable linked data, optional form fields, cancellation paths, delete confirmation paths, failed lookups, and missing related records; follow-up tests must exercise those paths where they exist.
- Missing colocated test files must be created for eligible executable units or recorded as documented exclusions when a file is not meaningful to unit test.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST have unit test coverage of at least 80% for statements, branches, functions, and lines across eligible frontend code.
- **FR-001a**: Each critical workflow area MUST also meet at least 80% coverage for statements, branches, functions, and lines.
- **FR-001b**: Critical workflow areas MUST include inquiry, lead generation/CRM, proposal building/review, and authorization/access.
- **FR-002**: Each eligible component, service, guard, layout, workflow helper, and shared UI unit MUST have a corresponding unit test file or a documented exclusion.
- **FR-003**: Existing test files MUST be reused and expanded for units that already have them.
- **FR-004**: Unit tests MUST validate public inquiry workflows, including form validation, submission success, submission failure, and user-facing outcomes.
- **FR-005**: Unit tests MUST validate lead generation and CRM lead workflows, including lead creation, conversion, decline, status changes, activity behavior, and error handling.
- **FR-006**: Unit tests MUST validate proposal building workflows, including line item behavior, component data, totals, shopping list generation, render-ready proposal data, save or submit outcomes, and error handling.
- **FR-007**: Unit tests MUST validate proposal template and proposal review workflows where they affect proposal creation, publishing, client access, acceptance, decline, or review state.
- **FR-008**: Unit tests MUST validate authentication, authorization, and route guard behavior for public, private, admin, guest, and proposal access paths.
- **FR-009**: Unit tests MUST cover default, development, and production runtime contexts wherever frontend behavior changes by context.
- **FR-010**: Tests MUST use controlled test doubles for external services, storage, authentication, messaging, and remote data access.
- **FR-011**: Coverage reporting MUST identify remaining gaps by file or workflow so that uncovered critical behavior can be prioritized.
- **FR-012**: New or changed frontend code moving forward MUST include meaningful unit tests with the same change unless a reviewed exclusion is documented.
- **FR-013**: Tests MUST protect customer-facing and operator-facing feedback states, including loading, empty, success, validation error, service error, and permission error states.
- **FR-014**: The unit test suite MUST be runnable by the development team in a repeatable way and produce a clear pass/fail result plus coverage output.
- **FR-015**: Follow-up coverage work MUST prioritize branch coverage because the latest report shows branches at 40.08%, which is the largest deficit from the 80% target.
- **FR-016**: Repository follow-up tests MUST cover the prioritized data-access backlog, including lead inspiration URLs, document templates, tasks, contacts, organizations, activities, catalog items, tax regions, and activity logs.
- **FR-017**: Repository follow-up tests MUST validate query intent, successful result normalization, empty results, create/update/delete payload intent where applicable, and remote service error handling.
- **FR-018**: CRM page follow-up tests MUST cover contacts, organizations, and tasks page behavior for initial load, loading state, error state, empty state, search/filter behavior, create/edit/delete flows, linked project/contact/organization behavior, user feedback, and repository failures.
- **FR-019**: CRM modal follow-up tests MUST cover contact, organization, task, project-link, and proposal-template modal behavior for create/edit hydration, required-field validation, payload normalization, close/save guards, and emitted outcomes.
- **FR-020**: Proposal template follow-up tests MUST cover rendering and studio workflows for text, image, table, section, escaping or unsafe content handling, missing assets, page layout, preset selection, load, save, publish, validation, and error states.
- **FR-021**: Existing lead detail and proposal builder tests MUST be expanded to cover remaining branch-heavy conditional UI states, alternate proposal statuses, failure paths, date or formatting helpers, empty linked data, cancellation paths, and delete paths.
- **FR-022**: Public authentication and portfolio follow-up tests MUST cover form validation, authentication errors, session failures, navigation outcomes, loading states, empty gallery states, and failed gallery fetches.
- **FR-023**: Eligible executable files identified as missing colocated specs MUST receive colocated tests or a documented exclusion before this feature is considered complete.

### Constitution Alignment *(mandatory)*

- **Surface**: This feature affects cross-cutting frontend code across the public website, CRM admin portal, proposal access experience, shared UI, route guards, and frontend service layers. It does not intentionally change public content, styling, SEO, or routing behavior.
- **Product Owner Approval**: Product owner approval is required before implementation only if test work reveals a need to change public behavior, form copy, routing, styling, or user-facing content.
- **Brownfield Preservation**: Existing inquiry, lead, proposal, authentication, CRM, and public website workflows must be preserved. This feature authorizes test additions and minimal testability fixes only; broad workflow refactors or removals are out of scope unless separately approved.
- **Supabase Security**: Tests that touch data access behavior must validate access expectations through mocks or controlled test doubles. They must not use live production data, production credentials, or policy changes as part of unit testing.
- **Testing Expectations**: The feature establishes an 80% minimum unit coverage target and requires focused checks for proposal, lead, inquiry, and authorization workflows.
- **Sensitive Data**: Tests must use synthetic customer names, emails, passcodes, proposal data, signatures, document references, and payment-adjacent records. Secrets and real customer records must not appear in fixtures.
- **Proposal Workflow**: Proposal tests must preserve the proposal builder, template publishing, client access, manual document handling, review response, invoice/planning continuity, and future payment or reporting data expectations.

### Key Entities *(include if feature involves data)*

- **Test Coverage Baseline**: The measured current coverage level for eligible frontend code before new tests are added.
- **Coverage Gap Backlog**: The prioritized list of under-covered units and workflows identified from the latest coverage report, used to direct follow-up tests toward the largest coverage and regression-risk gaps.
- **Branch Coverage Target**: The requirement that decision paths, conditional states, alternate statuses, error outcomes, and null or empty data paths move from the latest 40.08% baseline toward the 80% minimum.
- **Eligible Frontend Unit**: A component, service, guard, layout, helper, shared UI unit, or workflow unit that contains executable frontend behavior and should be covered by unit tests.
- **Documented Exclusion**: A recorded reason that a file is excluded from the unit coverage expectation because it is generated, type-only, bootstrap-only, configuration-only, or otherwise not meaningful to unit test.
- **Critical Workflow**: A user or operator journey whose failure could block inquiry capture, lead handling, proposal creation, proposal review, authentication, or protected CRM access. For this feature, critical workflow areas are inquiry, lead generation/CRM, proposal building/review, and authorization/access.
- **Synthetic Fixture Data**: Non-production data used to represent customers, leads, proposals, contacts, organizations, projects, and tasks in tests.
- **Repository Test Target**: A prioritized data-access unit requiring coverage for query intent, normalized results, empty results, mutation intent, and remote service failures.
- **CRM Workflow Test Target**: A contacts, organizations, tasks, or modal workflow requiring coverage for operator-visible state transitions, validation, linked records, feedback, and failure handling.
- **Proposal Template Test Target**: A renderer, studio, or template modal workflow requiring coverage for template structure, content safety, layout, persistence intent, publishing, validation, and failure handling.

### Follow-Up Coverage Gap Backlog

- **Supabase repositories**: Prioritize lead inspiration URL, document template, task, contact, organization, activity, catalog item, tax region, and activity log repository behavior. This area is currently the largest uncovered bucket at 37.2% statements and 22.92% branches.
- **Private CRM pages**: Prioritize contacts (25.12%), organizations (25%), and tasks (29.41%) page behavior because these are large, user-facing workflows with shallow coverage.
- **CRM modals**: Prioritize contact upsert, contact project link, organization upsert, organization project link, task upsert, and proposal template upsert modal behavior.
- **Proposal template rendering and studio**: Prioritize proposal template scene rendering (0.8%), proposal template upsert modal (26.19%), and the missing proposal template studio tests.
- **Lead detail and proposal builder expansion**: Expand partial tests for lead detail (60.3% statements, 36.84% branches) and floral proposal builder (68.49% statements, 45.74% branches).
- **Public auth and portfolio pages**: Prioritize portfolio detail (30.37%), portfolio (57.14%), login (40.74%), password recovery (34.61%), and change password (44.44%) paths.
- **Missing colocated specs**: Create tests or document exclusions for catalog items, catalog item upsert modal, tax regions, tax region upsert modal, proposal template studio, proposal template upsert modal, proposal template canvas behavior, proposal template scene rendering, and the prioritized repository/service files.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The complete frontend unit test suite reports at least 80% coverage for statements, branches, functions, and lines overall and for each critical workflow area.
- **SC-002**: 100% of identified critical inquiry, lead generation/CRM, proposal building/review, and authorization/access workflows have explicit unit test coverage for success and failure paths.
- **SC-003**: At least 95% of eligible frontend units have a corresponding unit test file or a documented exclusion.
- **SC-004**: The unit test suite can be run repeatedly by the development team with a clear pass/fail result and coverage report in under 10 minutes on a typical development machine.
- **SC-005**: No unit test depends on live production services, real customer data, production credentials, or external network availability.
- **SC-006**: Future frontend changes include related unit tests or a documented exclusion before they are considered ready for review.
- **SC-007**: Follow-up tests close the latest measured gap from 63.29% statements, 40.08% branches, 63.58% functions, and 64.81% lines toward at least 80% in each metric, with branch coverage receiving the highest priority.
- **SC-008**: The prioritized coverage gap backlog is fully resolved through added tests or documented exclusions for every listed high-impact area.
- **SC-009**: Coverage reporting after the follow-up work shows meaningful improvement in the repository, CRM page, CRM modal, proposal template, lead detail, proposal builder, auth, and portfolio areas identified by the latest analysis.

## Assumptions

- The primary users of this feature are the product owner, developers, and release owner responsible for confidence in frontend changes.
- The coverage target applies to eligible frontend application code and excludes generated files, type-only definitions, static environment constants, and bootstrap-only wiring when documented.
- Existing business behavior should remain unchanged unless a test reveals an already-existing defect that the product owner approves for correction.
- Existing project test tooling and conventions will be used during implementation.
- Default, development, and production runtime contexts refer to the three supported frontend environment configurations currently maintained by the project.
