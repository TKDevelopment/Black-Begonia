# Quickstart: Direct SignWell Proposal Delivery

## Configure

1. Apply `supabase/migrations/20260627000000_signwell_proposal_delivery.sql`, then apply the private storage bucket and policies in `supabase/schemas/storage/floral_proposals.sql`.
2. Confirm the migration added all lead/project/proposal/signing-session columns and completed `NOTIFY pgrst, 'reload schema'` before testing CRM writes.
3. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SIGNWELL_API_KEY`, `SIGNWELL_TEMPLATE_ID`, `SIGNWELL_CLIENT_PLACEHOLDER_NAME`, `SIGNWELL_WEBHOOK_TOKEN`, and `SIGNWELL_TEST_MODE=true`. Set `SIGNWELL_SENDER_PLACEHOLDER_NAME` only if the template role differs from `Document Sender`. Optionally set `SIGNWELL_SENDER_EMAIL` and `SIGNWELL_SENDER_NAME` to a stable florist signer identity; its email must differ from every client recipient email.
4. Deploy `submit-floral-proposal` with JWT verification enabled and `signwell-webhook` with gateway JWT verification disabled. The webhook validates its own opaque token.
5. Confirm the SignWell template contains the thirteen prefilled API IDs plus signer-controlled `dateSigned`.
6. Set the SignWell Workspace Callback URL to the deployed webhook URL with the opaque token query parameter.

### SignWell secret sources

- `SIGNWELL_API_KEY`: copy from SignWell **Settings > API**.
- `SIGNWELL_TEMPLATE_ID`: copy the UUID from the **Black Begonia Floral Contract Template** page URL; do not use the display name.
- `SIGNWELL_CLIENT_PLACEHOLDER_NAME`: use `Client` and confirm the SignWell recipient role matches exactly, including case.
- `SIGNWELL_SENDER_PLACEHOLDER_NAME`: optional; defaults to `Document Sender` and must match that second required role exactly if overridden.
- `SIGNWELL_SENDER_EMAIL`: optional florist signer override. When omitted, the authenticated CRM profile/auth email is used. SignWell requires this address to differ from the client's email.
- `SIGNWELL_SENDER_NAME`: optional florist signer display-name override used with the sender email.
- `SIGNWELL_WEBHOOK_TOKEN`: generate this Black Begonia-owned secret locally; SignWell does not supply it.

Generate a URL-safe 256-bit token in PowerShell:

```powershell
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
[Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
```

Never commit secret values or place them in Angular environment files.

### Workspace callback

Supabase hosts the endpoint; SignWell registers and calls it. In SignWell's **Workspace Callback URL**, enter:

```text
https://<project-ref>.supabase.co/functions/v1/signwell-webhook?token=<SIGNWELL_WEBHOOK_TOKEN>
```

The query token must exactly match the Supabase edge-function secret. Do not also register the same callback through `POST /hooks`, which would duplicate deliveries. The workspace callback also reports unrelated workspace documents; those must never mutate CRM records without a matching provider document session.

## Verify lead intake data

1. Submit a public wedding inquiry using `Full-Service Wedding`.
2. Confirm the inserted lead stores `service_type` as `full-service wedding`.
3. Submit a public general inquiry using `Baby Showers` or `Corporate Events`.
4. Confirm the inserted lead stores `service_type` as `baby shower` or `corporate`.
5. Submit a wedding inquiry with `Personal Referral` as the lead source.
6. Confirm the inserted lead stores `source` as `other`, because `referral` is not a Supabase `lead_sources` enum value.
7. Submit an inquiry with November 28, 2026 as the event date.
8. Confirm the inserted lead stores `event_date` as `2026-11-28`, CRM lead views display November 28, 2026, and inquiry confirmation emails display November 28, 2026, not November 27.
9. Edit a lead from the CRM using display labels or friendly source text and confirm the update still stores canonical Supabase enum values.

## Verify finalization

1. Open an eligible lead and complete proposal pricing.
2. Confirm applicable venue address fields and event date are present.
3. Click Finalize Proposal; cancel once and confirm the draft remains editable.
4. Reopen Finalize, upload a valid Canva PDF, and send.
5. Confirm the proposal becomes submitted only after SignWell accepts the send, the lead becomes `proposal_submitted`, and no Black Begonia proposal-auth email is sent.
6. Confirm the delivered packet is contract first and Canva proposal second, with the template-owned email subject/body.

### Recover from a 546 submission failure

A `546 WORKER_RESOURCE_LIMIT` response with `CPU Time exceeded` or `Memory limit exceeded` means an older deployment buffered and base64-encoded the PDF. Deploy the current standalone `submit-floral-proposal.ts`, then retry Finalize and Send using the same proposal. The corrected function validates only storage metadata and five signature bytes before passing SignWell a 15-minute signed file URL. If an earlier attempt created a provider draft, the existing signing-session reference is reconciled instead of creating a duplicate.

### Diagnose a SignWell 400 or 422

Deploy the current `submit-floral-proposal.ts` before retrying. The function now supplies required recipient ID `"1"` and logs `operation`, `provider_status`, and redacted `provider_details` for SignWell failures. If another provider validation remains, use that field path to confirm the template UUID, exact case-sensitive `Client` placeholder, all thirteen API IDs, and the signed PDF URL. Do not paste API keys or full signed URLs into logs or support messages.

If `provider_details` reports `invalid_keys[0]: fields`, the deployed function is still sending the obsolete empty `fields: [[]]` value. Redeploy the current function, which omits the optional supplemental-fields property while retaining every field already configured on the template.

If SignWell reports `missing_placeholder_names: document sender`, confirm the template role is exactly `Document Sender` or set the placeholder override, and confirm the submitting CRM profile or sender override has an email. If it reports `recipients.duplicated_emails`, the client and Document Sender resolve to the same normalized address; set `SIGNWELL_SENDER_EMAIL` to the florist's distinct signing address or use a different client email for the test. If it reports `invalid_date_format`, redeploy the current function, which sends `eventDate` and `finalBalanceDueDate` as full midnight-UTC ISO-8601 timestamps.

During a normal submission the modal displays: **Saving proposal details**, **Uploading the proposal PDF securely**, **Creating and sending the SignWell signing packet**, and **Refreshing proposal history**. The modal cannot be dismissed or have its file replaced while these stages are active.

## Verify outcomes

1. Complete the client signing flow and confirm `document_completed` produces proposal `accepted`, lead `proposal_accepted`, and a populated `retainer_due_date` from `dateSigned`.
2. Repeat with a test document declined and confirm proposal/lead decline states.
3. Replay each webhook and confirm no duplicate lead activity.
4. Interrupt a send after draft creation and retry; confirm the persisted provider document is reconciled rather than duplicated.

## Verify CRM lead editing

1. Open Edit Lead and confirm the Record Focus and Required For Save cards are absent.
2. Confirm all non-metadata lead business fields are editable, including complete ceremony/reception addresses, event timing, workflow, assignment, consultation, decline, and planner values.
3. Save each service category and confirm Supabase stores the exact lowercase `public.service_type` enum value rather than the CRM display label.
4. Toggle light and dark mode with the modal open and confirm its shell, cards, controls, feedback, buttons, shadows, scrollbar, and date/time controls update immediately.
5. If Supabase returns HTTP 400, inspect the structured repository error. A missing-column message requires reapplying the migration/schema reload; an invalid enum message indicates a service mapping mismatch.

## Local development

Component HMR is disabled in `angular.json` because a locked Vite dependency cache produced stale lazy-component metadata. Use ordinary live rebuild:

```powershell
ng serve
```

If Vite reports `EPERM` under `.angular/cache`, stop every project `ng serve` process before deleting the generated `.angular/cache` directory and restarting.

## Automated checks

```powershell
npx tsc -p tsconfig.app.json --noEmit
npx tsc -p tsconfig.spec.json --noEmit
npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox
npx -y deno check --config supabase/deno.json supabase/edge_functions/submit-floral-proposal.ts supabase/edge_functions/signwell-webhook.ts
npx ng build --configuration dev
```

The edge-functions directory intentionally contains no `_shared` directory and no edge-function unit tests. The live SignWell smoke scenarios require deployed secrets, template access, and webhook registration. Keep `SIGNWELL_TEST_MODE=true` until all scenarios pass.
