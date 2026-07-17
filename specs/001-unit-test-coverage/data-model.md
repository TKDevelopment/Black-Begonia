# Data Model: Unit Test Coverage

## Test Coverage Baseline

**Purpose**: Captures the current coverage and spec-file inventory before implementation starts.

**Fields**:

- `captured_at`: Date/time the baseline was generated.
- `total_source_files`: Count of frontend TypeScript files under scope.
- `existing_spec_files`: Count of colocated `.spec.ts` files.
- `overall_coverage`: Statement, branch, function, and line percentages.
- `workflow_coverage`: Coverage percentages by critical workflow area.
- `uncovered_eligible_units`: List of eligible units without meaningful tests.
- `documented_exclusions`: List of files excluded with reason.

**Validation Rules**:

- Must be based on the same coverage command used for final verification.
- Must distinguish missing coverage from documented exclusions.
- Must not include real customer data or production secrets.

**Latest Known Values**:

- `overall_coverage.statements`: 63.29% (3154/4983).
- `overall_coverage.branches`: 40.08% (1203/3001).
- `overall_coverage.functions`: 63.58% (716/1126).
- `overall_coverage.lines`: 64.81% (3037/4686).
- `target_gap.statements`: approximately 833 additional covered statements.
- `target_gap.branches`: approximately 1,198 additional covered branches.
- `target_gap.functions`: approximately 185 additional covered functions.
- `target_gap.lines`: approximately 712 additional covered lines.

## Eligible Frontend Unit

**Purpose**: Represents a frontend source unit that should be covered by unit tests.

**Fields**:

- `path`: Project-relative file path.
- `unit_type`: Component, service, repository, guard, layout, helper, model behavior, or shared UI.
- `surface`: Public website, proposal access/client portal, CRM admin, shared, or cross-cutting.
- `workflow_area`: Inquiry, lead generation/CRM, proposal building/review, authorization/access, or general frontend.
- `has_existing_spec`: Whether a colocated spec file already exists.
- `coverage_status`: Missing, creation-only, partial behavioral coverage, sufficient behavioral coverage, or excluded.
- `exclusion_reason`: Required when excluded.

**Validation Rules**:

- A unit with executable behavior must not be excluded merely because it is difficult to test.
- Existing specs that only assert creation should be marked creation-only until behavioral assertions are added.

## Critical Workflow Area

**Purpose**: Defines a business workflow bucket that must meet the per-area 80% coverage target.

**Fields**:

- `name`: Inquiry, lead generation/CRM, proposal building/review, or authorization/access.
- `included_units`: Eligible units assigned to the workflow.
- `required_paths`: User-facing and service-layer paths that must have success and failure coverage.
- `coverage_target`: 80% statements, branches, functions, and lines.
- `acceptance_status`: Not started, below target, target met, or approved exception.

**Validation Rules**:

- Each critical workflow area must include both UI-facing behavior and service/guard/workflow behavior where those layers exist.
- Success and failure paths must be represented before an area is considered complete.

## Coverage Gap Backlog Item

**Purpose**: Represents a high-impact uncovered unit or workflow group that should be converted into implementation tasks.

**Fields**:

- `name`: Human-readable target, such as Supabase repositories or CRM contacts page.
- `paths`: Project-relative files or component/service names included in the target.
- `surface`: Public website, proposal access/client portal, CRM admin, shared, or cross-cutting.
- `workflow_area`: Inquiry, lead generation/CRM, proposal building/review, authorization/access, or general frontend.
- `current_coverage`: Known statement and branch percentages when available.
- `priority_reason`: Branch deficit, workflow risk, missing colocated spec, low behavioral coverage, or failure-path gap.
- `required_behaviors`: Success, empty, validation, mutation, navigation, cancellation, delete, linked-record, or dependency-failure paths to cover.
- `status`: Not started, in progress, tested, or documented exclusion.

**Validation Rules**:

- Branch-heavy items should be sequenced before lower-risk statement-only gaps.
- Missing specs for eligible executable units must become tests or documented exclusions.
- Each backlog item must avoid live external services and production data.

## Prioritized Coverage Gap Backlog

### Supabase Repositories

**Current Coverage**: 37.2% statements and 22.92% branches for `app/core/supabase/repositories`.

**Paths**:

- `lead-inspiration-url-repository.service.ts`
- `document-template-repository.service.ts`
- `task-repository.service.ts`
- `contact-repository.service.ts`
- `organization-repository.service.ts`
- `activity-repository.service.ts`
- `catalog-item-repository.service.ts`
- `tax-region-repository.service.ts`
- `activity-log-repository.service.ts`

**Required Behaviors**: Query shape, success normalization, empty results, insert/update/delete payloads where applicable, and Supabase error handling.

### Private CRM Pages

**Current Coverage**:

- `contacts.component.ts`: 25.12%.
- `organizations.component.ts`: 25%.
- `tasks.component.ts`: 29.41%.

**Required Behaviors**: Initial load, loading/error/empty states, search/filter behavior, create/edit/delete flows, linked project/contact/organization behavior, user feedback, and repository failures.

### CRM Modals

**Targets**:

- `contact-upsert-modal`
- `contact-project-link-modal`
- `organization-upsert-modal`
- `organization-project-link-modal`
- `task-upsert-modal`
- `proposal-template-upsert-modal`

**Required Behaviors**: Create/edit hydration, required-field validation, payload normalization, close/save guards, and emitted outcomes.

### Proposal Template Rendering and Studio

**Current Coverage**:

- `proposal-template-scene-renderer.service.ts`: 0.8%.
- `proposal-template-upsert-modal`: 26.19%.
- `proposal-template-studio.component.ts`: missing colocated spec.

**Required Behaviors**: Renderer output for text/image/table/section nodes, escaping or unsafe content handling, missing assets, page layout, preset selection, studio load/save/publish flows, validation, and error states.

### Lead Detail and Proposal Builder Branch Expansion

**Current Coverage**:

- `lead-detail.component.ts`: 60.3% statements, 36.84% branches.
- `floral-proposal-builder.component.ts`: 68.49% statements, 45.74% branches.

**Required Behaviors**: Remaining conditional UI states, alternate proposal statuses, additional failure branches, edge date/format helpers, empty/null linked data, delete paths, and cancel paths.

### Public Auth and Portfolio Pages

**Current Coverage**:

- `portfolio-detail`: 30.37%.
- `portfolio`: 57.14%.
- `login`: 40.74%.
- `password-recovery`: 34.61%.
- `change-password`: 44.44%.

**Required Behaviors**: Form validation, auth errors, Supabase/session failures, navigation, loading states, empty gallery states, and failed gallery fetches.

### Missing Colocated Specs

**Targets**:

- `catalog-items.component.ts`
- `catalog-item-upsert-modal.component.ts`
- `tax-regions.component.ts`
- `tax-region-upsert-modal.component.ts`
- `proposal-template-studio.component.ts`
- `proposal-template-upsert-modal.component.ts`
- `proposal-template-canva.service.ts`
- `proposal-template-scene-renderer.service.ts`
- Prioritized repository/service files listed above.

**Required Behaviors**: Add colocated tests for executable behavior or record documented exclusions for files that are not meaningful to unit test.

## Documented Exclusion

**Purpose**: Records why a file or unit is outside the coverage target.

**Fields**:

- `path`: Project-relative path.
- `reason`: Generated, type-only, static configuration, bootstrap-only, external declaration, or other approved reason.
- `approved_by`: Reviewer or product owner when needed.
- `notes`: Short explanation.

**Validation Rules**:

- Exclusions must be specific and auditable.
- Exclusions must not hide behavior in inquiry, lead, proposal, or authorization workflows without approval.

## Synthetic Fixture Data

**Purpose**: Provides safe test records for customers, leads, proposals, contacts, organizations, projects, tasks, auth sessions, and proposal responses.

**Fields**:

- `fixture_name`: Stable fixture identifier.
- `domain`: Inquiry, lead, proposal, authorization, or shared.
- `data_shape`: The model or payload represented.
- `contains_sensitive_real_data`: Must always be false.

**Validation Rules**:

- Must use fictional names, emails, passcodes, proposal IDs, document references, and payment-adjacent values.
- Must not depend on production services or external network availability.

## State Transitions

- `Eligible Frontend Unit`: Missing -> Creation-only -> Partial behavioral coverage -> Sufficient behavioral coverage.
- `Critical Workflow Area`: Not started -> Below target -> Target met.
- `Coverage Gap Backlog Item`: Not started -> In progress -> Tested or documented exclusion.
- `Documented Exclusion`: Proposed -> Reviewed -> Accepted or rejected.
- `Test Coverage Baseline`: Captured -> Used for task prioritization -> Superseded by final coverage report.
