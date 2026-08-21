# Workshop Booking Implementation Notes

**Branch**: `011-workshop-booking`  
**Started**: 2026-07-30

## Setup baseline

### Affected and preserved surfaces

- Approved changes: public `/workshops` presentation, new public
  title-driven workshop series/details routes, token-scoped workshop booking/status routes, a new
  `/admin/workshops` CRM area, workshop-specific Supabase records/functions,
  Stripe workshop routing, direct Venmo handoff, workshop analytics, and
  workshop SEO/sitemap entries.
- Preserved unchanged unless a named task explicitly says otherwise: private
  workshop inquiry at `/inquiries/general`, proposal access and Canva PDF
  upload, project obligations and allocations, project Stripe/cash/check/manual
  Venmo behavior, historical payment facts, unrelated public pages, CRM
  modules, and the existing Calendar placeholder.
- Explicitly excluded: public or CRM calendar implementation, customer
  accounts, migration of historical private-workshop inquiries, and the future
  unified income/expense dashboard.

### Brownfield route and integration inventory

- Public workshop route: `src/app/app.routes.ts` maps `/workshops` to the
  existing static `WorkshopsComponent` under `PublicLayoutComponent`.
- Existing public component: three static private-workshop marketing sections
  with image crossfades and `/inquiries/general` calls to action.
- CRM navigation: `SidebarComponent` currently exposes Dashboard, Leads,
  Contacts, Organizations, Projects, Payments, Tasks, and Proposal Settings;
  there is no Workshops entry.
- CRM route boundary: `/admin` uses `authGuard` plus the existing internal-role
  guard; there is no workshop route.
- Analytics: `/workshops` is already eligible under the typed `workshop` page
  category. Tokenized `/pay` routes are outside eligible public routing.
- SEO: `ROUTE_META` contains static `/workshops` metadata. Dynamic workshop
  metadata and Event JSON-LD do not exist.
- Sitemap: `scripts/generate-sitemap.cjs` contains static `/workshops` plus
  dynamic portfolio loading; it does not query workshop occurrences.

### PayPal/Venmo retirement inventory

- Active frontend PayPal SDK loading and Venmo buttons:
  `CustomerPaymentService` and `PaymentOptionsComponent`.
- Active PayPal-backed checkout/capture:
  `create-payment-checkout`, `capture-venmo-order`, and
  `paypal-payment-webhook`.
- Active deployment declarations: `capture-venmo-order` and
  `paypal-payment-webhook` in `supabase/config.toml`.
- Active model/schema branches: `paypal_order`, `paypal_venmo`, PayPal provider
  events, PayPal environment identifiers, and historical transaction
  `source='paypal'`.
- Existing direct Venmo boundary to preserve:
  `payment_collection_settings.venmo_business_target` and
  `payment_intentions.method='venmo_business_profile'`.
- Retirement remains gated by T073. Historical PayPal transactions and
  provider identifiers are never deleted.

### Human review and publication checkpoints

1. Catalog/media migration and CRM publication review.
2. Public listing/detail visual, accessibility, and private-inquiry review.
3. Booking/capacity and payment sandbox review before provider activation.
4. Basic roster/lifecycle review.
5. Advanced operations/privacy/financial/analytics/SEO review.
6. Explicit PayPal retirement approval while rollback deployment remains
   available.
7. Final human review, commit, push, deployment, and production activation.

AI agents must not run `git commit`, `git push`, or commit/push-capable hooks.

## Validation log

Commands, results, provider evidence, and sanitized acceptance observations are
recorded here as their tasks complete.

### 2026-07-30 — foundational checkpoint

- `npm run build` (sandbox): Angular compilation could not begin because font
  inlining required blocked network access.
- `npm run build` (approved network): browser/server bundle generation,
  TypeScript compilation, and prerendering completed. The process then failed
  during final output cleanup with Windows `EPERM` while unlinking the existing
  `dist/black-begonia/browser/about/index.html`. Existing bundle/style budget
  warnings were unchanged.
- `git diff --check`: passed; only line-ending conversion warnings were
  reported for existing generated/configuration files.
- Migration execution checkpoint: the Supabase CLI and `psql` are not
  installed, no Supabase connection variables are present, and the installed
  Docker client cannot reach a running Docker Desktop engine. The five SQL
  suites are present but have not yet been executed. T019 remains open until a
  local Supabase/Postgres test runtime is available.

### 2026-07-30 — T019 catalog/media migration gate

- Docker Desktop 29.3.1 and Supabase CLI 2.110.0 were used for a disposable
  local database. The one-time Supabase images were pulled from Supabase's
  public ECR mirror after Docker Hub throttled anonymous pulls.
- The disposable test project contained the repository's catalog/media
  migration plus a minimal representation of the existing brownfield
  profile/CRM-role authorization boundary. The booking/capacity,
  payments/reconciliation, operations/lifecycle, and privacy/analytics
  workshop migrations were explicitly absent.
- The first attempt against the complete historical migration directory
  stopped on the unrelated legacy assumption that
  `proposal_signing_sessions` already existed. No workshop migration had
  failed; the gate was rerun against the minimal brownfield baseline to isolate
  the Spec 011 slice as required.
- `npx --yes supabase@latest start` with database-only service exclusions:
  catalog/media migration applied successfully.
- `npx --yes supabase@latest test db`: PASS — 1 file, 19 tests,
  `workshop_catalog_media.sql .. ok`.
- The local stack was stopped without backup and the verified
  `bb-workshop-catalog-*` temporary directory was removed.

### 2026-07-30 - US1 workshop creation and publishing

- The catalog/media migration was reapplied in an isolated local Supabase
  project after the US1 commands were added.
- `npx --yes supabase@latest test db`: PASS - 1 file, 35 tests. Coverage
  includes authenticated occurrence save/replay, explicit named-timezone and
  UTC-offset validation, invalid seasonal-offset rejection, media metadata,
  publication requirements, and guarded deletion.
- Focused Karma/Jasmine run for the catalog repository, admin facade, media
  service, workshop list/editor, and CRM sidebar: PASS. Media replacement is
  upload-first with cleanup rollback; receipt and unsafe traversal paths are
  rejected before public-bucket access.
- `npx --yes deno@latest check --no-config
  supabase/edge_functions/manage-workshop-catalog/index.ts`: PASS. `--no-config`
  is required so Deno does not inherit the Angular workspace TypeScript
  configuration.
- Product reuse uses the definition's stored Stripe Product identifier and a
  deterministic `workshop-product-{definitionId}` idempotency key when a
  Product must be created. An active matching Price version is reused;
  otherwise Stripe receives a new immutable Price request keyed by the command
  UUID, the prior database Price version is retired, and the new version is
  recorded.
- The function rejects unauthenticated and non-CRM callers before constructing
  a service-role client. Provider errors return a generic response, avoid
  logging secrets, and persist a sanitized `failed` catalog state for CRM
  recovery.
- Live Stripe test-mode provider evidence remains pending because
  `STRIPE_RESTRICTED_KEY` is not configured in this environment. T028 remains
  open rather than treating static/type-check evidence as a sandbox payment
  result.

### 2026-07-30 - US2 workshop series

- A disposable local Supabase project applied only the minimal brownfield
  CRM-role baseline and the updated catalog/media migration.
- The first pgTAP run identified quoted JSON scalar UUIDs in series replay
  arrays. The generation transaction correctly rolled back; all replay and
  confirmation extraction sites were corrected to decode scalar JSON text
  before UUID casts.
- `npx --yes supabase@latest db reset --local --no-seed`: PASS. Both the
  baseline and catalog/media migration reapplied from an empty database.
- `npx --yes supabase@latest test db`: PASS - 1 file, 50 tests. Series coverage
  includes atomic multi-date generation across DST offsets, independent
  occurrence identities, replay without duplication, selected and all-future
  scopes, patch-only override preservation, booked-occurrence preview, denial
  without confirmation, and confirmed material updates.
- Focused Karma/Jasmine series run: PASS - 23 tests. Coverage includes typed
  repository command mapping, explicit offset date previews, generated draft
  identity, selected-scope previews, booked-date confirmation, and CRM
  series/exception presentation.

### 2026-07-30 - US3 public discovery and details

- The isolated catalog/media migration reapplied successfully with the
  minimized public listing and detail projections.
- `npx --yes supabase@latest test db`: PASS - 1 file, 60 tests. New checks
  cover chronological eligibility, featured ordering data, occurrence hero
  precedence over definition media, retained cancelled-page visibility and
  `noindex`, pre-booking availability, required detail fields, and exclusion of
  customer/internal fields.
- Focused Karma/Jasmine run for the anonymous repository, public listing,
  detail page, and route regression: PASS - 19 tests. The UI has a manual
  carousel, date-ordered list with separators, lazy list images, reduced-motion
  styles, loading/error/empty states, stable detail routing, lifecycle-aware
  actions, gallery/terms, dynamic metadata/Event JSON-LD, and the retained
  `/inquiries/general` path.
- Booking-aware limited/sold-out/waitlist derivation in the capacity migration
  remains part of T044 and will be closed when that migration is applied in the
  reservation slice. The catalog-only public projection intentionally exposes
  only lifecycle/registration-derived pre-booking availability.

#### Booking-aware availability follow-up

- The catalog/media and booking/capacity migrations applied together in order
  in a disposable database.
- `npx --yes supabase@latest test db` for
  `workshop_booking_capacity.sql`: PASS - 1 file, 25 tests. The public
  projection derives available, limited, sold-out, and waitlist-available from
  active unexpired or confirmed holds, while explicit lifecycle closure takes
  precedence. The anonymous listing/detail wrappers expose only the band and
  waitlist eligibility; arbitrary occurrence probing remains ungranted.
- Two pre-existing pgTAP `like(...)` convenience calls were unavailable in the
  local extension version and were replaced with equivalent `ok(... like
  pattern)` assertions.
- Final slice-boundary `npm run build`: Angular browser/server compilation and
  prerendering of 24 routes completed. The command then hit the same existing
  Windows `EPERM` unlink failure for
  `dist/black-begonia/browser/about/index.html`. Expected placeholder-Supabase
  fetch failures occurred during prerender, and existing/new style budget
  warnings were reported; no TypeScript or template compilation error occurred.
- `git diff --check`: PASS, with line-ending conversion warnings only.

### 2026-07-30 - US4 reservation and payment core

- A disposable database applied the catalog/media, booking/capacity, and
  payments/reconciliation slices from an empty minimal brownfield baseline.
- Final `npx --yes supabase@latest test db`: PASS - 3 files, 116 tests.
  Coverage includes atomic/idempotent holds, exact tax-inclusive totals,
  quantity/cutoff/capacity enforcement, one active payment method, unique
  direct-Venmo references, token rotation/recovery, Stripe checkout attachment,
  signed-fact reconciliation, replay/out-of-order handling, mismatched and
  unmatched money, external direct-Venmo refunds, and redacted booking status.
- Focused Karma/Jasmine reservation run: PASS - 17 tests. The repository,
  service, reservation UI, and status UI keep booking/status tokens out of
  URLs and persistent storage, use the single allowed analytics grant session
  key, validate quantity/contact/terms, map Stripe/direct-Venmo handoff, expose
  generic recovery, and navigate only to clean workshop paths.
- Standalone Deno check with `supabase/deno.json`: PASS for
  `create-workshop-booking`, `manage-workshop-booking-access`,
  `expire-workshop-holds`, and the extended `stripe-payment-webhook`.
- Live Stripe, direct-Venmo, Mailgun recovery, and scheduled-expiry sandbox
  evidence remains pending because provider credentials are not configured.
  T066 remains open; type-check and database evidence are not being represented
  as provider sandbox results.

#### Project direct-Venmo pre-retirement implementation

- The active project-payment UI and service no longer load the PayPal SDK,
  render PayPal buttons, create/capture PayPal orders, or expose a
  `paypal_order` handoff. Direct Venmo opens only the configured florist target
  and retains the server-provided reconciliation reference and pause deadline.
- `create-payment-checkout` now records a manual direct-Venmo intention instead
  of creating a PayPal order. The additive
  `20260729002500_project_direct_venmo_payment_paths.sql` migration rejects new
  `paypal_venmo` checkout attempts while preserving existing PayPal tables,
  provider facts, functions, and deployment assets for the explicit rollback
  gate.
- Focused Karma/Jasmine project-payment and booking-status run: PASS - 17 tests.
  Coverage requires direct Venmo/manual pending behavior, the server deadline,
  absence of PayPal SDK/order/capture behavior, and absence of workshop
  seat-release language in project-payment messaging.
- Standalone Deno check with `supabase/deno.json`: PASS for the updated
  `create-payment-checkout` function.
- Final disposable database regression: PASS - 4 files, 122 tests. The added
  project suite verifies the configured direct-Venmo target snapshot, seven-day
  reminder pause, and rejection of new PayPal-backed Venmo attempts; the
  workshop capacity, Stripe reconciliation, and direct-Venmo suites remain
  green.
- T073 remains open for explicit human pre-retirement approval. Consequently,
  `capture-venmo-order`, `paypal-payment-webhook`, PayPal deployment
  configuration, and historical PayPal read paths have intentionally not been
  removed. T074 and T075 must not proceed until that approval is recorded.

### 2026-07-30 - US5 roster increment

- Added the separate `20260729003100_workshop_roster_operations.sql` migration
  so roster commands remain an additive operations capability rather than
  expanding the base lifecycle migration.
- The authoritative roster command creates capacity-backed manual or
  complimentary reservations, supports replay-safe partial/full cancellation,
  checks in active attendees, and preserves original booking price snapshots.
  A separate projection exports only the roster fields needed for event
  operations.
- Disposable reset from an empty database: PASS through catalog, capacity,
  payments, project direct-Venmo, operations, roster, and privacy migrations.
- Full isolated pgTAP regression: PASS - 6 files, 164 tests. New coverage
  verifies capacity protection, one attendee per reserved seat, replay,
  partial release, immutable price history, check-in, and minimized export.
- Focused Karma/Jasmine operations-repository run: PASS - 4 tests. The typed
  repository delegates mutations to the authoritative roster command and reads
  only the minimized projection.
- T076, T080, T081, and T084 remain open because their privacy, waitlist,
  communication, and/or CRM UI portions are not yet implemented. This entry is
  an explicit vertical-increment checkpoint, not completion evidence for those
  composite tasks.

#### Retention-policy administration increment

- Added the separate `20260729004100_workshop_retention_policy_commands.sql`
  privacy-administration slice and replay ledger.
- The existing active-admin authorization boundary owns draft creation,
  approval, activation, and retirement. Active staff is denied. Approved
  content becomes immutable, activation records its controlled metadata, active
  content remains immutable, and the only subsequent transition is controlled
  retirement; retired rows cannot change.
- Empty-database reset: PASS. Full isolated pgTAP regression: PASS - 6 files,
  176 tests. Focused operations/privacy repository run: PASS - 7 tests.
- Production Angular browser/server compilation and prerendering of 24 routes:
  PASS. The command then encountered the established Windows `EPERM` unlink
  failure for `dist/black-begonia/browser/about/index.html`; placeholder
  Supabase prerender fetch errors and existing style/bundle budget warnings were
  non-compilation diagnostics.
- The complete Angular suite currently reports 690/694 passing. The four
  deterministic failures are outside the new workshop roster/privacy files:
  `PaymentObligationModalComponent` merchant-fee rendering,
  `PaymentStatusComponent` polled-state rendering, `PaymentsComponent`
  obligation amount rendering, and `LeadConvertModalComponent` no-recipient
  deposit-email disabling. The same four fail when isolated (9/13 pass).
  Therefore they are recorded as a pre-retirement regression-gate issue and
  T073 remains unapproved; they are not represented as passing evidence.
- Personal-data verification/correction/minimization is still open, so the
  composite privacy tasks remain unchecked.

#### Verified personal-data, waitlist, and communication increment

- Added independent additive commands for verified personal-data requests,
  correction and replacement-email confirmation, policy-driven minimization,
  FIFO waitlist offers, and the durable communication queue. The communication
  slice is intentionally ordered after the base privacy schema so every
  foreign-key dependency exists when the migration is applied.
- Personal-data processing supports status-token or current-address
  verification, generic responses for insufficient identity, a separate
  24-hour proposed-email confirmation, field-by-field minimization and safe
  deferment reasons, communication suppression, preserved financial facts,
  redacted audit metadata, and replay protection.
- Waitlist offers reserve real capacity, enforce FIFO ordering and bounded
  deadlines, reduce offer quantity to current availability, and atomically
  release or convert protected holds on decline, expiry, late acceptance, or
  timely acceptance.
- The communication queue stores no raw token or recipient address. It resolves
  the current recipient only inside a service-role claim, uses skip-locked
  claiming, records append-only retry/permanent/accepted outcomes, suppresses
  expired or privacy-blocked messages, and leaves booking state authoritative
  and independent of delivery state.
- Empty-database reset through migration
  `20260729004200_workshop_personal_data_commands.sql`: PASS. Full isolated
  pgTAP regression: PASS - 6 files, 274 tests.
- T083 remains open until replacement-status delivery is routed through the
  queue. The standalone Mailgun processor and privacy-verification endpoint
  remain T085-T087 work; no provider sandbox evidence is claimed here.

#### Standalone workshop message processing increment

- Replacement booking-status access now performs only origin/input/rate-limit
  checks and queues a generic, non-enumerating recovery request. It no longer
  rotates a token or invokes Mailgun inline.
- The claimed message worker generates raw single-purpose tokens only in
  invocation memory. Provider acceptance atomically registers the digest and
  appends the delivery outcome; retryable/permanent failures append redacted
  outcomes without changing booking or payment truth. Ten-minute stale claims
  are recoverable, retries are bounded to five attempts, and expired,
  ineligible, or privacy-suppressed messages are not delivered.
- Added the separate `verify-workshop-personal-data` endpoint for current-address
  request verification and proposed-email confirmation. Successful replacement
  confirmation returns the newly rotated booking token once; only its digest is
  persisted.
- Empty-database reset through all Spec 011 migrations: PASS. Full isolated
  pgTAP regression: PASS - 6 files, 288 tests. New assertions cover
  non-enumerating recovery matching, durable queue replay, claimed-worker
  digest registration, registration collision denial, and atomic
  provider-acceptance completion.
- Standalone Deno check: PASS for `manage-workshop-booking-access`,
  `process-workshop-messages`, and `verify-workshop-personal-data`.
- At this checkpoint T085 remained open for token-scoped cancellation and
  waitlist actions. T087 remains open because Mailgun
  confirmation/recovery/privacy/waitlist,
  expiry/cancellation/retry/failure, and at-least-100-message timing evidence
  requires configured provider sandbox credentials and has not been claimed.

#### Token-scoped customer actions increment

- Added a separate customer-booking database command rather than weakening the
  CRM-only roster authorization boundary. A valid current status digest can
  cancel a bounded seat quantity, release the corresponding capacity, cancel
  active payment attempts, append a customer-provenance adjustment, and return
  the remaining quantity plus refund-review state. Processing/dispute races
  create an operational exception without silently changing capacity.
- The booking-access endpoint now owns customer cancellation and waitlist
  accept/decline responses. Waitlist acceptance validates the single-purpose
  offer digest and terms, converts protected capacity atomically, and returns a
  new booking token once. The Angular service retains that token only in memory.
- Empty-database reset including
  `20260729003250_workshop_customer_actions.sql`: PASS. Full isolated pgTAP
  regression: PASS - 6 files, 294 tests. Focused booking repository/service
  Karma run: PASS - 13 tests. Expanded booking-access Deno check: PASS.
- An accidental unfiltered Karma invocation reconfirmed 692/696 passing with
  only the same four pre-existing payment/lead presentation failures already
  recorded above; no workshop test failed.

#### US5 repository boundary increment

- The operations repository now owns minimized roster reads, manual and
  complimentary reservations, seat cancellation, check-in, FIFO offer
  commands, and redacted communication queue/history reads. The privacy
  repository owns verified correction/minimization processing and the complete
  retention-policy lifecycle.
- The admin facade adds only a parallel roster/waitlist display composition;
  it contains no mutation or domain-state rule.
- CRM waitlist offer creation no longer accepts or constructs a usable token.
  PostgreSQL creates only a temporary digest placeholder, and the standalone
  claimed message worker replaces it with the digest of the raw in-memory offer
  token immediately before accepted delivery.
- Focused operations/privacy/facade Karma run: PASS - 11 tests. Clean
  empty-database reset: PASS. Full isolated pgTAP regression remains PASS -
  6 files, 294 tests.

#### US5 CRM roster and privacy administration increment

- Added a responsive roster surface with minimized filtering/export, booking
  and seat counts, manual/complimentary reservations, partial cancellation,
  attendee check-in, and bounded FIFO waitlist offers.
- Added an admin-only privacy surface for draft/review/approval/activation/
  controlled-retirement policy lifecycle and verified correction/minimization
  processing with safe deferment reasons. The route uses the existing hydrated
  `profiles.is_active` plus `user_roles` boundary: active `admin` is allowed;
  active `staff` and inactive admin are denied.
- Confirmed CRM reservations automatically queue a booking confirmation. The
  browser creates no usable status token; the standalone claimed worker creates
  the raw token and atomically registers only its digest on accepted delivery.
- Focused roster/privacy/guard Karma run: PASS - 9 tests. Clean database reset:
  PASS. Full isolated pgTAP regression: PASS - 6 files, 295 tests.
- T079 remains open for its remaining exhaustive presentation/error-state
  assertions; the implementation task T088 is complete.

#### US5 occurrence operations summary

- `/admin/workshops/:occurrenceId` now loads a dedicated occurrence detail
  surface instead of aliasing the editor. The facade composes catalog facts with
  minimized roster/waitlist reads, while the component deduplicates booking
  quantities and presents booking, active-seat, check-in, waitlist, and
  capacity summaries.
- The detail surface links to the editor, full roster, and eligible public
  preview. Focused occurrence-detail and route regression: PASS - 9 tests.
- Expanded US5 roster/privacy/guard presentation regression: PASS - 14 tests,
  covering filters/counts, manual reservations, partial cancellation, check-in,
  waitlist offers, minimized export, request lifecycle eligibility,
  replacement-email pending state, no-active-policy behavior, safe deferment
  presentation, confirmed policy transitions/errors, and active-admin versus
  staff/inactive-admin authorization. T079 is complete.

#### US6 lifecycle core checkpoint

- Added an internal-authorized, idempotent occurrence transition command and a
  separate operational read model. Persisted lifecycle remains limited to the
  documented states; available, limited, sold-out, waitlist-available, and
  closed are calculated from lifecycle, registration, capacity, active holds,
  and waitlist facts.
- Publishing, explicit registration close, passed-event completion review,
  reviewed completion, and eligible archival append safe transition audit
  events. Capacity changes cannot reopen an explicitly closed occurrence, and
  replaying a command cannot append another transition.
- Clean isolated database reset: PASS. Full pgTAP regression: PASS - 6 files,
  309 tests.
- T090 and T095 remain open intentionally until the cancellation and material
  reschedule commands complete the full allowed/forbidden transition matrix.

#### US6 occurrence cancellation increment

- Added an internal-authorized, replay-safe occurrence cancellation command.
  It moves eligible draft/open/closed occurrences to cancelled, sets the
  twelve-month retained-status deadline, invalidates active and confirmed
  capacity, cancels outstanding payment instructions, closes the waitlist,
  cancels active booking quantities with immutable adjustments, and queues one
  required notice for each reachable affected customer.
- Stripe Checkout Sessions are represented by a durable, retryable expiration
  queue instead of assuming local cancellation also invalidated the provider
  Session. Processing-payment races receive an urgent operational exception;
  paid bookings receive a separate refund-review exception. Neither path moves
  money automatically.
- Regression coverage proves cancellation replay safety, notice and exception
  deduplication, waitlist closure, retained public status, immediate capacity
  invalidation, exact-once recording of a provider payment arriving after
  cancellation, and preservation of the cancelled booking state.
- Clean isolated database reset: PASS. Full pgTAP regression: PASS - 6 files,
  330 tests. T091 and T096 are complete.

#### US6 material-rescheduling increment

- Added a replay-safe material-reschedule command boundary. It locks the source
  and replacement occurrences, verifies the complete affected quantity against
  replacement capacity, changes the source to retained `rescheduled` status,
  and creates one protected replacement hold and one response record per active
  confirmed booking. Bookings remain `transfer_action_required` until their
  individual response succeeds.
- Required reschedule prompts use the durable message processor. The worker
  creates the raw single-purpose response token in memory and registers only
  its digest against the pending response. A forged, expired, replayed, or
  already-resolved token cannot reveal or change booking state.
- Explicit acceptance releases source capacity, confirms only that customer's
  replacement hold, and moves only that booking. Decline releases protected
  capacity, cancels the booking, and creates florist-controlled refund review
  without moving money. Expiry leaves the booking unconfirmed for follow-up;
  an internal user may explicitly resolve that nonresponse as cancellation but
  cannot accept on the customer's behalf.
- The reschedule command is delivered in additive companion migration
  `20260729003300_workshop_reschedule_commands.sql`, keeping the base
  operations migration from becoming a monolith while preserving slice order.
- Clean isolated database reset: PASS. Full pgTAP regression: PASS - 6 files,
  358 tests. Angular production compilation: PASS using
  `ng build --delete-output-path=false`; the normal build compiled and
  prerendered successfully but Windows denied its final deletion of one locked
  generated `dist` file. Existing bundle/style budget warnings and placeholder
  Supabase prerender fetch warnings remain unchanged. T092, T095, and T097 are
  complete.

#### US6 application integration checkpoint

- The operations repository now exposes the lifecycle read model and
  replay-safe transition, cancellation, reschedule, expiry, and explicit
  nonresponse-resolution commands. The CRM occurrence detail surface uses that
  boundary for lifecycle controls, affected-booking/seat previews, completion
  review, replacement-capacity selection, response tracking, and confirmed
  follow-up actions.
- The booking-access endpoint now accepts a single-purpose reschedule response
  code, hashes it before calling the authoritative database command, and
  returns only safe outcome fields. The customer status projection exposes
  replacement facts and protected quantity for the authorized booking without
  exposing response-token material. Acceptance, decline/refund review, expiry,
  replay, and unavailable outcomes are presented without implying automatic
  transfer or money movement.
- The safe status projection is delivered through additive migration
  `20260729003350_workshop_reschedule_status.sql`. The lifecycle regression now
  exercises all 49 persisted source/target combinations and verifies that only
  the seven permitted transitions append audit history.
- Focused Angular regression: PASS - 27 tests. Standalone Deno type-check:
  PASS. Clean isolated database reset: PASS. Full pgTAP regression: PASS - 6
  files, 365 tests. Angular production build: PASS, with the existing
  bundle/style budget warnings and placeholder Supabase prerender fetch
  warnings. T090, T093, T094, and T098-T101 are complete.

#### US7 financial database checkpoint

- Added an authoritative workshop financial command boundary with a separate
  operational refund-request state. Stripe refund eligibility locks the trusted
  charge and validates actor access, original currency, positive remaining
  balance, amount bounds, command replay, concurrent requests, provider
  acceptance/failure, and webhook reconciliation without changing seats.
- Immutable ledger facts now cover provider and external refunds, fees,
  discounts, disputes, reversals, and corrections. Trusted disputes and
  reversals create urgent review while preserving capacity. Direct Venmo
  refunds remain external actions recorded afterward with traceable references.
- Expense commands support occurrence or series scope, controlled categories,
  private receipt references, and append-only reversal/replacement correction.
  The normalized reporting view excludes attendee and receipt fields and feeds
  reproducible occurrence/series gross revenue, discounts, refunds, provider
  fees, expenses, exceptions, and net results.
- Delivered through additive companion migration
  `20260729002600_workshop_financial_commands.sql`. Clean isolated reset: PASS.
  Full pgTAP regression: PASS - 6 files, 414 tests. T102, T103, T105, and T106
  are complete.

#### US7 financial application and provider checkpoint

- Added the standalone authenticated Stripe refund endpoint and kept durable
  validation in the authoritative financial command. A provider-accepted
  refund that cannot be acknowledged locally remains recoverable for
  reconciliation instead of being released for a potentially duplicate retry.
  Refund initiation and reconciliation do not invoke capacity or cancellation
  commands.
- Extended the existing Stripe webhook with canonical refund, fee, dispute, and
  reversal facts while preserving the project-payment branch. Pending refunds
  store provider evidence without creating completed money facts. Overlapping
  Stripe refund event types and repeated dispute updates are excluded, and the
  immutable ledger independently deduplicates provider object/type facts.
- Added the scoped financial repository and read-only facade composition plus
  the occurrence financial CRM route. The UI provides summaries, expenses and
  private receipt evidence, explicit refund eligibility and confirmation,
  external Venmo refund recording, exception resolution, immutable history,
  and a personal-data-safe CSV export.
- Standalone Deno checks with Angular configuration excluded: PASS for
  `refund-workshop-payment` and `stripe-payment-webhook`. Focused Angular
  regression: PASS - 18 tests. Angular production build: PASS with existing
  bundle/style budget warnings and placeholder Supabase prerender fetch
  warnings. The full Angular suite still reports the four previously documented
  unrelated payment/lead failures.
- T104, T107, T108, T110, and T111 are complete. T109 remains open because its
  required eligible/ineligible/concurrent refund, provider-failure, dispute,
  and no-capacity-effect Stripe sandbox evidence needs configured sandbox
  provider credentials; no live-provider evidence was fabricated.

#### US8 privacy-preserving workshop analytics checkpoint

- Extended the existing analytics allowlist with workshop listing, detail, and
  clean reservation categories plus five typed milestones: selection, detail
  view, reservation start, checkout start, and trusted booking confirmation.
  Parameters are limited to carousel/list placement, public workshop slug,
  workshop category, quantity band, provider, approved currency, and optional
  approved value. Raw URLs, query strings, fragments, customer fields, booking
  references, and payment identifiers are rejected.
- The clean `/workshops/:seriesSlug/:workshopDate/reserve` route remains eligible for reservation
  intent. Booking status, `/pay/*`, CRM, auth, and other opaque-token routes
  remain denied before GA activation. The inherited production-host, explicit
  opt-out, browser GPC, region GPC, non-US consent, internal-browser, and
  provider-failure boundaries continue to fail closed.
- A confirmed booking may register only one SHA-256 grant digest. The booking
  access Edge Function generates the raw 256-bit value and returns it only when
  the database wins first issuance. Postgres stores only the digest. The
  redemption Edge Function hashes the presented raw value and sends only
  `grantDigest` to the service-only database command. Redemption, discard, and
  expiry are atomic and terminal; duplicate, expired, forged, cross-tab, and
  blocked-then-enabled attempts return the same unavailable outcome.
- The client keeps the raw grant only under
  `bb.workshop.pendingAnalyticsOutcome` in `sessionStorage`, removes it before
  the Edge call, and never writes it to localStorage, cookies, URLs, logs,
  errors, audit facts, or analytics parameters. A blocked decision requests
  durable discard and does not retain the value for later replay.
- Controlled network-boundary assertions show exactly one sanitized
  `google.send` call for each permitted milestone and zero calls for opt-out,
  GPC, internal-browser, unresolved/non-US consent, local/invalid host,
  tokenized status, payment, and CRM contexts. The GA call receives only the
  allowlisted public fields described above.
- Clean isolated database reset: PASS. Full pgTAP regression: PASS - 6 files,
  427 tests. Focused analytics/workshop Angular regression: PASS - 68 tests,
  including the final cross-tab client assertion. Both affected Edge Functions
  independently type-check with Deno. Angular production build:
  PASS with the existing bundle/style budget and placeholder Supabase
  prerender warnings. T112-T120 are complete.

#### US9 search and SSR checkpoint

- Workshop listing and detail routes now publish canonical, Open Graph, Twitter,
  robots, and page metadata through the shared SEO boundary. Route changes
  remove stale keywords and page JSON-LD, while the dynamic detail route retains
  ownership of occurrence-specific metadata during its asynchronous server
  load.
- Event JSON-LD now covers scheduled/open, limited, sold-out, completed,
  cancelled, and rescheduled lifecycle facts. It includes offset-bearing start
  and end values, physical PostalAddress, crawlable imagery, organizer, Offer
  price/currency/URL/valid-from/availability, and replacement dates plus
  `previousStartDate` for retained reschedule pages. Cancelled and rescheduled
  status pages remain `noindex,follow`.
- Added the minimized anonymous `get_public_workshop_sitemap` projection and
  additive migration `20260729004300_workshop_search_projection.sql`. Sitemap
  generation includes eligible published/closed/completed occurrences and
  active cancelled/rescheduled status pages, uses persisted modification dates,
  deduplicates URLs, and excludes drafts, expired redirects, invalid slugs, and
  token-shaped routes. Booking-aware availability remains composed by the
  existing capacity projection.
- Dynamic workshop series and series/date routes are explicitly SSR-rendered. Before rendering, the
  Netlify server resolves an expired status outcome through the minimized public
  projection and returns a validated same-site 308 to the replacement occurrence
  or Workshops listing. Provider failure fails open to SSR rather than producing
  an unsafe or guessed redirect.
- Focused Angular SEO/workshop regression: PASS - 18 tests. Deterministic sitemap
  assertions: PASS. Additive migration application against the isolated local
  database: PASS. Compiled-server safe/unsafe redirect assertions: PASS.
  Production SSR build and 24-route prerender: PASS using
  `ng build --delete-output-path=false`, with the existing bundle/style budget
  and placeholder Supabase prerender warnings. The broader Angular run continues
  to report its previously documented unrelated lead/payment test failures; the
  US9-focused suite is green. T121-T129 are complete.
- T130 remains open. Local build, sitemap, metadata, structured-data, and redirect
  evidence is recorded above, but Search Console URL Inspection and Google Rich
  Results validation require a deployed, crawlable occurrence URL and the
  appropriate Google access. No external validation result was fabricated.

#### Phase 12 hardening and release-readiness checkpoint

- Cross-story client coverage now exercises safe loading, error, empty,
  replay, lifecycle, public-projection minimization, override, and representative
  scale fixtures. The full application coverage run reached 72.65% statements,
  56.88% branches, 69.24% functions, and 74.96% lines, an incremental movement
  toward the 80% affected-code objective. The focused workshop regression
  remained green.
- The database abuse audit added request-bound seat-hold command replay:
  reusing a command key with a changed occurrence, quantity, normalized contact
  fields, terms version, or status-token digest now fails with a command-key
  collision rather than replaying another request. It also added explicit
  inactive-admin retention-policy denial. Existing cross-slice coverage
  verifies unauthorized actors, request bounds, status-token replay,
  digest-only analytics grants, verified personal-data authority, active/staff
  policy boundaries, controlled active-to-retired transition, immutable facts,
  deferred minimization, and redacted audit metadata.
- A clean reset of the isolated `.tmp/supabase-us4` database applied the
  brownfield baseline and every Spec 011 migration through
  `20260729004300_workshop_search_projection.sql` in timestamp order. The audit
  found zero workshop tables without RLS, zero anonymous base-table privileges,
  and no security-definer function with a mutable search path. Token material
  is persisted as digests; the two non-digest token-like UUID columns are
  idempotency/registration keys, not bearer tokens. No default retention policy
  is active. Additive companion migrations preserve existing project-payment
  and historical provider facts, and rollback remains flag-first/data
  preserving.
- All eleven affected functions independently passed standalone Deno checking:
  `create-workshop-booking`, `manage-workshop-booking-access`,
  `verify-workshop-personal-data`, `redeem-workshop-analytics-outcome`,
  `manage-workshop-catalog`, `refund-workshop-payment`,
  `expire-workshop-holds`, `process-workshop-messages`,
  `stripe-payment-webhook`, `create-payment-checkout`, and
  `resolve-payment-request`. None imports `_shared`, another Edge Function, or
  a cross-function local module. No automated test or harness targeting these
  Edge Functions was introduced.
- Public workshop imagery now supplies responsive `sizes`, async decoding, and
  lazy loading where offscreen; the featured carousel renders only its active
  item. Public list/detail projections remain minimized and indexed. CRM roster
  attendee retrieval was reduced from one request per booking to one bounded
  batch request.
- Representative performance environment: Windows 10, Chrome Headless
  150.0.0.0, Angular 19 Karma/Jasmine, mocked asynchronous repository boundary,
  actual component templates, 500 occurrences, 5,000 total booking fixtures,
  a 100-row roster page, one warm-up, and 20 measured runs. Measurement began
  immediately before repository-backed `load()` and ended after Angular change
  detection and stability. The 500-row CRM occurrence list measured 144.1 ms
  p95; the 100-row roster measured 1.1 ms p95. Both passed the 2,000 ms target.
  `workshop-scale-performance.spec.ts` enforces the threshold.
- Clean PostgreSQL regression: PASS, 483/483 across six files (catalog/media
  60, booking/capacity 56, payments/reconciliation 84, direct Venmo 26,
  operations/lifecycle 173, privacy/analytics 84). The catalog fixture now
  explicitly opens registration before asserting the available state, removing
  dependence on wall-clock date.
- The full Angular suite initially reproduced four documented brownfield
  presentation failures. Narrow remediation made Angular lifecycle tests await
  the framework-owned initialization, rendered merchant fees independently
  when customer fees are zero, and made the no-recipient deposit-email control
  a reliably disabled native checkbox. The focused set passed 13/13, and the
  final full Angular suite plus coverage passed 763/763.
- Targeted brownfield regression: PASS, 57/57. It covered general/private
  workshop inquiry preservation, unrelated public and admin routing, retired
  proposal-access routes, manual PDF upload and optional Canva messaging,
  project payment repositories/customer handoff, historical payment log
  rendering, unrelated CRM project/sidebar behavior, and the calendar
  placeholder.
- Deterministic sitemap assertions: PASS. The normal production build compiled
  browser/server bundles and prerendered 24 routes, then reproduced the known
  Windows locked-output `EPERM` cleanup error. The equivalent
  `ng build --delete-output-path=false` run completed successfully. Recorded
  warnings are the existing 1.05 MB initial bundle versus 500 kB warning budget,
  component-style warning budgets (including the public workshop list and CRM
  workshop editor), and placeholder `example.supabase.co` prerender fetch
  diagnostics.
- T131-T135, T138, T140, and T142-T144 are complete. T136, T137, T139, and
  T141 remain open because the connected in-app browser was unavailable, no
  human timed-usability cohort was run, no before/after deployed Core Web Vital
  measurement exists, and no provider/deployed smoke evidence was fabricated.
- The local pre-retirement regression blocker is cleared by the 763/763 Angular
  result and the passing project/direct-Venmo PostgreSQL coverage. T073 remains
  open until the human operator records provider-level deadline, reminder,
  Stripe/cash/check, historical PayPal-read evidence and explicitly approves
  retirement while the existing PayPal deployment is still available for
  rollback. Consequently T074 and T075 also remain intentionally open.

#### Human-operated source-control and deployment handoff

- Change summary: Spec 011 adds separated catalog, booking/roster, financial,
  and privacy repository boundaries; CRM workshop creation/series/operations/
  financial/privacy surfaces; public listing/detail/reservation/status flows;
  Stripe and direct-Venmo reconciliation; lifecycle, communications, analytics,
  SEO/SSR/sitemap retention; and additive database/security boundaries.
- Review the complete working tree before staging. Keep unrelated existing
  edits separate where practical. The human operator owns all staging,
  committing, pushing, and pull-request actions; no commit or push was run by
  the implementation agent.
- Apply production migrations in the exact order documented in
  `quickstart.md`, then deploy standalone workshop functions and the affected
  existing payment functions. Configure webhook/schedules with provider
  switches off, activate an explicitly reviewed retention policy, complete the
  remaining provider/accessibility/SEO/usability gates, and enable a limited
  occurrence first.
- Validation evidence: standalone Deno checks passed for all eleven affected
  functions; focused workshop tests passed; scale p95 passed; 483/483 pgTAP
  assertions passed after a clean reset; targeted brownfield regression passed
  57/57; the final full Angular suite passed 763/763; sitemap assertions passed;
  SSR build/prerender passed with documented warnings.
- Rollback is flag-first: close/unpublish affected occurrences, disable their
  Stripe/Venmo switches, stop only failing schedules, and roll back application
  or function versions without dropping workshop data. Preserve and reconcile
  pending holds, Sessions/events, direct-Venmo intentions, transactions,
  refunds, exceptions, communications, and audit facts before reactivation.
- Suggested commit message after human review:
  `feat(workshops): add secure event booking and operations`

#### Remaining external-gate audit

- The connected in-app browser discovery returned no available browser session.
  Per the approved browser workflow, no unrelated automation backend was used.
  Keyboard/screen-reader, 200% zoom, responsive viewport, rendered focus, timed
  usability, and local Core Web Vital checks therefore remain unclaimed.
- `docs/analytics/performance-baseline.md` still identifies the approved p75
  LCP/INP/CLS baseline as release-owner work. No comparable pre/post workshop
  cohort exists yet, so T139 remains open even though sitemap generation and the
  production SSR build pass.
- A names-only environment audit found none of the required Supabase, Stripe,
  Mailgun, workshop-origin, scheduler, message-processor, or Venmo sandbox
  settings in the current shell or repository-root environment files. Provider
  calls and timing evidence cannot be executed honestly in this workspace
  state.
- The pre-retirement scan confirms the rollback boundary is still present:
  `capture-venmo-order`, `paypal-payment-webhook`, and their entries in
  `supabase/config.toml` remain active source/configuration targets. Generated
  browser output still contains PayPal-shaped configuration/history strings.
  Declarative schema and migrations retain historical PayPal facts as required.
  Angular payment-option source contains no active PayPal payment choice; its
  PayPal reference is a negative regression assertion, while the transaction
  model retains the historical source type.
- This is the expected pre-approval state. T073 requires provider-level
  direct-Venmo/Stripe/cash/check/historical-read evidence plus explicit human
  approval before T074 may remove active PayPal deployment/configuration.
## Create Workshop schedule and validation refinement (2026-08-01)

- Removed florist-entered URL slug, country, timezone, and UTC-offset fields.
  New occurrence slugs are generated from normalized title plus occurrence date;
  persisted schedules remain fixed to `America/New_York`/`US` with an
  automatically resolved `-240` or `-300` offset.
- Replaced multiline series parsing with independent reactive schedule rows for
  workshop date, local start/end time, and registration start/close date. Adding
  a second row creates series mode; rows can be independently removed before
  creation.
- Replaced free-text state/region with all 50 U.S. states, simplified the city
  label, added field placeholders, and reused the inquiry-form pink tooltip and
  invalid-control treatment for publish validation.
- Ambiguous and nonexistent New York daylight-saving local times are rejected
  rather than guessed. Existing occurrence slugs remain stable while editing.
- Focused editor result: `11 SUCCESS`. The production build compiled and
  prerendered 24 routes; expected placeholder-Supabase fetch warnings and
  existing bundle/style budget warnings remained. The build process then hit a
  Windows `EPERM` unlink lock on generated `dist/.../about/index.html` after
  compilation.

## Create Workshop presentation refinement (2026-08-01)

- Removed the occurrence-count preview panel and the duplicate bottom-level
  invalid-fields summary; field tooltips and the existing actionable error
  alert remain authoritative.
- Moved hero/gallery management into Workshop Story, labeled capacity as Open
  seats, and added explicit `$`/`USD` currency framing around tax-inclusive
  pricing.
- Kept occurrence removal inside its row with centered content and container
  spacing, and added horizontal padding to the sticky save/publish action bar.
- Removed florist toggles for Stripe Checkout, direct Venmo, waitlist, and
  carousel promotion. New and edited workshop drafts now always write all four
  capabilities as enabled, while persisted booleans remain for data-contract
  compatibility.
- Focused editor regression result: `12 SUCCESS`. The production build compiled
  the browser/server bundles and prerendered all 24 routes, confirming the real
  template bindings. Its process again ended during generated-output cleanup
  with the existing Windows `EPERM` lock; placeholder Supabase fetch and
  existing bundle/component-style budget warnings remain unchanged release
  environment concerns.

## Create Workshop field-row and default-terms refinement (2026-08-01)

- Removed the explanatory capabilities sentence while retaining the enforced
  always-on save behavior for Stripe, direct Venmo, waitlist, and carousel
  eligibility.
- Arranged address lines together, City/State/Zipcode together, and open
  seats/per-booking maximum/tax-inclusive price together at desktop widths;
  each group collapses to a single column on narrow screens.
- New workshops now start with editable terms covering payment verification,
  cancellation/transfer/no-show handling, florist cancellation or rescheduling,
  safety and allergies, accessibility requests, minors, materials, conduct,
  photography choice, contact, and preserved non-waivable rights. Existing
  workshop or reusable-definition terms continue to replace the starter copy
  when loaded for editing.
- Focused editor regression result: `13 SUCCESS`. The production browser and
  server bundles compiled and all 24 routes prerendered; the command again
  ended only during generated-output cleanup because of the existing Windows
  `EPERM` lock, alongside the known placeholder-Supabase and budget warnings.

## Create Workshop first-image upload repair (2026-08-01)

- Removed the contradictory requirement to save or select a reusable concept
  before using the image uploader. When a new workshop has valid Workshop Story
  fields, its first image upload now creates the reusable definition and then
  uploads against that owner in one interaction.
- Image type/size and alternative text are validated before definition creation,
  incomplete story content receives field-level tooltips, and upload failures
  are shown in both the page alert and toast instead of appearing inert.
- Shortened the uploader action label from `Upload image` to `Upload` and added
  a focused regression for the new-workshop first-upload path.
- Focused editor regression result: `14 SUCCESS`. Production browser/server
  compilation and all 24 prerender routes completed; the command then hit the
  same existing Windows `EPERM` generated-output cleanup lock, with only the
  known placeholder-Supabase and bundle/style budget warnings beforehand.

## Create Workshop multi-image gallery and Stripe-status refinement (2026-08-01)

- Gallery mode now accepts multiple files in one chooser interaction, displays
  a pending row for each filename, and requires independently editable alt text
  for every image. Hero mode remains single-file and switching to Hero keeps
  only the first pending selection.
- Batch uploads validate every queued file before creating a new definition.
  Each successful file is committed to the visible gallery immediately, so a
  later failure does not cause an already-uploaded image to be duplicated on
  retry.
- Removed raw `Stripe catalog: not configured` copy from the imagery section.
  Stripe readiness now appears beside pricing, where `not_configured` is
  explained as Product/Price setup that will run automatically when the
  workshop is saved; pending, ready, and failed states also use customer-safe
  operational language.
- Focused editor regression result: `16 SUCCESS`. Production browser/server
  compilation and all 24 prerender routes completed before the known Windows
  `EPERM` output-cleanup lock; placeholder-Supabase and existing bundle/style
  budget warnings remain unchanged.

## Create Workshop alt-text focus and customer-preview refinement (2026-08-01)

- Pending upload rows now track by their stable `File` identity. Immutable
  alt-text updates no longer cause Angular to recreate the active row after
  each character, preserving continuous keyboard focus.
- Customer Preview formats the occurrence date and fixed New York local time as
  separate lines (`27 March 2027` and `@ 10:30 AM - 11:30 AM`) without browser
  timezone conversion and with explicit AM/PM markers.
- The modal now mirrors the public detail hierarchy: uploaded hero image beside
  theme/title/advertising/schedule/venue/price, followed by experience content
  and the effective ordered public media gallery. When no hero exists, the
  preview shows an intentional missing-hero prompt rather than implying imagery
  will appear automatically.
- Extracted the customer-facing preview into a focused standalone component so
  its responsive public-page presentation does not push the editor component
  past Angular's hard per-component style budget.
- Focused editor and preview regression result: `22 SUCCESS`. Production
  browser/server compilation and all 24 prerender routes completed without a
  workshop style-budget error; the command then encountered the existing
  Windows `EPERM` generated-output cleanup lock. Placeholder-Supabase fetch
  logging and the repository's existing bundle/style warnings remain.

## Workshop CRM theme and reusable-concept lifecycle refinement (2026-08-01)

- Create Workshop and the Workshops administration list now consume the CRM's
  semantic page, surface, border, text, accent, input, state, and focus tokens,
  covering both light and dark modes. The customer preview remains deliberately
  public-page styled so it continues to represent what customers see.
- Workshop occurrence removal and reusable-concept retirement use the same
  compact rounded-square destructive X treatment as Floral Proposal Builder.
- New definition owners are created with `is_reusable = false`, allowing draft
  media and Stripe setup without leaking unfinished concepts into the chooser.
  A database trigger promotes the definition only when an occurrence reaches a
  successfully published state. Selecting an existing reusable definition
  retains its ID; removing a reusable option sets the flag false and preserves
  all linked workshop, media, payment, and audit history. Retirement also stores
  `reusable_retired_at`, preventing publication of an older linked draft from
  silently reactivating the retired option.
- Focused editor, preview, admin-list, and catalog-repository regression result:
  `38 SUCCESS`. Production browser/server compilation and all 24 prerender
  routes completed; Workshop Editor remained below the hard component budget
  at 7.52 kB. The command then encountered the existing Windows `EPERM` output
  cleanup lock, alongside placeholder-Supabase logging and existing warnings.
- A final editor/catalog regression after adding the retirement-reactivation
  guard passed `29 SUCCESS`.
- The PostgreSQL catalog suite was prepared with reusable-state and successful
  publication-promotion assertions. Local execution could not start because a
  separate healthy `supabase-us4` project owns ports 54321-54324. The attempted
  `black-begonia` containers and temporary functions-path junction were removed
  without touching that running project.

## Compact Customer Preview restoration (2026-08-01)

- Replaced the expansive public-detail imitation with the earlier compact modal
  card hierarchy. The uploaded hero is now a background header behind the
  workshop theme, title, and advertising line, followed by the concise
  date/time, venue, price, description, and inclusions summary.
- Gallery presentation is a small responsive arrangement-thumbnail grid. It
  receives gallery-role media only, never repeats the hero, and is not rendered
  at all when the florist has not provided gallery images.
- Focused Workshop Editor and Customer Preview regression: `25 SUCCESS`.
  Production browser/server compilation and all 24 prerender routes completed
  within hard style budgets before the existing Windows `EPERM` generated-file
  cleanup lock.

## Collision-safe workshop save refinement (2026-08-01)

- Added a database trigger that serializes each requested occurrence slug and
  assigns the next available readable numeric suffix (`-2`, `-3`, and so on).
  This applies to both singular saves and the series-generation command, while
  the unique constraint remains the final integrity backstop.
- Moved each multi-occurrence destructive X into a dedicated grid cell aligned
  with the schedule inputs. The Customer Preview close control now uses a
  centered SVG rather than a font glyph with browser-dependent baseline
  alignment.
- Full Angular regression: `780 SUCCESS`. An isolated PostgreSQL 16 behavior
  check loaded the additive migration and confirmed three colliding writes
  allocate the base slug, `-2`, and `-3`; the temporary container was removed
  without modifying the separately running `supabase-us4` project.
- Production browser/server compilation and all 24 prerender routes completed.
  The command then encountered the existing Windows `EPERM` generated-output
  cleanup lock; existing bundle/style warnings and placeholder-Supabase fetch
  logging remain unchanged.

## Public Workshops heritage-header restoration (2026-08-01)

- Reviewed the pre-feature Workshops page from the Git diff and restored only
  its full-width photographic hero, responsive `WORKSHOPS` title treatment,
  and original `WORKSHOPS DESIGNED TO gather, create, celebrate` introduction
  and paragraph.
- The featured workshop carousel, date-ordered vertical list, lifecycle states,
  empty/error handling, analytics hooks, and private-inquiry addition remain in
  place immediately after the restored introduction.
- Focused public Workshops regression: `5 SUCCESS`. Production browser/server
  compilation and all 24 prerender routes completed; the command then reached
  the existing Windows `EPERM` generated-output cleanup lock. Existing
  placeholder-Supabase logging and bundle/style warnings remain.

## Series-driven public workshop discovery (2026-08-02)

- Removed the redundant “Gather, create, and flower / Upcoming floral
  workshops” heading block while retaining the restored photographic hero and
  original `WORKSHOPS DESIGNED TO gather, create, celebrate` introduction.
- Featured discovery now selects the first chronological featured occurrence
  once per normalized workshop title/concept. Its CTA opens the shared series
  presentation at `/workshops/:seriesSlug`, where a vertical occurrence list is
  rendered directly after “What is included”. Main-list Details links use
  `/workshops/:seriesSlug/:workshopDate`; date-specific reservation links append
  `/reserve` while booking remains authoritative by occurrence.
- Added the public series/date projection, booking-status handoff, canonical
  SEO/JSON-LD paths, SSR routes, analytics allowlisting, and series plus
  occurrence sitemap entries through additive migration
  `20260802000000_workshop_public_series_routes.sql` and matching declarative
  schema.
- Focused Angular regression: `62 SUCCESS`. Sitemap assertions pass. An
  isolated PostgreSQL 16 validation applied the prerequisite workshop slices
  and the new migration successfully, verified the helper/result/grant
  contracts, and was removed without touching the running `supabase-us4`
  project.
- Production browser/server compilation and all 24 prerender routes completed.
  The command then reached the existing Windows `EPERM` generated-output
  cleanup lock; existing bundle/style warnings and placeholder-Supabase fetch
  logging remain unchanged.

## Workshop terms and policy-panel refinement (2026-08-02)

- Featured carousel cards now advertise the number of upcoming occurrences in
  their series instead of presenting one occurrence date as the series date.
- Series and occurrence detail pages use the Privacy Policy floral-background
  and translucent-panel treatment. The redundant Workshop Details sidebar and
  inline terms were removed, full venue details remain in the hero, and the
  experience plus date-selection content uses the former warm sidebar color.
- Added an occurrence-specific, no-index Workshop Terms & Conditions route.
  The reserve page links to the exact snapshotted terms, no longer renders the
  full terms body inline, and still requires acceptance of that terms version
  before booking.
- Focused public workshop regression: `25 SUCCESS`. Production browser/server
  compilation and all 24 prerender routes completed. The command then reached
  the existing Windows `EPERM` generated-output cleanup lock; existing
  bundle/style warnings and placeholder-Supabase fetch logging remain.

## Compact responsive workshop-page refinement (2026-08-02)

- Restored the series and occurrence detail routes to the clean white public
  presentation while retaining the removed Workshop Details sidebar, full hero
  venue facts, and absence of inline terms.
- Reduced non-listing workshop page width, typography, spacing, imagery, and
  form density across series/detail, reservation, Workshop Terms, and booking
  status. Added explicit phone/tablet/laptop/desktop reflow, 360/390px phone
  handling, 44px form targets, wrapping actions, and iOS/Android safe-area
  padding without changing the main `/workshops` page.
- The full Angular regression passed `784 SUCCESS`. Production browser/server
  compilation and all 24 prerender routes completed with no new workshop-page
  stylesheet budget warning. The existing Windows `EPERM` generated-output
  cleanup lock, placeholder-Supabase logging, and unrelated existing budget
  warnings remain.
- In-app visual viewport automation could not initialize because its browser
  runtime could not create the local kernel assets. The breakpoint matrix is
  retained in the release quickstart for interactive device verification.

## Balanced public workshop forms and terms refinement (2026-08-02)

- Balanced top and bottom content padding on series, occurrence, reservation,
  and Workshop Terms routes so the normal-flow navbar no longer compounds a
  large blank area above the page content.
- Widened the Workshop Terms panel and rendered the exact stored terms snapshot
  as visually separated clauses when it contains the editor's heading/newline
  format. Clause titles are slightly larger and bold, and the desktop page title
  remains on one line without forcing phone layouts to overflow.
- Split reservation name entry into First Name and Last Name, paired name and
  email/phone controls on larger screens, removed the visible optional marker,
  widened the reservation panel, and reorganized the occurrence facts. The two
  name values are trimmed and combined into the unchanged `contactName` booking
  command contract.
- Reused the inquiry-form pink fade-in/fade-out validation tooltip treatment for
  invalid reservation controls, including an alert tooltip for required terms
  acceptance, and removed the separate inline terms error.
- Focused detail/terms/reservation regression: `11 SUCCESS`. Production browser
  and server compilation plus all 24 prerender routes completed with no new
  component stylesheet budget warning before the existing Windows `EPERM`
  generated-output cleanup lock.

## Booking confirmation, availability, and roster refinement (2026-08-02)

- Anchored reservation validation tooltips directly above their owning fields
  with reservation-local animation overrides, preserving the shared inquiry
  tooltip treatment elsewhere.
- Kept the existing no-index `/workshop-booking/status` experience for both
  confirmed Stripe bookings and florist-verification-pending Venmo bookings.
  Stripe success URLs now carry Stripe's single-use Checkout Session ID, which
  the status component removes from browser history before a standalone Edge
  command verifies it with Stripe and resolves the booking. No booking token is
  placed in a URL or durable browser storage. A verified checkout whose webhook
  is still reconciling displays the existing processing outcome.
- Added bounded public availability projection: an exact positive remaining
  seat count is returned only when remaining inventory is at or below 50% of
  capacity. The main listing, series/date detail, and reservation surfaces then
  display the same urgency fact.
- Corrected confirmation delivery so a booking queues one required confirmation
  when its status first transitions to `confirmed`, covering both Stripe
  reconciliation and florist-confirmed direct Venmo. Later confirmed-state
  updates cannot duplicate the queue item; the Mailgun template now states
  that payment is confirmed and seats are reserved.
- Replaced the inline CRM Add Reservation section with a responsive themed
  modal. The primary roster table now shows customer name, email, phone,
  purchased/active seats, booking status, payment status, and seat cancellation
  while the downloadable CSV remains the minimized projection.
- The clean non-watch Angular regression passed `792 SUCCESS` after stale
  Karma processes were cleaned up. All three modified Edge Functions
  independently passed `deno check --config supabase/deno.json`.
- Production browser/server bundles and all 24 prerender routes compiled. The
  command then reached the existing Windows `EPERM` generated-output cleanup
  lock; existing placeholder-Supabase logging and budget warnings remain.
- Isolated local Supabase startup was attempted without touching the separately
  running `supabase-us4` project. Validation stopped at the repository's
  pre-existing first migration because it references
  `proposal_signing_sessions` before that baseline relation exists; the
  isolated stack was backed up and stopped, and temporary port overrides were
  removed. The new pgTAP assertions remain ready for the established populated
  database workflow.

## Workshop roster controls and waitlist refinement (2026-08-02)

- Removed the visible booking reference column and the redundant Workshop
  operations eyebrow while retaining the support reference only in the existing
  minimized internal CSV contract.
- Added a booking-status dropdown beside the customer text filter. Both filters
  now apply to the table and minimized export, and the toolbar places Export
  minimized roster immediately before Add Reservation.
- Replaced the one-seat-only action with a per-booking quantity control bounded
  from one through the booking's current active seats. The existing
  authoritative partial-cancellation repository/database command is unchanged.
- Restyled the waitlist as an ordered queue with position, customer contact,
  requested seat count, state, bounded offer window controls, and a distinct
  empty state. Desktop and mobile layouts retain themed light/dark tokens.
- Focused roster regression passed `10 SUCCESS`; the complete Angular
  regression passed `795 SUCCESS`. This refinement changes no schema, Edge
  Function, provider configuration, environment secret, or public route.
- Production browser/server compilation and all 24 prerender routes completed.
  The roster stylesheet was reduced from a hard-budget failure to 7.95 kB,
  below the 8 kB component maximum. The command then reached the existing
  Windows `EPERM` generated-output cleanup lock at `dist/.../about/index.html`;
  existing placeholder-Supabase prerender logging and unrelated bundle/style
  warnings remain.

## Workshop roster theme and toolbar refinement (2026-08-02)

- Connected the full roster page, header, metrics, cards, table, inputs,
  buttons, state badges, waitlist, notices, modal, destructive controls, and
  focus indicators directly to the inherited CRM theme palette. Light and dark
  modes now resolve their own page, surface, elevated-input, border, text,
  accent, success, and danger colors without a light-only fallback winning in
  dark mode.
- Removed the Customer bookings eyebrow above Roster and removed the toolbar's
  panel background, border, radius, and padding while retaining the requested
  horizontal filter/status/export/Add Reservation order and responsive reflow.
- Added focused computed-style coverage for light page/card colors and dark
  page/card/input colors. Focused roster regression passed `11 SUCCESS`.
- The complete Angular regression suite passed `796 SUCCESS`. Production
  browser/server compilation and all 24 prerender routes completed, with the
  roster stylesheet at 7.96 kB and below its 8 kB hard component limit. The
  command then encountered the existing Windows `EPERM` generated-output
  cleanup lock at `dist/.../about/index.html`; existing placeholder-Supabase
  prerender logs and unrelated soft budget warnings remain.
- No schema, migration, Edge Function, environment secret, or public route was
  changed.

## Workshop roster table, cancellation, and print refinement (2026-08-02)

- Split customer email and phone into their own roster columns and replaced the
  inline quantity control with a Cancel Seats button that opens a bounded,
  customer-specific confirmation modal. The database roster command remains
  authoritative for the selected partial or full cancellation.
- Removed the waitlist eyebrow and explanatory sentence, enlarged the Waitlist
  title, reduced top padding on the roster page header and content cards, and
  enforced white Add Reservation text under the CRM dark theme.
- Replaced the CSV download with a printable, landscape Word-compatible `.doc`
  roster containing customer, email, phone, active seats, booking/payment
  states, and a physical check-in box. The generated document omits booking
  references, access tokens, provider identifiers, and other unnecessary
  operational data.
- Focused roster regression passed `14 SUCCESS`; the complete Angular suite
  passed `799 SUCCESS`, and the representative 100-row roster remained at
  1.0 ms p95. Production browser/server compilation and all 24 prerender routes
  completed with the roster stylesheet at 7.91 kB below its 8 kB hard limit.
  The command then reached the existing Windows `EPERM` cleanup lock at
  `dist/.../about/index.html`; existing placeholder-Supabase prerender logs and
  unrelated soft budget warnings remain.
- The in-app visual browser runtime could not initialize in this environment;
  ChromeHeadless component coverage verified the modal, columns, computed dark
  color, padding, and Word download behavior instead.
- No schema, migration, Edge Function, environment secret, or public route was
  changed.

## Workshop roster capacity metrics (2026-08-02)

- Added Scheduled Seats and Available Seats cards between Active Seats and
  Checked In. Scheduled Seats uses the occurrence operational-state capacity;
  Available Seats uses its authoritative remaining quantity so provisional
  holds are included in the capacity calculation.
- Expanded the desktop metric row to six cards while preserving the existing
  responsive two-column and single-column breakpoints.
- Added focused ordering, value, and operational-state loading coverage. The
  focused roster regression passed `12 SUCCESS`; the combined roster and scale
  regression passed `14 SUCCESS`, with 100 roster rows rendered at 1.1 ms p95.
- The complete Angular regression suite passed `797 SUCCESS`. Production
  browser/server compilation and all 24 prerender routes completed, with the
  roster stylesheet remaining at 7.96 kB below its 8 kB hard limit. The command
  then encountered the existing Windows `EPERM` generated-output cleanup lock
  at `dist/.../about/index.html`; existing placeholder-Supabase prerender logs
  and unrelated soft budget warnings remain.
- No schema, migration, Edge Function, environment secret, or public route was
  changed.

## Public workshop imagery, secure confirmation, and email refinement (2026-08-02)

- Enforced a real `16 / 9` display box for every Featured Workshop hero and
  the public workshop detail hero at desktop, tablet, and mobile breakpoints.
  The workshop advertising line now headlines The Experience and no longer
  repeats below the detail-page title.
- Expanded confirmed booking status with the workshop title, Eastern-local
  date and time, full venue, active seats booked, immutable accepted terms,
  refund/cancellation reminder, excited confirmation copy, and the florist's
  email and phone. The page now uses the reservation background and glass-card
  presentation responsively.
- Kept generic lost/expired-link recovery, placed existing-code access first,
  and restricted schedule-change response controls to an authenticated
  `action_required` status. They are no longer exposed on the generic
  unavailable-link screen.
- Booking confirmation and replacement-access email links now carry the
  single-purpose status token in the URL fragment. The Angular status page
  consumes and removes that fragment immediately before requesting status, so
  it is not retained in browser storage or sent as a query string. Confirmation
  mail now includes an elegant HTML layout, event facts, seat count, secure CTA,
  terms reminder, and florist contact details, with a text alternative.
- Added `20260802012000_workshop_status_event_details.sql` and matching
  declarative SQL. The status projection excludes contact data and credential
  fields. Focused pgTAP reconciliation/status regression passed `88` tests.
- Focused Angular regression passed `41 SUCCESS`; the complete Angular suite
  passed `801 SUCCESS`. The isolated production
  verification build completed browser/server bundles and all 24 prerendered
  routes; existing placeholder-Supabase prerender logs and soft size warnings
  remain. Deno 2.9.4 independently type-checked
  `process-workshop-messages/index.ts` successfully.
- The in-app browser runtime could not initialize its local kernel assets in
  this environment. ChromeHeadless computed-style coverage verified both 16:9
  image containers and the responsive confirmation-page DOM instead.

## Public workshop, Venmo, roster modal, and payment-email polish (2026-08-03)

- Enforced 16:9 imagery in the All Upcoming Dates list, sized the desktop
  Featured Workshop panel to the same height as its 16:9 image, and added a
  consistent inset frame around the series/occurrence detail hero. The stacked
  featured layout retains its independent mobile height below 850 px.
- Removed the obsolete lost/expired-link request form from the unavailable
  booking-status view while retaining the access-code fallback and the
  authenticated schedule-change response flow.
- Repaired the reservation loading and Venmo CTA encoding artifacts. The direct
  Venmo handoff now omits the visible support reference, asks the customer to
  include their booking name and email in the payment note, opens Venmo in a
  new tab, and presents the sent-payment action as a full secondary button.
  That action uses the booking access code from component memory to open the
  secure status route; the code is not rendered into the DOM or written to
  local/session storage.
- Replaced the circular roster-modal close control with the Floral Proposal
  Builder-style destructive X treatment and added a restrained cancellation
  accent while preserving CRM light/dark tokens and the existing bounded seat
  cancellation command.
- Rebuilt project payment requests, deposit/final reminders, receipts, and
  adjustment notices with the inquiry-email visual language: a dark branded
  header, blush detail card, prominent amount, responsive secure-payment CTA,
  support copy, and a plain-text alternative. The existing Mailgun claim,
  retry, suppression, and outcome-recording pipeline is unchanged.
- Focused Angular regression passed `40 SUCCESS`; the complete Angular suite
  passed `801 SUCCESS`, and the final roster-only check passed `14 SUCCESS`.
  The isolated production build completed browser/server bundles and all 24
  prerendered routes within the 8 kB hard roster stylesheet budget. Existing
  placeholder-Supabase prerender logs and unrelated soft size warnings remain.
  Deno independently formatted and passed `deno check --config
  supabase/deno.json` for `process-payment-messages/index.ts`.
- Per the Edge Function testing boundary, no automated Edge Function test was
  added. The in-app browser runtime again could not initialize its local kernel
  assets, so ChromeHeadless DOM/computed-style coverage and the production
  browser build supplied the visual regression evidence.
- No schema, migration, new environment secret, or payment-delivery contract
  change is required for this refinement.

## Workshop roster, CRM catalog, and public presentation refinement (2026-08-03)

- Framed the Cancel Seats quantity control as a themed inset card, added clear
  bounded-cancellation guidance and button spacing, and reduced roster cell and
  button height so customer rows are easier to scan without removing email,
  phone, seat, status, payment, or cancellation data.
- Compressed the CRM workshop cards and their lifecycle pills/actions, removed
  the advertising line, Stripe-enabled label, and calendar-related subtitle,
  while retaining the separate Privacy and retention administration route.
- Repaired Public preview to generate the same normalized series slug used by
  the public SQL projection and route to the occurrence's local workshop date:
  `/workshops/{workshop-title}/{workshop-date}`.
- Restored the Featured Workshop panel's original independently sized desktop
  layout. Enlarged the 16:9 hero on workshop series/occurrence detail pages,
  increased its left inset, and rendered The Experience advertising headline
  in title case.
- Focused Angular regression passed `29 SUCCESS`; the complete Angular suite
  passed `803 SUCCESS`. The production build passed in a fresh isolated output
  directory with all 24 prerender routes and the roster stylesheet at 7.99 kB,
  below its 8 kB hard limit. The standard `dist` output remains subject to an
  unrelated Windows lock on its generated `about/index.html`; placeholder
  Supabase prerender logs and existing soft size warnings remain.
- The in-app browser runtime could not initialize its local kernel assets in
  this environment. ChromeHeadless DOM/computed-style assertions verified the
  modal spacing, compact rows, public detail inset, 16:9 imagery, and title-case
  content instead.
- No schema, migration, Edge Function, environment secret, or payment contract
  change was required.

## CRM privacy settings, featured image inset, and reservation total refinement (2026-08-04)

- Moved workshop privacy and retention administration out of the Workshops
  toolbar and into a dedicated CRM Settings sidebar group at
  `/admin/settings/workshop-privacy-policy`. The existing
  `/admin/workshops/privacy-policy` URL remains a full redirect for saved links,
  while the canonical route retains the existing admin authorization guard.
- Generalized sidebar group state so Proposal Settings and CRM Settings expand
  independently. Reworked the privacy administration surface to consume the
  shared CRM page, surface, border, text, input, and accent tokens with
  responsive tables/forms for both light and dark mode.
- Added equal responsive top, bottom, and left insets around the public Featured
  Workshop hero while keeping the rendered image at a true 16:9 ratio.
- Added a polite live reservation Total directly below the workshop facts. It
  multiplies the displayed tax-inclusive per-seat price by the current seat
  quantity and updates singular/plural seat copy immediately; the authoritative
  booking service remains responsible for final capacity and charged totals.
- Focused route/sidebar/privacy/public-workshop/reservation regression passed
  `41 SUCCESS`; the complete Angular suite passed `806 SUCCESS`. The normal
  production build compiled browser/server bundles and prerendered all 24 routes
  before encountering the existing Windows lock on
  `dist/.../about/index.html`; a fresh ignored output-path build then passed with
  the existing soft bundle/style warnings and placeholder-Supabase prerender
  logs.
- The in-app visual browser runtime could not initialize its local kernel assets
  in this environment. ChromeHeadless DOM and computed-style assertions verified
  the dark theme colors, independent settings navigation, equal image insets,
  16:9 image ratio, and live total instead.
- No schema, migration, Edge Function, environment secret, or payment contract
  change was required.

## Reservation total and pending Venmo confirmation polish (2026-08-04)

- Replaced the reservation total's small stacked seat-count treatment with a
  bold, equal-size inline `Total:` label and currency amount. The live amount
  continues to update from the current quantity while the selected-seat helper
  copy is no longer displayed.
- Removed the support-reference label and value from the pending direct-Venmo
  confirmation state. Added a blush contact panel explaining that customers
  should email `becca@blackbegoniaflorals.com` or text `(401) 871-4996` if no
  confirmation arrives within 24 hours.
- Restyled Browse upcoming workshops as a responsive blush CTA button while
  preserving its clean `/workshops` destination.
- Focused reservation/status regression passed `15 SUCCESS`; the complete
  Angular suite passed `807 SUCCESS`. A fresh ignored output-path production
  build passed, compiling browser/server bundles and prerendering all 24 routes
  with the existing soft bundle/style warnings and placeholder-Supabase
  prerender logs.
- The in-app visual browser runtime could not initialize its local kernel assets
  in this environment. ChromeHeadless DOM and computed-style assertions verified
  the inline total typography, hidden reference, contact links, and blush CTA.
- No schema, migration, Edge Function, environment secret, or payment contract
  change was required.

## Workshop imagery and roster Venmo reconciliation (2026-08-04)

- Removed Browse upcoming workshops only from the unavailable-access status
  view; valid confirmation, pending-payment, and other resolved states retain
  the existing workshop CTA. Replaced the background photograph on the secure
  booking status, reservation, and workshop terms screens with
  `FizzFritesLadyFingerLounge_Apr3_KCP208.jpg`.
- Increased each CRM workshop occurrence card from the compact `p-3` inset to
  `p-4`, preserving the previously reduced row content and controls.
- Added Confirm Venmo Payment to eligible pending direct-Venmo roster rows.
  The florist records the Venmo transaction ID, exact amount received, and
  receipt time in a CRM modal. The financial repository passes those facts to
  the existing `record_workshop_venmo_receipt` database command; the browser
  never directly changes booking or payment state.
- Exact, on-time receipts confirm the booking through the existing database and
  confirmation-delivery workflow. Underpayments, overpayments, late receipts,
  duplicate provider IDs, and unmatched facts remain pending and enter the
  existing payment-exception review path. Internal reconciliation references
  are not displayed in the roster or modal.
- Focused workshop regression passed `47 SUCCESS`; representative scale checks
  passed with a 100-row roster p95 of `9.0ms`; and the complete Angular suite
  passed `811 SUCCESS`. A fresh isolated production build compiled browser and
  server bundles and prerendered all 24 routes with the existing soft size
  warnings and placeholder-Supabase prerender logs.
- The in-app visual browser runtime could not initialize its local kernel assets
  in this environment. ChromeHeadless DOM and computed-style coverage verified
  the changed imagery, unavailable CTA removal, card padding, and Venmo roster
  workflow.
- No new schema, migration, Edge Function, environment secret, or payment
  contract was needed; this UI activates the already-delivered Venmo
  reconciliation boundary.

## Workshop roster action and seat-count refinement (2026-08-04)

- Reordered each eligible booking's actions so Cancel Seats appears first and
  Confirm Venmo Payment appears second, with a responsive wrapped gap between
  them.
- Inverted roster primary-button text treatment as requested: light text in CRM
  light mode and dark text in CRM dark mode. This covers Add Reservation and
  direct-Venmo confirmation controls without changing their accent background.
- Corrected the derived Active Seats metric to omit bookings whose status is
  `expired` or `cancelled`. Pending-payment seats remain included because their
  active holds still reserve capacity. The authoritative Scheduled Seats and
  Available Seats projections remain unchanged.
- Normalized 10-digit and leading-`1` U.S. phone values to `(XXX) XXX-XXXX` for
  roster display while retaining the stored value in the `tel:` link and
  preserving non-U.S./unrecognized values without destructive rewriting.
- Focused roster regression passed `18 SUCCESS`; the complete Angular suite
  passed `813 SUCCESS`, including a 100-row roster p95 of `0.7ms`. A fresh
  isolated production build compiled browser/server bundles and prerendered all
  24 routes with the existing soft size warnings and placeholder-Supabase
  prerender logs.
- The in-app visual browser runtime could not initialize its local kernel assets
  in this environment. ChromeHeadless DOM and computed-style coverage verified
  action order/spacing, theme text colors, active-seat status filtering, and
  phone formatting.
- No schema, migration, Edge Function, secret, or deployment configuration
  change was required.

## Public workshop styling and Stripe webhook idempotency (2026-08-15)

- Refreshed the public workshop listing, series, and occurrence pages with a
  warmer editorial card treatment while preserving their existing content.
  Upcoming dates now use consistent rectangular `See Details` arrow actions,
  and both private-workshop inquiry surfaces have a more deliberate floral
  presentation.
- Softened the pending direct-Venmo email and phone links with a smaller,
  medium-weight sans-serif treatment while retaining their accessible link
  behavior.
- Traced the reported `P0001 not_found`, provider-transaction uniqueness, and
  webhook 500 logs to valid Stripe success events arriving in different
  orders. The webhook now reconciles a `charge.succeeded` event's Payment
  Intent before its fee, and the database treats later Checkout Session or
  Payment Intent success events for the same provider charge as semantic
  duplicates. The fee keeps its own stable event identity, so retries remain
  idempotent without losing financial detail.
- Deploy `20260815000000_workshop_stripe_event_idempotency.sql` before the
  revised `stripe-payment-webhook`. The migration is additive and leaves
  historical provider events and transactions intact.
- Validation passed: the full Angular suite completed with `819 SUCCESS`, Deno
  type checking passed for the webhook, Deno formatting passed, and an isolated
  production build compiled and prerendered all 24 routes. The build retained
  existing soft size warnings and placeholder-Supabase prerender logs; the
  redesigned detail stylesheet remains below its hard 8 kB budget.
- The updated pgTAP scenario was not executed locally because the Docker
  Desktop Linux engine was unavailable. The in-app Browser backend was also
  unavailable, so DOM and computed-style assertions plus the production build
  supplied the UI verification in this environment.

## Workshop detail hero refinement (2026-08-15)

- Replaced the blush, bordered hero container on both canonical workshop detail
  routes with a clean editorial masthead. The workshop theme and oversized
  title now introduce an asymmetric composition with the existing 16:9 image,
  an arched image corner, and a fine-rule details rail.
- Preserved the complete when, venue/address, per-seat, availability, lifecycle,
  and reservation content. The facts are no longer placed in cards; labels and
  values use an unboxed typographic hierarchy with simple dividers.
- Kept the approved dark floral private-workshop CTA and added descriptive copy
  covering birthdays, showers, team gatherings, creative afternoons, and the
  group/date/style details customers should provide.
- Focused component coverage passed `7 SUCCESS`; the full Angular suite passed
  `819 SUCCESS`. The isolated production build compiled and prerendered all 24
  routes, and the detail stylesheet finished at 7.76 kB, below its hard 8 kB
  budget. Existing initial/soft budget warnings and placeholder-Supabase
  prerender logs remain unchanged.
- The in-app Browser backend exposed no available browser session, so rendered
  DOM/computed-style assertions and the production build supplied validation in
  this environment.

## Workshop detail hero balance refinement (2026-08-15)

- Reworked the prior asymmetric image/side-rail layout after visual feedback.
  The theme and oversized title now lead into one uninterrupted, centered 16:9
  image, eliminating the narrow rail and unusual arched crop that made the hero
  feel disconnected.
- Attached one deep-ink information band directly beneath the image. When,
  Where, and Per seat share a three-column typographic rhythm with fine dividers
  rather than individual cards; lifecycle/availability messaging and the
  reservation action form a separate aligned row within the same band.
- On narrow screens the facts become a clearly ruled vertical sequence and the
  booking action expands to the available width. All existing content and both
  canonical workshop route variants remain intact.
- Focused component coverage passed `7 SUCCESS`; the full Angular suite passed
  `819 SUCCESS`. The isolated production build compiled and prerendered all 24
  routes, with the detail stylesheet at 7.99 kB beneath its hard 8 kB limit.
  Existing initial/soft budget warnings and placeholder-Supabase prerender logs
  remain unchanged.
- The in-app Browser backend again exposed no browser session, so live visual
  inspection was unavailable in this environment.

## Workshop detail title placement refinement (2026-08-15)

- Removed the theme/title masthead from above the hero image on both workshop
  detail route variants, making the 16:9 image the first visual hero content.
- Moved the existing theme and semantic `h1` into the attached deep-ink
  information band. This preserves page content, document hierarchy, SEO, and
  accessibility while satisfying the requested visual order.
- Focused component coverage passed `7 SUCCESS`. The isolated production build
  compiled and prerendered all 24 routes, with the detail stylesheet at 7.93 kB
  beneath its hard 8 kB limit. Existing soft budget warnings and
  placeholder-Supabase prerender logs remain unchanged.

## Workshop detail hero simplification (2026-08-15)

- Removed the remaining visible workshop title from the deep-ink band after the
  relocated heading continued to make the hero feel visually heavy. The hero
  now moves directly from the 16:9 image into a compact theme, facts,
  availability, and action treatment.
- Preserved the workshop name in the visible breadcrumb and as a visually
  hidden semantic `h1`, maintaining document structure, accessibility, and SEO
  without reintroducing visual title weight.
- Focused component coverage passed `7 SUCCESS`. The isolated production build
  compiled and prerendered all 24 routes, with the detail stylesheet at 7.94 kB
  beneath its hard 8 kB limit. Existing soft budget warnings and
  placeholder-Supabase prerender logs remain unchanged.
- The in-app Browser backend again exposed no available session, so live visual
  inspection was unavailable in this environment.

## Workshop detail final side-panel composition (2026-08-15)

- Placed the deep-ink details treatment to the right of the 16:9 image on both
  workshop detail routes and restored the visible semantic title inside that
  panel.
- Reduced the panel's visual weight with a smaller title scale, tighter padding,
  compact vertically ruled When/Where/Per seat facts, and one full-width action
  beneath availability/lifecycle messaging. The panel stacks below the image
  below 960px to avoid crowding on tablets and phones.
- Focused component coverage passed `7 SUCCESS`. The isolated production build
  compiled and prerendered all 24 routes, with the detail stylesheet at 7.54 kB
  beneath its hard 8 kB limit. Existing soft budget warnings and
  placeholder-Supabase prerender logs remain unchanged.
- The in-app Browser backend again exposed no available session, so live visual
  inspection was unavailable in this environment.

## Workshop detail side-panel height alignment (2026-08-15)

- Changed the desktop hero grid's cross-axis alignment from start to stretch so
  the deep-ink details panel fills the same rendered row height as the adjacent
  16:9 image on both workshop detail route variants.
- Preserved the existing single-column breakpoint below 960px, where the image
  and panel remain naturally sized and stacked for tablets and phones.
- Focused component coverage passed `7 SUCCESS`. The isolated production build
  compiled and prerendered all 24 routes, with the detail stylesheet unchanged
  at 7.54 kB. Existing soft budget warnings and placeholder-Supabase prerender
  logs remain unchanged.
- The in-app Browser backend again exposed no available session, so live visual
  inspection was unavailable in this environment.

## Workshop detail hero scale and spacing refinement (2026-08-16)

- Increased the shared series/occurrence hero's desktop maximum width from
  72rem to 90rem, an exact 25% increase, and widened its containing shell so the
  new cap is not constrained while the narrower content sections retain their
  existing widths.
- Added 30px to the existing breadcrumb bottom spacing, moving the hero lower
  without changing its image/panel proportions or the stacked layout below
  960px.
- Focused component coverage passed `7 SUCCESS`. The isolated production build
  compiled and prerendered all 24 routes, with the detail stylesheet at 7.56 kB.
  Existing soft budget warnings and placeholder-Supabase prerender logs remain
  unchanged.
- The in-app Browser backend exposed no available session, so live visual
  inspection was unavailable in this environment.

## Workshop detail fact typography refinement (2026-08-16)

- Increased the When, Where, and Per seat labels from 0.6rem to 0.7rem and the
  standard fact values from 1rem to 1.15rem on both workshop detail routes.
- Increased the emphasized seat price from 1.4rem to 1.6rem, preserving its
  visual priority within the deep-ink side panel. The selectors are scoped to
  hero facts so unrelated definition lists are unaffected.
- Focused component coverage passed `7 SUCCESS`, including exact rendered font
  size assertions. The isolated production build compiled and prerendered all
  24 routes, with the detail stylesheet at 7.58 kB. Existing soft budget
  warnings and placeholder-Supabase prerender logs remain unchanged.
- The in-app Browser backend exposed no available session, so live visual
  inspection was unavailable in this environment.

## Confirm Venmo Payment modal spacing refinement (2026-08-04)

- Increased the modal's Confirm Venmo Payment heading to a 36px display size
  and added 24px of separation between the verification guidance and the Venmo
  transaction ID controls.
- Used existing global layout utilities so the already-near-limit roster
  component stylesheet remains unchanged at 7.99 kB.
- Focused roster regression passed `18 SUCCESS`; the complete Angular suite
  passed `813 SUCCESS`. A fresh isolated production build compiled browser and
  server bundles and prerendered all 24 routes with the existing soft size
  warnings and placeholder-Supabase prerender logs.
- The in-app visual browser runtime could not initialize its local kernel assets
  in this environment. ChromeHeadless computed-style assertions verified the
  36px title and 24px content separation.
- No schema, migration, Edge Function, secret, or deployment configuration
  change was required.

## Feature-wide workshop responsiveness (2026-08-16)

- Audited and registered all 17 workshop-spec UI surfaces: the public listing,
  series and occurrence details, terms, reservation and booking status;
  workshop list/editor/preview, occurrence operations, roster, financials, and
  retention policy; customer payment options/status; and payment list plus its
  obligation and settings dialogs.
- Added one shared responsive contract using component container queries so CRM
  pages also reflow correctly beside the private navigation rail, where viewport
  media queries alone can overestimate the usable content width. Public and
  customer flows retain viewport fallbacks and safe-area-aware phone padding.
- Reflowed multi-column content, toolbars, actions, forms, hero compositions,
  summaries, and modal footers at surface-appropriate breakpoints. Long content
  can wrap without widening a page, operational tables scroll inside bounded
  wrappers, dialogs use dynamic viewport-height limits, and the densest CRM
  views receive deliberate ultrawide maximum widths.
- Added an opt-in Karma viewport matrix covering 375x812 iPhone, 412x915
  Android, 768x1024 tablet, 1280x800 laptop, 1920x1080 desktop, and 2560x1080
  ultrawide launch sizes. The responsive contract passed `24 SUCCESS` across
  the six simultaneous Chromium instances, and the complete Angular regression
  passed `823 SUCCESS`.
- An isolated production build compiled successfully, emitted the responsive
  global stylesheet, and prerendered all 24 static routes. Existing soft bundle
  and component-style warnings and placeholder-Supabase prerender fetch logs
  remain unchanged in kind.
- The required in-app Browser backend exposed no available session
  (`agent.browsers.list()` returned an empty list), so live visual inspection
  could not be performed in this environment. No alternative browser-control
  backend was substituted.
- No schema, migration, Edge Function, secret, or deployment configuration
  change was required for this responsive-only refinement.

## Stripe reconciliation deadlock correction (2026-08-16)

- Diagnosed production PostgreSQL `40P01` evidence showing concurrent
  `reconcile_workshop_stripe_event` calls deadlocking while acquiring
  `FOR UPDATE` on the same `workshop_payment_attempts` tuple. Each call had
  already inserted provider evidence, whose attempt foreign key held a
  key-share lock; the later strong-lock upgrades therefore formed a cycle.
- Changed the authoritative command to lock an existing payment attempt before
  inserting provider evidence and to use the narrower `FOR NO KEY UPDATE` mode.
  This establishes one consistent serialization point for simultaneous Stripe
  Checkout Session, Payment Intent, and Charge success variants while retaining
  all existing booking, capacity, exception, transaction, and replay behavior.
- Made provider-event insertion conflict-safe for identical simultaneous Stripe
  event deliveries. The fast replay path remains intact, while a caller that
  raced past it now reads and returns the winning durable event instead of
  surfacing a uniqueness error.
- Repaired the intended unmatched-money path: when an attempt ID cannot be
  resolved, provider evidence is stored with a null attempt foreign key, the
  requested ID remains only in protected normalized facts, and an urgent
  `unmatched_payment` exception is created for manual reconciliation.
- Added additive migration
  `20260816000000_workshop_stripe_reconciliation_lock_order.sql`; the already
  deployed `20260815000000_workshop_stripe_event_idempotency.sql` remains
  unchanged. Production deployment was not performed by the implementation
  workflow.
- Wrote the pgTAP lock-order/replay/unmatched contract before the function
  change and confirmed the prior definition failed all three structural checks.
  After implementation, all three checks passed. The new migration compiled in
  a PostgreSQL-compatible PGlite runtime, and an executable unmatched-provider
  scenario returned `unmatched`, persisted terminal evidence with a null
  attempt link, and created the expected `unmatched_payment` exception. A second
  executable scenario retained the complete success path: the first trusted
  event confirmed the booking, attempt, and hold; an identical replay returned
  the stored event; a different success variant for the same PaymentIntent was
  marked duplicate; and exactly one charge transaction remained.
- A live multi-session pgTAP run still belongs to the operator environment
  because no local Supabase/PostgreSQL service is attached here. After applying
  the migration, replay the failed Stripe events and verify one processed charge,
  duplicate terminal states for redundant variants, zero `40P01` entries, and
  the expected booking confirmation and Stripe fee fact.

## 2026-08-16 - T184 public workshop phone refinement

- Replaced the narrow desktop-style upcoming-date rows on phone viewports with
  full-width editorial cards: a 16:9 image leads each card, the month/day appears
  as a high-contrast image badge, content has a dedicated reading area, status
  and price share a compact line, and the See Details action spans the card.
- Tightened and balanced the phone featured-workshop treatment with a flush
  image, compact type and spacing, a full-width action, and contained carousel
  controls. The private-workshop CTA remains stacked and touch-friendly.
- Set the breadcrumb-to-hero spacing to exactly `10px` below the shared 640px
  detail breakpoint, covering both series and dated occurrence routes while
  retaining the expanded desktop spacing.
- Added phone layout and breadcrumb-spacing regression coverage. The focused
  six-viewport matrix passed 114/114 checks, the full Angular suite passed
  825/825 tests, and the isolated production build completed successfully.
  Existing bundle/style budget warnings and placeholder Supabase prerender
  fetch messages remain unchanged.
- The in-app browser surface was unavailable in this session, so verification
  used the repository's Chrome viewport matrix rather than an interactive
  screenshot review.

## 2026-08-16 - T185 series hero upcoming-events action

- Added a `View Upcoming Events` action inside the undated workshop series hero
  beneath its When, Where, and Per seat facts. It is a non-navigation button
  that calls `scrollIntoView({ block: 'center' })` on the rendered Choose your
  date section, centers the destination without a scroll-margin offset, keeps
  the current workshop route and URL unchanged, and respects reduced-motion
  preference.
- Kept the action entirely absent from dated occurrence detail pages, leaving
  their reservation and lifecycle controls unchanged.
- The focused detail suite passed 7/7 tests, the full Angular suite passed
  825/825 tests, and the isolated production build completed successfully.
  Existing style/bundle budget warnings and placeholder Supabase prerender
  messages remain unchanged.
- The regression verifies that the control has no `href`, scrolls the intended
  section to the center of the viewport, and leaves the Angular router URL
  unchanged. The in-app browser surface was unavailable in this session.

## 2026-08-16 - T186 hero detail vertical distribution

- Converted the workshop hero details panel into a full-height flex column with
  `justify-content: space-between`, allowing the image-matched panel height to
  distribute its heading group, workshop facts, status, and action vertically.
- Kept the theme eyebrow (for example, `Holiday`) above the workshop title in a
  dedicated heading group that anchors the top edge. The booking/action group
  remains the final panel element, anchoring View Upcoming Events on series
  pages and the applicable reservation action on dated occurrence pages to the
  bottom edge.
- Made the When, Where, and Per seat facts a flexible middle column that grows
  into the remaining panel height and uses `space-evenly`, giving each fact
  balanced breathing room between the heading group and bottom action.
- Added focused layout assertions for the flex direction, space-between
  distribution, eyebrow/title grouping, evenly distributed flexible facts,
  action ordering, and preserved series CTA behavior. The focused detail suite
  passed 7/7 tests, the full Angular suite passed 825/825, and the isolated
  production build completed successfully. Existing budget warnings and
  placeholder Supabase prerender messages remain unchanged. The in-app browser
  surface was unavailable for a live screenshot review.

## 2026-08-16 - T187 confirmed booking layout refinement

- Removed the confirmed-state `Return to the workshop` button and its unused
  component navigation method while preserving the general Browse upcoming
  workshops action supplied by the status shell.
- Rebuilt the confirmed event facts on a six-column grid: Workshop and Location
  each occupy half of the first row, while Date, Time, and Seats booked each
  occupy one third of the second row. The grid reflows to two columns on smaller
  tablets/phones and one column on narrow phones.
- Combined every address part into a single non-wrapping address line beneath
  the venue name. Long addresses stay on one line and can scroll within their
  bounded location cell instead of overflowing the confirmation card.
- Expanded the contact message to explain that Becca can help with booking or
  workshop questions and is reachable through the displayed email address or
  phone number. Reduced confirmation heading, section, table-cell, reminder,
  and contact spacing to produce a shorter vertical presentation.
- The focused status suite passed 9/9 tests, the full Angular suite passed
  825/825, and the isolated production build completed successfully. Existing
  budget warnings and placeholder Supabase prerender messages remain unchanged.
  The in-app browser surface was unavailable for a live responsive review.

## 2026-08-20 - T188-T190 established occurrence management

- Kept `Add workshop occurrence` horizontally aligned with the Single date or
  workshop series heading for both new and established workshops. Saving an
  established edit now persists every appended schedule row with the current
  workshop definition and, when present, its existing series relationship.
- Added confirmation before removing an unsaved schedule row. Saved draft or
  published occurrences first count all reservation records. Any count above
  zero opens a blocking alert and never offers deletion; zero reservations
  produces an irreversible-delete confirmation before invoking the guarded
  catalog command.
- Added migration
  `20260820000000_workshop_occurrence_edit_management.sql`. The database command
  locks the occurrence, repeats the reservation check to close the UI-to-write
  race, and relies on existing restrictive foreign keys to preserve any other
  operational or financial history.
- The focused editor/repository suite passed 33/33 tests and the dev Angular/SSR
  build completed. The full suite completed 828/829 tests; its sole failure is
  the pre-existing in-progress public workshop-detail style expectation in the
  user's separate working-tree changes (`51.6px` expected versus `21.6px`, and
  `none` expected versus the current gradient). The production build reached
  bundle/prerender output but remains blocked by that same modified public
  detail stylesheet exceeding its 8 kB error budget by 223 bytes. A local
  Supabase/PostgreSQL runner is not installed or attached, so the new pgTAP
  database contract remains for operator execution after applying the migration.

## 2026-08-20 - T191 established occurrence republish correction

- Diagnosed production PostgREST `55000 workshop occurrence cannot be published`
  responses as a redundant frontend lifecycle transition: after saving the
  established row, the editor attempted to publish it even when the database
  correctly returned `published_open`.
- The editor now invokes `publish_workshop_occurrence` only when Save and publish
  receives a saved row in `draft` or `registration_closed`. An established open
  row remains open without another transition, while each newly appended draft
  is still published.
- Added a regression with one established published occurrence and one appended
  draft. It verifies two saves but exactly one publish call, targeting only the
  appended occurrence. The focused editor/repository suite passed 34/34 tests.
  This is an application deployment correction and requires no follow-up SQL
  migration beyond the already published occurrence edit-management migration.

## 2026-08-20 - T192 concept-grouped CRM workshop catalog

- Replaced occurrence-per-card rendering on `/admin/workshops` with one card per
  stable `workshop_definition_id`. Each card shows its chronologically ordered
  occurrence dates and retains date-specific roster, edit, public-preview,
  publish, delete, and archive controls. Lifecycle filtering is applied before
  grouping, so a filtered concept card contains only matching occurrences.
- Established edits now call replay-safe `update_workshop_concept` after saving
  occurrence-specific form data. The atomic command updates authoritative
  definition copy and every occurrence title, advertising line, description,
  included-materials, and terms snapshot. Changed terms increment the concept
  terms version. Schedule, venue, capacity, price, payment configuration, and
  lifecycle state remain occurrence-specific and are not part of the patch.
- Added declarative SQL and additive migration
  `20260821000000_workshop_concept_updates.sql`, plus pgTAP contracts for command
  presence, definition/snapshot propagation, and capacity preservation.
- Focused admin/editor/repository coverage passed 45/45 tests. The adjusted
  500-occurrence scale scenario passed 2/2 with the grouped card rendering all
  500 occurrence rows at 151.3 ms p95. TypeScript spec compilation and the dev
  Angular/SSR build passed. A local Supabase/PostgreSQL runner is unavailable,
  so the pgTAP contract remains for operator execution after the new migration.
- The production build compiled and prerendered but remains blocked by the
  user's separate public workshop-detail stylesheet exceeding its 8 kB error
  budget. The full suite completed 833/834 tests; its sole remaining public
  workshop-detail computed-style expectation is likewise outside this
  refinement and unchanged here.

## 2026-08-20 - T193 Stripe roster-refund PaymentIntent correction

- Traced the CRM refund-order 502 to the function's explicit Stripe rejection
  response. The absence of a Supabase log was expected from the old code because
  its non-2xx provider branch persisted failure state and returned 502 without
  logging the provider status.
- Workshop reconciliation intentionally stores the canonical Stripe
  PaymentIntent ID (`pi_...`) as the paid charge transaction's provider
  reference. The refund endpoint incorrectly submitted that value in Stripe's
  `charge` field, which accepts `ch_...` identifiers. It now chooses
  `payment_intent` for `pi_...` and retains `charge` compatibility for `ch_...`.
  Unsupported prefixes are rejected before a durable refund request is created.
- Added an early missing-key configuration response and redacted provider
  diagnostics containing only status, Stripe request ID, bounded error
  type/code/parameter, and the internal refund request UUID. Provider response
  messages/bodies, credentials, and customer data remain excluded.
- No migration or automated Edge Function test was added. The feature plan
  explicitly requires independent Edge Function type-checking instead. Deno
  check passed, and the focused roster plus financial-repository regression
  passed 30/30 tests. Deployment requires the current
  `refund-workshop-payment` function and a `STRIPE_RESTRICTED_KEY` with Refunds
  write permission.

## 2026-08-20 - T194 Stripe refund webhook roster reconciliation

- Traced the successful-Stripe/stale-roster outcome to webhook metadata
  precedence. Loading the related Checkout Session replaced the refund object's
  metadata, dropping `workshop_refund_request_id`; the immutable refund fact
  could be recorded, but the request could not transition to `reconciled`, so
  its seat-release trigger never ran.
- The webhook now merges Session metadata with authoritative refund metadata,
  accepts `refund.failed`, and invokes a replay-safe database reconciliation
  after confirmed refund evidence is durable. The additive
  `20260821010000_workshop_refund_webhook_reconciliation.sql` migration can also
  attach an already-recorded Stripe refund fact to its request when the same
  provider event is resent after deployment. Failed provider outcomes create an
  urgent financial exception and preserve seats.
- The roster now derives refund badges from authoritative `payment_state`:
  partial refunds display `Partially refunded` in green with the reduced active
  count; full refunds display `Refunded` in red with zero active seats. After
  Stripe accepts a request, the component performs bounded authoritative reloads
  while awaiting webhook reconciliation and never decrements seats locally.
- Focused roster coverage passed 24/24 tests. The existing Edge Function was
  not targeted by an automated test per the feature constraint; standalone
  `deno check --config supabase/deno.json` passed. PostgreSQL assertions were
  added for detached-evidence recovery and asynchronous failure without seat
  release, but could not run locally because neither Supabase CLI nor the Docker
  daemon is available. The production build compiled and prerendered; its final
  gate remains blocked by the user's separate public workshop-detail stylesheet
  exceeding the 8 kB component budget by 279 bytes. The roster stylesheet no
  longer exceeds its error budget after compaction.
