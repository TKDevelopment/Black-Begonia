---

description: "Task list template for Black Begonia feature implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`

**Prerequisites**: plan.md (required), spec.md (required for user stories),
research.md, data-model.md, contracts/

**Tests**: Black Begonia uses Karma/Jasmine unit tests by default. Include test
tasks for all changed Angular components, guards, services, repositories, and
workflow logic. Include focused integration checks when proposal, lead, inquiry,
authorization, Supabase, or edge-function flows are touched.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when files and dependencies do not conflict
- **[Story]**: Which user story this task belongs to, such as US1 or US2
- Include exact file paths in descriptions

## Path Conventions

- Angular app: `src/app/...`
- Public website: `src/app/components/public/...`
- Client proposal access: `src/app/components/proposal-access/...`
- CRM admin: `src/app/components/private/...`
- Core services/models/guards: `src/app/core/...`
- Shared UI: `src/app/shared/...`
- Supabase tables: `supabase/schemas/public/tables/...`
- Supabase migrations: `supabase/migrations/...`
- Supabase Edge Functions: `supabase/edge_functions/...`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm scope, approvals, and affected surfaces before code work.

- [ ] T001 Confirm affected surface: public website, client portal, CRM admin,
  Supabase backend, or cross-cutting
- [ ] T002 Confirm product owner approval for any public website change
- [ ] T003 [P] Capture existing brownfield behavior that must remain unchanged
- [ ] T004 [P] Identify affected routes, components, services, edge functions,
  tables, storage buckets, and environment/deployment settings

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core design and safety checks that MUST be complete before user
story implementation.

**CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T005 Document data model, Supabase RLS intent, storage policy intent, and
  edge-function access boundaries for affected data paths
- [ ] T006 Add an executable SQL migration in `supabase/migrations/` for every
  new or modified Supabase table schema, including required application order
  or manual steps
- [ ] T007 Confirm every affected Supabase Edge Function is standalone and does
  not create, use, or import `_shared`, another edge function, or a local shared
  function module
- [ ] T008 Confirm no service-role keys or privileged secrets are exposed to
  frontend code
- [ ] T009 Define Karma/Jasmine unit-test scope and integration-check scope
- [ ] T010 Define validation/error handling for customer data, emails,
  passcodes, signatures, proposal PDFs, and payment-related records
- [ ] T011 For frontend split work, define staged routing, auth, deployment,
  shared code, and rollback considerations
- [ ] T012 For proposal work, confirm manual Canva PDF upload remains the
  primary document path unless the approved spec says otherwise
- [ ] T013 Confirm all commit and push actions remain human-operated; AI agents
  may provide source-control summaries and suggested commit messages only

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - [Title] (Priority: P1)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 1

> Write these tests first where practical, and make sure they fail before the
> implementation changes satisfy them.

- [ ] T014 [P] [US1] Add Karma/Jasmine unit test for [component/service/guard]
  in src/app/[path]/[name].spec.ts
- [ ] T015 [P] [US1] Add focused integration check for
  [proposal/lead/inquiry/auth flow] in [test path]

### Implementation for User Story 1

- [ ] T016 [P] [US1] Update Angular model/type in src/app/core/models/[entity].ts
- [ ] T017 [P] [US1] Update Supabase repository/service in src/app/core/supabase/[path]/[service].ts
- [ ] T018 [US1] Implement UI/workflow changes in src/app/[surface]/[path]
- [ ] T019 [US1] Add validation, error handling, and customer-data safeguards
- [ ] T020 [US1] Verify brownfield behavior listed in plan.md remains unchanged

**Checkpoint**: User Story 1 is functional and independently testable.

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 2

- [ ] T021 [P] [US2] Add Karma/Jasmine unit test for [component/service/guard]
  in src/app/[path]/[name].spec.ts
- [ ] T022 [P] [US2] Add focused integration check for
  [proposal/lead/inquiry/auth flow] in [test path]

### Implementation for User Story 2

- [ ] T023 [P] [US2] Update Angular model/type in src/app/core/models/[entity].ts
- [ ] T024 [US2] Implement service or edge-function changes in src/app/core or
  supabase/edge_functions
- [ ] T025 [US2] Implement UI/workflow changes in src/app/[surface]/[path]
- [ ] T026 [US2] Integrate with User Story 1 components if needed

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - [Title] (Priority: P3)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 3

- [ ] T027 [P] [US3] Add Karma/Jasmine unit test for [component/service/guard]
  in src/app/[path]/[name].spec.ts
- [ ] T028 [P] [US3] Add focused integration check for
  [proposal/lead/inquiry/auth flow] in [test path]

### Implementation for User Story 3

- [ ] T029 [P] [US3] Update Angular model/type in src/app/core/models/[entity].ts
- [ ] T030 [US3] Implement service or edge-function changes in src/app/core or
  supabase/edge_functions
- [ ] T031 [US3] Implement UI/workflow changes in src/app/[surface]/[path]

**Checkpoint**: All user stories are independently functional.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories.

- [ ] TXXX [P] Documentation updates in README.md, specs, or project docs
- [ ] TXXX Code cleanup and refactoring explicitly authorized by plan.md
- [ ] TXXX Performance optimization across affected surfaces
- [ ] TXXX [P] Additional Karma/Jasmine unit tests to support the 80% coverage target
- [ ] TXXX Security hardening for RLS, storage, secrets, customer data, emails,
  passcodes, signatures, proposal PDFs, and payment-related records
- [ ] TXXX Verify public website routes/content/SEO remain unchanged unless approved
- [ ] TXXX Run quickstart.md validation

---

## Dependencies & Execution Order

- Setup has no dependencies and must confirm surface and approvals.
- Foundational work depends on Setup and blocks all user stories.
- User stories depend on Foundational completion and proceed by priority.
- Polish depends on all desired user stories being complete.
- Tests for a user story should be completed before or alongside implementation.
- Models come before services; services come before UI workflows; security and
  validation complete before story checkpoint.

## Notes

- [P] tasks must touch different files or have no dependency conflict.
- Each user story must remain independently completable and testable.
- Avoid vague tasks, unauthorized public site edits, secret exposure, and
  cross-story dependencies that break independent delivery.
- Never change a Supabase table schema without a matching executable SQL
  migration in `supabase/migrations/`.
- Never create or use an `_shared` edge-function directory, local shared
  edge-function module, or import between Supabase Edge Functions.
- AI agents must never run `git commit`, `git push`, or commit/push-capable
  automation; include source-control handoff notes for the human operator.
