# Tasks: Workshop Events and Booking

**Input**: Design documents from `/specs/011-workshop-booking/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md),
[research.md](./research.md), [data-model.md](./data-model.md),
[contracts/workshop-system.md](./contracts/workshop-system.md), and
[quickstart.md](./quickstart.md)

**Tests**: Include Karma/Jasmine tests for every changed Angular component,
service, repository, route policy, SEO helper, and analytics workflow. Include
focused PostgreSQL integration checks for migration, RLS, functions, capacity,
booking, payment, lifecycle, and financial contracts. Never create an automated
test or harness that targets, imports, invokes, or simulates a Supabase Edge
Function; independently type-check each affected function and document sandbox
smoke validation instead.

**Organization**: Tasks are grouped by user story so each story can be
implemented and validated as a meaningful increment after the foundation.

## Phase 1: Setup

**Purpose**: Capture the brownfield baseline, create implementation boundaries,
and lock down provider/deployment scope before schema or UI work.

- [X] T001 Record affected surfaces, approved public changes, preserved project/proposal/payment behavior, and the no-calendar boundary in `specs/011-workshop-booking/implementation-notes.md`
- [X] T002 [P] Inventory current workshop routes/components, CRM navigation, SEO/sitemap hooks, and analytics route/event policies in `specs/011-workshop-booking/implementation-notes.md`
- [X] T003 [P] Inventory active and dead PayPal SDK, order, capture, webhook, environment, and deployment references in `specs/011-workshop-booking/implementation-notes.md`
- [X] T004 [P] Record Stripe, Mailgun, Supabase, Venmo, scheduled-function, origin, and rate-limit environment contracts without secrets in `specs/011-workshop-booking/quickstart.md`
- [X] T005 Record the human-only commit/push boundary and planned review checkpoints in `specs/011-workshop-booking/implementation-notes.md`

---

## Phase 2: Foundational

**Purpose**: Establish shared types, capability boundaries, ordered additive
migration/test scaffolding, and the catalog/media foundation required by the
first vertical release slice.

**CRITICAL**: No user-story implementation begins until the catalog/media slice
passes its migration and RLS checkpoint. Later slices are applied only when
their dependent story begins.

- [X] T006 [P] Create shared workshop definition, series, occurrence, media, lifecycle, pre-tax minor-unit price, state tax rate, and public-projection types in `src/app/core/models/workshop.ts`
- [X] T007 [P] Create shared hold, booking, attendee, adjustment, reschedule, waitlist, customer-status, personal-data-request, replacement-email-verification, and retention-policy lifecycle types in `src/app/core/models/workshop-booking.ts`
- [X] T008 [P] Create shared workshop transaction, exception, expense, summary, and reporting types in `src/app/core/models/workshop-financial.ts`
- [X] T009 [P] Define the catalog/media slice tables, constraints, indexes, shared workshop audit events, pre-booking public projections, and storage policies in `supabase/schemas/public/tables/workshop_definitions.sql`, `supabase/schemas/public/tables/workshop_series.sql`, `supabase/schemas/public/tables/workshop_occurrences.sql`, `supabase/schemas/public/tables/workshop_media.sql`, `supabase/schemas/public/tables/workshop_stripe_price_versions.sql`, `supabase/schemas/public/tables/workshop_audit_events.sql`, and `supabase/schemas/storage/workshop_media.sql`
- [X] T010 [P] Define the booking/capacity slice tables, constraints, indexes, and private defaults in `supabase/schemas/public/tables/workshop_seat_holds.sql`, `supabase/schemas/public/tables/workshop_bookings.sql`, `supabase/schemas/public/tables/workshop_attendees.sql`, and `supabase/schemas/public/tables/workshop_booking_adjustments.sql`
- [X] T011 [P] Define the payments/reconciliation slice tables, immutable-history constraints, indexes, private receipt boundary, and financial projection in `supabase/schemas/public/tables/workshop_payment_attempts.sql`, `supabase/schemas/public/tables/workshop_payment_transactions.sql`, `supabase/schemas/public/tables/workshop_payment_provider_events.sql`, `supabase/schemas/public/tables/workshop_payment_exceptions.sql`, `supabase/schemas/public/tables/workshop_expenses.sql`, and `supabase/schemas/public/views/workshop_financial_entries.sql`
- [X] T012 [P] Define the operations/lifecycle and privacy/analytics slice tables with reschedule/waitlist state, communication immutability, digest-only grants, verified requests, approval/activation/retirement actors and timestamps, immutable policy content, controlled `active -> retired`, and fully immutable retired rows in `supabase/schemas/public/tables/workshop_reschedule_responses.sql`, `supabase/schemas/public/tables/workshop_waitlist_entries.sql`, `supabase/schemas/public/tables/workshop_waitlist_offers.sql`, `supabase/schemas/public/tables/workshop_communications.sql`, `supabase/schemas/public/tables/workshop_analytics_outcome_grants.sql`, `supabase/schemas/public/tables/workshop_personal_data_requests.sql`, and `supabase/schemas/public/tables/workshop_data_retention_policies.sql`
- [X] T013 [P] Define separate CRM catalog, operations, financial, privacy, optional facade, public, and booking repository interfaces and dependency direction in `src/app/core/supabase/repositories/workshop-catalog-repository.service.ts`, `src/app/core/supabase/repositories/workshop-operations-repository.service.ts`, `src/app/core/supabase/repositories/workshop-financial-repository.service.ts`, `src/app/core/supabase/repositories/workshop-privacy-repository.service.ts`, `src/app/core/supabase/repositories/workshop-admin-facade.service.ts`, `src/app/core/supabase/repositories/workshop-public-repository.service.ts`, and `src/app/core/supabase/repositories/workshop-booking-repository.service.ts`
- [X] T014 Add per-slice internal-read, function-only mutation, anonymous-deny, public-projection, service-role, and storage RLS/grant policies, including retention-policy mutation restricted to active CRM users assigned the existing `admin` role in `public.user_roles` while active `staff` users remain read-only, to `supabase/schemas/public/tables/workshop_*.sql` and `supabase/schemas/storage/workshop_media.sql`
- [X] T015 Assemble five ordered additive migrations with no backward references and slice-local schema, constraints, triggers, indexes, RLS, grants, functions, projections, data preservation, and rollback notes in `supabase/migrations/20260729000000_workshop_catalog_media.sql`, `supabase/migrations/20260729001000_workshop_booking_capacity.sql`, `supabase/migrations/20260729002000_workshop_payments_reconciliation.sql`, `supabase/migrations/20260729003000_workshop_operations_lifecycle.sql`, and `supabase/migrations/20260729004000_workshop_privacy_analytics.sql`
- [X] T016 Create matching ordered PostgreSQL suites covering slice schema presence, migration application, RLS, anonymous denial, role boundaries, storage, immutable ledgers, digest-only analytics grants, verified requests, and controlled retention-policy retirement in `supabase/tests/workshop_catalog_media.sql`, `supabase/tests/workshop_booking_capacity.sql`, `supabase/tests/workshop_payments_reconciliation.sql`, `supabase/tests/workshop_operations_lifecycle.sql`, and `supabase/tests/workshop_privacy_analytics.sql`
- [X] T017 [P] Add reusable Angular workshop fixtures and Supabase client spies in `src/app/core/testing/workshop-testing.ts`
- [X] T018 [P] Add shared safe error-code mapping, input bounds, currency/date normalization, and token-redaction helpers in `src/app/core/services/workshop-validation.service.ts`
- [X] T019 Validate migration dependency order, apply only the catalog/media slice, run `supabase/tests/workshop_catalog_media.sql`, and record commands/results in `specs/011-workshop-booking/implementation-notes.md`

**Checkpoint**: The catalog/media slice applies cleanly, its base tables are
private, public projections are minimal, shared Angular contracts compile, and
later migration slices remain unapplied until their release gates.

---

## Phase 3: User Story 1 - Publish a Bookable Workshop (Priority: P1)

**Goal**: The florist can create, preview, validate, publish, update, and safely
retire a single workshop occurrence with media and Stripe catalog readiness.

**Independent Test**: Create a draft with required content/media/schedule,
exercise DST validation, sync a Product/Price, publish it, inspect the public
projection, edit it, and verify destructive deletion is blocked after history.

### Tests for User Story 1

- [X] T020 [P] [US1] Add PostgreSQL checks for definition/occurrence CRUD, publication validation, unique slugs, required hero/address/terms, pre-tax non-negative minor-unit prices, tax-state snapshots, DST rejection/offset selection, and deletion guards in `supabase/tests/workshop_catalog_media.sql`
- [X] T021 [P] [US1] Add Karma/Jasmine tests for catalog/occurrence repository mapping, validation errors, facade delegation, and replay-safe commands in `src/app/core/supabase/repositories/workshop-catalog-repository.service.spec.ts` and `src/app/core/supabase/repositories/workshop-admin-facade.service.spec.ts`
- [X] T022 [P] [US1] Add Karma/Jasmine tests for image validation, upload ordering, alt text, public/private bucket use, and cleanup failures in `src/app/core/supabase/services/workshop-media.service.spec.ts`
- [X] T023 [P] [US1] Add Karma/Jasmine tests for the CRM workshop list/editor publication, preview, catalog-state, and delete/archive decisions in `src/app/components/private/workshops/workshops.component.spec.ts` and `src/app/components/private/workshops/workshop-editor/workshop-editor.component.spec.ts`

### Implementation for User Story 1

- [X] T024 [US1] Implement occurrence scheduling validation, definition/occurrence save, publish, archive, delete-guard, public listing projection, and audit commands in `supabase/schemas/public/functions/save_workshop_occurrence.sql`, `supabase/schemas/public/functions/publish_workshop_occurrence.sql`, and `supabase/migrations/20260729000000_workshop_catalog_media.sql`
- [X] T025 [P] [US1] Implement typed CRM definition, occurrence, publication, preview, and catalog-state access in `src/app/core/supabase/repositories/workshop-catalog-repository.service.ts`, with component-facing composition only in `src/app/core/supabase/repositories/workshop-admin-facade.service.ts`
- [X] T026 [P] [US1] Implement public hero/gallery upload, ordering, replacement, and protected receipt-path safeguards in `src/app/core/supabase/services/workshop-media.service.ts`
- [X] T027 [US1] Implement the standalone authenticated Stripe Product/immutable Price synchronization function in `supabase/edge_functions/manage-workshop-catalog/index.ts`
- [ ] T028 [US1] Independently type-check `supabase/edge_functions/manage-workshop-catalog/index.ts` and document Product reuse, Price versioning, idempotency, role denial, and provider-failure sandbox evidence in `specs/011-workshop-booking/implementation-notes.md`
- [X] T029 [P] [US1] Add `/admin/workshops` and occurrence editor/detail routes without modifying the calendar route in `src/app/app.routes.ts`
- [X] T030 [P] [US1] Add the Workshops CRM navigation item and active-state coverage in `src/app/shared/components/private/sidebar/sidebar.component.ts` and `src/app/shared/components/private/sidebar/sidebar.component.spec.ts`
- [X] T031 [US1] Implement the CRM workshop list, empty/error/loading states, preview, status filters, safe delete/archive actions, and catalog readiness in `src/app/components/private/workshops/workshops.component.ts`, `src/app/components/private/workshops/workshops.component.html`, and `src/app/components/private/workshops/workshops.component.scss`
- [X] T032 [US1] Implement the accessible definition/occurrence editor, media gallery controls, fixed-New-York automatic offset resolution, publication validation, and material-change warning in `src/app/components/private/workshops/workshop-editor/workshop-editor.component.ts`, `src/app/components/private/workshops/workshop-editor/workshop-editor.component.html`, and `src/app/components/private/workshops/workshop-editor/workshop-editor.component.scss`

**Checkpoint**: A florist can independently publish one valid occurrence, and
the database public projection exposes it without customer or CRM data.

---

## Phase 4: User Story 2 - Generate and Maintain a Workshop Series (Priority: P1)

**Goal**: The florist can generate multiple independently manageable occurrences
from shared content and apply previewed changes without overwriting exceptions.

**Independent Test**: Generate three dates, override one venue/price/media value,
bulk-update selected future dates, and verify each occurrence remains separately
bookable and auditable.

### Tests for User Story 2

- [X] T033 [P] [US2] Add PostgreSQL checks for multi-date generation, command replay, independent occurrence identity, override preservation, booked-occurrence warnings, and selected/all-future update scopes in `supabase/tests/workshop_catalog_media.sql`
- [X] T034 [P] [US2] Add Karma/Jasmine tests for series generation, affected-occurrence preview, selection scopes, and override indicators in `src/app/components/private/workshops/workshop-editor/workshop-editor.component.spec.ts`
- [X] T035 [P] [US2] Add Karma/Jasmine repository tests for series commands and generated occurrence mapping in `src/app/core/supabase/repositories/workshop-catalog-repository.service.spec.ts`

### Implementation for User Story 2

- [X] T036 [US2] Implement atomic series generation, selected-occurrence bulk update, all-future filtering, override preservation, and booked-occurrence audit commands in `supabase/schemas/public/functions/generate_workshop_series_occurrences.sql`, `supabase/schemas/public/functions/apply_workshop_series_update.sql`, and `supabase/migrations/20260729000000_workshop_catalog_media.sql`
- [X] T037 [US2] Extend typed series create/preview/update methods in `src/app/core/supabase/repositories/workshop-catalog-repository.service.ts`
- [X] T038 [US2] Implement date-entry, generated-occurrence preview, update-scope selection, override badges, and booked-occurrence confirmation in `src/app/components/private/workshops/workshop-editor/workshop-editor.component.ts` and `src/app/components/private/workshops/workshop-editor/workshop-editor.component.html`
- [X] T039 [US2] Add series/occurrence relationship and exception presentation to the CRM list in `src/app/components/private/workshops/workshops.component.ts` and `src/app/components/private/workshops/workshops.component.html`

**Checkpoint**: Series generation is efficient while every occurrence remains an
independent record with preserved exceptions and history.

---

## Phase 5: User Story 3 - Discover an Upcoming Workshop (Priority: P1)

**Goal**: Customers can browse a manual accessible carousel and complete
date-ordered vertical list, then open a stable detail page while retaining the
private-workshop inquiry path.

**Independent Test**: Seed published/open occurrences with available and
sold-out capacity, plus closed, past, draft, cancelled, rescheduled, and
featured occurrences; verify only eligible future events appear once in order,
retained status details remain directly reachable, and the empty state preserves
the inquiry CTA.

### Tests for User Story 3

- [X] T040 [P] [US3] Add PostgreSQL checks for listing/detail projection eligibility, ordering, featured ordering, resolved media, derived availability bands, cancelled/rescheduled-source exclusion from upcoming results, direct retained status-page visibility, and private-field exclusion in `supabase/tests/workshop_catalog_media.sql`
- [X] T041 [P] [US3] Add Karma/Jasmine tests for public listing/detail repository result mapping, not-found, and redirect outcomes in `src/app/core/supabase/repositories/workshop-public-repository.service.spec.ts`
- [X] T042 [P] [US3] Replace workshop page tests with carousel, vertical-order, separators, reduced-motion, empty-state, inquiry-CTA, loading, and failure coverage in `src/app/components/public/workshops/workshops.component.spec.ts`
- [X] T043 [P] [US3] Add detail-page tests for persisted lifecycle plus derived open/limited/sold-out/waitlist availability, completed, directly accessed cancelled/rescheduled, not-found, gallery, terms, and reserve/waitlist actions in `src/app/components/public/workshop-detail/workshop-detail.component.spec.ts`

### Implementation for User Story 3

- [X] T044 [US3] Implement minimized public listing and single-occurrence projection functions with pre-booking availability in catalog/media and booking-aware derived availability after the capacity slice, plus cancelled/rescheduled-source exclusion and direct retained status/redirect behavior, in `supabase/schemas/public/functions/get_public_workshop_listing.sql`, `supabase/schemas/public/functions/get_public_workshop_occurrence.sql`, `supabase/migrations/20260729000000_workshop_catalog_media.sql`, and `supabase/migrations/20260729001000_workshop_booking_capacity.sql`
- [X] T045 [P] [US3] Implement typed anonymous public projection access in `src/app/core/supabase/repositories/workshop-public-repository.service.ts`
- [X] T046 [P] [US3] Add the stable public workshop detail route and preserve `/workshops` routing order in `src/app/app.routes.ts` (superseded by the series/date route refinement in T156)
- [X] T047 [US3] Refactor the existing Workshops component to load dynamic featured/upcoming data while preserving the private inquiry destination in `src/app/components/public/workshops/workshops.component.ts`
- [X] T048 [US3] Replace the workshop page template with the manual promotional carousel, subtle date-ordered vertical list, separators, empty/error/loading states, and private inquiry CTA in `src/app/components/public/workshops/workshops.component.html`
- [X] T049 [US3] Implement responsive, reduced-motion, keyboard-focus, and image-loading styles without a calendar or dense card grid in `src/app/components/public/workshops/workshops.component.scss`
- [X] T050 [US3] Implement the public occurrence detail component and lifecycle-specific presentation in `src/app/components/public/workshop-detail/workshop-detail.component.ts`, `src/app/components/public/workshop-detail/workshop-detail.component.html`, and `src/app/components/public/workshop-detail/workshop-detail.component.scss`
- [X] T051 [US3] Add public workshop listing/detail route and inquiry-path regression coverage in `src/app/app.routes.spec.ts`

**Checkpoint**: Public discovery and details are useful and accessible without
booking infrastructure, customer accounts, analytics, or a calendar.

---

## Phase 6: User Story 4 - Reserve Seats and Pay Securely (Priority: P1)

**Goal**: Customers can atomically reserve one or more seats and complete Stripe
Checkout or direct Venmo handoff without overbooking, false confirmation,
duplicate money effects, amount drift, or any PayPal runtime, while existing
project direct-Venmo timing and reconciliation remain intact.

**Independent Test**: Exercise success, abandonment, expiry, final-seat races,
late Stripe/Venmo payment, mismatched Venmo, method switching, duplicate payment,
cancellation race, forged return, replayed/out-of-order provider events,
pre-tax subtotal/tax/total Stripe/Venmo parity, and project Venmo regression.

### Tests for User Story 4

- [x] T052 [P] [US4] Add PostgreSQL capacity and amount tests for concurrent holds, quantity limits, pre-tax `unit minor × quantity` subtotals, selected-state tax, final totals, effective cutoff, one active method, expiration, release, and never-overbook invariants in `supabase/tests/workshop_booking_capacity.sql`
- [x] T053 [P] [US4] Add PostgreSQL reconciliation tests for Stripe/Venmo total parity, trusted completion time, delayed/replayed/out-of-order Stripe events, late capacity, cancellation races, duplicate cross-method money, and exact-once booking/transaction effects in `supabase/tests/workshop_payments_reconciliation.sql`
- [x] T054 [P] [US4] Add PostgreSQL direct Venmo tests for 24-hour/capped holds, safe references, on-time confirmation, late payment, underpayment, overpayment, missing reference, superseded instructions, and external resolution in `supabase/tests/workshop_venmo_reconciliation.sql`
- [x] T055 [P] [US4] Add Karma/Jasmine tests for booking API/service mapping, status-token redaction, clean public paths, generic status-access recovery, token invalidation/rotation, endpoint-specific request mapping, and safe errors in `src/app/core/supabase/repositories/workshop-booking-repository.service.spec.ts` and `src/app/core/supabase/services/workshop-booking.service.spec.ts`
- [x] T056 [P] [US4] Add Karma/Jasmine tests for reservation validation/provider handoff, booking-status clean navigation, expired-link recovery, generic request response, and no token URL/persistent-storage exposure in `src/app/components/workshop-booking/workshop-reservation/workshop-reservation.component.spec.ts` and `src/app/components/workshop-booking/workshop-booking-status/workshop-booking-status.component.spec.ts`
- [x] T057 [P] [US4] Update project payment component and service tests to require direct Venmo only, preserve configured deadlines/reminders/obligation allocation/pending reconciliation, reject workshop seat-release copy, and fail on PayPal SDK/order/capture behavior in `src/app/components/payment-access/payment-options/payment-options.component.spec.ts` and `src/app/core/supabase/services/customer-payment.service.spec.ts`

### Implementation for User Story 4

- [x] T058 [US4] Apply and validate the booking/capacity slice, then implement atomic hold creation, effective expiry, method switching, attempt supersession, hold release, booking-status projection, qualifying deadline rules, and replay-safe token rotation in `supabase/schemas/public/functions/create_workshop_seat_hold.sql`, `supabase/schemas/public/functions/switch_workshop_payment_method.sql`, `supabase/schemas/public/functions/expire_workshop_holds.sql`, `supabase/schemas/public/functions/rotate_workshop_status_token.sql`, `supabase/migrations/20260729001000_workshop_booking_capacity.sql`, and `supabase/tests/workshop_booking_capacity.sql`
- [x] T059 [US4] Apply and validate the payments/reconciliation slice, then implement Stripe provider-event ingestion and atomic reconciliation covering async failure, expiry, late success, duplicate payment, cancellation races, and unmatched money in `supabase/schemas/public/functions/reconcile_workshop_stripe_event.sql`, `supabase/migrations/20260729002000_workshop_payments_reconciliation.sql`, and `supabase/tests/workshop_payments_reconciliation.sql`
- [x] T060 [US4] Implement direct Venmo receipt, mismatch, late-payment, duplicate-payment, and external-refund exception commands in `supabase/schemas/public/functions/record_workshop_venmo_receipt.sql`, `supabase/schemas/public/functions/resolve_workshop_payment_exception.sql`, and `supabase/migrations/20260729002000_workshop_payments_reconciliation.sql`
- [x] T061 [P] [US4] Implement typed public booking/status/recovery/customer-action calls with generic recovery responses and secrets excluded from logs and URLs in `src/app/core/supabase/repositories/workshop-booking-repository.service.ts`
- [x] T062 [P] [US4] Implement reservation orchestration, idempotency keys, provider handoff, and single-purpose `bb.workshop.pendingAnalyticsOutcome` session storage/clearing without persistent or URL exposure in `src/app/core/supabase/services/workshop-booking.service.ts`
- [x] T063 [US4] Implement the thin standalone booking endpoint for origin/rate/input validation, hold creation, payment choice, Stripe Session creation, and direct-Venmo handoff only; delegate every durable transition to authoritative database commands in `supabase/edge_functions/create-workshop-booking/index.ts`
- [x] T064 [US4] Extend the existing signed Stripe webhook to route allowlisted workshop metadata, retrieve authoritative provider facts, and preserve project-payment routing in `supabase/edge_functions/stripe-payment-webhook/index.ts`
- [x] T065 [US4] Implement the standalone token-scoped booking-access endpoint for status resolution and generic recovery, plus the separate due-hold expiration processor, each delegating durable state changes to database commands, in `supabase/edge_functions/manage-workshop-booking-access/index.ts` and `supabase/edge_functions/expire-workshop-holds/index.ts`
- [ ] T066 [US4] Independently type-check `supabase/edge_functions/create-workshop-booking/index.ts`, `supabase/edge_functions/manage-workshop-booking-access/index.ts`, `supabase/edge_functions/stripe-payment-webhook/index.ts`, and `supabase/edge_functions/expire-workshop-holds/index.ts` and record Stripe/Venmo/status-recovery/expiry sandbox evidence in `specs/011-workshop-booking/implementation-notes.md`
- [x] T067 [P] [US4] Add tokenized reservation and booking-status routes with analytics/search exclusion metadata in `src/app/app.routes.ts`
- [x] T068 [US4] Implement the reservation quantity/contact/terms review and payment-choice UI in `src/app/components/workshop-booking/workshop-reservation/workshop-reservation.component.ts`, `src/app/components/workshop-booking/workshop-reservation/workshop-reservation.component.html`, and `src/app/components/workshop-booking/workshop-reservation/workshop-reservation.component.scss`
- [x] T069 [US4] Implement processing, confirmed, pending Venmo, expired, cancelled, refunded, action-required, privacy-verification, and proposed-email pending/confirmed/expired status UI plus confirmed grant capture, clean public-workshop CTA, generic expired-link recovery, session clearing, and accessible feedback in `src/app/components/workshop-booking/workshop-booking-status/workshop-booking-status.component.ts`, `src/app/components/workshop-booking/workshop-booking-status/workshop-booking-status.component.html`, and `src/app/components/workshop-booking/workshop-booking-status/workshop-booking-status.component.scss`
- [x] T070 [US4] Wire reserve actions from the public detail page into the tokenized hold flow without placing customer or booking data in public URLs in `src/app/components/public/workshop-detail/workshop-detail.component.ts` and `src/app/components/public/workshop-detail/workshop-detail.component.html`
- [x] T071 [US4] Remove PayPal SDK loading, button rendering, order/capture handoff, and `paypal_order` model branches while retaining project direct-Venmo configured deadlines/reminders/obligation allocation/manual reconciliation plus Stripe, cash, and check in `src/app/components/payment-access/payment-options/payment-options.component.ts`, `src/app/core/supabase/services/customer-payment.service.ts`, and `src/app/core/models/payment-request.ts`
- [x] T072 [US4] Remove PayPal order creation code and `paypal_venmo` active-attempt creation while preserving historical reads and direct Venmo in `supabase/edge_functions/create-payment-checkout/index.ts` and `supabase/schemas/public/functions/reserve_payment_checkout.sql`
- [ ] T073 [US4] Execute and record pre-retirement regression approval while PayPal remains available for rollback, covering project direct-Venmo configured deadlines/reminders/manual reconciliation/obligation allocation, Stripe, cash, check, and historical PayPal reads in `specs/011-workshop-booking/implementation-notes.md`
- [ ] T074 [US4] After T073 approval, update provider enums/constraints and deployment configuration so new records cannot use PayPal, retire `supabase/edge_functions/capture-venmo-order/` and `supabase/edge_functions/paypal-payment-webhook/`, and preserve historical `source='paypal'` records through `supabase/migrations/20260729002000_workshop_payments_reconciliation.sql`, `supabase/schemas/public/tables/payment_checkout_attempts.sql`, and `supabase/schemas/public/tables/payment_provider_events.sql`
- [ ] T075 [US4] Execute post-retirement Stripe, workshop/project direct-Venmo, project Stripe/cash/check, PayPal-absence bundle/config/deployment scans, final-seat, expiry, duplicate, and late-payment smoke scenarios and record evidence in `specs/011-workshop-booking/implementation-notes.md`
- [X] T195 [US1] [US4] Refine workshop pricing to collect pre-tax seat price plus RI/CT/MA tax state, snapshot subtotal/tax/total for bookings, show the reserve-page breakdown, and send Stripe Checkout advertising line, workshop date, location, subtotal, tax, and total in `src/app/components/private/workshops/workshop-editor/workshop-editor.component.*`, `src/app/components/workshop-booking/workshop-reservation/workshop-reservation.component.*`, `supabase/edge_functions/create-workshop-booking/index.ts`, and `supabase/migrations/20260826000000_workshop_pre_tax_pricing.sql`
- [X] T196 [US3] [US4] Tighten public workshop responsive typography and hero/list layout so laptop featured/detail copy cannot exceed the image presentation, tablet/mobile detail heroes lose their boxed translucent treatment, and `/workshops` phone cards keep upcoming titles horizontal in `src/app/components/public/workshops/workshops.component.*`, `src/app/components/public/workshop-detail/workshop-detail.component.*`, `src/app/components/workshop-booking/workshop-reservation/workshop-reservation.component.scss`, `src/app/components/public/workshop-terms-and-conditions/workshop-terms-and-conditions.component.scss`, and `src/app/components/workshop-booking/workshop-booking-status/workshop-booking-status.component.scss`
- [X] T197 [US3] Preserve the workshop detail hero image as an intrinsic 16:9 asset, bound side-by-side hero copy below the image height, keep mobile/tablet hero sections transparent but padded, further reduce the `/workshops` mobile upcoming heading, and render included-material line breaks in `src/app/components/public/workshop-detail/workshop-detail.component.*` and `src/app/components/public/workshops/workshops.component.scss`

**Checkpoint**: Workshop checkout is secure and exactly-once, direct Venmo is
manual and auditable, and no active payment surface invokes PayPal.

---

## Phase 7: User Story 5 - Manage Attendees and Event Operations (Priority: P2)

**Goal**: The florist can operate rosters, manual/complimentary reservations,
partial cancellations, check-in, bounded waitlists, verified personal-data
correction/minimization, customer actions, and message delivery without
corrupting capacity, privacy, or financial history.

**Independent Test**: Populate all booking/payment/attendance states, perform
manual and partial adjustments, exercise bounded/capped reduced waitlist offers,
process authorized and unauthorized correction/minimization, check in attendees,
verify financial preservation/audit redaction, export a minimized roster, and
recover from or suppress delivery.

### Tests for User Story 5

- [x] T076 [P] [US5] Add PostgreSQL checks for manual/complimentary reservations, partial/full cancellation, attendee check-in, minimized roster projection, status-token/current-email-link personal-data verification, insufficient-identity denial, proposed-email confirmation, policy active-admin/staff-denial lifecycle, controlled retirement, no-active-policy denial, correction/minimization, deferral, suppression, immutable financial preservation, audit exclusion, and idempotency in `supabase/tests/workshop_operations_lifecycle.sql` and `supabase/tests/workshop_privacy_analytics.sql`
- [x] T077 [P] [US5] Add PostgreSQL checks for FIFO waitlist entry, 24-hour default and 1–72-hour bounds, registration/start caps, reduced-quantity offers, exact-boundary/late rejection, acceptance, decline, expiry, exactly-once queue advancement, capacity protection, and replay in `supabase/tests/workshop_operations_lifecycle.sql`
- [x] T078 [P] [US5] Add PostgreSQL checks for communication claiming, idempotency, retryable/permanent outcomes, and booking-state independence in `supabase/tests/workshop_operations_lifecycle.sql`
- [x] T079 [P] [US5] Add Karma/Jasmine tests for roster filters/counts, manual reservations, partial cancellation, check-in, waitlist offers, minimized export, personal-data pending-verification/verified/deferred/denied/completed states, replacement-email pending confirmation, no-active-policy behavior, safe reason presentation, privacy-policy draft/review/approval/activation/retirement confirmations and errors, and route authorization that allows an active existing `admin` while denying active `staff` and inactive `admin` in `src/app/components/private/workshops/workshop-roster/workshop-roster.component.spec.ts`, `src/app/components/private/workshops/workshop-data-retention-policy/workshop-data-retention-policy.component.spec.ts`, and `src/app/core/guards/workshop-retention-policy-admin.guard.spec.ts`
- [x] T080 [P] [US5] Add repository tests for operations/roster/waitlist/communication mapping and separately for verified personal-data requests, proposed-email confirmation, retention-policy authorization, immutable content/controlled retirement, and correction/minimization in `src/app/core/supabase/repositories/workshop-operations-repository.service.spec.ts`, `src/app/core/supabase/repositories/workshop-privacy-repository.service.spec.ts`, and `src/app/core/supabase/repositories/workshop-booking-repository.service.spec.ts`

### Implementation for User Story 5

- [x] T081 [US5] Apply and validate operations/lifecycle before privacy/analytics; implement roster/manual booking/cancellation/check-in commands in the operations slice and verified personal-data/retention-policy/correction/minimization commands in the privacy slice in `supabase/schemas/public/functions/manage_workshop_roster.sql`, `supabase/schemas/public/functions/manage_workshop_personal_data.sql`, `supabase/schemas/public/functions/manage_workshop_data_retention_policy.sql`, `supabase/migrations/20260729003000_workshop_operations_lifecycle.sql`, `supabase/migrations/20260729003100_workshop_roster_operations.sql`, `supabase/migrations/20260729004000_workshop_privacy_analytics.sql`, `supabase/migrations/20260729004100_workshop_retention_policy_commands.sql`, and `supabase/migrations/20260729004200_workshop_personal_data_commands.sql`
- [x] T082 [US5] Implement FIFO join, bounded/capped offer deadlines, reduced-quantity offer, timely accept, exact-boundary/late reject, decline/expire, and exactly-once queue-advance commands in `supabase/schemas/public/functions/manage_workshop_waitlist.sql`, `supabase/migrations/20260729003000_workshop_operations_lifecycle.sql`, and `supabase/migrations/20260729003200_workshop_waitlist_commands.sql`
- [x] T083 [US5] Implement communication queue, replacement-status-link delivery, current-address privacy verification and proposed-email confirmation queueing/cancellation/expiry, skip-locked claim, outcome recording, retry, and privacy-request suppression commands in `supabase/schemas/public/functions/manage_workshop_communications.sql`, `supabase/migrations/20260729003000_workshop_operations_lifecycle.sql`, `supabase/migrations/20260729004000_workshop_privacy_analytics.sql`, and `supabase/migrations/20260729004050_workshop_communication_queue.sql`
- [x] T084 [US5] Implement roster/manual reservation/attendee/waitlist/cancellation/export operations in `src/app/core/supabase/repositories/workshop-operations-repository.service.ts`, implement verified request/policy/deferment/correction/minimization operations in `src/app/core/supabase/repositories/workshop-privacy-repository.service.ts`, and expose only cross-capability view orchestration through `src/app/core/supabase/repositories/workshop-admin-facade.service.ts`
- [x] T085 [US5] Extend token-scoped cancellation and waitlist actions through the booking-access boundary, and implement current-address request verification plus replacement-email confirmation in the separate privacy endpoint, in `supabase/edge_functions/manage-workshop-booking-access/index.ts`, `supabase/edge_functions/verify-workshop-personal-data/index.ts`, and `src/app/core/supabase/repositories/workshop-booking-repository.service.ts`
- [x] T086 [US5] Implement the standalone Mailgun queue processor for confirmation/status-recovery/waitlist/current-address privacy verification/proposed-email confirmation messages with single-purpose expiry, cancellation, local validation, bounded retries, suppression, and redacted outcomes in `supabase/edge_functions/process-workshop-messages/index.ts`
- [ ] T087 [US5] Independently type-check `supabase/edge_functions/process-workshop-messages/index.ts` and `supabase/edge_functions/verify-workshop-personal-data/index.ts`; record confirmation, replacement-access, current-address privacy verification, proposed-email confirmation, expiry/cancellation, waitlist, retry, provider-failure, and at-least-100-message evidence that 99% of normal confirmations are provider-accepted within two minutes in `specs/011-workshop-booking/implementation-notes.md`
- [x] T088 [US5] Implement the CRM roster and privacy-policy UI against the operations and privacy repositories through only the thin admin facade where cross-capability display composition is required, including the existing-`admin` privacy route guard and active-`staff` denial, in `src/app/app.routes.ts`, `src/app/core/guards/workshop-retention-policy-admin.guard.ts`, `src/app/core/supabase/repositories/workshop-admin-facade.service.ts`, `src/app/components/private/workshops/workshop-roster/workshop-roster.component.ts`, `src/app/components/private/workshops/workshop-roster/workshop-roster.component.html`, `src/app/components/private/workshops/workshop-roster/workshop-roster.component.scss`, `src/app/components/private/workshops/workshop-data-retention-policy/workshop-data-retention-policy.component.ts`, `src/app/components/private/workshops/workshop-data-retention-policy/workshop-data-retention-policy.component.html`, and `src/app/components/private/workshops/workshop-data-retention-policy/workshop-data-retention-policy.component.scss`
- [x] T089 [US5] Integrate roster and operational summaries into occurrence detail in `src/app/components/private/workshops/workshop-occurrence-detail/workshop-occurrence-detail.component.ts` and `src/app/components/private/workshops/workshop-occurrence-detail/workshop-occurrence-detail.component.html`

**Checkpoint**: The florist can operate an event end to end with accurate
capacity and minimized customer data.

---

## Phase 8: User Story 6 - Control the Workshop Lifecycle (Priority: P2)

**Goal**: The florist can perform valid lifecycle transitions, cancel or
reschedule booked events, collect transfer consent, and preserve public/history
behavior.

**Independent Test**: Traverse every state, attempt invalid transitions,
cancel with active payments, reschedule booked customers through
accept/decline/nonresponse, and validate public status retention/redirects.

### Tests for User Story 6

- [X] T090 [P] [US6] Add PostgreSQL checks for every allowed/forbidden persisted occurrence transition, proof that available/limited/sold-out/waitlist-available are derived and never stored in lifecycle status, manual-close precedence, passed-event review, and audit history in `supabase/tests/workshop_operations_lifecycle.sql`
- [X] T091 [P] [US6] Add PostgreSQL checks for cancellation hold invalidation, pending-customer queueing, race-payment exceptions, refund-control preservation, and waitlist closure in `supabase/tests/workshop_operations_lifecycle.sql`
- [X] T092 [P] [US6] Add PostgreSQL checks for reschedule replacement linkage, protected capacity, token expiry, accept/decline/nonresponse, no silent transfer, and original URL retention in `supabase/tests/workshop_operations_lifecycle.sql`
- [X] T093 [P] [US6] Add Karma/Jasmine tests for lifecycle actions, invalid-state messaging, cancellation preview, reschedule response tracking, and completion review in `src/app/components/private/workshops/workshop-occurrence-detail/workshop-occurrence-detail.component.spec.ts`
- [X] T094 [P] [US6] Add customer reschedule action tests for accept, decline, expiry, replay, and safe unavailable outcomes in `src/app/components/workshop-booking/workshop-booking-status/workshop-booking-status.component.spec.ts`

### Implementation for User Story 6

- [X] T095 [US6] Implement persisted draft/open/closed/rescheduled/cancelled/completed/archived lifecycle transitions, separately derived availability, completion review, archive rules, and transition audit in `supabase/schemas/public/functions/transition_workshop_occurrence.sql` and `supabase/migrations/20260729003000_workshop_operations_lifecycle.sql`
- [X] T096 [US6] Implement occurrence cancellation with immediate hold invalidation, checkout-expiration queueing, customer communication, and race-payment exception behavior in `supabase/schemas/public/functions/cancel_workshop_occurrence.sql` and `supabase/migrations/20260729003000_workshop_operations_lifecycle.sql`
- [X] T097 [US6] Implement replacement occurrence, protected capacity, response-token, accept/decline/expire, and florist nonresponse-resolution commands in `supabase/schemas/public/functions/manage_workshop_reschedule.sql`, `supabase/migrations/20260729003000_workshop_operations_lifecycle.sql`, and the additive command companion `supabase/migrations/20260729003300_workshop_reschedule_commands.sql`
- [X] T098 [US6] Extend lifecycle, cancellation, reschedule, response, and completion-review operations in `src/app/core/supabase/repositories/workshop-operations-repository.service.ts`
- [X] T099 [US6] Extend tokenized customer status/actions for reschedule acceptance and cancellation/refund request through `supabase/edge_functions/manage-workshop-booking-access/index.ts` and `src/app/core/supabase/repositories/workshop-booking-repository.service.ts`
- [X] T100 [US6] Implement lifecycle controls, affected-customer/capacity previews, cancellation confirmation, reschedule dashboard, and follow-up queue in `src/app/components/private/workshops/workshop-occurrence-detail/workshop-occurrence-detail.component.ts`, `src/app/components/private/workshops/workshop-occurrence-detail/workshop-occurrence-detail.component.html`, and `src/app/components/private/workshops/workshop-occurrence-detail/workshop-occurrence-detail.component.scss`
- [X] T101 [US6] Implement customer reschedule accept/decline/nonresponse presentation without automatic transfer or money movement in `src/app/components/workshop-booking/workshop-booking-status/workshop-booking-status.component.ts` and `src/app/components/workshop-booking/workshop-booking-status/workshop-booking-status.component.html`

**Checkpoint**: Lifecycle changes are explicit, capacity-safe, customer-aware,
and historically/publicly consistent.

---

## Phase 9: User Story 7 - Track Workshop Financials (Priority: P2)

**Goal**: The florist can reconcile immutable workshop revenue, technically
eligible refunds, fees, disputes, corrections, and expenses at
occurrence/series level for future reporting.

**Independent Test**: Record Stripe and Venmo receipts, eligible and
ineligible/concurrent refunds, a dispute, fees, complimentary seats, corrections,
and expenses; verify refunds never implicitly change capacity and event/series
summaries and exports have zero unexplained variance.

### Tests for User Story 7

- [X] T102 [P] [US7] Add PostgreSQL checks for immutable transactions and Stripe refund actor/trusted-charge/balance/amount/currency/replay/concurrency/provider-failure eligibility, refund-without-seat-change, fees, disputes, corrections, external Venmo facts, duplicate prevention, and historical price snapshots in `supabase/tests/workshop_payments_reconciliation.sql`
- [X] T103 [P] [US7] Add PostgreSQL checks for occurrence/series revenue, expense, net summaries, normalized dashboard projection, private receipt evidence, and attendee-field exclusion in `supabase/tests/workshop_payments_reconciliation.sql`
- [X] T104 [P] [US7] Add Karma/Jasmine tests for financial summary mapping, expense validation, refund technical-eligibility states and confirmation, no implicit seat cancellation, dispute flags, exception resolution, and export fields in `src/app/core/supabase/repositories/workshop-financial-repository.service.spec.ts` and `src/app/components/private/workshops/workshop-financials/workshop-financials.component.spec.ts`

### Implementation for User Story 7

- [X] T105 [US7] Implement immutable transaction append, deterministic Stripe refund technical eligibility/request-state with no capacity effect, external Venmo refund, dispute/reversal, correction, exception-resolution, and financial summary commands in `supabase/schemas/public/functions/manage_workshop_financials.sql` and `supabase/migrations/20260729002000_workshop_payments_reconciliation.sql`
- [X] T106 [US7] Implement expense create/correct, private evidence reference, occurrence/series aggregation, and normalized dashboard projection in `supabase/schemas/public/functions/manage_workshop_expenses.sql`, `supabase/schemas/public/views/workshop_financial_entries.sql`, and `supabase/migrations/20260729002000_workshop_payments_reconciliation.sql`
- [X] T107 [US7] Implement the standalone authenticated, idempotent partial/full Stripe refund request function with actor, trusted-charge, remaining-balance, amount, currency, duplicate, and no-capacity-effect validation in `supabase/edge_functions/refund-workshop-payment/index.ts`
- [X] T108 [US7] Extend the Stripe webhook for refund, fee, dispute, and reversal facts without altering project-payment behavior in `supabase/edge_functions/stripe-payment-webhook/index.ts`
- [ ] T109 [US7] Independently type-check `supabase/edge_functions/refund-workshop-payment/index.ts` and the updated `supabase/edge_functions/stripe-payment-webhook/index.ts` and record eligible/ineligible/concurrent partial/full refund, no-capacity-effect, dispute, and provider-failure sandbox evidence in `specs/011-workshop-booking/implementation-notes.md`
- [X] T110 [US7] Implement summaries, expenses, refund requests, external refunds, disputes, exceptions, and exports in `src/app/core/supabase/repositories/workshop-financial-repository.service.ts`, exposing only cross-capability display composition through `src/app/core/supabase/repositories/workshop-admin-facade.service.ts`
- [X] T111 [US7] Implement occurrence/series financial summaries, expense/evidence entry, refund eligibility/balance/currency/reason confirmation with no implicit seat cancellation, exception controls, immutable history, and reporting export in `src/app/components/private/workshops/workshop-financials/workshop-financials.component.ts`, `src/app/components/private/workshops/workshop-financials/workshop-financials.component.html`, and `src/app/components/private/workshops/workshop-financials/workshop-financials.component.scss`

**Checkpoint**: Workshop profitability is reproducible from immutable source
facts and ready for a future unified dashboard.

---

## Phase 10: User Story 8 - Measure the Public Workshop Funnel (Priority: P3)

**Goal**: Measure allowlisted public workshop discovery and booking intent while
preserving every existing analytics privacy and excluded-route boundary.

**Independent Test**: Exercise every permitted milestone and redeem a
first-confirmed-status outcome grant under allowed and excluded
consent/region/host/route contexts; verify atomic single use, no reissue, safe
parameters, no blocked replay, and zero GA on payment/tokenized/private contexts.

### Tests for User Story 8

- [X] T112 [P] [US8] Add typed event/page-category and low-cardinality parameter tests for workshop milestones in `src/app/core/analytics/analytics-sanitizer.service.spec.ts` and `src/app/core/analytics/analytics.models.ts`
- [X] T113 [P] [US8] Add dynamic public workshop route coverage, tokenized-route exclusion, raw URL/query/fragment rejection, and content-ID allowlist tests in `src/app/core/analytics/analytics-route-policy.service.spec.ts` (route shape refined in T156)
- [X] T114 [P] [US8] Add exact-once carousel/list/detail/reservation/checkout client tests plus session handoff, clean-path client-to-Edge request mapping, redeem/discard/clear behavior, duplicate/expired/forged/unavailable outcomes, cross-tab behavior, blocked-no-replay behavior, and raw-grant absence from durable storage/cookies/URLs/logs/errors/audit/analytics in `src/app/core/analytics/website-analytics.service.spec.ts` and `src/app/core/supabase/services/workshop-booking.service.spec.ts`
- [X] T115 [P] [US8] Add public-detail analytics integration tests for outcome redemption/clearing with no customer/payment identifiers in `src/app/components/public/workshop-detail/workshop-detail.component.spec.ts`

### Implementation for User Story 8

- [X] T116 [US8] Add allowlisted workshop page categories, event names, parameter schemas, and public content-ID normalization in `src/app/core/analytics/analytics.models.ts` and `src/app/core/analytics/analytics-sanitizer.service.ts`
- [X] T117 [US8] Extend workshop detail classification while denying tokenized booking/status/payment routes by default in `src/app/core/analytics/analytics-route-policy.service.ts` and `src/app/app.routes.ts`
- [X] T118 [US8] Apply and validate the privacy/analytics slice; add at-most-one trusted-confirmation outcome eligibility without changing payment invariants, implement database-only digest registration/redemption/discard/expiry commands, extend booking access for first-confirmed-status raw-grant issuance, implement the thin standalone hash-to-digest redemption endpoint, and add typed client pending-outcome redemption/clearing in `supabase/schemas/public/functions/manage_workshop_analytics_outcome.sql`, `supabase/migrations/20260729004000_workshop_privacy_analytics.sql`, `supabase/tests/workshop_privacy_analytics.sql`, `supabase/edge_functions/manage-workshop-booking-access/index.ts`, `supabase/edge_functions/redeem-workshop-analytics-outcome/index.ts`, `src/app/core/analytics/website-analytics.service.ts`, and `src/app/core/supabase/services/workshop-booking.service.ts`
- [X] T119 [US8] Instrument carousel/list selection, detail view, reservation start, provider choice, checkout handoff, and public-detail analytics redemption/clearing in `src/app/components/public/workshops/workshops.component.ts`, `src/app/components/public/workshop-detail/workshop-detail.component.ts`, and `src/app/components/workshop-booking/workshop-reservation/workshop-reservation.component.ts`
- [X] T120 [US8] Independently re-type-check `supabase/edge_functions/manage-workshop-booking-access/index.ts` and type-check `supabase/edge_functions/redeem-workshop-analytics-outcome/index.ts`; execute the permitted/opted-out/GPC/region/internal/host/tokenized/payment/CRM analytics matrix plus one-time grant expiry/replay/redaction and Edge-hash/digest-only database-call checks, recording network, state, and parameter evidence in `specs/011-workshop-booking/implementation-notes.md`

**Checkpoint**: The workshop funnel is measurable without weakening the approved
privacy boundary or exposing customer/payment data.

---

## Phase 11: User Story 9 - Find a Workshop Through Search (Priority: P3)

**Goal**: Every eligible occurrence has accurate SSR-visible metadata, Event
structured data, canonical status, internal links, and sitemap lifecycle.

**Independent Test**: Validate listing, open, sold-out, completed, cancelled,
rescheduled, redirected, and unpublished cases with server output, sitemap, and
recognized Event rich-result inspection.

### Tests for User Story 9

- [X] T121 [P] [US9] Add Event JSON-LD tests for scheduled, sold-out, completed, cancelled, and rescheduled facts including offsets, address, offers, availability, and previous start date in `src/app/core/seo/jsonld.service.spec.ts`
- [X] T122 [P] [US9] Add dynamic title/description/canonical/social/robots cleanup and route-transition tests in `src/app/core/seo/seo.service.spec.ts` and `src/app/core/seo/seo-route-listener.service.spec.ts`
- [X] T123 [P] [US9] Add deterministic Node assertions and a package runner for workshop sitemap inclusion/exclusion, retention, redirects, duplicates, and meaningful `lastmod` values in `scripts/generate-sitemap.spec.cjs` and `package.json`
- [X] T124 [P] [US9] Add public detail SSR metadata/structured-data lifecycle tests in `src/app/components/public/workshop-detail/workshop-detail.component.spec.ts`

### Implementation for User Story 9

- [X] T125 [US9] Extend JSON-LD cleanup and add Event schema generation matching visible workshop status, venue, time offset, imagery, offer, and replacement facts in `src/app/core/seo/jsonld.service.ts`
- [X] T126 [US9] Extend SEO metadata handling for dynamic workshop canonical/social/robots states and remove stale metadata across route transitions in `src/app/core/seo/seo.service.ts` and `src/app/core/seo/seo-route-listener.service.ts`
- [X] T127 [US9] Apply occurrence-specific SEO and JSON-LD to server-rendered listing/detail lifecycle outcomes in `src/app/components/public/workshops/workshops.component.ts` and `src/app/components/public/workshop-detail/workshop-detail.component.ts`
- [X] T128 [US9] Extend sitemap generation to fetch eligible workshop slugs, completed Past Workshops, active 12-month status pages, and meaningful modification dates while excluding redirects/drafts/token routes in `scripts/generate-sitemap.cjs`
- [X] T129 [US9] Configure SSR/server route behavior for dynamic workshop details and permanent retention redirects in `src/app/app.config.server.ts` and `src/server.ts`
- [ ] T130 [US9] Validate representative URLs with server-rendered output, sitemap inspection, Search Console URL inspection, and Event rich-result tooling and record results in `specs/011-workshop-booking/implementation-notes.md`

**Checkpoint**: Search engines and customers receive the same accurate event
facts throughout each public lifecycle.

---

## Phase 12: Polish and Cross-Cutting Validation

**Purpose**: Close security, performance, accessibility, provider, deployment,
and brownfield regression gates across the completed feature.

- [x] T131 [P] Add cross-story Angular tests for loading/error/empty/replay states and raise meaningful affected-code coverage toward 80% in `src/app/core/testing/workshop-testing.spec.ts`
- [x] T132 [P] Add cross-slice PostgreSQL abuse, request-bound, command-key collision, unauthorized actor, status-token replay, analytics digest-only, personal-data verification, retention-policy authorization/immutability, deferred minimization, and audit-redaction checks in `supabase/tests/workshop_booking_capacity.sql`, `supabase/tests/workshop_payments_reconciliation.sql`, `supabase/tests/workshop_operations_lifecycle.sql`, and `supabase/tests/workshop_privacy_analytics.sql`
- [x] T133 Audit all five migration slices for dependency order, no backward references, least privilege, search paths, grants, token digests, raw analytics-grant exclusion, verified personal-data requests, admin policy mutation, staff denial, controlled retirement, immutable facts, secret exclusion, data preservation, and slice-local rollback in `supabase/migrations/20260729000000_workshop_catalog_media.sql`, `supabase/migrations/20260729001000_workshop_booking_capacity.sql`, `supabase/migrations/20260729002000_workshop_payments_reconciliation.sql`, `supabase/migrations/20260729003000_workshop_operations_lifecycle.sql`, and `supabase/migrations/20260729004000_workshop_privacy_analytics.sql`
- [x] T134 Verify every affected Edge Function is standalone, has no `_shared` or cross-function local import, has no automated Edge Function test/harness, and independently type-checks; record results in `specs/011-workshop-booking/implementation-notes.md`
- [x] T135 [P] Optimize public image sizes, lazy loading, carousel rendering, query indexes, and list/detail projections; add a representative fixture of at least 500 occurrences and 5,000 bookings, validate the CRM occurrence list and a 100-row roster page each complete data retrieval and usable rendering within 2 seconds at p95 in a documented environment, and record results in `specs/011-workshop-booking/implementation-notes.md` using `src/app/core/testing/workshop-scale-fixtures.ts`, `src/app/components/public/workshops/workshops.component.html`, `src/app/components/public/workshop-detail/workshop-detail.component.html`, `supabase/migrations/20260729000000_workshop_catalog_media.sql`, and `supabase/migrations/20260729003000_workshop_operations_lifecycle.sql`
- [ ] T136 [P] Complete keyboard, screen-reader, reduced-motion, 200% zoom, mobile viewport, focus/error announcement, and no-calendar accessibility checks in `src/app/components/public/workshops/`, `src/app/components/public/workshop-detail/`, and `src/app/components/workshop-booking/`
- [ ] T137 [P] Verify CRM dark/light theme, responsive layout, destructive confirmations, and table/dialog focus in `src/app/components/private/workshops/`, then document timed usability acceptance with at least five florist attempts per single-occurrence/five-date-series workflow and twenty customer attempts per discovery/payment-handoff workflow, validating SC-001 through SC-003 and recording build, start/end rules, device/viewport, time, assistance, outcome, and sanitized observations in `specs/011-workshop-booking/implementation-notes.md`
- [x] T138 Run the full Karma/Jasmine suite and coverage command and record results in `specs/011-workshop-booking/implementation-notes.md`
- [ ] T139 Run the production Angular/SSR build and sitemap generation and record output, warnings, and Core Web Vital comparison in `specs/011-workshop-booking/implementation-notes.md`
- [x] T140 Run the complete PostgreSQL migration/RLS/function/financial integration suite and record results in `specs/011-workshop-booking/implementation-notes.md`
- [ ] T141 Execute all Stripe, Mailgun, Venmo, scheduling, SEO, analytics, accessibility, privacy-policy, and PayPal-retirement smoke gates from `specs/011-workshop-booking/quickstart.md`, including timestamped proof that trusted confirmation becomes visible to an authorized CRM read within 30 seconds
- [x] T142 Verify existing private-workshop inquiry, unrelated public routes, proposal access, Canva PDF upload, project payments, historical payment display, CRM modules, and calendar placeholder regression behavior in `specs/011-workshop-booking/implementation-notes.md`
- [x] T143 Document production migration order, provider flags, schedules, webhook configuration, authorized CRM retention-policy drafting/approval/activation/retirement and human-approved active version with no default activation, legal/privacy/content approvals, flag-first rollback, and pending-payment reconciliation in `specs/011-workshop-booking/quickstart.md`
- [x] T144 Prepare a human-operated source-control handoff with change summary, migration/deployment order, validation evidence, rollback notes, and suggested commit message in `specs/011-workshop-booking/implementation-notes.md`
- [X] T145 [US1] Refine Create Workshop tests for automatic slugs, fixed New York offset resolution, independent occurrence schedule rows, and invalid-publish tooltips in `src/app/components/private/workshops/workshop-editor/workshop-editor.component.spec.ts`
- [X] T146 [US1] Refine Create Workshop UX with placeholders, generated slugs, 50-state selection, fixed U.S./New York assumptions, add/remove occurrence rows, and inquiry-style required-field feedback in `src/app/components/private/workshops/workshop-editor/workshop-editor.component.ts`, `src/app/components/private/workshops/workshop-editor/workshop-editor.component.html`, and `src/app/components/private/workshops/workshop-editor/workshop-editor.component.scss`
- [X] T147 [US1] Polish Create Workshop layout, media grouping, occurrence removal spacing, currency presentation, and action padding; remove redundant preview/validation summaries and enforce Stripe, direct-Venmo, waitlist, and carousel capabilities in `src/app/components/private/workshops/workshop-editor/workshop-editor.component.ts`, `src/app/components/private/workshops/workshop-editor/workshop-editor.component.html`, `src/app/components/private/workshops/workshop-editor/workshop-editor.component.scss`, and `src/app/components/private/workshops/workshop-editor/workshop-editor.component.spec.ts`
- [X] T148 [US1] Align Create Workshop venue and pricing fields into responsive desktop rows, use Zipcode terminology, remove capability-explanation copy, and provide a tested editable default workshop-terms template in `src/app/components/private/workshops/workshop-editor/workshop-editor.component.ts`, `src/app/components/private/workshops/workshop-editor/workshop-editor.component.html`, `src/app/components/private/workshops/workshop-editor/workshop-editor.component.scss`, and `src/app/components/private/workshops/workshop-editor/workshop-editor.component.spec.ts`
- [X] T149 [US1] Repair first-image upload for new workshops by validating file/story inputs, automatically creating the reusable concept before storage upload, surfacing failures through the page alert and toast, and shortening the action label to Upload in `src/app/components/private/workshops/workshop-editor/workshop-editor.component.ts`, `src/app/components/private/workshops/workshop-editor/workshop-editor.component.html`, and `src/app/components/private/workshops/workshop-editor/workshop-editor.component.spec.ts`
- [X] T150 [US1] Support multi-file gallery selection with per-image alternative text and partial-batch safety, and move Stripe catalog readiness from Workshop Story to pricing with plain-language automatic-save guidance in `src/app/components/private/workshops/workshop-editor/workshop-editor.component.ts`, `src/app/components/private/workshops/workshop-editor/workshop-editor.component.html`, `src/app/components/private/workshops/workshop-editor/workshop-editor.component.scss`, and `src/app/components/private/workshops/workshop-editor/workshop-editor.component.spec.ts`
- [X] T151 [US1] Preserve alt-text input focus with stable pending-media tracking and expand Customer Preview with New York-local day-month-year and AM/PM time range formatting plus the effective uploaded hero/gallery presentation in `src/app/components/private/workshops/workshop-editor/workshop-editor.component.ts`, `src/app/components/private/workshops/workshop-editor/workshop-editor.component.html`, `src/app/components/private/workshops/workshop-editor/workshop-editor.component.spec.ts`, and the focused `workshop-customer-preview.component.{ts,html,scss,spec.ts}` files in the same directory
- [X] T152 [US1] Integrate CRM light/dark theme tokens across Create Workshop and Workshops administration, reuse the Floral Proposal Builder destructive X treatment, stage new definition owners as non-reusable until successful publication, retire reusable chooser options without deleting history, and verify selected concepts are reused without duplication in the workshop components, catalog repository/model/schema, `supabase/migrations/20260801000000_workshop_reusable_concept_lifecycle.sql`, and focused Angular/PostgreSQL coverage
- [X] T153 [US1] Restore Customer Preview to the compact card presentation, integrate the uploaded hero as its background header, restrict its small arrangement gallery to gallery-role media, omit that section when empty, and cover the resulting rendering/filter behavior in the workshop editor and customer-preview component tests
- [X] T154 [US1] Allocate collision-safe occurrence slugs at the database write boundary, align each schedule-row destructive control with its inputs, center the Customer Preview close icon, and cover slug collisions and preview rendering in the catalog PostgreSQL and focused Angular suites
- [X] T155 [US3] Restore only the original public Workshops photographic hero and introductory message before the new upcoming-workshop carousel/list, preserve the new discovery functionality, and cover content and ordering in the public Workshops component suite
- [X] T156 [US3] Remove the redundant upcoming-section heading, group featured carousel cards once per title-driven series, add canonical series and series/date public routes with date-specific reservation links, align public/SEO/analytics/status/sitemap projections, and cover the refactor in focused Angular, Node, and PostgreSQL tests
- [X] T157 [US3] Replace featured occurrence dates with per-series event counts, remove the public Workshop Details/inline-terms sidebar, restyle series/detail/reservation surfaces with the Privacy Policy floral-panel family, add a no-index occurrence-specific Workshop Terms & Conditions route linked only from the required reservation acceptance control, and cover the route, presentation, SEO, and terms-version handoff in focused Angular tests
- [X] T158 [US3] Restore the clean white series/occurrence detail presentation while retaining the compact floral reservation and terms flow, and add compact responsive reflow plus mobile safe-area support across detail, reservation, terms, and booking-status pages for representative Android, iPhone, tablet, laptop, and desktop widths
- [X] T159 [US4] Balance navbar-to-content page padding, widen and structure occurrence-specific terms clauses, split reservation names while preserving the combined booking contract, pair desktop name/contact controls, apply inquiry-style validation tooltips, widen the reservation surface, and clarify summary facts in `src/app/components/public/workshop-detail/`, `src/app/components/public/workshop-terms-and-conditions/`, `src/app/components/workshop-booking/workshop-reservation/`, and `src/styles.scss`
- [X] T160 [US4] Anchor reservation validation tooltips to their controls, redeem verified Stripe Checkout returns through the clean status route, retain the existing Venmo-pending and Stripe-confirmed outcomes, expose bounded half-capacity seat urgency, queue confirmation email exactly once on the verified booking transition, and refactor the CRM roster into a themed customer booking table with an Add Reservation modal in the workshop public/booking/roster components, standalone Edge Functions, declarative schema, and additive migrations `20260802010000_workshop_public_remaining_seats.sql` and `20260802011000_workshop_confirmation_delivery.sql`
- [X] T161 [US5] Refine the workshop roster by removing visible support references and redundant header copy, supporting bounded multi-seat cancellation, placing text/status filters plus minimized export beside Add Reservation, and presenting the waitlist as a responsive ordered customer queue in `src/app/components/private/workshops/workshop-roster/workshop-roster.component.ts`, `src/app/components/private/workshops/workshop-roster/workshop-roster.component.html`, `src/app/components/private/workshops/workshop-roster/workshop-roster.component.scss`, and `src/app/components/private/workshops/workshop-roster/workshop-roster.component.spec.ts`
- [X] T162 [US5] Bind the complete workshop roster surface to the CRM light/dark theme palette, remove the Customer bookings eyebrow, and flatten the filter/action toolbar while preserving its responsive layout in `src/app/components/private/workshops/workshop-roster/workshop-roster.component.html`, `src/app/components/private/workshops/workshop-roster/workshop-roster.component.scss`, and `src/app/components/private/workshops/workshop-roster/workshop-roster.component.spec.ts`
- [X] T163 [US5] Add Scheduled Seats and authoritative Available Seats metric cards between Active Seats and Checked In, backed by the occurrence operational-state projection and covered for values, ordering, and representative roster scale in `src/app/components/private/workshops/workshop-roster/workshop-roster.component.ts`, `src/app/components/private/workshops/workshop-roster/workshop-roster.component.html`, `src/app/components/private/workshops/workshop-roster/workshop-roster.component.scss`, `src/app/components/private/workshops/workshop-roster/workshop-roster.component.spec.ts`, and `src/app/core/testing/workshop-scale-performance.spec.ts`
- [X] T164 [US5] Split roster email and phone into dedicated columns, move bounded partial cancellation into a customer-specific modal, simplify and enlarge the waitlist heading, reduce card top padding, enforce white dark-mode Add Reservation text, and replace CSV export with a sanitized printable Word roster in `src/app/components/private/workshops/workshop-roster/workshop-roster.component.ts`, `src/app/components/private/workshops/workshop-roster/workshop-roster.component.html`, `src/app/components/private/workshops/workshop-roster/workshop-roster.component.scss`, and `src/app/components/private/workshops/workshop-roster/workshop-roster.component.spec.ts`
- [X] T165 Refine public workshop image framing, equalize the featured desktop panel, remove obsolete status-link recovery, repair reservation/Venmo encoding and secure status continuation, restyle direct-Venmo and roster cancellation controls, and brand project payment reminders in the public workshop, booking status, roster, and `process-payment-messages` boundaries with focused Angular and independent Deno verification
- [X] T166 [US3] [US5] Compact the roster cancellation modal/table and CRM workshop occurrence cards, remove redundant CRM promotional/provider copy, repair Public preview for the series/date route contract, restore the original independently sized Featured Workshop panel, and enlarge/title-case the public workshop detail presentation with focused and full Angular regression plus an isolated production build
- [X] T167 [US3] [US4] [US8] Move workshop privacy and retention administration into a guarded CRM Settings navigation boundary with legacy-route compatibility, apply CRM light/dark theme tokens to the policy screen, add equal top/bottom/left Featured Workshop image insets, and show a live quantity-based reservation total with focused/full Angular regression and an isolated production build
- [X] T168 [US4] Polish the live reservation total into a large inline label/amount treatment, remove redundant selected-seat copy, and make the pending direct-Venmo status reference-free with 24-hour florist contact guidance plus a blush workshop CTA, covered by focused/full Angular regression and an isolated production build
- [X] T169 [US3] [US4] [US5] Remove the unavailable-status workshop CTA, replace workshop background imagery, slightly increase CRM workshop-card padding, and expose authoritative direct-Venmo receipt confirmation from pending roster rows with discrepancy-safe financial review, covered by repository/component tests, representative roster-scale verification, the full Angular suite, and an isolated production build
- [X] T170 [US5] Refine roster actions with Cancel Seats before a spaced Confirm Venmo Payment control, invert primary-button text colors across CRM light/dark modes, exclude expired/cancelled bookings while retaining pending holds in the derived Active Seats metric, and normalize displayed U.S. phone numbers, covered by focused/full Angular regression and an isolated production build
- [X] T171 [US5] Enlarge the Confirm Venmo Payment modal title and add clear vertical separation between its payment-verification guidance and Venmo transaction controls without increasing the roster component stylesheet, covered by focused/full Angular regression and an isolated production build
- [X] T172 [US5] Beautify the workshop roster table, remove payment-state subtext below booking badges, and replace confirmed-order cancellation with bounded provider-aware partial refunds: Stripe refund requests reserve seats and release them only after verified webhook reconciliation, while florist-confirmed direct-Venmo refunds record money and release seats atomically, covered by repository/component/scale tests, additive declarative SQL plus migration, pgTAP scenarios, Deno checking, the full Angular suite, and an isolated production build
- [X] T173 [US3] [US4] Redesign the public workshop discovery, series, occurrence, and private-inquiry presentation; replace upcoming date links with rectangular See Details actions; soften pending-Venmo contact typography; and make Stripe charge, Checkout Session, and Payment Intent webhook ordering converge on one charge transaction through additive migration `20260815000000_workshop_stripe_event_idempotency.sql`, with focused Angular/pgTAP coverage, standalone Deno checking, full Angular regression, and an isolated production build
- [X] T174 [US3] Replace the blush/card-based workshop series and occurrence hero with a responsive editorial masthead, arched 16:9 image, and unboxed typographic when/where/per-seat rail; expand the private-workshop CTA with occasion and inquiry guidance; and cover the presentation with focused computed-style assertions, full Angular regression, and an isolated production build
- [X] T175 [US3] Refine the workshop series and occurrence hero into a balanced full-width editorial composition with the 16:9 image as its centerpiece and one attached deep-ink information band for when, where, per-seat, availability, and reservation actions; preserve the unboxed responsive hierarchy and validate it with focused/full Angular coverage plus an isolated production build
- [X] T176 [US3] Remove the workshop title block above the series and occurrence hero image while preserving the semantic page heading and workshop theme inside the attached information band, with focused Angular coverage and an isolated production build
- [X] T177 [US3] Remove the remaining visible workshop title from the series and occurrence hero information band, retain the name in the breadcrumb and an assistive-technology-only semantic heading, and compact the hero to its 16:9 image plus theme/facts/action band with focused Angular coverage and an isolated production build
- [X] T178 [US3] Place the deep-ink workshop details panel to the right of the 16:9 hero image on desktop, restore the title inside the panel, compact its title/fact/action hierarchy, and retain a clean stacked tablet/mobile fallback with focused Angular coverage and an isolated production build
- [X] T179 [US3] Stretch the desktop workshop side-details panel to the rendered height of its adjacent 16:9 hero image while preserving the stacked tablet/mobile layout, with focused computed-style coverage and an isolated production build
- [X] T180 [US3] Increase the shared series/occurrence hero composition by approximately 25 percent and add 30px of separation beneath its breadcrumb while preserving responsive stacking, with focused computed-style coverage and an isolated production build
- [X] T181 [US3] Increase the shared workshop hero's When, Where, and Per seat label/value typography while retaining the emphasized seat-price hierarchy, with focused computed-style coverage and an isolated production build
- [X] T182 [US1] [US3] [US4] [US5] [US6] [US7] Establish a feature-wide responsive layout contract across every public workshop, booking/status, CRM, and payment surface with container-aware reflow, phone safe areas, dense-table containment, dynamic modal bounds, ultrawide caps, a six-viewport Chrome matrix, full Angular regression, and an isolated production build
- [X] T183 [US4] Eliminate concurrent Stripe reconciliation `40P01` deadlocks by locking each existing payment attempt with `FOR NO KEY UPDATE` before inserting provider evidence, making simultaneous provider-event replay insertion conflict-safe, preserving unmatched-money evidence without an invalid foreign key, and delivering the correction through additive migration `20260816000000_workshop_stripe_reconciliation_lock_order.sql` with focused pgTAP contract and executable PostgreSQL validation
- [X] T184 [US3] Recompose the public workshops phone listing into full-width editorial event cards with overlaid date badges, touch-sized actions, and compact featured/private-inquiry presentation; reduce the shared series/occurrence mobile breadcrumb-to-hero gap to exactly 10px; and validate the change through focused regression, the six-viewport Chrome matrix, the full Angular suite, and an isolated production build
- [X] T185 [US3] Add a series-only View Upcoming Events button beneath the workshop hero facts that scrolls directly to and centers the existing Choose your date section in the viewport without changing the active workshop route or URL, respects reduced-motion preference, remains absent from dated occurrence pages, and is covered by focused/full Angular regression plus an isolated production build
- [X] T186 [US3] Distribute the workshop hero details vertically with space-between so a top-anchored heading group retains the theme label above the workshop title, the When/Where/Per seat facts grow into and space evenly across the available middle region, and the applicable View Upcoming Events or reservation action anchors the panel bottom across series and occurrence layouts
- [X] T187 [US4] Condense the confirmed workshop-booking status presentation, remove the Return to the workshop action, restructure its event facts into a Workshop/Location two-column first row and Date/Time/Seats booked three-column second row with a single-line full address, and expand the Becca email/phone support copy while preserving responsive reflow
- [X] T188 [US1] [US2] Add focused editor and catalog-repository tests for adding occurrences after initial creation, confirming unsaved-row removal, blocking saved occurrence deletion with booked reservations, and deleting reservation-free saved occurrences in `src/app/components/private/workshops/workshop-editor/workshop-editor.component.spec.ts` and `src/app/core/supabase/repositories/workshop-catalog-repository.service.spec.ts`
- [X] T189 [US1] [US2] Keep the Add workshop occurrence action inline with the single-date/series heading during edits, persist newly appended schedule rows against the established definition/series relationship, and provide confirmation-based unsaved and saved row removal in `src/app/components/private/workshops/workshop-editor/workshop-editor.component.ts` and `src/app/components/private/workshops/workshop-editor/workshop-editor.component.html`
- [X] T190 [US1] Add booking-count preflight through the catalog repository and a race-safe published-occurrence deletion guard in declarative SQL plus additive migration `supabase/migrations/20260820000000_workshop_occurrence_edit_management.sql`, with pgTAP success/guard coverage in `supabase/tests/workshop_catalog_media.sql` and `supabase/tests/workshop_booking_capacity.sql`
- [X] T191 [US1] [US2] Prevent Save and publish from redundantly publishing an established `published_open` occurrence while still publishing appended draft dates, with focused regression coverage in `src/app/components/private/workshops/workshop-editor/workshop-editor.component.ts` and `src/app/components/private/workshops/workshop-editor/workshop-editor.component.spec.ts`
- [X] T192 [US1] [US2] Group the CRM workshop catalog by stable definition concept so each concept renders once with all occurrence dates and per-date actions; atomically propagate edited concept copy and versioned terms across every occurrence while preserving occurrence-specific schedule, venue, capacity, and price through `update_workshop_concept`, additive migration `supabase/migrations/20260821000000_workshop_concept_updates.sql`, focused Angular/scale coverage, and pgTAP contracts
- [X] T193 [US5] [US7] Correct the Stripe roster-refund request to send persisted PaymentIntent (`pi_`) references through Stripe's `payment_intent` parameter and Charge (`ch_`) references through `charge`; reject unsupported references before durable request creation; and add redacted configuration/provider diagnostics to `supabase/edge_functions/refund-workshop-payment/index.ts`, with standalone Deno checking and focused roster/financial regression
- [X] T194 [US5] [US7] Preserve refund-request metadata while enriching Stripe refund webhooks with Checkout Session metadata; reconcile detached/replayed successful refund evidence idempotently; record asynchronous `refund.failed` outcomes without releasing seats; poll authoritative roster state after Stripe acceptance; and render green partially-refunded and red refunded badges through additive migration `supabase/migrations/20260821010000_workshop_refund_webhook_reconciliation.sql`, declarative functions, focused Angular coverage, pgTAP contracts, and standalone webhook type-checking
- [X] T195 [US3] [US4] Move featured carousel controls into the featured-copy panel below View workshop; remove the workshop payment-options UI and direct-Venmo handoff; require quantity, split name, email, phone, and terms acceptance; enforce Stripe-only public booking in Angular, the standalone booking Edge boundary, declarative SQL, and additive migration `20260901000000_workshop_stripe_only_checkout.sql`; preserve historical workshop and unrelated project Venmo facts; and validate with focused/full Angular, pgTAP, standalone Deno, and production-build checks
- [X] T198 [US4] Refine the public reservation summary so When and Where share the first facts row, the prominent total aligns beneath tax, the workshop title is smaller, and the title-case Raleway Continue to Secure Checkout action aligns right, with focused layout regression coverage and a production build
- [X] T199 [US3] Keep every featured-workshop hero inside an immutable 16:9 frame, prevent slide content from resizing the featured section, center carousel controls inside featured-copy, and cover the desktop/stacked layout invariants with focused Angular regression and a production build
- [X] T200 [US3] Remove every internal featured-workshop scrollbar, reserve enough copy space for the longest carousel slide, lower the centered controls within featured-copy, and preserve the immutable 16:9 media and stable section footprint with focused Angular regression and a production build
- [X] T201 [US3] Remove the excessive mobile gap between View workshop and the featured carousel controls, enlarge supporting text within mobile upcoming-date cards, right-align their image date badges, and preserve no-scroll, stable-height, centered-control, and 16:9 carousel invariants with focused responsive coverage and a production build
- [X] T202 [US4] [US5] Hide Booking limit and compact the reservation panel/checkout action on phones, enlarge non-heading reservation text by 50 percent on larger screens, add guarded permanent deletion of expired roster bookings through additive migration `20260908000000_workshop_expired_booking_deletion.sql`, restrict printable exports to confirmed bookings, and compact phone roster metrics into an ordered 3-by-2 grid with denser toolbar/table presentation, covered by focused Angular/repository tests, authored PostgreSQL coverage, and production-build validation
- [ ] T203 [US5] Execute the updated `supabase/tests/workshop_operations_lifecycle.sql` suite once the local Supabase Docker engine or an authorized PostgreSQL test connection is available
- [X] T204 [US5] Keep roster metrics in the specified ordered 3-by-2 layout throughout the full mobile responsive range through 900px, correct the higher-specificity shared container-query rules that reverted phone metrics and toolbar controls to one column, and cover the effective CSS cascade with focused responsive regression
- [X] T205 [US5] Remove the Keep Booking footer action from the expired-booking deletion dialog, retain close/backdrop dismissal, and add top spacing to the sole Permanently Delete action with focused modal regression coverage

---

## Dependencies and Execution Order

### Phase dependencies

```text
Setup
  └── Foundational
        ├── US1 Publish Workshop
        │     └── US2 Workshop Series
        ├── US3 Public Discovery
        └── US4 Secure Booking and Payment
              ├── US5 Event Operations
              ├── US6 Lifecycle
              └── US7 Financials

US3 + US4 ──> US8 Analytics
US3 + US6 ──> US9 Search
All selected stories ──> Polish and Cross-Cutting Validation
```

- Setup has no implementation dependency.
- Foundational establishes shared models, repository boundaries, all migration
  and test slice scaffolds, and applies only catalog/media. Each later story
  applies its required migration slice immediately before dependent code.
- US1, US3, and US4 may begin after Foundational with fixtures, but production
  public booking requires published US1 data and the US3 detail route.
- US2 depends on US1's reusable definition and occurrence commands.
- US5, US6, and US7 depend on US4 booking/payment records; US6 also uses US1
  occurrence lifecycle.
- US8 depends on US3 public surfaces and US4 booking-intent boundaries.
- US9 depends on US3 public pages and US6 retained lifecycle outcomes.
- Polish follows all stories selected for the release.

### Entity, repository, and contract ownership

| Story | Primary entities/contracts |
|---|---|
| US1 | Definition, occurrence, media, Stripe price version, publish/catalog commands; catalog repository |
| US2 | Series, generated occurrences, override/bulk-update commands; catalog repository |
| US3 | Public listing/detail projections and public routes |
| US4 | Holds, bookings, payment attempts/transactions/provider events/exceptions, analytics-outcome eligibility/grants, tokenized API |
| US5 | Attendees, adjustments, waitlist entries/offers, communications and roster/export in operations repository; personal-data requests and retention policies in privacy repository |
| US6 | Occurrence lifecycle, cancellation, replacement links, and reschedule responses in operations repository |
| US7 | Financial transactions, expenses, exceptions, summaries, and reporting projection in financial repository |
| US8 | Analytics route/event/sanitization and safe outcome-redemption orchestration contracts |
| US9 | SEO metadata, Event JSON-LD, SSR, sitemap, retention redirects |

## Parallel Execution Examples

### Foundational

```text
Parallel: T006, T007, T008 shared Angular model files
Parallel: T009, T010, T011, T012 declarative schema groups
Parallel: T013 storage policies and T017 Angular fixtures
Then: T014 -> T015 -> T016 -> T019
```

### User Story 1

```text
Parallel tests: T020, T021, T022, T023
Parallel implementation after DB contract: T025, T026, T029, T030
Sequential provider/UI chain: T024 -> T027 -> T028 and T031 -> T032
```

### User Story 2

```text
Parallel tests: T033, T034, T035
Then: T036 -> T037 -> T038
Parallel after series projection: T039
```

### User Story 3

```text
Parallel tests: T040, T041, T042, T043
After T044: T045 and T046 in parallel
Then: T047 -> T048 -> T049, while T050 can proceed in parallel after T045/T046
Finish: T051
```

### User Story 4

```text
Parallel tests: T052, T053, T054, T055, T056, T057
Database chain: T058 -> T059 -> T060
Parallel Angular/provider work: T061, T062, T063, T064, T065, T067
UI chain: T068 -> T069 -> T070
PayPal retirement chain: T071 -> T072 -> T073 -> T074
Finish: T066 and T075
```

### User Story 5

```text
Parallel tests: T076, T077, T078, T079, T080
Parallel database contracts: T081, T082, T083
Then: T084, T085, T086
Parallel UI/type-check: T087 and T088
Finish: T089
```

### User Story 6

```text
Parallel tests: T090, T091, T092, T093, T094
Parallel database contracts: T095, T096, T097
Then: T098 and T099
Parallel UI: T100 and T101
```

### User Story 7

```text
Parallel tests: T102, T103, T104
Parallel database contracts: T105 and T106
Provider chain: T107 -> T108 -> T109
Then: T110 -> T111
```

### User Story 8

```text
Parallel tests: T112, T113, T114, T115
Then: T116 and T117
Then: T118 -> T119
Finish: T120
```

### User Story 9

```text
Parallel tests: T121, T122, T123, T124
Parallel implementation: T125, T126, T128, T129
Then: T127
Finish: T130
```

## Implementation Strategy

### MVP-first delivery

The smallest administrative MVP is the first vertical slice: Setup,
Foundational, and **User Story 1**. A florist can create, validate, preview,
publish, update, and safely retire a single occurrence with a minimized public
projection. Only the catalog/media migration is applied, validating content,
media, schedule, RLS, migration order, repository separation, and Stripe catalog
foundation without accepting customer money.

### Incremental release sequence

1. Workshop creation and publishing: Setup + Foundational + US1 on the
   catalog/media slice.
2. Public listing and details: US3, still non-bookable behind provider flags.
3. Seat holds and Stripe/direct-Venmo booking: apply booking/capacity and
   payments/reconciliation, then complete US4 and PayPal retirement gates.
4. Series generation: US2 on the established catalog boundary.
5. Basic roster and lifecycle: apply operations/lifecycle, then complete the
   roster/check-in/cancellation core of US5 and US6.
6. Advanced operations, financials, analytics, and retained SEO: complete
   waitlists/rescheduling/privacy within US5/US6, US7, apply privacy/analytics
   for US8, and finish US9.
7. Cross-cutting release gates and human publication handoff.

### Safety rules

- Keep provider and publication flags disabled until their story checkpoint and
  quickstart smoke evidence pass.
- Write PostgreSQL and Angular tests before or alongside each story's
  implementation; never write an automated Edge Function test.
- Apply every declarative table change through its owning executable migration
  slice and pass the matching PostgreSQL suite before dependent code is enabled.
- Keep `create-workshop-booking` limited to hold/payment orchestration; use the
  status/recovery, privacy-verification, and analytics-outcome standalone
  endpoints for their respective purposes.
- Keep catalog, operations, financial, and privacy data access in separate
  repositories; the optional admin facade may orchestrate views but owns no
  domain rules.
- Keep public, tokenized customer, payment, and CRM routes logically separated.
- Preserve historical PayPal facts while removing only active PayPal runtime.
- Do not commit or push through an AI workflow.

## Refinement Validation (2026-09-08)

- Focused reservation, roster, and operations-repository Angular tests: 45/45 passed.
- Production build: passed; the roster component style bundle remains within its strict 9 kB budget at 8.96 kB.
- Mobile-breakpoint and effective-cascade roster regression: 33/33 focused tests passed after extending the ordered 3-by-2 grid through 900px and removing the conflicting shared phone overrides.
- Expired-booking deletion dialog refinement: 26/26 focused roster tests passed, including the single-action and 16px top-margin contract.
- Full Angular suite: 841/843 passed. The two failures reproduce in isolation in untouched workshop detail and booking-status tests and are unrelated to this refinement.
- PostgreSQL coverage was added to `supabase/tests/workshop_operations_lifecycle.sql`. Runtime execution remains pending because the local Supabase Docker engine is unavailable and the separate native PostgreSQL instance requires credentials not present in the workspace.
