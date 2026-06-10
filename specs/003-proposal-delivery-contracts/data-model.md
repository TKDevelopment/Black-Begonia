# Data Model: Proposal Delivery and Embedded SignWell Signing

## 1. Floral Proposal

Represents the authoritative proposal record already stored in Black Begonia and extended for canonical package delivery plus embedded signing history.

### Core fields

- `floral_proposal_id`
- `lead_id`
- `version`
- `is_active`
- `status`
- `customer_email`
- `pdf_storage_path`
- `pdf_url`
- `subtotal`
- `tax_rate`
- `tax_amount`
- `total_amount`
- `finalized_at`
- `submitted_at`
- `accepted_at`
- `declined_at`
- `snapshot`

### New or extended delivery-signing fields

- `combined_pdf_storage_path`
  Purpose: points to the canonical combined proposal package used for portal review and embedded signing.
- `combined_pdf_file_name`
  Purpose: client-visible package file name for review and downloads.
- `contract_template_source`
  Purpose: identifies the active SignWell contract template selected for this proposal.
- `contract_template_revision`
  Purpose: records the exact SignWell contract revision used at submission time.
- `signing_provider`
  Purpose: identifies the signing provider used for the proposal package.
- `signing_status`
  Allowed values:
  - `not_started`
  - `ready`
  - `viewed`
  - `signed`
  - `declined`
  - `failed`
- `signing_session_reference`
  Purpose: stores the active SignWell document or embedded session reference needed by the portal and webhook handlers.
- `signed_package_storage_path`
  Purpose: points to the final signed combined package if SignWell returns a signed artifact.
- `signing_completed_at`
  Purpose: records when required signatures were completed.
- `signing_declined_at`
  Purpose: records when the signing session was explicitly declined or abandoned by decision rather than portal exit.

### Relationships

- Belongs to one `Lead`
- Has many `FloralProposalLineItem`
- Has many `FloralProposalComponent` through line items
- Has zero or one active `ProposalSigningSession`
- References one `SignWellContractTemplateConfig` at submission time

### State transitions

- `draft` -> `submitted`
- `submitted` -> `accepted`
- `submitted` -> `declined`
- `declined` -> `draft` through edit plus re-finalize
- Signing state evolves independently from delivery creation:
  - `not_started` -> `ready` -> `viewed` -> `signed`
  - `ready` or `viewed` -> `declined`
  - any in-flight state -> `failed`

## 2. SignWell Contract Template Config

Represents the CRM-side designation of which SignWell contract template is active for floral proposals.

### Fields

- `proposal_contract_template_id`
- `provider`
  Expected initial value: `signwell`
- `provider_template_id`
- `provider_template_name`
- `provider_template_revision`
- `is_active`
- `display_name`
- `description`
- `required_field_map`
  Purpose: stores the supported mapping between Black Begonia source fields and SignWell field identifiers.
- `created_by`
- `created_at`
- `updated_at`

### Validation rules

- Only one active template is allowed for floral proposal submissions at a time.
- `provider_template_id` must be unique within the provider.
- Required mapping entries must exist for all contract fields designated mandatory by the signing workflow.

### Relationships

- Can be referenced by many historical `FloralProposal` records
- Only one configuration may be active for new submissions at a time

## 3. Proposal Signing Session

Represents the per-proposal signing orchestration state used to embed and reconcile SignWell activity with CRM records.

### Fields

- `proposal_signing_session_id`
- `floral_proposal_id`
- `provider`
- `provider_document_id`
- `provider_embedded_session_id`
- `provider_signer_reference`
- `status`
- `last_synced_at`
- `last_error_message`
- `webhook_payload_snapshot`
- `created_at`
- `updated_at`

### Validation rules

- One active in-flight signing session per active floral proposal.
- `status` must stay aligned with the parent floral proposal's delivery state.
- Webhook reconciliation must never change historical proposal versions other than the targeted active signing record.

### Relationships

- Belongs to one `FloralProposal`

## 4. Proposal Package Artifact

Represents storage-backed documents associated with the proposal lifecycle.

### Fields

- `artifact_type`
  Allowed values:
  - `proposal_pdf_original`
  - `contract_pdf_filled`
  - `proposal_package_combined`
  - `proposal_package_signed`
- `storage_path`
- `file_name`
- `source_provider`
- `created_at`

### Notes

- This may be implemented as explicit columns plus snapshot metadata on `FloralProposal`, or as a dedicated artifact table if query needs justify it.
- Historical proposal packages must remain immutable once delivered.

## 5. Lead Proposal List Ordering

Represents the CRM projection used on the lead detail page.

### Ordering rules

- Newest submitted version first
- If a draft is re-used and submitted, the lead detail view must still surface it as the newest relevant proposal
- Historical records remain visible but sorted below the newest version

### Operational rule

- The lead detail page should not rely on stale client-side ordering assumptions after submission; it must be driven by the updated proposal records returned from the repository layer
