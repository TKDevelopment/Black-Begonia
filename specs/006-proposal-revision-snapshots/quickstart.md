# Quickstart: Proposal Revision Snapshots

## Pre-Implementation Baseline (2026-07-17)

- Scope review: CRM admin and Supabase only; initial lead booking/manual PDF behavior is preserved; migration follows `20260718000000` and `20260718000001`; Git publication remains human-owned.
- Angular suite: 478 of 479 tests passed. The existing failure is `ProjectProposalDocumentVersionRepositoryService creates document versions with private PDF defaults`, whose expectation omits the already-produced `status: 'submitted'` field. Baseline line coverage is 74.34%.
- Production build: Angular compilation reached font inlining, then the sandbox blocked access to Google Fonts (`connect EACCES`); no application compile error was reported before that external access failure.
- Edge type-check: Deno is not installed in the current environment, so the standalone function could not be type-checked locally.
- Standalone boundary inventory: `submit-floral-proposal.ts` is a single file with no `_shared`, local shared-function, or cross-edge-function import.

## Preconditions

- Run the feature on branch `006-proposal-revision-snapshots`.
- Apply migrations through `20260718000002_proposal_revision_snapshots.sql` after the manual proposal booking and project details migrations.
- Deploy the updated standalone `submit-floral-proposal` function.
- Use the authenticated business owner/lead florist CRM account.
- Seed or identify:
  - A project with one valid active v1 snapshot/document pair.
  - A project with a valid active snapshot but a missing, broken, inactive, or snapshot-mismatched active document.
  - A project with materially different v1 and active v2 totals.
  - A project whose active snapshot references catalog items/tax context that are now inactive.
  - Test-only corrupt states for missing/broken active references.

## Verify Revision Eligibility

1. Open `/admin/projects/:projectId` for a valid project.
2. Confirm Financial Summary shows the project-pointer active snapshot version/total.
3. Confirm `Revise Proposal` is enabled and opens `/admin/projects/:projectId/proposal-revision`.
4. Confirm Open Active PDF opens the document linked to the active snapshot.
5. Test a project with no active snapshot and confirm revision is disabled with repair guidance.
6. Test missing, conflicting, broken, and inactive snapshot-pointer states; confirm revision is disabled and no consumer falls back to the latest historical version.
7. With a valid active snapshot, test a missing, broken, inactive, and snapshot-mismatched document; confirm `Revise Proposal` remains enabled while `Open Active PDF` is unavailable with document-specific guidance.
8. Confirm revision is enabled for `awaiting_deposit`, `booked`, `awaiting_final_payment`, and `final_prep`, and disabled with status-specific guidance for `completed` and `canceled`.
9. Confirm the remaining project details sections stay usable when revision or PDF access is unavailable.

## Verify Active Snapshot Hydration

1. Open revision for a valid project.
2. Confirm markup, labor, recorded tax context, financial terms, every line item, order, description, image, quantity, and price match the active snapshot.
3. Confirm component names, order, quantities, recorded costs, pack metadata, markup, sell price, reserve, and shopping-list calculations match recorded values.
4. Inactivate or change linked catalog/tax source data before reopening.
5. Confirm recorded proposal rows do not reprice merely by opening, focusing, blurring, or editing text.
6. Add a new catalog component and confirm current catalog values apply to the new row.
7. Explicitly replace an existing component and confirm current catalog values apply only after that action.
8. Open a safe legacy snapshot and confirm recorded values load with any compatibility warning.
9. Open a legacy snapshot missing core data and confirm revision is blocked with repair guidance rather than initialized from mutable/catalog data.

## Verify Editing And Autosave

1. Edit each builder-supported category: settings, terms, line items, arrangement descriptions/images, components, quantities, markups, reserve, and ordering.
2. Confirm totals and shopping list recalculate in the working revision.
3. Confirm visible autosave state progresses from Saving to Saved.
4. Refresh the page and confirm the latest successful workspace state resumes.
5. Sign out, sign back in, and confirm the same project workspace resumes.
6. Simulate an autosave failure and confirm the UI shows Save failed without claiming the changes are durable.
7. Restore connectivity/retry and confirm the workspace saves.
8. While edits remain unsubmitted, reopen project details and confirm Financial Summary and Active PDF still use the prior active version.
9. Confirm only one workspace row exists for the project.

## Verify Discard

1. Start and autosave a revision.
2. Select Discard Revision.
3. Cancel the warning and confirm the workspace remains.
4. Confirm discard and verify only the workspace is removed.
5. Confirm submitted snapshots, documents, project pointers, activity, and financial summary are unchanged.
6. Start revision again and confirm it initializes from the current active snapshot.

## Verify Approved/Signed PDF Confirmation

1. Finalize a valid revision.
2. Confirm the modal uses revision-specific language and does not claim to book a project or convert a lead.
3. Select missing, non-PDF, empty, oversized, corrupt, and password-protected files and confirm actionable rejection.
4. Select a valid PDF and confirm the UI requires explicit acknowledgement that it is the externally approved or signed final revision document.
5. Cancel confirmation and verify no active data changes.

## Verify Atomic Activation

1. Record the old snapshot/document IDs, version, active flags, project status, `booked_at`, and Financial Summary total.
2. Submit a valid approved/signed revision PDF.
3. Confirm one new snapshot and one new document share project ID, version, idempotency key, and document `invoice_snapshot_id` relationship.
4. Confirm both new records inherit `source_floral_proposal_id` from the baseline snapshot, including preserving null, regardless of workspace/client data.
5. Confirm the new pair is active and the prior snapshot remains retained/inactive while any resolvable prior document remains retained/superseded.
6. Confirm project active pointers reference the new pair.
7. Confirm project status, payment state, and `booked_at` did not change.
8. Confirm the workspace was consumed.
9. Confirm navigation returns to `/admin/projects/:projectId` and the first refreshed Financial Summary uses the new total/version.
10. Confirm proposal history opens both old and new private PDFs when a prior document exists.
11. Confirm one timeline event displays the submitting florist (`display_name`, then email, then `Unknown user` fallback), replaced/new versions, and time without sensitive payload data.
12. Repeat finalization from a valid snapshot with invalid document state and confirm it succeeds and installs a valid new snapshot/document pair.

## Verify Rollback

Inject or simulate failure at each database transition boundary:

1. Before snapshot insert.
2. After snapshot insert but before document insert.
3. After document insert but before prior deactivation.
4. After prior deactivation but before project pointer update.
5. After pointer update but before activity/workspace consumption.

For every failure, confirm:

- The prior active snapshot and snapshot pointer remain unchanged.
- A previously valid active document remains active; when the attempt began with invalid document state, that state remains unchanged and no partial document replacement becomes current.
- Project pointers and Financial Summary remain unchanged.
- No partial new version is visible.
- Workspace remains resumable.
- Error explains retry or PDF reselection.
- Unreferenced staged storage object is removed best-effort or safely reusable at its deterministic path.

Repeat a failure after changing the open project's status to `completed` and `canceled`, and after revoking the florist's internal CRM access. Confirm the edge function rechecks authorization immediately before RPC, the transaction rejects terminal status after locking, current proposal state is unchanged, and the errors are actionable.

## Verify Idempotency

1. Double-click or trigger repeated confirmation with the same pending submission key.
2. Retry after a simulated response/network loss using the same persisted attempt.
3. Confirm every replay returns the same project, snapshot, document, and version.
4. Confirm no duplicate snapshot, document, activity, or active record is created.
5. Modify the workspace after an unsuccessful pending attempt and confirm a new explicit attempt key is used.

## Verify Financial Reporting Contract

1. Seed inactive v1, active v2, and an unsubmitted workspace with three materially different totals.
2. Confirm Financial Summary shows v2 only.
3. Modify/autosave the workspace and confirm Financial Summary remains v2.
4. Successfully activate v3 and confirm Financial Summary changes to v3 on refresh.
5. Query/read the documented future-dashboard current proposal contract and confirm it returns v3 only, never v1/v2/workspace as current.
6. Confirm a zero-dollar active total is displayed as zero while a broken/missing current state displays unavailable/repair guidance.

## Verify Immutability And Authorization

1. As an authenticated browser user, attempt to update snapshot content or totals and confirm rejection.
2. Attempt to delete a snapshot or document record and confirm rejection.
3. Attempt to update/delete a submitted proposal PDF through ordinary browser storage access and confirm rejection.
4. Confirm authorized signed-URL read access still works.
5. Attempt workspace access and finalization without authentication or CRM access and confirm rejection.
6. Confirm the finalization function cannot be called through ordinary authenticated client RPC access.
7. Confirm RLS and the edge function accept only users for whom `public.is_internal_crm_user()` is true, matching the existing Angular admin route guards.
8. Attempt lifecycle-only updates as `authenticated` and directly as `service_role` without the controlled transaction guard; confirm both are rejected.
9. Confirm only the migration-owner `SECURITY DEFINER` function with transaction-local `app.proposal_revision_activation=on` can supersede lifecycle state, and content updates/deletes remain rejected.

## Verify Performance And Completion Time

1. Load or seed a representative 100-line proposal and record at least 20 edit-to-recalculation samples; confirm at least 95% complete within 200 ms.
2. Stop typing after a mutation and confirm autosave dispatches 750 +/- 150 ms after the last change and reaches Saved or actionable error state within 2 seconds in the seeded test environment.
3. Create and then resume a workspace; confirm editable state is available within 2 seconds in the seeded test environment.
4. Time the typical florist journey from selecting `Revise Proposal` through editing representative fields, selecting a ready approved/signed PDF, confirming submission, and seeing success on project details; confirm completion within 5 minutes, excluding external PDF preparation.

## Automated Verification

- Run focused Karma/Jasmine specs for project details, Financial Summary, proposal documents, builder component, builder snapshot adapter, workspace repository/service, workflow service, and submission modal.
- Run the full non-watch Angular test suite.
- Run the production Angular build.
- Type-check the standalone edge function with the repository's Deno configuration.
- Run migration/RPC integration checks against an isolated Supabase environment, including rollback, idempotency, RLS, immutability, and legacy-data preflight cases.

## Regression Checks

- Initial lead proposal builder remains editable for eligible leads.
- Initial proposal finalization still uses manual PDF upload and lead-to-project conversion.
- Existing project document history/comparison remains available.
- Existing payment-gated project statuses and `booked_at` are unchanged by revisions.
- Private PDF signed URL behavior remains intact.
- Lead details, projects list/details, contacts, organizations, and activity views still load.
- Public website routes/content and any retired client proposal-access paths are unchanged.
- No service-role key or privileged secret is present in frontend code.

## Implementation Verification (2026-07-17)

- Branch: `006-proposal-revision-snapshots`.
- Application and spec TypeScript checks: passed (`tsconfig.app.json` and `tsconfig.spec.json`).
- Focused revision suite: 75/75 passed before the final strict-project-details/performance additions; the added 17-test focused checkpoint also passed.
- Full Angular suite: 508/508 passed. Final coverage was 69.21% statements, 53.24% branches, 63.21% functions, and 70.76% lines.
- Production Angular build: passed after allowing the required Google Fonts request. Existing bundle-budget warnings remain; the build also logged the expected placeholder Supabase portfolio fetch warning.
- Edge authorization regression: `submit-floral-proposal_test.ts` asserts that project revision performs its user-scoped `is_internal_crm_user()` recheck immediately before its sole atomic finalization RPC and remains standalone.
- Database integration fixture: `supabase/tests/proposal_revision_snapshots.sql` covers immutable content/lifecycle rejection, atomic linked activation, one active pair, workspace consumption, one activity, idempotent replay, no-delete history, workspace policy presence, storage mutation-policy removal, and authenticated RPC revocation.
- Environment limitation: Deno, Supabase CLI, and `psql` are not installed here, so the Deno test/type-check and isolated migration/RPC execution remain deployment-environment checks. Live manual scenarios, injected transactional failures, and timed end-to-end florist workflow also require an isolated Supabase deployment.
- Security audit: no service-role key reference exists in Angular application/environment sources; privileged RPC execution is edge-only.
- Diff audit: changes are confined to feature 006 specification artifacts, CRM project/proposal surfaces, their tests/models/services, the standalone proposal edge function, and Supabase schema/migration/integration tests. No public/client proposal surface was added.

## Builder UX Revision Verification (2026-07-18)

- The builder action toolbar keeps Save Draft, Discard Revision, and Finalize Proposal in one non-wrapping row; the deprecated Export PDF action and print-export implementation were removed.
- The legacy snapshot compatibility warning and Discard Revision action now use explicit light/dark CRM theme styles, including themed discard hover feedback.
- Catalog composition uses one dynamically filtered datalist/typeahead. Typing preserves recorded snapshot pricing, while selecting a complete current-catalog suggestion explicitly applies that catalog item's current values.
- The expanded line-item settings card, image control, duplicate line-type control, and description input were removed. Line type is selected through the badge-style control in the primary row, and row expansion now exposes only Internal Catalog Composition.
- Manual labor, fee, and discount pricing remains editable through the primary-row Unit Price field after removal of the expanded settings card.
- Focused builder suite: 20/20 passed. Full Angular suite: 509/509 passed. Production Angular build: passed after allowing the required Google Fonts request; existing bundle-budget and placeholder Supabase portfolio-fetch warnings remain.

## Human Source-Control And Deployment Handoff

1. Review the feature diff on `006-proposal-revision-snapshots`; no commit or push was performed by the agent.
2. In an isolated Supabase environment, apply `20260718000002_proposal_revision_snapshots.sql` and run `supabase/tests/proposal_revision_snapshots.sql`.
3. Run `deno check --config supabase/deno.json supabase/edge_functions/submit-floral-proposal.ts` and `deno test --config supabase/deno.json supabase/edge_functions/submit-floral-proposal_test.ts`.
4. Deploy the standalone `submit-floral-proposal` function, then execute the manual eligibility, hydration, autosave/discard, activation, rollback, idempotency, reporting, authorization, and timing scenarios above.
5. Commit and publish only after those deployment-environment checks pass.
