# Contract: Proposal Revision Snapshots

## CRM UI Contract

### Revision eligibility on project details

**Entry point**: `/admin/projects/:projectId`

**Enabled when**:
- Project details and proposal history load successfully.
- Project status is `awaiting_deposit`, `booked`, `awaiting_final_payment`, or `final_prep`.
- Project resolves to exactly one active invoice snapshot.
- `projects.active_proposal_invoice_snapshot_id` points to that snapshot.
- The snapshot belongs to the project and contains enough recorded data to initialize a revision.
- The authenticated business owner/lead florist has existing CRM proposal access.

**Disabled when**:
- Project status is `completed` or `canceled`.
- Active snapshot is missing, duplicated, inactive, cross-project, or referenced incorrectly.
- Required snapshot data cannot be adapted safely.
- Proposal state cannot be loaded or validated.

**Disabled-state behavior**:
- `Revise Proposal` is visibly unavailable.
- Project details explains that current proposal data needs repair.
- Financial Summary does not use latest-history fallback.
- The rest of project details remains usable where possible.

An unavailable, broken, inactive, or snapshot-mismatched active document does not disable `Revise Proposal` when the active snapshot is valid. It disables only `Open Active PDF` and presents document-specific repair guidance.

### Project proposal revision builder

**Entry point**: `/admin/projects/:projectId/proposal-revision`

**Initialization**:
1. Validate project active snapshot state.
2. Resume the existing workspace for the project, if present.
3. Otherwise initialize one workspace from the valid active snapshot.
4. Hydrate settings, recorded tax context, line items, components, images, shopping-list inputs, terms, and totals from the workspace.
5. Show a compatibility warning for safe legacy defaults; block with repair guidance when core data is missing.

**Editing**:
- All fields supported by the current builder remain editable.
- Existing component text may be edited without catalog replacement.
- Current catalog values apply only to newly added items or an explicit Replace action.
- Retired catalog items and inactive tax regions retain recorded snapshot values.
- Working totals update live but do not affect project Financial Summary.

**Autosave**:
- Builder changes are persisted after a short debounce.
- UI exposes `Saving`, `Saved`, and actionable `Save failed` states.
- Pending changes are flushed before finalization and intentional navigation.
- Failed autosave leaves the editor open and does not claim the draft is saved.
- Refresh/sign-out/reopen resumes the latest successful server autosave.

**Discard**:
1. User selects Discard Revision.
2. UI warns that unsubmitted changes will be removed.
3. Confirmation deletes only the workspace and returns to project details.
4. The next revision starts from the then-current active snapshot.

### Revision PDF finalization

**Preconditions**:
- Workspace is saved, and its persisted payload passes server-side supported-schema validation.
- At least one valid line item, required tax/event context, and internally consistent calculated/mirrored totals exist.
- Selected file passes existing PDF extension, MIME, size, non-empty, corruption, and password-protection validation.

**Confirmation**:
- Copy states that the PDF is the externally approved or signed final revision document.
- User explicitly confirms this statement before activation begins.
- Revision copy does not say that a lead will be converted or a new project booked.

**Success**:
- Exactly one new snapshot/document pair becomes active.
- Workspace is consumed.
- UI navigates to `/admin/projects/:projectId`.
- Refreshed Financial Summary, Active PDF, proposal history, and activity use the new version.

**Failure**:
- The prior active snapshot and project operational state remain unchanged. A previously valid active document remains active; a pre-existing invalid document state remains unchanged; no partial replacement becomes current.
- Workspace remains resumable unless the request already completed idempotently.
- Local PDF may need reselection and the UI says so.
- Error distinguishes builder validation, PDF validation, data repair, retryable submission, and unexpected support cases.

## Workspace Repository Contract

### Get/resume

**Input**: project ID.

**Output**: one workspace or `null`.

**Rules**:
- Multiple rows are prevented by the database unique constraint.
- Repository errors are thrown/typed; they are not collapsed into `null`.

### Initialize

**Input**: project ID, valid baseline snapshot, initial versioned editable payload, mirrored totals, current user.

**Output**: created workspace or the existing unique workspace when an idempotent initialization race is encountered.

### Autosave

**Input**: workspace ID, complete versioned editable payload, mirrored totals/terms, current user, and optional pending submission metadata.

**Output**: updated workspace with server `updated_at`.

**Rules**:
- Autosave cannot update project snapshot/document records.
- Autosave validates workspace ownership and supported schema.
- Changing proposal content clears stale pending submission metadata.

### Discard

**Input**: workspace ID and project ID.

**Output**: success or typed authorization/not-found error.

**Rules**:
- Deletes only an unsubmitted workspace.
- Cannot delete snapshots, documents, or project activity.

## Active Snapshot Read Contract

**Input**: project plus its project-owned snapshot records.

**Output**:
- `{ state: 'valid', snapshot }`, or
- `{ state: <typed invalid state>, repairMessage }`.

**Validation**:
- Exactly one snapshot row is marked active.
- Project snapshot pointer matches it.
- Snapshot project ID matches project ID.

**Consumer rules**:
- Financial Summary takes proposal values only from `valid.snapshot`.
- Revise Proposal requires `valid` plus an adaptable snapshot; document state is not an eligibility input.
- Historical comparison continues to use all retained versions but does not designate current state by recency.

## Active Document Read Contract

**Input**: project, its valid active snapshot state, and its project-owned document records.

**Output**:
- `{ state: 'valid', document }`, or
- `{ state: <typed invalid document state>, repairMessage }`.

**Validation**:
- Project document pointer resolves to an active same-project document.
- Active document links the active snapshot and shared version.

**Consumer rules**:
- Open Active PDF takes storage identity only from `valid.document`.
- Missing or inconsistent document state disables only PDF access; successful revision finalization installs a new valid pair and repairs the current document pointer.

## Edge Function Contract

### `submit-floral-proposal` project revision request

The existing standalone function retains its initial-booking request behavior. For `mode=project_revision`, the request includes:

- `mode`: `project_revision`
- `project_id`
- `revision_workspace_id`
- `baseline_invoice_snapshot_id`
- `pdf_storage_path`
- `pdf_file_name`
- `idempotency_key`

**Server validation**:
- Immediately before RPC invocation, revalidate that the current authenticated user is accepted by `public.is_internal_crm_user()`; existing Angular admin route guards provide the matching client boundary, and feature 006 introduces no new role or permission model.
- Required UUIDs and strings are valid.
- Workspace/project/baseline relationships are valid.
- Persisted workspace schema, required line-item/tax/event context, and calculated totals are valid; no client-supplied totals override the persisted workspace.
- Pending workspace submission key matches request key.
- Staged PDF exists in the private bucket and passes server validation.

**Behavior**:
- Calls `finalize_project_proposal_revision` exactly once for database mutation.
- Does not sequentially deactivate/insert/update revision records through PostgREST.
- Does not change project status, payment records, event state, or `booked_at`.
- On transactional failure, attempts best-effort cleanup only for an unreferenced staged object.

**Success response**:

```json
{
  "success": true,
  "project_id": "uuid",
  "revision_workspace_id": "uuid",
  "proposal_document_version_id": "uuid",
  "active_invoice_snapshot_id": "uuid",
  "version": 3,
  "signed_pdf_storage_path": "projects/.../revision.pdf",
  "submitted_at": "ISO-8601 timestamp",
  "idempotent_replay": false
}
```

**Typed error outcomes**:
- `400`: malformed request or invalid PDF.
- `401/403`: unauthenticated or unauthorized.
- `409`: workspace/baseline/current active state no longer valid or pending key mismatch.
- `422`: project/workspace/snapshot missing or non-adaptable.
- `500`: unexpected transactional/storage failure; prior active database state remains intact.

## Transaction Function Contract

### `finalize_project_proposal_revision`

**Access**: `SECURITY DEFINER`, owned by the migration-owner role, with a fixed trusted `search_path`; execution is revoked from `PUBLIC` and `authenticated` and granted only to `service_role` for use through the authenticated standalone edge function.

**Inputs**:
- Project ID.
- Workspace ID.
- Baseline snapshot ID.
- Idempotency key.
- Verified PDF bucket/path/name/content type/size.
- Authenticated submitting profile ID.
- Submission timestamp.

**Transactional guarantees**:
- Locks the project while allocating/activating the version.
- Same completed idempotency key returns the same snapshot/document/version.
- For a new attempt after idempotent replay is ruled out, rejects project status `completed` or `canceled` while permitting `awaiting_deposit`, `booked`, `awaiting_final_payment`, and `final_prep`.
- Validates the persisted workspace's supported schema, required line-item/tax/event context, and calculated/mirrored totals before creating submitted records.
- Validates the workspace baseline against the project's one active snapshot.
- Treats the prior active document as optional history rather than a revision prerequisite.
- Derives `source_floral_proposal_id` from the baseline snapshot; workspace/client input cannot override it and a null baseline value remains null.
- Inserts snapshot and document with the same project version and idempotency key.
- Leaves exactly one active snapshot and active document.
- Sets transaction-local `app.proposal_revision_activation=on`; immutable triggers allow lifecycle-only changes only when both that guard and the migration-owner `current_user` are present.
- Marks any resolvable prior document `superseded` and inactive; prior snapshot becomes inactive.
- Updates both project pointers without changing operational project fields.
- Inserts exactly one `proposal_revision_submitted` activity.
- Deletes the workspace only on success.
- Any exception rolls back every database mutation.

## Financial Reporting Contract

**Current source**:
- Start with `projects.active_proposal_invoice_snapshot_id`.
- Join the referenced snapshot by ID and same project.
- Require `is_active=true`.
- Treat a missing or inconsistent join as unavailable/corrupt current state.

**Excluded from current reporting**:
- Revision workspaces.
- Inactive snapshots.
- Latest-by-version fallback.
- Mutable lead proposal rows.

**Consumers**:
- Project Financial Summary uses this contract in feature 006.
- Future income/expense dashboard queries must reuse this current-source rule.

## Security And Storage Contract

- Workspace and proposal records remain private under RLS to authenticated users accepted by `public.is_internal_crm_user()`; Angular admin route guards enforce the matching client navigation boundary.
- Submitted snapshots/documents are selectable but not ordinarily updateable/deletable by authenticated browser users.
- Content immutability/no-delete triggers also apply to service-role writes outside the controlled owner-plus-transaction-guard lifecycle transition; content updates and deletes are never permitted by the guard.
- The `floral-proposals` bucket remains private and limited to PDFs up to 50 MB.
- Browser users may insert staged PDFs and read authorized PDFs through signed URLs; ordinary browser update/delete of submitted PDF objects is removed.
- No service-role key or privileged secret enters Angular code.
- Activity and error payloads never contain PDF bytes, signed URLs, or unnecessary customer details.
- Project activity reads resolve `performed_by` to `profiles.display_name`, then profile email, then `Unknown user`, and display the submitting florist with the revision version and submission time.
