# Tasks: Integrated Project Payments

**Input**: Design documents from `/specs/007-project-payments/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/integrated-project-payments.md`, `quickstart.md`

**Tests**: The specification requires focused Karma/Jasmine and PostgreSQL integration coverage. No automated test file or harness may target, import, invoke, or simulate a Supabase Edge Function; each function is independently type-checked and validated with documented provider/customer sandbox smoke checks.

**Organization**: Tasks are grouped by user story. Shared financial integrity, migration, security, and read-model work is completed first because every story depends on the same authoritative obligations and immutable ledger.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when its prerequisite tasks are complete and listed files do not overlap
- **[Story]**: Maps to the six user stories in `spec.md`
- Every implementation task names its target file or directory

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish configuration contracts, baseline behavior, and test locations without introducing secrets or changing marketing surfaces.

- [X] T001 Record the provider, Mailgun, Cron/Vault, customer-route, CRM-route, rollout-switch, and no-marketing-change configuration inventory in `specs/007-project-payments/quickstart.md`
- [X] T002 Add typed public-origin and provider capability configuration fields without secret values in `src/environments/environment.model.ts`, `src/environments/environment.ts`, and `src/environments/environment.prod.ts`
- [X] T003 Add environment contract tests proving privileged Stripe, PayPal, Mailgun, token-encryption, service-role, and automation secrets cannot be supplied through Angular configuration in `src/environments/environment.spec.ts` and `src/environments/environment.prod.spec.ts`
- [X] T004 [P] Capture legacy conversion, manual payment, 45-day status refresh, Financial Summary, activity, project route, and proposal revision fixtures in `src/app/core/testing/workflow-fixtures.ts` and `supabase/tests/integrated_project_payments.sql`
- [X] T005 Document the staged enablement and rollback order for manual RPC, request email, Stripe, Venmo, and reminders in `specs/007-project-payments/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the additive schema, migration, immutable financial boundary, RLS, compatibility layer, and shared Angular contracts required by every story.

**CRITICAL**: No user-story implementation starts until this phase passes migration, RLS, and aggregate-parity checks.

- [X] T006 [P] Define obligation, request, request-obligation, checkout-attempt, and collection-settings declarative tables in `supabase/schemas/public/tables/project_payment_records.sql`, `supabase/schemas/public/tables/payment_requests.sql`, `supabase/schemas/public/tables/payment_request_obligations.sql`, `supabase/schemas/public/tables/payment_checkout_attempts.sql`, and `supabase/schemas/public/tables/payment_collection_settings.sql`
- [X] T007 [P] Define append-only transaction, allocation, intention, delivery, normalized delivery-event, provider-event, exception, and project legal-hold audit tables in `supabase/schemas/public/tables/payment_transactions.sql`, `supabase/schemas/public/tables/payment_transaction_allocations.sql`, `supabase/schemas/public/tables/payment_intentions.sql`, `supabase/schemas/public/tables/payment_message_deliveries.sql`, `supabase/schemas/public/tables/payment_message_delivery_events.sql`, `supabase/schemas/public/tables/payment_provider_events.sql`, `supabase/schemas/public/tables/payment_exceptions.sql`, and `supabase/schemas/public/tables/payment_legal_holds.sql`
- [X] T008 Add all payment tables, enums/checks, foreign keys, unique/partial indexes, retention/hold fields, updated-at behavior, and compatibility columns to `supabase/migrations/20260719000000_integrated_project_payments.sql`
- [X] T009 Implement legacy preflight classification, canonical obligation selection, evidence-backed imported receipt/allocation backfill, ambiguity exceptions, and aggregate-parity assertions in `supabase/migrations/20260719000000_integrated_project_payments.sql`
- [X] T010 Implement internal-user RLS, no-anon table access, service-only inbox/ledger mutation, immutable/no-delete triggers, definer-function grant revocation, and token-ciphertext isolation in `supabase/migrations/20260719000000_integrated_project_payments.sql` and the matching files under `supabase/schemas/public/tables/`
- [X] T011 [P] Add immutable BB payment-reference generation and actor/redacted-activity helper functions in `supabase/schemas/public/functions/generate_payment_reference.sql` and `supabase/schemas/public/functions/create_payment_activity.sql`
- [X] T012 [P] Add billing-contact resolution, active-proposal validation, cents/rounding, and obligation aggregate recomputation helpers in `supabase/schemas/public/functions/resolve_project_billing_recipient.sql`, `supabase/schemas/public/functions/resolve_project_payment_basis.sql`, and `supabase/schemas/public/functions/recompute_project_payment_obligations.sql`
- [X] T013 Add security-definer helper functions, immutable triggers, grants, and matching function definitions from T011-T012 to `supabase/migrations/20260719000000_integrated_project_payments.sql`
- [X] T014 Create internal payment obligation list, obligation detail, and project financial summary read models in `supabase/schemas/public/functions/list_payment_obligations.sql`, `supabase/schemas/public/functions/get_payment_obligation_detail.sql`, and `supabase/schemas/public/functions/get_project_financial_summary.sql`
- [X] T015 Add the read-model functions, authenticated internal grants, query indexes, and replacement boundary for `refresh_project_payment_statuses` to `supabase/migrations/20260719000000_integrated_project_payments.sql`
- [X] T016 [P] Define Angular obligation, request, checkout, transaction, allocation, intention, delivery, provider-event, exception, settings, and financial-summary types in `src/app/core/models/project-payment-record.ts`, `src/app/core/models/payment-request.ts`, `src/app/core/models/payment-transaction.ts`, `src/app/core/models/payment-delivery.ts`, and `src/app/core/models/payment-exception.ts`
- [X] T017 [P] Extend payment activity types and actor metadata without token/provider-payload fields in `src/app/core/models/activity-log.ts` and `src/app/core/supabase/repositories/activity-repository.service.ts`
- [X] T018 Implement obligation list/detail/financial-summary repository reads and remove direct mutable payment upsert from the repository contract in `src/app/core/supabase/repositories/project-payment-record-repository.service.ts` and `src/app/core/supabase/repositories/payment-repository.service.ts`
- [X] T019 [P] Add repository/model tests for unavailable-versus-zero values, cents mapping, ordered histories, and redacted activity in `src/app/core/supabase/repositories/project-payment-record-repository.service.spec.ts`, `src/app/core/supabase/repositories/payment-repository.service.spec.ts`, and `src/app/core/supabase/repositories/activity-repository.service.spec.ts`
- [ ] T020 Add migration integration tests for legacy classification, parity, ambiguity, RLS, immutable ledger writes, one-active indexes, BB-reference uniqueness, normalized delivery events, seven-year boundaries, idempotent legal-hold place/release authorization and retention exclusion, and declarative/migration equivalence in `supabase/tests/integrated_project_payments.sql`

**Checkpoint**: Existing payment data is preserved and interpretable; all new financial facts have protected schema and shared read contracts.

---

## Phase 3: User Story 1 - Convert A Lead And Request The Deposit (Priority: P1)

**Goal**: Every accepted-lead conversion creates a 30% deposit obligation due on conversion day, optionally activates and sends a secure deposit request, and never rolls back conversion for email failure.

**Independent Test**: Convert accepted leads with email selected, declined, unavailable recipient, and failed delivery; all become Awaiting Deposit with the correct obligation, and only the eligible selected case begins request/reminder delivery.

### Tests for User Story 1

- [X] T021 [P] [US1] Add conversion modal tests for displayed 30% amount, send choice, missing-recipient disabling, payload emission, and declined-email behavior in `src/app/components/private/leads/components/lead-convert-modal/lead-convert-modal.component.spec.ts`
- [X] T022 [P] [US1] Add lead conversion service tests for idempotent obligation initialization, billing fallback, proposal validation, send/no-send paths, and non-rollback delivery failure in `src/app/core/supabase/services/lead-conversion.service.spec.ts`
- [ ] T023 [P] [US1] Add database integration tests for deposit rounding, conversion-date due date, recipient resolution, replay, initial delivery uniqueness, opted-out weekly-reminder suppression, and forced failure after each contact, project, proposal-pointer, obligation, lead-state, and activity write stage proving full rollback followed by single-result command-key replay in `supabase/tests/integrated_project_payments.sql`

### Implementation for User Story 1

- [X] T024 [US1] Implement idempotent `convert_lead_to_project_with_payments` to atomically create/reuse contacts, project, proposal pointers, deposit/final obligations, lead conversion state, and activity while leaving email HTTP outside the transaction in `supabase/schemas/public/functions/convert_lead_to_project_with_payments.sql` and `supabase/migrations/20260719000000_integrated_project_payments.sql`
- [X] T025 [US1] Implement self-contained token generation, SHA-256 digest, AES-GCM encryption, and SQL request issuance in `supabase/edge_functions/issue-payment-request/index.ts` without returning plaintext to SQL/browser or importing shared/local cross-function code
- [X] T026 [US1] Add the deposit amount, send-email choice, resolved-recipient availability, and Awaiting Deposit explanation to `src/app/components/private/leads/components/lead-convert-modal/lead-convert-modal.component.ts` and `src/app/components/private/leads/components/lead-convert-modal/lead-convert-modal.component.html`
- [X] T027 [US1] Surface conversion request-delivery success/failure with retry navigation while retaining the converted project in `src/app/components/private/leads/lead-detail/lead-detail.component.ts` and `src/app/components/private/leads/lead-detail/lead-detail.component.html`
- [X] T028 [US1] Implement self-contained initial deposit-request Mailgun rendering, current-recipient resolution, active-token decryption, acceptance anchoring, normalized outcome recording, and no-secret logging in `supabase/edge_functions/process-payment-messages/index.ts` without shared/local cross-function imports
- [X] T029 [US1] Replace sequential conversion writes with the transactional conversion RPC, then optionally invoke the request-issuing Edge Function without rolling back the converted project on request/delivery failure in `src/app/core/supabase/services/lead-conversion.service.ts`
- [X] T030 [US1] Add a florist retry command that invokes the request issuer when needed and creates a linked failed-delivery retry in `supabase/schemas/public/functions/retry_payment_delivery.sql`, `supabase/migrations/20260719000000_integrated_project_payments.sql`, and `src/app/core/supabase/services/payment-delivery.service.ts`

**Checkpoint**: Conversion independently establishes a correct deposit lifecycle with optional, recoverable delivery.

---

## Phase 4: User Story 2 - Choose A Secure Payment Method (Priority: P1)

**Goal**: An unauthenticated customer can safely open one request-scoped page and choose Stripe card, integrated/fallback Venmo, check, or cash for a fixed amount without any selection being treated as receipt proof.

**Independent Test**: Open valid and invalid links, exercise all four methods, repeat clicks across tabs, test method locking and provider returns, and verify only trusted database state controls the status page.

### Tests for User Story 2

- [X] T031 [P] [US2] Add customer payment API service tests for minimal DTO mapping, generic invalid responses, method locking, handoff variants, and authoritative status polling in `src/app/core/supabase/services/customer-payment.service.spec.ts`
- [X] T032 [P] [US2] Add responsive payment-options component tests for fixed amount, fee disclosure, consolidated breakdown, four methods, instruction snapshots, intention state, and inaccessible links in `src/app/components/payment-access/payment-options/payment-options.component.spec.ts`
- [X] T033 [P] [US2] Add payment-status component and route tests proving query/return parameters cannot produce Confirmed and polling resolves only server states in `src/app/components/payment-access/payment-status/payment-status.component.spec.ts` and `src/app/app.routes.spec.ts`
- [ ] T034 [P] [US2] Add PostgreSQL contract tests for altered/revoked/fulfilled/cross-project token digests, generic invalid results, one active checkout under concurrency, same-attempt reuse, method locks, expiry/cancellation, and non-stacking intentions in `supabase/tests/integrated_project_payments.sql`

### Implementation for User Story 2

- [X] T035 [US2] Implement self-contained minimal token validation/status projection with lifecycle invalidation, no-store/CORS controls, rate limiting, and no anonymous table reads in `supabase/edge_functions/resolve-payment-request/index.ts` without shared/local cross-function imports
- [X] T036 [US2] Implement encrypted-token-input installment request issue/revoke, reserve/finalize/cancel checkout, and cash/check/Venmo-fallback intention commands with request supersession, seven-day non-stacking pauses, and one-active enforcement in `supabase/schemas/public/functions/issue_payment_request.sql`, `supabase/schemas/public/functions/revoke_payment_request.sql`, `supabase/schemas/public/functions/reserve_payment_checkout.sql`, `supabase/schemas/public/functions/finalize_payment_checkout.sql`, `supabase/schemas/public/functions/record_payment_intention.sql`, and `supabase/migrations/20260719000000_integrated_project_payments.sql`
- [X] T037 [US2] Implement self-contained Stripe-hosted Checkout creation with fixed principal, fixed-off nonconfigurable customer surcharge, zero customer fee, opaque metadata, idempotency, expiry, reuse, and safe return URL in `supabase/edge_functions/create-payment-checkout/index.ts` without shared/local cross-function imports
- [X] T038 [US2] Implement self-contained PayPal Orders v2 Venmo creation with fixed USD amount, opaque reconciliation, active-attempt reuse, eligibility handling, and business-profile fallback intention/pause in `supabase/edge_functions/create-payment-checkout/index.ts` without shared/local cross-function imports
- [X] T039 [US2] Implement self-contained server-side Venmo capture with stored order validation, PayPal idempotency, Completed/Pending/Denied mapping, and no browser-authoritative amount in `supabase/edge_functions/capture-venmo-order/index.ts` without shared/local cross-function imports
- [X] T040 [US2] Extend Angular tests for lazy PayPal SDK loading, Venmo eligibility, approval-to-server-capture, cancellation/errors, fixed-attempt reuse, and business-profile fallback in `src/app/core/supabase/services/customer-payment.service.spec.ts` and `src/app/components/payment-access/payment-options/payment-options.component.spec.ts`
- [X] T041 [US2] Implement the token-only customer API client and bounded status polling in `src/app/core/supabase/services/customer-payment.service.ts`
- [X] T042 [P] [US2] Build the mobile-first Payment Methods screen with a branded floral backdrop/card, Amount Due presentation, compact color-coded method icons, first-fold footer alignment, lazy PayPal SDK Venmo approval/cancel/error orchestration, fixed amount, safe unavailable state, fallback handoff/pause messaging, and post-selection cash/check confirmations with an instructional demo check in `src/app/components/payment-access/payment-options/payment-options.component.ts`, `src/app/components/payment-access/payment-options/payment-options.component.html`, and `src/app/components/payment-access/payment-options/payment-options.component.scss`
- [X] T043 [P] [US2] Build the branded Processing/Confirmed/Failed/Still Outstanding status screen in `src/app/components/payment-access/payment-status/payment-status.component.ts`, `src/app/components/payment-access/payment-status/payment-status.component.html`, and `src/app/components/payment-access/payment-status/payment-status.component.scss`
- [X] T044 [US2] Register isolated lazy `/pay/:token` and `/pay/:token/status` routes outside CRM guards, render them in shared public chrome with a restricted logo/social-only header, render wildcard Not Found in normal public chrome, and exclude payment routes from marketing sitemap/SEO behavior in `src/app/app.routes.ts`, `src/app/app.routes.spec.ts`, `src/app/core/layouts/public-layout/`, `src/app/shared/components/public/header/`, and `scripts/generate-sitemap.cjs`

**Checkpoint**: The complete customer choice experience works without CRM access and cannot independently credit funds.

---

## Phase 5: User Story 3 - Reconcile Receipts And Advance The Project (Priority: P1)

**Goal**: Verified provider and authorized manual receipts are immutable, idempotent, allocated deposit-first, reflected in balances/activity, and advance only eligible project statuses; adjustments preserve history and create review exceptions.

**Independent Test**: Confirm partial/full Stripe, Venmo, cash, and check receipts; replay/concurrently process them; test adjustments, duplicate override, consolidated allocation, overpayment resolution, and protected statuses.

### Tests for User Story 3

- [ ] T045 [US3] Add reconciliation integration tests for provider/manual idempotency, concurrent row locking, deposit-first allocation, partial/full/consolidated fulfillment, direct Final Prep, protected statuses, and BB-reference uniqueness in `supabase/tests/integrated_project_payments.sql`
- [ ] T046 [US3] Add adjustment and exception integration tests for refund/reversal/dispute/void/correction allocation reversal, no automatic status regression, mandatory/optional notice policy, true overpayment, retained credit, and unmatched events in `supabase/tests/integrated_project_payments.sql`
- [X] T047 [P] [US3] Add manual payment modal/service tests for positive amount/date/method validation, installment allocation, suspected duplicate warning/override reason, overpayment warning, and replay in `src/app/components/private/projects/components/project-payment-log-modal/project-payment-log-modal.component.spec.ts` and `src/app/core/supabase/services/project-workflow.service.spec.ts`
- [X] T048 [P] [US3] Define and record Stripe/PayPal sandbox smoke scenarios for invalid/valid signatures, merchant/currency/amount correlation, out-of-order/duplicate events, pending/failed outcomes, and payload minimization in `specs/007-project-payments/quickstart.md`

### Implementation for User Story 3

- [X] T049 [US3] Implement the idempotent reconciliation transaction with ordered obligation locks, immutable receipt/adjustment insertion, deposit-first allocations, aggregate recomputation, request/attempt invalidation, required outbox, activity, and forward-only status gates in `supabase/schemas/public/functions/reconcile_payment_event.sql` and `supabase/migrations/20260719000000_integrated_project_payments.sql`
- [X] T050 [US3] Implement manual receipt validation/idempotency, duplicate candidate override, overpayment warning, and audited obligation waiver/cancellation commands in `supabase/schemas/public/functions/record_manual_payment.sql`, `supabase/schemas/public/functions/set_payment_obligation_state.sql`, and `supabase/migrations/20260719000000_integrated_project_payments.sql`
- [X] T051 [US3] Implement immutable exception resolution for external refund, retained unapplied credit, correction, later explicit allocation, and required references/notes without provider refund calls in `supabase/schemas/public/functions/resolve_payment_exception.sql` and `supabase/migrations/20260719000000_integrated_project_payments.sql`
- [X] T052 [US3] Implement self-contained signed Stripe event normalization, authoritative Session/PaymentIntent validation, semantic deduplication, reconciliation, and refund/dispute handling in `supabase/edge_functions/stripe-payment-webhook/index.ts` without shared/local cross-function imports
- [X] T053 [US3] Implement self-contained verified PayPal event normalization, order/capture/payee validation, semantic deduplication, reconciliation, and refund/reversal/dispute handling in `supabase/edge_functions/paypal-payment-webhook/index.ts` without shared/local cross-function imports
- [X] T054 [US3] Replace mutable payment upserts and client-side status changes with manual receipt/exception RPC orchestration in `src/app/core/supabase/services/project-workflow.service.ts` and `src/app/core/supabase/repositories/project-payment-record-repository.service.ts`
- [X] T055 [US3] Upgrade the project payment log modal for fixed installment requests, request revocation/checkout cancellation, immutable receipts, obligation waiver/cancellation, duplicate confirmation/reason, overpayment warning/resolution routing, and actionable errors in `src/app/components/private/projects/components/project-payment-log-modal/project-payment-log-modal.component.ts` and `src/app/components/private/projects/components/project-payment-log-modal/project-payment-log-modal.component.html`
- [X] T056 [US3] Extend self-contained `supabase/edge_functions/process-payment-messages/index.ts` for exactly-once receipt emails and mandatory refund/provider-reversal notices with separate fee display and optional dispute/correction commands without shared/local cross-function imports
- [ ] T057 [US3] Add PostgreSQL outbox/reconciliation tests proving receipt/adjustment delivery failure never rolls back or duplicates financial effects in `supabase/tests/integrated_project_payments.sql`

**Checkpoint**: Every supported receipt path produces one auditable financial effect and correct project gating.

---

## Phase 6: User Story 4 - Collect The Final Balance With Reminders (Priority: P1)

**Goal**: Eligible outstanding deposits/final balances receive idempotent local-time reminders, including consolidated collection at 60 days, while current state, pauses, controls, and delivery outcomes are honored without backfill.

**Independent Test**: Run concurrent/repeated schedules at weekly deposit and 60/45/38/31/30-to-0 final boundaries across paid, paused, canceled, completed, changed-date, failed-delivery, and Awaiting Deposit projects.

### Tests for User Story 4

- [ ] T058 [US4] Add scheduler integration tests for IANA local dates, Mailgun-acceptance-anchored weekly deposit intervals, 60/45/38/31/daily boundaries, current-recipient re-resolution, event-date changes, unique occurrences, suppression, retry, and no backfill in `supabase/tests/integrated_project_payments.sql`
- [ ] T059 [US4] Add consolidated-request and status tests for 60-day supersession, deposit/final breakdown, Awaiting Deposit retention, Awaiting Final Payment activation, later deposit fulfillment, and deposit-reminder suppression in `supabase/tests/integrated_project_payments.sql`
- [ ] T060 [US4] Extend PostgreSQL delivery-event tests and add Mailgun sandbox smoke steps for acceptance anchoring, accepted-versus-delivered, definitive failures, retry lineage, `delivery_unknown`, redacted variables, and no blind resend in `supabase/tests/integrated_project_payments.sql` and `specs/007-project-payments/quickstart.md`
- [X] T061 [P] [US4] Add reminder control service/UI tests for per-obligation pause/resume, global emergency switch, reason audit, and unchanged financial/project status in `src/app/core/supabase/services/payment-delivery.service.spec.ts` and `src/app/components/private/projects/project-details/project-details.component.spec.ts`

### Implementation for User Story 4

- [X] T062 [US4] Implement final/consolidated request activation and the 60-day replacement for `refresh_project_payment_statuses` in `supabase/schemas/public/functions/activate_project_final_collection.sql`, `supabase/schemas/public/functions/refresh_project_payment_statuses.sql`, and `supabase/migrations/20260719000000_integrated_project_payments.sql`
- [X] T063 [US4] Implement timezone/send-window eligibility, Mailgun-acceptance weekly anchors, milestone occurrences, current recipient/state recheck, suppression auditing, and bounded `SKIP LOCKED` claims in `supabase/schemas/public/functions/claim_payment_deliveries.sql` and `supabase/migrations/20260719000000_integrated_project_payments.sql`
- [X] T064 [US4] Add Vault-secret preflight and an idempotent named 15-minute Supabase Cron/pg_net installation step with reminders disabled by default in `supabase/migrations/20260719000000_integrated_project_payments.sql` and document secret provisioning in `specs/007-project-payments/quickstart.md`
- [X] T065 [US4] Extend self-contained `supabase/edge_functions/process-payment-messages/index.ts` for claimed reminder batches, in-memory token decryption, current-recipient resolution/snapshot, Mailgun acceptance anchors/outcomes, bounded retries, and `delivery_unknown` without shared/local cross-function imports
- [X] T066 [US4] Refactor signed Mailgun webhook processing into self-contained `supabase/edge_functions/mailgun-webhook/index.ts` to correlate opaque delivery IDs and append normalized `payment_message_delivery_events` without raw payloads or shared/local cross-function imports, then remove the superseded legacy flat file `supabase/edge_functions/mailgun-webhook.ts` after the directory function independently type-checks and its sandbox webhook smoke check succeeds
- [X] T067 [US4] Implement audited per-obligation and global reminder control RPCs in `supabase/schemas/public/functions/set_payment_reminder_control.sql` and `supabase/migrations/20260719000000_integrated_project_payments.sql`
- [X] T068 [US4] Add retry, pause/resume, global-switch, failed/unknown delivery, and current schedule state commands to `src/app/core/supabase/services/payment-delivery.service.ts`
- [X] T069 [US4] Add project-level reminder controls and delivery-failure recovery actions without changing balances/statuses in `src/app/components/private/projects/project-details/project-details.component.ts` and `src/app/components/private/projects/project-details/project-details.component.html`
- [X] T070 [US4] Implement proposal revision rules that resize deposit only before the first confirmed receipt and afterward freeze its target while preserving credits/recalculating final outstanding in `supabase/schemas/public/functions/recalculate_project_obligations_for_snapshot.sql`, `supabase/schemas/public/functions/finalize_project_proposal_revision.sql`, and `supabase/migrations/20260719000000_integrated_project_payments.sql`
- [ ] T071 [US4] Extend revision integration tests for no-receipt resizing, partial/full first-receipt target freeze, credit preservation, final recalculation, obsolete-link invalidation, and invalid active snapshots in `supabase/tests/proposal_revision_snapshots.sql` and `supabase/tests/integrated_project_payments.sql`

**Checkpoint**: Automated collection is deterministic, controllable, recoverable, and safe across schedule and proposal changes.

---

## Phase 7: User Story 5 - Manage Payments Across The CRM (Priority: P2)

**Goal**: Florists can find every deposit/final obligation in a familiar CRM table and inspect its full history in a modal without losing table state or using a details route.

**Independent Test**: Search/filter/sort obligations, open records with requests/receipts/fees/intentions/deliveries/exceptions/activity, close the modal with state preserved, and navigate to the project within 30 seconds.

### Tests for User Story 5

- [X] T072 [P] [US5] Add Payments table tests for one row per obligation, search/filter/sort/reset, server result mapping, unavailable values, status/method/due timing, and table-state preservation in `src/app/components/private/payments/payments.component.spec.ts`
- [X] T073 [P] [US5] Add obligation/settings modal tests for complete ordered histories, fee separation, provider references, exceptions, authorized legal-hold place/release with required reason and failure states, project navigation, close behavior, instruction/provider validation, fixed-off card-fee presentation with no editable toggle, and absence of a details route in `src/app/components/private/payments/components/payment-obligation-modal/payment-obligation-modal.component.spec.ts` and `src/app/components/private/payments/components/payment-settings-modal/payment-settings-modal.component.spec.ts`
- [X] T074 [P] [US5] Add guarded route/sidebar tests for `/admin/payments` and prove no `/admin/payments/:id` route exists in `src/app/app.routes.spec.ts` and `src/app/shared/components/private/sidebar/sidebar.component.spec.ts`

### Implementation for User Story 5

- [X] T075 [US5] Implement server-backed obligation search/filter/sort/pagination and detail composition in `src/app/core/supabase/repositories/payment-repository.service.ts`
- [X] T076 [P] [US5] Build the CRM Payments page with established header, filter bar, table shell, status badges, reset behavior, modal state, and entry to global collection settings in `src/app/components/private/payments/payments.component.ts`, `src/app/components/private/payments/payments.component.html`, and `src/app/components/private/payments/payments.component.scss`
- [X] T077 [P] [US5] Build the obligation detail modal with basis, requests, checkouts, installments, allocations, fees, intentions, deliveries, exceptions, notes, activity, project navigation, and authorized project-wide legal/dispute hold place/release actions requiring a reason in `src/app/components/private/payments/components/payment-obligation-modal/payment-obligation-modal.component.ts`, `src/app/components/private/payments/components/payment-obligation-modal/payment-obligation-modal.component.html`, and `src/app/components/private/payments/components/payment-obligation-modal/payment-obligation-modal.component.scss`
- [X] T078 [US5] Register the guarded Payments table route and sidebar destination without a payment-details route in `src/app/app.routes.ts`, `src/app/shared/components/private/sidebar/sidebar.component.ts`, and `src/app/shared/components/private/sidebar/sidebar.component.html`
- [X] T079 [US5] Implement audited `update_payment_collection_settings` and `set_payment_legal_hold`, repository/service persistence, and the complete settings modal for timezone/send window, instructions, Venmo target, provider switches, emergency reminders, and read-only fixed-off card-fee policy in `supabase/schemas/public/functions/update_payment_collection_settings.sql`, `supabase/schemas/public/functions/set_payment_legal_hold.sql`, `supabase/migrations/20260719000000_integrated_project_payments.sql`, `src/app/core/supabase/repositories/payment-repository.service.ts`, `src/app/core/supabase/services/payment-delivery.service.ts`, `src/app/components/private/payments/components/payment-settings-modal/payment-settings-modal.component.ts`, `src/app/components/private/payments/components/payment-settings-modal/payment-settings-modal.component.html`, and `src/app/components/private/payments/components/payment-settings-modal/payment-settings-modal.component.scss`

**Checkpoint**: The CRM-wide payment workflow is discoverable, complete, and modal-based.

---

## Phase 8: User Story 6 - Understand Project Financial Activity (Priority: P2)

**Goal**: Project Financial Summary, payment history, activity, and project status all present the same authoritative totals and explain every important payment action.

**Independent Test**: Exercise request, intention, partial receipt, fee, fulfillment, adjustment, delivery failure, and proposal revision scenarios; the project summary and activity agree with the Payments table/modal to the cent.

### Tests for User Story 6

- [X] T080 [P] [US6] Add Financial Summary tests for authoritative proposal total, deposit/final targets, credited principal, separate customer/merchant fees, partial state, outstanding, overpayment, and unavailable-versus-zero in `src/app/components/private/projects/components/project-financial-summary-card/project-financial-summary-card.component.spec.ts`
- [X] T081 [P] [US6] Add project activity tests for florist/customer/provider/schedule actors, human-readable payment events, BB references, delivery outcomes, fulfillment/status changes, and sensitive metadata redaction in `src/app/components/private/projects/components/project-activity-panel/project-activity-panel.component.spec.ts`
- [X] T082 [P] [US6] Add project details integration tests proving summary/history/activity use the same read model as Payments and refresh after manual/provider changes in `src/app/components/private/projects/project-details/project-details.component.spec.ts`

### Implementation for User Story 6

- [X] T083 [US6] Replace first-row/summed mutable record calculations with the authoritative financial summary read model, customer-friendly amount labels, and per-obligation Paid/Unpaid indicators in `src/app/components/private/projects/components/project-financial-summary-card/project-financial-summary-card.component.ts` and `src/app/components/private/projects/components/project-financial-summary-card/project-financial-summary-card.component.html`
- [X] T084 [US6] Replace the project payment table's legacy row assumptions with obligation summaries and modal/detail-history access in `src/app/components/private/projects/project-details/project-details.component.ts` and `src/app/components/private/projects/project-details/project-details.component.html`
- [X] T085 [US6] Render payment actor, reference, request, checkout, intention, receipt, fee, delivery, adjustment, exception, fulfillment, and status activities with safe fallbacks in `src/app/components/private/projects/components/project-activity-panel/project-activity-panel.component.ts` and `src/app/components/private/projects/components/project-activity-panel/project-activity-panel.component.html`
- [X] T086 [US6] Ensure all database request, checkout, intention, delivery, reconciliation, exception, fulfillment, and status functions emit one redacted human-readable activity record in `supabase/schemas/public/functions/create_payment_activity.sql` and `supabase/migrations/20260719000000_integrated_project_payments.sql`
- [ ] T087 [US6] Add cent-parity integration assertions across obligation list, detail, project financial summary, allocations, fees, and project status in `supabase/tests/integrated_project_payments.sql`

**Checkpoint**: Project and CRM payment views share one traceable financial truth.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Harden security, operations, performance, retention, accessibility, and brownfield regression behavior across all stories.

- [X] T088 [P] Add token/IP abuse limits, uniform invalid-link timing/messages, strict no-store/CORS headers, sanitized logs, and key-version rotation checks independently inside `supabase/edge_functions/issue-payment-request/index.ts`, `supabase/edge_functions/resolve-payment-request/index.ts`, `supabase/edge_functions/create-payment-checkout/index.ts`, and `supabase/edge_functions/process-payment-messages/index.ts` without shared/local imports
- [X] T089 [P] Add provider-event, unmatched-payment, stale-checkout, delivery failure/unknown, aggregate parity, status-transition, and Cron-run observability queries to `supabase/schemas/public/functions/get_payment_operational_health.sql` and `supabase/migrations/20260719000000_integrated_project_payments.sql`
- [ ] T090 Implement secret-only cleanup for inactive token ciphertext, short-lived checkout credentials, and unnecessary payload material without deleting retained financial/audit rows, then add seven-year-minus/exact/plus and legal-hold tests in `supabase/schemas/public/functions/purge_expired_payment_secrets.sql`, `supabase/migrations/20260719000000_integrated_project_payments.sql`, and `supabase/tests/integrated_project_payments.sql`
- [X] T091 [P] Add accessibility and responsive tests for keyboard/focus/modal behavior, status announcements, payment-method controls, and mobile layouts in `src/app/components/payment-access/payment-options/payment-options.component.spec.ts`, `src/app/components/payment-access/payment-status/payment-status.component.spec.ts`, and `src/app/components/private/payments/components/payment-obligation-modal/payment-obligation-modal.component.spec.ts`
- [ ] T092 Add indexed-query and bounded-batch performance checks for hundreds of projects, multiple histories, and reminder claims to `supabase/tests/integrated_project_payments.sql`
- [ ] T093 Independently type-check each self-contained Edge Function directory, verify no `_shared`, other Edge Function, or local shared-module imports, create no automated test file or harness that targets/imports/invokes/simulates an Edge Function, and record Stripe/PayPal/Mailgun/customer sandbox smoke results for `supabase/edge_functions/issue-payment-request/index.ts`, `supabase/edge_functions/resolve-payment-request/index.ts`, `supabase/edge_functions/create-payment-checkout/index.ts`, `supabase/edge_functions/capture-venmo-order/index.ts`, `supabase/edge_functions/stripe-payment-webhook/index.ts`, `supabase/edge_functions/paypal-payment-webhook/index.ts`, `supabase/edge_functions/process-payment-messages/index.ts`, and `supabase/edge_functions/mailgun-webhook/index.ts` in `specs/007-project-payments/quickstart.md`
- [ ] T094 Run focused/full Karma/Jasmine suites, `npm run test:coverage`, PostgreSQL integration checks, and the production Angular build, then record coverage and command results in `specs/007-project-payments/quickstart.md`
- [ ] T095 Execute the migration/provider/reminder/CRM acceptance matrix with defined samples, timestamps, percentile/pass-ratio calculations, viewports, and reviewer scoring for SC-002, SC-008, and SC-012 in `specs/007-project-payments/quickstart.md`
- [ ] T096 Verify lead conversion, proposal revision, manual Canva PDF/document access, projects, manual payment continuity, public marketing routes/content/SEO, SSR, and sitemap regressions in `src/app/app.routes.spec.ts`, `src/app/components/private/leads/lead-detail/lead-detail.component.spec.ts`, `src/app/components/private/projects/project-details/project-details.component.spec.ts`, and `supabase/tests/proposal_revision_snapshots.sql`
- [X] T097 Review changed files and prepare a human-operated source-control summary and suggested commit message in `specs/007-project-payments/quickstart.md` without running commit or push commands

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 has no implementation dependency.
- Phase 2 depends on Phase 1 and blocks all user stories.
- US1 depends on Phase 2 and establishes conversion-created obligations and initial requests.
- US2 depends on Phase 2 plus active request fixtures; it can use manually issued requests before US1 is complete, but production conversion integration follows US1.
- US3 depends on Phase 2 and checkout/provider contracts from US2 for electronic paths; its manual receipt path can be completed immediately after Phase 2.
- US4 depends on US1 request delivery, US2 secure links, and US3 authoritative fulfillment so reminder eligibility cannot race stale payment state.
- US5 depends on Phase 2 read models and gains complete histories after US1-US4; its table shell can begin once foundation is stable.
- US6 depends on Phase 2 read models and US3 financial reconciliation; it integrates activity from US1-US5.
- Phase 9 depends on all stories selected for release.

### User Story Completion Graph

```text
Setup -> Foundation -> US1 -> US2 -> US3 -> US4
                       |      |      |      |
                       +------+------+-+----+-> US5 -> US6 -> Polish
                                  US3 ---------> US6
```

### Within Each Story

- Write focused tests before or alongside implementation and confirm they fail for the missing behavior.
- Complete database models/functions before repositories and services.
- Complete services/Edge contracts before Angular UI integration.
- Verify security, idempotency, failure handling, and the independent test before the checkpoint.

## Parallel Execution Examples

### User Story 1

After T024 defines the atomic conversion contract, T025 request issuance, T026 modal UI, and T028 standalone message rendering can proceed in parallel; T021-T023 test files can also be prepared independently. T029 then integrates conversion with the completed RPC and request issuer.

### User Story 2

T035 token resolution, T037-T039 provider functions, and T042-T043 Angular screens touch separate files and can proceed in parallel after T036 establishes checkout/intention commands. T031-T034 can be authored concurrently.

### User Story 3

After T049-T051 define reconciliation/manual/exception commands, Stripe webhook T052, PayPal webhook T053, manual CRM work T054-T055, and message work T056 can proceed in parallel.

### User Story 4

After T062-T064 establish schedule contracts, processor work T065, Mailgun webhook work T066, controls T067-T069, and proposal revision integration T070-T071 can proceed on separate files.

### User Story 5

After T075 repository mapping, the Payments table T076, obligation modal T077, and guarded navigation T078 can proceed in parallel.

### User Story 6

Financial Summary T083, project detail T084, activity rendering T085, and database activity enforcement T086 can proceed in parallel after the authoritative read/reconciliation contracts are stable.

## Implementation Strategy

### MVP First

The smallest safe MVP is Foundation plus US1 and the manual portion of US3: migrate legacy data, create immutable obligations/receipts, convert leads with the optional deposit request, and retain florist-recorded payments. This delivers safer payment tracking before enabling external providers.

### Incremental Delivery

1. Deploy additive schema/RLS/read models with every provider/reminder switch disabled.
2. Enable manual receipt RPC and conversion-created deposit obligations/optional request email.
3. Enable the isolated customer page and Stripe sandbox, then Stripe production after webhook replay checks.
4. Enable integrated Venmo where eligible while retaining official business-profile manual fallback.
5. Enable final/consolidated reminders only after dry-run local-date eligibility and Mailgun ambiguity tests pass.
6. Release the CRM Payments table/modal and enhanced project financial/activity surfaces as the operational view over the same ledger.
7. Keep manual collection and emergency reminder/provider switches available through every stage.

## Notes

- `[P]` means separate files and no unmet dependency; tasks editing `20260719000000_integrated_project_payments.sql` are intentionally sequential.
- Every Edge Function lives in its own directory, contains all required application logic in `index.ts`, and duplicates any small provider validation required locally rather than importing `_shared`, another Edge Function, or any local shared module; no Edge Function automated tests are created.
- Never store plaintext payment tokens, card/bank credentials, complete provider payloads, or privileged secrets in Angular, activity, Mailgun variables, or logs.
- No task authorizes provider refund initiation, recurring billing, saved payment methods, accounting sync, invoice-document generation, marketing-site changes, git commit, or git push.
