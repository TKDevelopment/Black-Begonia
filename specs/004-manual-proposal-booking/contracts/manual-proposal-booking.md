# Contract: Manual Proposal Booking

## CRM UI Contract

### Finalize proposal from lead

**Entry point**: `/admin/leads/:leadId/floral-proposal-builder`

**Preconditions**:
- Authenticated CRM user.
- Lead is eligible for proposal finalization and is not already converted to an unrelated project.
- Builder has current invoice/planning data.

**Flow**:
1. User clicks `Finalize Proposal`.
2. Modal opens with PDF drag/drop and file picker.
3. User selects one PDF.
4. User clicks submit.
5. Confirmation alert warns that the PDF will be stored and the lead will be converted into a booked project.
6. On confirmation, submission begins.
7. Success navigates to or exposes the booked project with active proposal document and invoice snapshot.

**Errors**:
- Non-PDF file: inline validation.
- Missing file: submit disabled or inline validation.
- Upload/storage failure: modal stays open with retry.
- Lead no longer eligible: blocking error with refresh guidance.

### Finalize proposal revision from project

**Entry point**: project proposal builder or project view action.

**Preconditions**:
- Authenticated CRM user.
- Existing booked project.
- Builder data may have changed from the prior active snapshot.

**Flow**:
1. User finalizes revised builder data.
2. User uploads the newly signed PDF.
3. Confirmation warns that this will become the active project proposal/invoice snapshot.
4. Success creates a new active proposal document version and active invoice snapshot.
5. Previous versions remain in project history.

## Edge Function Contract: `submit-floral-proposal`

The existing function name may be retained for compatibility with CRM service code, but its SignWell behavior is removed.

### Request

```json
{
  "mode": "initial_booking",
  "lead_id": "uuid",
  "project_id": null,
  "floral_proposal_id": "uuid",
  "pdf_storage_path": "projects/{project-id-or-pending}/proposal-documents/v1.pdf",
  "pdf_file_name": "Smith Wedding Signed Proposal.pdf",
  "idempotency_key": "client-generated-key"
}
```

For project revision:

```json
{
  "mode": "project_revision",
  "lead_id": "uuid-or-null",
  "project_id": "uuid",
  "floral_proposal_id": "uuid",
  "pdf_storage_path": "projects/{project-id}/proposal-documents/v2.pdf",
  "pdf_file_name": "Smith Wedding Signed Proposal Revision 2.pdf",
  "idempotency_key": "client-generated-key"
}
```

### Success Response

```json
{
  "success": true,
  "project_id": "uuid",
  "lead_id": "uuid",
  "floral_proposal_id": "uuid",
  "proposal_document_version_id": "uuid",
  "active_invoice_snapshot_id": "uuid",
  "signed_pdf_storage_path": "projects/{project-id}/proposal-documents/v1.pdf",
  "submitted_at": "iso-8601"
}
```

### Error Responses

- `400`: invalid request body, missing PDF path, invalid file type, or malformed UUID.
- `401`/`403`: unauthenticated or unauthorized CRM user.
- `409`: duplicate idempotency key or concurrent active version conflict.
- `422`: lead/project/proposal is not eligible for requested mode.
- `500`: storage verification, database transaction, or conversion failure.

### Removed Response Fields

The response must not include `signwell_document_id`, embedded signing URLs, passcodes, provider status, proposal-access links, or email delivery metadata.

## Removed Public/Client Contracts

The following contracts are retired:
- `verify-floral-proposal-access`
- `submit-floral-proposal-response`
- `signwell-webhook`
- proposal access email delivery through `send-proposal-email` and `resend-floral-proposal-email`
- Angular proposal-access auth/review routes

Legacy proposal-access URLs must return not found or inaccessible behavior.

## Storage Contract

- Bucket remains private.
- Accepted MIME type: `application/pdf`.
- Maximum size follows the configured Supabase storage policy, currently 50 MB unless changed by migration.
- Object metadata or database rows must identify project, source proposal, document version, uploader, and submission timestamp.
