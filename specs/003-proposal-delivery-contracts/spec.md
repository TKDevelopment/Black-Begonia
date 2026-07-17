# Feature Specification: Proposal Delivery and Automated SignWell Contracts

**Feature Branch**: `003-proposal-delivery-contracts`

**Created**: 2026-06-09

**Updated**: 2026-06-27

**Status**: Implemented; live SignWell smoke verification remains environment-dependent

**Input**: User description: "Use one fixed Black Begonia SignWell contract template configured through backend-only secrets, remove contract-template administration from the Floral Proposal Builder, collect the florist's Canva proposal PDF when Finalize Proposal is clicked, store that PDF, populate the SignWell template from CRM data, append the proposal PDF, send the resulting signing request through SignWell, and reconcile signed or declined outcomes back to the lead."

## Clarifications

### Session 2026-06-09

- The earlier preference for a Black Begonia-hosted combined PDF and embedded signing is superseded by the 2026-06-26 workflow below.

### Session 2026-06-26

- The Floral Proposal Builder will not contain a Contract Template section. Black Begonia uses one SignWell template, named **Black Begonia Floral Contract Template**, whose provider identifier and recipient-placeholder reference are supplied only through backend configuration.
- Clicking **Finalize Proposal** opens the Canva proposal PDF upload modal. Submitting that modal starts storage and SignWell delivery as one florist-facing operation.
- SignWell creates and sends the signing request to the lead's email address using the template's configured subject, message, signature content, and signing setup. New proposals do not use an embedded signer in the Black Begonia client portal.
- The SignWell signing packet contains the filled contract template and the uploaded Canva proposal PDF as an additional file. Contract-first and Canva-proposal-second order is approved.
- Lead records will gain persisted ceremony and reception street-address and ZIP-code values, and existing CRM lead create, edit, view, and proposal-delivery behavior will support them.
- `finalBalanceAmount` is the finalized proposal `total_amount`; despite its field name, it is not reduced by the retainer. `retainerAmount` is 30% of that amount, rounded to currency precision. `finalBalanceDueDate` is 30 calendar days before `eventDate`.
- `retainerDueDate` is not prefilled into the SignWell template. It remains empty on the proposal until the client signs, then is set from the client-signing date represented by the SignWell `dateSigned` result.
- A verified `document_completed` event is the authoritative acceptance event, and SignWell's own delivery domain is approved for signing emails.

### Session 2026-06-27

- Every Supabase edge function remains a standalone deployment unit. The edge-functions directory contains no `_shared` directory, local shared imports, or edge-function unit-test files. Edge validation uses independent Deno type-checking and deployed provider smoke scenarios.
- Existing Supabase installations receive the lead, project, proposal, and signing-session changes through an idempotent additive migration. The migration reloads the PostgREST schema cache after adding columns; private proposal storage remains a separate policy script.
- The shared lead create/edit modal no longer displays the Record Focus or Required For Save cards. In edit mode it exposes all lead business fields except record identifiers, conversion references, and system-maintained audit timestamps.
- The lead modal uses a compact, viewport-conscious two-column layout and follows the CRM light/dark theme for its backdrop, shell, cards, controls, errors, buttons, focus states, shadows, native date/time controls, and scrollbar.
- CRM service labels are presentation values only. Lead creates and updates normalize them to the exact lowercase `public.service_type` enum values before Supabase writes, while existing enum values remain unchanged.
- SignWell configuration is backend-only: the API key comes from SignWell Settings > API, the template ID is the template UUID, the client placeholder is the exact case-sensitive template role `Client`, and the webhook token is a Black Begonia-generated random secret rather than a SignWell-issued credential.
- Supabase hosts the webhook receiver while SignWell owns callback registration. The SignWell Workspace Callback URL points to the deployed `signwell-webhook` function with the opaque token query parameter; the same callback is not registered a second time through the hooks API.
- A production 546 failure showed that downloading, base64-encoding, and JSON-serializing the full Canva PDF can exhaust Supabase Edge Function CPU and memory limits. The submission function now validates storage metadata and only the PDF signature bytes, then gives SignWell a short-lived signed file URL so the provider retrieves the private PDF directly.
- SignWell's create-from-template recipient schema requires a caller-supplied recipient `id` in addition to email and `placeholder_name`. The single client recipient uses stable request ID `"1"`; provider validation responses are flattened into safe operation/field details with URLs and email addresses redacted.
- SignWell's live create-from-template endpoint rejects an empty supplemental `fields: [[]]` value as an invalid key value. Because the appended Canva proposal has no signing fields, the optional `fields` property is omitted entirely; all signing and prefilled fields remain owned by the template.
- The configured template also contains a required `Document Sender` placeholder. The submitting florist is assigned to that role using optional backend sender overrides or their CRM profile name/email and recipient ID `"2"`; the client remains ID `"1"`. SignWell requires the two recipients to have different email addresses. `SIGNWELL_SENDER_PLACEHOLDER_NAME` defaults to the exact case-sensitive value `Document Sender` and can override it if the template role is renamed.
- SignWell DateField prefill values use full ISO-8601 midnight-UTC timestamps, such as `2026-06-27T00:00:00.000Z`, derived from database calendar dates. The template controls their visual date format.
- After Finalize and Send, the modal remains open and non-dismissible with an animated spinner while reporting observable milestones for saving proposal details, uploading the private PDF, creating/sending the SignWell packet, and refreshing proposal history. Failures restore the editable modal with the actionable error.

## Confirmed Workflow Sequence

1. The florist completes proposal pricing and clicks **Finalize Proposal**.
2. Black Begonia opens the PDF modal, and the florist selects the finalized Canva proposal PDF.
3. On modal submit, Black Begonia validates and stores the original Canva PDF in protected proposal storage.
4. After storage succeeds, backend orchestration retrieves the lead, event, venue, and finalized proposal data; calculates and stores `final_balance_amount`, `retainer_amount`, and `final_balance_due_date`; and validates every required contract value.
5. Black Begonia creates one SignWell document from the fixed Black Begonia Floral Contract Template, assigns the client to the configured template placeholder, and prepopulates the approved input fields.
6. Black Begonia creates a short-lived private URL for the validated stored Canva PDF and supplies it as the appended SignWell file. The provider retrieves it directly, and the resulting client packet displays the contract first and the Canva proposal second.
7. Black Begonia sends the document through SignWell using the template's subject, message, signature content, and signing order; records the SignWell document reference; and marks the proposal and lead as submitted only after SignWell accepts the send.
8. The client receives the SignWell email, opens one packet, reviews the contract followed by the proposal, and signs or declines through SignWell.
9. On a verified `document_completed` event, Black Begonia retrieves the authoritative SignWell document results, saves the client `dateSigned` value as `retainer_due_date`, and moves the matching proposal and lead to accepted. A verified decline instead moves them to declined.

## User Scenarios & Testing *(mandatory)*

User stories are prioritized as independently testable journeys. P1 is the most critical.

### User Story 1 - Finalize and Send One Contract Package (Priority: P1)

As the florist, I want Finalize Proposal to collect my completed Canva PDF and automatically send a personalized contract package so I do not have to recreate or fill a SignWell document manually.

**Why this priority**: This is the core operational outcome. The florist should perform one upload-and-submit action while Black Begonia handles storage, contract preparation, attachment, and delivery.

**Independent Test**: Finalize an eligible proposal, upload a valid Canva PDF in the displayed modal, submit it, and confirm that the PDF is stored and exactly one SignWell signing request is sent to the correct client with the filled contract and uploaded proposal in the same packet.

**Acceptance Scenarios**:

1. **Given** an eligible proposal with complete client, event, and payment data, **When** the florist clicks Finalize Proposal, **Then** a modal requests one finalized Canva proposal PDF before delivery can continue.
2. **Given** the florist has selected a valid PDF, **When** the florist submits the modal, **Then** the system stores the original PDF before asking SignWell to create the client document.
3. **Given** storage and contract-data validation succeed, **When** the delivery workflow runs, **Then** it creates a document from the configured Black Begonia Floral Contract Template, fills the mapped fields, includes the stored Canva proposal PDF in the same signing packet, and sends the request to the lead's email address.
4. **Given** the SignWell template contains its approved email subject, message, sender signature content, and signing setup, **When** the document is sent, **Then** those template defaults are used without the florist re-entering them in Black Begonia.
5. **Given** any storage, validation, or SignWell step fails, **When** the workflow returns control to the florist, **Then** the proposal is not represented as successfully sent, an actionable error is shown, and retrying does not create duplicate client requests.

---

### User Story 2 - Populate the Fixed Contract from CRM Data (Priority: P1)

As the florist, I want the contract to be filled from the lead and proposal records so the client receives accurate event and payment terms without duplicate data entry.

**Why this priority**: Automated delivery is only useful if the resulting contract is complete, accurate, and traceable to the proposal the florist finalized.

**Independent Test**: Prepare a lead and proposal with known values, finalize the proposal, and verify every supported SignWell field receives the expected formatted value while missing required source data blocks delivery and identifies the fields that need attention.

**Acceptance Scenarios**:

1. **Given** the CRM contains all required source values, **When** the contract is prepared, **Then** each case-sensitive SignWell field identifier receives the value defined in the field contract below.
2. **Given** a value requires presentation formatting, **When** it is sent to SignWell, **Then** names, dates, phone numbers, addresses, and currency values are formatted consistently without changing their business meaning.
3. **Given** a required contract value is absent or invalid, **When** the florist submits the PDF, **Then** delivery is blocked before a SignWell document is sent and the florist is told which client, event, venue, or payment data must be completed.
4. **Given** a finalized proposal total and event date, **When** the contract is prepared, **Then** `finalBalanceAmount` equals the full proposal total, `retainerAmount` equals 30% of that total rounded to currency precision, and `finalBalanceDueDate` equals the event date minus 30 calendar days.
5. **Given** the lead is created or edited in the CRM, **When** ceremony or reception location details are entered, **Then** the corresponding street address and ZIP code are stored and later included in the contract's combined city/state/ZIP values.
6. **Given** a florist edits a lead, **When** the edit modal opens, **Then** every non-metadata business field in the lead record is available without the removed Record Focus or Required For Save cards.
7. **Given** a florist selects a human-readable service label, **When** the lead is saved, **Then** the repository writes the corresponding exact `service_type` enum value rather than the display label.
8. **Given** the CRM theme changes while the modal is available, **When** light or dark mode is selected, **Then** the modal and every interactive control adopt the selected CRM theme without a page reload.

#### SignWell Prefilled Input Field Contract

| SignWell API ID | Black Begonia value |
|---|---|
| `clientName` | Lead first name |
| `clientFullName` | Lead first and last name joined with normalized spacing |
| `serviceType` | Human-readable lead service type |
| `eventDate` | Lead event date in the contract's approved display format |
| `ceremonyAddress` | Lead `ceremonyAddress`, stored in `leads.ceremony_venue_address` |
| `ceremonyCityStateZipcode` | Lead ceremony venue city, state, and `ceremonyZipcode` from `leads.ceremony_venue_zipcode`, combined in postal-address format |
| `receptionAddress` | Lead `receptionAddress`, stored in `leads.reception_venue_address` |
| `receptionCityStateZipcode` | Lead reception venue city, state, and `receptionZipcode` from `leads.reception_venue_zipcode`, combined in postal-address format |
| `clientEmail` | Lead email and SignWell client-recipient email |
| `clientPhone` | Lead phone number in the approved display format |
| `retainerAmount` | 30% of the finalized proposal `total_amount`, rounded to two decimal places and stored on the proposal |
| `finalBalanceAmount` | Full finalized proposal `total_amount`, stored on the proposal without subtracting the retainer |
| `finalBalanceDueDate` | Lead `eventDate` minus 30 calendar days, stored on the proposal |

#### SignWell Signing Result Field Contract

| SignWell API ID | Black Begonia value |
|---|---|
| `dateSigned` | Required client-assigned signing-date result; not prefilled. After verified completion, it becomes the proposal `retainer_due_date`. |

`retainerDueDate` is intentionally excluded from the prefilled input set. If SignWell does not include the `dateSigned` field value in the completion callback, Black Begonia retrieves the completed document details before updating the proposal. The configured client's provider `signed_at` date may be used to corroborate or recover the same business date.

---

### User Story 3 - Reconcile SignWell Outcomes with the Lead (Priority: P1)

As the florist, I want signed and declined SignWell documents to update the matching proposal and lead automatically so the CRM remains trustworthy without manual status maintenance.

**Why this priority**: Sending the contract is only half the workflow; the CRM must remain the operational record for follow-up and conversion.

**Independent Test**: Deliver a test contract, complete it once and decline another, replay each provider event, and confirm the correct proposal and lead move to the expected status exactly once while unrelated records remain unchanged.

**Acceptance Scenarios**:

1. **Given** all required SignWell recipients have completed the document, **When** the completion event is verified, **Then** the matching floral proposal is marked accepted/signed, its `retainer_due_date` is set from the client's signing result, and the lead is moved to Proposal Accepted.
2. **Given** a SignWell recipient declines the document, **When** the decline event is verified, **Then** the matching floral proposal is marked declined and the lead is moved to Proposal Declined with the provider's decline context retained when available.
3. **Given** a per-signer signed event arrives before all required recipients are finished, **When** it is processed, **Then** the lead is not marked Proposal Accepted until the document-completed outcome is received.
4. **Given** the same event is delivered more than once or events arrive out of order, **When** they are processed, **Then** status history remains idempotent and a terminal signed or declined outcome is not incorrectly reversed.
5. **Given** an event cannot be authenticated or cannot be matched to a known provider document, **When** it is received, **Then** it does not change proposal or lead status and is recorded for operational review.

---

### User Story 4 - Show the Newly Sent Proposal First (Priority: P2)

As the florist, I want the newly sent proposal to appear first on the lead detail page so I can immediately verify what was delivered.

**Why this priority**: Accurate proposal ordering keeps the lead history understandable after automated delivery.

**Independent Test**: Send a new proposal for a lead with prior versions and confirm the successful version appears first in the Floral Proposals section with its SignWell delivery status.

**Acceptance Scenarios**:

1. **Given** a lead has prior proposal versions, **When** a new proposal is successfully sent, **Then** the new version appears first in the lead's Floral Proposals history.
2. **Given** finalization fails before SignWell sends the request, **When** the lead detail page is refreshed, **Then** the failed attempt is not represented as a successfully submitted newest version.

### Edge Cases

- The PDF is missing, password-protected, corrupt, not actually a PDF, or exceeds SignWell's current file-size limit.
- The same finalize submission is retried after the browser times out even though SignWell accepted the first request.
- The backend template identifier is missing, points to a deleted/unavailable template, or resolves to a template whose recipient placeholder or API IDs no longer match this contract.
- The SignWell template name matches but its immutable provider identifier does not; the provider identifier remains authoritative.
- The lead has no event date, phone number, ceremony/reception street address, or ceremony/reception ZIP code required by the selected service.
- The event date is fewer than 30 days away, causing the calculated final-balance due date to fall before the contract-send date; the calculated date must still be shown to the florist before send rather than silently changed.
- Ceremony or reception details do not apply to a service type; only fields that the approved template contract treats as optional may be sent blank.
- The client email is syntactically valid in the CRM but SignWell later reports a bounced delivery.
- Storage succeeds but SignWell delivery fails, leaving a retryable stored PDF that must not create a duplicate proposal version or document.
- A webhook arrives before the initial SignWell document reference is fully persisted, is replayed, or arrives after a newer proposal version exists.
- A completed callback omits custom field values, `dateSigned` is blank or invalid, or `dateSigned` and the configured client's provider signing timestamp disagree.
- A template change occurs directly in SignWell after older proposals were sent; historical proposal records must continue to reference the provider document and template used at send time.
- A display service label differs in capitalization, plurality, or wording from the Supabase `service_type` enum; the database value must be normalized before the write.
- PostgREST has not refreshed after additive lead columns are applied; the migration must request a schema-cache reload before CRM saves are tested.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Clicking Finalize Proposal MUST open the PDF submission modal as the next step in the same workflow; the florist MUST NOT have to finalize and then locate a separate Submit Proposal Document action.
- **FR-002**: The modal MUST require exactly one valid finalized Canva proposal PDF and MUST provide cancel, validation, progress, success, and actionable failure states.
- **FR-003**: The original uploaded PDF MUST be stored in the proposal's protected document-storage boundary before external delivery begins.
- **FR-004**: The workflow MUST use one fixed SignWell template, **Black Begonia Floral Contract Template**, for all in-scope floral proposal sends.
- **FR-005**: The SignWell template identifier, client recipient-placeholder reference, API credential, and webhook-verification material MUST be backend-only configuration and MUST NOT be exposed to browser code.
- **FR-006**: The Floral Proposal Builder MUST NOT display or depend on a Contract Template section, template picker, active-template record, or template-mapping editor.
- **FR-007**: The runtime send workflow MUST NOT depend on a CRM-managed contract-template configuration record; provider template details are resolved from backend configuration.
- **FR-008**: Before sending, the system MUST retrieve the targeted lead, finalized proposal version, proposal total, event date, and applicable ceremony and reception address data from the CRM data store.
- **FR-009**: The system MUST populate the case-sensitive SignWell API IDs listed in the SignWell Prefilled Input Field Contract with the defined source values and MUST NOT prefill `dateSigned` or `retainerDueDate`.
- **FR-010**: The system MUST use the lead email as both the `clientEmail` field value and the SignWell recipient email assigned to the configured client placeholder.
- **FR-011**: Required mapped fields MUST be validated before sending; missing or invalid values MUST block delivery and identify the source data that needs correction.
- **FR-012**: Before sending, the system MUST set `final_balance_amount` equal to the proposal `total_amount`, calculate `retainer_amount` as `total_amount × 0.30` rounded to two decimal places, calculate `final_balance_due_date` as 30 calendar days before `event_date`, and persist all three values on the floral proposal.
- **FR-013**: The system MUST create a new client document from the configured SignWell template and include the stored Canva PDF as an additional file in the same signing request.
- **FR-014**: The client signing request MUST use the subject and message configured on the SignWell template unless a later approved requirement explicitly authorizes an override.
- **FR-015**: The request MUST preserve the SignWell template's intended signer roles and MUST apply the required signing order when more than one active recipient must complete the document.
- **FR-016**: The client document MUST be sent through SignWell as part of the successful finalize submission without requiring the florist to open or edit it manually in SignWell.
- **FR-017**: A successful send MUST record the floral proposal version, stored PDF reference, calculated payment fields, SignWell document identifier, template identifier used, recipient email, send timestamp, and current signing status.
- **FR-018**: Finalization MUST be idempotent for the same proposal version so client retries, function retries, or timeouts do not create duplicate SignWell documents or emails.
- **FR-019**: The lead MUST move to Proposal Submitted only after SignWell confirms document creation and send acceptance.
- **FR-020**: New sends under this workflow MUST use SignWell's client email and hosted signing experience; they MUST NOT also send a duplicate Black Begonia proposal-auth email or require the embedded proposal-portal signer.
- **FR-021**: The existing Black Begonia proposal-access flow MAY remain available for previously delivered records, but it is outside the new SignWell email-and-sign workflow.
- **FR-022**: Verified `document_completed` outcomes MUST retrieve or confirm the completed document results, store the client's `dateSigned` value as `retainer_due_date`, move the matching floral proposal to accepted/signed, and move the matching lead to Proposal Accepted.
- **FR-023**: Verified `document_declined` outcomes MUST move the matching floral proposal and lead to their declined statuses and retain the decline reason when supplied.
- **FR-024**: Per-signer completion MUST NOT be treated as full acceptance when other required recipients remain.
- **FR-025**: Webhook processing MUST authenticate provider events using a SignWell-supported verification mechanism; when authenticity cannot be established from the callback alone, the system MUST verify the referenced document state with SignWell before changing CRM status.
- **FR-026**: Webhook handling MUST be idempotent, tolerate retries and out-of-order events, and MUST scope every update to the proposal version associated with the provider document identifier.
- **FR-027**: The newest successfully submitted proposal version MUST appear first in the lead detail Floral Proposals history immediately after delivery succeeds.
- **FR-028**: Historical proposal versions MUST retain their original uploaded PDF, provider document reference, template reference, and terminal outcome even if the fixed template changes later in SignWell.
- **FR-029**: The workflow MUST preserve the manual Canva design/export process, proposal-builder pricing and line-item workflow, lead activity history, and future payment/reporting data needs.
- **FR-030**: Failures after storage but before successful SignWell send MUST remain safely retryable and MUST not falsely report client delivery.
- **FR-031**: Lead records MUST persist four additional business values using the existing venue-field naming convention: `ceremonyAddress` in `leads.ceremony_venue_address`, `ceremonyZipcode` in `leads.ceremony_venue_zipcode`, `receptionAddress` in `leads.reception_venue_address`, and `receptionZipcode` in `leads.reception_venue_zipcode`.
- **FR-032**: Existing CRM lead creation, editing, viewing, validation, models, and proposal-data retrieval MUST support the four new ceremony/reception address values.
- **FR-033**: `ceremonyCityStateZipcode` and `receptionCityStateZipcode` MUST concatenate their respective city, state, and ZIP-code values with normalized punctuation and spacing and MUST never mix ceremony values with reception values.
- **FR-034**: `retainer_due_date` MUST remain empty before client signing and MUST be populated only from the verified client-signing result associated with the completed SignWell document.
- **FR-035**: The fixed SignWell template MUST expose `dateSigned` as a required date field assigned to the configured client placeholder, and the send workflow MUST leave it for the client-signing ceremony rather than passing it as prefilled template data.
- **FR-036**: Every edge function MUST be deployable from its own source without `_shared` files or local shared imports; repository edge-function unit tests are out of scope, while independent type-checking and deployed smoke verification remain required.
- **FR-037**: Existing Supabase databases MUST receive the feature through an additive, repeatable migration that preserves historical data and reloads the PostgREST schema cache after schema changes.
- **FR-038**: The lead edit modal MUST omit the Record Focus and Required For Save cards, use a compact viewport-conscious layout, and expose all lead business fields except identifiers, conversion references, and system-maintained audit metadata.
- **FR-039**: Lead create and update operations MUST translate CRM service display labels to the exact accepted `public.service_type` enum value before writing to Supabase and MUST preserve values that already match the enum.
- **FR-040**: The lead create/edit modal MUST follow the CRM light/dark theme for all surfaces, controls, labels, feedback states, buttons, focus states, shadows, native date/time controls, and scrolling behavior.
- **FR-041**: SignWell webhook callbacks MUST target the deployed Supabase `signwell-webhook` URL with a Black Begonia-generated opaque token; the receiver MUST be externally callable without a Supabase user JWT and MUST authenticate the opaque token itself.
- **FR-042**: Proposal submission MUST validate the stored PDF size and `%PDF-` signature without buffering or base64-encoding the complete file in edge-function memory, and MUST provide SignWell only a short-lived signed URL that preserves private storage access.
- **FR-043**: The SignWell client recipient MUST include a stable request-scoped recipient ID, the lead email, and the exact configured template placeholder. Provider validation failures MUST retain the HTTP status, operation, and redacted field-level details for troubleshooting.
- **FR-044**: The SignWell create-from-template request MUST append the Canva PDF through `files` and MUST omit the optional supplemental `fields` property when no fields are being added to that file.
- **FR-045**: The SignWell request MUST assign the submitting authenticated florist to the exact `Document Sender` template placeholder using recipient ID `"2"` and a backend-configured or CRM/auth-derived name and email, while the client remains recipient ID `"1"`; their normalized email addresses MUST be distinct.
- **FR-046**: Values sent to SignWell DateFields, including `eventDate` and `finalBalanceDueDate`, MUST use full ISO-8601 midnight-UTC timestamps derived from valid `YYYY-MM-DD` source dates; the template's field configuration controls display formatting.
- **FR-047**: While finalization is running, the PDF modal MUST remain visible and locked, show an animated progress indicator, and report only milestones observable by the browser. On failure it MUST return to a retryable state without clearing the selected PDF.

### Constitution Alignment *(mandatory)*

- **Surface**: This feature affects the CRM Floral Proposal Builder, lead proposal history, proposal-related database records, protected proposal storage, backend delivery orchestration, and SignWell webhook processing. It does not intentionally change public website content, forms, styling, SEO, or routing.
- **Product Owner Approval**: Product owner approval is present through this specification for removing the builder's Contract Template section, changing Finalize Proposal into the PDF-and-send entry point, and replacing the new-proposal embedded signing path with SignWell-hosted email delivery. No public-website approval is assumed or required.
- **Brownfield Preservation**: Preserve proposal pricing, line items, version history, manual Canva PDF creation, internal authorization, lead activity, and historical proposal records. The CRM-managed template configuration, separate Submit Proposal Document step, combined-PDF requirement, and embedded signer are explicitly authorized for removal from the new-proposal workflow. Existing legacy proposal-access records remain readable unless a later feature authorizes their migration or removal.
- **Supabase Security**: Affected data includes `leads`, `floral_proposals`, signing-session/document references, lead activity, and protected proposal storage. The current runtime dependency on `proposal_contract_templates` is removed. Lead records gain ceremony/reception street-address and ZIP-code values; proposal records gain `final_balance_amount`, `retainer_amount`, `final_balance_due_date`, and nullable `retainer_due_date`. These values require authenticated CRM writes, appropriate row-level access, and backend-only service access for delivery. Provider credentials and fixed template references remain secrets; uploaded and completed documents remain private.
- **Testing Expectations**: Focused automated Angular coverage is required for the Finalize Proposal modal transition, new lead address fields across create/edit/view behavior, exact service-enum persistence, theme behavior, venue-value concatenation, and proposal calculations. Each standalone edge function requires independent Deno type-checking, while provider-facing PDF validation, field mapping, recipient mapping, attachment inclusion, template-default email behavior, successful send, partial-failure recovery, idempotency, authenticated webhook reconciliation, `dateSigned` retrieval, replayed/out-of-order callbacks, and terminal status transitions are verified through deployed SignWell test-mode smoke scenarios rather than repository edge-function unit-test files.
- **Sensitive Data**: Client names, emails, phones, event locations, payment terms, proposal PDFs, contract documents, signatures, webhook payloads, and provider identifiers must be minimized, encrypted in transit, protected at rest, excluded from client-visible logs, and retained only within approved application and provider boundaries.
- **Proposal Workflow**: The floral proposal builder remains the source of proposal scope and pricing, Canva remains the creative document source, and SignWell becomes the direct contract-filling, packet-delivery, and signing channel. Payment terms used in the contract must remain available for future invoicing and reporting.

### Key Entities *(include if feature involves data)*

- **Floral Proposal Version**: The finalized pricing and scope record associated with one uploaded Canva PDF, one set of authoritative payment terms, and at most one successful SignWell document delivery.
- **Fixed SignWell Template Reference**: Backend-only configuration identifying the Black Begonia Floral Contract Template and the template placeholder assigned to the client recipient.
- **Contract Field Data**: The normalized client, service, event, venue, and payment values mapped to the approved SignWell API IDs.
- **Lead Venue Details**: Ceremony and reception street-address and ZIP-code values stored with the existing venue name, city, and state fields and maintained through CRM lead workflows.
- **Proposal PDF Artifact**: The florist-created Canva PDF stored privately and appended to the SignWell document created for that proposal version.
- **SignWell Document Delivery**: The provider-side document instance containing the filled template and appended proposal PDF, recipient assignment, send outcome, and signing status.
- **Signing Outcome Event**: A verified provider event associated with one SignWell document and used idempotently to save the client signing date and update the matching proposal, lead, and activity history.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of tested eligible proposals, clicking Finalize Proposal opens the Canva PDF upload modal without requiring a separate submission action.
- **SC-002**: In 100% of successful test sends, exactly one original proposal PDF is stored and exactly one signing request is sent to the lead's email for that proposal version.
- **SC-003**: In 100% of field-mapping tests with complete source data, all 13 approved prefilled contract fields contain the expected client, event, venue, and payment values.
- **SC-004**: In 100% of missing-required-data tests, no signing request is sent and the florist receives a field-specific correction message.
- **SC-005**: In 100% of successful delivery tests, the client signing packet contains the filled Black Begonia Floral Contract Template and the uploaded Canva proposal PDF.
- **SC-006**: In 100% of successful delivery tests, the client receives the template-configured signing email without a duplicate Black Begonia proposal-auth email.
- **SC-007**: In 100% of completed-document and declined-document callback tests, the matching proposal and lead reach the correct terminal status within one minute, completed proposals store the verified client signing date as the retainer due date, and duplicate event delivery creates no duplicate history entry.
- **SC-008**: In 100% of multi-recipient tests, a per-signer signed event does not mark the lead accepted before the document is completed by all required recipients.
- **SC-009**: In 100% of tested lead detail pages, the newest successfully sent floral proposal version appears first immediately after delivery succeeds.
- **SC-010**: A florist can finalize and send an otherwise complete proposal in under two minutes, excluding the time spent exporting the PDF from Canva.
- **SC-011**: In 100% of tested lead edits, all changed non-metadata business fields persist without enum-related HTTP 400 responses, and the modal remains legible and operable in both CRM themes.

## Assumptions

- SignWell's current create-document-from-template capability supports prepopulated template fields, additional files, direct sending, template-default subject/message behavior, signing order, decline handling, webhooks, and completed-document retrieval, so no alternate signing provider is required for this workflow.
- The template's provider UUID, not its display name, is the authoritative lookup value. The configured client placeholder name or identifier is also required; the template name and field API IDs alone are insufficient to assign the SignWell recipient.
- The listed API IDs refer to prefillable text/date fields. Signature and initials fields are completed by recipients or retained as approved pre-signed template content; Black Begonia does not apply a recipient signature through the API.
- SignWell appends supplemental files after template files. The expected provider-side packet order is therefore the contract template followed by the Canva proposal PDF unless a later requirement explicitly introduces pre-composition or a different provider workflow.
- SignWell sends the signature-request email from its own delivery domain. The subject, message, branding, and permitted sender-signature presentation are governed by the account plan and template settings.
- The current lead schema already contains client names, email, phone, service type, event date, venue names, and venue city/state. This feature adds `ceremony_venue_address`, `ceremony_venue_zipcode`, `reception_venue_address`, and `reception_venue_zipcode` and carries them through existing CRM lead functionality.
- `final_balance_amount` represents the full finalized proposal `total_amount`, even though the field name could otherwise imply the post-retainer remainder. `retainer_amount` is separately stored as 30% of that same total.
- `retainer_amount` is rounded to two decimal places using the application's established currency-rounding behavior, and `final_balance_due_date` uses calendar-date arithmetic against the stored event date.
- `retainer_due_date` is null until verified completion. The SignWell `dateSigned` field is a required client-assigned result, and the configured client's provider `signed_at` value is available as corroborating or recovery data rather than a value injected before send.
- Provider field requiredness and service applicability must be confirmed against the completed Black Begonia Floral Contract Template. Optional ceremony or reception fields may be blank only when that matches the approved template rules for the selected service.
- A SignWell `document_completed` event, rather than a per-recipient `document_signed` event, is the authoritative accepted outcome when more than one recipient is involved.
- Supabase Storage is the protected object-storage boundary referred to by the business as Supabase S3 storage.
