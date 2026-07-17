# Supabase Artifact Classification: Manual Proposal Booking

## Keep

- `supabase/schemas/public/tables/leads.sql`: preserve converted lead history fields and event/planner/contact data.
- `supabase/schemas/public/tables/projects.sql`: keep and extend as the booked event owner.
- `supabase/schemas/public/tables/floral_proposal_line_items.sql`: preserve builder invoice data.
- `supabase/schemas/public/tables/floral_proposal_components.sql`: preserve catalog composition data.
- `supabase/schemas/public/tables/floral_proposal_shopping_lists.sql`: preserve shopping list generation.
- `supabase/schemas/public/tables/floral_proposal_shopping_list_items.sql`: preserve shopping list details.
- `supabase/schemas/public/tables/tax_regions.sql`: preserve tax calculations.
- `supabase/schemas/storage/floral_proposals.sql`: keep private PDF bucket with project-owned document semantics.
- `supabase/edge_functions/preview-floral-proposal-pdf.ts`: keep only for internal CRM preview/export behavior.
- `supabase/edge_functions/send-inquiry-emails.ts`: unrelated inquiry workflow remains active.
- `supabase/edge_functions/mailgun-webhook.ts`: unrelated email event processing remains active.

## Refactor

- `supabase/schemas/public/tables/floral_proposals.sql`: remove signing/portal/provider fields and keep invoice/snapshot fields.
- `supabase/schemas/public/tables/projects.sql`: add active proposal invoice snapshot and active proposal document version references.
- `supabase/edge_functions/submit-floral-proposal.ts`: replace SignWell delivery with authenticated manual booking/revision submission.
- `supabase/schemas/storage/floral_proposals.sql`: keep bucket private and align policy wording/intent with project-owned signed documents.

## Delete

- `supabase/schemas/public/tables/proposal_signing_sessions.sql`: provider signing session table is obsolete.
- `supabase/edge_functions/signwell-webhook.ts`: SignWell callbacks are obsolete.
- `supabase/edge_functions/verify-floral-proposal-access.ts`: client passcode portal access is obsolete.
- `supabase/edge_functions/submit-floral-proposal-response.ts`: client portal acceptance/decline is obsolete.
- `supabase/edge_functions/send-proposal-email.ts`: proposal portal email delivery is obsolete.
- `supabase/edge_functions/resend-floral-proposal-email.ts`: proposal portal resend behavior is obsolete.

## Migrate

- Existing `floral_proposals` financial fields remain for builder history and source traceability.
- Existing signing/provider/portal columns on `floral_proposals` are dropped by `supabase/migrations/20260717000000_manual_proposal_booking_cleanup.sql`.
- Existing `proposal_signing_sessions` rows are hard-deleted by dropping the table.
- Existing project rows receive nullable active proposal snapshot/document references.
- New confirmed submissions populate `project_proposal_invoice_snapshots` and `project_proposal_document_versions`.
