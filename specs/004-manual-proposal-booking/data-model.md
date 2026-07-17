# Data Model: Manual Proposal Booking

## Lead

Represents the original inquiry and remains as converted history after booking.

**Key fields**:
- `lead_id`
- `status`
- `converted_project_id`
- `converted_primary_contact_id`
- `converted_at`
- existing event, contact, venue, planner, budget, guest count, and notes fields

**Rules**:
- A booked lead is excluded from active lead pipeline views.
- Conversion links must point to the booked project and primary contact.
- Lead inquiry context is preserved unless explicitly obsolete signing/portal data is being removed.

## Project

Represents the booked event after the signed PDF is submitted.

**Existing key fields**:
- `project_id`
- `project_name`
- `service_type`
- `event_type`
- `event_date`
- venue fields
- `budget_range`
- `guest_count`
- `style_notes`
- `internal_notes`
- `status`
- `source_lead_id`
- `primary_contact_id`
- `assigned_user_id`
- `booked_at`

**New/updated relationships**:
- active proposal invoice snapshot
- active proposal document version
- project proposal document history

**Rules**:
- Initial confirmed submission sets project status to booked.
- A project may receive later proposal revisions.
- Exactly one proposal document version and one invoice snapshot are active for project financial outlook at a time.

## Floral Proposal Invoice Data

Represents editable builder/planning data for lead and project proposal work.

**Preserved data**:
- tax region
- markup and labor percentages
- line items
- components/catalog item references
- shopping list preview/export data
- subtotals, tax, total, retainer, final balance, and due dates
- finalized builder snapshot values that support invoice history

**Removed data**:
- passcode hash
- SignWell provider/status/session references
- signing completion/decline timestamps
- accepted terms/privacy fields
- signature name/IP/user agent
- decline feedback
- signed package storage path tied to provider completion

**Rules**:
- Builder data remains editable after booking.
- Confirming a signed PDF revision captures the current builder data into a new project invoice snapshot.

## Project Proposal Document Version

Stores each signed floral proposal/services agreement PDF submitted for a project.

**Fields**:
- `project_proposal_document_version_id`
- `project_id`
- `source_lead_id`
- `source_floral_proposal_id`
- `invoice_snapshot_id`
- `version`
- `file_name`
- `storage_bucket`
- `storage_path`
- `content_type`
- `file_size_bytes`
- `uploaded_by`
- `submitted_at`
- `is_active`
- `created_at`

**Rules**:
- Only PDF files are accepted.
- Storage paths are private and project-oriented.
- New confirmed submissions deactivate the previous active document version for that project.
- Historical versions remain readable from the project view for authorized CRM users.

## Project Proposal Invoice Snapshot

Stores the financial/planning state captured at each confirmed signed PDF submission.

**Fields**:
- `project_proposal_invoice_snapshot_id`
- `project_id`
- `source_lead_id`
- `source_floral_proposal_id`
- `version`
- `snapshot`
- `subtotal`
- `tax_rate`
- `tax_amount`
- `total_amount`
- `retainer_amount`
- `final_balance_amount`
- `retainer_due_date`
- `final_balance_due_date`
- `created_by`
- `created_at`
- `is_active`

**Rules**:
- Exactly one invoice snapshot is active per project.
- The active snapshot is the source for future income/expense dashboard calculations.
- Historical snapshots remain immutable once captured.

## Retired Proposal Signing Session

`proposal_signing_sessions` and associated provider data are removed.

**Rules**:
- No SignWell document IDs, embedded sessions, provider signer references, send states, webhook payload snapshots, or idempotency keys remain in the active schema.
- Existing rows are hard-deleted by cleanup migration.

## State Transitions

1. Active lead with proposal builder data -> florist clicks `Finalize Proposal`.
2. Florist uploads signed PDF -> confirms booking warning.
3. System stores PDF privately, captures invoice snapshot, creates/updates booked project, links converted lead, and marks the new document/snapshot active.
4. Booked project proposal revision -> florist edits builder data -> uploads revised signed PDF -> system creates new active document/snapshot and preserves previous versions.

## Validation

- Submission requires authenticated CRM user.
- Submission requires an eligible lead for initial booking or an existing project for revision.
- Uploaded document must be a PDF and must respect storage size/MIME policy.
- Duplicate submission retries must not create multiple booked projects or multiple active versions for the same confirmation.
- Legacy proposal-access URLs and passcodes do not grant access.
