# Feature Specification: Proposal Workflow Reset

**Feature Branch**: `002-proposal-workflow-reset`

**Created**: 2026-06-02

**Status**: Draft

**Input**: User description: "Remove proposal template functionality and refine the proposal workflow so the floral proposal builder remains the system for estimate and proposal data capture, proposal data can be finalized and edited, and florist-created Canva proposal PDFs can be uploaded or imported for the existing client approval cycle."

## Clarifications

### Session 2026-06-02

- Q: Should the initial release require both manual PDF upload and direct Canva import, or treat Canva import as optional? → A: Manual PDF upload is required; Canva import is optional if available.
- Q: After a client decline, can a florist replace the proposal PDF without editing proposal data first? → A: No. The florist must edit proposal data in the builder, save the correct information, and re-finalize before submitting a new proposal document.

## User Scenarios & Testing *(mandatory)*

User stories are prioritized as independently testable journeys. P1 is the most critical.

### User Story 1 - Retire In-App Proposal Templates (Priority: P1)

As the florist, I want all in-app proposal template authoring and template-studio workflow removed so the system no longer suggests that proposal documents are designed inside the CRM.

**Why this priority**: The workflow direction has changed decisively, and leaving template features in place would create confusion, wasted effort, and conflicting proposal paths.

**Independent Test**: Confirm that users can no longer access or use template-studio, template management, or generated-template proposal actions anywhere in the CRM or proposal workflow.

**Acceptance Scenarios**:

1. **Given** a florist is working in the CRM, **When** they navigate proposal-related areas, **Then** no template-studio, template library, or template-design actions are available.
2. **Given** an existing proposal workflow previously depended on in-app template generation, **When** the florist works through the revised proposal flow, **Then** the workflow directs them toward external proposal document creation instead of in-app template authoring.

---

### User Story 2 - Finalize and Maintain Proposal Data (Priority: P1)

As the florist, I want the floral proposal builder to keep its current estimate-building and record-keeping capabilities so I can calculate, save, version, review, and finalize proposal data before sending a client-facing document.

**Why this priority**: The builder remains the operational source of truth for proposal calculations, reporting, and future financial workflows even though document design moves outside the system.

**Independent Test**: Build a proposal with estimate details, save or export a draft, finalize the proposal data, and verify that only post-finalization actions are available until the florist chooses to edit the proposal data again.

**Acceptance Scenarios**:

1. **Given** a lead consultation is complete, **When** the florist selects `Build Floral Proposal`, **Then** the floral proposal builder opens with the existing planning and calculation workflow intact.
2. **Given** the florist is in the floral proposal builder, **When** they review or update markup, labor, tax region, line items, catalog selections, shopping list preview, lead context, summary, totals, or proposal versions, **Then** those planning functions continue to work before finalization.
3. **Given** the florist finalizes proposal data, **When** finalization completes, **Then** the system saves and locks the proposal data and shows only `Edit Proposal Data` and `Submit Proposal Document` as next actions.
4. **Given** a finalized proposal needs revision, **When** the florist selects `Edit Proposal Data`, **Then** they can return to the builder, make changes, and finalize the updated proposal data again.

---

### User Story 3 - Submit Canva Proposal PDFs for Client Review (Priority: P1)

As the florist, I want to submit a finished proposal PDF that I created in Canva so the CRM can deliver it to the client and continue the existing approval or decline cycle.

**Why this priority**: Client delivery still depends on a proposal document, but the florist now creates that document manually outside the CRM and needs a simple way to bring it back into the workflow.

**Independent Test**: Finalize proposal data, open the document submission step, provide a proposal PDF by upload or Canva import, and confirm that the existing client review cycle begins and can continue through repeated revision rounds until acceptance.

**Acceptance Scenarios**:

1. **Given** proposal data has been finalized, **When** the florist selects `Submit Proposal Document`, **Then** the system opens a submission modal that always supports drag-and-drop PDF upload and may also offer Canva PDF import when available.
2. **Given** the florist provides a valid proposal PDF, **When** they submit the document, **Then** the proposal enters the same client approval or decline workflow already used for proposal responses.
3. **Given** a client declines a submitted proposal document, **When** the florist needs to send a new proposal document, **Then** they must return to `Edit Proposal Data`, update the builder data as needed, re-finalize the proposal data, and only then submit a new proposal PDF into the approval cycle.

---

### Edge Cases

- What happens when a florist finalizes proposal data before any proposal document has been prepared?
- How does the system handle an attempted document submission that is not a valid PDF?
- How does the system preserve proposal versions and calculation history when finalized proposal data is edited and re-finalized?
- What happens to existing records that reference retired template features or template-generated proposal paths?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST remove all user-facing and workflow-facing proposal template functionality from the product, including template-studio, template management, and any proposal actions that depend on in-app template authoring.
- **FR-002**: The system MUST allow a florist to start the floral proposal workflow from a completed lead consultation by selecting `Build Floral Proposal`.
- **FR-003**: The floral proposal builder MUST preserve its current proposal-data planning capabilities before finalization, including markup, labor, tax region, line items, catalog selections per line item, shopping list preview, lead context, proposal summary, invoice totals, and proposal versions.
- **FR-004**: The floral proposal builder MUST continue to allow the florist to save a draft or export proposal information before finalization.
- **FR-005**: The system MUST allow the florist to finalize proposal data after reviewing the builder contents.
- **FR-006**: Finalizing proposal data MUST save the current proposal data state and lock it from further editing until the florist explicitly chooses to edit it again.
- **FR-007**: After proposal data is finalized, the system MUST limit the florist's next actions to `Edit Proposal Data` and `Submit Proposal Document`.
- **FR-008**: Selecting `Edit Proposal Data` after finalization MUST reopen proposal data editing without discarding the previously finalized record.
- **FR-009**: Selecting `Submit Proposal Document` after finalization MUST open a document submission modal.
- **FR-010**: The document submission modal MUST support manual drag-and-drop PDF upload.
- **FR-011**: The initial release MUST be fully usable with manual PDF upload alone, without depending on Canva import.
- **FR-012**: If a Canva-connected import path is available, the document submission modal MAY support importing a Canva-created proposal document as a PDF as a secondary convenience path.
- **FR-013**: The system MUST require a valid proposal PDF before a proposal document can be submitted to the client workflow.
- **FR-014**: Submitting a valid proposal PDF MUST trigger the same client approval or decline workflow already used for proposal response handling.
- **FR-015**: The system MUST allow the proposal workflow to continue through repeated revision and resubmission cycles until a proposal is accepted by the client.
- **FR-016**: If a florist needs to replace a previously submitted proposal document, the system MUST require them to reopen proposal data editing, update the builder data as needed, and re-finalize before a new proposal PDF can be submitted.
- **FR-017**: Proposal data captured in the floral proposal builder MUST remain available for future reporting, proposal history, financial traceability, and later downstream business workflows.
- **FR-018**: Removal of template functionality MUST NOT remove or weaken the floral proposal builder's role as the system of record for proposal calculations and structured proposal data.
- **FR-019**: The revised workflow MUST make manual florist-controlled proposal document creation the primary proposal document path.
- **FR-020**: The system MUST provide clear florist guidance at the document submission step that proposal design occurs outside the CRM and the finished PDF is what is submitted to clients.
- **FR-021**: Existing proposal approval, decline, and status-tracking behavior after document submission MUST remain functionally consistent with the current client response cycle.
- **FR-022**: The feature MUST remove obsolete supporting code, routes, screens, actions, and workflow branches that exist only to support in-app proposal templates.

### Constitution Alignment *(mandatory)*

- **Surface**: This feature affects the CRM admin proposal workflow and the client proposal-review flow, with possible supporting changes in shared proposal workflow logic. It does not intentionally change the public website.
- **Product Owner Approval**: Product owner approval is present through this specification for removing proposal template functionality and replacing generated proposal documents with manual Canva PDF submission.
- **Brownfield Preservation**: The floral proposal builder, proposal calculations, proposal versions, proposal record-keeping, and client approval or decline cycle must be preserved. The template-studio and template-based proposal generation path are explicitly authorized for removal.
- **Supabase Security**: Proposal data, customer records, uploaded proposal PDFs, and any Canva-connected document import path must continue to follow existing approved data-access and storage boundaries. No privileged secrets may be exposed through the revised workflow.
- **Testing Expectations**: The implementation must include focused unit tests for affected builder, proposal status, submission modal, upload/import, and review-cycle logic. Proposal workflow integration checks must confirm finalize, edit, submit, and approval-cycle transitions.
- **Sensitive Data**: Proposal records, client-facing PDFs, emails, passcodes, signatures, and payment-adjacent data must continue to be validated, minimized, and handled only through approved application boundaries.
- **Proposal Workflow**: This feature preserves the invoice and planning data flow, makes manual PDF upload the required primary document path, allows Canva import only as an optional secondary convenience path, and keeps proposal data available for future reporting and payment-related workflows.

### Key Entities *(include if feature involves data)*

- **Lead Consultation**: The completed sales context that enables the florist to begin building a floral proposal.
- **Floral Proposal Data**: The structured estimate and planning record captured in the floral proposal builder, including pricing inputs, line items, catalog composition, totals, shopping list information, and version history.
- **Finalized Proposal Data**: A locked snapshot of floral proposal data that is ready for client-document submission but can later be reopened for revision by the florist.
- **Re-finalization Cycle**: The required workflow where declined or outdated proposal documents must be preceded by proposal-data edits and a new finalization before resubmission.
- **Proposal Document Submission**: The florist's act of attaching a finished proposal PDF to finalized proposal data for client delivery.
- **Client Proposal Cycle**: The existing approval, decline, and resubmission workflow that begins after a proposal document is submitted to the client.
- **Retired Template Feature**: Any route, screen, action, supporting record, or workflow branch whose only purpose was in-app proposal template authoring or generated proposal-document production.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of proposal-template authoring and generated-template proposal actions are removed from florist-visible workflows in the CRM.
- **SC-002**: Florists can complete the proposal-data workflow from `Build Floral Proposal` through proposal-data finalization without losing any existing planning or calculation capability listed in this specification.
- **SC-003**: After finalization, 100% of tested florist journeys present only `Edit Proposal Data` and `Submit Proposal Document` as the immediate next actions until the florist chooses to edit the proposal again.
- **SC-004**: Florists can submit a valid proposal PDF through manual upload in every standard submission journey, whether or not Canva import is available.
- **SC-005**: 100% of tested submitted proposal documents enter the same client approval or decline workflow currently used for proposal responses.
- **SC-006**: 100% of tested replacement-document journeys require proposal-data editing and re-finalization before a new proposal PDF can be submitted after a decline or revision request.
- **SC-007**: Proposal data remains available across draft, finalized, edited, and resubmitted proposal journeys with no loss of key estimate, totals, line-item, or version information.
- **SC-008**: The revised workflow supports repeated decline and resubmission cycles until acceptance without requiring the florist to recreate proposal data from scratch.

## Assumptions

- The primary user of this feature is the florist or floral admin working inside the CRM proposal workflow.
- Lead consultations already produce or expose the state needed to enable `Build Floral Proposal`.
- The florist continues to design proposal documents outside the CRM, with Canva as the preferred document-creation tool.
- Manual PDF upload is the only required document-submission path for the initial release.
- Canva import may be added where available without becoming a dependency for proposal submission.
- A replacement proposal document always represents newly reviewed proposal data and therefore must follow an edit-and-re-finalize step before resubmission.
- Existing client-facing approval and decline behavior remains the authoritative downstream workflow after proposal document submission.
