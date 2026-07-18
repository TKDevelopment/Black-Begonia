# Feature Specification: Proposal Revision Snapshots

**Feature Branch**: `006-proposal-revision-snapshots`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "From project details, let a florist revise a proposal by loading the immutable active proposal invoice snapshot into an editable floral proposal builder. Finalizing and submitting a new PDF creates a new proposal invoice snapshot, deactivates the prior snapshot, activates the new one, and relates the new proposal document to it. Financial Summary and future income/expense reporting use the active snapshot."

## Clarifications

### Session 2026-07-17

- Q: How should unsubmitted proposal revision edits be retained? → A: Auto-save one resumable working revision per project until it is finalized or explicitly discarded.
- Q: How should simultaneous editing of a project's single working revision be handled? → A: This is a single-user business-owner workflow; multi-user editing and locking are out of scope.
- Q: When catalog data changed after the active snapshot was submitted, which values should initialize the revision? → A: Preserve snapshot values; use current catalog values only for newly added or explicitly replaced items.
- Q: What must the uploaded revision PDF represent before the new snapshot can become active? → A: It must be the externally approved or signed final revision document.
- Q: What should happen when a project lacks one valid active proposal invoice snapshot? → A: Disable revision and show actionable data-repair guidance until a valid active snapshot exists.
- Q: Must the current proposal document also be valid before revision can open? → A: No. Revision eligibility requires only one valid active invoice snapshot; active-document errors affect PDF access separately.

## User Scenarios & Testing *(mandatory)*

User stories are prioritized as independently testable journeys. P1 is the most critical.

### User Story 1 - Open An Editable Revision (Priority: P1)

As a florist, I want `Revise Proposal` on a project to open the floral proposal builder with the project's current active proposal data so I can make customer-requested changes without altering the accepted historical record.

**Why this priority**: A revision cannot be useful unless the builder starts from the correct project version and permits normal proposal editing while preserving history.

**Independent Test**: Open a project with an active proposal snapshot, select `Revise Proposal`, verify all supported proposal data matches that snapshot, change each category of editable builder data, and confirm the active snapshot and project financial summary remain unchanged.

**Acceptance Scenarios**:

1. **Given** a project has an active proposal invoice snapshot, **When** the florist selects `Revise Proposal`, **Then** the floral proposal builder opens for that project and is populated from the active snapshot.
2. **Given** the revision builder is populated, **When** the florist edits proposal settings, financial terms, line items, arrangement details, quantities, components, or other builder-supported values, **Then** the builder accepts valid changes and recalculates its revision preview.
3. **Given** the florist has unsubmitted revision changes, **When** the project Financial Summary or another active-snapshot consumer is viewed, **Then** it continues to show values from the active submitted snapshot.
4. **Given** a historical snapshot was used to initialize a revision, **When** the florist edits the working revision, **Then** the historical snapshot's content, totals, version, author, and creation time remain unchanged.
5. **Given** catalog data linked to the active snapshot has changed or been retired, **When** the revision opens, **Then** existing proposal rows retain their recorded snapshot values and current catalog values are introduced only when the florist adds or explicitly replaces an item.
6. **Given** a project has no valid active snapshot, has conflicting active snapshots, or references a missing active snapshot, **When** the project details page loads, **Then** `Revise Proposal` is unavailable and the florist sees actionable guidance to repair the project data.
7. **Given** a project has one valid active snapshot but its active document is missing, broken, or mismatched, **When** project details loads, **Then** proposal revision remains available while Open Active PDF reports the independent document problem.

---

### User Story 2 - Finalize A New Proposal Version (Priority: P1)

As a florist, I want finalizing a revision and submitting its externally approved or signed PDF to create a new active invoice snapshot and document version together so the project has a trustworthy current proposal without losing earlier versions.

**Why this priority**: The confirmed revision is the business event that changes the project's active financial outlook and proposal document.

**Independent Test**: Change proposal data, finalize it, submit a valid PDF, and verify one new snapshot and one new related document version are created and activated while the prior active records remain retained but inactive.

**Acceptance Scenarios**:

1. **Given** a florist has a valid working revision and its externally approved or signed final PDF, **When** they finalize it and confirm that document's submission, **Then** the system creates a new immutable proposal invoice snapshot containing the finalized builder data.
2. **Given** the new snapshot is created, **When** submission completes, **Then** the submitted PDF is recorded as a new proposal document version related to that exact snapshot and the same project.
3. **Given** the project previously had active snapshot and document versions, **When** the revision succeeds, **Then** those prior records remain available in history, are marked inactive or superseded as appropriate, and the new records become the project's only active snapshot and active revised proposal document.
4. **Given** a revision is submitted, **When** version history is reviewed, **Then** snapshot and document versions have an unambiguous chronological sequence and the new relationship can be traced to the project, florist, and submission time.
5. **Given** the florist double-clicks, retries, or refreshes during the same confirmed submission, **When** processing completes, **Then** no duplicate snapshot or document version is created.

---

### User Story 3 - Preserve Active State Until Success (Priority: P1)

As a florist, I want cancellation, validation errors, upload failures, and processing failures to leave the current active proposal untouched so a failed revision cannot corrupt project history or reporting.

**Why this priority**: Proposal totals and signed documents are business-critical records. Partial activation would make the project financially and operationally inconsistent.

**Independent Test**: Exercise cancellation and failures before and during finalization and verify the prior active snapshot remains unchanged; when a valid active document existed before the attempt it remains active, while any pre-existing invalid document state remains unchanged. No incomplete version becomes visible as current, and the working revision can be corrected and retried where appropriate.

**Acceptance Scenarios**:

1. **Given** a florist opens or edits a revision, **When** they leave without confirming final submission, **Then** no new active snapshot or document is created.
2. **Given** the revision or PDF fails validation, **When** submission is rejected, **Then** the prior active snapshot remains unchanged, a previously valid active document remains active, any pre-existing invalid document state remains unchanged, and the florist receives actionable guidance.
3. **Given** file storage or proposal-version processing fails, **When** the workflow returns control to the florist, **Then** the project does not expose a partially activated snapshot/document pair.
4. **Given** the florist has made valid revision edits, **When** they leave, refresh, sign out, or return after a submission failure, **Then** the system resumes the project's auto-saved working revision and clearly identifies anything that must be reselected, such as a local PDF file.
5. **Given** a project has an unsubmitted working revision, **When** the florist explicitly discards it and confirms the action, **Then** the working revision is removed, the submitted history remains unchanged, and the next revision starts from the current active snapshot.

---

### User Story 4 - Use The Active Snapshot For Financial Reporting (Priority: P1)

As a business owner, I want all current project financial views to read the active proposal invoice snapshot so the Financial Summary and future income/expense dashboards agree on the latest confirmed proposal rather than unsubmitted edits or obsolete versions.

**Why this priority**: Snapshot activation has business value only if operational reporting consistently uses the confirmed current version.

**Independent Test**: Record materially different totals across two submitted versions and an unsubmitted working revision, then verify current financial views show only the newest submitted active snapshot while history retains both submitted versions.

**Acceptance Scenarios**:

1. **Given** a project has multiple proposal invoice snapshots, **When** the Financial Summary loads, **Then** its proposal-derived values come exclusively from the one active snapshot.
2. **Given** a florist changes a working revision but has not submitted it, **When** financial data is refreshed, **Then** the changes do not affect current income, expense, balance, or proposal totals.
3. **Given** a new revision is successfully activated, **When** the Financial Summary refreshes or the project is reopened, **Then** it shows values from the new active snapshot.
4. **Given** future income or expense reporting consumes project proposal data, **When** a project has historical versions, **Then** the reporting contract identifies the active snapshot as the current source and does not aggregate obsolete versions as current amounts.

### Edge Cases

- A project has no active proposal invoice snapshot, has more than one record marked active, or its active reference points to a missing record; revision remains unavailable until the data is repaired rather than falling back to blank, mutable, inactive, or historical data.
- The active snapshot contains older or incomplete data that cannot populate every current builder field.
- The snapshot loads but related catalog items, images, tax regions, or other referenced source data have since changed or been retired.
- A florist removes every optional line item or produces zero/negative totals that violate existing finalization rules.
- The submitted file is missing, not a PDF, empty, corrupt, password-protected, oversized, or no longer available when confirmation occurs.
- Snapshot creation succeeds but document recording or active-reference switching fails; no partial new active state may remain.
- The same file or confirmation request is submitted repeatedly.
- The project becomes `completed` or `canceled`, is deleted, loses its valid active snapshot, or the florist loses internal CRM authorization while the builder is open; finalization must reject the stale workspace without changing current proposal state.
- Financial Summary is opened while a revision is processing; it must show either the complete prior active version or the complete new active version, never a mixed state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST launch project-owned proposal revision from the project details `Revise Proposal` action.
- **FR-002**: The system MUST initialize each new revision workspace from the project's current active proposal invoice snapshot, not from an arbitrary historical snapshot or mutable proposal record.
- **FR-003**: The revision workspace MUST make all proposal data currently supported by the floral proposal builder editable, subject to the builder's existing validation and calculation rules.
- **FR-004**: The system MUST treat revision edits as working data isolated from every submitted proposal invoice snapshot.
- **FR-005**: Once created, the business content and recorded totals of a proposal invoice snapshot MUST be immutable; only lifecycle metadata required to supersede or activate versions may change.
- **FR-006**: Opening, editing, saving as working data, canceling, or abandoning a revision MUST NOT change the project's active snapshot, active proposal document, or current financial reporting.
- **FR-007**: Finalization MUST require an uploaded PDF and explicit confirmation that it is the externally approved or signed final revision document. The persisted workspace MUST also pass server-side supported-schema, required line-item, tax/event-context, and calculated-total validation; the edge function MUST revalidate current-user authorization immediately before RPC invocation, and the transaction MUST revalidate project eligibility after locking the project.
- **FR-008**: A successful confirmed revision MUST create exactly one new proposal invoice snapshot containing the complete finalized builder state and calculated financial values.
- **FR-009**: A successful confirmed revision MUST create exactly one new proposal document version for the submitted PDF and relate it to the new snapshot and project.
- **FR-010**: The system MUST assign new snapshot and document versions in an unambiguous chronological sequence within the project.
- **FR-011**: Activating a revision MUST leave exactly one active invoice snapshot and one active revised proposal document version for the project, while marking the prior active records inactive or superseded.
- **FR-012**: Historical snapshots and proposal documents MUST remain retained, readable by authorized CRM users, and traceable after they become inactive.
- **FR-013**: Snapshot creation, document-version creation, prior-version deactivation, and project active-reference replacement MUST succeed as one business operation or leave the prior active state intact.
- **FR-014**: The system MUST prevent retry, refresh, or repeated confirmation of the same submission from producing duplicate snapshot or document versions.
- **FR-015**: Failure feedback MUST explain whether the florist needs to correct builder data, select another PDF, retry submission, reopen the current revision, or request support.
- **FR-016**: Project Financial Summary proposal-derived values MUST use only the project's active proposal invoice snapshot.
- **FR-017**: The project proposal data contract used by future income and expense reporting MUST expose the active snapshot as the source of current values while keeping historical versions distinguishable from current values.
- **FR-018**: Successful revision activation MUST be reflected when the project details page and financial summary refresh, without requiring the florist to locate or select the new version manually.
- **FR-019**: The system MUST record revision submission history sufficient to identify the project, new version, submitting florist, submission time, and replaced version.
- **FR-020**: Only an authenticated internal CRM admin user accepted by the existing `is_internal_crm_user()` authorization predicate and admin route guards MUST be able to load revision data, edit the working revision, submit PDFs, or activate new versions; no new proposal-specific role system is introduced.
- **FR-021**: The system MUST preserve current proposal builder calculation, preview, shopping-list, manual PDF upload, private document access, and project document-history behavior except where this specification explicitly changes revision editing and version activation.
- **FR-022**: The system MUST auto-save at most one resumable working revision per project until successful finalization or explicit discard, without changing active proposal records or financial reporting.
- **FR-023**: The system MUST warn for and require confirmation of explicit working-revision discard; discarding MUST remove only unsubmitted working data and MUST NOT alter submitted snapshots or documents.
- **FR-024**: Revision hydration MUST preserve the active snapshot's recorded item identity, descriptive, quantity, cost, markup, price, and calculation inputs even when linked catalog data has changed or been retired; current catalog values MUST apply only to newly added or explicitly replaced items.
- **FR-025**: The system MUST allow revision only while project status is `awaiting_deposit`, `booked`, `awaiting_final_payment`, or `final_prep` and the project resolves to exactly one valid active proposal invoice snapshot. It MUST disable revision with actionable guidance for `completed` or `canceled` projects or invalid snapshot state and MUST NOT initialize from blank, mutable, inactive, or arbitrarily selected historical data. Missing or inconsistent active-document state MUST NOT disable revision when project status and active snapshot state are valid and MUST instead be reported independently for PDF access.

### Constitution Alignment *(mandatory)*

- **Surface**: This feature affects the authenticated CRM admin proposal builder and project details experience, plus the private project proposal snapshot and document records used by those screens. It does not change the public website or add a client portal.
- **Product Owner Approval**: No public website behavior, content, styling, SEO, routing, or forms are in scope, so no additional public-surface approval is required.
- **Brownfield Preservation**: Preserve proposal calculations, arrangement and component editing, shopping-list generation, private PDF storage/access, manual PDF upload, project conversion history, proposal document history, project details, and current Financial Summary behavior. The authorized change is to make project revision working data editable and to enforce immutable submitted snapshots with reliable active-version replacement.
- **Supabase Security**: Planning MUST review project proposal invoice snapshots, project proposal document versions, projects' active proposal references, mutable floral proposal working records, private proposal storage policies, and authenticated submission paths. Customer data and PDFs remain accessible only through existing authorized internal CRM boundaries.
- **Schema Migration**: If planning identifies any new or modified table constraint, field, policy, index, or operation needed to enforce immutability, uniqueness, concurrency, or activation integrity, implementation MUST include an executable migration for existing environments and matching declarative definitions.
- **Standalone Edge Functions**: Any changed proposal submission function MUST remain independently deployable and MUST NOT import a local shared module, an `_shared` directory, or another edge function.
- **Testing Expectations**: Unit and integration coverage MUST include active-snapshot hydration, complete builder editability, snapshot immutability, cancellation, validation/upload failure, atomic activation, duplicate submission, document-to-snapshot linkage, version history, authorization, and Financial Summary refresh. Existing proposal, project, and authorization checks must remain passing.
- **Sensitive Data**: Customer details, proposal pricing, internal cost estimates, PDFs, florist identity, and payment-related projections remain private. Browser code MUST NOT contain privileged secrets, and PDF access MUST continue through approved private-storage paths.
- **Proposal Workflow**: The invoice/planning builder and manual PDF upload path are preserved. Only confirmed PDF submission creates a new active snapshot and document version. The active snapshot is explicitly the current source for Financial Summary and future income/expense reporting.
- **Git Publication**: AI agents MUST NOT run `git commit`, `git push`, or commit/push-capable automation. Commit and push actions remain the human operator's responsibility.

### Key Entities

- **Proposal Revision Workspace**: The project's single auto-saved, resumable editable working state; initialized from one active snapshot, records its baseline version, and remains separate from confirmed financial history until successful submission or explicit discard.
- **Project Proposal Invoice Snapshot**: Immutable confirmed proposal invoice and planning state for one project version, including the recorded item and calculation inputs needed to reproduce its values independently of later catalog changes, plus totals, terms, provenance, lifecycle status, and creation details.
- **Project Proposal Document Version**: Private submitted PDF record for a project version, related to the exact invoice snapshot finalized with it and identified as active or historical.
- **Project Active Proposal References**: The project's pointers to its one current invoice snapshot and proposal document, used to resolve current financial and document state.
- **Proposal Revision Activity**: Auditable record of a successful version transition, including the project, prior and new versions, submitting florist, and time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of project revisions open with proposal values matching the project's active snapshot and allow valid edits across every builder-supported data category.
- **SC-002**: Across cancellation, validation failure, upload failure, and simulated processing failure tests, 100% leave the prior active snapshot unchanged and usable. A previously valid active document remains unchanged and usable; a pre-existing invalid document state remains unchanged; and no partial replacement becomes current.
- **SC-003**: Across successful revision and retry tests, every confirmed submission produces exactly one new snapshot and one related document version, with exactly one active record of each type per project.
- **SC-004**: Historical snapshot contents and documents remain unchanged and accessible in 100% of version-history tests after one or more later revisions.
- **SC-005**: Financial Summary displays values from the newest successfully activated snapshot on the first refresh after submission and never displays unsubmitted working values in acceptance testing.
- **SC-006**: A florist can open an existing project, make a typical proposal revision, and reach the final PDF confirmation step within 5 minutes, excluding time spent preparing the external PDF.
- **SC-007**: Duplicate-submission tests create zero duplicate snapshots, document versions, or active records.
- **SC-008**: Authorized florists can identify the current proposal version, related active PDF, prior version, submitting florist, and submission time without consulting raw data in 100% of history-review tests.

## Assumptions

- Project proposal revision is a single-user authenticated workflow for the business owner/lead florist; clients do not edit or submit revisions in the CRM.
- A project is eligible for revision only when it has a valid active proposal invoice snapshot and the current user has existing proposal-management permission.
- Project statuses `awaiting_deposit`, `booked`, `awaiting_final_payment`, and `final_prep` are revision-eligible; terminal statuses `completed` and `canceled` are not.
- Existing proposal-management permission means the authenticated user passes the application's current internal CRM predicate and admin route guards; this feature does not add roles or permission tables.
- "Everything in the floral proposal builder" means every field and collection the current builder exposes as editable, while project/contact master data managed elsewhere remains governed by its existing workflow.
- Submitted proposal snapshots are immutable business records. Changing `is_active` or equivalent lifecycle metadata to supersede a version does not violate content immutability.
- Each project has at most one auto-saved working revision that resumes across navigation, refresh, sign-out, or submission failure until it is finalized or explicitly discarded; multi-user editing, edit locking, and collaborative conflict resolution are out of scope.
- Existing rows hydrated from a snapshot keep their recorded values until the florist edits or explicitly replaces them; merely opening a revision does not refresh them from the current catalog.
- A local PDF selection may need to be repeated after navigation or failure because browsers do not retain local file access; proposal working data should remain recoverable where current draft behavior supports it.
- The manual proposal PDF may be signed or otherwise approved outside the CRM; this feature does not restore e-signature, client portal, or proposal-email workflows.
- The CRM records the florist's confirmation that the uploaded PDF is externally approved or signed; it does not independently verify signatures or manage the external approval process.
- Historical documents and snapshots follow existing project record-retention rules and are not deleted merely because a new version becomes active.
- Future income/expense dashboard implementation is out of scope; this feature establishes and verifies the active-snapshot source contract it will consume.
