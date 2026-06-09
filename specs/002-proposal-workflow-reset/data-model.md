# Data Model: Proposal Workflow Reset

## Lead Consultation

**Purpose**: Represents the completed sales context that allows the florist to begin the floral proposal workflow from the lead detail experience.

**Fields**:

- `lead_id`: Unique lead identifier.
- `status`: Lead workflow state controlling builder eligibility.
- `customer identity fields`: Name, email, partner, and event details already used by proposal workflows.

**Validation Rules**:

- The builder entry point is available only for lead states authorized by the workflow.
- The lead context used in the builder and client review must remain unchanged by template removal.

## Floral Proposal Data

**Purpose**: The structured proposal record captured in the floral proposal builder and preserved for reporting, history, and downstream financial workflows.

**Fields**:

- `floral_proposal_id`: Unique proposal identifier.
- `lead_id`: Parent lead relationship.
- `version`: Sequential proposal version per lead.
- `status`: Draft, finalized, submitted, declined, accepted, or other approved lifecycle states.
- `is_active`: Whether this is the current proposal version for the lead.
- `tax_region_id`: Tax context for totals.
- `pricing inputs`: Default markup percent and labor percent captured in the proposal snapshot.
- `line_items[]`: Structured proposal rows with type, quantity, description, pricing, image metadata, and display order.
- `components[]`: Catalog composition records per product line item.
- `shopping_list[]`: Derived purchasing view preserved for planning history.
- `totals`: Subtotal, tax rate, tax amount, and total amount.
- `snapshot`: Builder-derived structured state needed for later review and reporting.

**Validation Rules**:

- Proposal data remains the system of record even after document submission.
- Template-specific fields may become optional or retired, but structured pricing and line-item data must remain intact.
- Every resubmission cycle must preserve prior proposal history and version continuity.

## Finalized Proposal Data

**Purpose**: A locked proposal-data checkpoint indicating the florist has finished editing proposal data and may now either reopen editing or submit a proposal document.

**Fields**:

- `floral_proposal_id`
- `status = finalized`
- `finalized_at`: Timestamp recorded when data is locked.
- `finalized_snapshot`: The effective builder data at finalization time.
- `allowed_next_actions`: `Edit Proposal Data` or `Submit Proposal Document`.

**Validation Rules**:

- Finalized proposal data must not accept silent inline edits.
- Submitting a client document must only be allowed from finalized data.
- Reopening a finalized proposal returns it to an editable state and requires re-finalization before any replacement document submission.

## Proposal Document Submission

**Purpose**: The florist-supplied client-facing PDF that is attached to finalized proposal data for delivery into the existing proposal approval cycle.

**Fields**:

- `floral_proposal_id`
- `pdf_source`: Manual upload or optional Canva import.
- `pdf_storage_path`: Storage location for the submitted client document.
- `pdf_file_name`
- `submitted_at`
- `submitted_by`
- `document_version_context`: Proposal version and finalized data revision associated with the PDF.

**Validation Rules**:

- A valid PDF is required for submission.
- Manual upload must always be available.
- Optional Canva import must never be the only submission path.
- A replacement document after decline must only be accepted after proposal-data edit and re-finalization.

## Re-finalization Cycle

**Purpose**: The state transition that keeps stored proposal data and client-facing proposal documents aligned after a decline or requested revision.

**Fields**:

- `prior_submission_status`
- `edit_reopened_at`
- `re_finalized_at`
- `replacement_submission_at`
- `replacement_reason`: Decline, correction, or requested revision.

**Validation Rules**:

- A declined or outdated proposal cannot accept a replacement PDF while its prior finalized data remains unchanged.
- The florist must return through builder editing and finalization before replacement submission is enabled again.

## Client Proposal Cycle

**Purpose**: The existing client-authenticated approval and decline workflow that begins after a proposal document is submitted.

**Fields**:

- `access credentials`: Email plus passcode-driven access.
- `submitted proposal version`
- `client response status`: Submitted, declined, accepted, signed, or related downstream state.
- `response timestamps`: Submitted, declined, accepted, signed.
- `response metadata`: Signature, decline feedback, and portal activity data already captured today.

**Validation Rules**:

- Template retirement must not change client-access authentication expectations.
- Client decline must feed the florist back into the re-finalization cycle.
- Accepted proposal records must remain available for reporting and future payment-adjacent workflows.

## Retired Template Feature

**Purpose**: Any route, component, model, service, repository, schema field, or edge-function dependency whose only business role was in-app proposal-template authoring or generated-template PDF creation.

**Fields**:

- `artifact_path`
- `artifact_type`: Route, component, service, repository, model field, schema object, or test.
- `retirement_strategy`: Delete, stop referencing, null legacy field, or staged schema cleanup.
- `replacement_behavior`: None, builder-owned data capture, or optional simplified Canva import.

**Validation Rules**:

- An artifact may be retired only if removing it does not break builder data capture or client review continuity.
- Runtime dependencies on retired template artifacts must be removed before schema or storage cleanup is finalized.

## State Transitions

- `Lead Consultation`: Consultation complete -> Eligible for `Build Floral Proposal`.
- `Floral Proposal Data`: Draft -> Finalized -> Submitted -> Declined -> Edit reopened -> Re-finalized -> Resubmitted -> Accepted.
- `Proposal Document Submission`: Not attached -> Attached and submitted -> Declined/outdated -> Replaced after re-finalization.
- `Client Proposal Cycle`: Submitted -> Declined or Accepted.
- `Retired Template Feature`: Active dependency -> Runtime reference removed -> UI removed -> Data/schema cleanup complete.
