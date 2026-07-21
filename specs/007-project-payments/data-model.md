# Data Model: Integrated Project Payments

All money is USD `numeric(12,2)` in Postgres and integer cents in provider/API DTOs. Timestamps are UTC; scheduled occurrences additionally store the calculated IANA timezone and local date.

Where a record below mentions retention/hold, the hold is the effective project-wide state derived from append-only `payment_legal_holds`, not an independently editable boolean on each financial row.

## `project_payment_records` — Payment Obligation (extended)

Existing PK and project/kind fields remain. Add: authoritative snapshot/basis total, basis version, target amount, credited principal, outstanding amount, fulfillment state (`not_due|due|partially_paid|paid|overpaid|waived|canceled|review_required`), conversion/final due date, reminder enabled and pause fields/reason/actor, migration state, fulfilled/waived/canceled timestamps, retention date, effective project-hold projection, and last activity/method/intent projections. One canonical active row per `(project_id,payment_kind)`; deprecated mutable receipt fields remain read-compatible during migration but are no longer writable by clients.

- Deposit target: 30% of active total at conversion, due conversion local date; revisions may resize it only until the first confirmed receipt, which freezes the target then in effect.
- Final target: active total minus deposit target; project outstanding uses active total minus valid allocated credits.
- Aggregates are recomputed only by trusted functions from allocations/adjustments.
- A true overpayment is never represented by a negative outstanding amount.

## `payment_requests`

Fields: request ID, project ID, request type (`deposit|final_payment|consolidated`), status (`draft|active|fulfilled|superseded|revoked|canceled`), token SHA-256 digest, service-only AES-GCM ciphertext/IV/key-version/issued/invalidated timestamps, fixed requested principal, deposit/final breakdown, proposal snapshot/version, original recipient contact/email audit snapshot and fallback flag, cash/check instruction snapshots, supersedes/superseded-by IDs, initial-delivery state, created/activated/fulfilled/revoked timestamps and actors, retention/hold.

Constraints: unique token digest; amount positive; breakdown sums to requested principal; consolidated links to both obligations; non-consolidated links to one; inactive state requires invalidation and null ciphertext. Plaintext is never stored/logged. Only the self-contained `issue-payment-request` function generates/encrypts tokens; only standalone functions with the encryption secret may decrypt active ciphertext in memory for email construction.

## `payment_request_obligations`

Join table: request ID, obligation ID, amount requested against that obligation, display order. Unique pair; total equals request principal. Deposit order precedes final for consolidated requests.

## `payment_checkout_attempts`

Fields: attempt ID, request/project IDs, provider/method (`stripe_card|paypal_venmo`), status (`creating|active|processing|paid|failed|expired|canceled`), base/fee/charge cents, fee policy decision/reason, provider session/order/payment/capture IDs, provider URL or client-token metadata as needed, create/capture idempotency keys, created/expires/resolved/canceled timestamps and actor/reason, last verified state, retention/hold.

Partial unique index permits one `creating|active|processing` attempt per request across all electronic methods. Provider identities and idempotency keys are unique. URLs/client tokens are short-lived and cleared after resolution/expiry.

## `payment_transactions`

Append-only event: transaction ID, immutable human-readable `BBP-YYYY-########` reference, project/request/attempt IDs, kind (`receipt|refund|reversal|dispute|void|correction|credit_allocation|external_refund`), status (`pending|confirmed|failed|resolved`), signed principal amount, separately charged customer fee, merchant fee if available, method/source, occurred/recorded times, actor type/ID, provider/payment reference, manual command idempotency key, duplicate override flag/reason/suspected reference, customer notice policy/state, note, payload digest/minimized facts, retention/hold.

Rows cannot update/delete except tightly guarded provider status finalization from pending to terminal. References and provider/manual identities are unique. Fees are not principal. Original receipts survive every adjustment.

## `payment_transaction_allocations`

Append-only allocation ID, transaction ID, obligation ID, signed allocated principal, sequence, created time. Allocation sum cannot exceed transaction principal magnitude; deposit is sequence 1, final sequence 2. Adjustments reverse prior allocations using new negative rows/events. Unapplied true overpayment is not an allocation.

## `payment_intentions`

Fields: intention ID, request/project/obligation IDs, method (`cash|check|venmo_business_profile`), state (`active|superseded|fulfilled|expired`), instruction snapshot/reference, created time, seven-day pause start/end, superseded/fulfilled time. Every supported intention method creates the same seven-day pause. Repeating during an active pause returns the existing record and cannot extend the end.

## `payment_message_deliveries`

Outbox and durable audit: delivery ID, project/obligation/request/transaction IDs, kind (`initial_request|deposit_reminder|final_reminder|receipt|adjustment_notice`), unique occurrence key, scheduled local date/timezone, current recipient contact/email snapshot and fallback resolved for this attempt, principal/fee snapshot, status (`queued|claimed|accepted|delivered|temporary_failed|permanent_failed|suppressed|delivery_unknown|canceled`), attempt/retry-of IDs, Mailgun message ID, claim/sent/accepted/delivered/failure timestamps, failure class/redacted detail, suppression reason, retention/hold. The initial request's `accepted_at` anchors weekly deposit reminders.

Unique successful/active occurrence prevents duplicate initial, schedule, receipt, or adjustment mail. A failed attempt may create an explicit retry child; it does not rewrite history.

## `payment_message_delivery_events`

Append-only normalized Mailgun audit: event ID, delivery ID, provider event ID/day identity, event type, provider timestamp, signature-verified timestamp, payload digest, minimized diagnostic facts, and received time. It stores no raw payload, token, email body, or Mailgun variables beyond the opaque delivery ID. Unique provider identity prevents replay; the parent delivery projects the latest state.

## `payment_provider_events`

Minimal inbox: provider, provider event ID, provider object ID/type, event type/time, signature verified time, payload digest and minimized facts, processing state/error, linked attempt/transaction, received/processed time, retention/hold. Unique `(provider,provider_event_id)` and provider-object effect keys stop replay and semantically duplicate events. Invalid signatures are rejected before insertion.

## `payment_exceptions`

Fields: exception ID, project/obligation/request/attempt/transaction/event IDs, type (`legacy_ambiguity|unmatched_provider_event|suspected_duplicate|overpayment|adjustment_reopened_balance|delivery_unknown|reconciliation_failure|status_transition_failure`), urgency, state (`open|acknowledged|resolved`), amount, summary/redacted detail, resolution (`external_refund|retained_credit|correction|matched|dismissed|status_reviewed`), required reference/note, retained unapplied credit, actor/timestamps, retention/hold.

Overpayment remains open until a permitted resolution is recorded. Retained credit requires a later explicit audited allocation and never moves automatically across projects.

## `payment_collection_settings`

Singleton fields: business IANA timezone, local send-window start/end, cash/check instructions, official Venmo business-profile target/QR, Stripe/Venmo/reminder/global collection switches, provider environment labels, updated actor/time. Secrets are not stored here. Authenticated changes occur only through an audited validation RPC. Customer card surcharging is fixed off in this release and has no editable setting; checkout attempts persist a `disabled` fee decision/reason and zero customer fee.

## `payment_legal_holds`

Append-only project-scoped hold events: event ID, project ID, action (`placed|released`), hold type (`legal|dispute`), required reason, actor ID, and created time. The latest event determines the effective hold state; a release must follow an active hold and does not delete records synchronously. A partial index or locked command prevents concurrent duplicate active holds. Retention procedures must exclude every payment/audit record whose project has an active hold, while read models project the effective hold and its latest reason/time.

## Existing Related Entities

- `projects`: active snapshot pointer, event date, status, conversion/booked/completed/canceled times; protected terminal states never auto-change.
- `project_proposal_invoice_snapshots`: authoritative total/version; activation triggers obligation recalculation/supersession rules.
- `project_contacts`/`contacts`: current billing contact, then primary contact fallback. Each delivery snapshots its resolved recipient.
- `activity_log`: expand allowed payment activity types; store only human-readable redacted metadata and actor type.

## State Transitions

```text
request: draft -> active -> fulfilled | superseded | revoked | canceled
attempt: creating -> active -> processing -> paid | failed | expired | canceled
intention: active -> fulfilled | superseded | expired
obligation: not_due/due -> partially_paid -> paid
            any open -> waived | canceled | review_required
project automatic: awaiting_deposit -> booked or awaiting_final_payment -> final_prep
project adjustment: no automatic regression; open urgent exception
```

At 60 days, an eligible Booked project with unpaid final principal activates final collection and moves once to `awaiting_final_payment`, replacing the existing 45-day refresh rule. An unpaid-deposit project keeps `awaiting_deposit`, supersedes deposit/final requests, and activates one consolidated request while retaining two obligation rows. If its deposit later fulfills while final remains open, it advances directly to `awaiting_final_payment`; if both fulfill in one transaction, it moves directly to `final_prep`. Proposal revisions resize deposit only before the first confirmed receipt; afterward the frozen deposit target and all credits remain unchanged. Completed/canceled projects remain unchanged.

## Migration Classification

1. Add fields/tables without dropping legacy columns.
2. Group legacy records by project/kind. A single coherent row becomes canonical; duplicates/inconsistent rows create `legacy_ambiguity` exceptions.
3. For evidence-backed positive paid values, create one imported receipt and allocation carrying the legacy ID/reference. Unknown method/date/provider fields remain null/unavailable.
4. Backfill missing obligation targets from the active snapshot only when the pointer/version is valid. Otherwise mark review required.
5. Validate aggregate parity by project before disabling direct legacy mutation.
