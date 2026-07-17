# Research: Automated SignWell Contract Delivery

## Decisions

- Use `POST /document_templates/documents` with `draft: true`, then `POST /documents/{id}/send`. Persisting the document ID between those calls prevents blind duplicate creation.
- Use one `SIGNWELL_TEMPLATE_ID` and one client placeholder supplied through edge-function secrets; no CRM template manager or database lookup remains.
- Use `template_fields` for the thirteen approved API IDs. `dateSigned` is signer/provider output and is never prefilled.
- Use SignWell supplemental `files` for the Canva PDF. It is appended after template content, producing contract-first/proposal-second ordering. Omit the optional supplemental `fields` property because no fields are added to the Canva PDF; the live provider rejects an empty `fields: [[]]` value.
- Upload the PDF to private Supabase Storage before orchestration. The edge function reads object metadata and only the first five bytes to validate size and the `%PDF-` signature, then supplies SignWell a 15-minute signed `file_url`. SignWell retrieves the private file directly, avoiding full-file edge downloads, base64 expansion, and duplicate JSON allocations that can trigger Supabase 546 resource-limit failures.
- Let SignWell deliver its configured email. Do not send Mailgun proposal-auth email for new submissions.
- Treat only verified `document_completed` and `document_declined` states as terminal. Retrieve the provider document before mutating CRM status.
- Read `dateSigned` first and use the client recipient `signed_at` date only for recovery; record mismatch/recovery metadata.
- Preserve legacy proposal-access routes and columns for historical data, but stop producing new passcodes, combined PDFs, or embedded sessions.
- Keep every edge function standalone. Do not introduce `_shared` modules or edge-function unit-test files; independently type-check deployable sources and use SignWell test-mode smoke scenarios for provider behavior.
- Use the SignWell Workspace Callback URL as the single callback registration. Supabase hosts the receiver, SignWell posts to it, and a Black Begonia-generated URL-safe token authenticates callbacks because SignWell does not issue this token.
- Normalize human-readable service labels to the deployed lowercase `public.service_type` enum at the lead repository boundary. This prevents PostgREST 400 responses while keeping presentation labels independent from persistence values.
- Build the compact lead modal from CRM theme variables rather than fixed light-only component colors so the existing theme toggle updates the modal immediately.
- Disable Angular component HMR in the workspace serve target. A stale Vite dependency-cache lock left an orphaned `ng serve` process and surfaced a misleading missing-JIT-compiler error; AOT output and ordinary live rebuild remain authoritative.

## SignWell constraints

- Recipients must be assigned to a template placeholder.
- Appended-file fields use a two-dimensional array with one entry per supplemental file.
- Completed PDFs can lag completion briefly, so webhook storage is best-effort and the provider reference remains authoritative for later retrieval.
- Production smoke testing requires real account template/placeholder identifiers and cannot be completed from the repository alone.
- The fixed client recipient placeholder is `Client` unless the SignWell template is deliberately renamed; the configured value must match the template role exactly and case-sensitively.
- `SIGNWELL_API_KEY` is copied from SignWell Settings > API, while `SIGNWELL_TEMPLATE_ID` is the template UUID rather than its display name.
- SignWell's current `TemplateRecipients` schema requires both `id` and `email`; `placeholder_name` is additionally required by the template assignment workflow. The single client is sent with stable request ID `"1"`.
- Provider 400/422 bodies may use nested `errors` or `meta.messages` instead of a top-level `message`; integration logging must flatten those structures while redacting URLs and email addresses.
- Although SignWell's published schema describes supplemental `fields`, its live create-from-template validator reports an empty two-dimensional value as an invalid key value. Omitting the optional property is valid and preserves all template-owned fields.
- The live template reports both `Client` and `Document Sender` as required placeholder roles. Use optional backend sender name/email overrides when configured; otherwise use the authenticated submitting florist's active CRM profile with auth metadata/email fallback. SignWell rejects duplicate recipient emails, so the sender and client addresses must differ.
- SignWell's live DateField validator rejects a date-only `YYYY-MM-DD` string even though it is an ISO-8601 calendar-date representation. Send a full midnight-UTC timestamp (`YYYY-MM-DDT00:00:00.000Z`) to preserve the intended date and let the template's `date_format` setting control client-visible formatting.
- Browser-visible progress is limited to real await boundaries: proposal persistence, Storage upload, edge/SignWell orchestration, and history reload. Deeper provider milestones require a separate polling or realtime status protocol and are not fabricated in this synchronous workflow.

## Repository findings

- The former submission edge function composed proposal-first PDFs and sent Mailgun portal emails without creating a real SignWell template document.
- `projects` already contained venue street addresses but not ZIP codes; lead conversion did not copy addresses.
- Proposal history already sorts successfully submitted records by submission/update/version and is retained.
- The previous lead edit UI displayed the new address fields but omitted them from the update payload, accepted service display labels that did not match the database enum, and used component-local light backgrounds that bypassed CRM dark-theme variables.
- Public inquiry forms and CRM lead creation may continue using catalog labels, legacy keys, or friendly lead-source labels, but `LeadRepositoryService` normalizes service type and source to exact Supabase enum values before inserting or updating leads.
- Event dates are business calendar dates, not moments in time. Lead persistence and display helpers normalize date-only input to `YYYY-MM-DD` so a selected date such as `2026-11-28` never displays as November 27 because of local timezone conversion.
