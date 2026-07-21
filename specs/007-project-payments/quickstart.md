# Quickstart: Integrated Project Payments

## 1. Prerequisites And Configuration

### Configuration inventory

| Boundary | Public/browser configuration | Secret/server configuration | Default rollout state |
|---|---|---|---|
| Customer route | `PAYMENT_PUBLIC_ORIGIN`, public PayPal client ID, method capability flags | none | route deployable; database switches govern collection |
| Stripe | card capability flag | restricted API key, webhook endpoint secret, expected account | disabled in collection settings |
| PayPal/Venmo | public client ID and Venmo capability flag | client secret, webhook ID, expected merchant/payee | disabled; fallback configured separately |
| Mailgun | none | API key, signing key, sending domain | processor disabled until smoke validation |
| Automation | none | named Vault/Edge automation secret | Cron idempotent; reminders disabled |
| CRM | guarded `/admin/payments` route | authenticated internal-user role | reads deploy before provider mutations |
| Marketing | none | none | no routing, sitemap, SEO, content, or style changes |

Required Edge/Vault names are `PAYMENT_TOKEN_ENCRYPTION_KEY`, `PAYMENT_TOKEN_KEY_VERSION`, optional previous-key rotation values, `PAYMENT_CRON_SECRET`, `PAYMENT_PUBLIC_ORIGIN`, `PAYMENT_ALLOWED_ORIGINS`, Stripe restricted/webhook/merchant identifiers, PayPal client/secret/webhook/merchant identifiers, and Mailgun API/domain/from/signing values. Vault Cron installation specifically expects `project_url`, `service_role_key`, and `payment_cron_secret`.

- Apply migrations through `20260718000002_proposal_revision_snapshots.sql` first.
- Configure Stripe restricted secret, webhook secret, environment/account identity, and approved return origin.
- Configure PayPal client ID/secret, webhook ID, expected merchant/payee, and enable Venmo funding for the account; configure the official Venmo Business Profile fallback target separately.
- Configure Mailgun domain/API/signing keys and webhook endpoint.
- Add the named automation secret to Supabase Vault and Edge secrets before the idempotent Cron installation step; configure business IANA timezone, send window, cash/check instructions, and global/provider switches.
- Customer card surcharging is fixed off and not configurable in this release; verify Stripe checkout charges principal only and records zero customer fee.

## 2. Migration Validation

1. Run the migration preflight on production-like data and retain counts for legacy records by project/kind/status.
2. Apply `supabase/migrations/20260719000000_integrated_project_payments.sql`.
3. Verify every new/modified table has RLS, declarative schema, required unique/partial indexes, no anon policy, and no default public execution on definer functions.
4. Compare each migrated project's legacy paid amount to imported transaction allocations; verify ambiguous fixtures have open exceptions and unavailable fields were not invented.
5. Confirm direct authenticated insert/update/delete of immutable transactions/allocations/provider events fails.
6. Confirm Cron is named once, Vault secret is not embedded in SQL/log output, and global reminders remain off.

## 3. Standalone Function Checks

Keep every function in its own `supabase/edge_functions/<function-name>/index.ts` directory. Type-check and deploy each directory independently. Inspect imports to prove no `_shared`, other Edge Function, or local shared-module dependency. Do not create an automated test file or harness that targets, imports, invokes, or simulates an Edge Function. Use provider/customer sandbox smoke checks for invalid signatures/tokens before happy paths and record the results here.

## 4. Conversion And Deposit

1. Convert an accepted lead with a valid active proposal and email enabled: verify one atomic project/contact/proposal/obligation conversion, Awaiting Deposit, 30% obligation due conversion date, active request, one initial delivery, and usable link.
2. Convert with email declined: verify the same obligation/status, no request/reminder, and manual receipt remains available.
3. Simulate Mailgun failure: conversion persists, failure/retry is visible, no false delivery/reminder anchor exists.
4. Test billing contact resolution and primary fallback; with neither email, sending is disabled but conversion succeeds.
5. Inject a failure after each contact, project, proposal-pointer, obligation, lead-state, and activity write stage; verify the conversion transaction leaves no partial state, and replay with the same command key returns the single completed project/obligation set.

## 5. Customer Link And Checkout

1. Test active, altered, revoked, superseded, fulfilled, canceled, and cross-project tokens; only active returns minimal context.
2. Verify mobile/desktop display of fixed amount, consolidated breakdown, fee disclosure, and four methods.
3. Concurrently click Stripe/Venmo in multiple tabs: exactly one active attempt exists; same method reuses it and all other methods return locked.
4. Stripe: verify exact line items/metadata/expiry and that return alone stays Processing. Replay/concurrently deliver paid webhook; exactly one receipt/allocation/activity/status effect exists.
5. PayPal/Venmo: verify lazy browser SDK loading, eligibility, fixed server order, approval-to-server-capture, signed webhook, completed capture authority, cancellation/error fallback, pending/denied handling, and order/capture replay.
6. Disable integrated Venmo: fallback opens only the approved business target, records no paid principal, creates one non-stacking seven-day pause, and requires manual reconciliation.
7. Cash/check: snapshot instructions, record zero-value intent, pause exactly seven days without extension, then permit the next eligible reminder.

## 6. Allocation, Status, And Adjustments

1. Record partial deposit installments; verify partial state and no booking.
2. Fulfill deposit; verify one Awaiting Deposit→Booked transition and `booked_at` behavior.
3. Record value above deposit: allocate deposit then final. Flag only beyond complete project balance.
4. Reconcile a consolidated full-balance receipt from Awaiting Deposit; verify direct Final Prep when both obligations fulfill.
5. Replay a manual command and provider event; verify one immutable BB reference/effect.
6. Trigger duplicate warning and prove nonempty override reason/suspected reference are required.
7. Record refund/reversal/dispute/correction; verify append-only adjustment, recalculated balance, unchanged project status, urgent exception, and correct customer-notice policy.
8. Resolve overpayment as external refund, retained credit, or correction; verify required note/reference and no provider refund/cross-project allocation.

## 7. Proposal Revision

1. Before any confirmed receipt, activate a revised proposal: verify deposit becomes 30% of new total and obsolete request is superseded.
2. After a full or partial confirmed receipt, activate a revision: verify the deposit target freezes at its first-receipt value, historical credit remains, final/outstanding change, and customer sees only a newly issued current request.
3. Test invalid active snapshot pointers: show unavailable/review state rather than fallback pricing.

## 8. Reminder And Email Matrix

Set the business timezone and run repeated/concurrent scheduler invocations at 60,45,38,31,30,1,0,-1 day fixtures and weekly deposit boundaries. Verify:

- one occurrence per eligible local date/interval;
- no sends for fulfilled/waived/canceled obligations or completed/canceled/past-event projects;
- consolidated request suppresses deposit-only reminders;
- current recipient/event date/balance rechecked and snapshotted before every send while the request retains its original-recipient audit snapshot;
- weekly deposit intervals anchored on the initial request's Mailgun acceptance timestamp, not a later delivered event;
- cash/check, obligation, and global pauses suppress without backfill;
- definitive failures are retryable and unknown acceptance is not blindly resent;
- receipt/mandatory adjustment delivery failures do not rollback finance.

## 9. CRM Acceptance

- `/admin/payments` shows one row per obligation, supports search/filter/sort/reset, opens modal without a details route, preserves table state, and navigates to project.
- Modal includes basis, requests, installments, receipts, allocations, fees, intentions, deliveries, provider references, exceptions, notes, and activity.
- Authorized florist can place and release a project-wide legal/dispute hold from the obligation modal only with a reason; the audit history remains visible and release does not immediately purge records.
- Settings modal exposes timezone, send window, instructions, Venmo target, provider/reminder switches, and emergency reminder control, but no card-fee toggle.
- Payments table, modal and project Financial Summary agree to the cent and distinguish zero from unavailable.
- Activity identifies florist/customer/provider/schedule actors without exposing tokens/provider payloads.

## 10. Regression And Operational Rollout

Run focused Karma/Jasmine suites, `npm run test:coverage`, PostgreSQL integration checks, independent Edge Function type-checks, provider/customer sandbox smoke checks, full headless Angular tests, and production build. Recheck existing lead conversion, projects, proposal revision, manual PDF/document access, manual payment logging, marketing routes, SSR, and sitemap.

For SC-002, SC-008, and SC-012, record the scenario list, sample count, start/end timestamps, calculated percentile or pass ratio, device/viewport, and reviewer result. For retention, test seven years minus one day, exactly seven years, seven years plus one day, invalidated ciphertext cleanup, and legal/dispute holds separately; financial history must not be deleted by the secret-cleanup procedure.

## 11. Implementation Validation Record

Validation date: 2026-07-20.

| Check | Result | Notes |
|---|---|---|
| Production Angular build | PASS | `npm run build`; 24 static routes prerendered. Existing initial-bundle and pre-existing SCSS budget warnings remain. The placeholder Supabase portfolio DNS warning is expected in this environment. |
| Angular spec compilation | PASS | `npx tsc -p tsconfig.spec.json --noEmit`; all Jasmine/Karma spec sources type-check. |
| Standalone Edge type-check | PASS | `npx --yes deno check --config supabase/deno.json` checked all eight payment function entrypoints after each was independently enumerated. No `_shared`, cross-function, or local application imports were found. |
| Edge automated tests | NOT CREATED | Required by the project constitution: Edge Functions are validated only by independent type-check and external sandbox smoke checks. |
| Focused Karma/Jasmine | BLOCKED | Two bounded ChromeHeadless invocations produced no compiler/launcher output and timed out after 124s and 184s. Exact orphaned Node test processes were stopped; no test assertion failure was reported. |
| PostgreSQL pgTAP | NOT RUN | This workspace has no configured local Supabase/PostgreSQL runtime or database credentials. Database-only assertions were expanded in `supabase/tests/integrated_project_payments.sql`. |
| Stripe/PayPal/Mailgun/customer smoke | NOT RUN | Requires provisioned sandbox accounts, webhook endpoints, secrets, and an applied migration. Do not enable provider/reminder switches until the matrices in sections 5, 6, and 8 pass. |
| SC-002/SC-008/SC-012 acceptance scoring | NOT RUN | Requires the deployed sandbox and reviewer/device samples; the required measurement method remains in section 10. |

### Human source-control handoff

No commit or push command was run. Review the migration, standalone function directories, Angular payment/customer/CRM changes, and database/Angular tests as separate logical groups before committing. Suggested commit message:

`feat(payments): add project payment collection, reconciliation, reminders, and CRM`

## 12. Conversion Workflow Defect Correction

Validation date: 2026-07-20.

- The signed-proposal submission modal now requires an explicit **Send deposit email** or **Defer deposit email** decision for initial conversions.
- Initial signed-proposal submission now uses `convert_lead_to_project_with_payments`; it no longer creates or updates an initial project as Booked.
- The resulting project is explicitly persisted as Awaiting Deposit with `booked_at` unset and deposit/final obligations initialized from the active proposal.
- Project and lead activity record the deposit amount, Awaiting Deposit state, and florist email decision. No secure token or customer payment URL is written to activity.
- `20260720010000_repair_proposal_payment_conversion.sql` repairs only lead-derived Booked projects that have an active positive proposal snapshot and no payment obligations. It restores the billing contact link, creates the missing obligations, clears `booked_at`, and annotates the repair.
- Angular spec compilation, the production build, and independent Deno type-checking of `submit-floral-proposal.ts` pass. No Edge Function automated test was created.

## 13. Proposal Modal And Immediate Deposit Email Correction

Validation date: 2026-07-20.

- The document modal is viewport-bounded with an independently scrolling body, compact upload/deposit sections, a fixed circular close button, and no redundant signed-document acknowledgement.
- The modal receives the CRM theme explicitly because it renders outside the builder page wrapper; both deposit choices and surrounding surfaces now use the dark-theme tokens.
- `issue-payment-request` returns a bodyless `204` preflight response, explicitly permits the configured origins plus local Angular development origins, and performs its own authenticated-user validation with JWT gateway verification disabled in `supabase/config.toml`.
- The immediate dispatcher accepts either the configured cron secret or its service-role invocation. Initial requests bypass the automated-reminder send window through `20260720020000_send_initial_payment_requests_immediately.sql`; reminders remain window-controlled.
- Required deployed secrets remain `PAYMENT_ALLOWED_ORIGINS`, `PAYMENT_TOKEN_ENCRYPTION_KEY`, `PAYMENT_TOKEN_KEY_VERSION`, `PAYMENT_PUBLIC_ORIGIN`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MG_DOMAIN`, `MG_API_KEY`, `MG_BASE_URL`, `MG_FROM_EMAIL`, `MG_TO_REPLY`, `MG_REGION`, and `MG_WEBHOOK_SIGNING_KEY`. `PAYMENT_CRON_SECRET` remains required for scheduled invocations.
- Angular spec compilation, production build, and independent Deno type-checking of both modified payment functions pass. No Edge Function automated test was created.

## 14. Test Project Cascade Deletion

Validation date: 2026-07-20.

1. Open a converted test project with no payment transactions, provider events, or legal/dispute holds.
2. Confirm the **Delete test project** card is directly below the Activity card and remains legible in light and dark CRM themes.
3. Open the confirmation dialog. Verify deletion stays disabled until the florist checks the permanent-action acknowledgement and types the exact, case-sensitive project name.
4. Delete the project and verify the projects table opens. Confirm the project, project activity, tasks, proposals/snapshots/documents, payment obligations/requests/intentions/deliveries, and unshared converted lead/customer records are gone. Shared contacts and organizations must remain.
5. Confirm proposal PDF objects returned by the database command are removed from Storage. A storage-cleanup failure must be reported to the florist even though the database transaction has completed.
6. Repeat with a project containing a payment transaction, correlated provider event, or payment legal/dispute hold. The database must reject deletion and retain every row.

The database command is intentionally limited to internal CRM users, rechecks the exact project-name confirmation, locks the project for the transaction, and never deletes immutable financial ledger history. No Edge Function is involved.

## 15. Payment Request UUID Aggregate Hotfix

Validation date: 2026-07-20.

- `20260720040000_fix_issue_payment_request_uuid_aggregation.sql` replaces the unsupported `min(uuid)` expression in `issue_payment_request` with UUID-safe array selection while preserving the existing same-project validation.
- The base integrated-payments migration and matching declarative function use the same corrected expression for fresh environments.
- A converted Awaiting Deposit project whose original request failed before creating a delivery now exposes **Send deposit email** on the project Payments card. Once an initial delivery exists, delivery-specific failures continue through the audited **Retry email** action.
- Apply the hotfix migration before retrying. Verify one active deposit request, one initial delivery, Mailgun acceptance, and a usable secure customer link.

## 16. Immediate Payment Email Dispatch And Diagnostics

Validation date: 2026-07-20.

- `issue-payment-request` now targets the exact initial delivery it just created. It does not rely on the scheduled batch processor or the delivery's position in a queue.
- The audited **Retry email** action now calls the standalone `retry-payment-delivery` Edge Function. That function creates the linked retry through `retry_payment_delivery` and immediately targets the new delivery for processing.
- `process-payment-messages` records and logs Mailgun's safe response message, HTTP-derived failure class, delivery ID, and outcome. Recipient addresses, secure payment URLs, tokens, API keys, and full provider payloads are not logged.
- The project Payments card exposes the redacted provider reason and failure class for failed or unknown deliveries. Conversion preserves the successfully created Awaiting Deposit project and presents the delivery failure reason to the florist.
- Apply `20260720050000_immediate_payment_delivery_retry.sql`, then deploy `process-payment-messages`, `issue-payment-request`, and the new `retry-payment-delivery` function. Both browser-facing functions must retain their standalone CORS/auth configuration with gateway JWT verification disabled.
- The payment dispatcher uses the same Mailgun contract as `send-inquiry-emails`: `MG_API_KEY`, `MG_BASE_URL`, `MG_DOMAIN`, `MG_FROM_EMAIL`, `MG_TO_REPLY`, and `MG_REGION`. Use `MG_BASE_URL=https://api.mailgun.net` with `MG_REGION=us`, or `MG_BASE_URL=https://api.eu.mailgun.net` with `MG_REGION=eu`.
- For a `mailgun_http_400` result, inspect the stored redacted message for an invalid sender/domain/request field. A `mailgun_http_401` result indicates invalid or missing API credentials, `mailgun_http_403` indicates insufficient credential permission, and `mailgun_http_404` commonly indicates a wrong domain or regional API origin.
- Do not create another retry while an earlier retry is still queued. Deploy the corrected processor and let the existing scheduled invocation process that row once, then use its exact recorded outcome to decide whether another audited retry is needed.

## 17. Final Collection UUID Aggregate Hotfix

Validation date: 2026-07-20.

- `20260720060000_fix_final_collection_uuid_aggregation.sql` replaces both unsupported `max(uuid)` calls in `activate_project_final_collection` with deterministic UUID-safe array selection.
- The selected IDs are limited to open obligations with positive outstanding balances, matching the amounts used to build a final or consolidated request.
- The scheduled message processor evaluates final-collection activation before claiming its batch, so this defect could abort an entire Cron run and leave an initial deposit delivery queued even though the failing aggregate belonged to final-payment preparation.
- Apply the migration before retrying the queued delivery. No Edge Function change or redeployment is required specifically for this UUID correction if the immediate-dispatch functions from section 16 are already deployed.

## 18. Dispatcher HTTP 500 Diagnostic Repair

Validation date: 2026-07-20.

- `20260720070000_repair_immediate_delivery_claim.sql` idempotently re-establishes `claim_specific_payment_delivery(uuid)`, verifies the singleton payment settings row during execution, restores service-role-only execution, and asks PostgREST to reload its schema cache.
- `process-payment-messages` now classifies outer failures by a safe processing stage and extracts sanitized details from both JavaScript errors and plain Supabase/PostgREST error objects.
- `issue-payment-request` and `retry-payment-delivery` parse a failed processor response and surface its sanitized cause instead of replacing every failure with only `HTTP 500`.
- Apply migration `20260720070000`, then redeploy all three standalone functions. A subsequent failure should identify a stage such as `processor_claim_specific_delivery` and provide the safe database/provider reason in the CRM and function logs.

## 19. Vault-Safe Processor Enqueue

Validation date: 2026-07-20.

- `20260720080000_harden_payment_processor_enqueue.sql` adds the service-only `enqueue_payment_message_processor(uuid)` database boundary and replaces the Cron job's inline `net.http_post` statement with that function.
- The function requires nonempty `project_url`, `service_role_key`, and `payment_cron_secret` Vault values, validates the project URL as an official HTTPS Supabase project origin, and only then submits the asynchronous HTTP request.
- Manual recovery for one queued row is now `select public.enqueue_payment_message_processor('<delivery-id>'::uuid);`; a missing or invalid Vault value produces a named configuration exception before `pg_net` receives a row.
- The `GOTRUE_JWT_ADMIN_GROUP_NAME` and `GOTRUE_JWT_DEFAULT_GROUP_NAME` deprecation notices are emitted by the Supabase Auth service. Those variables are not configured or referenced by the Black Begonia repository and do not represent payment delivery outcomes.

## 20. Mailgun HTTP 401 Credential Diagnostics

Validation date: 2026-07-20.

- A Mailgun HTTP 401 proves the processor reached Mailgun but Mailgun rejected Basic authentication before accepting the message. It is not a conversion, queue, Cron, recipient, or CORS failure.
- `MG_API_KEY` must be an active Mailgun Account API Key with sending permission or, preferably, a Domain Sending Key created for the exact `MG_DOMAIN`. Store only the raw key value without quotes or an `MG_API_KEY=` prefix.
- `MG_DOMAIN` contains only the verified Mailgun sending domain, without a protocol, path, or email address. `MG_FROM_EMAIL` uses an address authorized for that domain, and `MG_TO_REPLY` becomes the Reply-To address on customer payment messages.
- `MG_BASE_URL` is `https://api.mailgun.net` for `MG_REGION=us` and `https://api.eu.mailgun.net` for `MG_REGION=eu`.
- `mailgun-webhook` verifies callbacks with `MG_WEBHOOK_SIGNING_KEY`. The payment functions retain the older `MAILGUN_API_KEY`, `MAILGUN_API_ORIGIN`, `MAILGUN_DOMAIN`, `MAILGUN_FROM`, `MAILGUN_REPLY_TO`, and `MAILGUN_SIGNING_KEY` names only as migration-compatible fallbacks; the `MG_*` names are canonical and take precedence.
- The standalone processor now validates missing/malformed local configuration before calling Mailgun and replaces an opaque 401 with safe, actionable credential/domain/region guidance.

## 21. Public Payment Link Resolution And Localhost CORS

Validation date: 2026-07-20.

- The site-wide **Not Found** page means the deployed Angular bundle did not match `/pay/:token`; it occurs before payment-token validation. Deploy the current Angular application containing the public payment routes.
- The payment page's **This payment link is unavailable** state means Angular matched the route but `resolve-payment-request` either rejected the browser request or returned the deliberately generic unavailable projection.
- `resolve-payment-request`, `create-payment-checkout`, and `capture-venmo-order` explicitly allow configured production origins plus `http://localhost:4200` and `http://127.0.0.1:4200`, return bodyless preflight `204` responses, and allow the Supabase client's `authorization`, `apikey`, `content-type`, and `x-client-info` headers.
- Deploy the browser functions with gateway JWT verification disabled through `supabase/config.toml`. They authenticate public customers with the opaque request token and enforce their own origin, rate-limit, request-lifecycle, and database checks. Stripe, PayPal, and Mailgun webhook functions likewise disable gateway JWT verification because provider signatures are their authentication boundary.
- Keep `PAYMENT_PUBLIC_ORIGIN=https://blackbegoniaflorals.com` for production email links. `PAYMENT_ALLOWED_ORIGINS` remains the comma-separated production allowlist; localhost development origins are added inside each standalone browser function.

Enable in stages: read/migration → manual RPC → request email → Stripe → integrated Venmo → reminders. Keep emergency switches and manual collection active. Monitor open exceptions, unmatched events, failed/unknown deliveries, stale attempts, and aggregate-parity alerts. Rollback disables new operations; it never removes immutable history or stops required provider callbacks.
