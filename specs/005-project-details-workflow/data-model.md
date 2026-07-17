# Data Model: Project Details Workflow

## Project

Represents a booked CRM project.

**Existing fields used**:
- `project_id`
- `project_name`
- `service_type`
- `event_type`
- `event_date`
- `ceremony_venue_*`
- `reception_venue_*`
- `budget_range`
- `guest_count`
- `style_notes`
- `internal_notes`
- `status`
- `source_lead_id`
- `primary_contact_id`
- `assigned_user_id`
- `active_proposal_invoice_snapshot_id`
- `active_proposal_document_version_id`
- `booked_at`
- `completed_at`
- `canceled_at`
- `created_at`
- `updated_at`

**Status values**:
- `awaiting_deposit`
- `booked`
- `awaiting_final_payment`
- `final_prep`
- `completed`
- `canceled`

**Validation rules**:
- Project name is required.
- Service type is required.
- Event type and event date may be null for legacy or incomplete projects.
- Source lead relationship remains stored but raw source lead UUID is not displayed on project details.
- Edit modal may update project name, event type, service type, event date, venue/location fields, style notes, internal notes, and status only.
- Edit modal may not update source lead, proposal document, proposal invoice snapshot, or payment record relationships.

**State transitions**:
- Lead conversion with signed contract and no deposit creates or updates project as `awaiting_deposit`.
- Deposit paid moves project to `booked`.
- Booked project automatically moves to `awaiting_final_payment` 45 days before event date when final payment is not paid.
- Final payment paid moves project to `final_prep`.
- Project may move to `completed` or `canceled` from active operational statuses.
- Automatic 45-day refresh does not apply to `awaiting_final_payment`, `final_prep`, `completed`, or `canceled`.

## Project Payment Record

Represents a deposit or final payment obligation/receipt for a project.

**Proposed fields**:
- `project_payment_record_id`: UUID primary key.
- `project_id`: required project relationship.
- `payment_kind`: `deposit` or `final_payment`.
- `status`: `not_due`, `due`, `paid`, `waived`, or `canceled`.
- `amount_due`: numeric currency amount.
- `amount_paid`: numeric currency amount, default `0`.
- `due_date`: date, nullable.
- `paid_date`: timestamp/date, nullable.
- `payment_method`: `stripe`, `venmo`, `check`, `cash`, `other`, or null before payment.
- `payment_source`: `manual`, `stripe`, or `imported`.
- `external_payment_id`: nullable text for future Stripe/payment provider reference.
- `notes`: nullable text.
- `recorded_by`: nullable profile relationship.
- `created_at`
- `updated_at`

**Validation rules**:
- One active deposit and one active final-payment record should exist per project unless explicitly canceled/replaced.
- Paid records require `paid_date`, `amount_paid`, and payment method/source.
- Manual records may use Venmo, check, cash, or other.
- Stripe data is optional and not required for this feature.

**Status effects**:
- Deposit payment marked `paid` moves project to `booked` unless project is completed/canceled.
- Final payment marked `paid` moves project to `final_prep` unless project is completed/canceled.
- Unpaid final payment on a booked project causes the 45-day refresh to move project to `awaiting_final_payment` when event date is within 45 days.

## Proposal Invoice Snapshot

Represents saved project-owned invoice/planning totals.

**Existing fields used**:
- `project_proposal_invoice_snapshot_id`
- `project_id`
- `source_lead_id`
- `source_floral_proposal_id`
- `version`
- `snapshot`
- `subtotal`
- `discount_amount`
- `tax_amount`
- `total_amount`
- `deposit_amount`
- `final_balance_amount`
- `final_balance_due_date`
- `is_active`
- `created_by`
- `created_at`

**Rules**:
- Most recent active snapshot drives the financial summary and comparison.
- Previous snapshots remain available for revision comparison.
- Snapshot records are not edited by the project edit modal.

## Proposal Document Version

Represents the initial signed proposal/services agreement or a later revised proposal PDF.

**Existing fields used**:
- `project_proposal_document_version_id`
- `project_id`
- `source_lead_id`
- `source_floral_proposal_id`
- `invoice_snapshot_id`
- `version`
- `file_name`
- `storage_bucket`
- `storage_path`
- `submitted_at`
- `uploaded_by`
- `is_active`
- `status`
- `created_at`

**Derived display groups**:
- Version `1` or first booking document: Initial Proposal and Services Agreement.
- Versions greater than initial: Revised Proposals.
- Initial document becomes display-inactive when revised proposal documents exist.
- Most recent submitted revised proposal is display-active.

**Rules**:
- The initial signed proposal/services agreement is permanent and not overwritten by revisions.
- Revised proposal documents do not imply a new signed services agreement.
- PDF opening uses short-lived signed URLs from private storage.

## Project Activity

Represents project timeline entries.

**Existing table**: `activity_log`

**Events to show**:
- Project created or lead converted to project.
- Project fields edited.
- Project status changed.
- Deposit or final payment recorded/updated.
- Proposal revision submitted.
- Proposal document uploaded.
- Active invoice snapshot changed.

**Rules**:
- Timeline shows newest first or a clearly chronological order chosen by UI; the quickstart validates the most recent event is easy to identify.
- Manual notes are not included in first release.
- Missing activity records produce an empty state, not a blocking error.

## Revision Comparison

Read model combining two proposal invoice snapshots and/or document versions.

**Compared fields**:
- Version number.
- Submitted date.
- Document status.
- Active/inactive state.
- File name.
- Total amount.
- Subtotal, tax, discount, deposit, and final balance when available.

**Rules**:
- Comparison is metadata/invoice only.
- PDF text extraction and visual PDF comparison are out of scope.
- If one selected version lacks snapshot data, show available document metadata and explain the limitation.

## Financial Summary

Read model for project details.

**Fields**:
- Active proposal total.
- Deposit amount due/paid/status/due date.
- Final payment amount due/paid/status/due date.
- Outstanding balance.
- Active invoice snapshot version.

**Rules**:
- Distinguish missing values from zero-dollar values.
- Prefer active invoice snapshot values for proposal totals.
- Payment records drive deposit/final-payment status when available.
