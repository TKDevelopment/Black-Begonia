# Feature Specification: Workshop Events and Booking

**Feature Branch**: `011-workshop-booking`

**Created**: 2026-07-29

**Status**: Draft

**Input**: User description: "Create a new workshop system covering CRM event
management, single and recurring workshop generation, a public promotional
carousel and date-ordered vertical workshop list, search-optimized event detail
pages, seat reservations, Stripe Checkout backed by an appropriate product and
price catalog strategy, direct florist Venmo handoff without PayPal, future
revenue and expense reporting, workshop lifecycle tracking, and privacy-safe
Google Analytics measurement. The CRM Calendar integration is a future feature
and is explicitly outside this specification."

## Clarifications

### Session 2026-09-01

- Q: Which payment methods may a customer choose for a new public workshop
  reservation? A: None. The reservation form MUST show no payment-option
  election and MUST proceed directly to Stripe Checkout after validation.
- Q: Which reservation fields remain required? A: Seat quantity, first name,
  last name, email, phone, and explicit acceptance of the occurrence-specific
  Workshop Terms & Conditions are all required.
- Q: What happens to the earlier workshop direct-Venmo design? A: It is retired
  for all new workshop reservations. Historical workshop Venmo facts and
  reconciliation remain readable, and unrelated project direct-Venmo behavior
  remains unchanged. This session supersedes earlier references to offering or
  switching to direct Venmo during workshop checkout.
- Q: How should the reservation summary and checkout action be composed? A:
  When and Where MUST share one horizontal row where space permits; the large
  total amount MUST align in the amount column beneath tax; the workshop title
  MUST use a reduced display size; and the title-case Continue to Secure
  Checkout action MUST use the approved sans-serif action style and align right.
- Q: What layout invariants apply to the featured-workshop carousel? A: Every
  featured hero image MUST render inside an immutable 16:9 frame at every
  breakpoint; switching slides MUST NOT resize the featured section; and the
  carousel controls MUST remain horizontally centered inside featured-copy.
- Q: May the featured-workshop section use an internal scrollbar for longer
  slides? A: No. Featured copy MUST fit without an internal scrollbar, and the
  centered carousel controls MUST sit lower in featured-copy to maximize the
  copy's available vertical space while the stable section footprint remains.
- Q: How should the mobile workshops listing use the space shown in the visual
  reference? A: The featured carousel controls MUST follow the View workshop
  action without a large blank gap. Supporting text inside upcoming-date cards
  MUST be slightly larger, and each date badge MUST overlay the right side of
  its workshop image.

### Session 2026-07-29

- Q: How long should seats remain reserved while a direct Venmo payment awaits
  manual florist verification? â†’ A: Hold seats for 24 hours.
- Q: What happens if a direct Venmo payment arrives after its 24-hour seat hold
  expires? â†’ A: Confirm only if seats remain; otherwise create an urgent
  exception and arrange a refund or customer-approved transfer.
- Q: How are workshop refunds initiated? â†’ A: The florist initiates full or
  partial Stripe refunds in the CRM; direct Venmo refunds occur externally and
  are recorded in the CRM.
- Q: What participant information is required when reserving multiple seats? â†’
  A: Require the booking contact's name and email; phone, attendee names, and
  accommodation details are optional.
- Q: What happens to public event pages after completion, cancellation, or
  rescheduling? â†’ A: Keep completed pages permanently as Past Workshops; retain
  cancelled and rescheduled URLs for 12 months with status and replacement
  links.

- Q: How should a Stripe payment be handled when its seat hold expires near
  payment completion? â†’ A: Use Stripe's trusted payment-completion time:
  confirm payments completed before expiration despite delayed notification;
  after-expiration payments confirm only if capacity remains, otherwise create
  an urgent exception for a florist-initiated refund or customer-approved
  transfer.

- Q: What happens to existing bookings when an occurrence is materially
  rescheduled? â†’ A: Require each customer to accept a transfer during a stated
  response window while equivalent replacement capacity is protected; customers
  may instead request cancellation and refund handling, and nonresponses remain
  unconfirmed and flagged for florist follow-up.

- Q: How should a direct Venmo payment with the wrong amount or no usable
  reference be handled? â†’ A: Keep the booking pending in a reconciliation
  exception until the florist securely matches the payer; underpayments require
  the balance or an external refund, overpayments require an external excess
  refund, and missing references require manual identity verification without
  confirming extra seats or duplicating revenue.

- Q: What happens to active holds and in-progress payments when the florist
  cancels an occurrence? â†’ A: Immediately invalidate active holds, prevent
  further use of associated checkout sessions where possible, and notify
  pending customers not to pay; any payment that nevertheless completes is
  recorded without confirming a booking and creates an urgent,
  florist-controlled refund exception.

- Q: What happens if multiple payment methods or tabs produce more than one
  payment for the same intended booking? â†’ A: Permit only one active payment
  choice per booking; switching invalidates the prior Stripe session and marks
  prior Venmo instructions superseded, while any duplicate payments are
  recorded but confirm only one booking and create an urgent refund exception
  without consuming extra seats.

- Q: Can a customer cancel only some seats in a multi-seat booking? â†’ A: Allow
  partial seat cancellation; release exactly the authorized cancelled seats,
  retain the remaining seats under the original booking, preserve original
  totals, and record adjusted quantities and any refund as immutable history.

- Q: What happens when a normal seat hold would extend beyond registration close
  or the workshop start? â†’ A: Cap the hold at the earliest of its normal
  expiration, registration close, or workshop start, disclose that effective
  deadline before payment, and apply the existing late-payment rules afterward.

- Q: What happens to a confirmed booking and its seats when its payment is later
  disputed or reversed? â†’ A: Mark the booking payment-disputed with urgent
  florist action required, retain its seats, and change capacity only when the
  florist explicitly resolves or cancels the booking.

- Q: What happens when fewer seats become available than the first waitlisted
  customer's requested quantity? â†’ A: Offer that customer the available
  quantity up to their request; accepting the reduced quantity fulfills the
  waitlist entry, while decline or expiration passes the seats to the next
  customer.

- Q: How should nonexistent or repeated local workshop times during
  daylight-saving transitions be handled? â†’ A: Reject nonexistent local times
  and reject repeated times rather than asking the florist to choose an offset;
  all workshop schedules use `America/New_York` consistently.

- Q: Does the workshop Venmo seat-release deadline also govern existing project
  payments? â†’ A: No. The 24-hour/capped seat hold applies only to workshop
  bookings. Existing project-payment Venmo keeps its configured deadline,
  reminders, obligation allocation, and manual-reconciliation behavior without
  workshop seat-hold or seat-release language.

- Q: How are workshop taxes and required charges presented in the initial
  release? A: The published price per seat is the pre-tax seat amount. The
  florist selects RI, CT, or MA tax for each workshop; reservation and checkout
  surfaces show subtotal, tax, and the same snapshotted final total for Stripe
  and direct Venmo.

- Q: How can a verified workshop booking be measured without enabling analytics
  on payment or token-bearing pages? â†’ A: Trusted confirmation creates one
  outcome eligibility; the first confirmed-status resolution may issue an
  opaque, single-use, non-identifying grant, retain only its digest, and expire
  it within 24 hours. An otherwise eligible public workshop page may redeem it
  once for an allowlisted outcome; blocked, expired, repeated, or ineligible
  redemptions produce no analytics event.

- Q: How will the timed workshop usability outcomes be validated? â†’ A: Use at
  least five representative florist attempts for each administrative workflow
  and at least 20 representative customer attempts for discovery and payment
  handoff, with production-like content, provider test mode, recorded timing,
  assistance, completion, and sanitized observations.

- Q: How long does a customer booking-status token remain valid and how is it
  recovered? â†’ A: It remains valid through 30 days after the occurrence ends or,
  when later, 30 days after the latest unresolved qualifying customer-action
  deadline defined by FR-087. A rate-limited, non-enumerating request may email
  the booking contact a replacement token that invalidates the prior token.

- Q: How long does a waitlist offer remain available? â†’ A: Use a
  florist-configurable duration with a 24-hour default and an allowed range of 1
  to 72 hours, capped at registration close or workshop start.

- Q: What makes a Stripe refund technically eligible? â†’ A: The actor must be
  authorized, the original transaction must be a trusted Stripe charge with a
  positive remaining refundable balance, the amount must be positive and no
  greater than that balance in the original currency, and the request must not
  duplicate an active or completed command. Business or legal entitlement
  remains a florist decision.

- Q: How are customer correction or minimization requests handled? â†’ A:
  Authorized florist users process a verified request in the CRM. Mutable
  operational fields may be corrected; approved minimization removes eligible
  personal fields while preserving legally required financial facts and
  non-identifying audit integrity. Public self-service deletion is outside the
  initial release.
- Q: How is the identity behind a personal-data request verified? â†’ A: Require
  either a valid booking-status token or a one-time verification link sent to
  the booking's current contact email and expiring within 24 hours. A support
  reference, name, email address, or florist authentication alone is not proof
  of the customer's authority over the booking.
- Q: Where may the raw analytics outcome grant exist? â†’ A: The booking Edge
  Function generates and returns it once, while the database registers only its
  digest. For redemption, the Edge Function hashes the presented raw grant and
  sends only the digest to the database. The browser may hold the raw grant
  transiently in `sessionStorage`; it must never enter durable browser storage,
  URLs, logs, errors, audits, analytics, or database calls or persistence.
- Q: What governs workshop personal-data minimization? â†’ A: A versioned,
  human-approved active retention policy with validated field rules. No default
  active policy is inferred, and minimization remains unavailable until one is
  explicitly activated.
- Q: Which deadlines extend booking-status access and defer contact-email
  minimization? â†’ A: Only unresolved, customer-facing decisions such as a
  material-reschedule response, an exceptional-payment refund or transfer
  choice, a cancellation outcome requiring confirmation, or another explicitly
  versioned booking action. Internal florist dates, retries, passive dispute
  monitoring, retention periods, communication retries, waitlist-offer
  deadlines, and analytics-grant expiry do not qualify.

## User Scenarios & Testing *(mandatory)*

User stories are prioritized as independently testable journeys. Together they
preserve the existing private-workshop inquiry path while adding bookable public
events.

### User Story 1 - Publish a Bookable Workshop (Priority: P1)

The florist creates a workshop event in the CRM, defines its public story and
booking terms, adds imagery, sets the date, location, price, and seat capacity,
previews it, and publishes it when it is ready for customers.

**Why this priority**: A complete, trustworthy event record is the foundation
for discovery, booking, payment, operations, and reporting.

**Independent Test**: Create a draft event with all required information, add a
hero image and gallery, preview it, publish it, edit it, and verify that only the
published version appears publicly.

**Acceptance Scenarios**:

1. **Given** the florist is in the CRM Workshops tab, **When** they enter valid
   event details and save, **Then** a draft is created without becoming publicly
   bookable.
2. **Given** a complete draft, **When** the florist publishes it, **Then** it
   appears in upcoming workshops with the correct availability, price,
   location summary, message, and imagery.
3. **Given** a draft is missing a required date, capacity, price, location,
   title, description, or hero image, **When** publication is attempted,
   **Then** publication is blocked and the missing information is identified.
4. **Given** an event has bookings, **When** the florist edits customer-relevant
   details, **Then** existing bookings remain attached and the florist is warned
   before saving a material change that requires attendee communication.
5. **Given** an event has no bookings, **When** the florist deletes it, **Then**
   it is removed; **Given** it has booking or financial history, **When**
   deletion is attempted, **Then** destructive deletion is blocked and
   cancellation or archival is offered instead.
6. **Given** a florist selects a local workshop time affected by a
   daylight-saving transition, **When** the time does not exist, **Then** saving
   is blocked; **When** the time occurs twice, **Then** saving is also blocked
   without exposing timezone or UTC-offset inputs.

---

### User Story 2 - Generate and Maintain a Workshop Series (Priority: P1)

The florist creates several occurrences of the same workshop with different
dates without repeatedly entering shared content, while retaining the ability
to adjust or cancel one occurrence independently.

**Why this priority**: Seasonal workshop programs need efficient setup without
losing accurate per-date capacity, booking, and financial records.

**Independent Test**: Generate a three-date series, change one occurrence,
publish the series, and verify that each occurrence can be booked and managed
independently while remaining visibly related.

**Acceptance Scenarios**:

1. **Given** a valid workshop definition and multiple future dates, **When** the
   florist generates a series, **Then** one independently manageable occurrence
   is created for each date with the shared content and configured defaults.
2. **Given** a generated series, **When** shared content is updated, **Then** the
   florist can choose the current occurrence, selected future occurrences, or
   all future occurrences, and the affected records are previewed before save.
3. **Given** one occurrence has a different venue, capacity, image, price, or
   status, **When** it is edited, **Then** the exception does not alter other
   occurrences.
4. **Given** some occurrences already have bookings, **When** a bulk material
   change is attempted, **Then** the florist sees which booked occurrences are
   affected and must explicitly confirm the change.

---

### User Story 3 - Discover an Upcoming Workshop (Priority: P1)

A customer visits the public Workshops page, discovers featured events in a
promotional carousel, scans every upcoming occurrence in a subtle date-ordered
vertical list, and opens an accessible event detail page without needing an
account.

**Why this priority**: Customers must be able to confidently choose an event
before a booking or payment can occur.

**Independent Test**: Publish events across several dates, use the featured
carousel and vertical list on mobile and desktop, open each detail page, and
verify that only eligible future occurrences are advertised.

**Acceptance Scenarios**:

1. **Given** featured upcoming events exist, **When** a customer opens the
   Workshops page, **Then** the carousel shows one representative card per
   title-driven workshop series with its hero image, title, concise advertising
   line, date, and a call to action to the series page.
2. **Given** several upcoming events exist, **When** the customer moves below
   the featured area, **Then** every eligible occurrence appears once in a
   subtle vertical list ordered by event date, with neighboring events separated
   by a line rather than a calendar or dense card grid.
3. **Given** a customer opens an event, **When** its details are displayed,
   **Then** the title, full description, gallery, date/time with timezone,
   location, price and charges, remaining-seat state, included materials,
   accessibility/contact guidance, cancellation terms, and reserve action are
   clear.
7. **Given** a customer opens `/workshops/{workshop-title}`, **When** upcoming
   dates exist for that series, **Then** the shared workshop presentation is
   followed directly after inclusions by a chronological vertical date list,
   and each date reserves at `/workshops/{workshop-title}/{workshop-date}/reserve`.
8. **Given** a customer selects Details for an occurrence in the main vertical
   list, **Then** the destination is
   `/workshops/{workshop-title}/{workshop-date}`.
4. **Given** no upcoming public events exist, **When** the page loads, **Then**
   it presents an intentional empty state and preserves the existing private
   workshop inquiry path.
5. **Given** an event is sold out or registration has closed, **When** it is
   viewed, **Then** booking is unavailable and the customer can join the
   waitlist when that event permits it.
6. **Given** a customer uses the carousel, vertical list, or event page with a
   keyboard, screen reader, reduced-motion preference, zoom, or mobile viewport,
   **When** they navigate the content, **Then** every event and call to action is
   available without relying on automatic slide movement or a calendar.

---

### User Story 4 - Reserve Seats and Pay Securely (Priority: P1)

A customer selects one or more seats, supplies only the information needed to
manage the booking, reviews the total and terms, and either pays through a
secure Stripe checkout or follows the florist's approved direct Venmo link for
manual payment verification.

**Why this priority**: This is the core revenue journey and must prevent
overselling, ambiguous payment state, duplicate charges, and false
confirmations.

**Independent Test**: Complete successful, abandoned, delayed, duplicated, and
failed Stripe payments, exercise the direct Venmo handoff and manual
reconciliation, compete for the final seats, and verify the capacity and booking
state remain correct. Repeat the Venmo choice on an existing project-payment
surface and verify that no PayPal experience loads anywhere.

**Acceptance Scenarios**:

1. **Given** seats are available, **When** a customer selects a valid quantity,
   **Then** the total, included charges, cancellation terms, and temporary hold
   expiration are shown before payment begins, and only the booking contact's
   name and email are required.
2. **Given** the customer begins checkout, **When** a temporary hold is active,
   **Then** those seats cannot be sold to another customer; **When** the hold
   expires without verified payment, **Then** the seats return to inventory.
3. **Given** the customer chooses Stripe, **When** the provider verifies full
   payment, **Then** exactly one confirmed booking and receipt are recorded and
   the customer receives a branded confirmation.
4. **Given** the customer chooses Venmo, **When** the handoff begins, **Then**
   the customer is sent directly to the florist's approved Venmo business
   destination with the amount and safe reference instructions, and the booking
   remains clearly pending with a 24-hour provisional seat hold until the
   florist verifies payment.
5. **Given** the provider return page claims success but trusted payment
   confirmation has not arrived, **When** the customer returns, **Then** the
   status is shown as processing rather than confirmed.
6. **Given** duplicate, delayed, or replayed provider notifications occur,
   **When** they are processed, **Then** they do not duplicate bookings,
   receipts, revenue, or seat consumption.
7. **Given** fewer seats remain than the requested quantity, **When** checkout
   is attempted, **Then** the customer is prompted to choose an available
   quantity and is not charged.
8. **Given** any Black Begonia customer payment surface offers Venmo, **When**
   the customer selects it, **Then** no PayPal account, checkout, button, script,
   order, webhook, or credential is used and the approved direct florist Venmo
   destination is the only Venmo handoff; existing project payments retain their
   configured deadline and reminder behavior and never display workshop
   seat-release language.
9. **Given** a Venmo payment arrives after its provisional hold expires,
   **When** the florist reconciles it, **Then** they may confirm only when
   sellable capacity remains; otherwise the system prevents overbooking, opens
   an urgent exception, and requires a refund or customer-approved transfer.
10. **Given** Stripe reports a payment around the hold deadline, **When** the
    trusted completion time is at or before expiration, **Then** the booking is
    confirmed even if notification arrives later; **When** completion occurred
    after expiration, **Then** it confirms only if sellable capacity remains,
    otherwise an urgent exception requires a florist-initiated refund or
    customer-approved transfer.
11. **Given** a direct Venmo payment has the wrong amount or no usable
    reconciliation reference, **When** it is reviewed, **Then** the booking
    remains pending until the florist securely matches the payer and resolves
    any balance or external refund; the resolution does not confirm extra seats
    or duplicate revenue.
12. **Given** a customer changes payment method or uses multiple tabs, **When**
    a new method becomes active, **Then** the prior Stripe session is invalidated
    and prior Venmo instructions are marked superseded; **When** more than one
    payment nevertheless succeeds, **Then** exactly one booking is confirmed,
    every transaction is recorded, no extra seats are consumed, and an urgent
    duplicate-payment refund exception is created.
13. **Given** a normal hold duration would extend beyond registration close or
    the workshop start, **When** checkout begins, **Then** the effective hold
    expires at the earliest applicable cutoff and that deadline is disclosed
    before payment; a payment completing later follows the late-payment
    exception rules.
14. **Given** a customer loses or expires a booking-status link, **When** they
    request replacement access using the booking contact email, **Then** the
    response does not reveal whether a booking exists and a successful email
    replacement invalidates the prior token.

---

### User Story 5 - Manage Attendees and Event Operations (Priority: P2)

The florist views an event roster, booking and payment states, remaining seats,
customer contact details, waitlist order, and operational notes, and can record
authorized manual or complimentary reservations without corrupting capacity or
revenue.

**Why this priority**: A paid event must be operable after checkout, including
customer support, check-in, cancellations, and day-of attendance.

**Independent Test**: Populate an event with paid, pending, complimentary,
cancelled, refunded, waitlisted, and checked-in records, then verify the roster,
capacity, filters, exports, and actions.

**Acceptance Scenarios**:

1. **Given** an event has booking activity, **When** the florist opens it,
   **Then** summary counts reconcile confirmed, held, available, waitlisted,
   cancelled, refunded, and checked-in seats without exposing payment secrets.
2. **Given** the florist creates a manual or complimentary reservation, **When**
   it is saved, **Then** a reason, responsible staff action, customer contact,
   quantity, payment state, and capacity effect are recorded.
3. **Given** a customer cancellation or refund is recorded, **When** its policy
   outcome releases seats, **Then** availability updates and the next waitlisted
   customer can be offered a time-limited booking opportunity.
4. **Given** the event is occurring, **When** attendees arrive, **Then** the
   florist can mark attendance without changing payment or financial history.
5. **Given** roster information is exported, **When** the export is generated,
   **Then** it contains only operationally necessary fields and excludes payment
   credentials, provider payloads, analytics identifiers, and unrelated CRM
   data.
6. **Given** a customer requests cancellation of only some seats in a
   multi-seat booking, **When** the florist records the authorized outcome,
   **Then** exactly those seats are released, the remaining seats stay confirmed
   under the original booking, and adjusted quantities and any refund are added
   without rewriting the original totals.
7. **Given** a confirmed booking's payment is later disputed or reversed,
   **When** the trusted financial event is recorded, **Then** the booking is
   flagged as payment-disputed for urgent florist action while its seats remain
   reserved until the florist explicitly resolves or cancels it.
8. **Given** fewer seats become available than the first waitlisted customer's
   requested quantity, **When** an offer is issued, **Then** that customer
   receives an offer for the available quantity using the configured duration
   capped by registration close or workshop start; timely acceptance fulfills
   the entry at the reduced quantity, while decline, expiration, or late
   acceptance passes the seats to the next customer exactly once.
9. **Given** an identity-verified customer asks to correct or minimize their
   workshop information, **When** an authorized florist processes the request,
   **Then** eligible operational fields are corrected or removed, future
   non-required communication is suppressed, required financial facts remain
   immutable, and no removed value is copied into the audit history.
10. **Given** contact-email minimization is requested while booking recovery,
    required communication, an unresolved customer action, payment/refund/
    transfer handling, an active privacy-verification link, or the active
    retention policy still requires the email, **When** the florist reviews the
    request, **Then** it is deferred with a safe reason category and earliest
    eligibility time while other independently eligible fields may be
    minimized.
11. **Given** a verified correction proposes a different booking contact email,
    **When** the replacement address has not completed its own one-time
    confirmation, **Then** the current email remains the active delivery and
    recovery address; **When** the replacement is confirmed within 24 hours,
    **Then** it becomes active and prior status and verification links are
    invalidated.
12. **Given** an authorized privacy-policy administrator prepares a new
    retention-policy version, **When** they explicitly approve and activate it,
    **Then** its approver, approval time, effective time, and immutable version
    are recorded and the prior active version receives the only permitted
    post-activation change: a controlled transition to retired with its
    retirement actor and time recorded atomically.
13. **Given** an active CRM user has the existing staff role but not the existing
    admin role, **When** they attempt to create, approve, activate, or retire a
    retention-policy version, **Then** the route, repository command, and
    database mutation deny the action without changing policy state.

---

### User Story 6 - Control the Workshop Lifecycle (Priority: P2)

The florist can understand and intentionally move each occurrence through its
lifecycle, including cancellation and completion, with public availability and
booking actions changing consistently.

**Why this priority**: Explicit states prevent customers from booking unavailable
events and preserve accurate operational and financial history.

**Independent Test**: Move events through every allowed state, attempt invalid
transitions, and verify customer visibility, booking availability, notifications,
and history at each stage.

**Acceptance Scenarios**:

1. **Given** an event is drafted, published/open, sold out, registration closed,
   cancelled, completed, or archived, **When** it is viewed in the CRM, **Then**
   its persisted lifecycle, derived availability, and available next actions are
   unambiguous.
2. **Given** capacity becomes full or later becomes available, **When** counts
   change, **Then** sold-out and reopened availability states update without
   losing the florist's manually closed status.
3. **Given** a booked event is cancelled, **When** the florist confirms
   cancellation, **Then** new booking stops immediately, affected customers are
   identified for notification and florist-controlled refund handling, active
   holds are invalidated, associated checkout sessions are disabled where
   possible, pending customers are told not to pay, no money moves
   automatically, and history is retained.
4. **Given** an event date has passed, **When** it is not yet completed, **Then**
   the CRM flags it for review rather than silently rewriting its state.
5. **Given** an event is archived, **When** customers browse upcoming events,
   **Then** it is absent while its operational and financial history remains
   available to authorized staff.
6. **Given** an event is completed, **When** it leaves the upcoming list,
   **Then** its detail page remains public permanently as a non-bookable Past
   Workshop; **Given** an event is cancelled or rescheduled, **Then** its
   original URL remains public for 12 months with accurate status and any
   replacement link.
7. **Given** a booked occurrence is materially rescheduled, **When** affected
   customers are notified, **Then** equivalent replacement capacity is protected
   through a stated response window and each customer may accept the transfer or
   request cancellation and refund handling; a nonresponse is flagged for
   florist follow-up and is not silently confirmed for the replacement.

---

### User Story 7 - Track Workshop Financials (Priority: P2)

The florist records direct workshop expenses and sees trustworthy per-event and
per-series revenue, refunds, fees, expenses, and net results that can feed the
future income and expense dashboard.

**Why this priority**: Workshop profitability and tax reporting require durable,
reconcilable records rather than totals inferred from a current booking list.

**Independent Test**: Record payments, fees, refunds, complimentary seats, and
expenses for a series and verify event- and series-level summaries reconcile to
their source records.

**Acceptance Scenarios**:

1. **Given** verified payment, refund, reversal, fee, or manual adjustment
   activity, **When** financial summaries are viewed, **Then** each item appears
   once with amount, date, category, source, state, and traceable reference.
2. **Given** the florist records a direct expense, **When** it is saved, **Then**
   it is assigned to an event or series with amount, date, category, vendor or
   payee when known, note, and optional receipt evidence.
3. **Given** an event has financial activity, **When** its summary is viewed,
   **Then** gross revenue, discounts, refunds, processing costs, other expenses,
   and net result are distinguishable.
4. **Given** future dashboard reporting consumes workshop records, **When**
   figures are aggregated, **Then** historical values remain reproducible even
   if the workshop's current price or description later changes.
5. **Given** a florist requests a Stripe refund, **When** technical eligibility
   is evaluated, **Then** only a positive amount within the trusted charge's
   remaining refundable balance and original currency can proceed once, and
   refund initiation does not itself cancel seats.

---

### User Story 8 - Measure the Public Workshop Funnel (Priority: P3)

The business measures privacy-safe customer progression from workshop discovery
through verified booking so it can improve content, scheduling, and conversion
without sending customer, CRM, or payment data to Google Analytics.

**Why this priority**: Funnel insight improves marketing decisions, but it must
not weaken the analytics eligibility and sensitive-route boundaries already
approved for the site.

**Independent Test**: Exercise carousel selection, vertical-list selection,
detail viewing, booking start, provider selection, abandonment, and confirmed
booking under allowed, opted-out, private-route, payment-route, preview, and
unknown-region contexts; inspect the resulting measurement behavior and
parameters.

**Acceptance Scenarios**:

1. **Given** analytics is permitted on an eligible public workshop route,
   **When** a customer progresses through the funnel, **Then** allowlisted
   discovery and intent milestones are recorded once with sanitized,
   low-cardinality workshop context.
2. **Given** a booking becomes durably confirmed, **When** a safe public
   confirmation context is eligible for analytics, **Then** the status experience
   receives the raw one-time grant once from the booking boundary, keeps it only
   in ephemeral `sessionStorage`, navigates to the clean canonical public
   workshop path, and that page redeems or discards the grant so one deduplicated
   outcome may be measured without a booking ID, customer data, payment
   reference, raw URL, attendee information, or server-side raw-grant storage.
3. **Given** the customer enters Stripe, Venmo, another payment surface, the CRM,
   or an authentication surface, **When** activity occurs, **Then** no Google
   Analytics code, event, request, or identifier is introduced by this feature.
4. **Given** analytics is not permitted because of consent, privacy signal,
   geography, host, internal-browser marker, or route policy, **When** any
   workshop workflow occurs, **Then** booking remains fully functional and no
   blocked activity is replayed later.

---

### User Story 9 - Find a Workshop Through Search (Priority: P3)

A prospective customer searching for a local floral workshop can discover an
accurate event result, land directly on the relevant occurrence, and see
consistent event and booking information.

**Why this priority**: Search visibility gives each public event a longer reach
than the site navigation alone and prevents stale, duplicate, or misleading
workshop results.

**Independent Test**: Publish single and series occurrences, inspect their
search-visible content and event metadata, validate each eligible page, then
change, sell out, cancel, complete, archive, and unpublish occurrences and
verify search signals remain accurate.

**Acceptance Scenarios**:

1. **Given** a published bookable occurrence, **When** a search crawler accesses
   its unique public detail page, **Then** the visible title, description, hero
   image, date/timezone, venue, price, availability, and booking destination
   agree with its search metadata.
2. **Given** a series has similar descriptions on several dates, **When** its
   occurrence pages are evaluated, **Then** each has a unique event URL and
   date-specific content while canonical signals do not compete or point to a
   listing, modal, query variant, or different occurrence.
3. **Given** an occurrence becomes sold out, rescheduled, cancelled, completed,
   archived, or unpublished, **When** its public state changes, **Then** its
   page, event availability/status information, internal links, and sitemap
   inclusion follow the documented lifecycle policy: completed pages remain as
   permanent Past Workshops, while cancelled and rescheduled URLs remain for 12
   months with status and replacement guidance, without advertising stale
   booking availability.
4. **Given** the public Workshops page is indexed, **When** search engines or
   social platforms inspect it, **Then** its page title, description, canonical
   destination, share image, headings, and crawlable links accurately represent
   the upcoming-workshop collection.

### Edge Cases

- Two customers request the last seats at nearly the same time.
- A customer changes quantity or payment method in multiple tabs, retries after
  a timeout, or pays through both Stripe and superseded Venmo instructions.
- A customer cancels only some seats in a multi-seat booking while retaining
  the remaining confirmed seats.
- A Stripe hold expires just before a verified payment notification arrives,
  or Stripe's trusted completion time falls just after expiration and released
  seats have or have not been resold.
- A Stripe or Venmo hold begins near registration close or the workshop start,
  making its effective deadline shorter than its normal duration.
- A payment succeeds but confirmation email delivery fails.
- A customer pays through the Venmo business link with an underpayment,
  overpayment, or no usable reference and must be securely matched without
  confirming extra seats or duplicating revenue.
- A direct Venmo payment arrives after its 24-hour provisional seat hold has
  expired and the released seats have or have not been resold.
- A provider return is forged, replayed, delayed, duplicated, or arrives out of
  order with a refund, reversal, or dispute; a confirmed booking must not
  silently release capacity as a result.
- A series crosses daylight-saving transitions or contains a nonexistent or
  repeated `America/New_York` local time.
- An occurrence is materially rescheduled after bookings exist and customers
  accept, decline, or do not respond before the transfer deadline.
- Fewer seats become available than the first waitlisted customer's requested
  quantity.
- A florist lowers capacity below already confirmed seats or changes price after
  some seats have sold.
- An event is cancelled with pending holds, in-progress checkout sessions,
  confirmed bookings, waitlisted customers, outstanding refunds, or recorded
  expenses, and a race-condition payment completes after cancellation.
- An image is removed, inaccessible, too large, or missing meaningful
  alternative text.
- A featured event is unpublished while it is the active carousel slide.
- A series produces nearly identical occurrence descriptions or several URL
  variants point to the same event.
- An event is rescheduled after search engines have indexed its original date.
- A cancelled or rescheduled event reaches the end of its 12-month public
  retention period while external links still target the original URL.
- A published event becomes hidden, archived, sold out, or registration-closed
  while a customer is viewing its details.
- An attendee requests accommodation, data correction, cancellation, or
  deletion while financial retention obligations still apply.
- The customer has JavaScript disabled, uses assistive technology, or navigates
  directly to an expired or unpublished event link.
- Analytics is unavailable, blocked, slow, or misconfigured during any booking
  action.

## Requirements *(mandatory)*

### Functional Requirements

#### Workshop Administration and Series

- **FR-001**: The CRM MUST provide an authenticated Workshops tab where
  authorized florist users can create, find, sort, filter, view, edit, duplicate,
  cancel, archive, and, when safe, delete workshop events.
- **FR-002**: Each occurrence MUST define a title, advertising description,
  workshop theme or category, workshop date, local start/end times in
  `America/New_York`, registration start/close dates, seat
  capacity, price per seat, currency, venue name, customer-facing location,
  registration deadline, cancellation terms, included materials, hero image,
  and gallery.
- **FR-003**: The system MUST support draft preview and MUST block publication
  until all required customer-facing and booking information is valid. The CRM
  customer preview MUST retain the compact administrative preview card, render
  the effective uploaded hero as its background header, and show only uploaded
  gallery-role images in a small arrangement gallery. When no gallery-role
  image exists, the preview MUST omit the gallery section entirely.
  Its When value MUST show local date as `27 March 2027` and local time on the
  next line as `@ 10:30 AM - 11:30 AM`, including explicit AM/PM markers.
- **FR-004**: The florist MUST be able to create one occurrence or generate a
  series from shared workshop content and independently add or remove schedule
  rows containing date, local start/end time, and registration start/close date.
- **FR-004a**: The CRM MUST generate each new occurrence's URL slug from its
  title and occurrence date; the florist MUST NOT be required to enter a slug.
  When that generated slug already exists, the system MUST preserve the
  readable base and allocate the next available numeric suffix rather than
  rejecting the occurrence or the containing series.
- **FR-004b**: Workshop country MUST be fixed to the United States, city MUST be
  labeled `City`, and state MUST be selected from all 50 U.S. states.
- **FR-004c**: Create Workshop MUST present media within the Workshop Story,
  label capacity as `Open seats`, present price as U.S. currency, and rely on
  field-level validation feedback rather than a duplicate invalid-fields
  summary. Stripe Checkout, direct Venmo, waitlist participation, and carousel
  promotion MUST be enabled automatically and MUST NOT be florist-editable
  occurrence flags.
- **FR-004d**: On desktop-sized Create Workshop layouts, open seats, maximum
  seats per booking, pre-tax price, and tax-state selector MUST share one row; address lines
  1 and 2 MUST share one row; and City, State, and Zipcode MUST share one row.
  The controls MUST reflow for narrow viewports without horizontal scrolling.
- **FR-004e**: A new workshop MUST begin with a substantive, editable workshop
  terms template covering reservation/payment confirmation, customer
  cancellation and transfer handling, florist cancellation/rescheduling,
  arrival and safe participation, allergies and accessibility requests,
  minors, material variation, conduct, photography choice, contact, and
  non-waivable customer rights. The florist MUST be able to revise the template
  before publication, and the accepted terms snapshot/version remains governed
  by FR-007.
- **FR-004f**: The Create Workshop and Workshops administration screens MUST
  render every administrative surface, control, state, and message using the
  active CRM light/dark theme. Destructive X controls MUST reuse the Floral
  Proposal Builder's compact bordered destructive-button treatment.
- **FR-005**: Each generated occurrence MUST retain its own identity, lifecycle,
  capacity, availability, bookings, finances, venue, time, price, and media
  overrides.
- **FR-006**: Series edits MUST allow explicit current-only, selected-occurrence,
  and future-occurrence scopes and MUST preview affected booked events before a
  material change is applied.
- **FR-007**: The system MUST preserve a snapshot of customer-relevant booking
  terms and amounts in effect when each booking was created.
- **FR-008**: Events with booking, payment, refund, attendance, or expense
  history MUST NOT be hard-deleted through normal florist actions.
- **FR-009**: Workshop media MUST support one hero image and a florist-orderable
  gallery with meaningful alternative text, visible upload state, replacement,
  and removal controls. On a new workshop, the first valid upload MAY create
  the non-reusable internal definition owner required for draft media, but it
  MUST NOT expose that definition as a reusable concept. Successful publication
  MUST atomically promote its definition into the reusable concept chooser;
  failed publication and draft-only definitions MUST remain hidden from future
  workshop creation. Selecting an existing reusable concept MUST retain its
  definition identity and MUST NOT create a duplicate. The florist MUST be able
  to retire a concept from future reuse without deleting its historical
  workshops or imagery. Missing file, alternative text, or required story
  content MUST produce immediate actionable feedback.
  Gallery selection MUST accept and queue multiple images in one selection,
  require separately editable alternative text for every queued file, and retain
  successfully uploaded files if a later file in the same batch fails. Editing
  a queued file's alternative text MUST retain keyboard focus across keystrokes.
- **FR-010**: The CRM event view MUST expose remaining seats, active holds,
  confirmed seats, waitlist size, gross collected, refunds, expenses, and net
  result using clearly labeled states.

#### Public Discovery

- **FR-011**: The public Workshops page MUST be explicitly refactored to
  advertise published upcoming workshop events while preserving a clear route
  to the existing private/custom workshop inquiry workflow. It MUST retain the
  original full-width photographic `WORKSHOPS` hero and the original
  `WORKSHOPS DESIGNED TO gather, create, celebrate` introductory message before
  presenting the upcoming-workshop experience.
- **FR-012**: Upcoming occurrences MUST be ordered chronologically and MUST
  clearly distinguish available, limited-availability, sold-out,
  registration-closed, and waitlist-available states. Cancelled occurrences
  MUST leave the upcoming listing immediately and remain reachable only through
  their retained status page under FR-073.
- **FR-013**: The page MUST present a subtle vertical list containing every
  eligible upcoming occurrence exactly once, ordered by event date and separated
  by understated horizontal lines; it MUST NOT present a public calendar.
- **FR-014**: The page MUST include an upcoming-workshop carousel with exactly
  one representative slide per eligible title-driven workshop series. Each
  slide MUST contain its hero image, title, concise advertising description,
  total number of upcoming events, and a call to action to
  `/workshops/{workshop-title}`; it MUST NOT advertise one representative
  occurrence date as though it were the series date.
- **FR-015**: Workshop details MUST show the information needed to make an
  informed reservation decision, including exact date/time and timezone,
  public venue name and address, price and required charges, seat availability
  state, florist message, media, inclusions, and
  accommodation or contact guidance.
- **FR-015a**: `/workshops/{workshop-title}` MUST present the workshop series
  using the event-detail presentation and a chronological vertical list of its
  upcoming occurrences immediately after â€œWhat is includedâ€. Occurrence detail
  URLs MUST use `/workshops/{workshop-title}/{workshop-date}` and reservation
  URLs MUST append `/reserve`; booking authority MUST remain occurrence-based.
- **FR-015b**: Series and occurrence detail pages MUST use the original clean
  white-background presentation rather than the floral-background and
  translucent-panel treatment used by the reservation and Privacy Policy
  pages. The former `Workshop details` sidebar and inline booking-terms copy
  MUST remain removed, while full public venue details remain visible in the
  hero. Series, occurrence, reservation, and Workshop Terms page content MUST
  use balanced top and bottom padding so the normal-flow public navbar does not
  create an oversized blank region above the content.
- **FR-016**: Unpublished, archived, and ineligible past occurrences MUST NOT be
  offered for booking or exposed through public event listings. Cancelled and
  rescheduled source occurrences MUST also be absent from upcoming listings
  while their retained canonical status pages remain available under FR-073.
- **FR-017**: The public experience MUST provide intentional loading, empty,
  unavailable, and failure states that keep existing inquiry contact options
  usable.
- **FR-018**: Workshop carousel, list, detail, gallery, quantity, terms, booking,
  and booking-status controls MUST be usable by keyboard, screen reader, zoom,
  reduced motion, and common phone, tablet, laptop, and desktop viewports,
  including representative Android and iPhone widths. Non-listing workshop
  pages MUST use a compact content scale, reflow without horizontal scrolling,
  preserve readable text and tap targets, and respect mobile safe areas;
  carousel content MUST remain discoverable when motion is paused or
  unavailable.
- **FR-019**: Published workshop destinations MUST provide discoverable,
  non-duplicative public metadata and must not expose private attendee,
  inventory-hold, financial, or CRM information.

#### Capacity, Booking, and Payment

- **FR-020**: A customer MUST be able to request one or more seats up to the
  per-booking limit and current sellable capacity.
- **FR-021**: Before checkout, the system MUST display seat quantity, pre-tax
  per-seat price, subtotal, selected-state tax amount and rate, calculated total,
  and contact information being collected. The reservation page MUST NOT show a
  payment-method selector and MUST proceed directly to Stripe Checkout. It MUST
  link to occurrence-specific Workshop Terms & Conditions, MUST NOT render the
  full terms inline, and MUST require explicit checkbox acceptance of the exact
  displayed terms version before continuing. On larger screens, First Name and
  Last Name MUST share one row, Email and Phone MUST share one row, and the
  booking summary MUST group when, where, per-seat price, and booking limit into
  a concise readable facts section. Required-field feedback, including terms
  acceptance, MUST use the established inquiry-form validation tooltip pattern
  instead of a separate inline terms error.
- **FR-021a**: The occurrence-specific Workshop Terms & Conditions panel MUST
  be wide enough for its desktop heading to remain on one line and MUST render
  newline-delimited clause titles with slightly enlarged bold styling and clear
  visual separation, while preserving the exact snapshotted terms text.
- **FR-022**: Starting checkout MUST create a time-limited capacity hold using
  an authoritative atomic availability check so concurrent customers cannot
  oversell an occurrence.
- **FR-023**: Hold duration and expiration MUST be disclosed, and abandoned,
  failed, cancelled, or expired attempts MUST release capacity without staff
  intervention.
- **FR-024**: The booking flow MUST collect only the booking contact and
  attendee information required for confirmation, operations, accessibility,
  fraud prevention, and legal or financial records. Booking-contact first name,
  last name, email, and phone are required; individual attendee names and
  accommodation details are optional.
- **FR-025**: Every bookable workshop occurrence MUST use a secure,
  occurrence-specific Stripe Checkout Session. Customers MUST NOT be offered a
  direct-Venmo or other payment-method alternative.
- **FR-026**: A booking MUST become confirmed only from trusted verification of
  full payment or an explicit authorized florist action, never from a browser
  redirect, query parameter, screenshot, or unverified customer claim.
- **FR-027**: New workshop booking holds and payment attempts MUST reject direct
  Venmo. Historical direct-Venmo workshop records and their authorized internal
  reconciliation workflows MUST remain intact and non-public.
- **FR-028**: Payment processing MUST be idempotent so repeated or out-of-order
  confirmation, refund, reversal, and retry messages cannot duplicate a
  booking, receipt, financial entry, or seat count.
- **FR-029**: The customer MUST receive a branded status view for processing,
  confirmed, failed, expired, cancelled, and refunded outcomes, derived from
  trusted booking state. Status access and secure replacement MUST follow
  FR-087.
- **FR-030**: After confirmation, the customer MUST receive a receipt and
  booking confirmation containing the workshop, occurrence, quantity, amount,
  location guidance, cancellation terms, and a non-secret support reference.
- **FR-031**: Failure of email, analytics, gallery media, or a nonessential
  downstream service MUST NOT turn a verified payment into an unrecorded
  booking or cause a duplicate charge.
- **FR-032**: The florist MUST be able to resend a confirmation, cancel a
  booking, initiate an eligible full or partial Stripe refund, record an
  externally completed Venmo refund or provider reversal, correct contact
  details through the verified workflow in FR-088 and FR-089, and add an
  auditable note without editing immutable payment facts. A new contact email
  MUST NOT become the delivery or recovery address until that proposed address
  completes a single-use confirmation under FR-089. Refund eligibility and
  invariants MUST follow FR-072.
- **FR-033**: The system MUST prevent capacity from being reduced below active
  held and confirmed seats unless the florist first resolves the affected
  records through an explicit exception workflow.
- **FR-034**: Each occurrence MUST provide a first-in waitlist when direct
  booking is unavailable; joining it MUST
  require no payment, and an offered seat MUST use a time-limited booking
  opportunity before passing to the next customer. The offer duration MUST be
  florist-configurable from 1 to 72 hours with a 24-hour default, and its
  effective expiration MUST be the earliest of that duration, registration
  close, or workshop start.
- **FR-035**: The florist MUST be able to add manual, complimentary, or reserved
  seats with a required reason, responsible actor, capacity effect, and
  explicit payment state.

#### Lifecycle, Operations, and Communication

- **FR-036**: Occurrences MUST use the persisted lifecycle states draft,
  published/open, registration closed, rescheduled, cancelled, completed, and
  archived, with allowed transitions and customer-facing effects defined for
  each. Sold out, limited availability, available, and waitlist available MUST
  be derived availability states and MUST NOT be persisted as lifecycle
  transitions.
- **FR-037**: Automatic sold-out and reopened availability behavior MUST NOT
  override a florist's explicit registration-closed, cancelled, completed, or
  archived state.
- **FR-038**: Cancelling a booked event MUST stop new holds immediately,
  preserve history, identify affected customers and unresolved payments, and
  initiate a trackable communication and florist-controlled refund-resolution
  workflow; event cancellation MUST NOT automatically move money. Payment-race
  and active-hold behavior MUST follow FR-077.
- **FR-039**: Passing an event's end time MUST flag it for completion review;
  it MUST NOT silently mark attendance, payment resolution, or completion.
- **FR-040**: The CRM MUST provide an event roster with booking, quantity,
  payment, waitlist, refund, contact, accommodation, and attendance states
  limited to operationally relevant data.
- **FR-041**: The florist MUST be able to check attendees in independently of
  payment state and retain who performed each operational change and when.
- **FR-042**: Material changes to date/time, venue, cancellation terms, or
  customer price after bookings exist MUST require confirmation and produce an
  affected-customer communication queue and audit history.
- **FR-043**: This feature MUST NOT add workshop occurrences to the CRM Calendar
  tab, alter that tab, or introduce any public calendar; CRM calendar integration
  requires a separate future specification.

#### Financial Traceability

- **FR-044**: Every verified charge, manual receipt, discount, processing fee,
  refund, reversal, dispute, and correction MUST produce a durable,
  non-duplicated financial record traceable to its booking and occurrence.
- **FR-045**: The florist MUST be able to record direct workshop expenses with
  event or series assignment, amount, currency, date, category, vendor or payee
  when known, note, and optional receipt evidence.
- **FR-046**: Event and series summaries MUST distinguish gross revenue,
  discounts, refunds, provider fees, other expenses, and net result rather than
  presenting a single ambiguous total.
- **FR-047**: Financial values MUST be derived from immutable transactions and
  adjustments, not recalculated from the workshop's current price or current
  booking display state.
- **FR-048**: Workshop financial records MUST be categorizable and exportable
  for future income, expense, profitability, and tax-preparation dashboards
  without including attendee-sensitive fields.

#### Analytics, Privacy, and Reliability

- **FR-049**: Public workshop measurement MUST extend the approved website
  analytics taxonomy only with documented, allowlisted carousel selection,
  list selection, detail, booking-intent, checkout-start, provider-selection,
  and verified-booking outcomes that have a stated business use.
- **FR-050**: Analytics context MUST use sanitized public workshop categories or
  controlled public content identifiers and MAY use seat quantity, currency,
  and transaction value only when approved; it MUST exclude names, emails,
  phone numbers, addresses, attendee details, booking or payment references,
  provider payloads, free text, raw URLs, query strings, and fragments.
- **FR-051**: Google Analytics MUST remain absent from CRM, authentication,
  Stripe, Venmo, payment-status, token-bearing, preview, staging, local, and
  other excluded contexts; a verified booking outcome MAY be measured only from
  an otherwise eligible public context after atomic redemption of a trusted,
  unexpired, single-use, non-identifying outcome grant.
- **FR-052**: Existing consent, regional, privacy-signal, internal-browser,
  exact-host, route allowlist, sanitization, deduplication, and fail-closed
  policies MUST govern workshop analytics without exception.
- **FR-053**: Booking, payment, confirmation, roster, and CRM workflows MUST
  remain fully functional when analytics is blocked, unavailable, or opted out,
  and previously blocked activity MUST NOT be replayed.
- **FR-054**: Operational audit history MUST identify significant staff and
  trusted-provider actions without storing payment credentials, unnecessary raw
  provider payloads, or analytics identifiers.

#### Search Visibility

- **FR-055**: Every published public occurrence MUST have one stable, unique,
  directly reachable, index-eligible detail URL focused on that single event;
  modal-only, fragment-only, and query-only destinations do not satisfy this
  requirement.
- **FR-056**: The Workshops listing and every eligible occurrence page MUST
  provide unique, accurate search titles, descriptions, canonical destinations,
  social-sharing information, headings, crawlable internal links, and suitable
  public imagery that agree with visible page content.
- **FR-057**: Every eligible occurrence page MUST describe its event in
  machine-readable search information using the visible event name, start and
  end time with correct offset, physical venue and address, image, description,
  booking URL, price, currency, and current availability or status.
- **FR-058**: Search-visible event information MUST update when an occurrence is
  rescheduled, sold out, registration-closed, cancelled, completed, archived, or
  unpublished and MUST never claim availability that the public page does not
  offer.
- **FR-059**: The public sitemap MUST include canonical published occurrence
  URLs with meaningful modification dates. Completed Past Workshop pages MUST
  remain in the sitemap; cancelled and rescheduled original URLs MUST remain
  while their 12-month status period is active and be removed when redirected.
- **FR-060**: Series occurrences with substantially similar shared content MUST
  still have distinct date-specific public content and self-consistent canonical
  signals so search engines can identify the correct individual event.
- **FR-061**: Public workshop content and its essential search metadata MUST be
  available to crawlers without requiring carousel interaction, calendar
  interaction, authentication, or a customer-specific booking token.
- **FR-062**: Search acceptance MUST include automated metadata checks plus
  release validation of representative listing, single-event, series, sold-out,
  rescheduled, cancelled, and archived cases using recognized search inspection
  and rich-event validation tools.

#### Stripe Catalog and Application-Wide Venmo Policy

- **FR-063**: Black Begonia workshop records MUST remain the authoritative
  source for occurrence dates, capacity, holds, lifecycle, bookings, customer
  terms, and financial reporting; Stripe's catalog MUST NOT act as workshop
  inventory or event administration.
- **FR-064**: Each Stripe-enabled reusable workshop definition MUST be
  associated with one corresponding Stripe Product, and each distinct sellable
  amount and currency version MUST use an immutable one-time Stripe Price;
  occurrences MAY reuse the same active price when their sellable terms match.
- **FR-065**: A price change MUST create and select a new Stripe Price for new
  checkout attempts while preserving the prior price reference for existing and
  historical bookings; the CRM MUST show whether catalog synchronization is
  ready, pending, or failed before Stripe booking is enabled. Catalog readiness
  MUST appear with pricing rather than imagery, and `not_configured` MUST be
  explained as automatic Product/Price setup that occurs during workshop save.
- **FR-066**: Each Stripe payment attempt MUST use a newly created Checkout
  Session tied to the authoritative seat hold, occurrence, quantity, and
  snapshotted total; reusable generic Payment Links MUST NOT determine workshop
  capacity or booking fulfillment.
- **FR-067**: Public workshop reservations MUST be Stripe-only and MUST NOT
  offer Venmo. Existing project direct-Venmo behavior remains unchanged, and
  PayPal-hosted or PayPal-powered Venmo approval and capture MUST NOT be
  reintroduced.
- **FR-068**: The implementation plan MUST inventory and safely retire existing
  PayPal client configuration, scripts, buttons, orders, callbacks, webhooks,
  secrets, provider states, and customer copy while preserving historical
  payment and audit records.
- **FR-069**: Removing PayPal-powered Venmo MUST NOT mark old pending payments
  as paid, erase historical provider references, duplicate manual receipts, or
  interrupt Stripe, cash, check, or direct-Venmo payment records and reminders.
- **FR-070**: No public workshop payment surface may offer direct Venmo.
  Internal legacy reconciliation may display only the historical facts needed
  to resolve a pre-cutover payment safely.
- **FR-071**: A direct Venmo payment received after hold expiration MUST NOT
  restore or exceed capacity automatically. The florist MAY confirm it only
  when sellable seats remain; otherwise the system MUST create an urgent payment
  exception and record either a refund or a transfer approved by the customer.
- **FR-072**: Authorized florist users MUST be able to initiate eligible full or
  partial Stripe refunds from the CRM with explicit confirmation and a required
  reason. Before initiation, the system MUST verify an authorized actor, a
  trusted Stripe charge, a positive remaining refundable balance, a positive
  requested amount no greater than that balance, matching original currency,
  and no replayed, active, or completed duplicate request. Refund initiation
  MUST NOT itself cancel seats or alter capacity. Direct Venmo refunds MUST
  occur outside Black Begonia and be recorded afterward with amount, date,
  reason, responsible actor, and external reference; neither path may erase or
  rewrite the original receipt.
- **FR-073**: A completed occurrence MUST retain a permanent, canonical,
  non-bookable public detail page labeled as a Past Workshop. A cancelled or
  rescheduled occurrence's original URL MUST remain public for 12 months with
  accurate status and a replacement link when available; after 12 months it
  MUST redirect to the replacement occurrence or, when none exists, the
  Workshops listing.
- **FR-074**: Stripe hold reconciliation MUST use Stripe's trusted
  payment-completion time rather than notification-arrival time. A payment
  completed at or before hold expiration MUST confirm exactly once even when
  its trusted notification arrives later. A payment completed after expiration
  MUST confirm only when sellable capacity remains; otherwise it MUST NOT
  overbook or confirm automatically and MUST create an urgent exception for a
  florist-initiated refund or customer-approved transfer.
- **FR-075**: A material reschedule affecting existing bookings MUST NOT
  silently transfer or confirm those bookings for the replacement occurrence.
  The system MUST protect equivalent replacement capacity through a disclosed
  response window, allow each affected customer to accept the transfer or
  request cancellation and refund handling, and flag nonresponses for florist
  follow-up without treating them as accepted.
- **FR-076**: A direct Venmo payment with an incorrect amount or unusable
  reconciliation reference MUST remain pending in an auditable reconciliation
  exception until the florist securely matches the payer. An underpayment MUST
  require the remaining balance or an external refund, an overpayment MUST
  require an external refund of the excess, and a missing reference MUST require
  manual identity verification. Resolution MUST NOT confirm excess seats,
  duplicate revenue, or overwrite the original payment record.
- **FR-077**: Cancelling an occurrence MUST immediately invalidate its active
  seat holds, prevent further use of associated checkout sessions where the
  provider permits, and notify pending customers not to pay. A payment that
  nevertheless completes after cancellation MUST be recorded exactly once,
  MUST NOT confirm or recreate a booking, and MUST create an urgent,
  florist-controlled refund exception.
- **FR-078**: A new booking MUST have only one active Stripe payment attempt at
  a time and MUST NOT support payment-method switching. If multiple payments
  nevertheless succeed for the same intended booking, the system MUST confirm
  at most one booking, record every transaction exactly once, consume no
  additional seats, and create an urgent exception for refunding each duplicate
  amount.
- **FR-079**: An authorized partial cancellation of a multi-seat booking MUST
  release exactly the cancelled seats, retain the remaining seats under the
  original booking, preserve the originally purchased quantity and totals, and
  append the adjusted active quantity, cancellation outcome, capacity change,
  and any refund as immutable auditable history.
- **FR-080**: A seat hold's effective expiration MUST be the earliest of its
  normal expiration, the occurrence's registration-close time, or the
  occurrence's start time. The effective deadline MUST be disclosed before
  payment begins, and any payment completed afterward MUST follow the applicable
  late-payment exception rules rather than automatically confirming.
- **FR-081**: A trusted dispute or reversal against a confirmed booking MUST
  mark that booking payment-disputed and create an urgent florist action without
  automatically cancelling the booking or releasing its seats. Capacity MUST
  change only when the florist explicitly records the resolution or cancellation,
  while the original payment and dispute history remain immutable.
- **FR-082**: When available seats are fewer than the first waitlisted
  customer's requested quantity, the system MUST offer that customer the
  available quantity up to their request for the disclosed effective period
  defined by FR-034. Acceptance at or after expiration MUST fail without
  consuming capacity. Timely acceptance MUST fulfill the waitlist entry at the
  accepted reduced quantity; decline or expiration MUST advance the seats to the
  next eligible customer exactly once without changing the original queue
  history.
- **FR-083**: Occurrence scheduling MUST use `America/New_York` and reject a
  local date and time that is nonexistent or repeated during a daylight-saving
  transition. The CRM MUST resolve the UTC offset automatically for every
  unambiguous time and MUST NOT expose timezone or UTC-offset inputs. The resulting unambiguous
  occurrence time and timezone MUST be used consistently for public display,
  holds, registration deadlines, communications, analytics context, and search
  metadata.
- **FR-084**: Existing project-payment surfaces offering direct Venmo MUST use
  the approved florist destination and create a pending, manually reconciled
  payment state without PayPal. Project payments MUST retain their existing
  configured payment deadline, reminders, obligation allocation, and
  reconciliation behavior and MUST NOT display workshop-specific seat-hold or
  seat-release language.
- **FR-085**: Workshop price per seat MUST be stored, calculated, and displayed
  as the pre-tax seat amount in integer minor currency units. Each workshop
  occurrence MUST snapshot one supported tax state/rate: Rhode Island 7%,
  Connecticut 6.35%, or Massachusetts 6.25%. Booking subtotal MUST equal the
  snapshotted price per seat multiplied by selected quantity; tax MUST equal the
  selected rate applied to subtotal; Stripe and direct Venmo MUST use the same
  snapshotted final total. No optional tip, convenience fee, customer-entered
  amount, or undisclosed mandatory charge is part of the initial workshop
  booking flow.
- **FR-086**: A verified-booking analytics outcome MUST require an opaque,
  system-issued, single-use outcome grant created only from trusted booking
  confirmation. The booking-status Edge Function MUST generate the raw grant, hash it,
  atomically register only its digest with the database, and return the raw
  value once with the occurrence's canonical public path. No database function
  MAY generate, accept, hash, return, or retain the raw value. For redemption
  or discard, the Edge Function MUST hash the presented raw grant and pass only
  the digest to the atomic database command. The browser MAY hold it transiently
  only in `sessionStorage`; the raw
  value MUST NOT enter `localStorage`, IndexedDB, cookies, a URL, logs, errors,
  audit records, analytics, or any server-side store. The digest MUST expire
  within 24 hours, be consumed atomically, reveal no booking, payment, customer,
  attendee, or provider identifier, and yield only allowlisted analytics
  context. Failed, repeated, expired, opted-out, or otherwise ineligible
  redemption MUST produce no analytics event, disclose no booking state, and
  MUST NOT be replayed later. The status experience MUST provide clean
  navigation with no token, query, or fragment to the canonical public path,
  and the eligible public occurrence experience MUST redeem or discard the
  pending grant and clear it from session state.
- **FR-087**: A booking-status token MUST be high entropy, stored only as a
  digest, and valid through 30 days after the occurrence ends or, when later, 30
  days after the latest unresolved qualifying customer-action deadline. A
  qualifying deadline is a material-reschedule response, refund or transfer
  selection after an exceptional payment, cancellation outcome requiring
  customer confirmation, or another explicitly versioned booking action that
  requires the customer's decision. Internal florist dates, provider/webhook
  retries, dispute monitoring without customer action, retention periods,
  communication retries, waitlist-offer deadlines, and analytics-grant expiry
  MUST NOT extend status-token validity. A customer MUST be able to request
  replacement access through the booking contact's verified email. The request
  MUST return the same generic response whether a booking matches or not, be
  rate-limited, reveal no booking state before verification, invalidate the
  prior token when replacement succeeds, and append an audit event.
- **FR-088**: Authorized florist users MUST be able to record and process a
  request verified under FR-089 to correct or minimize workshop personal data.
  Mutable contact, attendee, phone, and accommodation fields MAY be corrected
  while operationally required. When the active policy under FR-090 permits
  minimization, eligible operational fields MUST be removed, legally required
  financial facts MUST remain immutable, future non-required communication MUST
  be suppressed, and the audit record MUST retain only the request type,
  responsible actor, timestamps, outcome, and a non-identifying reason category.
  Contact email MUST NOT be minimized while booking recovery is active, a
  qualifying customer action remains unresolved, required communication is
  queued, payment/refund/transfer handling requires the customer, a privacy
  verification link remains active, or the active policy disallows removal.
  Such a request MUST be deferred with a safe reason category and earliest
  eligibility time. Once eligible, minimization MUST invalidate booking-status
  access, cancel active privacy-verification links, suppress non-required
  communications, and remove the email without copying it to audit history.
  Phone, attendee, and accommodation fields MAY become eligible sooner under
  the active policy. Public self-service deletion is outside the initial release.
- **FR-089**: Each correction or minimization request MUST be represented by a
  durable personal-data request linked to one booking and verified through
  either a valid booking-status token or a single-use email link sent to the
  booking's current contact email and expiring within 24 hours. A support
  reference, customer name, supplied email address, or florist authentication
  alone MUST NOT establish customer authority. The request MUST record its
  request type, requested field categories, protected proposed corrections,
  state, verification method, verification-token digest and expiration when
  applicable, verification time, applied retention-policy version, responsible
  actor, safe reason category, and timestamps. Allowed states MUST include
  pending verification, verified, approved, deferred, completed, denied, and
  expired. A proposed replacement contact email MUST remain inactive until a
  separate single-use link sent to that proposed address is confirmed within 24
  hours; only its token digest may be retained. Activation MUST invalidate prior
  booking-status and privacy-verification links. Audit and analytics data MUST
  exclude the raw verification token,
  removed or replacement values, free text, accommodation details, email, and
  phone.
- **FR-090**: Personal-data minimization MUST be governed by a versioned
  retention policy with an immutable unique version, lifecycle state, effective
  time, validated allowlisted field rules, separate operational,
  communication, financial, dispute, and audit retention periods, approval
  actor and time, and record timestamps. Policy states MUST include draft,
  approved, active, and retired. The system MUST NOT infer or seed an active
  default; minimization MUST remain disabled until a human-approved policy is
  active. An authorized privacy-policy administrator MUST be able to draft,
  review, approve, activate, and retire policy versions through an authenticated
  CRM workflow. This authorization MUST mean an active CRM profile holding the
  existing `admin` role in the existing CRM role assignment; the existing
  `staff` role MUST NOT authorize policy creation, approval, activation, or
  retirement. Activation MUST require explicit confirmation, record the
  approving and activating actors and times, and atomically retire the prior
  active version with its retirement actor and time.
  Each minimization command MUST resolve and record the active policy version
  atomically and fail safely when none exists. An active policy row MUST be
  immutable in its version, field rules, retention periods, approval facts, and
  effective time; the only permitted post-activation mutation is the controlled
  `active` to `retired` state transition and its retirement metadata. All other
  changes require a newly approved version, and retired rows MUST be immutable.

### Constitution Alignment *(mandatory)*

- **Surface**: This feature explicitly affects the public website, CRM admin
  portal, existing customer payment surfaces, cross-cutting SEO, analytics,
  payment-provider, and notification behavior, and the backend of record. It
  does not add a customer account portal or alter proposal-access authentication.
- **Product Owner Approval**: The user's request is the product-owner
  authorization to refactor the public Workshops page, add workshop detail and
  booking destinations, add the CRM Workshops tab, add workshop SEO, extend
  approved public analytics, and replace PayPal-powered Venmo throughout the
  application with direct florist Venmo handoff. Final visual content, policies,
  payment activation, and production analytics activation remain approval gates.
- **Brownfield Preservation**: Existing public navigation, general inquiry
  behavior, custom/private workshop marketing, unrelated SEO, proposal access,
  Stripe/cash/check payment behavior, historical payment records, CRM modules,
  and proposal workflows remain intact except for the explicitly authorized
  workshop-page refactor, additive workshop system, new workshop search
  destinations, and application-wide retirement of PayPal-powered Venmo.
- **Supabase Security**: Workshop, occurrence, booking, hold, attendee,
  waitlist, payment, expense, media, personal-data request, retention-policy,
  and audit data require deny-by-default row-level access. Anonymous customers
  may read only explicitly published public event projections and may initiate
  narrowly validated token-scoped actions; administrative and
  provider-mediated writes require approved authenticated boundaries. Workshop
  media requires separate public-display and protected receipt-evidence
  policies.
- **Schema Migration**: Planning and implementation MUST provide executable,
  order-aware migrations for every new or changed table, constraint, function,
  trigger, and access policy, with safe treatment of existing environments and
  no reliance on declarative definitions alone.
- **Standalone Edge Functions**: Any payment, notification, or provider callback
  function MUST remain an independently deployable unit with no local shared
  function directory, shared function module, or import from another edge
  function. No automated tests may target or simulate an edge function.
- **Testing Expectations**: Focused Angular unit tests are required for public
  and CRM components, validation, route policy, analytics hooks, booking state,
  capacity presentation, SEO state, direct Venmo handoff, removal of PayPal
  runtime behavior, and repository/service behavior. Focused PostgreSQL
  integration tests are required for migrations, row-level authorization,
  atomic capacity, idempotency, lifecycle transitions, financial invariants,
  provider retirement, replay, and failure paths. Each affected edge function
  requires independent type-checking and documented Stripe/email sandbox and
  approved-Venmo-destination smoke validation instead of automated edge-function
  tests.
- **Sensitive Data**: Payment credentials remain on approved provider surfaces;
  privileged secrets stay server-side. Customer and attendee data is minimized,
  access-controlled, excluded from public responses and analytics, and retained
  only for stated operational, legal, and financial purposes. Financial history
  is preserved while expiring holds, checkout secrets, and unnecessary raw
  provider material are discarded promptly. Direct Venmo instructions use only
  the approved public business destination and a non-secret reconciliation
  reference, never customer data in a public URL.
- **Proposal Workflow**: Existing project proposal calculations, invoice and
  planning records, manual Canva PDF upload, Stripe/cash/check project payments,
  and future reporting remain unchanged. Existing project Venmo presentation is
  changed only to the explicitly approved direct-link/manual-reconciliation
  policy. Workshop-event finances are a separate traceable source designed for
  later unified reporting rather than being forced into the project proposal
  workflow.
- **Git Publication**: AI agents MUST NOT commit, push, or invoke commit/push
  automation. The human operator retains all publication responsibility.

### Key Entities *(include if feature involves data)*

- **Workshop Definition**: Reusable shared content for a workshop concept,
  including title, theme, description, inclusions, default terms, and media.
- **Workshop Series**: A related collection of occurrences generated from a
  workshop definition, with shared defaults and explicit per-occurrence
  exceptions.
- **Workshop Occurrence**: One dated, bookable event with its own venue,
  timezone, capacity, price, registration window, lifecycle, media overrides,
  public search destination, search-visible event information, and an
  unambiguous scheduled instant derived from its local time and selected
  timezone offset.
- **Workshop Media**: A hero image or ordered gallery item with public-display
  state, alternative text, and relationship to a definition or occurrence.
- **Seat Hold**: A short-lived claim on a quantity for one occurrence and
  checkout attempt, with an authoritative expiration and resolution state.
- **Workshop Booking**: The customer's reservation for one occurrence,
  including booking contact, seat quantity, snapshotted terms and totals,
  booking state, and non-secret support reference.
- **Attendee**: Minimal participant information and accommodation or attendance
  state associated with a booked seat when voluntarily supplied or
  operationally required; an attendee name is not required to purchase a seat.
- **Waitlist Entry**: A customer's ordered interest in an unavailable
  occurrence, including offer state and expiration without payment data.
- **Payment Transaction**: An immutable charge, fee, refund, reversal, dispute,
  or manual adjustment linked to a booking and deduplicated by its trusted
  source.
- **Stripe Catalog Association**: The relationship between a workshop
  definition, its Stripe Product, the current versioned one-time Price, prior
  Prices retained for history, and catalog readiness state.
- **Workshop Expense**: A direct cost assigned to an occurrence or series with
  category, amount, date, payee context, note, and optional evidence.
- **Workshop Communication**: A confirmation, receipt, reminder, material-change
  notice, cancellation notice, waitlist offer, or delivery outcome.
- **Workshop Audit Event**: A trace of significant lifecycle, capacity,
  booking, payment, financial, or staff actions.
- **Analytics Outcome Grant**: A short-lived, single-use, digest-stored
  authorization created from trusted confirmation that permits one sanitized
  verified-booking outcome on an otherwise analytics-eligible public page
  without exposing or resolving booking data.
- **Personal Data Request**: A correction or minimization request linked to a
  booking, with protected requested changes, explicit identity-verification
  state, policy version, processing outcome, and only safe reason metadata.
- **Retention Policy**: A human-approved, versioned and immutable-on-activation
  set of allowlisted field rules and operational, communication, financial,
  dispute, and audit retention periods that authorizes minimization decisions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A florist can create and publish one valid workshop occurrence in
  under 5 minutes, or a five-date series in under 8 minutes, excluding image
  preparation time.
- **SC-002**: At least 95% of usability-test customers can find an upcoming
  event, understand its date, location, price, availability, and terms, and
  begin the correct booking flow without assistance.
- **SC-003**: At least 95% of customers who have their information ready can
  select seats and reach their chosen secure payment option in under 3 minutes.
- **SC-004**: Under simultaneous final-seat tests, confirmed seats never exceed
  configured capacity, and abandoned or expired holds restore availability
  within 1 minute of their stated expiration.
- **SC-005**: Across duplicate, delayed, replayed, and out-of-order payment
  tests, every successful charge produces exactly one booking, receipt, revenue
  record, and capacity deduction.
- **SC-006**: Every confirmed booking is visible in the CRM within 30 seconds of
  trusted payment verification. In a normal-provider validation batch of at
  least 100 confirmation messages, at least 99% are accepted for delivery
  within 2 minutes of durable queue creation.
- **SC-007**: Event and series financial summaries reconcile to verified
  payments, refunds, fees, adjustments, and recorded expenses with zero
  unexplained variance in acceptance testing.
- **SC-008**: All core public discovery, detail, quantity, terms, and booking
  controls pass keyboard, screen-reader, 200% zoom, and mobile-viewport
  acceptance checks with no critical accessibility defect.
- **SC-009**: Analytics validation records each permitted funnel milestone at
  most once per qualifying action, records zero prohibited customer/payment
  fields, and produces zero Google Analytics requests in every excluded or
  opted-out test context.
- **SC-010**: Analytics, email, or gallery failure causes zero lost verified
  bookings and zero duplicate charges in resilience testing.
- **SC-011**: Florist acceptance testing can complete event cancellation,
  attendee lookup, check-in, refund recording, waitlist offer, and expense entry
  without direct data intervention.
- **SC-012**: The existing private-workshop inquiry route, unrelated public
  pages, proposal access, Stripe/cash/check project-payment flows, historical
  payment records, and existing CRM modules pass their relevant regression
  checks after the workshop and Venmo-policy refactor.
- **SC-013**: All tested published occurrence pages expose unique, accurate,
  crawlable event information and pass recognized rich-event validation with no
  critical error; sold-out, rescheduled, cancelled, and unpublished test cases
  show no stale purchasable state.
- **SC-014**: Every tested workshop and existing project-payment Venmo action
  reaches only the approved florist Venmo destination, creates a pending
  manually reconciled state, and loads or calls zero PayPal scripts, buttons,
  orders, credentials, or webhooks.
- **SC-015**: One Stripe-enabled reusable workshop with five same-price
  occurrences produces one Stripe Product and one reusable active Price, while
  a later price change produces one new Price without altering the amount or
  reconciliation of any earlier booking.

## Assumptions

- The florist and authorized staff are the only CRM workshop administrators in
  the initial release; new staff-role design is outside this specification.
- One occurrence uses one currency, venue, the fixed `America/New_York`
  timezone, price per seat, and seat
  capacity; tiered tickets, subscriptions, memberships, gift cards, coupons,
  assigned seating, and multi-currency checkout are outside the initial release.
- Nonexistent or repeated local times during daylight-saving transitions cannot
  be saved. The application automatically resolves offsets for unambiguous New
  York local times, and that resolved occurrence time governs every customer
  and operational deadline.
- A default maximum seats-per-booking and hold duration will be business
  configurable during planning, with conservative launch defaults.
- The published workshop price per seat is the pre-tax required seat amount in
  integer minor currency units. Reservation and payment surfaces display
  subtotal, selected-state tax, and the final required total. No optional tip,
  convenience fee, customer-entered payment amount, or other undisclosed charge
  is part of the initial booking flow.
- Stripe is the primary automatically verified checkout. Black Begonia remains
  the catalog and inventory source of truth; Stripe mirrors one Product per
  reusable workshop definition and versioned one-time Prices, while a new
  Checkout Session is created for each authoritative booking hold. Stripe
  payment timing is determined from trusted payment-completion data rather than
  webhook arrival time. A payment completed before hold expiration remains
  valid despite delayed notification; a payment completed after expiration
  confirms only if capacity remains and otherwise requires an urgent,
  florist-resolved refund or customer-approved transfer exception.
- Each booking has only one active payment choice. Switching methods invalidates
  the prior Stripe session and marks prior Venmo instructions superseded; any
  payment-method collision confirms only one booking, records every transaction,
  consumes no extra seats, and requires an urgent duplicate-payment refund
  exception.
- Venmo is always a direct handoff to the florist's approved business
  destination followed by manual reconciliation. This decision supersedes
  earlier Black Begonia artifacts that describe PayPal Orders, the PayPal
  browser SDK, or PayPal webhooks as the means of providing Venmo.
- Workshop Venmo uses the 24-hour/capped seat deadline below. Existing project
  Venmo retains its configured payment deadline, reminders, obligation
  allocation, and manual-reconciliation behavior and never presents workshop
  seat-hold or seat-release language.
- A direct Venmo selection creates a 24-hour provisional seat hold. Verification
  within that window confirms the booking, except that registration close or
  workshop start creates an earlier effective deadline. Expiration releases the
  seats and any later payment requires explicit florist resolution rather than
  automatic confirmation. A late payment may be confirmed only while sellable
  capacity remains; otherwise it requires an urgent exception and a refund or
  customer-approved transfer. Incorrect amounts and missing reconciliation
  references remain pending until the florist securely identifies the payer:
  underpayments require the balance or an external refund, overpayments require
  an external excess refund, and missing references require manual identity
  verification.
- Refund eligibility and cancellation wording are florist-managed business
  policy. This feature records and communicates outcomes but does not infer
  legal entitlement. Event cancellation never moves money automatically:
  authorized florist users initiate full or partial Stripe refunds in the CRM,
  while direct Venmo refunds are completed externally and recorded afterward.
  Cancellation immediately invalidates active holds and disables associated
  checkout sessions where possible; any race-condition payment is recorded
  without booking confirmation and requires urgent florist-controlled refund
  handling.
- A payment dispute or reversal does not automatically cancel a confirmed
  booking or release its seats. The booking is flagged payment-disputed with
  urgent florist action required until an explicit resolution changes its
  booking or capacity state.
- Materially rescheduling a booked occurrence requires customer acceptance
  before transfer. Equivalent replacement capacity remains protected during a
  stated response window; customers may instead request cancellation and refund
  handling, while nonresponses remain unconfirmed and require florist follow-up.
- Customers do not need accounts. Secure, time-limited customer actions and
  non-secret support references are preferred over reusable passwords. Booking
  status access remains valid through 30 days after the occurrence or any later
  unresolved action deadline; a generic, rate-limited email recovery invalidates
  the prior token when replacement succeeds.
- A booking requires the booking contact's name and email. Phone number,
  individual attendee names, and accommodation details are optional and do not
  block checkout.
- A multi-seat booking may be partially cancelled. Only the authorized cancelled
  quantity is released; the remaining seats stay under the original booking,
  while the original purchase and subsequent quantity and refund changes remain
  auditable.
- Waitlist priority applies to the customer entry rather than requiring an exact
  quantity match. If fewer seats are available than the first customer's
  request, that customer receives a reduced-quantity offer lasting 24 hours by
  default, configurable from 1 to 72 hours and capped by registration close or
  workshop start; timely acceptance fulfills the entry, while expiration,
  decline, or late acceptance advances the queue exactly once.
- Event confirmation and operational messages use the existing approved
  business email channel; delivery failure is recoverable and does not change
  trusted booking state.
- A trusted workshop confirmation creates at most one analytics outcome
  eligibility record. The first confirmed-status resolution may have the
  booking-status Edge Function generate one opaque grant, register only its digest in
  the database, and return the raw value once. The raw value expires within 24
  hours, is never persisted server-side or placed in a URL, and is held in the
  browser only in `sessionStorage`. Clean navigation leads to the occurrence's
  canonical public path, where an otherwise eligible public workshop page may
  redeem it atomically once for sanitized measurement. Consent or policy
  failure discards and clears the opportunity rather than replaying it later.
- A publicly bookable occurrence exposes a real venue name and address on its
  detail page so customer and search information remain consistent. The listing
  may use a concise location summary, and confirmations may add arrival details;
  events whose address must remain private use the existing private-workshop
  inquiry path rather than public event search information.
- Workshop financial records are prepared for a future unified dashboard in
  this release; building the full cross-business income and expense dashboard
  is outside this feature.
- Public and CRM calendars, calendar-ready projections, and changes to the CRM
  Calendar tab are outside this feature and require a separate future
  specification.
- Completed occurrence pages remain public permanently as non-bookable Past
  Workshops. Cancelled and rescheduled original URLs remain public for 12
  months with accurate status and replacement links, then redirect to the
  replacement occurrence or Workshops listing.
- Historical workshop-event records are new. Existing custom/private workshop
  inquiries and workshop-related projects are preserved and are not migrated
  into public event bookings automatically.
- Production payment activation, public policy text, analytics taxonomy
  activation, and data-retention schedules require business and qualified
  privacy/legal review before launch.
- The active versioned retention policy defines operational, communication, financial,
  dispute, and audit periods plus which customer fields may be corrected,
  minimized, or retained. It is stored as a versioned, human-approved policy;
  no active default is assumed and minimization is disabled until a policy is
  activated. The initial release provides a token- or email-link-verified
  request with authenticated CRM processing, not public self-service deletion.
- Timed usability acceptance uses at least five representative florist attempts
  for each single-occurrence and five-date-series workflow and at least 20
  representative customer attempts for public discovery and payment handoff.
  Test evidence records start/end rules, completion time, assistance, outcome,
  device/viewport, and sanitized observations without collecting booking or
  payment secrets.
