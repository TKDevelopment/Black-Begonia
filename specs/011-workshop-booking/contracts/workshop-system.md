# Contracts: Workshop System

**Branch**: `011-workshop-booking`  
**Date**: 2026-07-29

This document defines externally observable route, Edge Function, database,
provider, analytics, and search contracts. Field names are logical contracts;
implementation may map casing at repository boundaries.

## Shared conventions

- Currency values crossing HTTP boundaries are integer minor units; database
  financial columns are fixed-precision decimals.
- Dates/times are ISO 8601 strings. Customer-visible occurrence times include
  the venue timezone; resolved instants include an offset.
- Commands include an idempotency key.
- Public errors use safe codes and messages, never SQL, provider payload, stack,
  email existence, or capacity internals.
- Base-table UUIDs never authorize anonymous access.
- Customer tokens are accepted only in headers or request bodies and are never
  placed in GA events, canonical URLs, sitemap URLs, or referrers.

## Public route contracts

### `GET /workshops`

SSR-capable public page containing:

- One representative card per title-driven workshop series in an accessible
  manual carousel.
- Every eligible upcoming occurrence exactly once in ascending event order in a
  subtle vertical list separated by rules.
- Cancelled and rescheduled source occurrences are excluded from the carousel
  and upcoming list even while their canonical status pages remain directly
  reachable.
- Stable crawlable links to `/workshops/:seriesSlug` series pages and
  `/workshops/:seriesSlug/:workshopDate` occurrence pages.
- Intentional no-events state and the existing private-workshop inquiry CTA.

No calendar, dense event grid, booking token, exact customer data, or private
inventory fact is rendered.

### `GET /workshops/:seriesSlug`

Returns the shared workshop presentation plus a chronological vertical list of
that series's upcoming occurrences directly after the inclusions section. The
public series identity is the normalized workshop title/concept; repeated
occurrences with that identity produce one featured card and one series page.
The presentation uses the original clean white-background detail theme rather
than the Privacy Policy floral panel treatment.

### `GET /workshops/:seriesSlug/:workshopDate`

Returns one of:

| Outcome | Behavior |
|---|---|
| Published/open | Indexable event detail and reserve action |
| Sold out/closed | Indexable accurate status; waitlist action if enabled |
| Completed | Permanent indexable non-bookable Past Workshop |
| Cancelled/rescheduled within 12 months | Indexable status page with replacement link |
| Expired reschedule/cancellation retention | Permanent redirect to replacement or `/workshops` |
| Draft/unpublished/unknown | Safe not-found response; no private content |

Visible content and Event JSON-LD must agree.

All non-listing workshop routes use a compact content scale and responsive
reflow for phone, tablet, laptop, and desktop viewports. Representative Android
and iPhone widths must retain readable content, safe-area spacing, usable touch
targets, and no horizontal page scrolling.

### `GET /workshops/:seriesSlug/:workshopDate/reserve`

Resolves the selected occurrence through the public series/date projection, but
submits the authoritative occurrence slug/identifier to the booking boundary.
It shows a concise link to the exact occurrence terms and requires checkbox
acceptance; the full terms body is not rendered inline. First and last name are
collected separately in the UI and combined into the existing `contactName`
booking command field. Larger layouts pair the name controls and contact
controls horizontally, present a concise grouped occurrence summary, and use
the shared inquiry validation-tooltip treatment for invalid required controls.

### `GET /workshops/:seriesSlug/:workshopDate/terms-and-conditions`

Displays the occurrence's snapshotted Workshop Terms & Conditions in the same
floral-background and translucent-panel family as the public Privacy Policy.
The route is linked only from the reservation screen, is `noindex,nofollow`, is
excluded from analytics, and links back to that occurrence's reservation. The
desktop panel is wide enough to retain the page heading on one line and renders
the stored newline-delimited clause titles as bold, slightly enlarged headings
without changing the accepted terms snapshot.

### Tokenized customer routes

Tokenized reservation/status/response routes are excluded from GA and search.
They return `noindex,nofollow`, do not become canonical destinations, and do not
appear in the sitemap.

## Public projection database contracts

### `get_public_workshop_listing()`

**Role**: executable by `anon`, `authenticated`, and service role.  
**Input**: none.  
**Output**: ordered public projection.

```ts
interface PublicWorkshopListItem {
  slug: string;
  seriesSlug: string;
  workshopDate: string;
  title: string;
  advertisingLine: string;
  theme: string;
  startAt: string;
  endAt: string;
  timezone: string;
  venueSummary: string;
  priceMinor: number;
  taxRegion: 'RI' | 'CT' | 'MA';
  taxRateBasisPoints: 700 | 635 | 625;
  currency: 'USD';
  availability: 'available' | 'limited' | 'sold_out' | 'waitlist_available' | 'registration_closed';
  waitlistEnabled: boolean;
  featured: boolean;
  featuredOrder?: number;
  hero: { url: string; alt: string; width?: number; height?: number };
  updatedAt: string;
}
```

All `*Minor` money fields are integer minor currency units. The workshop
`priceMinor` is the pre-tax required per-seat amount. Reservation totals expose
and snapshot subtotal, tax amount, and final total using the occurrence's
supported state tax rate.

### `get_public_workshop_occurrence(p_slug text)`

**Role**: executable by `anon`, `authenticated`, and service role.  
**Output**:

```ts
type PublicWorkshopOccurrenceResult =
  | { state: 'not_found' }
  | { state: 'redirect'; destination: string; permanent: true }
  | {
      state: 'visible';
      occurrence: Omit<PublicWorkshopListItem, 'availability'> & {
        description: string;
        includedMaterials: string;
        terms: string;
        termsVersion: number;
        venue: {
          name: string;
          street: string;
          locality: string;
          region: string;
          postalCode: string;
          country: string;
        };
        gallery: Array<{ url: string; alt: string; order: number }>;
        lifecycle: 'open' | 'closed' | 'completed' | 'cancelled' | 'rescheduled' | 'archived';
        availability: 'available' | 'limited' | 'sold_out' | 'waitlist_available' | 'registration_closed' | 'unavailable';
        replacementSlug?: string;
        registrationClosesAt?: string;
      };
    };
```

No contact, attendee, booking, hold, payment, expense, or internal count is
returned.

## Thin Edge Function contracts

### `POST /functions/v1/create-workshop-booking`

This standalone function supports only hold creation and Stripe Checkout
creation.
It validates origin, rate, input, and token boundaries, then delegates durable
capacity and payment-attempt transitions to authoritative database commands.

#### Create hold and booking shell

```json
{
  "command": "create_hold",
  "occurrenceSlug": "autumn-centerpiece-2026-10-10",
  "quantity": 2,
  "contact": {
    "name": "Customer Name",
    "email": "customer@example.com",
    "phone": "+1 555 555 0100"
  },
  "termsVersion": 3,
  "commandKey": "uuid"
}
```

Successful response:

```json
{
  "state": "held",
  "bookingToken": "single-use-or-expiring-secret",
  "supportReference": "BBW-2026-000001",
  "quantity": 2,
  "priceMinor": 8500,
  "subtotalMinor": 17000,
  "taxMinor": 1190,
  "taxRateBasisPoints": 700,
  "taxRegion": "RI",
  "totalMinor": 18190,
  "currency": "USD",
  "effectiveExpiresAt": "2026-10-01T16:30:00Z",
  "methods": ["stripe"]
}
```

Safe error states: `unavailable`, `quantity_changed`, `registration_closed`,
`terms_changed`, `rate_limited`, `invalid_request`.

#### Start Stripe Checkout

```json
{
  "command": "choose_payment",
  "bookingToken": "secret",
  "method": "stripe",
  "commandKey": "uuid"
}
```

Stripe response:

```json
{
  "state": "redirect",
  "url": "https://checkout.stripe.com/...",
  "effectiveExpiresAt": "2026-10-01T16:30:00Z"
}
```

The `method` value is fixed to `stripe`; `direct_venmo` and every other value
return `invalid_request`. The public reservation form does not expose this fixed
value as a choice.

### `POST /functions/v1/manage-workshop-booking-access`

This standalone function owns booking-status resolution, generic
non-enumerating replacement-access requests, and token-scoped booking actions
such as cancellation, waitlist response, and reschedule response. It does not
create holds, select payment methods, verify privacy requests, or redeem
analytics outcomes.

#### Resolve booking status

```json
{
  "command": "status",
  "bookingToken": "secret"
}
```

```ts
type WorkshopBookingStatus =
  | { state: 'processing'; supportReference: string }
  | { state: 'pending_venmo'; supportReference: string; expiresAt: string }
  | {
      state: 'confirmed';
      publicWorkshopPath: string;
      analyticsOutcomeGrant?: string;
    }
  | { state: 'expired' | 'cancelled' | 'refunded' | 'action_required' }
  | { state: 'unavailable' };
```

Trusted confirmation first creates one eligibility record. The first
confirmed-status resolution may include `analyticsOutcomeGrant`; the booking
status/recovery Edge Function generates the opaque raw value, hashes it, and
atomically registers only its digest through the database command. The database never
generates or returns the raw value. Later
status responses do not recreate or reveal it. The raw grant expires within 24
hours, is kept only in `sessionStorage`, and is never placed in localStorage,
IndexedDB, cookies, a URL, log, error, audit record, analytics parameter, or
server-side persistence. It is not a booking/payment
reference and cannot resolve booking data. The status component stores the
optional grant under the single-purpose
`bb.workshop.pendingAnalyticsOutcome` session key. `publicWorkshopPath` is the
clean canonical `/workshops/:seriesSlug/:workshopDate` path and contains no
token, query, or fragment. The public occurrence
component asks the analytics service to redeem or discard it and clears the key
for every terminal outcome.

#### Request replacement booking-status access

```json
{
  "command": "request_status_access",
  "email": "customer@example.com",
  "supportReference": "BBW-2026-000001"
}
```

Every request returns the same generic accepted response. The function applies
origin, input, and rate limits before matching. A successful internal match
rotates the digest, sets expiry to 30 days after the later of occurrence end or
latest unresolved qualifying customer-action deadline, invalidates the prior
token, queues
email delivery, and appends an audit event without exposing booking state.
Qualifying deadlines are material-reschedule responses, exceptional-payment
refund/transfer choices, cancellation outcomes requiring confirmation, or
other explicitly versioned customer booking decisions. Internal dates, retries,
passive dispute monitoring, retention periods, communication retries, waitlist
offers, and analytics expiry do not qualify.

### `POST /functions/v1/redeem-workshop-analytics-outcome`

This standalone function owns only analytics outcome redemption and discard.

An otherwise eligible public workshop page may submit:

```json
{
  "command": "redeem_analytics_outcome",
  "analyticsOutcomeGrant": "opaque-secret"
}
```

The Edge endpoint hashes the presented raw grant and passes only its digest to
the authoritative database command. That command atomically transitions one
digest-matched unexpired `issued` row to `consumed`; Postgres never receives or
hashes the raw value. A successful response contains only:

```ts
interface SafeWorkshopOutcome {
  event: 'workshop_booking_confirmed';
  publicContentId: string;
  category: string;
  quantity: number;
  currency: string;
  valueMinor?: number;
}
```

Forged, expired, repeated, or unavailable grants return the same safe
`unavailable` result and reveal no booking state. If consent, region, host,
route, GPC, or internal-browser policy blocks analytics, the client sends no GA
request, discards the raw grant, and does not retain it for replay. It may call
`discard_analytics_outcome` to make the terminal state durable.

### `POST /functions/v1/verify-workshop-personal-data`

This standalone function owns current-address personal-data request verification
and proposed replacement-email confirmation. It applies independent
single-purpose token, expiry, rate, and resource validation before invoking the
authoritative personal-data command. It never performs booking creation,
payment selection, status recovery, or analytics redemption.

## Customer action contracts

Token-scoped commands for reschedule response, waitlist acceptance, and customer
cancellation use the standalone booking-access endpoint and must obey:

- Token digest, purpose, resource, expiry, and one-time state are validated.
- Reschedule acceptance atomically transfers protected capacity.
- Decline requests cancellation/refund handling; it does not automatically move
  money.
- A reduced waitlist offer states the offered quantity clearly; accepting it
  before its effective deadline fulfills the original entry. The offer defaults
  to 24 hours, is configurable from 1 to 72 hours, and is capped at registration
  close or workshop start. Late acceptance fails without consuming capacity and
  queue advancement occurs exactly once.
- Partial cancellation states requested quantity and returns the remaining
  active quantity plus refund-processing status.

## CRM database/repository contracts

CRM repositories may select internal projections but use commands for
invariant-bearing mutations.

### Content and occurrence commands

- `save_workshop_definition(input, command_key)`
- `save_workshop_occurrence(input, command_key)`
- `generate_workshop_series_occurrences(series_id, dates, command_key)`
- `apply_workshop_series_update(series_id, occurrence_ids, patch, command_key)`
- `publish_workshop_occurrence(occurrence_id, command_key)`
- `transition_workshop_occurrence(occurrence_id, target_state, reason, command_key)`

Publication validates required copy, hero, venue/address, resolved time,
registration window, capacity, price, terms, enabled payment readiness, and
unique slug.

### Operational commands

- `create_manual_workshop_booking`
- `cancel_workshop_booking_quantity`
- `check_in_workshop_attendee`
- `delete_expired_workshop_booking(booking_id, command_key)`
- `join_workshop_waitlist`
- `offer_workshop_waitlist_seats`
- `begin_workshop_reschedule`
- `resolve_workshop_reschedule_nonresponse`
- `cancel_workshop_occurrence`
- `record_workshop_venmo_receipt`
- `record_workshop_venmo_refund`
- `resolve_workshop_payment_exception`
- `record_workshop_expense`
- `create_workshop_personal_data_request`
- `verify_workshop_personal_data_request`
- `process_workshop_personal_data_request`
- `correct_workshop_personal_data`
- `minimize_workshop_personal_data`
- `activate_workshop_data_retention_policy`

Every command returns `replayed: boolean`, affected IDs, resulting states, and
safe summary counts. Invalid transitions fail without partial side effects.
Expired-booking deletion is internal-only, accepts only the `expired` state,
and removes abandoned operational rows so the booking count updates on reload.
It preserves detached provider evidence and payment exceptions, and fails when
immutable financial transactions, delivered communications, personal-data
requests, or reschedule responses require the booking identity to remain.
Printable roster generation selects only `confirmed` booking rows.
Personal-data correction/minimization requires an authenticated internal actor
and a customer request verified by valid booking-status token or single-use
24-hour link sent to the booking's current contact email. Support reference,
name, supplied email, and florist authentication alone do not verify authority.
Minimization atomically resolves and records the human-approved active
retention-policy version and fails safely if none exists. It suppresses future
non-required communication, preserves immutable financial facts, and excludes
raw tokens, removed/replacement values, free text, accommodation details,
email, and phone from audit metadata. Contact-email minimization is deferred
with a safe reason and earliest eligibility while recovery, required
communication, qualifying customer action, payment/refund/transfer work, an
active verification link, or policy rules require it.
A proposed replacement contact email remains inactive until a separate
single-use link sent to that proposed address is confirmed within 24 hours.
Only the digest is registered. Activation replaces the delivery/recovery email
and invalidates prior status and privacy-verification links atomically.

### Personal-data request verification

```json
{
  "command": "request_personal_data_change",
  "requestType": "minimization",
  "fieldCategories": ["contact_phone", "accommodation_details"],
  "bookingStatusToken": "optional-opaque-token"
}
```

Without a valid status token, the response is generic and queues a one-time link
only to the current booking email. Redeeming that link stores only its digest,
expires within 24 hours, and transitions the durable request from
`pending_verification` to `verified`. Processing may transition it to
`approved`, `deferred`, `completed`, `denied`, or `expired`.

### Retention-policy activation

An active CRM user assigned the existing `admin` role in `public.user_roles`
may list, draft, review, approve, activate, and retire versions. Active `staff`
users may read the active policy while processing verified personal-data
requests but cannot mutate policy versions. The authorized command activates
only an approved, effective policy whose field rules use the validated
category/action allowlist. Activation requires explicit confirmation, records
the approving and activating actors and times, and retires the prior active
version atomically. Policy content is immutable after activation; only the
controlled `active -> retired` transition and `retired_by`/`retired_at`
metadata may change on an active row, after which the row is fully immutable.
The migration seeds no active policy.

## Stripe catalog function

### `POST /functions/v1/manage-workshop-catalog`

Authenticated internal CRM only.

```json
{
  "command": "sync",
  "workshopDefinitionId": "uuid",
  "amountMinor": 8500,
  "currency": "USD",
  "commandKey": "uuid"
}
```

The function:

1. Verifies the authenticated internal role.
2. Locks/reads the definition catalog state.
3. Creates or reuses one Stripe Product.
4. Reuses the active Price only when amount/currency match.
5. Creates a new Price when amount/currency differ.
6. Persists provider IDs through a service-role database command.
7. Returns `ready`, `pending`, or safe `failed`.

It never creates occurrence inventory in Stripe.

## Stripe webhook contract

### Existing `stripe-payment-webhook`

Workshop Checkout Sessions include allowlisted metadata:

```text
payment_context=workshop
workshop_payment_attempt_id=<uuid>
```

The webhook:

- verifies `Stripe-Signature` against the raw body;
- retrieves authoritative Session/PaymentIntent/Charge/Refund facts;
- identifies the merchant/environment;
- routes `payment_context=workshop` to workshop reconciliation;
- preserves existing project-payment routing;
- records one provider event by Stripe event ID;
- handles completion, asynchronous success/failure, expiration, refunds,
  disputes, and reversals;
- returns success for already processed events;
- creates an unmatched/urgent exception for safely verifiable but unresolvable
  workshop money.

Browser redirects never fulfill bookings.

## Refund function contract

### `POST /functions/v1/refund-workshop-payment`

Authenticated internal CRM only.

```json
{
  "workshopPaymentTransactionId": "uuid",
  "amountMinor": 8500,
  "reason": "customer_requested",
  "commandKey": "uuid"
}
```

The function verifies the authenticated actor, trusted original Stripe charge,
positive remaining refundable balance, matching original currency, positive
requested amount no greater than that balance, and absence of an active or
completed duplicate before calling Stripe with an idempotency key.
Success means the provider accepted the refund request, not that local refund
reconciliation is complete. The webhook appends the refund transaction. Refund
initiation never changes booking quantity or capacity; a separate explicit
booking-cancellation command releases only its authorized cancelled quantity.

## Scheduled processing contracts

### `expire-workshop-holds`

- Scheduled at least once per minute.
- Claims due active holds with skip-locked semantics.
- Expires open Stripe Sessions where possible.
- Calls idempotent database expiration.
- Handles already-completed Sessions through reconciliation, not blind release.
- Records provider/operational failures for retry without extending the
  disclosed local deadline.

### `process-workshop-messages`

- Claims bounded queued batches.
- Sends one template-versioned Mailgun message per idempotency key.
- Delivers status-recovery, current-address privacy verification, and proposed
  replacement-email confirmation links from durable queue records; each link is
  single purpose, digest-backed, expires within 24 hours where specified, and
  is cancelled when its request or address becomes ineligible.
- Records accepted/delivered/failure outcomes.
- Retries temporary failures with bounded backoff.
- Never changes booking/payment truth because of delivery failure.
- Release validation uses at least 100 normal-provider confirmation messages and
  requires at least 99% provider acceptance within two minutes of durable queue
  creation.

## Analytics contract

Allowed public workshop milestones:

| Event | Safe parameters |
|---|---|
| `workshop_select` | placement enum, public content category |
| `workshop_detail_view` | public content category |
| `workshop_reservation_start` | public content category, quantity band |
| `workshop_checkout_start` | provider enum, quantity band |
| `workshop_booking_confirmed` | public content category; optional approved currency/value only |

Requirements:

- Existing consent, geography, GPC, exact-host, internal-browser, and route
  allowlists apply.
- No event loads or sends on tokenized booking/status, Stripe, Venmo, CRM, auth,
  preview, staging, or local routes.
- No names, emails, phone, addresses, attendee data, exact booking/payment
  references, provider payload, raw URL, query, or fragment.
- Confirmation is first-party deduplicated and never replays after blocked
  analytics. It requires atomic redemption of an Edge-generated,
  database-digest-registered outcome grant; browser-memory deduplication alone
  is insufficient.

## Search contract

The detail page emits one Event JSON-LD object matching visible content:

- name, description, start/end with offset;
- physical Place and PostalAddress;
- crawlable image array;
- organizer;
- Offer URL, price, currency, valid-from, and availability;
- correct `eventStatus`;
- `previousStartDate` for rescheduled events where applicable.

Cancelled pages retain original date/location and use `EventCancelled`.
Rescheduled pages use `EventRescheduled`, new date, and previous date. Sitemap
generation includes published, eligible, completed Past Workshop, and
still-retained status pages with meaningful modification dates; redirected
source URLs are removed.

## PayPal retirement contract

Before cutover, project-payment regression must prove that configured direct
Venmo deadlines/reminders, pending manual reconciliation, obligation
allocation, Stripe, cash, check, and historical provider reads still work while
the PayPal runtime remains available for rollback.

After that approval and cutover:

- `CheckoutHandoff` has no `paypal_order` variant.
- Payment UI never loads `window.paypal`, PayPal SDK scripts, buttons, orders,
  capture calls, or PayPal webhooks.
- New checkout method constraints exclude `paypal_venmo`.
- `capture-venmo-order` and `paypal-payment-webhook` are not deployed.
- PayPal environment secrets are no longer required by active runtime.
- Historical `source='paypal'`, provider IDs, transactions, and audit facts
  remain readable and immutable.
- Project Stripe, direct Venmo, cash, and check regression contracts continue to
  pass. Project direct Venmo never displays workshop hold or seat-release copy.
- A post-retirement scan and smoke pass finds no active PayPal reference in
  generated bundles, frontend behavior, deployment configuration, secrets, or
  deployed functions.
