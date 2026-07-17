# Implementation Plan: Proposal Delivery and Automated SignWell Contracts

**Branch**: `003-proposal-delivery-contracts` | **Date**: 2026-06-27 | **Spec**: [spec.md](./spec.md)

## Summary

The CRM uses one backend-configured SignWell template. Finalize Proposal opens the manual Canva PDF modal without locking the draft. Submission saves proposal data, uploads the PDF privately, creates a SignWell draft from the fixed template, persists its document ID, and sends it. SignWell emails the client directly and appends the Canva proposal after the contract.

## Technical context

- Angular 19 / TypeScript 5.8 CRM, Supabase Postgres/Storage/Edge Functions, SignWell REST API.
- Karma/Jasmine for Angular. Edge functions are standalone deployment units and are verified with Deno type-checking plus deployed smoke tests rather than repository unit tests.
- Edge functions contain no `_shared` directory or local imports. Each source file is independently deployable.
- Angular component HMR is disabled for the development server after Vite cache locking produced invalid lazy-component state; live rebuild remains enabled.
- No public website behavior changes.
- Backend-only secrets: `SIGNWELL_API_KEY`, `SIGNWELL_TEMPLATE_ID`, `SIGNWELL_CLIENT_PLACEHOLDER_NAME`, `SIGNWELL_WEBHOOK_TOKEN`, optional `SIGNWELL_SENDER_PLACEHOLDER_NAME` (defaults to `Document Sender`), optional `SIGNWELL_SENDER_EMAIL` and `SIGNWELL_SENDER_NAME` overrides, optional `SIGNWELL_API_BASE_URL`, `SIGNWELL_TEST_MODE`, and `FLORAL_PROPOSAL_BUCKET`.

## Architecture

1. CRM persists the current proposal as an editable draft and uploads the PDF to the private `floral-proposals` bucket.
2. `submit-floral-proposal` authenticates the CRM user, reloads authoritative lead/proposal data, validates venue requirements, recalculates payment fields, and validates the stored PDF using object metadata plus a bounded five-byte signature read.
3. The edge function creates a short-lived signed storage URL and creates a SignWell draft with thirteen template fields, the client as recipient ID `"1"`, the submitting florist or configured sender override as `Document Sender` recipient ID `"2"`, and one URL-referenced appended PDF. The two recipients must have distinct email addresses. SignWell DateFields receive full midnight-UTC ISO-8601 timestamps while preserving the source calendar date. Because no signing fields are added to the proposal PDF, the optional supplemental `fields` property is omitted. The function stores the provider document ID, then sends the draft without downloading, base64-encoding, or JSON-serializing the complete PDF.
4. Proposal and lead statuses advance only after provider send confirmation. Retry reconciles an existing provider document before creating or sending again.
5. `signwell-webhook` authenticates its opaque callback token, retrieves the provider document, and accepts only verified `document_completed` or `document_declined` terminal states.
6. The lead edit surface exposes all non-metadata business fields in a compact themed modal and converts service display labels to database enum values at the repository boundary.
7. The submission modal remains open and locked throughout the observable save, upload, SignWell request, and history-refresh stages, with spinner-backed milestone text and retryable failure handling.

## Data and security

- Leads and projects store ceremony/reception street address and ZIP fields.
- Proposals store calculated balance/retainer values, due dates, and Canva PDF metadata.
- Signing sessions store provider document, idempotency, and send state.
- Storage remains private; authenticated internal CRM roles upload/read, while edge functions use the service role.
- Existing passcode/combined-package fields and client routes remain available only for historical records.
- The obsolete contract-template application/table definition is removed; production table deletion is deferred until a separate data audit.
- `supabase/migrations/20260627000000_signwell_proposal_delivery.sql` applies the table changes additively and requests a PostgREST schema reload; the storage bucket/policies remain in `supabase/schemas/storage/floral_proposals.sql`.
- Lead identifiers, conversion references, and audit timestamps remain system-managed; editable lead business values include workflow, assignment, consultation, planner, event timing, and complete venue data.
- The service catalog owns the explicit CRM-label-to-`public.service_type` mapping used by create and update repositories.

## Follow-up CRM implementation

- Remove the Record Focus and Required For Save cards from the shared lead modal.
- Reduce modal width, spacing, control height, and vertical chrome while retaining responsive scrolling.
- Pass internal-user and allowed-status options into edit mode.
- Save complete ceremony/reception address fields, event timing, workflow, assignment, decline context, consultation milestones, planner data, and existing lead fields.
- Render the entire modal from CRM theme variables, with a computed-style regression check for dark mode.
- Log structured Supabase error details and show actionable schema-cache guidance for missing-column errors.

## Verification and rollout

- Apply additive schema and storage policy changes first.
- Configure secrets and deploy both edge functions with SignWell test mode enabled.
- Deploy `submit-floral-proposal` with JWT verification and `signwell-webhook` without gateway JWT verification; the webhook performs opaque-token authentication.
- Set the SignWell Workspace Callback URL to `.../signwell-webhook?token=<SIGNWELL_WEBHOOK_TOKEN>` and do not duplicate the callback through `POST /hooks`.
- Run contract-first/proposal-second, completion, decline, and retry smoke tests; then disable test mode.
- Verify lead edits for exact service enum persistence, complete venue values, compact layout, and both CRM themes.
- Rollback by disabling the finalize action/edge deployment. Draft proposals remain editable and provider document IDs remain available for reconciliation.
- A Supabase 546 response indicates CPU or memory exhaustion. The submission path avoids this by keeping PDF processing bounded; after deploying the corrected function, retry with the existing proposal so idempotency can reconcile any provider draft created before an ambiguous failure.
- SignWell non-2xx responses are logged as a redacted operation, provider status, and flattened validation path. A create-from-template 400 should be checked first for recipient ID, exact placeholder case, template UUID, template API IDs, and file URL validation.
- A provider error naming `invalid_keys[0]: fields` means the request included an empty supplemental-fields value. The corrected request omits that optional property rather than sending `fields: [[]]`.

**Lead Intake Data Integrity**:
- Public inquiry and CRM-created leads must persist `service_type` values that match the Supabase `service_type` enum exactly. UI labels and historical catalog keys are normalized at the repository boundary before insert or update so proposal delivery, contract merge data, and lead filtering receive canonical service values.
- Public inquiry and CRM-created leads must also persist `source` values that match the Supabase `lead_sources` enum exactly. Legacy or friendly source values such as `referral`, `personal referral`, and CRM free text are normalized to accepted values before insert or update.
- Public inquiry and CRM-created leads must preserve date-only `event_date` values as the selected calendar day. Date inputs such as `2026-11-28` must be stored and displayed as November 28, 2026 without UTC/local timezone conversion shifting them to November 27.

## Constitution check

PASS: public-site stability is preserved; Supabase and secret boundaries are explicit; CRM tests and deployed edge-function smoke checks cover the affected workflows; manual Canva upload remains primary; proposal financial data remains traceable.
