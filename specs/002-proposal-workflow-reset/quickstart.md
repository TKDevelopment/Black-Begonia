# Quickstart: Proposal Workflow Reset

## 1. Confirm Active Feature

```powershell
.specify\scripts\powershell\check-prerequisites.ps1 -Json -PathsOnly
```

Expected active feature directory:

```text
specs/002-proposal-workflow-reset
```

## 2. Review the Active Proposal Workflow Boundaries

Inspect the proposal workflow areas that remain active after the reset:

- CRM builder route: `src/app/components/private/floral-proposal-builder`
- Builder document submission modal: `src/app/components/private/floral-proposal-builder/components/proposal-document-submission-modal`
- Narrowed export-rendering helpers: `src/app/core/proposal-templates`
- Workflow orchestration: `src/app/core/supabase/services/floral-proposal-workflow.service.ts`
- Proposal submission edge function: `supabase/edge_functions/submit-floral-proposal.ts`
- Client review flow: `src/app/components/proposal-access/proposal-auth` and `proposal-review`

## 3. Confirm Template-Authoring Retirement

The retired admin template workflow should no longer be part of the active CRM path:

1. Proposal-template admin routes and sidebar navigation should be absent.
2. Template CRUD screens and template-studio UI should not be reachable from the CRM.
3. Only narrowed export-rendering helpers should remain under `src/app/core/proposal-templates`.
4. Generated-PDF preview and submission dependencies should not be part of the active florist submission workflow.
5. Builder save/finalize/submit paths should not require template selection.

## 4. Refactor Builder State Flow

Implement and verify these florist-facing stages:

1. `Build Floral Proposal`
2. Draft save and export
3. `Finalize Proposal`
4. Locked finalized state with only:
   - `Edit Proposal Data`
   - `Submit Proposal Document`
5. Manual PDF submission
6. Client decline
7. Edit -> re-finalize -> replacement PDF submission

## 5. Preserve Client Review Continuity

Keep these downstream behaviors intact:

- Client email and passcode access flow
- Proposal-auth and proposal-review routes
- Acceptance and decline handling
- Proposal history and version visibility to the florist

Only the document source changes; the client review cycle should not be redesigned in this feature.

## 6. Verify Backend and Storage Impact

Confirm the current implementation keeps these guarantees:

- `floral_proposals` and related line-item/shopping-list tables still hold the authoritative proposal data.
- Submitted PDFs continue to land in the approved proposal storage bucket.
- Legacy `document_templates` and `template_id` coupling is no longer required for active proposal saves or submissions.
- Proposal access returns the uploaded PDF and florist-supplied file name to the client review flow.
- Optional Canva import remains non-blocking and inactive unless intentionally reintroduced in a narrowed way.

## 7. Validate Acceptance

Run focused verification for:

- Builder draft, finalize, edit, and re-finalize states
- Manual PDF upload submission
- Decline-driven resubmission gating
- Client auth/review continuity
- Removal of proposal-template routes, navigation, and UI

Suggested validation checkpoints when you are ready to verify:

```powershell
npm run test -- --watch=false --browsers=ChromeHeadless
npm run build
```

If proposal-edge or schema work is changed, also verify the affected focused specs and any local integration checks used by the repo for proposal workflows.
