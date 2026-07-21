# Phase 0 Research: Integrated Project Payments

## Ledger And Brownfield Migration

**Decision**: Preserve `project_payment_records` as the physical table and redefine each canonical row as a deposit/final obligation aggregate. Add immutable transaction/allocation tables for money and separate request, attempt, intention, delivery, provider-event, and exception tables.

**Rationale**: Existing Angular code, migrations, activity, manual logging, and project Financial Summary already depend on this table. An additive evolution preserves identifiers and data while eliminating mutable receipt history. Aggregate amounts/status are database-derived projections, never independent sources of truth.

**Alternatives considered**: Renaming/replacing the table would make a clean vocabulary but creates avoidable migration and rollback risk. Keeping one mutable row for every installment cannot retain adjustments, allocations, fees, idempotency, or full audit history.

## Transaction And Allocation Boundary

**Decision**: One security-definer reconciliation RPC inserts an idempotency event/manual command, locks request and project obligations in deposit-before-final order, appends an immutable transaction and allocations, recomputes aggregates, creates exceptions/activity, and performs eligible forward status transitions in one database transaction.

**Rationale**: `INSERT ... ON CONFLICT`, partial unique indexes, and consistent `FOR UPDATE` ordering provide permanent concurrency protection. Provider idempotency windows and Angular sequencing do not. Queue claimers alone use `FOR UPDATE SKIP LOCKED`.

**Alternatives considered**: Sequential Edge/Angular writes can partially commit or race. Serializable isolation everywhere adds retries without benefit when explicit locks and uniqueness cover the invariants.

## Money And Proposal Revision

**Decision**: Store USD integer cents at interface boundaries and constrained `numeric(12,2)` in Postgres. Initial deposit is round-half-up 30% of the conversion-time active snapshot total. Before the first confirmed receipt, a proposal revision may resize the deposit and supersede its request. The first confirmed receipt freezes the deposit target then in effect, including when only partially fulfilled; later revisions preserve that target and all credits while changing final/project outstanding only.

**Rationale**: This preserves immutable credits, current proposal authority, and cent agreement across every UI. Fees and unapplied overpayment never satisfy proposal principal.

**Alternatives considered**: Repricing historical deposits breaks audit history. Floating-point browser math can disagree with provider/database cents.

## Secure Customer Link

**Decision**: The self-contained `issue-payment-request` Edge Function generates at least 256 random bits and returns no plaintext to SQL or the browser. It stores a SHA-256 digest for lookup plus authenticated AES-GCM ciphertext/IV/key version so the standalone message function can reproduce `/pay/:token` for later reminders. SQL accepts those opaque values but never generates or returns the token. The encryption key exists only as an Edge secret, ciphertext is unreadable through browser RLS, and ciphertext is erased when the request is fulfilled, superseded, revoked, or canceled. A public `verify_jwt=false` Edge Function validates lifecycle and returns a minimal DTO. All payment tables have RLS with no anonymous policy; every public mutation revalidates the token and calls a narrow RPC.

**Rationale**: The request, not project, is the authorization scope. The hash prevents plaintext lookup/storage, while ciphertext is necessary because weekly/daily reminders must reuse a lifecycle-valid link. Lifecycle invalidation destroys reuse capability without exposing CRM identifiers.

**Alternatives considered**: Supabase signed-in users contradict no-account access. Querying anon-readable rows risks cross-project exposure. Fixed expiry conflicts with the clarified lifecycle-valid link.

## Stripe Card Checkout

**Decision**: Create one server-side Stripe Checkout Session in `payment` mode per active attempt, with fixed USD principal and, only when approved eligible, a separate 3% fee line item. Store opaque request/attempt IDs in Session and PaymentIntent metadata, use deterministic Stripe idempotency keys, explicit 30-minute expiry, and a branded return URL. Fulfill only after a signed webhook and authoritative `payment_status=paid`; process expiry, async outcomes, refunds, and disputes as normalized events.

**Rationale**: Hosted Checkout keeps card data out of the app. Stripe requires webhooks because the customer may not return. The database partial unique index remains authoritative after Stripe's idempotency retention ends.

**Alternatives considered**: Customer Portal is a billing-management product, Payment Links weaken per-request attempt control, and a success redirect is not payment proof. Sources: [Checkout flow](https://docs.stripe.com/payments/checkout/how-checkout-works), [Session API](https://docs.stripe.com/api/checkout/sessions/create), [fulfillment](https://docs.stripe.com/checkout/fulfillment), [webhooks](https://docs.stripe.com/webhooks), [idempotency](https://docs.stripe.com/api/idempotent_requests).

## Card Fee Eligibility

**Decision**: Customer surcharging is fixed off and merchant-absorbed for this release; there is no editable fee mode or latent enablement configuration. A future specification may introduce exactly 3% only after Black Begonia approves a mechanism that determines an eligible credit-card transaction and satisfies jurisdiction, network, registration, disclosure, and cap requirements. Checkout attempts in this release record a disabled decision/reason and zero customer fee.

**Rationale**: A hosted Checkout line item is fixed before card funding type is known; a blanket charge could surcharge debit/prepaid or otherwise ineligible transactions. Renaming it does not change its legal character.

**Alternatives considered**: Universal 3% is unsafe. Removing cards where a fee is unavailable violates the spec. Source: [Stripe surcharge guidance](https://stripe.com/resources/more/surcharge-fees).

## Integrated Venmo And Fallback

**Decision**: Prefer PayPal Checkout with Venmo funding, a lazily loaded browser JavaScript SDK, Orders v2 `CAPTURE`, authoritative server-created USD amount, opaque `custom_id`/`invoice_id`, and server capture after browser approval. Only `PAYMENT.CAPTURE.COMPLETED` credits funds; pending/approval/return remains Processing. Verify signed webhooks and deduplicate event, order, and capture IDs. If unavailable, open the configured official Venmo Business Profile share/QR target, record a zero-value handoff/intention with a non-stacking seven-day reminder pause, and require florist manual reconciliation.

**Rationale**: Integrated Venmo supports verified completion but has US/USD/device/enablement constraints. Business-profile amount/reference behavior is not a stable machine-verifiable contract and the customer may edit a preset amount.

**Alternatives considered**: Treating a profile visit or `onApprove` as receipt creates false payments. Sources: [Pay with Venmo](https://developer.paypal.com/docs/checkout/pay-with-venmo/), [Orders API](https://developer.paypal.com/api/rest/integration/orders-api/api-use-cases/standard/), [webhook events](https://developer.paypal.com/api/rest/webhooks/event-names/), [Venmo business profiles](https://venmo.com/business/profiles).

## Reminder Schedule And Delivery

**Decision**: After a named Vault automation secret passes deployment preflight, an idempotent Supabase Cron installation step invokes `process-payment-messages` every 15 minutes through pg_net. The function calls an RPC that evaluates a configured IANA timezone/local send window, inserts unique occurrence rows, records suppressed occurrences, and atomically claims bounded delivery batches. Deposit intervals anchor on the initial request's Mailgun acceptance time. Occurrence keys are obligation/request plus reminder kind and scheduled local date; missed/suppressed dates are never backfilled.

**Rationale**: Frequent UTC invocation plus local-date calculation survives daylight-saving and event-date changes. Cron/pg_net history is too short-lived to be business audit, so application delivery rows are authoritative.

**Alternatives considered**: One UTC expression per boundary mishandles local time and changes. A long database transaction across Mailgun HTTP is unsafe. Sources: [Supabase Cron](https://supabase.com/docs/guides/cron), [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net), [Vault](https://supabase.com/docs/guides/database/vault).

## Mailgun Outbox And Tracking

**Decision**: Commit a unique delivery/occurrence before HTTP, resolve and snapshot the current billing recipient, claim it as `sending`, send through Mailgun, and store returned message ID. Mailgun acceptance anchors weekly deposit reminders; signed later events update normalized delivery state and append to `payment_message_delivery_events`. Put only an opaque delivery UUID in Mailgun variables. A crash after provider acceptance but before acknowledgement becomes `delivery_unknown`; do not blindly resend until reconciled or explicitly retried.

**Rationale**: Mailgun has no documented send-idempotency key and accepted does not mean delivered. Its event retention is shorter than the application audit requirement.

**Alternatives considered**: Retrying every unknown outcome risks duplicate reminders. Persisting full message/provider payloads violates minimization. Sources: [Mailgun sending](https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/messages), [events](https://documentation.mailgun.com/docs/mailgun/user-manual/events/events), [webhook security](https://documentation.mailgun.com/docs/mailgun/user-manual/webhooks/securing-webhooks).

## Retention And Observability

**Decision**: Store normalized financial/provider/delivery facts, payload digests, processing outcome, attempts, and correlations for seven years after completion/cancellation; legal holds block purge. Token digests are invalidated on lifecycle completion, raw payloads are discarded after verification, and secrets remain only in provider/Edge/Vault configuration. Operational exceptions cover unmatched events, migration ambiguity, reversals, overpayment, unknown delivery, and reconciliation/status failures.

**Rationale**: This meets audit/recovery needs without retaining unnecessary sensitive data. Financial history is never deleted while held.

**Alternatives considered**: Full payload retention expands privacy risk; relying on provider dashboards loses durable application context.
