# Tasks: Proposal Delivery and Automated SignWell Contracts

**Input**: Approved specification and implementation plan in this feature directory.
**Tests**: Karma/Jasmine for Angular; standalone edge functions are type-checked and verified through deployed smoke tests.

## Phase 1: Setup and design alignment

- [X] T001 Update superseded plan, research, data model, contract, and quickstart artifacts in `specs/003-proposal-delivery-contracts/`
- [X] T002 Verify ignore files and preserve existing public-site behavior in `.gitignore` and `src/app/components/public/`

## Phase 2: Foundational data and contracts

- [X] T003 Add lead, project, proposal payment, PDF metadata, and signing-session fields in `supabase/schemas/public/tables/`
- [X] T004 [P] Extend lead, project, proposal, and signing-session TypeScript models in `src/app/core/models/`
- [X] T005 [P] Extend lead, project, and proposal repositories in `src/app/core/supabase/repositories/`
- [X] T006 Define direct SignWell submission and webhook contracts in `specs/003-proposal-delivery-contracts/contracts/signwell-proposal-delivery.md`

## Phase 3: User Story 1 - Finalize and send one contract package

**Goal**: Finalize through one Canva PDF modal and send the fixed-template SignWell package.
**Independent test**: Cancel leaves the proposal editable; submit uploads the PDF, creates and sends one SignWell document, then locks the proposal.

- [X] T007 [P] [US1] Add builder and workflow tests for atomic finalization and storage submission in `src/app/components/private/floral-proposal-builder/` and `src/app/core/supabase/services/floral-proposal-workflow.service.spec.ts`
- [X] T008 [US1] Remove contract-template administration and separate document-submission gating from `src/app/components/private/floral-proposal-builder/`
- [X] T009 [US1] Implement private PDF upload and the new finalization request contract in `src/app/core/supabase/services/floral-proposal-workflow.service.ts`
- [X] T010 [US1] Implement fixed-template draft creation, persistence, send, reconciliation, and status transitions in `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T011 [US1] Verify PDF validation, SignWell payloads, storage failures, and duplicate prevention through standalone-function review and deployed smoke scenarios

## Phase 4: User Story 2 - Populate the fixed contract from CRM data

**Goal**: Persist venue/payment data and map the thirteen approved API IDs.
**Independent test**: A full-service wedding produces correctly formatted client, venue, payment, and due-date values.

- [X] T012 [P] [US2] Add venue-address fields to lead create/edit/detail/search behavior in `src/app/components/private/leads/`
- [X] T013 [P] [US2] Copy venue address and ZIP fields during lead conversion in `src/app/core/supabase/services/lead-conversion.service.ts`
- [X] T014 [US2] Persist proposal payment calculations from the builder in `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.ts`
- [X] T015 [US2] Implement service-aware venue validation and thirteen-field mapping helpers in `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T016 [US2] Add Angular tests for lead CRUD, conversion, and calculations, and verify edge formatting and service-aware validation through deployed smoke scenarios

## Phase 5: User Story 3 - Reconcile SignWell outcomes

**Goal**: Accept only verified completed/declined provider states and persist the signing date.
**Independent test**: Verified completion saves `dateSigned`, accepts the proposal, and updates the lead; verified decline updates both decline states.

- [X] T017 [P] [US3] Verify webhook terminal events, authentication, date recovery, replay, and ordering through deployed smoke scenarios
- [X] T018 [US3] Implement authenticated provider reconciliation, completion/decline transitions, date extraction, and completed-PDF storage in `supabase/edge_functions/signwell-webhook.ts`
- [X] T019 [US3] Preserve legacy proposal-access records while stopping new passcode and embedded-session production in `src/app/core/proposal-access/` and `supabase/edge_functions/verify-floral-proposal-access.ts`

## Phase 6: User Story 4 - Show the newly sent proposal first

**Goal**: Keep proposal history ordered by successful submission time.
**Independent test**: The newest successfully sent version appears first and failed drafts do not displace it.

- [X] T020 [P] [US4] Extend proposal ordering tests in `src/app/core/supabase/repositories/floral-proposal-repository.service.spec.ts`
- [X] T021 [US4] Verify repository and lead-detail ordering uses submitted timestamp, update timestamp, then version in `src/app/core/supabase/repositories/floral-proposal-repository.service.ts`

## Phase 7: Polish and validation

- [X] T022 Remove obsolete contract-template application code while retaining deployed-table cleanup guidance in `src/app/` and `supabase/schemas/public/tables/proposal_contract_templates.sql`
- [X] T023 Document private storage/RLS, secrets, webhook registration, test mode, rollout, and rollback in `specs/003-proposal-delivery-contracts/quickstart.md`
- [X] T024 Run focused Angular tests, Deno type-checking, and deployed edge-function smoke checks for the changed workflows
- [X] T025 Run the production Angular build and verify no public website or SEO files changed
- [X] T026 Mark all completed tasks and record any environment-dependent SignWell smoke checks in `specs/003-proposal-delivery-contracts/tasks.md`

## Phase 8: Post-implementation alignment

**Goal**: Register and validate direct implementation refinements made after the original Spec Kit execution.

- [X] T027 Remove all edge-function unit tests and the `_shared` directory; verify every production edge function has no local/shared imports in `supabase/edge_functions/`
- [X] T028 Add the repeatable production migration with signing-session indexes and PostgREST schema reload in `supabase/migrations/20260627000000_signwell_proposal_delivery.sql`
- [X] T029 Document SignWell API-key/template-ID sources, the exact `Client` placeholder, generated webhook token, deployment JWT settings, and Workspace Callback URL in `specs/003-proposal-delivery-contracts/`
- [X] T030 Remove the Record Focus and Required For Save cards, compact the layout, and expose all non-metadata lead business fields in `src/app/components/private/leads/components/lead-upsert-modal/`
- [X] T031 Complete the lead edit save payload, add structured Supabase errors, and normalize CRM service labels to exact `public.service_type` enum values in `src/app/core/floral-services/` and `src/app/core/supabase/repositories/lead-repository.service.ts`
- [X] T032 Apply CRM light/dark theme variables throughout the lead modal and disable unstable component HMR in `src/app/components/private/leads/components/lead-upsert-modal/` and `angular.json`
- [X] T033 Add regression coverage for service enum mapping, complete lead edits, removed cards, and computed dark-theme styles; verify TypeScript, the Angular suite, and the development build
- [X] T034 Reconcile all post-plan implementation decisions into Spec 003 specification, plan, data model, research, contract, quickstart, checklist, and task artifacts

## Phase 9: Post-implementation resource-limit correction

**Goal**: Eliminate Supabase 546 CPU/memory failures during Canva PDF attachment without weakening private-storage or PDF-validation requirements.

- [X] T035 Diagnose the deployed 546 failure and identify full PDF download, character expansion, base64 encoding, and JSON serialization as the resource hotspot in `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T036 Replace full-file edge buffering with storage metadata validation, a bounded `%PDF-` signature read, and a 15-minute signed `file_url` consumed directly by SignWell in `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T037 Reconcile the resource-safe attachment contract and retry instructions across Spec 003 and independently type-check the standalone submission function
- [X] T038 Surface safe edge-function response messages in the CRM and provide an actionable recovery message for gateway-level 546 failures in `src/app/core/supabase/services/floral-proposal-workflow.service.ts`
- [X] T039 Verify application/test TypeScript, 15 focused workflow tests, the complete 482-test Angular suite, the standalone Deno function, and the development build

## Phase 10: SignWell request-schema correction

**Goal**: Correct provider-side 400 validation and retain actionable, privacy-safe diagnostics for future SignWell contract mismatches.

- [X] T040 Compare the deployed payload with SignWell's current official OpenAPI components and identify the missing required template-recipient `id`
- [X] T041 Add stable client recipient ID `"1"` and flatten SignWell `errors`, `meta.message`, and `meta.messages` responses with URL/email redaction in `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T042 Update Spec 003 contracts and recovery guidance, then independently type-check the corrected standalone edge function

## Phase 11: Empty supplemental-fields correction

**Goal**: Remove the optional payload value explicitly rejected by SignWell while preserving all template-owned and prefilled fields.

- [X] T043 Diagnose `invalid_keys[0]: fields` as SignWell rejecting the empty supplemental `fields: [[]]` value rather than a template API-ID mismatch
- [X] T044 Omit the supplemental `fields` property from the create-from-template payload in `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T045 Reconcile the live-provider constraint across Spec 003 and independently type-check the corrected standalone function

## Phase 12: Template roles, ISO dates, and submission progress

**Goal**: Satisfy the template's second required recipient, use provider-valid date values, and make the synchronous finalization workflow visibly understandable.

- [X] T046 Map the authenticated submitting florist to the configurable `Document Sender` placeholder as recipient ID `"2"` and retain the client as recipient ID `"1"` in `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T047 Send `eventDate` and `finalBalanceDueDate` to SignWell as ISO `YYYY-MM-DD` DateField values in `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T048 Add a locked spinner state and observable save/upload/SignWell/history milestone messages to the proposal submission modal and builder flow
- [X] T049 Add focused modal/builder progress tests, update Spec 003 artifacts, and validate Angular TypeScript/tests plus the standalone Deno function

## Phase 13: Live recipient/date validation correction

**Goal**: Satisfy SignWell's live unique-recipient and full DateField timestamp validation while preserving the two template roles and source calendar dates.

- [X] T050 Convert proposal event and final-balance due dates to full midnight-UTC ISO-8601 timestamps before template-field prefill in `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T051 Add optional stable sender name/email secrets and reject duplicate normalized client/sender emails before provider invocation in `supabase/edge_functions/submit-floral-proposal.ts`
- [X] T052 Reconcile the live validation behavior and configuration guidance across Spec 003 artifacts and independently type-check the standalone function

## Phase 14: Lead intake and environment correction

**Goal**: Keep proposal-ready lead data canonical and prevent date/environment drift in inquiry and CRM-created records.

- [X] T053 Normalize lead `service_type` values to the Supabase enum before inquiry insert and CRM lead update in `src/app/core/floral-services/floral-service-catalog.ts`, `src/app/core/supabase/repositories/lead-repository.service.ts`, `src/app/core/floral-services/floral-service-catalog.spec.ts`, and `src/app/core/supabase/repositories/lead-repository.service.spec.ts`
- [X] T054 Normalize lead `source` values to the Supabase `lead_sources` enum before inquiry insert and CRM lead update in `src/app/core/supabase/repositories/lead-repository.service.ts` and `src/app/core/supabase/repositories/lead-repository.service.spec.ts`
- [X] T055 Preserve date-only `event_date` values without timezone day-shift across lead persistence, display, proposal context, and inquiry/proposal edge-function emails
- [X] T056 Keep generated production environment files aligned with `AppEnvironment` and proposal portal configuration in `set-env.cts`, `src/environments/environment.model.ts`, `src/environments/environment.ts`, and `src/environments/environment.prod.ts`

## Phase 15: Lead modal save correction

**Goal**: Keep create/edit lead submission stable after the lead modal compaction and enum-normalization work.

- [X] T057 Fix numeric guest-count handling in `src/app/components/private/leads/components/lead-upsert-modal/lead-upsert-modal.component.ts`
- [X] T058 Render lead source as a dropdown backed by the deployed `lead_sources` enum values in `src/app/core/leads/lead-source-catalog.ts` and the lead upsert modal
- [X] T059 Remove assigned-user editing from the lead upsert modal while preserving existing assignments when edit payloads omit `assigned_user_id`
- [X] T060 Add regression coverage for numeric guest count submission, source enum options, removed assignment UI, and assignment preservation

## Phase 16: Lead modal phone formatting correction

**Goal**: Show CRM-entered phone numbers in a readable US format without storing formatting punctuation.

- [X] T061 Format client and planner phone inputs as `(xxx) xxx-xxxx` while typing in `src/app/components/private/leads/components/lead-upsert-modal/lead-upsert-modal.component.ts`
- [X] T062 Emit modal phone payload values as digits only and add regression coverage in `src/app/components/private/leads/components/lead-upsert-modal/lead-upsert-modal.component.spec.ts`

## Dependencies

- Phase 2 blocks all stories.
- US1 supplies the submission lifecycle used by US2.
- US3 depends on the provider document/session created by US1.
- US4 is independently verifiable after the shared proposal schema changes.
- Phase 7 follows all desired stories.
- Phase 8 records follow-up implementation refinements after the original feature phases and depends on the completed lead/schema work in Phases 2 and 4.
- Phase 9 hardens the completed US1 attachment path after production resource-limit evidence and preserves its existing idempotency contract.
- Phase 10 corrects the provider request schema exposed by the first resource-safe live SignWell request.
- Phase 11 removes an optional empty value rejected by SignWell's live create-from-template validator.
- Phase 12 resolves live 422 role/date validation and improves the florist's submission feedback without inventing unobservable server progress.
- Phase 13 corrects the remaining live 422 constraints revealed after Phase 12: SignWell requires full timestamps for DateFields and distinct recipient emails.
- Phase 14 corrects lead intake enum/date persistence and generated environment configuration so proposal delivery receives canonical data.
- Phase 15 corrects the lead modal save regression introduced by compact edit-modal follow-up work and preserves assignment ownership outside the modal.
- Phase 16 corrects CRM phone entry formatting after the modal save correction and depends on the modal payload boundaries established in Phase 15.

## Implementation strategy

Implement additive schema and typed contracts first, then the atomic finalization workflow, field mapping, webhook reconciliation, and finally compatibility cleanup and validation. Follow-up alignment hardens standalone deployment, production migration, lead editing, enum/date persistence, theme behavior, local development stability, generated environment output, and bounded-memory PDF delivery. New records use direct SignWell delivery; legacy proposal-access data remains readable.
