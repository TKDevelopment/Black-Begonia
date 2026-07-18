# Implementation Plan: Proposal Revision Snapshots

**Branch**: `006-proposal-revision-snapshots` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-proposal-revision-snapshots/spec.md`

## Summary

Make booked-project proposal revision a project-owned, editable workflow. Project details validates the exact active invoice snapshot for revision and financial use while resolving active-document/PDF availability independently. The shared floral proposal builder opens through a dedicated project revision route, initializes or resumes one server-backed JSON workspace per project, hydrates recorded snapshot values without catalog repricing, debounces autosave, supports confirmed discard, and keeps unsubmitted values out of Financial Summary. Confirmed approved/signed PDF submission stages the private file and calls one transactional database function that atomically creates the next immutable snapshot/document pair, supersedes available prior records, repairs the project document pointer through the new pair, records activity, consumes the workspace, and provides persisted idempotent replay.

## Technical Context

**Language/Version**: Angular 19 / TypeScript 5.8 for CRM frontend work; Supabase Edge Function TypeScript on the existing Deno runtime; PostgreSQL/PL/pgSQL for transactional finalization and integrity triggers.

**Primary Dependencies**: Angular standalone components/signals/forms, Angular Router, Angular Material/CDK where already used, Supabase client/PostgREST/RPC, Supabase Postgres RLS, private Supabase Storage signed URLs, the standalone `submit-floral-proposal` edge function, Netlify Angular SSR/Express runtime, Karma/Jasmine. No new third-party runtime library is required.

**Storage**: Add `project_proposal_revision_workspaces` in Supabase Postgres; extend project proposal snapshot/document records with explicit submission idempotency; retain `projects` active proposal pointers and `activity_log`; keep PDFs in the private `floral-proposals` bucket. Deliver all table/function/policy/trigger/storage changes through `supabase/migrations/20260718000002_proposal_revision_snapshots.sql` plus matching declarative schema files.

**Testing**: Karma/Jasmine unit tests for project status/snapshot revision eligibility, strict active-state resolution, Financial Summary no-fallback behavior, document active state, builder snapshot/workspace hydration, complete editability, autosave/resume/discard, catalog/tax preservation, revision copy/navigation, workflow request/response mapping, and failure UI. Builder performance is measured in the builder component/service test surface; autosave and workspace-resume timing are measured in the revision-service test surface. Supabase integration checks cover persisted workspace schema/required-data/calculated-total validation, post-lock project-status validation, workspace RLS, immutable history, transactional rollback, idempotent replay, pairing/version constraints, project-state preservation, activity creation, and authorization. Type-check the standalone edge function and run the existing full Angular test/build regressions.

**Target Platform**: Netlify-hosted authenticated Angular CRM admin portal with Supabase backend and private Supabase Storage. Public website and client-facing proposal surfaces are unchanged.

**Project Type**: Brownfield Angular/Supabase CRM. Work is isolated to project details, the shared internal proposal builder, project proposal persistence, and the existing proposal submission boundary.

**Performance Goals**: With a representative 100-line proposal, at least 95% of measured builder edits recalculate and expose updated totals within 200 ms. Autosave dispatches 750 ms ± 150 ms after the last change and reaches Saved or actionable failure within 2 seconds under the normal seeded test environment. Initial workspace creation or saved-workspace resume exposes editable data within 2 seconds under the same environment. A typical revision reaches final PDF confirmation within 5 minutes, excluding external PDF preparation. Preserve the existing 50 MB PDF limit and avoid per-row network writes.

**Constraints**: Preserve initial lead proposal/booking behavior and manual PDF upload; allow revision only for `awaiting_deposit`, `booked`, `awaiting_final_payment`, or `final_prep` projects and reject `completed`/`canceled` projects; never hydrate from mutable/history fallback when current project state is invalid; submitted snapshot/document content is immutable; one workspace per project; single-user workflow means no edit locks or collaboration; storage and database cannot share a transaction, so staged PDF cleanup/reuse is explicit; no frontend service-role secrets; Supabase RLS and private storage policies required; every schema change requires the executable migration; every edge function remains standalone with no `_shared` or local cross-function import; no public-site change; AI agents do not run git commit or push commands.

**Scale/Scope**: One business-owner user, at most one workspace per project, hundreds of projects and retained historical versions, normal CRM proposal sizes, and private PDFs up to 50 MB. Affects `/admin/projects/:projectId`, new `/admin/projects/:projectId/proposal-revision`, the shared builder/submission modal, project Financial Summary/documents/activity, workspace/snapshot/document models and repositories/services, `projects`, new workspace table, snapshot/document tables, activity usage, storage policies, one migration, one database finalization function, and `submit-floral-proposal`. Future dashboard UI, real-time collaboration, e-signature/client portal, PDF generation, initial-booking transaction refactor, and payment implementation are out of scope.

## Constitution Check

*GATE: PASS before Phase 0 research. Re-checked after Phase 1 design below.*

- **Surface classification**: Authenticated CRM admin portal and Supabase backend/storage only. No public website or client portal route/content changes; no public product-owner approval is needed.
- **Brownfield preservation**: Preserve `/admin/leads/:leadId/floral-proposal-builder`, lead proposal creation, builder calculations, markup/labor/tax/arrangement/component/shopping-list behavior, manual approved/signed PDF upload, lead-to-project initial booking, private signed PDF URLs, project payment/status workflow, proposal document history/comparison, project activity display, and project details/list behavior. Authorized changes are the new project revision route/workspace, strict active-state validation, revision-specific messaging/navigation, transactional revision activation, and immutable history enforcement.
- **Supabase security**: The authorization boundary is the existing authenticated internal CRM admin check: Angular admin route guards plus `public.is_internal_crm_user()` in RLS/server validation; no new proposal permission model is added. Workspace RLS allows those users to select/insert/update/delete unsubmitted work only. Snapshot/document authenticated access becomes read-only. The `SECURITY DEFINER` finalization function is owned by the migration owner, sets a transaction-local `app.proposal_revision_activation=on` guard, and is executable only by `service_role`; lifecycle triggers require both that owner context and guard while rejecting content changes and all deletes. Browser insert/read policies remain for private staged/submitted PDFs; ordinary update/delete of submitted proposal PDFs is removed. No service-role key enters frontend code.
- **Provenance and audit presentation**: Finalization derives `source_floral_proposal_id` from the baseline active snapshot, preserving null, rather than trusting workspace/client input. Revision activity records the submitting profile, and project activity reads display `profiles.display_name`, then email, then `Unknown user`, alongside version and submission time.
- **Schema migration**: `supabase/migrations/20260718000002_proposal_revision_snapshots.sql` creates/backfills the workspace and idempotency schema, adds constraints/indexes/triggers/RLS/policies/function grants, updates storage policies, validates existing document/snapshot linkage before stricter constraints, and installs transactional finalization. It applies after `20260718000000_project_details_workflow.sql` and `20260718000001_project_document_version_status.sql`. Invalid legacy active/link states are reported for repair rather than silently rewritten or selected by recency.
- **Standalone edge functions**: `supabase/edge_functions/submit-floral-proposal.ts` remains independently deployable. Its revision branch verifies/authenticates the staged PDF and invokes the database function; it imports no `_shared`, local shared function, or another edge function. Initial-booking behavior stays in the same standalone unit.
- **Testing plan**: Focused Karma/Jasmine coverage is added for every touched component/service/repository and builder state transition. Database/edge integration checks exercise success, persisted-draft validity, terminal project status, authorization loss, rollback at each step, idempotent replay, immutable history, RLS, active-pair integrity, legacy adaptation, and project status preservation. Existing proposal, project, lead, private PDF, and authorization tests remain passing, contributing meaningful coverage toward the 80% target.
- **Frontend boundary plan**: Work remains under authenticated private admin routes and does not advance or block future frontend separation. The explicit project revision route improves the CRM boundary without moving shared/public code or changing Netlify routing/deployment.
- **Proposal workflow rule**: Preserved. The builder remains the calculation/planning source; manual externally approved/signed PDF upload remains the document path; no dynamic PDF renderer, e-signature, client portal, or automatic client delivery is added. The active snapshot remains the financial/reporting source.
- **Security and privacy**: Customer/event data, internal cost/markup, proposal PDFs, florist identity, and future payment projections remain private. Workspace/activity/error data is minimized; no PDF bytes or signed URLs enter activity metadata. Local PDF selection is transient. Edge-only service-role configuration remains server-side.
- **Git publication boundary**: The AI agent will not run `git commit`, `git push`, or commit/push-capable automation. Publication remains a human handoff.

## Project Structure

### Documentation (this feature)

```text
specs/006-proposal-revision-snapshots/
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/
    proposal-revision-snapshots.md
  checklists/
    requirements.md
```

### Source Code (repository root)

```text
src/
  app/
    app.routes.ts
    components/private/
      floral-proposal-builder/
        floral-proposal-builder.component.*
        components/proposal-document-submission-modal/
      projects/
        project-details/project-details.component.*
        components/
          project-financial-summary-card/
          project-proposal-documents-section/
          project-activity-panel/
    core/
      models/
        project-proposal-revision-workspace.ts        # new
        project-proposal-invoice-snapshot.ts
        project-proposal-document-version.ts
        project.ts
      supabase/repositories/
        project-proposal-revision-workspace-repository.service.ts  # new
        project-proposal-invoice-snapshot-repository.service.ts
        project-proposal-document-version-repository.service.ts
      supabase/services/
        project-proposal-revision.service.ts          # new active-state/workspace orchestration
        floral-proposal-builder.service.ts            # lossless adapters
        floral-proposal-workflow.service.ts           # revision request/replay contract

supabase/
  migrations/
    20260718000002_proposal_revision_snapshots.sql
  schemas/public/tables/
    project_proposal_revision_workspaces.sql          # new
    project_proposal_invoice_snapshots.sql
    project_proposal_document_versions.sql
    projects.sql
  schemas/public/functions/
    finalize_project_proposal_revision.sql            # new transaction
    enforce_project_proposal_snapshot_immutability.sql
    enforce_project_proposal_document_immutability.sql
  schemas/storage/
    floral_proposals.sql
  edge_functions/
    submit-floral-proposal.ts                         # standalone revision branch
```

**Structure Decision**: Reuse the established shared builder and project details components, but give revision a project-owned route and a focused `ProjectProposalRevisionService` that resolves snapshot eligibility separately from document/PDF availability and orchestrates workspace lifecycle. Persist drafts in a dedicated table/repository rather than overloading lead-level `floral_proposals`. Keep privileged activation inside a guarded declarative PostgreSQL function invoked by the existing standalone edge function.

## Phase 0 Research Outcomes

- Dedicated JSON workspace chosen over mutable lead proposal reuse.
- Explicit project route chosen over query-parameter ownership.
- Versioned lossless snapshot schema plus legacy in-memory adapter chosen over historical rewrites or catalog refresh.
- Debounced server autosave and confirmed discard chosen over manual/browser-only drafts.
- Strict pointer-based current-state contract chosen over newest-version fallback.
- Transactional database finalization chosen over sequential edge writes.
- Persisted idempotency and deterministic staged storage chosen over implicit path-only deduplication.
- Database triggers/RLS/storage restrictions chosen to enforce immutable submitted history.
- Project status and `booked_at` preservation plus one atomic revision activity chosen for operational traceability.

See [research.md](./research.md) for rationale and rejected alternatives.

## Phase 1 Design Artifacts

- [data-model.md](./data-model.md): workspace, versioned editable snapshot, immutable submitted versions, strict active state, activity, and finalization lifecycle.
- [contracts/proposal-revision-snapshots.md](./contracts/proposal-revision-snapshots.md): CRM routes/UX, repository, active-state, edge/RPC, financial reporting, security, and storage contracts.
- [quickstart.md](./quickstart.md): manual and automated validation for hydration, autosave/discard, approved PDF confirmation, rollback, idempotency, reporting, immutability, authorization, and regressions.

## Migration And Rollout Strategy

1. Apply prerequisite project proposal/project-details migrations.
2. Run legacy preflight queries for missing document-to-snapshot links, cross-project links, conflicting active flags, and broken project pointers. Abort stricter constraint installation with actionable diagnostics when automatic correction would be unsafe.
3. Create workspace table, RLS, indexes, and updated-at behavior.
4. Add nullable legacy-compatible idempotency fields and unique partial indexes.
5. Install immutable-content/no-delete triggers that require the migration-owner execution context plus a transaction-local activation guard for lifecycle-only updates, and restrict snapshot/document authenticated writes.
6. Install the owner-controlled finalization function, revoke execution from `public` and `authenticated`, and grant execution only to `service_role`.
7. Tighten private proposal PDF update/delete policy while preserving internal insert/read and edge cleanup.
8. Deploy the updated standalone edge function.
9. Deploy Angular changes after backend contracts are available.
10. Validate quickstart success/failure/idempotency scenarios before production use.

**Rollback considerations**: Frontend can be rolled back before workspace use without affecting submitted history; orphan unsubmitted workspaces may be retained for later cleanup. Do not roll back immutable constraints/function schema after new revisions are activated unless the replacement path preserves new snapshot/document/idempotency records. Storage policy rollback must not restore ordinary mutation of already submitted PDFs without explicit risk acceptance.

## Post-Design Constitution Re-Check

**Status**: PASS

- Design remains inside CRM admin and Supabase private boundaries.
- No public/client behavior, frontend split, new framework, payment provider, PDF generator, or e-signature workflow is introduced.
- The executable migration covers every new/modified table, function, trigger, RLS, constraint, index, grant, and storage policy.
- Submitted proposal data and PDFs receive stronger protection while the editable workspace remains appropriately mutable.
- `submit-floral-proposal` stays standalone and owns no shared local edge imports.
- Manual PDF upload and future financial reporting needs are preserved.
- Unit/integration validation covers authorization and all critical state transitions.
- No constitution violation requires complexity justification.
- Git commit/push remain human-owned.

## Complexity Tracking

No constitution violations are required for this plan.
