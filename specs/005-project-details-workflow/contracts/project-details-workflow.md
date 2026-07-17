# Contract: Project Details Workflow

## CRM UI Contract

### Projects list

**Entry point**: `/admin/projects`

**Preconditions**:
- Authenticated internal CRM user.

**Visible table columns**:
- Project
- Service Type
- Event Date
- Status
- Actions

**Search behavior**:
- Search project name, service type, event type, event date display text, status label, venue/location fields, and related obvious project text already loaded for the list.
- Search should follow the leads table style: trim, lowercase, and broad substring matching across supported fields.

**Filters**:
- Status: All, Awaiting Deposit, Booked, Awaiting Final Payment, Final Prep, Completed, Canceled.
- Event Type: All plus event types present in loaded projects.
- Service Type: All plus service types present in loaded projects.
- Reset clears search and all filters.

**Actions**:
- View/open project details.

**Empty/error states**:
- No projects: show a friendly empty state.
- No filter results: show an empty result state and keep reset available.
- Load failure: show an error state without exposing sensitive backend details.

### Project details

**Entry point**: `/admin/projects/:projectId`

**Preconditions**:
- Authenticated internal CRM user.
- Project exists and user is authorized through CRM RLS.

**Header/quick actions**:
- Edit project information.
- Revise proposal.
- Open active proposal PDF when available.

**Required sections**:
- Project summary/details.
- Financial summary card.
- Proposal documents.
- Project activity timeline.

**Hidden data**:
- Raw `source_lead_id` must not be displayed.

**Errors**:
- Missing project: show not-found or load error and provide return path to projects list.
- Missing optional financial/document/activity data: show section-level empty state while keeping the rest of the details page usable.

### Edit project information modal

**Editable fields**:
- Project name.
- Event type.
- Service type.
- Event date.
- Venue/location fields.
- Style notes.
- Internal notes.
- Status.

**Non-editable fields**:
- Source lead relationship.
- Proposal documents.
- Proposal invoice snapshots.
- Project payment records.

**Flow**:
1. User opens modal from project details quick action.
2. Current values are prefilled.
3. User saves valid changes.
4. Project details refresh with saved values.
5. Project activity records the update/status change when applicable.

**Cancellation**:
- Closing/canceling the modal makes no changes.

### Manual payment logging

**Entry point**: project details financial summary.

**Supported records**:
- Deposit.
- Final payment.

**Fields**:
- Amount due.
- Amount paid.
- Due date.
- Paid date.
- Status.
- Payment method/source.
- Optional notes.

**Manual methods**:
- Venmo.
- Check.
- Cash.
- Other.

**Out of scope**:
- Stripe checkout.
- Payment details routes/screens.
- Payment refunds/disputes.

**Status effects**:
- Deposit paid moves eligible projects to Booked.
- Final payment paid moves eligible projects to Final Prep.
- Booked projects with unpaid final payment move to Awaiting Final Payment 45 days before event date.

### Proposal documents

**Single document behavior**:
- If only the initial proposal and services agreement exists, show it without tabs.

**Revision behavior**:
- If revised proposal documents exist, show tabs:
  - Initial Proposal and Services Agreement.
  - Revised Proposals.

**Initial tab**:
- Shows the original signed proposal/services agreement.
- Marks it inactive once revised proposals exist.

**Revised proposals tab**:
- Shows revised proposals oldest to most recent.
- Marks the most recent submitted revised proposal as active.

**Columns**:
- Version.
- File.
- Submitted.
- Status.
- Action: Open PDF.

### Revision comparison

**Entry point**: proposal documents section when multiple revised proposals exist.

**Compare fields**:
- Version.
- Submitted date.
- Document status.
- Active/inactive state.
- File name.
- Proposal totals and available invoice summary values.

**Out of scope**:
- PDF text extraction.
- Visual PDF diffing.

**Errors**:
- Missing invoice snapshot for a selected version: compare available document metadata and explain missing invoice comparison.

## Supabase Data Contract

### `projects`

Project status values must support:
- `awaiting_deposit`
- `booked`
- `awaiting_final_payment`
- `final_prep`
- `completed`
- `canceled`

Legacy project statuses must be mapped during migration without deleting project records.

### `project_payment_records`

Required for project-level deposit and final-payment tracking.

Minimum fields:
- `project_payment_record_id`
- `project_id`
- `payment_kind`
- `status`
- `amount_due`
- `amount_paid`
- `due_date`
- `paid_date`
- `payment_method`
- `payment_source`
- `external_payment_id`
- `notes`
- `recorded_by`
- `created_at`
- `updated_at`

RLS:
- Authenticated internal CRM users can select, insert, and update.
- Delete should be restricted or soft-delete/cancel should be preferred unless current CRM policy intentionally allows delete for internal users.

### Status refresh

The implementation must provide an idempotent way to refresh project statuses before project list/detail data is presented:
- Booked + event date within 45 days + final payment not paid -> Awaiting Final Payment.
- Completed, Canceled, Awaiting Final Payment, and Final Prep are not changed by the 45-day refresh.

### Activity log

Project timeline reads `activity_log` entries for `entity_type = 'project'`.

Expected activity labels/types:
- Project created.
- Project updated.
- Status changed.
- Payment recorded.
- Proposal revision submitted.
- Proposal document submitted.
- Active invoice snapshot changed.

Activity events must avoid storing secrets or full PDF contents in metadata.
