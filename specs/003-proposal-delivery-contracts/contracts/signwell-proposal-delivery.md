# Contract: Direct SignWell Proposal Delivery

## Finalization request

```json
{
  "proposalId": "uuid",
  "pdfStoragePath": "lead-id/proposal-id/request-id-proposal.pdf",
  "pdfFileName": "proposal.pdf",
  "idempotencyKey": "uuid",
  "expectedVersion": 2
}
```

The caller must be an authenticated CRM user. The storage path must belong to the proposal and contain a valid PDF no larger than 50 MB.

## Success response

```json
{
  "success": true,
  "floral_proposal_id": "uuid",
  "version": 2,
  "signwell_document_id": "uuid",
  "signing_status": "sent",
  "pdf_storage_path": "lead-id/proposal-id/request-id-proposal.pdf"
}
```

## Provider payload

- Fixed `template_id`; client recipient `id: "1"` containing the lead's name/email and exact client placeholder; submitting-florist recipient `id: "2"` containing the configured sender override or CRM/auth name/email and exact `Document Sender` placeholder; distinct recipient emails; `draft: true`; `embedded_signing: false`; and `apply_signing_order: true`.
- Thirteen `template_fields`: `clientName`, `serviceType`, `eventDate`, `ceremonyAddress`, `ceremonyCityStateZipcode`, `receptionAddress`, `receptionCityStateZipcode`, `clientEmail`, `clientPhone`, `retainerAmount`, `finalBalanceAmount`, `finalBalanceDueDate`, and `clientFullName`.
- `eventDate` and `finalBalanceDueDate` use full ISO-8601 request timestamps such as `2026-06-27T00:00:00.000Z`. Midnight UTC preserves the source calendar date, while each SignWell DateField configuration determines how it renders.
- One appended Canva PDF referenced by a 15-minute Supabase signed `file_url`. The optional supplemental `fields` property is omitted because no fields are added to that file. The URL is sent only to SignWell and is not persisted or logged.
- Template subject, message, signature setup, and ordering remain SignWell-owned.

Before draft creation, the backend obtains authoritative storage metadata, rejects files outside the 5-byte-to-50-MB range, and performs a bounded read of the `%PDF-` signature. It MUST NOT download or base64-encode the complete PDF.

Provider failures retain the SignWell operation and HTTP status. Nested `errors`, `meta.message`, and `meta.messages` values are flattened into a bounded diagnostic string; email addresses and URLs are redacted before logging or returning the safe error to the CRM.

## Webhook contract

- Callback token is supplied as `?token=<SIGNWELL_WEBHOOK_TOKEN>` or `x-signwell-webhook-token`.
- The production Workspace Callback URL is `https://<project-ref>.supabase.co/functions/v1/signwell-webhook?token=<SIGNWELL_WEBHOOK_TOKEN>`.
- SignWell owns callback registration; Supabase hosts the receiver. Register the URL once, not both as the workspace callback and an API hook.
- `SIGNWELL_WEBHOOK_TOKEN` is a Black Begonia-generated URL-safe random secret and must match the deployed edge-function secret exactly.
- The webhook deployment permits unauthenticated gateway access because SignWell cannot supply a Supabase JWT; the function performs opaque-token authentication before reading event data.
- Nonterminal events return success without CRM status mutation.
- `document_completed` requires provider status `completed`; `document_declined` requires provider status `declined`.
- Replays of the current terminal state return success without duplicate lead activity. Conflicting terminal states return `409`.

## Deployment contract

- `SIGNWELL_API_KEY` comes from SignWell Settings > API.
- `SIGNWELL_TEMPLATE_ID` is the template UUID.
- `SIGNWELL_CLIENT_PLACEHOLDER_NAME` is `Client` and must exactly match the template recipient role.
- Each edge function is standalone. Production sources do not import from `_shared` or another local edge-function file.
- Edge-function unit-test files are not part of this repository contract; Deno type-checking and deployed test-mode smoke scenarios verify the integration.
