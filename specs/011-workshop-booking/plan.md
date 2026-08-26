# Implementation Plan: Workshop Events and Booking

**Branch**: `011-workshop-booking` | **Date**: 2026-07-29 | **Spec**:
[spec.md](./spec.md)

**Input**: Feature specification from
`/specs/011-workshop-booking/spec.md`

## Summary

Add a complete public-workshop commerce and operations system to the existing
Angular application: CRM definition/series/occurrence management, public
listing and detail routes, atomic seat holds, Stripe Checkout, direct Venmo
reconciliation, roster/waitlist/lifecycle tools, immutable workshop financials,
pre-tax minor-unit seat pricing with fixed state tax snapshots, search metadata, and privacy-safe funnel
analytics with one-time trusted confirmation outcomes. Booking-status recovery,
bounded waitlist offers, technical refund eligibility, and authenticated
personal-data correction/minimization with customer-controlled verification and
versioned retention policies complete the operational safeguards.

The implementation keeps workshop inventory and financial records in dedicated
Supabase tables and authoritative PostgreSQL functions, avoiding invasive
changes to the project proposal/payment ledger. It reuses global payment
settings, the existing Stripe webhook endpoint, Supabase Storage, Mailgun
patterns, SEO/JSON-LD services, and the approved analytics boundary. A normalized
financial projection prepares workshop revenue and expenses for a future unified
dashboard. PayPal-powered Venmo runtime paths are retired application-wide while
historical PayPal records remain intact.

## Technical Context

**Language/Version**: Angular 19.2 / TypeScript 5.8 for frontend work; Deno
TypeScript for standalone Supabase Edge Functions; PostgreSQL SQL/PLpgSQL for
schema, RLS, inventory, lifecycle, and reconciliation contracts.

**Primary Dependencies**: Angular Router, Angular Material/CDK, RxJS, Supabase
JavaScript client/Postgres/Storage/Edge Functions, Netlify Angular SSR,
Stripe Checkout/Product/Price/Refund/Webhook APIs, Mailgun, existing SEO and
JSON-LD services, existing privacy-controlled GA4 services, Karma/Jasmine, and
PostgreSQL integration tests. No FullCalendar work and no new calendar
dependency are included.

**Storage**: New dedicated workshop tables in Supabase Postgres; a public,
image-restricted `workshop-media` bucket for crawlable hero/gallery assets; a
private receipt-evidence location; immutable workshop financial transactions
and audit records; digest-only single-use analytics outcome grants; durable
personal-data requests; immutable-on-activation retention policies; five
ordered additive migrations for catalog/media, booking/capacity,
payments/reconciliation, operations/lifecycle, and privacy/analytics, each
paired with its declarative table/function/storage definitions.

**Testing**: Karma/Jasmine unit tests for affected Angular components,
repositories, services, guards/policies, SEO, structured data, analytics, and
PayPal retirement. Five focused PostgreSQL suites under `supabase/tests/` match
the ordered migration slices and cover RLS, public projection, capacity
concurrency, hold expiry, idempotency, lifecycle,
derived availability, upcoming-list exclusion, rescheduling, waitlists,
refunds/disputes, personal-data/replacement-email verification, retention-policy
authorization, and financial invariants. No automated
test may target, invoke, import, or simulate an Edge Function; each affected
function receives independent type-checking and documented provider/customer
sandbox smoke validation. Timed acceptance evidence covers at least five
representative florist attempts per administrative workflow and twenty
representative customer attempts per discovery/payment-handoff workflow. Normal
message acceptance uses a batch of at least 100 confirmations and verifies that
at least 99% reach provider-accepted state within two minutes of durable queue
creation.

**Target Platform**: Netlify-hosted Angular application with public SSR-capable
workshop routes, authenticated CRM routes, secure tokenized customer booking
status/actions, and Supabase backend services. Modern phone, tablet, laptop, and
desktop browsers, including representative Android and iPhone viewport and
safe-area behavior, with accessible keyboard, screen-reader, reduced-motion,
and 200% zoom support.

**Project Type**: Brownfield Angular public website, payment-access surface, and
CRM admin portal in one deployment, backed by Supabase.

**Performance Goals**: Public workshop listing/detail content renders useful
text and imagery without blocking on analytics; CRM lists remain responsive for
at least hundreds of occurrences and thousands of bookings. A representative
acceptance dataset contains at least 500 occurrences and 5,000 bookings, and
the occurrence list plus a 100-row roster page MUST each complete data retrieval
and usable rendering within 2 seconds at p95 in the documented test environment;
final-seat
transactions never exceed capacity; expired holds restore sellable capacity
within one minute; verified bookings appear in CRM within 30 seconds; accepted
confirmation delivery is queued within two minutes under normal provider
operation; public workshop work must not regress a good p75 Core Web Vital by
more than 10% without approval.

**Constraints**: Preserve the existing private-workshop inquiry route, proposal
workflow, project payment obligations, Stripe/cash/check behavior, historical
payment records, public navigation, and unrelated CRM modules. No customer
account is introduced. No service-role, Stripe, Mailgun, or provider secret may
enter frontend code. All new tables use RLS and matching executable migrations.
All Edge Functions remain standalone with no `_shared` directory or
cross-function local import. No automated Edge Function tests. No public or CRM
calendar implementation. No PayPal runtime use after cutover. GA remains absent
from tokenized, payment, CRM, auth, local, preview, and opted-out contexts. AI
agents do not commit or push.

**Scale/Scope**: Five public route families (`/workshops`,
`/workshops/:seriesSlug`, `/workshops/:seriesSlug/:workshopDate`, and
`/workshops/:seriesSlug/:workshopDate/reserve`, plus the no-index
`/workshops/:seriesSlug/:workshopDate/terms-and-conditions` contract), secure tokenized booking/status actions, one CRM
`/admin/workshops` area with occurrence detail operations, approximately
twenty-two new workshop tables plus public/financial projections and invariant
functions, one public and one private media policy boundary, eight new thin standalone
Edge Functions, extensions to the existing Stripe webhook and analytics/SEO
services, two scheduled processors, application-wide PayPal runtime retirement,
and no migration of historical private workshop inquiries.

## Constitution Check

*GATE: Passed before Phase 0 and re-checked after Phase 1 design.*

- **Surface classification**: Cross-cutting approved work across the public
  website, secure payment-access boundary, CRM admin portal, Supabase backend,
  storage, payments, search, analytics, and email. The feature specification is
  explicit product-owner approval for the public workshop refactor and these
  related workflows.
- **Brownfield preservation**: Existing `/workshops` private/custom workshop
  marketing intent remains reachable through the inquiry CTA. Unrelated public
  routes, proposal access, proposal calculations/documents, project
  deposit/final obligations, Stripe/cash/check project payments, historical
  PayPal facts, CRM modules, calendar placeholder, SEO routes, and analytics
  privacy policy remain intact except for explicitly approved additive workshop
  changes and removal of active PayPal-powered Venmo paths. Existing project
  direct-Venmo deadlines, reminders, obligation allocation, and manual
  reconciliation remain unchanged and use no workshop seat-release language.
- **Supabase security**: Base workshop customer, attendee, hold, payment,
  expense, communication, and audit tables deny anonymous access. Anonymous
  customers receive only published projections or narrow token-scoped Edge
  Function responses. Authenticated internal CRM users may read operational
  records; invariant-heavy writes use security-definer functions. Service-role
  access is limited to standalone provider/message functions. Public media and
  private receipt evidence use separate storage policies. Provider secrets and
  customer tokens remain server-side or digest-only. Raw analytics grants are
  generated once by the status/recovery Edge Function, registered in the
  database only as digests, returned once, and held in the browser only in
  `sessionStorage`.
- **Schema migrations**: Five ordered additive files under
  `supabase/migrations/` deliver catalog/media, booking/capacity,
  payments/reconciliation, operations/lifecycle, and privacy/analytics. Each
  slice creates its own tables, constraints, indexes, RLS, policies,
  views/functions, and grants, preserves existing rows, and is validated before
  dependent code is enabled. The payments slice leaves legacy PayPal facts
  readable; no destructive historical-data migration is required.
- **Standalone edge functions**: Planned functions
  `create-workshop-booking`, `manage-workshop-booking-access`,
  `verify-workshop-personal-data`, `redeem-workshop-analytics-outcome`,
  `manage-workshop-catalog`, `refund-workshop-payment`,
  `expire-workshop-holds`, and `process-workshop-messages` are each independent
  and purpose-specific. The existing
  `stripe-payment-webhook` is modified in place to route workshop metadata while
  retaining project-payment behavior. Each directory contains its own
  validation/provider code and imports no local shared module or another
  function. No automated test targets any Edge Function.
- **Testing plan**: Angular unit tests cover public/CRM UI, repositories, route
  classification, payment handoffs, SEO/JSON-LD, analytics schemas, and removed
  PayPal behavior, contributing focused meaningful coverage toward the 80%
  target. PostgreSQL integration tests cover migration/RLS plus every atomic
  capacity, state, financial, replay, authorization, and clarified edge-case
  contract, including minor-unit total parity and one-time analytics grant
  redemption. Timed acceptance records five florist attempts per administrative
  workflow and twenty customer attempts per discovery/payment workflow. Each
  Edge Function is independently type-checked; Stripe CLI/test
  mode, Mailgun sandbox, direct Venmo destination, and scheduled expiration
  smoke checks are documented without an automated Edge Function harness.
- **Frontend boundary plan**: Public discovery/detail components stay under
  `components/public`; tokenized booking/status stays in a dedicated
  `components/workshop-booking` boundary analogous to payment access; CRM
  management stays under `components/private/workshops`. Models and repositories
  are typed in `core`. This preserves logical public/payment/admin separation
  within the current application and creates no frontend split.
- **Proposal workflow rule**: Proposal calculations, manual Canva PDF upload,
  invoice snapshots, project obligation allocation, and project reporting are
  unchanged. Only the globally obsolete PayPal/Venmo runtime branch is removed;
  configured direct-Venmo deadlines/reminders, Stripe, cash, and check project
  behavior remains.
- **Security and privacy**: Public projections contain no booking or attendee
  data. Booking/status tokens are high entropy, single purpose, expiring, and
  stored only as digests. Analytics outcome grants are Edge-generated only
  after trusted confirmation; the database registers only digests, which expire
  within 24 hours and are atomically redeemable once for allowlisted public
  context. Raw grants never enter server persistence, durable browser storage,
  database calls, URLs, logs, errors, audit, or analytics. Redemption and
  discard endpoints hash the presented grant at the Edge boundary and pass
  only its digest to Postgres. Names/emails and
  accommodation details remain non-public and are never sent to GA. Status
  tokens remain valid through 30 days after the occurrence or latest unresolved
  qualifying customer-action deadline; generic rate-limited email recovery
  rotates and invalidates the prior token. Correction/minimization requests
  require a valid status token or 24-hour one-time link to the current contact
  email. A replacement contact email remains inactive until it independently
  confirms a 24-hour one-time link. Minimization resolves a human-approved
  active policy version
  atomically, defers contact-email removal while recovery, communication,
  customer-action, payment, or verification dependencies remain, preserves
  financial facts, suppresses non-required communication, and keeps removed
  values out of audit metadata. Stripe/Mailgun/Supabase service secrets
  stay in Edge Function environment settings. Provider payloads are minimized
  to digests and normalized facts. Receipt evidence is private. Rate limiting,
  input bounds, origin checks, webhook signature checks, idempotency keys, and
  immutable financial/audit history are mandatory.
- **Git publication boundary**: No AI agent runs commit, push, or
  commit/push-capable hooks. Source-control publication is a human handoff.

**Post-design re-check**: Pass. The data model keeps public projections separate
from operational tables, every capacity/payment transition has a database
authority, storage splits public marketing media from private evidence, Edge
Functions remain standalone and untested by automation as required, and the
contracts preserve existing project/proposal/payment behavior. No constitution
violation requires an exception.

## Project Structure

### Documentation (this feature)

```text
specs/011-workshop-booking/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/
    workshop-system.md
  checklists/
    requirements.md
  tasks.md                       # generated by /speckit-tasks
```

### Source Code (repository root)

```text
src/app/
  app.routes.ts
  components/
    public/
      workshops/                 # refactored listing, carousel, private inquiry CTA
      workshop-detail/           # stable public occurrence route
      workshop-terms-and-conditions/ # occurrence-specific booking terms
    workshop-booking/
      workshop-reservation/      # quantity/contact/terms and provider handoff
      workshop-booking-status/   # token-scoped processing/confirmation state
    private/
      workshops/
        workshops.component.*
        workshop-editor/
        workshop-occurrence-detail/
        workshop-roster/
        workshop-data-retention-policy/
        workshop-financials/
  core/
    models/
      workshop.ts
      workshop-booking.ts
      workshop-financial.ts
    supabase/
      repositories/
        workshop-public-repository.service.ts
        workshop-catalog-repository.service.ts
        workshop-operations-repository.service.ts
        workshop-financial-repository.service.ts
        workshop-privacy-repository.service.ts
        workshop-admin-facade.service.ts
        workshop-booking-repository.service.ts
      services/
        workshop-media.service.ts
        workshop-booking.service.ts
    analytics/
      analytics.models.ts
      analytics-route-policy.service.ts
      analytics-sanitizer.service.ts
      website-analytics.service.ts
    seo/
      seo.service.ts
      jsonld.service.ts
  shared/components/private/sidebar/

scripts/
  generate-sitemap.cjs

supabase/
  migrations/
    20260729000000_workshop_catalog_media.sql
    20260729001000_workshop_booking_capacity.sql
    20260729002000_workshop_payments_reconciliation.sql
    20260729003000_workshop_operations_lifecycle.sql
    20260729004000_workshop_privacy_analytics.sql
    20260801000000_workshop_reusable_concept_lifecycle.sql
    20260801001000_workshop_unique_slug_allocation.sql
  schemas/
    public/tables/
      workshop_*.sql
    public/functions/
      workshop_*.sql
      workshop_occurrence_slug_allocation.sql
    storage/
      workshop_media.sql
  tests/
    workshop_catalog_media.sql
    workshop_booking_capacity.sql
    workshop_payments_reconciliation.sql
    workshop_operations_lifecycle.sql
    workshop_privacy_analytics.sql
  edge_functions/
    create-workshop-booking/index.ts
    manage-workshop-booking-access/index.ts
    verify-workshop-personal-data/index.ts
    redeem-workshop-analytics-outcome/index.ts
    manage-workshop-catalog/index.ts
    refund-workshop-payment/index.ts
    expire-workshop-holds/index.ts
    process-workshop-messages/index.ts
    stripe-payment-webhook/index.ts
    create-payment-checkout/index.ts       # PayPal branch removed
    capture-venmo-order/                    # retired after cutover
    paypal-payment-webhook/                 # retired after cutover
```

**Structure Decision**: Keep the current single Angular application and its
logical surface boundaries. Split CRM data access into catalog/occurrence,
booking-operations/roster, financial, and privacy/retention repositories; a
small admin facade may coordinate component-facing reads but MUST NOT absorb
domain rules or become the default owner of every command. Keep invariant-heavy
public and CRM mutations behind database functions. Keep each standalone Edge
Function thin: validate its boundary, rate-limit where applicable, translate a
single-purpose request, call authoritative database/provider commands, and map
safe responses. Extend the single Stripe webhook because Stripe events are
account-wide, while preserving its existing project-payment route. Keep media,
SEO, analytics, and navigation changes narrowly additive.

### Implementation boundary guardrails

- **CRM repositories**: catalog/occurrence, operations/roster,
  financial/reporting, and privacy/retention have separate repository and test
  ownership. The optional admin facade contains orchestration only and depends
  on those repositories; repositories do not depend on the facade or on each
  other.
- **Edge endpoints**: `create-workshop-booking` owns hold creation and payment
  choice only. Status resolution/recovery and token-scoped booking actions,
  personal-data verification, and analytics outcome redemption/discard use
  separate standalone endpoints. Each endpoint duplicates only the small amount
  of local boundary validation needed to remain independently deployable and
  delegates durable state transitions to PostgreSQL commands.
- **Database delivery**: the five migration slices are independently additive,
  ordered, and rollback-documented. A later slice may depend on an earlier one,
  but no earlier slice references objects that appear only later. Declarative
  schema files remain the source representation and every change is included in
  the corresponding executable slice. During implementation, repeated
  apply/reset validation uses a disposable environment. Once any migration is
  promoted to a persistent shared or production environment it is immutable;
  subsequent changes use a new additive timestamped migration in the same
  capability slice.
- **Vertical delivery**: implementation completes and validates one release
  slice before beginning unrelated work in a later slice. Feature flags keep
  incomplete public booking/provider behavior unavailable.

### Release slices

1. Workshop creation and publishing on catalog/media.
2. Public listing and occurrence details, still non-bookable.
3. Seat holds and Stripe/direct-Venmo booking on booking/capacity plus
   payments/reconciliation.
4. Series generation on the established catalog boundary.
5. Basic roster, check-in, cancellation, and lifecycle on
   operations/lifecycle.
6. Advanced waitlist/rescheduling/privacy operations, financial reporting,
   analytics, and retained SEO lifecycle behavior; privacy/analytics is applied
   only when this slice begins.

Each slice has its own migration/test gate and can be reviewed without pulling
unfinished later-slice work into the same implementation increment.

## Architecture and Delivery Design

### Phase 0: Research outcome

[research.md](./research.md) resolves the payment-domain boundary, atomic
capacity design, Stripe catalog/session/refund strategy, provider timing,
direct-Venmo and PayPal retirement, anonymous access, media policy, timezone
handling, SEO retention, analytics privacy, scheduled work, and validation
strategy. No unresolved planning marker remains.

### Phase 1: Design artifacts

- [data-model.md](./data-model.md) defines workshop content, occurrence,
  inventory, booking, attendee, waitlist, payment, expense, communication,
  audit, personal-data request, retention-policy, public projection, financial
  projection, and state-transition contracts.
- [contracts/workshop-system.md](./contracts/workshop-system.md) defines public,
  tokenized customer, CRM, provider, analytics, SEO, and scheduled-processing
  interfaces.
- [quickstart.md](./quickstart.md) defines migration/configuration order,
  automated validation, standalone function type-checks, provider smoke tests,
  accessibility/SEO/analytics checks, deployment gates, rollback, and PayPal
  retirement verification.

### Authoritative booking flow

1. Public listing/detail reads only the published occurrence projection.
2. Reservation submission reaches `create-workshop-booking`, which validates
   origin, quantity, contact fields, registration window, rate limits, and terms
   version before calling the atomic hold function.
3. The database locks the occurrence, expires eligible holds, calculates
   sellable seats, snapshots price/terms/contact, and returns a hold plus
   single-purpose booking/status token.
4. Stripe selection creates one Checkout Session for the hold using the
   snapshotted pre-tax seat price, quantity, and tax line. The snapshotted
   subtotal, tax, and total in integer minor units produce the same required
   total for Stripe and direct Venmo. Direct Venmo selection supersedes any active Stripe attempt and
   returns only the approved destination, amount, reference, and effective
   deadline.
5. Stripe success is accepted only by the signed webhook and authoritative
   object retrieval. Direct Venmo confirmation is an audited florist action.
6. Reconciliation uses trusted completion time, locks the hold/occurrence, and
   confirms exactly once when permitted. Late, duplicate, mismatched, cancelled,
   or over-capacity money becomes an urgent exception without overbooking.
7. Confirmation appends financial/audit records, queues communication, and
   creates at most one analytics outcome eligibility record in the same durable
   transaction. On the first confirmed-status resolution, the standalone
   status/recovery Edge Function may generate one opaque raw grant, hash it,
   atomically register only its digest through the database command, and return
   the raw value once for session-only handling. On redemption or discard, the
   standalone analytics-outcome Edge Function hashes the presented grant and
   passes only the digest to the database; no database function accepts,
   generates, hashes, or returns the raw value. Message delivery
   occurs asynchronously. The raw grant stays outside public URLs and can be
   atomically redeemed once within 24 hours only from an otherwise
   analytics-eligible public workshop context.
8. The confirmed-status response includes only the canonical public occurrence
   path plus the optional raw grant. The status component keeps the grant in
   session-only state and navigates without token, query, or fragment; the public
   occurrence component asks the analytics service to redeem or discard it and
   clears session state in every terminal outcome.

### Lifecycle and operational flow

- Draft definition/series/occurrence content is internal only; publication is an
  explicit validated transition.
- Occurrence lifecycle persists draft, open, registration-closed, rescheduled,
  cancelled, completed, and archived states.
- Series generation copies shared snapshots into independently manageable
  occurrences. Bulk edits preview affected occurrences and preserve overrides.
- Sold-out, limited, available, and waitlist-available are derived availability
  values, never persisted lifecycle transitions, and do not override manually
  closed/cancelled/completed/archived states.
- Cancellation invalidates holds, queues checkout expiration and customer
  notices, and leaves refunds florist-controlled.
- Rescheduling creates or selects a replacement occurrence, protects equivalent
  capacity for response tokens, and never silently transfers a booking.
- Completed, cancelled, and rescheduled source occurrences leave upcoming lists.
  Completed occurrences retain permanent Past Workshop pages;
  cancelled/rescheduled source pages retain status for 12 months before the
  specified redirect.
- Waitlist offers default to 24 hours, are configurable from 1 to 72 hours, and
  expire at the earliest of that duration, registration close, or workshop
  start. Late acceptance fails without consuming capacity and advances the queue
  exactly once.
- Booking-status access extends only for unresolved, versioned customer-facing
  decisions, not internal dates, retries, passive dispute monitoring, retention
  periods, waitlist offers, or analytics expiry.
- Personal-data requests require status-token or one-time-email-link
  verification. Processing records the active retention-policy version;
  contact-email removal is deferred until recovery, required communication,
  customer action, payment/refund/transfer, verification-link, and policy
  dependencies are clear.
- Contact-email correction keeps the current address active until the proposed
  address confirms its own 24-hour one-time link; activation invalidates prior
  status and privacy-verification links.
- Active CRM users holding the existing `admin` role in `public.user_roles`
  draft, review, approve, activate, and retire versions through the CRM. Existing
  `staff` users may process verified personal-data requests but cannot mutate
  policy versions. Angular route access uses the roles already loaded by
  `AuthService`; database RLS and commands enforce the same active-profile plus
  admin-role boundary. Activation is explicitly confirmed, records approval and
  activation actors/times, and retires the prior active version atomically.
  Active policy content is immutable; only the controlled `active -> retired`
  transition and its retirement actor/time may update an active row.

### Financial and reporting flow

- Charges, refunds, reversals, disputes, external Venmo receipts/refunds, fees,
  corrections, and quantity adjustments are append-only.
- Booking totals and terms are snapshots; current workshop content never
  recalculates historical revenue.
- Expenses are linked to an occurrence or series and may reference private
  receipt evidence.
- Stripe refund commands validate authorization, trusted charge, original
  currency, positive remaining refundable balance, amount bounds, and
  idempotency before provider submission. Refund initiation never changes
  booking capacity; a seat-aware roster refund releases only its selected seats
  after verified Stripe reconciliation, or atomically with the record of an
  externally completed direct-Venmo refund.
- A normalized workshop financial projection exposes source type, source ID,
  occurrence/series, date, category, signed amount, currency, and traceable
  reference without attendee data, ready for a future dashboard union.

## Deployment and Rollback

1. Apply and validate the catalog/media migration slice followed by the
   additive reusable-concept lifecycle refinement, with publication and
   provider flags disabled, then deploy workshop creation and public discovery.
2. Apply and validate the booking/capacity and payments/reconciliation slices
   before deploying payment endpoints. Keep payment activation disabled until
   provider smoke checks pass.
3. Apply and validate operations/lifecycle, then privacy/analytics. Each slice
   must pass its focused PostgreSQL suite before dependent frontend or functions
   deploy.
4. Deploy and independently type-check the new standalone functions plus the
   extended Stripe webhook. Keep workshop publication and payment activation
   disabled.
5. Configure Stripe test Product/Price sync, webhook events, Mailgun sandbox,
   schedules, public origin, rate limits, and approved Venmo destination.
6. Deploy CRM management, create test workshops, validate media, lifecycle,
   roster, retention-policy administration, financials, and public SSR/SEO
   without enabling live payments.
7. Enable Stripe/Venmo in a non-production/test context and execute the full
   capacity/payment/refund/reschedule/waitlist smoke matrix.
8. Publish representative production events only after business content,
   cancellation terms, privacy/legal retention, analytics taxonomy, and
   provider settings are approved.
   A human-approved retention-policy version must be active and identify
   operational, communication, financial, dispute, and audit periods plus
   correctable, minimizable, and retained fields before personal-data
   minimization is enabled. No default active policy is deployed.
   Record a trusted-confirmation-to-CRM visibility test proving the booking is
   available to the CRM within 30 seconds.
9. With PayPal deployment still available for rollback, run and record
   pre-retirement project-payment regression checks for configured direct-Venmo
   deadlines/reminders, Stripe, cash, check, obligation allocation, historical
   provider facts, and manual reconciliation.
10. Remove PayPal UI/runtime branches, obsolete runtime secrets, and
   PayPal-specific deployments only after explicit regression approval. Retain
   historical database facts.
11. Run post-retirement workshop/payment smoke checks and verify generated
   bundles, frontend behavior, configuration, and deployed functions contain no
   active PayPal SDK/order/capture/webhook path.

Rollback is flag-first: unpublish affected occurrences or close registration,
disable workshop Stripe/Venmo settings, stop scheduled workshop processors, and
retain all bookings/financials for reconciliation. Frontend public/CRM routes
can be reverted independently after registration is closed. Database tables are
not dropped during rollback. If the Stripe webhook extension must be rolled
back, first disable new workshop checkout and reconcile all received provider
events; preserve the provider event ledger and exceptions.

## Complexity Tracking

No constitution violations require justification.
