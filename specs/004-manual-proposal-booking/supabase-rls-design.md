# Supabase RLS Design: Manual Proposal Booking

## Scope

This feature adds project-owned proposal invoice snapshots and proposal document versions, and extends projects with active proposal snapshot/document references.

## Roles

- `authenticated` CRM users: may read and write proposal booking records only when `public.is_internal_crm_user()` returns true.
- Supabase Edge Functions using the service role: may perform transactional booking/revision operations after authenticating the caller.
- Anonymous/public users: no access to proposal snapshots, document versions, project proposal references, or signed PDFs.

## Tables

### `project_proposal_invoice_snapshots`

- RLS enabled.
- Internal CRM users can select, insert, update, and delete rows.
- Application code treats historical snapshots as immutable after creation except for active-flag transitions during a confirmed revision.

### `project_proposal_document_versions`

- RLS enabled.
- Internal CRM users can select, insert, update, and delete rows.
- Application code only marks one document version active per project.

### `projects`

- Existing project access remains internal CRM only.
- New active snapshot/version columns are read by CRM project views and updated by the booking/revision edge function.

## Storage

The `floral-proposals` bucket stays private. Authenticated internal CRM users can upload/read/update/delete project-owned proposal PDFs under project-oriented object paths. Public access remains disallowed.

## Edge Function Boundary

`submit-floral-proposal` validates the authenticated caller, verifies the PDF object, and performs project conversion/revision through one server-side transaction boundary. No service-role keys are exposed to frontend code.
