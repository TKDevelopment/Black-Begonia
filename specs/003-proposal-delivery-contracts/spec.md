# Feature Specification: Proposal Delivery and Embedded SignWell Signing

**Feature Branch**: `003-proposal-delivery-contracts`

**Created**: 2026-06-09

**Status**: Draft

**Input**: User description: "Refine the client proposal flow so proposal emails use the correct production proposal-auth URL blackbegoniaflorals.com, newly sent proposal versions appear as the latest version on the lead detail page, and the client portal preserves Black Begonia's passcode-auth experience while embedding SignWell signing for a proposal package made from the submitted Canva proposal PDF plus a SignWell-managed contract template filled with lead and proposal data."

## Clarifications

### Session 2026-06-09

- Q: What should be the canonical document for client review and embedded SignWell signing? → A: Use one finalized combined proposal package with the Canva proposal PDF first and the filled contract second; if that proves unworkable later, the preferred fallback is contract-only signing.

## User Scenarios & Testing *(mandatory)*

User stories are prioritized as independently testable journeys. P1 is the most critical.

### User Story 1 - Deliver Clients to the Correct Proposal and Show the Latest Version (Priority: P1)

As the florist, I want proposal emails to send clients to the correct live proposal-auth page and I want the latest sent proposal version to immediately appear as the most recent proposal on the lead detail page.

**Why this priority**: The current proposal workflow is functionally close, but incorrect delivery links and stale version ordering create client confusion and CRM mistrust at the exact point of proposal submission. Clicking the button in client emails sends the client to localhost:4200/proposal/auth instead of blackbegoniaflorals.com/proposal/auth.

**Independent Test**: Send a floral proposal from a production-ready environment, confirm the client email links to the live proposal-auth URL rather than a local development URL, and confirm the lead detail page shows the newly submitted proposal version first in the Floral Proposals section.

**Acceptance Scenarios**:

1. **Given** a florist submits a floral proposal for client review, **When** the client receives the proposal-access email, **Then** the proposal-auth link points to the correct client-facing proposal login page for the active environment rather than a local development host.
2. **Given** a floral proposal has just been submitted, **When** the florist returns to that lead's detail page, **Then** the Floral Proposals section shows the newest submitted version as the most recent proposal for that lead.

---

### User Story 2 - Deliver a Proposal Package with a SignWell Contract (Priority: P1)

As the florist, I want to maintain one reusable contract template in SignWell so every submitted floral proposal includes the same contract pages with that client's information filled in and ready for signature.

**Why this priority**: The proposal document and contract need to travel together, and the contract is standardized enough that it can be reused and personalized without building an in-house contract editor.

**Independent Test**: Configure an active SignWell contract template, submit a floral proposal, and confirm the delivered proposal package includes the proposal PDF followed by the contract pages with the expected client and proposal details filled in and the required signing fields available.

**Acceptance Scenarios**:

1. **Given** the florist has configured a reusable contract template in SignWell, **When** that template is designated as the active floral proposal contract, **Then** the system uses it for future floral proposal submissions.
2. **Given** an active SignWell contract template exists, **When** the florist submits a finalized floral proposal PDF, **Then** the client-facing proposal package includes the florist-supplied proposal PDF followed by the contract pages generated from the active SignWell template.
3. **Given** the SignWell contract template contains mapped data fields for client or proposal details, **When** the contract is prepared for a specific submission, **Then** those fields are filled with the correct lead and proposal data before the client reviews and signs.
4. **Given** no active SignWell contract template exists, **When** the florist attempts to submit a floral proposal, **Then** the system blocks submission and clearly explains that an active contract template is required before client delivery.
5. **Given** a floral proposal is ready for delivery, **When** the system prepares the client-facing proposal package, **Then** it creates one finalized combined package that is used consistently for both client review and embedded signing.

---

### User Story 3 - Sign Within the Existing Secure Client Portal (Priority: P1)

As a floral client, I want to sign the proposal package within the existing secure Black Begonia portal after passcode authentication so I can review, decline, exit, or complete signing without being redirected away from the brand experience.

**Why this priority**: The current typed acceptance flow is no longer the target. The business has chosen to preserve the existing client portal and replace acceptance with a more legitimate embedded signing experience.

**Independent Test**: Authenticate through the existing proposal passcode flow, open the client review experience, confirm the proposal package is visible inside the secure portal, confirm the embedded SignWell signer is available for the contract portion, and confirm the client can decline with notes, exit secure view, or complete the required signatures.

**Acceptance Scenarios**:

1. **Given** a floral client receives a proposal-access email and enters the correct email and passcode, **When** they open the secure review experience, **Then** they remain inside the Black Begonia client portal and can review the proposal package without being redirected to a separate signing site.
2. **Given** the client is reviewing the proposal package, **When** they reach the contract portion, **Then** they can complete the required signing actions through the embedded SignWell signing experience inside the secure portal.
3. **Given** the client does not wish to sign yet, **When** they choose to decline or exit the secure view, **Then** the existing decline-notes and secure-exit behavior remains available and CRM history stays intact.

### Edge Cases

- What happens when a proposal is sent from a staging or development environment and the delivery link must not use the production hostname?
- How does the system behave if multiple proposal versions exist for the same lead and a newly submitted version reuses a previously saved draft record?
- What happens when the florist replaces the standard contract template after proposals have already been sent to other clients?
- How does the system respond when required merge fields for the contract are missing from the lead or proposal data at submission time?
- What happens when the florist submits a proposal PDF whose page order, size, or formatting conflicts with the appended contract pages?
- What happens when the embedded SignWell signing session cannot be loaded after the client has already authenticated successfully through the Black Begonia proposal portal?
- If combined-package signing proves unworkable during implementation, how is a contract-only signing fallback introduced without breaking the client review history?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST generate client proposal-access links from the correct client-facing proposal-auth origin for the active environment and MUST NOT send local development hosts to clients in production delivery emails.
- **FR-002**: The system MUST preserve the current proposal-access email workflow, including delivery of the proposal-auth link, client email address, and secure passcode.
- **FR-003**: After a floral proposal is submitted, the lead detail page MUST show that submitted proposal version as the most recent version in the Floral Proposals section for the associated lead.
- **FR-004**: The Floral Proposals section MUST order proposal versions consistently so the florist can identify the latest active or latest submitted proposal without ambiguity.
- **FR-005**: The CRM MUST allow the florist to maintain one standard contract template that is intended for reuse across floral proposal submissions.
- **FR-006**: The florist MUST be able to designate one active SignWell contract template for floral proposal submissions.
- **FR-007**: The florist MUST be able to replace the active SignWell contract template when the standard contract language or layout changes.
- **FR-008**: The system MUST use SignWell-managed template fields rather than an in-house contract-template editor to define where lead and proposal data is injected into the contract.
- **FR-009**: The system MUST define a supported mapping set between Black Begonia lead or proposal data and the SignWell contract fields used for contract preparation.
- **FR-010**: When a finalized floral proposal is submitted for client review, the system MUST retrieve the active SignWell contract template, fill its mapped fields with the relevant lead and proposal data, and prepare it for that specific proposal submission.
- **FR-011**: The client-facing proposal package MUST contain the florist-created proposal PDF first and the filled contract second.
- **FR-012**: The combined proposal package MUST be the canonical document used for both client review and embedded SignWell signing.
- **FR-013**: The system MUST block proposal submission when no active SignWell contract template exists.
- **FR-014**: If required mapped contract data is missing at submission time, the system MUST block submission and clearly identify which required fields must be completed before client delivery can continue.
- **FR-015**: The system MUST preserve already delivered proposal packages and MUST NOT retroactively replace the contract inside historical proposal versions when the active SignWell contract template changes later.
- **FR-016**: The system MUST record which SignWell contract template and contract revision were used for each submitted floral proposal.
- **FR-017**: The system MUST preserve the existing Black Begonia email-plus-passcode proposal-auth flow as the entry point to the client review experience.
- **FR-018**: After passcode authentication, the client MUST be able to review the proposal package and complete required contract signatures through an embedded SignWell signing experience inside the existing secure client portal.
- **FR-019**: The system MUST allow the client to decline with notes or exit the secure view without completing signing, while preserving CRM history and current decline workflow behavior.
- **FR-020**: The system MUST replace the current checkbox-and-typed-name acceptance path for this workflow with embedded SignWell signing for the contract portion of the proposal package.
- **FR-021**: The system MUST capture and retain enough signing outcome data to keep proposal status history, contract completion history, and CRM follow-up behavior accurate.
- **FR-022**: Proposal submission, client portal access, and lead-facing proposal history updates MUST continue to preserve existing proposal versions, passcodes, PDFs, and decline records.
- **FR-023**: The feature MUST preserve the current manual florist-created proposal PDF workflow and extend it with SignWell-backed contract attachment and embedded signing rather than replacing the florist's external proposal-design process.

### Constitution Alignment *(mandatory)*

- **Surface**: This feature affects the CRM admin portal, the client proposal-access portal, Supabase proposal-delivery workflows, storage assets, proposal status-history logic, and a new third-party signing dependency. It does not intentionally change public website content or marketing pages.
- **Product Owner Approval**: Product owner approval is present through this specification for proposal-delivery fixes, SignWell-backed contract-template administration, client-facing proposal package changes, and embedded signing behavior. No separate public-website approval is assumed because the requested change targets proposal-access delivery rather than website content or SEO.
- **Brownfield Preservation**: The existing proposal-auth login flow, passcode workflow, proposal PDF review entry point, decline-with-notes path, exit-secure-view behavior, manual florist-created proposal PDF submission path, and lead proposal history workflow must be preserved. Only the incorrect delivery origin, stale version visibility, typed acceptance method, and missing contract-attachment capability are authorized for change.
- **Supabase Security**: Proposal emails, passcodes, proposal PDFs, appended contract documents, SignWell template identifiers, signing session references, webhook or status events, and contract completion artifacts must remain within approved data-access, storage, and edge-function boundaries. The feature must document affected proposal records, contract-template records, storage assets, third-party signing secrets, and edge-function delivery paths.
- **Testing Expectations**: The implementation must include focused unit tests for proposal delivery origin handling, lead proposal ordering, SignWell contract-template configuration, contract attachment and merge logic, embedded-signing launch behavior, and proposal-review continuity. Proposal delivery, client authorization, and signing-status integration checks are required because email links, proposal ordering, delivered package generation, and client completion behavior are changing.
- **Sensitive Data**: Customer names, emails, addresses, passcodes, proposal PDFs, contract documents, signatures, signing evidence, and any third-party signing references must be validated, minimized, and handled only through approved application boundaries.
- **Proposal Workflow**: This feature preserves the floral proposal builder as the source of pricing and proposal data, preserves manual florist-created proposal PDFs as the primary creative document path, extends delivery with a SignWell-backed appended contract, and keeps future signing, payment, and reporting workflows possible.

### Key Entities *(include if feature involves data)*

- **Proposal Delivery Origin**: The approved client-facing base URL used to construct secure proposal-auth links for a specific environment.
- **Floral Proposal Version Record**: A submitted or draft proposal record whose ordering and status determine which version appears most recent on the lead detail page.
- **SignWell Contract Template**: The reusable standard agreement document maintained in SignWell and designated by Black Begonia as the active contract for floral proposal submissions.
- **Contract Template Version**: The identifiable SignWell template revision that was active at the time a floral proposal was delivered.
- **Contract Merge Data**: The set of client, lead, proposal, and event values that are mapped from Black Begonia records into SignWell-managed contract fields before delivery.
- **Delivered Proposal Package**: The client-facing document package composed of the florist-created proposal PDF followed by the filled contract pages used for review and signature.
- **Canonical Proposal Package**: The single finalized combined document that serves as the source of truth for both client review and embedded signing.
- **Embedded Signing Session**: The secure in-portal signing experience that allows the client to complete the contract portion through SignWell without leaving the Black Begonia portal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of tested production proposal-access emails generated after this feature use the correct client-facing proposal-auth origin rather than a local development host.
- **SC-002**: 100% of tested lead detail pages show the newest submitted floral proposal version first in the Floral Proposals section immediately after submission.
- **SC-003**: The florist can maintain one active reusable contract template and use it across repeated floral proposal submissions without recreating the contract for each client.
- **SC-004**: 100% of tested floral proposal submissions with an active SignWell contract template produce a delivered proposal package that contains the florist-created proposal PDF followed by the contract pages.
- **SC-004a**: 100% of tested standard client review and signing journeys use the same combined proposal package rather than separate review and signing artifacts.
- **SC-005**: 100% of tested required contract fields that have source data available are filled with the correct client or proposal values in the delivered contract pages.
- **SC-006**: Historical proposal versions continue to show the contract version that was attached at the time of delivery, with no retroactive replacement when a newer SignWell template is activated later.
- **SC-007**: 100% of tested authenticated client review journeys keep the client inside the Black Begonia proposal portal while the SignWell contract-signing experience is embedded.
- **SC-008**: 100% of tested standard review journeys continue to support PDF loading, decline with notes, and exit-secure-view behavior while replacing typed acceptance with embedded contract signing.

## Assumptions

- The production client-facing proposal-auth destination should resolve to `blackbegoniaflorals.com/proposal/auth`, while non-production environments may still need environment-appropriate destinations for internal testing.
- The Floral Proposals section on the lead detail page is intended to surface the newest relevant proposal first and should update immediately after a submission succeeds.
- The florist wants one active SignWell contract template at a time rather than choosing among multiple contract templates per proposal.
- The contract language and layout are standardized enough that SignWell-managed fields can be mapped to Black Begonia lead and proposal data without requiring a custom in-house contract editor.
- The appended contract becomes part of the delivered proposal package for review and signature, rather than being sent as a separate client document.
- The combined proposal package is the default and preferred implementation path; a contract-only signing fallback is acceptable only if the combined-package path proves unworkable during implementation.
- SignWell is the approved signing dependency for this workflow unless a later approved feature explicitly replaces it.
- The client must still begin in the existing Black Begonia proposal-auth flow even though contract signing is handled through embedded SignWell functionality inside the portal.
