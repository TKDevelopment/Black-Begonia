# Research: Workshop Events and Booking

**Branch**: `011-workshop-booking`  
**Date**: 2026-07-29  
**Specification**: [spec.md](./spec.md)

## 1. Workshop and project-payment boundaries

**Decision**: Create dedicated workshop inventory, booking, payment, expense,
communication, and audit tables. Reuse the existing global
`payment_collection_settings` record and the existing Stripe webhook endpoint,
but do not make workshop bookings depend on project obligations or mutate the
project-payment ledger into a polymorphic model. Publish a normalized workshop
financial projection that a future dashboard can union with project financials.

**Rationale**: Existing payment tables and functions require `project_id` and
encode deposit/final-payment allocation behavior. Making those contracts
polymorphic would put a working brownfield workflow at risk and would still not
model seat inventory, holds, waitlists, or per-occurrence operations cleanly.
Dedicated workshop records preserve those invariants while normalized financial
columns provide the requested future reporting seam.

**Alternatives considered**:

- Generalize every existing payment table around a payable type and ID. Rejected
  because the migration and regression surface is disproportionate.
- Store workshop payments as project payments. Rejected because a public
  workshop booking is not a proposal, project, deposit, or final obligation.
- Keep only current booking totals. Rejected because refunds, disputes, fees,
  and historical profitability would not be reproducible.

## 2. Capacity and concurrency

**Decision**: Make Postgres the authoritative inventory boundary. Security
definer functions lock the occurrence row, expire eligible holds, calculate
`capacity - active holds - active booked seats`, and atomically create, resize,
confirm, cancel, or transfer capacity-bearing records. Frontend availability is
advisory; no client-side count can authorize a booking.

**Rationale**: A single database transaction with row locking and unique command
keys prevents final-seat races, retry duplication, negative inventory, and
cross-method collisions. It also permits focused PostgreSQL integration tests
without testing Edge Function runtimes.

**Alternatives considered**:

- Trust a previously loaded remaining-seat count. Rejected because concurrent
  customers could overbook.
- Use Stripe inventory or Payment Links. Rejected because Stripe does not own
  occurrence lifecycle, Venmo holds, manual reservations, or waitlists.
- Use application-only locks. Rejected because server instances and retries do
  not share process memory.

## 3. Stripe Product, Price, and Checkout strategy

**Decision**: Maintain one Stripe Product per reusable workshop definition and
one immutable one-time Stripe Price per distinct amount/currency version.
Occurrences reuse the current Price when their terms match. Every payment
attempt creates a new Checkout Session tied to one authoritative seat hold and
uses the Price ID plus the held quantity. Black Begonia remains the source of
truth for quantity, price snapshots, and fulfillment. The initial release stores
all workshop money in integer minor currency units and treats the published
per-seat price as the complete tax-inclusive required amount. Stripe and direct
Venmo therefore receive the same snapshotted `unit price × quantity` total with
no additional mandatory checkout charge.

**Rationale**: Stripe amounts cannot be edited in place; Stripe recommends
creating a new Price and deactivating the old one. Checkout Sessions accept a
Price and quantity and Stripe recommends a new Session for each payment attempt.
This matches the specification while retaining durable historical price
references. See [Stripe products and prices](https://docs.stripe.com/products-prices/manage-prices)
and [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions).

**Alternatives considered**:

- One Product per dated occurrence. Rejected because it clutters the catalog and
  duplicates a reusable workshop concept.
- Generic Payment Links. Rejected because they cannot reserve authoritative
  workshop capacity before payment.
- Inline `price_data` for every attempt. Rejected because it loses the requested
  reusable catalog association and makes synchronization harder to operate.
- Exclusive or provider-calculated workshop tax in the initial release.
  Rejected because it could produce different Stripe and direct-Venmo totals and
  would require a separately approved tax-jurisdiction model. A future
  specification may add that model without rewriting historical snapshots.

## 4. Hold expiration and Stripe timing

**Decision**: Store a database `effective_expires_at` equal to the earliest of
the configured hold duration, registration close, and occurrence start. Stripe
Sessions use that timestamp when it is within Stripe's permitted range. Stripe
currently permits `expires_at` from 30 minutes through 24 hours after Session
creation, so a scheduled standalone expiration function must expire an open
Stripe Session and release the database hold when a shorter business cutoff is
required. No expired-session recovery URL is enabled.

**Rationale**: The database deadline must remain authoritative even where a
provider has a minimum session lifetime. Stripe exposes an explicit Session
expiration endpoint, and expiring an open Session prevents later completion.
See [Checkout Session creation](https://docs.stripe.com/api/checkout/sessions/create)
and [expire a Checkout Session](https://docs.stripe.com/api/checkout/sessions/expire).

**Alternatives considered**:

- Extend local holds to Stripe's minimum. Rejected because it violates the
  clarified registration-close and workshop-start cutoff.
- Block all checkout during the final hold-duration window. Rejected because
  the selected clarification permits a shorter disclosed deadline.
- Release only in the browser. Rejected because abandoned browsers cannot be
  trusted to return.

## 5. Stripe fulfillment, late events, and idempotency

**Decision**: Extend the existing standalone `stripe-payment-webhook` to route
events by allowlisted metadata (`payment_context=workshop`,
`workshop_payment_attempt_id`). Verify the signature against the raw body,
retrieve authoritative Stripe objects, store the provider event once, and call
an atomic workshop reconciliation function. The trusted success timestamp comes
from the verified provider event/payment object rather than webhook receipt
time. Support immediate and asynchronous success/failure, refunds, disputes,
and reversals.

**Rationale**: Stripe requires webhook-based fulfillment because the browser
return is not reliable, may not occur, and delayed methods can complete later.
Stripe also retries delivery. Database uniqueness on provider event IDs,
provider object IDs, and command keys provides exactly-once effects despite
at-least-once delivery. See [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment).

**Alternatives considered**:

- Confirm from the success URL. Rejected because the redirect is untrusted.
- Add a second Stripe webhook receiving the same event types. Rejected because
  both endpoints would receive unrelated events and complicate global
  deduplication.
- Confirm any success regardless of capacity. Rejected because late payment
  clarification explicitly forbids overbooking.

## 6. Stripe refunds

**Decision**: Add a standalone authenticated `refund-workshop-payment` Edge
Function. It validates the florist session and requested eligible amount,
creates the Stripe refund with an idempotency key, and lets the signed Stripe
webhook produce the immutable refund transaction and booking adjustment.
Provider failure leaves the request unresolved and visible; it never rewrites
the original receipt. Technical eligibility requires a trusted captured Stripe
charge, matching currency, positive amount no greater than the remaining
refundable balance, authorized actor, and no active/completed duplicate command.
Refund initiation does not cancel seats; cancellation remains a separate
capacity command and business/legal entitlement remains florist-controlled.

**Rationale**: Refund credentials must remain server-side, partial refunds are a
provider-supported first-class state, and webhook reconciliation keeps the
financial ledger authoritative. Stripe emits refund lifecycle events, including
partial refunds. See [Stripe refunds](https://docs.stripe.com/refunds).

**Alternatives considered**:

- Mark a refund complete before calling Stripe. Rejected because local and
  provider state could diverge.
- Automatically refund every exception. Rejected because the clarified policy
  requires florist-controlled resolution.

## 7. Direct Venmo and PayPal retirement

**Decision**: Use only the approved `venmo_business_target` from global payment
settings. Selecting Venmo creates a pending intention/hold with a safe reference
and exact amount; the florist records external receipts and refunds through
audited CRM commands. Remove the PayPal SDK path, PayPal order union, PayPal
provider methods, `capture-venmo-order`, and `paypal-payment-webhook` from active
deployment/configuration after regression validation. Preserve historical
`source='paypal'` records and provider references read-only. Workshop Venmo uses
the 24-hour effective seat deadline. Existing project direct Venmo retains its
configured deadline, reminders, obligation allocation, and reconciliation
behavior and never receives workshop seat-release copy.

**Rationale**: The existing frontend already supports a `manual_venmo` handoff,
but dead PayPal branches and deployable functions remain. Removing runtime
paths without rewriting history satisfies the application-wide policy and
reduces secrets and webhook surface.

**Alternatives considered**:

- Use Stripe for Venmo. Rejected because Stripe does not provide Venmo as a
  Checkout payment method and the approved product policy is direct Venmo.
- Delete old PayPal records. Rejected because audit and financial history must
  remain reproducible.

## 8. Anonymous customer boundary

**Decision**: Anonymous users read only a deliberately minimal published
projection. Booking creation, status lookup, cancellation/transfer responses,
and payment choice go through narrow standalone Edge Functions using
high-entropy single-purpose tokens stored only as digests. Base booking,
payment, attendee, hold, and audit tables expose no anonymous rows. Booking
status tokens remain valid through 30 days after the occurrence or any later
unresolved qualifying customer-action deadline: a material-reschedule response,
exceptional-payment refund/transfer choice, cancellation confirmation, or other
explicitly versioned customer booking decision. Internal dates, retries, passive
dispute monitoring, retention periods, waitlist offers, and analytics expiry do
not qualify. A generic, rate-limited recovery request
emails the verified booking contact a newly rotated token and invalidates the
prior digest without revealing whether a booking matched.

**Rationale**: Customers do not have accounts, while names, emails, booking
states, and payment references must not be enumerable. Edge Functions can
validate origin, input, token purpose/expiry, and rate limits before invoking
service-role-only database commands.

**Alternatives considered**:

- Anonymous direct writes under broad RLS. Rejected because workflow invariants
  and abuse controls would be fragmented.
- Customer accounts. Rejected as outside the specification.
- Reusable booking IDs in URLs. Rejected because IDs are enumerable and become
  support/security liabilities.

## 9. Media storage

**Decision**: Create a public `workshop-media` bucket for hero and gallery
assets, with file-size and image MIME restrictions. Public reads support page
rendering and search crawlers. Only internal CRM users may insert, update, move,
or delete objects; media rows control publication, order, alt text, and
definition/occurrence ownership. Receipt evidence uses a separate private
bucket/path and signed access.

**Rationale**: Public workshop imagery must be crawlable and CDN-cacheable,
whereas financial evidence is private. Supabase public buckets still enforce
RLS for mutation operations. See [Supabase storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
and [storage access control](https://supabase.com/docs/guides/storage/security/access-control).

**Alternatives considered**:

- Put receipts in the public media bucket. Rejected because receipts can contain
  sensitive financial information.
- Store image binaries in Postgres. Rejected because the project already uses
  Supabase Storage for files.

## 10. Timezone and daylight-saving handling

**Decision**: Fix workshop scheduling to `America/New_York`, store entered local
start/end values, automatically derived UTC offset, and resolved `timestamptz`
instants. The CRM rejects local times that round-trip to zero or two valid
instants, so the florist never selects a timezone or offset. All deadlines
derive from resolved instants; public formatting uses the stored timezone.

**Rationale**: An instant alone cannot reproduce the florist's intended wall
time, while a local time alone is ambiguous around daylight-saving transitions.
Persisting local intent plus the derived offset supports accurate display, SEO
offsets, reminders, and audit without exposing infrastructure-oriented fields.

**Alternatives considered**:

- Let browser/platform defaults resolve ambiguous times. Rejected because
  different runtimes can choose differently.
- Store only UTC. Rejected because venue-local scheduling intent is lost.
- Add a public calendar library. Rejected because the calendar is out of scope.

## 11. Public routing, SSR, SEO, and retention

**Decision**: Keep `/workshops` as the listing, group discovery through stable
`/workshops/:seriesSlug` pages, and use
`/workshops/:seriesSlug/:workshopDate` for occurrence details. Reservation and
occurrence-specific no-index terms are subordinate date routes. Extend the
existing SEO and JSON-LD services with Event output, server-render dynamic data,
and update sitemap generation to fetch eligible series/date paths. Preserve
cancelled/rescheduled pages for 12 months and completed Past Workshop pages
permanently; expired status URLs redirect as specified.

**Rationale**: Google requires a unique crawlable event page and recommends
retaining original date/location data while changing `eventStatus`; rescheduled
events can use `previousStartDate`. Structured data must match visible content.
See [Google Event structured data](https://developers.google.com/search/docs/appearance/structured-data/event).

**Alternatives considered**:

- Modal-only detail. Rejected because it is not a stable search destination.
- Remove cancelled pages immediately. Rejected by both SEO guidance and the
  clarified retention rule.
- Render event content only after carousel interaction. Rejected because
  crawlers and assistive technology need direct content.

## 12. Analytics boundary

**Decision**: Extend the existing typed, consent-aware analytics façade and
route policy for workshop listing/detail routes only. Use allowlisted,
low-cardinality events for carousel/list selection, detail view, reservation
start, checkout handoff, provider choice, and a deduplicated safe public
confirmation. Never load GA on tokenized booking/status, Stripe, Venmo, CRM, or
authentication routes. Do not send customer, attendee, booking, payment, raw
URL, query, or fragment data. Trusted confirmation creates one eligibility
record. At the first confirmed-status resolution, the booking-status Edge Function may
generate one opaque raw grant, hash it, and atomically register only its digest
with Postgres, solving asynchronous webhook delivery without retaining the
secret server-side. No database command generates or returns the raw value. The
grant expires within 24 hours. For redemption or discard, the Edge Function
hashes the browser-presented raw grant and supplies only the digest to the
atomic Postgres command; Postgres never accepts or hashes the raw value. An
otherwise eligible public page redeems it once for sanitized context.
The confirmed-status response pairs the optional raw grant with only the clean
canonical public workshop path. The status component keeps it in session-only
state in `sessionStorage`; the public detail component redeems or discards it
and clears that state on every terminal outcome. The raw grant is kept out of
localStorage, IndexedDB, cookies, URLs, logs, errors, audits, analytics, and all
server persistence. Consent or policy
failure consumes/discards the opportunity without later replay.

**Rationale**: The existing analytics feature already supplies exact-host,
regional, consent, GPC, sanitization, and excluded-route controls. Extending that
single boundary avoids a second analytics implementation and honors the
specification's payment-route prohibition.

**Alternatives considered**:

- Instrument Stripe or tokenized status pages. Rejected because those are
  explicitly excluded.
- Send booking/payment references for deduplication. Rejected because they are
  sensitive and high-cardinality; deduplication remains first-party.
- Deduplicate only in browser memory. Rejected because reloads, tabs, and devices
  cannot provide authoritative exactly-once redemption.

## 13. Communications and scheduled work

**Decision**: Add workshop-specific communication records and a standalone
`process-workshop-messages` Edge Function using existing Mailgun conventions.
Use scheduled standalone functions for hold/session expiration and queued
messages. Database claiming functions provide idempotency and skip-locked
concurrency. Email failure never changes booking/payment state. Release
validation sends at least 100 normal-provider confirmation messages and measures
provider acceptance from durable queue creation; at least 99% must be accepted
within two minutes.

**Rationale**: Workshop confirmations, material-change notices, waitlist offers,
and cancellation/refund notices have different templates and recipients from
project installment emails but can reuse operational patterns.

**Alternatives considered**:

- Send synchronously during booking confirmation. Rejected because provider
  failure would delay or lose authoritative booking work.
- Reuse project-payment delivery rows. Rejected because they require project
  obligations and project-specific delivery kinds.

## 14. Testing and validation

**Decision**: Add Karma/Jasmine tests for Angular components, repositories,
services, route policy, SEO/JSON-LD, analytics sanitization, and PayPal removal.
Add PostgreSQL integration tests for migrations, RLS, public projections,
capacity races, lifecycle transitions, idempotency, waitlist order, financial
immutability, and all clarified payment edge cases. Do not create automated Edge
Function tests; independently type-check each affected function and document
Stripe, Mailgun, direct-Venmo, and expiration smoke checks.

**Rationale**: This is required by the project constitution and places automated
coverage at the durable database and Angular boundaries while respecting the
explicit Edge Function test prohibition.

**Alternatives considered**:

- Edge Function unit or integration tests. Rejected by constitution.
- Manual-only database validation. Rejected because capacity and payment
  invariants are too consequential.

## 15. Waitlist timing and personal-data operations

**Decision**: Waitlist offers default to 24 hours, are florist-configurable from
1 to 72 hours, and cap effective expiry at registration close or workshop start.
Late acceptance fails without capacity impact and queue advancement is
idempotent. A correction/minimization request is durable and must be verified
with a valid booking-status token or a single-use link sent to the current
contact email and expiring within 24 hours; customer-supplied identity facts or
florist login alone are insufficient. Authorized CRM users may then correct
operational customer fields or, only after a human-approved active versioned
retention policy permits it, minimize eligible data while preserving immutable
financial facts, suppressing non-required communication, and recording only
non-identifying audit metadata. No default active policy is inferred. Contact
email removal is deferred while recovery, required communication, a qualifying
customer action, payment/refund/transfer handling, or an active verification
link requires it. Public self-service deletion is not introduced.
A proposed replacement contact email remains inactive until a separate
single-use 24-hour link delivered to that address is confirmed. Active CRM users
assigned the existing `admin` role in `public.user_roles` manage draft,
approved, active, and retired versions through the CRM; active `staff` users may
process verified personal-data requests but cannot mutate policy versions.
Activation is explicit and auditable, records approval/activation actors and
times, and atomically retires the prior active version. Policy content is
immutable after activation; only a controlled `active -> retired` transition
with retirement actor/time is permitted.

**Rationale**: Bounded offers keep released seats moving predictably, while an
verified correction/minimization workflow provides an operational response to
customer-authorized requests without weakening financial retention or creating
a new customer account surface. Persisting policy versions makes each decision
reproducible and prevents an undeclared default from authorizing deletion.

**Alternatives considered**:

- Unbounded florist-selected offer durations. Rejected because offers could
  extend beyond registration close or workshop start and strand capacity.
- Direct deletion from base tables. Rejected because it could erase financial
  facts, break audit integrity, or bypass retention approval.
- Public self-service deletion. Rejected as outside the initial no-account
  customer boundary.

## 16. Capability boundaries and vertical delivery

**Decision**: Split CRM data access into catalog/occurrence,
operations/roster, financial/reporting, and privacy/retention repositories, with
an optional thin admin facade for component orchestration only. Split the
previous multi-command booking Edge boundary into standalone booking/payment,
status/recovery, personal-data verification, and analytics-outcome endpoints.
Deliver the database through five ordered additive migration and test slices:
catalog/media, booking/capacity, payments/reconciliation,
operations/lifecycle, and privacy/analytics. Complete and validate each release
slice before starting unrelated later-slice work.

**Rationale**: The feature is a substantial commerce and operations subsystem.
Capability ownership limits god services, thin Edge handlers keep secrets and
rate limits at explicit boundaries while PostgreSQL retains state authority,
and additive slices reduce migration review and rollback risk without weakening
the normalized model.

**Alternatives considered**:

- One admin repository for every CRM command. Rejected because catalog,
  operations, privacy, and financial changes would become coupled.
- One booking Edge Function for booking, access recovery, privacy verification,
  and analytics redemption. Rejected because unrelated security purposes and
  rate-limit policies would accumulate in one deployment unit.
- One all-or-nothing migration and release. Rejected because it prevents safe
  vertical validation and increases rollback blast radius.
