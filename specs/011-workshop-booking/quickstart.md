# Quickstart: Workshop Events and Booking

**Branch**: `011-workshop-booking`  
**Date**: 2026-07-29

This is the implementation and release-validation sequence. Commands are
examples for the human/operator environment; do not commit or push through an
AI workflow.

## 1. Preconditions

- Use branch `011-workshop-booking`.
- Review [spec.md](./spec.md), [plan.md](./plan.md),
  [data-model.md](./data-model.md), and
  [contracts/workshop-system.md](./contracts/workshop-system.md).
- Confirm a local/test Supabase project is available.
- Keep workshop publication, Stripe, Venmo, analytics activation, and scheduled
  processors disabled initially.
- Record the approved public Venmo business destination outside source control.

Server-side environment contract (record names only, never values):

- Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
  `SUPABASE_SERVICE_ROLE_KEY`.
- Stripe: existing secret key/webhook secret plus the approved public
  success/cancel origins; workshop Product/Price IDs are persisted records, not
  source-controlled environment values.
- Mailgun: existing API key, sending domain/from identity, and webhook signing
  key.
- Direct Venmo: approved business destination comes from
  `payment_collection_settings`; no PayPal credential is part of the target
  workshop runtime.
- Public-boundary controls: exact allowed origin, per-purpose rate limits,
  provider environment, and token/grant digest secrets.
- Schedules: hold expiration at least once per minute and bounded message
  processing only after their functions and database commands are deployed.

## 2. Apply the database and storage design

Create and apply:

```text
supabase/migrations/20260729000000_workshop_catalog_media.sql
supabase/migrations/20260729001000_workshop_booking_capacity.sql
supabase/migrations/20260729002000_workshop_payments_reconciliation.sql
supabase/migrations/20260729002500_project_direct_venmo_payment_paths.sql
supabase/migrations/20260729002600_workshop_financial_commands.sql
supabase/migrations/20260729003000_workshop_operations_lifecycle.sql
supabase/migrations/20260729003100_workshop_roster_operations.sql
supabase/migrations/20260729003200_workshop_waitlist_commands.sql
supabase/migrations/20260729003250_workshop_customer_actions.sql
supabase/migrations/20260729003300_workshop_reschedule_commands.sql
supabase/migrations/20260729003350_workshop_reschedule_status.sql
supabase/migrations/20260729004000_workshop_privacy_analytics.sql
supabase/migrations/20260729004050_workshop_communication_queue.sql
supabase/migrations/20260729004100_workshop_retention_policy_commands.sql
supabase/migrations/20260729004200_workshop_personal_data_commands.sql
supabase/migrations/20260729004300_workshop_search_projection.sql
supabase/migrations/20260729004400_workshop_scheduled_jobs.sql
supabase/migrations/20260801000000_workshop_reusable_concept_lifecycle.sql
supabase/migrations/20260801001000_workshop_unique_slug_allocation.sql
supabase/migrations/20260802000000_workshop_public_series_routes.sql
supabase/migrations/20260802010000_workshop_public_remaining_seats.sql
supabase/migrations/20260802011000_workshop_confirmation_delivery.sql
supabase/migrations/20260815000000_workshop_stripe_event_idempotency.sql
supabase/migrations/20260816000000_workshop_stripe_reconciliation_lock_order.sql
supabase/schemas/public/tables/workshop_*.sql
supabase/schemas/public/functions/workshop_*.sql
supabase/schemas/storage/workshop_media.sql
supabase/tests/workshop_catalog_media.sql
supabase/tests/workshop_booking_capacity.sql
supabase/tests/workshop_payments_reconciliation.sql
supabase/tests/workshop_venmo_reconciliation.sql
supabase/tests/workshop_operations_lifecycle.sql
supabase/tests/workshop_privacy_analytics.sql
```

Migration order:

1. Catalog/media: content, series, occurrences, media, catalog versions, shared
   workshop audit events, pre-booking public projections, storage, policies,
   then the additive staged-to-reusable concept lifecycle refinement.
2. Booking/capacity: holds, bookings, attendees, adjustments, booking-aware
   availability projections, and atomic inventory commands.
3. Payments/reconciliation: attempts, transactions, provider events,
   exceptions, expenses, financial projection, and PayPal retirement changes.
   Apply the Stripe event-idempotency migration before deploying the matching
   `stripe-payment-webhook` revision so charge, Checkout Session, and Payment
   Intent deliveries converge on one authoritative charge transaction. Apply
   the reconciliation lock-order migration immediately afterward so concurrent
   variants serialize on the payment attempt before provider evidence takes a
   foreign-key lock, and simultaneous retries use conflict-safe event inserts.
4. Operations/lifecycle: communications, audit, roster, occurrence lifecycle,
   cancellation, rescheduling, and scheduled processors.
5. Privacy/analytics: outcome grants, personal-data requests, retention policy,
   privacy commands, and analytics digest commands.

Every migration must be additive and rerunnable in an existing environment.
Apply and validate each slice before its dependent application slice. No slice
may alter or delete project-payment or historical PayPal records.
Implementation-time resets may revise an unpromoted migration only in a
disposable environment. After a migration reaches any persistent shared or
production environment, never edit it; create a new additive timestamped
follow-up assigned to the same capability slice.

## 3. Run automated database validation

Run the repository's established Supabase/PostgreSQL test workflow against the
five matching files under `supabase/tests/`, in migration order. A slice must
pass before the next migration or dependent application code is enabled.

Required coverage:

- Anonymous denial on every base operational table.
- Internal-role read/write boundaries and non-admin denial.
- Public listing/detail projection field minimization.
- Draft/unpublished record exclusion.
- Cancelled/rescheduled source exclusion from upcoming listings while direct
  retained status pages remain available.
- Persisted lifecycle transition checks proving available, limited, sold-out,
  and waitlist-available remain derived values rather than occurrence statuses.
- Concurrent final-seat hold attempts.
- Effective expiry at normal duration, registration close, and workshop start.
- Stripe completion before expiry with delayed webhook arrival.
- Stripe completion after expiry with and without remaining capacity.
- Direct Venmo on-time, late, underpaid, overpaid, and missing-reference cases.
- Payment-method switching and duplicate cross-method payment.
- Cancellation race with active holds/in-flight payment.
- Full and partial booking cancellation.
- Dispute/reversal capacity preservation.
- Reschedule protected capacity, accept/decline/nonresponse.
- Partial-quantity waitlist offer and queue advancement.
- Nonexistent and repeated daylight-saving local times.
- Idempotent command/provider-event replay and out-of-order delivery.
- Financial immutability and exact event/series reconciliation.
- Public retention and redirect decisions.
- Analytics eligibility/digest registration/redeem/discard/expiry, proving the
  database never accepts, hashes, generates, returns, logs, or persists a raw
  grant.
- Personal-data request verification, retention-policy activation/versioning,
  no-active-policy denial, immutable active content with controlled retirement,
  and deferred email minimization prerequisites.

Do not invoke an Edge Function from database tests.

## 4. Implement and type-check standalone Edge Functions

Expected functions:

```text
create-workshop-booking
manage-workshop-booking-access
verify-workshop-personal-data
redeem-workshop-analytics-outcome
manage-workshop-catalog
refund-workshop-payment
expire-workshop-holds
process-workshop-messages
stripe-payment-webhook        # existing, extended in place
create-payment-checkout       # existing, PayPal branches removed
resolve-payment-request       # existing project regression boundary
```

For each affected directory:

- Confirm it contains all required application logic locally.
- Confirm it imports no `_shared` directory, other Edge Function, or local shared
  function module.
- Run standalone Deno type-checking.
- Do not create any unit, integration, endpoint, mock-runtime, or other automated
  test targeting an Edge Function.

## 5. Configure test provider settings

Required server-side settings include:

- Supabase URL and service-role key.
- Stripe restricted/secret key, webhook secret, merchant/account identity, and
  test-mode flag.
- Payment and workshop allowed production/test origins.
- Public application origin.
- Mailgun key, domain, sender, and webhook/signature settings.
- Approved direct Venmo business target.
- Rate-limit and request-size settings.

Never expose these in Angular environments except public non-secret identifiers
explicitly allowed by existing configuration. PayPal client ID, secret, merchant
ID, webhook ID, API origin, SDK configuration, and capture configuration must
not be required after retirement.

## 6. Build the Angular surfaces

Implement in reviewable slices:

1. Create typed models plus separate catalog, operations, financial, privacy,
   public, and booking repositories; keep the admin facade orchestration-only.
2. Apply catalog/media and implement CRM workshop creation/publishing.
3. Implement public listing and detail while booking remains disabled.
4. Apply booking/capacity and payments/reconciliation; implement thin
   booking/payment and status/recovery endpoints, then enable Stripe/direct
   Venmo only after their smoke gates.
5. Add series generation on the catalog repository.
6. Apply operations/lifecycle and implement basic roster, check-in,
   cancellation, and occurrence lifecycle.
7. Complete advanced waitlist/reschedule operations and financials.
8. Apply privacy/analytics; implement separate privacy-verification and
   analytics-outcome endpoints plus retention-policy administration.
9. Complete SEO/JSON-LD/sitemap retention behavior.
10. Perform application-wide PayPal UI/runtime removal only after its explicit
    pre-retirement regression gate.

Run:

```powershell
npm run test -- --watch=false --browsers=ChromeHeadless
npm run test:coverage
npm run build
```

The test suite must include focused tests for every touched component, service,
repository, route policy, SEO/JSON-LD method, analytics schema, and PayPal
removal boundary.

## 7. Stripe sandbox validation

Use Stripe test mode and Stripe CLI/manual provider inspection.

Validate:

- One reusable definition creates one Product and one active Price.
- Five same-price occurrences reuse that Price.
- Price change creates a new immutable Price without rewriting old bookings.
- Published `priceMinor` is the complete tax-inclusive required per-seat amount.
- For every tested quantity, subtotal and total equal `priceMinor × quantity`
  with no extra mandatory charge, and Stripe/direct Venmo totals match exactly.
- Each hold creates a distinct Checkout Session with the held quantity.
- Browser return without webhook remains processing.
- Signed webhook confirms exactly one booking/transaction/capacity effect.
- Measure from trusted confirmation persistence to an authorized CRM read and
  verify the confirmed booking is visible within 30 seconds; record both
  timestamps and the sanitized booking support reference.
- Duplicate, delayed, replayed, and out-of-order events remain idempotent.
- Concurrent Checkout Session, Payment Intent, and Charge success deliveries
  for one attempt complete without `40P01` deadlocks or duplicate money facts.
- Session expiration and local early cutoff release capacity within one minute.
- Late success never overbooks.
- Partial/full refunds are florist initiated and webhook reconciled.
- Dispute/reversal flags urgent action and retains capacity.
- Cancellation attempts to expire open Sessions; a race payment becomes an
  exception.
- Project-payment Stripe behavior still passes its existing smoke path.

Record evidence without retaining card details, raw webhook bodies, secrets, or
customer data.

## 8. Direct Venmo validation

In a controlled test:

- Verify every workshop and existing project Venmo action opens only the
  approved business target.
- For workshops, verify exact amount, safe reference, pending state, effective
  deadline, and seat-release outcome are shown.
- Verify the normal workshop hold is 24 hours and is capped by registration
  close/start.
- For existing projects, verify the configured deadline, reminders, obligation
  allocation, and manual-reconciliation state remain unchanged and no workshop
  seat-hold or seat-release language appears.
- Verify manual on-time confirmation.
- Verify late payment with/without remaining capacity.
- Verify underpayment, overpayment, and missing-reference exceptions.
- Verify switching from Venmo to Stripe marks instructions superseded.
- Verify duplicate cross-method money confirms only one booking.
- Verify external refunds are recorded as new immutable transactions.
- Verify no PayPal SDK, script, button, order, capture, credential, or webhook is
  loaded/called.

## 9. Mailgun and scheduling validation

- Queue confirmations, receipts, reminders, material-change messages,
  cancellation notices, reschedule prompts, waitlist offers, and refund notices.
- Verify normal accepted delivery within the two-minute target.
- Run at least 100 normal-provider confirmation messages, measure from durable
  queue time to provider acceptance, and verify at least 99% are accepted within
  two minutes. Record the batch size, denominator, timestamps, provider
  environment, and sanitized failures.
- Verify temporary failure retry and permanent-failure CRM visibility.
- Confirm message failure never changes booking/payment truth.
- Invoke scheduled hold expiration in a sandbox and verify bounded, skip-locked,
  idempotent batches.
- Confirm the one-minute expiration objective under expected load.

These are documented sandbox smoke checks, not automated Edge Function tests.

## 10. Public accessibility and UX validation

At desktop and mobile widths:

- Use carousel controls by keyboard and screen reader.
- Verify reduced motion disables automatic/unrequested movement.
- Confirm every featured item is also present in the ordered vertical list.
- Confirm separators, focus order, headings, labels, errors, and empty states.
- Test 200% zoom without lost content/actions.
- Test sold-out, registration-closed, waitlist, completed, cancelled, and
  rescheduled states.
- Confirm no calendar or dense card grid was introduced.
- Confirm private/custom workshop inquiry remains available.
- Confirm featured cards advertise the number of upcoming series events rather
  than one representative occurrence date.
- Confirm series/detail pages use the clean white-background presentation and
  contain no Workshop Details sidebar or inline terms. Confirm reservation and
  Workshop Terms pages retain the approved floral-background panel family and
  the reservation checkbox links to and accepts the exact occurrence terms
  version.
- At representative 360px and 390px phone, 768px tablet, 1366px laptop, and
  1920px desktop widths, confirm every non-listing workshop page uses the
  compact scale, has no horizontal page scrolling, preserves readable content
  and touch targets, and respects iPhone/Android safe-area insets.
- Confirm series, occurrence, reservation, and Workshop Terms content uses
  balanced top/bottom page padding below the normal-flow navbar. On desktop,
  confirm the terms title remains on one line, stored clause titles are bold
  and visually separated, the reserve panel accommodates long workshop titles,
  name and contact controls form two paired rows, summary facts scan cleanly,
  and invalid terms acceptance uses the inquiry-style tooltip.

Timed usability acceptance:

- Run at least five representative attempts to create/publish one occurrence;
  each must finish within five minutes, excluding image preparation.
- Run at least five representative attempts to create/publish a five-date
  series; each must finish within eight minutes, excluding image preparation.
- Run at least twenty representative customer discovery attempts; at least
  nineteen must find the correct event and identify its date, location, price,
  availability, and terms without assistance.
- Run at least twenty representative customer payment-handoff attempts using
  Stripe test mode and a non-paying Venmo fixture; at least nineteen must reach
  the selected option within three minutes without duplicate active attempts.
- Start from the documented route entry point and end at public eligibility or
  provider handoff as applicable. Record test date/build, device/viewport,
  scenario, completion time, assistance, outcome, and sanitized observations.

Representative CRM-scale acceptance:

- Load a documented test environment with at least 500 workshop occurrences and
  5,000 bookings using `src/app/core/testing/workshop-scale-fixtures.ts`.
- Measure both the CRM occurrence list and a 100-row roster page from data
  request start through usable rendering; each must complete within 2 seconds at
  p95.
- Record the environment, dataset shape, run count, measurement method, p95
  results, and any optimization applied in
  `specs/011-workshop-booking/implementation-notes.md`.

## 11. SEO and SSR validation

For listing, open, sold-out, completed, cancelled, and rescheduled pages:

- Inspect server-rendered visible content.
- Verify unique title, description, canonical, Open Graph, and Twitter data.
- Validate Event JSON-LD with a recognized rich-results tool.
- Confirm visible values and structured values agree.
- Confirm cancelled pages retain original identifying facts and status.
- Confirm rescheduled pages include replacement links and prior date facts.
- Verify completed Past Workshop permanence.
- Verify 12-month source-page retention and redirect behavior.
- Generate the sitemap and confirm eligible dynamic URLs and `lastmod` values.
- Confirm draft/unpublished/tokenized/status routes are absent and non-indexable.

## 12. Analytics validation

Exercise carousel selection, list selection, detail view, reservation start,
provider choice, checkout handoff, and safe confirmed outcome.

For the confirmed outcome:

- Verify trusted confirmation creates one eligibility row, the booking Edge
  Function generates and returns one opaque grant at the first confirmed-status
  resolution, Postgres registers only its digest, and later status resolutions
  do not recreate or reveal it.
- Verify the confirmed response includes only the clean canonical public
  workshop path, the status component places the raw grant only in
  `sessionStorage`, and navigation contains no token, query, or fragment.
- Verify the raw grant never appears in localStorage, IndexedDB, cookies, server
  persistence, database arguments, logs, errors, audit records, or analytics
  parameters. Inspect redemption and discard calls to prove the Edge Function
  hashes the grant and Postgres receives only the digest.
- Redeem it from an otherwise eligible public workshop route and verify the
  authoritative state accepts exactly one request within 24 hours.
- Verify duplicate, forged, expired, and cross-tab redemption returns the same
  unavailable result without disclosing booking state.
- Verify the public workshop detail component clears session state after
  successful redemption, blocked policy, expiry, duplicate, unavailable, and
  error outcomes.

For each permitted event:

- Verify exactly-once dispatch.
- Verify only allowlisted low-cardinality public context.
- Verify no names, emails, phone, attendee details, address, booking/payment
  reference, provider payload, raw URL, query, or fragment.

Repeat with:

- opt-out and GPC;
- non-US/unknown region;
- internal-browser marker;
- local/preview/staging host;
- CRM/auth routes;
- tokenized booking/status routes;
- Stripe and Venmo destinations.

Expected result in every excluded case: zero GA load/request and no later replay.

## 13. Token, waitlist, refund, and privacy validation

- Verify booking-status tokens expire 30 days after the later of occurrence end
  or the latest unresolved qualifying customer-action deadline. Exercise
  material-reschedule, exceptional-payment refund/transfer, cancellation
  confirmation, and versioned booking-action deadlines; prove internal dates,
  retries, passive dispute monitoring, retention periods, communication retries,
  waitlist offers, and analytics expiry do not extend access.
- Submit matching and nonmatching replacement requests and confirm both return
  the same generic response. Verify rate limiting, email-only delivery, token
  rotation, prior-token invalidation, replay denial, and redacted logs.
- Verify waitlist offers default to 24 hours, accept configuration only from 1
  to 72 hours, and cap effective expiry at registration close or workshop start.
- Verify timely acceptance, exact-boundary/late rejection, and exactly-once queue
  advancement without capacity loss or duplication.
- Verify Stripe refund eligibility for actor, trusted charge, positive remaining
  balance, amount bounds, original currency, replay, concurrent partial
  requests, fully refunded charges, reversals/disputes, and provider rejection.
- Confirm refund initiation does not cancel seats and booking cancellation does
  not automatically initiate a refund.
- Verify correction/minimization requests require a valid booking-status token
  or a single-use email link to the current contact email with a 24-hour
  maximum. Prove support reference, name, supplied email, and CRM login alone do
  not verify customer authority.
- Propose a corrected contact email and prove the existing address remains
  active until a separate 24-hour one-time link confirms control of the proposed
  address. Verify activation invalidates prior status and privacy-verification
  links and that neither email value enters audit or analytics.
- Verify no active retention policy disables minimization. Activate a
  human-approved version as an active CRM user assigned the existing `admin`
  role in `public.user_roles`; prove an active `staff` user and an inactive
  `admin` user are denied at the route, repository, and database mutation
  boundaries. Prove draft/review/approval/activation/retirement authorization,
  explicit confirmation, recorded approval/activation/retirement actors and
  times, atomic prior-version retirement, immutable policy content after
  activation, the sole controlled `active -> retired` post-activation
  transition, and full retired-row immutability. Verify
  policy-version recording, authorized correction/minimization, unauthorized
  denial, operational restrictions, removal of eligible
  phone/attendee/accommodation fields, communication suppression, financial
  preservation, audit redaction, and idempotent repeated requests.
- Verify contact-email minimization is deferred with a safe reason and earliest
  eligibility while recovery, required communication, qualifying customer
  action, payment/refund/transfer work, an active verification link, or policy
  restrictions remain. Once eligible, verify status-token and privacy-link
  invalidation and ensure removed/replacement values never enter audit or logs.

## 14. PayPal retirement gate

Pre-retirement gate while the PayPal deployment remains available for rollback:

1. Search source, generated bundles, functions, environment docs, and deployment
   configuration for PayPal SDK/order/capture/webhook runtime references.
2. Confirm configured direct-Venmo deadlines/reminders, manual reconciliation,
   obligation allocation, Stripe, cash, and check project paths pass regression.
3. Confirm historical PayPal transactions and provider references remain visible.
4. Record explicit approval to retire the PayPal-only runtime.

Only after that approval:

5. Remove active deployment/configuration for `capture-venmo-order` and
   `paypal-payment-webhook`.
6. Remove obsolete PayPal secrets from the runtime through the human-controlled
   provider/deployment console.
7. Re-run project and workshop payment smoke checks and scan generated bundles,
   frontend behavior, configuration, and deployed functions for active PayPal
   references.

Do not delete historical database records.

## 15. Release gates

Production activation requires:

- Migration and PostgreSQL test pass.
- Angular test, coverage, and production build pass.
- Every affected Edge Function independently type-checks.
- Stripe, Mailgun, Venmo, expiration, and project-payment smoke evidence.
- Accessibility, SSR, SEO, sitemap, analytics privacy, and PayPal-absence checks.
- Florist approval of event content, cancellation/refund wording, Venmo target,
  catalog items, communication templates, and operational workflow.
- Qualified privacy/legal approval of retention, public policy, customer data,
  and analytics/value measurement.
- A human-approved active retention-policy version covering operational,
  communication, financial, dispute, and audit periods plus validated
  correctable, minimizable, and retained field rules. There is no default
  active policy, and minimization stays disabled until activation.
- A recorded trusted-confirmation-to-CRM visibility check demonstrating that
  the confirmed booking is available to authorized CRM users within 30 seconds.

### Production operator sequence

Use this order for a production release; keep workshop publication and both
occurrence-level payment switches off until their corresponding gates pass.

1. Confirm a recoverable database backup and record the currently deployed
   application/function versions. Apply every migration listed in section 2 in
   exact timestamp order. Stop on the first error; do not skip a companion
   migration or edit a migration already applied to a shared environment.
2. Deploy the standalone workshop functions, followed by the extended existing
   Stripe checkout, webhook, and payment-resolution functions. Configure only
   environment names listed in sections 1 and 5; secrets remain in the provider
   or deployment console.
3. Point the Stripe test-mode webhook at `stripe-payment-webhook` and subscribe
   to the supported checkout completion/failure/expiry, PaymentIntent
   success/failure, charge success/refund, and dispute creation/closure events.
   Verify the signing secret and merchant/account identity before enabling any
   workshop occurrence's `stripe_enabled` switch.
4. Configure `WORKSHOP_SCHEDULER_SECRET` and
   `WORKSHOP_MESSAGE_CRON_SECRET` as Edge Function secrets. Store the same
   values in Vault as `workshop_scheduler_secret` and
   `workshop_message_cron_secret`, alongside the existing `project_url` Vault
   value. Migration `20260729004400_workshop_scheduled_jobs.sql` installs named
   one-minute jobs for `expire-workshop-holds` and bounded
   `process-workshop-messages` batches when these values are present. If the
   migration safely skips installation because configuration is not ready,
   invoke `select public.install_workshop_scheduled_jobs();` after provisioning
   Vault. Prove authentication, idempotency, overlap safety, retry behavior,
   and monitoring before relying on either schedule.
5. Validate the approved business Venmo target and manual reconciliation flow
   before enabling any occurrence's `venmo_enabled` switch. Direct Venmo never
   depends on PayPal credentials, SDKs, orders, captures, or webhooks.
6. In the CRM privacy boundary, an active user with the existing `admin` role
   creates a policy draft. Record qualified privacy/legal review, approve it,
   and obtain explicit human confirmation before activation. Activation
   atomically retires the prior active version; an active version permits only
   the controlled `active -> retired` transition. Never seed or automatically
   activate a default policy.
7. Record florist approval of workshop copy, imagery, price, capacity, terms,
   cancellation/refund wording, Venmo destination, Stripe catalog mapping, and
   message templates. Record qualified approval of retention rules, public
   privacy copy, customer-data handling, and analytics/value measurement.
8. Complete the provider, accessibility, SEO, analytics, privacy, and
   trusted-confirmation-to-CRM smoke gates. Publish a limited workshop first;
   enable Stripe and/or direct Venmo only for that approved occurrence, then
   expand deliberately.

If any activation gate fails, use the flag-first rollback in section 16:
unpublish or close affected occurrences, turn off their Stripe/Venmo switches,
and stop only the failing workshop schedule. Preserve all rows. Reconcile open
holds, pending Stripe Sessions/events, direct-Venmo intentions, refunds,
exceptions, queued communications, and provider outcomes before retrying or
re-enabling checkout. A code rollback does not make pending money or capacity
state disappear.

## 16. Rollback

If a release problem occurs:

1. Close workshop registration and unpublish affected new events.
2. Disable workshop Stripe and Venmo provider flags.
3. Stop workshop schedules if they are causing the issue.
4. Preserve and reconcile every existing hold, booking, provider event,
   transaction, exception, expense, and audit record.
5. Revert public/CRM code independently if safe.
6. Do not drop workshop tables or restore PayPal-powered Venmo as an emergency
   shortcut.
7. If webhook routing is rolled back, keep workshop checkout disabled until all
   pending Stripe events are reconciled.
