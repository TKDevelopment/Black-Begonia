# Feature Specification: Manual Proposal Booking

**Feature Branch**: `004-manual-proposal-booking`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "Refactor the proposal workflow so the florist continues using the floral proposal builder for invoice data, then uploads an already completed and signed floral proposal and services agreement PDF. Submitting that PDF stores it for record keeping and converts the lead into a booked project. Remove all SignWell integrations, client proposal/signature portal behavior, and proposal-contract email delivery."

## Clarifications

### Session 2026-07-17

- Q: How should obsolete signing/portal tables, fields, and historical data be handled? -> A: Hard delete obsolete signing/portal tables, fields, and historical data during migration.
- Q: Where should the uploaded signed PDF live conceptually after conversion? -> A: Store the signed PDF primarily on the booked project, with lead/proposal references.
- Q: What should happen to the original lead record after booking conversion? -> A: Keep the lead as converted history linked to the booked project and remove it from active lead pipelines.
- Q: What should happen when users open legacy client proposal/signature portal URLs? -> A: Remove active routes; legacy portal URLs resolve as not found or inaccessible.
- Q: How should proposal invoice data behave after a lead is booked? -> A: Keep editable proposal invoice data, capture each confirmed submission as a new project active invoice snapshot, and retain historical proposal document versions.

## User Scenarios & Testing *(mandatory)*

User stories are prioritized as independently testable journeys. P1 is the most critical.

### User Story 1 - Build Proposal Invoice Data (Priority: P1)

As the florist, I want the existing floral proposal builder workflow to remain intact until finalization so I can create the invoice data, line items, arrangement details, totals, and shopping list context before preparing the final client document outside the CRM.

**Why this priority**: The builder remains the florist's operational workspace and source of truth for proposal pricing, planning, and future project records.

**Independent Test**: Start from an eligible lead, open the floral proposal builder, configure markup, labor, tax region, catalog-based line items, arrangement details, totals, and shopping list preview, then confirm those capabilities remain available before finalization.

**Acceptance Scenarios**:

1. **Given** a florist is working from an eligible lead, **When** they select `Generate Floral Proposal`, **Then** the floral proposal builder opens for that lead.
2. **Given** the florist is building proposal invoice data, **When** they edit default markup, labor percentage, tax region, catalog line items, arrangements, and quantities, **Then** the totals and shopping list preview update so the florist can review the proposal data before finalization.
3. **Given** the florist has not clicked `Finalize Proposal`, **When** they continue editing proposal details, **Then** the workflow remains an internal CRM planning workflow and does not contact the client or start any signing process.

---

### User Story 2 - Upload Signed Proposal Package (Priority: P1)

As the florist, I want `Finalize Proposal` to collect the already completed floral proposal and signed services agreement PDF so the CRM can store the signed record without managing client review or e-signature steps.

**Why this priority**: The business has moved proposal document creation, client delivery, and signature collection outside the CRM. The CRM only needs the final signed PDF for record keeping and project conversion.

**Independent Test**: Complete proposal invoice data, click `Finalize Proposal`, upload a valid PDF through drag-and-drop or file picker, confirm the warning prompt, and verify the file is accepted for storage only after confirmation.

**Acceptance Scenarios**:

1. **Given** the florist is satisfied with proposal invoice data, **When** they click `Finalize Proposal`, **Then** a submit floral proposal and services agreement modal appears.
2. **Given** the submit modal is open, **When** the florist drags a PDF into the drop zone or uses the file picker, **Then** the selected PDF is shown as the document to submit.
3. **Given** the florist clicks submit with a valid PDF selected, **When** the confirmation alert appears, **Then** it clearly states that submitting the PDF means the proposal and services agreement are signed and the lead will be converted into a booked project.
4. **Given** the florist cancels the confirmation, **When** they return to the modal, **Then** no file is stored, no lead conversion occurs, and the proposal remains available for review or changes.
5. **Given** the florist confirms the submission, **When** the upload succeeds, **Then** the signed PDF is stored as the booked project's primary record document with traceability to the originating lead and proposal.

---

### User Story 3 - Convert Lead to Booked Project (Priority: P1)

As the florist, I want submitting the signed PDF to convert the lead and its data into a booked project so the CRM can move from sales workflow into project fulfillment.

**Why this priority**: The signed PDF submission is the business event that confirms the client has accepted and signed outside the CRM.

**Independent Test**: Submit a signed PDF for a lead and verify the lead becomes converted history outside active lead pipelines, a booked project is created with the lead's relevant data, and the signed PDF is associated with that project.

**Acceptance Scenarios**:

1. **Given** the florist confirms signed PDF submission, **When** the system stores the file, **Then** the lead and its relevant client, event, venue, planning, and proposal data are converted into a booked project.
2. **Given** conversion succeeds, **When** the florist views the resulting records, **Then** the booked project owns the signed proposal and services agreement PDF for future reference and includes links back to the originating lead/proposal context.
3. **Given** conversion succeeds, **When** the florist views lead pipelines, **Then** the original lead no longer appears as an active sales lead and remains available only as converted history linked to the booked project.
4. **Given** file storage or project conversion fails, **When** the workflow returns control to the florist, **Then** the lead is not partially represented as booked and the florist receives an actionable failure message.

---

### User Story 4 - Retire Client Signing Workflow (Priority: P1)

As the business owner, I want all SignWell, client proposal portal, proposal-contract email, passcode, and signature-collection behavior removed from the active proposal workflow so there is only one clear path: manual document handling outside the CRM followed by CRM record upload and booking.

**Why this priority**: Retaining obsolete delivery and signing paths would create conflicting states, duplicate client communication, unnecessary secrets, and operational confusion.

**Independent Test**: Search proposal workflows from florist and client perspectives and verify no active proposal flow sends a proposal for signing, sends client portal access email, requests a passcode, embeds a signing session, or waits for provider webhook outcomes.

**Acceptance Scenarios**:

1. **Given** a florist finalizes a proposal, **When** they submit the signed PDF, **Then** no e-signature provider request is created or sent.
2. **Given** a proposal is finalized or submitted, **When** client communication behavior is inspected, **Then** the CRM does not send proposal-review, passcode, or signing emails to the client.
3. **Given** an external signing provider sends any obsolete callback, **When** the CRM receives or ignores that event, **Then** it does not mutate active lead, proposal, or project state.
4. **Given** client-facing proposal and signing portal routes existed before this refactor, **When** users attempt to access those URLs, **Then** the routes are removed from the active product and resolve as not found or inaccessible without exposing proposal data.

---

### User Story 5 - Revise Booked Project Proposal Data (Priority: P1)

As the florist, I want to revise floral proposal invoice data after a lead has become a booked project so customer-driven additions or removals can update the active financial snapshot while preserving every historical proposal document version.

**Why this priority**: Booked events can change after contract signing. The CRM must support updated income and expense outlooks without losing the original booking record or prior proposal PDFs.

**Independent Test**: Open a booked project, edit its floral proposal builder data, finalize the revised proposal, upload a new signed/approved proposal PDF, and verify the project active invoice snapshot updates while earlier proposal PDFs remain viewable in project history.

**Acceptance Scenarios**:

1. **Given** a booked project has an active invoice snapshot, **When** the florist opens the floral proposal builder from the project, **Then** the current proposal invoice data is editable.
2. **Given** the florist changes markup, line items, arrangements, totals, or shopping list data for a booked project, **When** they finalize and confirm a new proposal PDF submission, **Then** the CRM captures a new project active invoice snapshot.
3. **Given** a new project proposal PDF is confirmed, **When** the florist views the project history, **Then** the newest PDF is marked active and earlier proposal PDFs remain viewable as historical versions.
4. **Given** income or expense projections use proposal data, **When** revisions exist, **Then** projections use the project's active invoice snapshot rather than overwritten historical proposal data.

### Edge Cases

- The florist selects a non-PDF file, corrupt PDF, password-protected PDF, empty file, or oversized file.
- The florist closes or cancels the modal before confirming submission.
- The PDF upload succeeds but project conversion fails.
- Project conversion succeeds but the UI refresh or navigation fails.
- The same signed PDF submission is attempted twice through a double-click, refresh, or retry.
- The lead already has a project or has already been converted.
- A converted lead is searched or opened after booking; it must resolve to historical context and link to the booked project rather than re-entering active proposal workflow.
- A booked project's proposal invoice data changes after the original booking; the new confirmed submission must create a new active invoice snapshot without deleting prior proposal document versions.
- A booked project revision is edited but not finalized or confirmed; income and expense outlooks must continue using the prior active invoice snapshot.
- Historical records contain SignWell, passcode, client portal, webhook, or signing-session data from the previous workflow and are removed by the approved cleanup migration when they only support retired signing or portal behavior.
- Legacy client portal links or proposal emails are opened after the active workflow is removed; they must resolve as not found or inaccessible without exposing proposal data.

## Retired Workflow Inventory

The following existing proposal-workflow capabilities do not conform to the new manual booking workflow and are explicitly in scope for removal, retirement, hard deletion, or migration during planning:

- External e-signature provider configuration, document creation, sending, recipient mapping, sender role handling, date-field prefill, provider status storage, provider diagnostics, and provider retry/reconciliation behavior.
- Signing webhook handling, provider completion/decline callbacks, callback token configuration, completed-document recovery, and provider-driven lead/proposal status mutation.
- Client proposal/signature portal behavior, including passcode verification, client proposal review, embedded signing sessions, client acceptance forms, client decline forms, signature-name collection, and portal session refresh behavior.
- Proposal-review and proposal-signing emails sent by the CRM, including passcode emails, resend proposal actions, signing invitations, and workflow states that wait for a client response inside the CRM.
- Data fields and records whose only active purpose is provider signing, embedded signing, passcode access, webhook replay, provider document identity, or client portal proposal sessions.
- UI copy, progress messages, error messages, tests, documentation, and recovery guidance that describe provider signing, proposal portal access, SignWell delivery, or client review through the CRM.
- Secrets, environment settings, setup instructions, and rollout steps for e-signature provider delivery, provider callbacks, and proposal portal access.

Historical signing and portal data must be scrubbed by hard deletion when its only purpose is the retired e-signature, client proposal portal, passcode, webhook, or signing-session workflow. Active workflows must stop using these retired concepts, and planning must identify every obsolete table, field, index, trigger, enum value, storage object, and configuration key to drop through an approved database migration.

## Supabase Artifact Review Inventory

Planning MUST examine the root `supabase/` artifacts and make an explicit keep, refactor, retire, or migrate decision for each item below before implementation begins.

### Edge Functions

- **Refactor active submission**: `submit-floral-proposal` currently validates proposal PDFs, prepares provider contract data, creates/sends provider documents, writes signing-session state, and moves leads to proposal-submitted states. It must be refactored or replaced so submission only validates/stores the already-signed PDF as a booked-project document and converts the lead to a booked project.
- **Retire provider webhook**: `signwell-webhook` exists only to authenticate provider callbacks, retrieve provider document results, store completed provider PDFs, and mutate proposal/lead statuses from provider events. It must be removed or made inactive for this workflow.
- **Retire proposal portal access**: `verify-floral-proposal-access` exists to validate email/passcode or access-token sessions, create signed review URLs, and expose embedded signing metadata. It must be removed or made inactive for this workflow.
- **Retire client response processing**: `submit-floral-proposal-response` exists to accept/decline proposal responses from the client portal, collect signature acknowledgement data, update signing sessions, and send follow-up emails. It must be removed or made inactive for this workflow.
- **Retire proposal access email delivery**: `send-proposal-email` and `resend-floral-proposal-email` exist to email proposal portal links and passcodes to clients. They must be removed or made inactive for this workflow.
- **Review for obsolete contract preview behavior**: `preview-floral-proposal-pdf` includes contract-rendering inputs. Planning must verify whether any remaining preview behavior is still needed for internal invoice review or should be simplified.
- **Preserve unrelated email/inquiry functions unless separately scoped**: Inquiry email delivery and general Mailgun webhook behavior are not removed merely because proposal-access emails are retired.

### Tables and Fields

- **Retire signing-session table**: `proposal_signing_sessions` is provider-centric, including provider identity, provider document/session IDs, idempotency/send state, signer references, last sync/error, and webhook payload snapshots. Planning must drop this table and its historical rows unless a field is reclassified as required non-signing project data.
- **Refactor proposal document fields**: `floral_proposals` currently contains several overlapping PDF fields. Planning must remove or migrate proposal-owned PDF fields into a project-owned signed-document reference, retaining lead/proposal traceability without making the proposal the primary signed-PDF owner.
- **Remove active proposal portal/signing fields**: `floral_proposals.passcode_hash`, `contract_template_source`, `contract_template_revision`, `signing_provider`, `signing_status`, `signing_session_reference`, `signing_completed_at`, `signing_declined_at`, `accepted_terms`, `accepted_privacy_policy`, `accepted_at`, `declined_at`, `signed_at`, `signature_name`, `signature_ip`, `signature_user_agent`, and `decline_feedback` must be dropped when they only support retired signing, passcode, proposal portal, or client response behavior.
- **Keep or refactor invoice/project fields**: `floral_proposals` financial and snapshot fields, including subtotal, tax, total, final balance, retainer, due dates, finalization/submission timestamps, submitted-by identity, and proposal snapshots, remain relevant to internal record keeping and must remain traceable from the booked project even when the signed PDF is project-owned. Booked projects must maintain one active invoice snapshot for financial outlooks while retaining historical proposal document versions.
- **Preserve lead conversion data**: `leads.converted_project_id`, `converted_primary_contact_id`, `converted_at`, client/event/venue/planner fields, assignment, and relevant statuses remain important for preserving the lead as converted history linked to the booked project.
- **Review lead/proposal statuses**: Active statuses tied to proposal submission, acceptance, or decline through client signing must be removed, renamed, or mapped to the booked-project conversion workflow. Converted leads must be excluded from active lead pipelines.
- **Use booked project fields deliberately**: `projects.source_lead_id`, `primary_contact_id`, `assigned_user_id`, `booked_at`, project status, event/venue fields, budget, guest count, notes, active invoice snapshot reference, proposal document version history, and the project-owned signed-PDF reference are candidates for the converted booked project record and must be mapped from lead/proposal data.
- **Remove proposal-access email records**: Proposal-access email rows in message/event tables that only support retired proposal-review, passcode, or signing email behavior must be deleted by migration, and active proposal booking must not create new proposal-review, passcode, or signing email records.

### Migrations, Storage, and Configuration

- **Create a cleanup migration**: The SignWell proposal-delivery migration added or changed signing/provider/passcode fields. This feature requires a new executable cleanup migration that hard deletes obsolete signing and portal schema/data while preserving needed venue, invoice, signed-PDF, and project-booking data.
- **Preserve private PDF storage with a new meaning**: The private `floral-proposals` storage bucket and internal CRM policies remain broadly aligned with signed PDF record keeping, but object paths, metadata, and naming must reference booked projects as the primary owner rather than provider packets or Canva proposals.
- **Remove active provider and portal configuration**: Environment/secrets guidance for e-signature provider API keys, provider template IDs, provider callback tokens, embedded signing URLs, proposal access signing keys, and client portal proposal URLs must be removed from the active proposal workflow.
- **Keep internal-only access boundaries**: Signed proposal PDFs must remain private and available only to authorized internal CRM users and approved server-side workflows.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST preserve the floral proposal builder's pre-finalization invoice workflow, including default markup, labor percentage, tax region, catalog item selection, line items, arrangements, dynamic totals, and shopping list preview.
- **FR-002**: The system MUST allow the florist to start the proposal workflow for an eligible lead by selecting `Generate Floral Proposal`.
- **FR-003**: The system MUST keep all proposal-building activity internal until the florist clicks `Finalize Proposal`; no client email, client portal session, or signing process may start during builder editing.
- **FR-004**: Selecting `Finalize Proposal` MUST open a submit floral proposal and services agreement modal.
- **FR-005**: The submit modal MUST allow the florist to choose a PDF by drag-and-drop or by opening the file picker.
- **FR-006**: The submit modal MUST reject missing, non-PDF, invalid, or disallowed files before converting the lead.
- **FR-007**: The submit modal MUST explain that the selected PDF is expected to be the completed proposal and signed services agreement prepared outside the CRM.
- **FR-008**: Clicking submit with a valid PDF MUST present a confirmation alert before any upload or conversion is finalized.
- **FR-009**: The confirmation alert MUST state that confirming will store the PDF and convert the lead into a booked project.
- **FR-010**: Cancelling the confirmation MUST leave the lead, proposal data, and project records unchanged.
- **FR-011**: Confirming the submission MUST store the signed PDF as a booked-project document with traceability to the source lead and proposal.
- **FR-012**: Confirming the submission MUST convert the lead and its relevant data into a booked project after the signed PDF is accepted for storage.
- **FR-013**: The conversion MUST preserve relevant lead, client, event, venue, planner, proposal invoice, line-item, totals, shopping-list data, and signed-PDF reference needed for project fulfillment and future reporting.
- **FR-014**: The workflow MUST avoid partial success states where a lead appears booked without an associated signed PDF or where a signed PDF appears submitted without a clear lead/project association.
- **FR-015**: Duplicate submission attempts MUST not create duplicate booked projects for the same lead.
- **FR-016**: The active proposal workflow MUST NOT create, send, or reconcile e-signature provider documents.
- **FR-017**: The active proposal workflow MUST NOT send client-facing proposal review, passcode, signing, or proposal-contract emails.
- **FR-018**: The active proposal workflow MUST NOT require or expose a client proposal/signature portal.
- **FR-019**: The system MUST remove or retire active UI, status labels, progress messages, error messages, and actions that imply the CRM is sending the proposal or collecting the client's signature.
- **FR-020**: The system MUST remove active data dependencies used only for provider signing, proposal portal access, passcode access, embedded signing sessions, or webhook reconciliation.
- **FR-021**: Historical proposal records with retired signing or portal data MUST be hard deleted during migration when that data only supports retired signing, passcode, proposal portal, webhook, or client response behavior.
- **FR-022**: The florist MUST receive clear success feedback after the signed PDF is stored and the lead is converted into a booked project.
- **FR-023**: The florist MUST receive actionable failure feedback when file storage or lead conversion cannot complete.
- **FR-024**: Project follow-on functionality after booking is outside this feature except for proposal invoice revisions, active invoice snapshots, proposal document version history, and preserving the data needed to support future project workflows.
- **FR-025**: Planning MUST inventory root Supabase schema, storage, migration, and edge-function artifacts and classify each proposal-related artifact as kept, refactored, hard-deleted, or migrated before implementation begins.
- **FR-026**: The implementation MUST include an executable database migration for every table, field, index, trigger, enum value, storage-policy, or data-retention change required by the manual booking workflow.
- **FR-027**: The active system MUST not require provider, webhook, proposal portal, passcode, or embedded-signing environment configuration to complete a proposal booking.
- **FR-028**: The booked project MUST be the primary owner of the signed proposal and services agreement PDF after conversion, while preserving source lead/proposal references for traceability.
- **FR-029**: After successful conversion, the original lead MUST remain as converted historical context linked to the booked project and MUST be excluded from active lead pipeline views and proposal-generation actions.
- **FR-030**: Legacy client proposal/signature portal routes MUST be removed from active routing and MUST resolve as not found or inaccessible without exposing proposal data.
- **FR-031**: Booked projects MUST allow the florist to reopen and edit floral proposal invoice data after lead conversion.
- **FR-032**: Confirming a revised proposal PDF for a booked project MUST capture a new project active invoice snapshot used for future income and expense outlooks.
- **FR-033**: Revised proposal submissions MUST preserve historical proposal document versions and identify the most recent confirmed proposal document as the active version.
- **FR-034**: Editing proposal invoice data without confirming a new proposal PDF MUST NOT replace the project's active invoice snapshot used for financial calculations.

### Constitution Alignment *(mandatory)*

- **Surface**: This feature affects the CRM admin proposal workflow, client proposal/signature portal surface, and Supabase-backed proposal/lead/project data. It does not intentionally change the public marketing website.
- **Product Owner Approval**: Product owner approval is present in this request for removing SignWell, client proposal/signature portal behavior, proposal-contract emails, and active signing workflow data dependencies.
- **Brownfield Preservation**: The floral proposal builder's pre-finalization invoice and planning workflow must be preserved. The SignWell delivery flow, client proposal/signature portal, proposal signing emails, provider webhook handling, and provider/passcode workflow data are explicitly authorized for removal or retirement.
- **Supabase Security**: Planning must identify every affected table, field, storage object path, policy, and migration needed to store signed PDFs, convert leads into booked projects, and scrub or retire no-longer-needed signing/portal data. Storage for signed PDFs must remain private and access-controlled for internal CRM users and approved server-side workflows.
- **Schema Migration**: Every removed, renamed, or repurposed table or field must be delivered through an executable migration that hard deletes obsolete signing/portal data and preserves only data required for venue, invoice, signed-PDF, or project-booking records.
- **Standalone Edge Functions**: Any remaining edge functions must be independently deployable without shared local edge-function modules. Edge functions whose only active purpose is provider signing, proposal portal verification, client proposal email delivery, or signing webhook processing must be removed or retired.
- **Testing Expectations**: The implementation must include focused tests for builder preservation, submit modal validation, confirmation behavior, PDF storage, lead-to-project conversion, duplicate submission prevention, and removal of client signing workflows.
- **Sensitive Data**: Signed proposal PDFs, customer details, event information, proposal invoice data, and historical signing records must be handled through approved private storage and access boundaries. Provider secrets and passcode/signing data must not remain active dependencies.
- **Proposal Workflow**: This feature preserves invoice/planning data flow and manual PDF upload, but changes the meaning of final submission: the uploaded PDF is already signed and causes booking conversion rather than client review or e-signature delivery.
- **Git Publication**: AI agents MUST NOT run `git commit`, `git push`, or commit/push-capable automation. Commit and push actions MUST remain human operator responsibilities.

### Key Entities *(include if feature involves data)*

- **Lead**: The prospective client and event record that enters the proposal workflow and becomes converted historical context linked to a booked project once the signed PDF is submitted.
- **Floral Proposal Invoice Data**: The structured internal proposal data created in the builder, including markup, labor, tax region, line items, arrangement details, totals, and shopping list preview.
- **Project Active Invoice Snapshot**: The booked project's current confirmed proposal invoice snapshot used by future income and expense dashboards for financial outlooks and calculations.
- **Signed Proposal and Services Agreement PDF**: The florist-uploaded PDF created and signed outside the CRM, stored as a booked-project document for record keeping and used as the booking confirmation artifact.
- **Proposal Document Version**: A project-owned historical proposal PDF record. The most recent confirmed version is active; earlier versions remain viewable for documentation.
- **Booked Project**: The official project created from the lead after signed PDF submission, carrying forward the relevant client, event, venue, planner, active invoice snapshot, proposal document history, and project-owned signed document data.
- **Retired Signing/Portal Data**: Historical or obsolete data previously used for e-signature provider delivery, passcode access, client proposal review, embedded signing, provider callbacks, or signing-session reconciliation; this data is hard deleted when it has no non-signing project-record purpose.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Florists can complete 100% of tested proposal-builder tasks through invoice finalization with the same pre-finalization planning capabilities available before this refactor.
- **SC-002**: 100% of tested finalized proposal submissions require a valid PDF and an explicit confirmation before the lead is converted.
- **SC-003**: 100% of successful signed PDF submissions create or update exactly one booked project for the lead and associate the signed PDF as a project-owned record with lead/proposal traceability.
- **SC-004**: 0 tested active proposal submissions create e-signature provider documents, send signing requests, send proposal portal emails, or wait for provider webhook outcomes.
- **SC-005**: 0 active florist-visible proposal screens or client-visible routes expose proposal passcode entry, embedded signing, client proposal review, or CRM-managed proposal acceptance/decline controls after the refactor.
- **SC-005A**: 100% of tested legacy proposal/signature portal URLs resolve as not found or inaccessible without exposing proposal data.
- **SC-006**: Duplicate-click, retry, and refresh tests produce no duplicate booked projects for the same signed PDF submission.
- **SC-007**: 100% of tested storage or conversion failures leave the lead unbooked and show the florist an actionable recovery message.
- **SC-007A**: 100% of successfully converted leads are excluded from active lead pipeline views and retain a link to the booked project.
- **SC-008**: Planning identifies every active SignWell, signing portal, proposal email, provider webhook, and signing/passcode data dependency for hard deletion or migration before implementation begins.
- **SC-009**: 100% of proposal-related Supabase edge functions, tables, table fields, migrations, storage policies, and active configuration keys are classified as keep, refactor, hard-delete, or migrate during planning.
- **SC-010**: 0 active proposal-booking paths depend on retired provider, portal, passcode, webhook, or proposal-access email configuration after implementation.
- **SC-011**: 100% of tested booked-project proposal revisions update the project active invoice snapshot only after a new proposal PDF is confirmed.
- **SC-012**: 100% of tested project proposal histories retain prior proposal PDFs and mark exactly one proposal document version as active.

## Assumptions

- The florist manually creates the final proposal and services agreement outside the CRM, sends it to the client outside the CRM, and obtains the signed document before uploading it.
- The uploaded PDF is treated as the authoritative signed proposal and services agreement artifact for booking.
- The CRM remains the source of truth for proposal invoice data even though the signed client-facing document is prepared outside the CRM.
- Manual PDF upload is the only required document submission path for this feature.
- No client-facing proposal review or signing route remains part of the active proposal workflow after this refactor.
- Historical records from the prior signing workflow may exist and must be hard deleted by migration when they only support the retired signing or portal workflow.
- Project management functionality beyond proposal invoice revisions, active invoice snapshots, and proposal document version history will be specified separately.
