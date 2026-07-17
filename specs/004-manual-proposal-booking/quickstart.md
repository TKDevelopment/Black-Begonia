# Quickstart: Manual Proposal Booking

## Prerequisites

- Local Angular app dependencies installed.
- Supabase local or target environment available.
- Authenticated CRM user with access to leads, proposals, projects, and private proposal PDFs.
- A lead with floral proposal builder data and at least one generated proposal draft.

## Database and Storage Setup

1. Apply the manual booking cleanup migration.
2. Confirm `proposal_signing_sessions` no longer exists.
3. Confirm SignWell/passcode/signature columns have been removed from `floral_proposals`.
4. Confirm project proposal document version and invoice snapshot structures exist.
5. Confirm private PDF storage policies allow authenticated CRM upload/read for authorized project records only.

## Edge Function Setup

1. Deploy or run the refactored `submit-floral-proposal` function.
2. Confirm no SignWell environment variables are required.
3. Confirm retired proposal-access/signing functions are not deployed for this workflow.

## Verify Initial Booking

1. Open a lead in the CRM.
2. Click `Generate Floral Proposal`.
3. Build or edit proposal invoice data with catalog items, markup, labor, tax region, totals, and shopping list preview.
4. Click `Finalize Proposal`.
5. Upload a signed proposal/services agreement PDF.
6. Confirm the alert that the lead will become a booked project.
7. Verify a booked project is created.
8. Verify the lead is linked as converted history and is not shown in active lead pipelines.
9. Verify the project has one active proposal document version and one active invoice snapshot.

## Verify Project Revision

1. Open the booked project.
2. Open the proposal builder for the project.
3. Modify proposal invoice data.
4. Finalize and upload a revised signed PDF.
5. Confirm the revision alert.
6. Verify the newest PDF is active.
7. Verify previous PDFs remain visible in project proposal history.
8. Verify the newest invoice snapshot is active for project financial outlook.

## Verify Removed Workflow

1. Attempt a legacy proposal-access URL.
2. Confirm it is not found or inaccessible.
3. Confirm no client signing/passcode UI appears.
4. Confirm no proposal signing email is sent as part of finalization.
5. Confirm no SignWell API call or webhook state is created.

## Suggested Checks

```powershell
npx tsc -p tsconfig.app.json --noEmit
npx tsc -p tsconfig.spec.json --noEmit
npx ng test --watch=false --browsers=ChromeHeadless
npx -y deno check --config supabase/deno.json supabase/edge_functions/submit-floral-proposal.ts
npx ng build --configuration dev
```
