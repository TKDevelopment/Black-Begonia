# Contracts: Integrated Project Payments

## Route And UI Contracts

- `GET /pay/:token`: isolated lazy Angular payment-options route; no CRM auth/layout/navigation and no SEO/sitemap entry. It renders inside the shared public header/footer, with a payment-only header variant limited to the home logo plus Facebook and Instagram links. It resolves a minimal DTO before showing project/event label, purpose, fixed principal, fee disclosure, total, and enabled methods.
- Unknown routes render the branded Not Found component inside the normal shared public header/footer.
- `GET /pay/:token/status?attempt=opaque-id`: branded Processing/Confirmed/Failed/Still Outstanding view. It polls boundedly, then offers manual refresh; it never derives success from query parameters.
- `GET /admin/payments`: guarded CRM table using existing page header/search/filter/table shell. URL query parameters retain search/filter/sort; opening/closing a row modal does not destroy state.
- `/admin/projects/:projectId`: uses the same obligation summary/read model and transaction history. Manual receipts call the command RPC, never direct upsert.
- Lead conversion payload adds `send_deposit_request: boolean`; conversion confirms the 30% amount and disables email choice if no eligible recipient, while still allowing conversion.
- Integrated Venmo lazily loads PayPal's browser JavaScript SDK only on the payment route; `onApprove` sends the opaque attempt to the standalone capture function and never credits funds locally.

## Public Edge API

All public responses use generic invalid/unavailable errors, `Cache-Control: no-store`, strict CORS for configured application origins, rate limits, and no internal UUIDs except opaque attempt handles.

### `resolve-payment-request`

`POST { token }` returns `{ state, brand, purpose, projectLabel, eventDate, currency:'USD', principalCents, depositCents?, finalCents?, methods, activeAttempt?, intention?, instructionSnapshots? }`.

`state` is `active|processing|confirmed|still_outstanding|unavailable`. Inactive tokens expose no project/customer data. The function hashes and validates token/request/project/obligations on every call.

### `create-payment-checkout`

`POST { token, method:'stripe_card'|'venmo'|'cash'|'check' }`.

- Revalidates current amount, request lifecycle, collection switch, and absence/presence of active attempt in a DB RPC.
- Same electronic method returns the existing provider handoff; any different method returns `409 PAYMENT_METHOD_LOCKED` while active.
- Stripe response: `{ kind:'redirect', url, attempt }`.
- Integrated Venmo response: `{ kind:'paypal_order', orderId, attempt, clientId }`; only the public PayPal client ID is returned.
- Venmo fallback response: `{ kind:'manual_venmo', approvedTarget, reference, amountCents }` and records an intention/handoff.
- Cash/check response: `{ kind:'intention', method, instructions, pauseEndsAt }` and creates/reuses the non-stacking intention.

### `capture-venmo-order`

`POST { token, attempt }` after PayPal approval. Server captures the stored order with its stored idempotency key. `COMPLETED` invokes reconciliation; `PENDING` returns Processing; no browser-supplied amount/order mapping is trusted.

### Status resolution

`POST { token, attempt? }` may be implemented by `resolve-payment-request` with an attempt. It reports only database-authoritative state and never provider secrets/references.

## Provider Webhook Contracts

### `stripe-payment-webhook`

Reads exact raw body, verifies `Stripe-Signature` and timestamp against its endpoint secret, normalizes the event, inserts the provider inbox row, and invokes reconciliation. Supported initial events: Checkout completion/async success/failure/expiry, refunds, charge refunds/reversals, and disputes. A completed session credits only when authoritative payment state is paid and expected currency/amount/metadata match.

### `paypal-payment-webhook`

Verifies PayPal transmission headers/raw event with the configured webhook ID/signing flow. Supports order approval, payment approval reversal, capture pending/completed/denied, refund/reversal/dispute events. Only a verified `COMPLETED` capture with expected merchant, USD amount, and stored order/request correlation credits principal.

Both endpoints:

- return 2xx for already-processed duplicates;
- do not assume event order and retrieve authoritative provider state when necessary;
- persist IDs, hashes, normalized facts and error state, not complete payloads;
- return retryable failure only when a verified event was not durably accepted.

## Database Command Contracts

Functions are security-definer with `search_path=''`, fully qualified objects, revoked from `public`/`anon`, and granted only to internal authenticated users or service role as appropriate.

- `convert_lead_to_project_with_payments(lead_id, project_fields, contact_fields, command_key)`: internal only; atomically validates the accepted lead/active proposal, creates or reuses project/contact links, transfers proposal pointers, establishes deposit/final obligations, updates the lead conversion state, and records activity. Replay returns the same project/obligations. Customer email HTTP is outside this transaction.
- `issue_payment_request(obligation_ids[], principal_cents, kind, token_digest, token_ciphertext, token_iv, token_key_version, command_key)`: internal service boundary; locks obligations, validates fixed amount/outstanding, supersedes conflicting requests, stores only Edge-generated encrypted token material, snapshots instructions and the original recipient for audit, and queues initial delivery. SQL never generates or returns plaintext token.
- `reserve_payment_checkout(token_digest, method, command_key)`: validates lifecycle and returns existing active attempt or creates `creating`; provider HTTP occurs after commit. A finalize RPC attaches provider IDs/URL and marks active, or marks failed.
- `record_payment_intention(token_digest, method, command_key)`: rejects active checkout, returns existing non-stacking pause or creates one, and appends activity.
- `reconcile_payment_event(provider_event_id, normalized_facts)`: service only; idempotently appends receipt/adjustment and allocations, recomputes both obligations, request/attempt states, exceptions, activity and permitted project status, then queues required customer notice.
- `record_manual_payment(project_id, obligation_id, amount_cents, method, receipt_at, note, suspected_reference?, override_reason?, command_key)`: internal only; performs duplicate/overpayment detection. Returns `duplicate_warning` or `overpayment_warning` without committing unless an explicit valid override/resolution command is supplied.
- `recalculate_project_obligations_for_snapshot(project_id, snapshot_id)`: called by proposal activation. Before receipts, resize deposit and supersede obsolete request; after receipts, preserve credits/deposit paid and recalculate final/project outstanding.
- `claim_payment_deliveries(batch_size, automation_key)`: applies current local-date/time eligibility, creates suppressed or queued occurrences, and claims with `SKIP LOCKED`.
- `complete_payment_delivery(delivery_id, outcome, provider_message_id?, redacted_error?)`: advances outbox state idempotently; successful financial events are never rolled back.
- `set_payment_reminder_control(obligation_id?, enabled, reason)`: internal audited per-obligation/global changes; never backfills.
- `update_payment_collection_settings(settings, command_key)`: internal only; validates timezone/send window, instruction text, approved Venmo target, provider/reminder switches, and actor. The accepted settings shape has no card-fee control; unknown fee/surcharge keys are rejected because customer card surcharging is fixed off in this release.
- `set_payment_legal_hold(project_id, action, hold_type, reason, command_key)`: internal authorized-florist command; locks the project hold state, requires a nonempty reason, appends exactly one idempotent `placed` or `released` event, rejects release without an active hold, writes redacted activity, and returns the effective hold projection. Release only restores future retention eligibility and never synchronously deletes history.
- `resolve_payment_exception(exception_id, resolution, reference_or_note)`: validates allowed resolution and retains immutable source events.

## Reminder Eligibility Contract

At claim time re-read project status/event date, active snapshot/outstanding, request, current billing recipient, intention pause including Venmo fallback, obligation pause, and global switch. Every attempt snapshots the current recipient; the request's original recipient remains audit-only. Deposit occurrences are the initial request's Mailgun `accepted_at` plus each 7-day interval. Final occurrences are local dates with offsets 60,45,38,31 and every integer 30 through 0. At the 60-day activation transaction, an eligible Booked project with unpaid final principal moves to Awaiting Final Payment; an unpaid-deposit project stays Awaiting Deposit and creates/switches to consolidated collection. Passed/suppressed local dates never send later. Unique occurrence identity guarantees at most once.

## CRM Read Models

- `payment_obligation_list_view`: one canonical obligation row with project/customer/event, purpose, due date, target, credited, outstanding, fulfillment, latest confirmed method/intention, exception/delivery indicators. Supports server search/filter/sort/pagination.
- `payment_obligation_detail_view` or repository composition: obligation basis plus ordered requests, attempts, intentions, transactions/allocations, fees, deliveries, exceptions and activity.
- `project_financial_summary_view`: explicit availability plus proposal total, deposit/final targets, credited principal, customer fees, merchant fees when known, outstanding and unapplied overpayment.

Internal reads require `is_internal_crm_user()`. Activity metadata uses BB references and labels, never bearer tokens, URLs, email bodies, or raw provider payloads.

## Email Contract

`process-payment-messages` owns complete local Mailgun template/payload logic because edge-function sharing is prohibited. For an active request it decrypts service-only token ciphertext with the Edge secret/key version, constructs the public URL in memory, and never writes/logs plaintext; inactive requests have no ciphertext and queued sends are canceled. It resolves the current recipient immediately before each attempt. Mailgun acceptance records `accepted_at` and anchors weekly deposit reminders; later signed events append minimized rows to `payment_message_delivery_events`. Request/reminder emails contain brand, purpose, recognition-safe project/event context and amount; receipt/adjustment emails contain BB reference, principal, separate customer fee, method, and date. The delivery row is committed before HTTP. Accepted, delivered, failed, suppressed, and unknown are distinct states.

## Standalone Edge Function Contract

Every function is deployed from its own `supabase/edge_functions/<function-name>/index.ts` directory. Each `index.ts` contains all application logic required by that function and never imports `_shared`, another Edge Function, or any other local shared module. No automated Edge Function test files are created; independent type-checking and provider/customer sandbox smoke checks are deployment gates.

`issue-payment-request` exclusively generates random bearer tokens, calculates the digest, encrypts plaintext with the Edge AES-GCM secret, and calls `issue_payment_request` with digest/ciphertext/IV/key version. `resolve-payment-request`, `create-payment-checkout`, `capture-venmo-order`, `stripe-payment-webhook`, `paypal-payment-webhook`, `process-payment-messages`, and `mailgun-webhook` remain separate self-contained deployments.

## Error And Recovery Contract

- Provider unavailable: mark attempt failed/expired as trusted, unlock choices, retain request.
- Unmatched verified event: persist minimal event and urgent exception; never discard or guess project.
- Request/email failure: project/obligation remains; retry creates a linked delivery attempt.
- Ambiguous Mailgun acceptance: `delivery_unknown`, no automatic resend.
- Reversal/refund/dispute/correction reopening balance: recalculate, keep project status, create urgent exception.
- Terminal/canceled project: invalidate links, cancel queued reminders, reject new checkout/intention; retain history.
