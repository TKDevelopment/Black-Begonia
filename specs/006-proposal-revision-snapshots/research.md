# Research: Proposal Revision Snapshots

## Decision: Use A Dedicated Project Revision Workspace

Add one `project_proposal_revision_workspaces` record per project. The record stores the immutable baseline snapshot reference, a complete versioned editable JSON payload, calculated financial fields, autosave provenance, and any pending submission idempotency metadata. Successful finalization or explicit discard removes the workspace.

**Rationale**: Existing `floral_proposals` rows are lead-scoped and use `is_active` for lead proposal history. Reusing them for project drafts would conflate an unsubmitted project workspace with accepted lead history and risks deactivating or mutating the accepted proposal. A project-owned workspace directly models the clarified one-draft-per-project behavior while keeping every submitted snapshot untouched.

**Alternatives considered**:
- Add `project_id` and baseline fields to `floral_proposals`: less initial repository work, but preserves ambiguous lead/project active-state semantics and requires careful protection against accepted proposal mutation.
- Browser-only draft state: rejected because it cannot resume after refresh or sign-out and does not satisfy the clarified persistence requirement.
- Separate normalized workspace line/component tables: rejected because a complete versioned JSON document is simpler for one-user autosave and already matches the snapshot-shaped builder contract.

## Decision: Add An Explicit Project-Owned Revision Route

Use `/admin/projects/:projectId/proposal-revision` as the revision entry point and reuse the existing floral proposal builder component in a distinct project-revision mode. Keep `/admin/leads/:leadId/floral-proposal-builder` unchanged for initial proposal creation.

**Rationale**: The current route is lead-owned and passes project context only through query parameters. A project route makes ownership unambiguous, avoids trusting a mismatched lead/project pair, and lets the builder branch cleanly between initial proposal and project revision loading.

**Alternatives considered**:
- Keep the lead route plus `projectId` and `mode` query parameters: rejected because the component currently ignores `mode`, project identity can drift from the route lead, and revision eligibility is harder to enforce.
- Build a second proposal builder component: rejected because calculation and editing UX should remain shared rather than duplicated.

## Decision: Resolve Active Snapshot And Active Document State Independently

Introduce typed active-snapshot and active-document read contracts. Revision eligibility and Financial Summary require exactly one valid project-owned active snapshot matching the project snapshot pointer. Open Active PDF independently requires a valid project-owned active document matching the document pointer and active snapshot. Neither contract falls back to the latest historical record, but a document problem does not block revision from a valid snapshot.

**Rationale**: `ProjectDetailsComponent` currently falls back from a missing active snapshot to the newest history and derives document activity from recency. That violates the clarified repair behavior and can present obsolete financials as current.

**Alternatives considered**:
- Continue latest-version fallback: rejected because it hides corrupt or incomplete active state.
- Require a fully valid snapshot/document pair before revision: rejected by clarification because the immutable snapshot is the revision baseline and document repair is independent.
- Query only `is_active=true`: insufficient by itself because it does not verify the relevant project pointer or project ownership.

## Decision: Use A Versioned, Lossless Builder Snapshot Contract

Store `schema_version` with complete settings, historical tax context, line order/details/images, component identity/order/quantity/cost/markup/sell price/reserve and source metadata, shopping-list inputs, totals, financial terms, and lifecycle metadata. Hydration preserves recorded values. Current catalog data is applied only through add or explicit replace actions.

**Rationale**: Current snapshots omit component display order, reserve percentage, and component metadata such as pack quantity and purchase cost. Current catalog matching can also silently reprice an existing row. A lossless contract is required to recreate the submitted calculation independently of later catalog changes.

**Alternatives considered**:
- Re-query catalog and tax tables during hydration: rejected because retired or repriced records would silently alter the revision baseline.
- Store only normalized child-row identifiers: rejected because historical catalog data may no longer exist and identifiers alone cannot reproduce pricing.

## Decision: Support Legacy Snapshots With A Non-Repricing Adapter

The builder service will validate and adapt older snapshot JSON using only recorded data. Missing optional fields receive safe neutral defaults and a visible warning; missing core financial or line-item data blocks revision with repair guidance. Inactive tax regions are represented as recorded historical tax context instead of recalculating at zero.

**Rationale**: Existing project snapshots predate the lossless schema and cannot be rewritten without violating immutability. A compatibility adapter preserves available values while avoiding catalog fallback.

**Alternatives considered**:
- Rewrite historical snapshots into the new shape: rejected because submitted history is immutable.
- Refuse every legacy snapshot: rejected because many existing projects can be revised safely from their recorded data.

## Decision: Debounce Autosave And Flush At Workflow Boundaries

Autosave workspace changes after a short debounce, expose saving/saved/error state, and flush pending changes before finalization or intentional navigation. Explicit discard requires confirmation and deletes only the workspace. Local PDF selection remains transient.

**Rationale**: This satisfies cross-refresh/sign-out recovery without issuing a write for every keystroke. A visible error state prevents the user from assuming unsaved changes are durable.

**Alternatives considered**:
- Manual Save Draft only: rejected by the clarification requiring automatic persistence.
- Save on every input event: rejected because it creates unnecessary write volume and increases partial-request churn.

## Decision: Finalize Revisions Through One Transactional Database Function

Add a service-role-only `finalize_project_proposal_revision` database function invoked by the `project_revision` branch of `submit-floral-proposal`. The edge function revalidates `public.is_internal_crm_user()` immediately before invocation. The database function locks the project, replays completed idempotent requests, rejects a new attempt for `completed`/`canceled` projects, validates the persisted workspace schema/required context/calculated totals and baseline, deactivates the prior snapshot and any resolvable prior document, inserts the new snapshot and linked document, updates project pointers, writes one revision activity entry, consumes the workspace, and returns the completed version.

**Rationale**: The current edge function performs each write separately and ignores some errors. A failure can leave no active snapshot, a partial document pair, or stale project pointers. One database function runs in one transaction, so any failure restores the prior active snapshot and preserves either the previously valid document or its pre-existing invalid state.

**Alternatives considered**:
- Keep sequential edge-function writes with compensating updates: rejected because compensation can also fail and does not provide a reliable transaction boundary.
- Move PDF bytes into Postgres: rejected because private Supabase Storage remains the approved document system.

## Decision: Persist Submission Idempotency And Stage PDFs Deterministically

Generate a pending submission key for the workspace when the florist confirms the approved/signed PDF, use it in the private storage path, and persist it on the finalized document/snapshot. A unique key lets the transaction return the existing completed result on retry. If database finalization fails, the prior active snapshot and pre-attempt document state remain intact and the edge function attempts to remove the unreferenced staged object; otherwise the same deterministic path can be reused after PDF reselection.

**Rationale**: The current function validates but discards `idempotency_key`; deduplication by storage path alone is implicit and cannot safely replay a completed database result.

**Alternatives considered**:
- Random key per click: rejected because network retries can create duplicate versions.
- Dedicated submission-attempt table: viable, but redundant for this single-user flow because workspace pending metadata plus a unique finalized key provides the needed replay contract.

## Decision: Enforce Immutable Submitted History At The Database Boundary

Retain authenticated read access to snapshots/documents, remove ordinary authenticated update/delete access, and add no-delete/content-immutability triggers. Lifecycle-only changes are accepted only when both `current_user` is the finalization function's migration-owner role and the transaction-local `app.proposal_revision_activation` setting is `on`. The `SECURITY DEFINER` finalization function sets that guard locally, has a fixed safe search path, is revoked from `public`/`authenticated`, and is granted only to `service_role`. Remove browser update/delete policies for submitted proposal PDFs; staged-object cleanup remains server-owned.

**Rationale**: Existing RLS policies allow authenticated users to update and delete snapshots, documents, and stored PDFs. Application conventions alone do not satisfy the immutable-history requirement, and service-role code bypasses RLS but not table triggers.

**Alternatives considered**:
- Frontend read-only conventions only: rejected because direct authenticated database calls could still alter history.
- Make every column absolutely immutable: rejected because controlled `is_active` and document `status` transitions are required to supersede versions.

## Decision: Inherit Floral Proposal Provenance From The Baseline Snapshot

New revision snapshots and documents copy `source_floral_proposal_id` from the baseline active snapshot. If the baseline value is null, the new records retain null. The client and workspace do not supply or override this value.

**Rationale**: A dedicated project workspace is not itself a `floral_proposals` row, but submitted project history should retain the original lead-proposal lineage where it exists without trusting client provenance.

**Alternatives considered**:
- Always store null: rejected because it discards existing traceability.
- Accept a floral proposal ID from the browser: rejected because it could mismatch the project baseline.

## Decision: Preserve Project Operational State During Revision

Revision activation updates only proposal pointers and normal timestamps; it does not reset project status or `booked_at`. Write one `proposal_revision_submitted` project activity containing old/new version identifiers, actor, time, and non-sensitive totals.

**Rationale**: The current edge function resets every revised project to `booked` and rewrites `booked_at`, which can regress payment-gated states such as Awaiting Final Payment, Final Prep, Completed, or Canceled. A single activity event provides traceability without redundant timeline noise.

**Alternatives considered**:
- Continue resetting to Booked: rejected because proposal pricing changes do not undo operational project progress.
- Write three separate snapshot/document/activity events: rejected for the first implementation because one atomic event can carry all required transition metadata.

## Decision: Keep Future Dashboard Work Out Of Scope But Define Its Read Contract

The current financial read contract joins a project through `active_proposal_invoice_snapshot_id` to the matching active snapshot. Historical snapshots and revision workspaces are never current financial rows. Project Financial Summary adopts this rule now; future income/expense dashboards reuse it.

**Rationale**: This delivers the requested source-of-truth contract without expanding feature 006 into dashboard implementation.

**Alternatives considered**:
- Build dashboard queries now: rejected as separate product scope.
- Use newest snapshot by version: rejected because version recency is not the approved activation signal.
