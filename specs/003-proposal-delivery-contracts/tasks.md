# Tasks: Proposal Delivery and Embedded SignWell Signing

**Input**: Design documents from `/specs/003-proposal-delivery-contracts/`

**Prerequisites**: plan.md (required), spec.md (required for user stories),
research.md, data-model.md, contracts/

**Tests**: Black Begonia uses Karma/Jasmine unit tests by default. Include test
tasks for all changed Angular components, guards, services, repositories, and
workflow logic. Include focused integration checks when proposal, lead,
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
- Supabase Edge Functions: `supabase/edge_functions/...`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm scope, approvals, and affected surfaces before code work.

- [X] T001 Confirm affected CRM admin, client portal, and Supabase surfaces in `specs/003-proposal-delivery-contracts/plan.md`
- [X] T002 Confirm product owner approval boundaries remain limited to proposal-access and CRM workflow changes in `specs/003-proposal-delivery-contracts/spec.md`
- [X] T003 [P] Capture brownfield proposal-auth, decline, exit, and manual Canva behaviors that must remain unchanged in `specs/003-proposal-delivery-contracts/plan.md` and `specs/003-proposal-delivery-contracts/quickstart.md`
- [X] T004 [P] Inventory affected routes, repositories, edge functions, schema files, and storage assets in `specs/003-proposal-delivery-contracts/research.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core design and safety checks that MUST be complete before user
story implementation.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Add contract-template and signing-session schema definitions in `supabase/schemas/public/tables/proposal_contract_templates.sql` and `supabase/schemas/public/tables/proposal_signing_sessions.sql`
- [X] T006 Extend proposal delivery metadata for combined packages and signing state in `supabase/schemas/public/tables/floral_proposals.sql`
- [X] T007 [P] Extend shared proposal domain models for contract template, combined package, and signing metadata in `src/app/core/models/floral-proposal.ts` and `src/app/core/proposal-access/proposal-access.models.ts`
- [X] T008 [P] Add Supabase repository and workflow scaffolding for proposal contract templates and signing sessions in `src/app/core/supabase/repositories/proposal-contract-template-repository.service.ts`, `src/app/core/supabase/repositories/proposal-signing-session-repository.service.ts`, and `src/app/core/supabase/services/floral-proposal-workflow.service.ts`
- [X] T009 Define backend environment-variable contracts for proposal portal origin and SignWell secrets in `supabase/edge_functions/submit-floral-proposal.ts`, `supabase/edge_functions/verify-floral-proposal-access.ts`, and `src/environments/environment.ts`
- [X] T010 Define validation and failure-handling rules for passcodes, missing merge data, package generation, and embedded signing failures in `specs/003-proposal-delivery-contracts/contracts/embedded-signwell-proposal-contract.md`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Deliver Clients to the Correct Proposal and Show the Latest Version (Priority: P1)

**Goal**: Ensure proposal emails always use the correct client-facing proposal-auth origin and the newest submitted floral proposal appears first on the lead detail page.

**Independent Test**: Submit a floral proposal from a production-ready environment, confirm the email links to the correct proposal-auth URL, and confirm the lead detail page shows the newly submitted proposal version first in the Floral Proposals section.

### Tests for User Story 1

> Write these tests first where practical, and make sure they fail before the
> implementation changes satisfy them.

- [X] T011 [P] [US1] Add Karma/Jasmine unit coverage for proposal delivery origin handling in `src/app/core/supabase/services/floral-proposal-workflow.service.spec.ts` and proposal ordering in `src/app/components/private/leads/lead-detail/lead-detail.component.spec.ts`
- [ ] T012 [P] [US1] Add focused integration coverage for production portal URL generation and latest-version submission ordering in `supabase/edge_functions/submit-floral-proposal.test.ts`

### Implementation for User Story 1

- [X] T013 [P] [US1] Update client-facing portal origin configuration in `src/environments/environment.ts`, `src/environments/environment.development.ts`, and `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T014 [P] [US1] Reuse the configured client proposal-auth origin in resend and mail-delivery helpers in `supabase/edge_functions/resend-floral-proposal-email.ts` and `supabase/edge_functions/send-proposal-email.ts`
- [X] T015 [US1] Update floral proposal version persistence and sorting rules in `src/app/core/supabase/repositories/floral-proposal-repository.service.ts` and `src/app/core/supabase/services/floral-proposal-workflow.service.ts`
- [X] T016 [US1] Render the newest submitted proposal first in `src/app/components/private/leads/lead-detail/lead-detail.component.ts`, `src/app/components/private/leads/lead-detail/lead-detail.component.html`, and `src/app/components/private/leads/components/lead-proposal-history-card/lead-proposal-history-card.component.ts`
- [X] T017 [US1] Preserve passcode delivery, lead activity logging, and existing submission history while applying the new origin and ordering rules in `supabase/edge_functions/submit-floral-proposal.ts` and `src/app/core/models/floral-proposal.ts`

**Checkpoint**: User Story 1 is functional and independently testable.

---

## Phase 4: User Story 2 - Deliver a Proposal Package with a SignWell Contract (Priority: P1)

**Goal**: Allow the florist to manage one active SignWell contract template and generate a canonical combined proposal package with the Canva proposal first and the filled contract second.

**Independent Test**: Configure an active SignWell contract template, submit a floral proposal, and confirm the delivered package includes the proposal PDF followed by the filled contract with required fields populated.

### Tests for User Story 2

- [X] T018 [P] [US2] Add Karma/Jasmine unit coverage for contract-template administration and submission blocking in `src/app/components/private/floral-proposal-builder/components/proposal-document-submission-modal/proposal-document-submission-modal.component.spec.ts` and `src/app/core/supabase/services/floral-proposal-builder.service.spec.ts`
- [ ] T019 [P] [US2] Add focused integration coverage for active template lookup, merge-field validation, and canonical package generation in `supabase/edge_functions/submit-floral-proposal.test.ts`

### Implementation for User Story 2

- [X] T020 [P] [US2] Create SignWell contract-template models and repository wiring in `src/app/core/models/proposal-contract-template.ts`, `src/app/core/supabase/repositories/proposal-contract-template-repository.service.ts`, and `src/app/core/supabase/services/floral-proposal-builder.service.ts`
- [X] T021 [P] [US2] Create florist contract-template management UI in `src/app/components/private/floral-proposal-builder/components/proposal-contract-template-manager/proposal-contract-template-manager.component.ts`, `src/app/components/private/floral-proposal-builder/components/proposal-contract-template-manager/proposal-contract-template-manager.component.html`, and `src/app/components/private/floral-proposal-builder/components/proposal-contract-template-manager/proposal-contract-template-manager.component.spec.ts`
- [X] T022 [US2] Extend proposal submission to require one active contract template and surface mapped-data readiness in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.ts` and `src/app/components/private/floral-proposal-builder/components/proposal-document-submission-modal/proposal-document-submission-modal.component.ts`
- [X] T023 [US2] Implement SignWell template retrieval, merge-field validation, and combined PDF composition in `supabase/edge_functions/submit-floral-proposal.ts` using the standalone edge-function path
- [X] T024 [US2] Persist canonical package, contract revision, and signing metadata for historical proposal versions in `supabase/schemas/public/tables/floral_proposals.sql`, `src/app/core/models/floral-proposal.ts`, and `src/app/core/supabase/repositories/floral-proposal-repository.service.ts`
- [X] T025 [US2] Add florist-facing blocking and recovery messaging for missing active templates or missing mapped contract data in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.html` and `src/app/components/private/floral-proposal-builder/components/proposal-document-submission-modal/proposal-document-submission-modal.component.html`

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Sign Within the Existing Secure Client Portal (Priority: P1)

**Goal**: Keep the Black Begonia passcode-auth portal as the entry point while replacing typed acceptance with embedded SignWell signing and preserving decline and exit behavior.

**Independent Test**: Authenticate through the proposal passcode flow, open the secure review experience, confirm the combined proposal package loads inside the portal, and confirm the client can decline, exit, or sign through the embedded SignWell experience.

### Tests for User Story 3

- [X] T026 [P] [US3] Add Karma/Jasmine unit coverage for embedded signing state and decline continuity in `src/app/components/proposal-access/proposal-review/proposal-review.component.spec.ts` and `src/app/core/proposal-access/proposal-access.service.spec.ts`
- [X] T027 [P] [US3] Add focused integration coverage for proposal access verification, embedded session loading, and signing-status reconciliation in `supabase/edge_functions/proposal-access-signwell.test.ts`

### Implementation for User Story 3

- [X] T028 [P] [US3] Extend secure proposal-access session models and guard behavior for combined-package review and embedded SignWell data in `src/app/core/proposal-access/proposal-access.models.ts` and `src/app/core/guards/proposal-access.guard.ts`
- [X] T029 [P] [US3] Implement embedded signing session loading, retry, and status refresh in `src/app/core/proposal-access/proposal-access.service.ts`
- [X] T030 [US3] Replace checkbox-and-typed-name acceptance with embedded SignWell review and signing UI in `src/app/components/proposal-access/proposal-review/proposal-review.component.ts` and `src/app/components/proposal-access/proposal-review/proposal-review.component.html`
- [X] T031 [US3] Implement combined-package access, embedded signer launch, and webhook or status synchronization in `supabase/edge_functions/verify-floral-proposal-access.ts`, `supabase/edge_functions/submit-floral-proposal-response.ts`, and `supabase/edge_functions/signwell-webhook.ts`
- [X] T032 [US3] Preserve decline-with-notes and exit-secure-view behavior while storing signing outcomes in `src/app/components/proposal-access/proposal-auth/proposal-auth.component.ts`, `src/app/components/proposal-access/proposal-review/proposal-review.component.ts`, and `src/app/core/models/floral-proposal.ts`

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories.

- [X] T033 [P] Update operational docs and florist setup guidance for portal origin and SignWell template management in `specs/003-proposal-delivery-contracts/quickstart.md` and `specs/003-proposal-delivery-contracts/research.md`
- [X] T034 Code cleanup and refactoring explicitly authorized by plan.md in `src/app/core/supabase/services/floral-proposal-workflow.service.ts`, `src/app/core/proposal-access/proposal-access.service.ts`, and `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T035 Security hardening for secrets, storage boundaries, webhook errors, and customer signing data in `supabase/edge_functions/submit-floral-proposal.ts`, `supabase/edge_functions/signwell-webhook.ts`, and `specs/003-proposal-delivery-contracts/plan.md`
- [X] T036 [P] Add remaining Karma/Jasmine coverage for contract-template repositories and admin UI in `src/app/components/private/floral-proposal-builder/components/proposal-contract-template-manager/proposal-contract-template-manager.component.spec.ts` and `src/app/core/supabase/repositories/proposal-contract-template-repository.service.spec.ts`
- [X] T037 Verify no public website content, routes, or SEO assets changed outside approved surfaces by reviewing `src/app/components/public/` and `src/app/core/seo/`
- [ ] T038 Run the manual validation scenarios in `specs/003-proposal-delivery-contracts/quickstart.md`

---

## Dependencies & Execution Order

- Setup has no dependencies and must confirm scope, approvals, and preserved brownfield behavior first.
- Foundational work depends on Setup and blocks all user stories.
- User Story 1 depends on Foundational completion.
- User Story 2 depends on Foundational completion and can begin after User Story 1 if proposal submission behavior needs the corrected origin first.
- User Story 3 depends on Foundational completion and on User Story 2 because embedded signing requires the canonical combined package and stored SignWell metadata.
- Polish depends on all desired user stories being complete.
- Tests for a user story should be completed before or alongside implementation.

## Parallel Execution Examples

- **US1**: T013 and T015 can run in parallel once T011-T012 are in place because environment-origin updates and lead-ordering repository work touch different files.
- **US2**: T020 and T021 can run in parallel after T018-T019 because repository scaffolding and florist admin UI are separate implementation tracks.
- **US3**: T028 and T029 can run in parallel after T026-T027 because session model updates and proposal-access service changes touch different layers.
- **Polish**: T033 and T036 can run in parallel after all story checkpoints are complete.

## Implementation Strategy

- Start with MVP delivery by completing User Story 1 so proposal emails and lead history become trustworthy again.
- Next complete User Story 2 to make the canonical SignWell-backed proposal package deliverable from the florist workflow.
- Finish with User Story 3 to embed signing in the secure portal and retire the typed acceptance path.
- Use Phase 6 to tighten documentation, security, and residual coverage once the end-to-end workflow is stable.

## Notes

- [P] tasks must touch different files or have no dependency conflict.
- Each user story must remain independently completable and testable.
- Avoid reviving in-app proposal-template authoring or exposing SignWell secrets to frontend code.
- Historical proposal versions must retain the exact contract revision and package produced at submission time.
