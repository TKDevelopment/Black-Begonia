# Contract: Proposal Document Submission Workflow

## Purpose

Defines the workflow contract between the CRM floral proposal builder, the proposal submission boundary, and the existing client approval or decline cycle after proposal-template functionality is retired.

## Workflow Preconditions

Before a proposal document can be submitted:

- The florist must have entered the floral proposal workflow from an eligible lead consultation.
- Proposal data must exist in the builder as structured proposal records.
- Proposal data must be finalized and locked.
- A valid proposal PDF must be available.

## Allowed Florist Actions by State

### Draft

Allowed actions:

- Edit proposal data
- Save draft
- Export proposal information
- Finalize proposal

Blocked actions:

- Submit proposal document

### Finalized

Allowed actions:

- Edit Proposal Data
- Submit Proposal Document

Blocked actions:

- Silent inline proposal-data changes
- Replacement document submission without reopening editing

### Declined or Revision Needed

Allowed actions:

- Edit Proposal Data
- Re-finalize proposal data
- Submit a replacement proposal PDF after re-finalization

Blocked actions:

- Uploading a replacement PDF while prior finalized data is still the active locked state

## Submission Inputs

Required:

- `floral_proposal_id`
- `lead_id`
- `proposal version`
- `finalized proposal data snapshot`
- `valid PDF document`
- `customer_email`
- `pricing totals`
- `line_items`
- `shopping_list_items` when available

Optional:

- `tax_region_id`
- `optional Canva import metadata`
- `proposal notes or snapshot metadata`

Retired inputs:

- Template selection as a required step
- Template-rendered HTML as a required submission artifact
- Template-generated PDF as the primary submission artifact

## Submission Rules

- Manual PDF upload must always be accepted as the primary submission path.
- Optional Canva import may be offered only as a secondary convenience path.
- The system must reject document submission when proposal data is not finalized.
- The system must reject non-PDF documents.
- The system must preserve the existing proposal approval or decline workflow after a valid submission.

## Submission Outputs

Successful submission must produce:

- An active submitted proposal version linked to the finalized proposal data
- A stored proposal PDF in the approved proposal storage location
- The same client notification and proposal-access workflow currently used for proposal delivery
- Lead status progression into the submitted proposal state
- Proposal history and activity records showing the submission event

## Resubmission Rules

- After a decline or requested revision, the florist must return to proposal-data editing first.
- A replacement proposal document is valid only after the proposal data is re-finalized.
- The new submission must continue the same client approval or decline cycle without requiring the florist to recreate the proposal from scratch.

## Invariants

- The floral proposal builder remains the authoritative source of structured proposal data.
- Client-facing proposal documents must not diverge from the latest finalized proposal data.
- Retiring proposal-template functionality must not break proposal-auth or proposal-review access.
- Future reporting and payment-adjacent workflows must still be able to rely on stored proposal data, totals, line items, and version history.
