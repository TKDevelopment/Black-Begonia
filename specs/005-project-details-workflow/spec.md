# Feature Specification: Project Details Workflow

**Feature Branch**: `005-project-details-workflow`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "Create a projects experience matching the established CRM table screens, add a project details screen similar to lead details, allow project editing from details, move proposal revision access into project details, present initial and revised proposal documents with permanent signed-document retention and active revised-proposal handling, and include approved enhancements for a financial summary card, project timeline/activity panel, revision comparison, and project quick actions."

## Clarifications

### Session 2026-07-17

- Q: What project status lifecycle should the Projects table and details screen use? -> A: Awaiting Deposit, Booked, Awaiting Final Payment, Final Prep, Completed, Canceled. Status represents the next operational attention point, with payment gates included.
- Q: Should projects automatically move into Awaiting Final Payment 45 days before the event? -> A: Yes. Booked projects automatically change to Awaiting Final Payment 45 days before the event date when final payment has not been recorded.
- Q: What payment tracking scope is needed for this feature? -> A: Track project-level deposit and final payment records with amount, due date, paid date, status, and payment method/source. Manual logging is required for Venmo, check, cash, and similar methods; Stripe integration and full payment detail screens are future implementations.
- Q: What should the first revision comparison capability compare? -> A: Compare invoice and document metadata only, including totals, versions, submitted dates, status, and file information. PDF text or visual comparison is out of scope for this feature.
- Q: Which fields should the edit project information modal support? -> A: Edit project name, event type, service type, event date, venue/location, style notes, internal notes, and status.

## User Scenarios & Testing *(mandatory)*

User stories MUST be prioritized as independently testable journeys. Assign
priorities as P1, P2, P3, etc., where P1 is the most critical.

### User Story 1 - Browse And Filter Projects (Priority: P1)

As a florist managing booked work, I want the Projects sidebar tab to open a searchable, filterable table that matches the established CRM list screens so I can quickly find the correct project without learning a different layout.

**Why this priority**: The projects list is the primary entry point for all downstream project work. It must feel consistent with leads, contacts, and organizations before deeper workflows are useful.

**Independent Test**: Open the Projects sidebar tab with multiple projects present, search and filter the list, reset filters, and confirm the visible rows and layout match the expected CRM table behavior.

**Acceptance Scenarios**:

1. **Given** multiple booked projects exist, **When** the user opens Projects from the sidebar, **Then** they see a table with Project, Service Type, Event Date, Status, and Actions columns.
2. **Given** projects with different searchable attributes exist, **When** the user enters a search term, **Then** the table narrows using the same broad matching behavior as the leads table.
3. **Given** projects have different statuses, event types, and service types, **When** the user applies filters, **Then** only projects matching all selected filter values remain visible, including the approved project status values.
4. **Given** search text or filters are active, **When** the user selects reset, **Then** the search field and all filters return to their default state and the full default project list is restored.

---

### User Story 2 - View Project Details (Priority: P1)

As a florist, I want clicking a project to open a dedicated project details screen so I can review the complete project record, key financials, and recent project activity in a familiar lead-details-style layout.

**Why this priority**: The details page is the home for project review, editing, document access, proposal revision, financial context, and project history.

**Independent Test**: Select a project from the table and verify the user reaches a details screen showing the selected project's relevant information, financial summary, and activity timeline while preserving the relationship to the originating lead internally.

**Acceptance Scenarios**:

1. **Given** the user is viewing the projects table, **When** they click a project row or its view action, **Then** the app opens that project's details screen.
2. **Given** the project has a source lead relationship, **When** the details screen loads, **Then** the screen does not display the source lead UUID.
3. **Given** the project details content is displayed, **When** the user compares it with leads, contacts, or organizations pages, **Then** the surrounding padding and content alignment are consistent and not flush against the screen edges.
4. **Given** project financial information is available, **When** the details screen loads, **Then** a financial summary card shows the active proposal total and related payment or deposit context when available.
5. **Given** project changes or document submissions exist, **When** the details screen loads, **Then** a project timeline or activity panel summarizes relevant edits, proposal revisions, and document submissions.

---

### User Story 3 - Edit Project Information (Priority: P2)

As a florist, I want to edit project information from the project details screen so project facts can be corrected without returning to another workflow.

**Why this priority**: Booked project details can change after conversion, and edits should happen where the user is already reviewing the project.

**Independent Test**: Open a project, launch the edit project information modal, change editable fields, save, and verify the details screen reflects the saved values.

**Acceptance Scenarios**:

1. **Given** a project details screen is open, **When** the user chooses to edit project information, **Then** an edit project information modal opens with the current project values populated.
2. **Given** the user changes valid project information, **When** they save, **Then** the project record is updated and the details screen shows the new values.
3. **Given** the user cancels the modal, **When** the modal closes, **Then** no project information is changed.

---

### User Story 4 - Revise A Project Proposal (Priority: P2)

As a florist, I want to start proposal revision from clear project detail quick actions so revised proposal work begins from the booked project rather than from a disconnected place.

**Why this priority**: Revision is project-owned work after booking, and its entry point should live with the project record.

**Independent Test**: Open a booked project, select Revise Proposal, complete the existing revision workflow, and confirm the new proposal invoice data and document are associated with the same project.

**Acceptance Scenarios**:

1. **Given** a project has an existing proposal, **When** the user clicks Revise Proposal from the project details screen, **Then** the existing proposal revision workflow opens for that project.
2. **Given** the user completes a revised proposal submission, **When** they return to the project details screen, **Then** the project's proposal invoice data reflects the most recent submitted revision.
3. **Given** existing proposal builder behavior is used for revision, **When** this feature is delivered, **Then** the revision capability is retained and only its access point is moved to project details.
4. **Given** the project details header or primary action area is visible, **When** a user needs to work quickly, **Then** quick actions are available for revise proposal, open active PDF, and edit project information.

---

### User Story 5 - Review Proposal Documents (Priority: P1)

As a florist, I want proposal documents on a project to clearly separate the original signed agreement from later revised proposals so I always know which signed document is permanent and which proposal is currently active.

**Why this priority**: Proposal documents are business-critical records, and revisions must not obscure the primary signed document created at booking.

**Independent Test**: Review projects with one document and with multiple documents, then verify the document section displays the correct tabs, active/inactive meaning, ordering, metadata, and PDF actions.

**Acceptance Scenarios**:

1. **Given** a project has only the initial proposal and services agreement, **When** the user views proposal documents, **Then** only that document is shown in the proposal documents section.
2. **Given** a project has one or more revised proposal documents, **When** the user views proposal documents, **Then** the section shows tabs for Initial Proposal and Services Agreement and Revised Proposals.
3. **Given** revised proposal documents exist, **When** the user opens the Initial Proposal and Services Agreement tab, **Then** the original signed proposal and services agreement remains visible and is identified as inactive without being removed or overwritten.
4. **Given** multiple revised proposal documents exist, **When** the user opens the Revised Proposals tab, **Then** revised documents are listed from oldest to most recent and the most recent submitted proposal is identified as active.
5. **Given** any proposal document is listed, **When** the user reviews the row, **Then** they can see version, file, submitted date, status, and an action to open the PDF.
6. **Given** multiple revised proposal documents exist, **When** the user chooses to compare revisions, **Then** the user can review meaningful differences between selected proposal revisions or see a clear message when comparison details are unavailable.

### Edge Cases

- A project has no proposal documents available because of legacy or migration gaps; the details screen shows an empty document state without blocking the rest of the project.
- A revised proposal submission succeeds for invoice data but the PDF is unavailable; the user sees a clear document status and the project does not mislabel the missing PDF as active.
- A project has revised proposal documents but no initial signed document due to imported data; the document section calls out the missing initial agreement while still showing available revised proposal records.
- Financial summary data is incomplete or unavailable; the summary card shows the available values and clearly identifies missing payment, deposit, or proposal total information.
- Payment records exist without external processor data; the project still shows manually entered payment details and does not require Stripe data.
- The activity timeline has no entries; the details screen shows an empty timeline state without hiding other project information.
- Revision comparison data is unavailable for one or more selected versions; the comparison experience explains that only available invoice and document metadata differences can be shown.
- A filter combination returns no projects; the table shows an empty result state and keeps reset available.
- Project details cannot be loaded; the user sees an error state and can return to the projects table.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a Projects sidebar destination that follows the same overall list-screen structure, spacing, and visual conventions as the leads, contacts, and organizations screens.
- **FR-002**: System MUST display projects in a table with Project, Service Type, Event Date, Status, and Actions columns.
- **FR-003**: Users MUST be able to search projects with broad matching comparable to the leads table search behavior.
- **FR-004**: Users MUST be able to filter projects by status, event type, and service type.
- **FR-005**: Users MUST be able to reset project search and filters to their defaults with one reset action.
- **FR-006**: Users MUST be able to open a dedicated project details screen by selecting a project from the projects table.
- **FR-007**: The project details screen MUST present project-specific information in a layout comparable to the lead details page.
- **FR-008**: The project details screen MUST NOT display the source lead UUID while preserving the underlying relationship to the originating lead.
- **FR-009**: Users MUST be able to open an edit project information modal from the project details screen for project identity, scheduling, venue/location, service classification, notes, and status fields.
- **FR-010**: The edit project information modal MUST save valid changes, refresh the project details screen with saved values, and allow cancellation without changing project information.
- **FR-011**: The edit project information modal MUST exclude source lead relationships, proposal documents, proposal invoice snapshots, and project payment records.
- **FR-012**: Users MUST be able to start the existing revise proposal workflow from the project details screen.
- **FR-013**: The revise proposal workflow MUST remain functionally equivalent to the existing revision behavior, except that the access point is moved to project details.
- **FR-014**: System MUST retain the first proposal and services agreement submitted during lead-to-project conversion as the permanent primary signed document.
- **FR-015**: When only the initial proposal and services agreement exists, the proposal documents section MUST show that single document without requiring separate document tabs.
- **FR-016**: When revised proposal documents exist, the proposal documents section MUST show two tabs: Initial Proposal and Services Agreement and Revised Proposals.
- **FR-017**: The Initial Proposal and Services Agreement tab MUST show the original signed document and identify it as inactive once a later revised proposal exists.
- **FR-018**: The Revised Proposals tab MUST show all follow-on revised proposal documents from oldest to most recent.
- **FR-019**: The most recently submitted revised proposal document MUST be identified as the active proposal.
- **FR-020**: Each proposal document row MUST show version, file, submitted date, status, and an action to open the PDF.
- **FR-021**: Project and project details content MUST use surrounding page padding consistent with leads, contacts, and organizations so content is not flush against screen edges.
- **FR-022**: Project status values MUST include Awaiting Deposit, Booked, Awaiting Final Payment, Final Prep, Completed, and Canceled, and each value MUST represent the project's next operational attention point.
- **FR-023**: The project details screen MUST include a financial summary card that highlights the active proposal total and shows deposit, payment, or outstanding balance context when that information is available.
- **FR-024**: The financial summary card MUST clearly distinguish unavailable financial values from zero-value financial amounts.
- **FR-025**: The project details screen MUST include a project timeline or activity panel for meaningful project events such as project edits, proposal revisions, proposal document submissions, and financial snapshot changes.
- **FR-026**: The project details screen MUST include quick actions for revise proposal, open active proposal PDF, and edit project information.
- **FR-027**: Users MUST be able to compare multiple revised proposal versions when more than one revised proposal document exists.
- **FR-028**: The revision comparison experience MUST identify meaningful invoice and document metadata differences, such as proposal total changes, version numbers, submitted date changes, active/inactive status, document status, and file information.
- **FR-029**: If detailed revision comparison data is unavailable, the system MUST explain the limitation and still show the available version metadata.
- **FR-031**: Newly converted projects with a signed contract but no recorded deposit MUST begin in Awaiting Deposit status.
- **FR-032**: Projects MUST be able to move to Booked once the deposit is recorded as collected.
- **FR-033**: Projects MUST be able to move to Awaiting Final Payment when final payment is due or nearing due before event execution begins.
- **FR-034**: Projects MUST be able to move to Final Prep once final payment is collected and the florist should focus on executing order details for the approaching event.
- **FR-035**: Booked projects MUST automatically move to Awaiting Final Payment 45 days before the event date when final payment has not been recorded as collected.
- **FR-036**: The automatic Awaiting Final Payment transition MUST NOT apply to projects already marked Completed, Canceled, Awaiting Final Payment, or Final Prep.
- **FR-037**: System MUST track project-level deposit and final payment records with amount, due date, paid date, status, and payment method or source.
- **FR-038**: Users MUST be able to manually record project payments received outside an integrated processor, including Venmo, check, cash, and similar payment methods.
- **FR-039**: Project payment records MUST support future Stripe-provided payment data without requiring Stripe integration in this feature.
- **FR-040**: Full payment detail screens are outside this feature's initial scope and MUST be treated as future implementation work.
- **FR-041**: Revision comparison MUST NOT include PDF text extraction or visual PDF comparison in this feature.

### Constitution Alignment *(mandatory)*

- **Surface**: Feature affects the CRM admin portal and project/proposal records. It does not affect the public website or client portal.
- **Product Owner Approval**: No public website behavior, content, styling, SEO, routing, or forms are included in this scope.
- **Brownfield Preservation**: Existing leads, contacts, organizations, lead details, proposal builder, proposal revision behavior, project-source relationship, private PDF access, and existing proposal document metadata are preserved. Authorized refactor is limited to the projects list/details experience, moving the revise proposal entry point into project details, and adding approved detail-page summary, quick-action, timeline, and revision-comparison capabilities.
- **Supabase Security**: Project data, proposal documents, invoice snapshots, and source lead relationships remain private CRM records protected by existing authenticated access expectations. PDF access remains private and available only to authorized CRM users.
- **Schema Migration**: Planning MUST identify whether the existing project, proposal document version, invoice snapshot, payment/deposit, and activity records already support the required display, revision, financial summary, timeline, comparison, and project-level payment tracking behavior or whether a migration is needed to support missing fields.
- **Standalone Edge Functions**: Any affected proposal submission or revision function MUST remain independently deployable and must not depend on shared local edge-function modules.
- **Testing Expectations**: Unit coverage is expected for projects table search/filter/reset behavior, project details loading, financial summary states, timeline states, quick actions, edit modal save/cancel behavior, revise proposal navigation/access, proposal document tab logic, active/inactive document labeling, revision comparison behavior, and source lead UUID hiding.
- **Sensitive Data**: Customer contact details, project records, proposal PDFs, invoice data, signatures contained in signed PDFs, and related private records MUST remain visible only inside authorized CRM workflows. Secrets and service-role credentials MUST NOT be exposed to browser-facing surfaces.
- **Proposal Workflow**: The feature preserves the invoice/planning workflow, the manual signed proposal/services agreement record from booking, revised proposal document submission, and future payment/reporting relevance of active invoice snapshots. Initial payment tracking supports deposit and final-payment status for project operations while leaving Stripe integration and full payment screens for future work.
- **Git Publication**: AI agents MUST NOT run `git commit`, `git push`, or commit/push-capable automation. Commit and push actions MUST remain human operator responsibilities.

### Key Entities *(include if feature involves data)*

- **Project**: A booked customer project with project name, service type, event date, event type, status, related contacts or organizations, and an internal relationship to the source lead.
- **Source Lead Relationship**: The internal connection from a booked project back to the lead that produced it. It remains stored for workflow continuity but is not displayed as a raw UUID on project details.
- **Proposal Document Version**: A document record for either the initial signed proposal and services agreement or a revised proposal PDF, including version, file, submitted date, status, document category, and active/inactive meaning.
- **Proposal Invoice Data**: The project-owned proposal pricing and planning snapshot that reflects the active proposal after initial booking or the most recent completed revision.
- **Financial Summary**: A project detail summary of the active proposal total and available deposit, payment, or outstanding balance context.
- **Project Payment Record**: A project-level payment obligation or received payment for deposit or final payment, including amount, due date, paid date, status, and payment method or source. Records may be manually logged now and may later receive Stripe-provided details.
- **Project Activity**: A chronological record or display item describing meaningful project events such as edits, proposal revisions, document submissions, and financial snapshot changes.
- **Revision Comparison**: A user-facing comparison between revised proposal versions that highlights available differences in invoice totals, version numbers, submitted dates, active status, document status, and file metadata.
- **Project Status**: A project operational attention label used for table filtering and detail display. Approved values are Awaiting Deposit, Booked, Awaiting Final Payment, Final Prep, Completed, and Canceled.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of projects visible from the Projects sidebar tab display Project, Service Type, Event Date, Status, and Actions fields in the table.
- **SC-002**: Users can locate a known project using search or filters in under 30 seconds during acceptance testing with at least 25 sample projects.
- **SC-003**: Users can open project details from the projects table and begin a proposal revision from the project details screen in no more than 3 user actions.
- **SC-004**: For projects with revised proposals, acceptance testing correctly identifies the permanent initial signed document and the active revised proposal in 100% of tested cases.
- **SC-005**: Editing project information from the details screen completes successfully without leaving the details context in 95% or more of acceptance test attempts.
- **SC-006**: No acceptance test screen displays the raw source lead UUID on booked project details.
- **SC-007**: In acceptance testing, users can identify the active proposal total from the project details screen within 10 seconds.
- **SC-008**: In acceptance testing with projects that have multiple revised proposals, users can compare two revised versions and identify whether the proposal total changed in 90% or more of attempts where comparison data exists.
- **SC-009**: In acceptance testing, users can find the most recent proposal revision or document submission from the activity timeline within 15 seconds.
- **SC-010**: In acceptance testing, users can manually record a deposit or final payment received by Venmo, check, or cash and see the project status update appropriately in 95% or more of attempts.

## Resolved Discovery Decisions

- Proposal document rows keep their stored document status while active, inactive, initial, and revised meanings are derived display states.
- Project activity timeline shows system-generated project events for creation/conversion, edits, status changes, payment records, proposal revisions, document submissions, and financial snapshot changes.
- Manual timeline notes are deferred from the first release.

## Assumptions

- Primary users are authenticated CRM users managing booked floral projects.
- The Projects screen should use the same practical list behavior and page rhythm as existing CRM entity screens rather than introducing a new dashboard-style experience.
- The first submitted proposal/services agreement contains the signed agreement and must remain available permanently even when later proposals supersede it financially.
- Revised proposal submissions do not create a new signed services agreement unless a future approved workflow explicitly adds one.
- The financial summary card prioritizes the active proposal total first and includes payment or deposit values only when reliable data exists.
- The first revision comparison capability uses invoice and document metadata differences only.
- Project status should support operational triage by making the next needed action visible in the Projects table and project details screen.
- Booked projects are expected to become final-payment priorities automatically 45 days before the event date unless final payment has already been collected.
- Payment records introduced for this feature are project-level operational records, not the final future payment management experience.
- The edit project information modal is limited to project identity, scheduling, notes, venue/location, service classification, and status fields.
