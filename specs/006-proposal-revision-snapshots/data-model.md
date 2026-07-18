# Data Model: Proposal Revision Snapshots

## Project Proposal Revision Workspace

Represents the one mutable, auto-saved proposal revision currently being prepared for a project. It is never used as current financial reporting data.

**Proposed table**: `project_proposal_revision_workspaces`

**Fields**:
- `project_proposal_revision_workspace_id`: UUID primary key.
- `project_id`: required project relationship; unique to enforce one workspace per project.
- `baseline_invoice_snapshot_id`: required relationship to the immutable active snapshot from which the workspace was initialized.
- `source_lead_id`: nullable provenance relationship retained for the shared builder and customer context.
- `schema_version`: positive integer identifying the editable JSON contract; new workspaces use version `2`.
- `draft_snapshot`: required JSON containing the complete editable builder state.
- `subtotal`: calculated currency value mirrored from the draft for validation/finalization.
- `tax_rate`: recorded draft tax rate.
- `tax_amount`: calculated currency value.
- `total_amount`: calculated currency value.
- `retainer_amount`: calculated or edited currency value.
- `final_balance_amount`: calculated currency value.
- `retainer_due_date`: nullable date.
- `final_balance_due_date`: nullable date.
- `pending_submission_key`: nullable UUID retained across retries for one confirmed PDF submission attempt.
- `pending_pdf_storage_path`: nullable deterministic private storage path for the pending attempt.
- `pending_pdf_file_name`: nullable sanitized file name; the local file bytes are not stored in the workspace.
- `created_by`: nullable profile relationship.
- `updated_by`: nullable profile relationship.
- `created_at`: creation timestamp.
- `updated_at`: latest successful autosave timestamp.

**Relationships**:
- Belongs to exactly one `projects` row; project deletion cascades to an unsubmitted workspace.
- References exactly one baseline `project_proposal_invoice_snapshots` row.
- May retain `source_lead_id` for provenance; a missing historical lead does not make a valid project snapshot mutable.

**Validation rules**:
- At most one workspace exists per project.
- The baseline snapshot must belong to the same project, match `projects.active_proposal_invoice_snapshot_id`, and be the project's only active snapshot when the workspace is created.
- `draft_snapshot` must pass the supported snapshot-schema validator before save/finalization.
- Currency values are non-negative where existing builder rules require it and must match calculated JSON totals at finalization.
- Pending submission metadata is set or cleared as a unit. Editing finalized inputs after a pending attempt begins clears the old pending key/path so a new attempt is explicit.
- Users accepted by `public.is_internal_crm_user()` and the existing Angular admin route guards may select, insert, update, and explicitly delete/discard workspaces through the approved repository/service boundary; no new proposal role is introduced.

**Lifecycle**:
1. **Absent**: no revision has been started.
2. **Initialized**: workspace is seeded from the valid active snapshot.
3. **Auto-saved**: editable JSON and mirrored totals are updated after changes.
4. **Submission pending**: a stable key/path identifies the confirmed approved/signed PDF attempt.
5. **Consumed**: successful transactional finalization deletes the workspace.
6. **Discarded**: explicit confirmed discard deletes the workspace without changing submitted records.

## Versioned Editable Proposal Snapshot

Represents the lossless JSON contract shared by the workspace and newly submitted snapshot records.

**Top-level fields**:
- `schema_version`
- `proposal_status`
- `tax_region`: recorded ID, name, rate, and active-at-source context.
- `default_markup_percent`
- `labor_percent`
- `financial_terms`: retainer/final-balance amounts and due dates.
- `line_items`
- `shopping_list`
- `totals`
- `breakdown`
- lifecycle/submission metadata where applicable.

**Line item fields**:
- Stable draft-local identity and display order.
- Type, name, description, quantity, unit price, subtotal.
- Image storage path, alt text, and caption.
- Complete component collection.

**Component fields**:
- Display order.
- Nullable catalog item ID as provenance only.
- Recorded catalog item name, type, unit, color, variety.
- Quantity per unit and extended quantity.
- Recorded base/purchase cost and pack quantity.
- Applied markup, sell unit price, subtotal, reserve percentage.
- Additional recorded component metadata needed by shopping-list calculations.

**Rules**:
- Recorded values are authoritative when hydrating a revision.
- A missing/retired catalog relationship does not remove the recorded item.
- Current catalog values enter a revision only when an item is newly added or explicitly replaced.
- New submitted snapshots use the current schema version; historical snapshots remain unchanged and are adapted in memory.
- Missing optional legacy fields use documented neutral defaults and produce a warning where they can affect review.
- Missing core line/financial data produces an invalid baseline state and repair guidance rather than catalog or mutable-proposal fallback.

## Project Proposal Invoice Snapshot

Represents an immutable confirmed proposal invoice/planning version.

**Existing fields retained**:
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

**Proposed field**:
- `submission_idempotency_key`: nullable for legacy rows; required and unique for newly finalized revision snapshots.

**Rules**:
- `(project_id, version)` remains unique.
- At most one snapshot may have `is_active=true` per project.
- Business content, totals, version, provenance, creator, and creation time cannot be updated after insertion.
- Delete is prohibited for submitted history.
- The controlled finalization transaction may change only lifecycle state required to supersede the active version.
- Lifecycle-only changes are permitted by the database trigger only when `current_user` is the finalization function's migration-owner role and the transaction-local `app.proposal_revision_activation` setting is `on`; content changes and deletes remain prohibited.
- Financial Summary and future income/expense consumers join through the project's active snapshot pointer and verify `is_active=true`; they do not choose by maximum version.
- A finalized revision inherits `source_floral_proposal_id` from its baseline snapshot; null remains null and the client cannot override provenance.

**State transition**:
- `active` -> `inactive` only when the same transaction creates and activates its successor.
- An inactive snapshot never becomes a revision workspace; a new workspace always starts from the current active snapshot.

## Project Proposal Document Version

Represents the private approved/signed PDF finalized with one invoice snapshot.

**Existing fields retained**:
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
- `status`
- `created_at`

**Proposed field**:
- `submission_idempotency_key`: nullable for legacy rows; required and unique for newly finalized revision documents.

**Rules**:
- New revision documents require `invoice_snapshot_id`.
- New document version and linked snapshot must share project ID, version, and idempotency key.
- `(project_id, version)` and `(storage_bucket, storage_path)` remain unique.
- At most one document may have `is_active=true` per project.
- Stored file identity, snapshot link, version, actor, time, and metadata are immutable after insertion.
- Delete is prohibited for submitted documents; the controlled transaction may change `is_active` and `status` from `submitted` to `superseded`.
- Document lifecycle changes use the same migration-owner plus transaction-local activation guard as snapshot lifecycle changes.
- Private storage objects referenced by submitted document versions cannot be updated or deleted by ordinary authenticated browser access.
- A finalized revision document inherits `source_floral_proposal_id` from the baseline snapshot rather than from workspace/client input.

**State transition**:
- New record: `status=submitted`, `is_active=true`.
- Prior active record during revision: `status=superseded`, `is_active=false`.
- Initial signed agreement remains readable as history after later revisions.

## Project Active Snapshot State

Typed read model used by revision eligibility, project Financial Summary, and future financial consumers.

**Fields when valid**:
- Project ID.
- Active snapshot ID and complete snapshot record.

**Validity states**:
- `valid`
- `missing_snapshot`
- `conflicting_snapshots`
- `broken_snapshot_reference`
- `load_error`

**Rules**:
- Valid state requires exactly one active snapshot, the project pointer to that record, and correct project ownership.
- Financial Summary and Revise Proposal consume only `valid` snapshot state.
- Invalid states show actionable repair guidance and never fall back to historical recency.

## Project Active Document State

Typed read model used only by Open Active PDF and current-document presentation.

**Fields when valid**:
- Project ID.
- Active document ID and complete document record.
- Linked active snapshot ID/version.

**Validity states**:
- `valid`
- `missing_document`
- `broken_document_reference`
- `inactive_document_reference`
- `mismatched_snapshot_document_pair`
- `load_error`

**Rules**:
- Valid state requires the project document pointer to resolve to an active same-project document linked to the current active snapshot.
- Invalid document state disables Open Active PDF and shows document-specific guidance, but does not disable revision when active snapshot state is valid.
- Successful finalization always installs a valid new document/snapshot pair, repairing the current document pointer without rewriting retained history.

## Project

**Existing fields used**:
- `project_id`
- `source_lead_id`
- `active_proposal_invoice_snapshot_id`
- `active_proposal_document_version_id`
- `status`
- `booked_at`
- `updated_at`

**Revision rules**:
- Successful finalization replaces both active proposal pointers in the same transaction.
- Proposal revision does not change `status`, `booked_at`, payment state, event state, or unrelated project fields.
- Revision may open and finalize only for `awaiting_deposit`, `booked`, `awaiting_final_payment`, or `final_prep`; `completed` and `canceled` are terminal and block revision.
- A missing or inconsistent active snapshot pointer disables revision; a missing or inconsistent document pointer affects only current-PDF access.

## Proposal Revision Activity

Uses the existing `activity_log` table with `entity_type=project` and `activity_type=proposal_revision_submitted`.

**Metadata**:
- Replaced snapshot/document IDs and version.
- New snapshot/document IDs and version.
- Prior and new proposal totals where useful.
- Submission idempotency key or a non-sensitive correlation identifier.
- Submission mode.

**Rules**:
- `performed_by` and `created_at` identify the actor and time; project activity reads join `performed_by` to `profiles.display_name`, falling back to profile email and then `Unknown user` when historical profile display data is unavailable.
- Activity is inserted inside the finalization transaction and appears exactly once per completed idempotency key.
- Metadata excludes PDF bytes, signed URLs, customer secrets, and unnecessary personal data.

## Transactional Finalization State Transition

**Preconditions**:
- The standalone edge function has revalidated the current caller with `public.is_internal_crm_user()` immediately before invoking the RPC.
- PDF exists in private staged storage and passes type, size, corruption, and password-protection validation.
- Workspace belongs to the project and its persisted draft passes supported-schema, required line-item, tax/event-context, and calculated-total validation.
- Workspace baseline matches the project's one valid active snapshot.

**Atomic transition**:
1. Lock project row and replay an existing completed idempotency key if present.
2. For a new attempt, reject `completed`/`canceled` project state; validate workspace content/totals, baseline, and the exact active snapshot; resolve any prior active document as optional history rather than a revision prerequisite.
3. Allocate the next shared project proposal version.
4. Insert the new immutable snapshot and linked document.
5. Mark the prior active snapshot inactive and any resolvable prior active document superseded/inactive without requiring that document to authorize revision.
6. Update both project active pointers without changing operational status or `booked_at`.
7. Insert one project revision activity.
8. Delete the consumed workspace.
9. Return the completed IDs/version.

Any database error rolls back all nine database effects. A staged storage object is outside the database transaction and is removed best-effort when finalization fails before it is referenced.
