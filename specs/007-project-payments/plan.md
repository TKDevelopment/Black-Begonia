# Implementation Plan: Integrated Project Payments

**Branch**: `007-project-payments` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-project-payments/spec.md`

## Summary

Expand the existing project payment record into the authoritative deposit/final obligation aggregate, then add request-scoped customer access, a one-active-checkout state machine, immutable receipts/adjustments and allocations, delivery history, provider-event deduplication, intentions, and operational exceptions. Public payment choices use an opaque request token and standalone Supabase Edge Functions; Stripe uses hosted Checkout Sessions, Venmo prefers PayPal Checkout and falls back to an approved business-profile handoff requiring manual reconciliation. One transactional PostgreSQL reconciliation boundary owns allocation, fulfillment, activity, and forward-only payment status transitions. A timezone-aware scheduled function creates idempotent reminder occurrences, while Angular adds the isolated customer payment route, conversion choice, Payments table/modal, and richer project financial/activity views.

## Technical Context

**Language/Version**: Angular 19 / TypeScript 5.8; standalone Supabase Edge Function TypeScript on Deno; PostgreSQL/PL/pgSQL for financial transactions, scheduling, and integrity.

**Primary Dependencies**: Existing Angular standalone components/signals/forms/router and CRM table primitives; Supabase JS/PostgREST/RPC, Postgres RLS and Supabase Cron; Mailgun HTTP API/webhooks; Stripe REST API/hosted Checkout; PayPal Orders v2, the remotely loaded PayPal JavaScript SDK with Venmo funding, and PayPal webhooks; Netlify Angular SSR/Express; Karma/Jasmine. No provider npm package is required; server integrations use provider HTTPS APIs and the customer page loads the PayPal browser SDK only when integrated Venmo is eligible.

**Storage**: Extend `project_payment_records` as the obligation aggregate. Add `payment_requests`, `payment_request_obligations`, `payment_checkout_attempts`, `payment_transactions`, `payment_transaction_allocations`, `payment_intentions`, `payment_message_deliveries`, normalized `payment_message_delivery_events`, `payment_provider_events`, `payment_exceptions`, append-only `payment_legal_holds`, and singleton `payment_collection_settings`. Extend `activity_log` types and retain active proposal snapshots/projects/contacts as authoritative inputs. Deliver schema, backfill, policies, triggers, functions, grants, and schedule through `supabase/migrations/20260719000000_integrated_project_payments.sql` plus matching declarative definitions.

**Testing**: Karma/Jasmine for conversion, customer states, CRM table/modal, financial summary, activity, repositories/services, cents/fee presentation, PayPal SDK orchestration, and routing. PostgreSQL integration tests cover migration fixtures, token contracts, checkout concurrency, provider-event replay inputs, allocation, immutable ledger behavior, duplicate override, overpayment, reminder eligibility/deduplication, proposal revision recalculation, status transitions, RLS, retention boundaries, and legal holds. No automated test file or harness may target, import, invoke, or simulate a Supabase Edge Function; validate each standalone deployment through independent type-checking plus documented Stripe, PayPal, Mailgun, and customer-link sandbox smoke checks. Run Angular coverage and production build regressions.

**Target Platform**: Netlify-hosted Angular app with an authenticated CRM admin portal and one isolated unauthenticated transactional route, backed by Supabase Postgres/Cron/Edge Functions and Mailgun/Stripe/PayPal.

**Project Type**: Brownfield cross-cutting Angular/Supabase CRM feature affecting the CRM admin portal, a narrowly scoped customer payment surface, provider callbacks, scheduled processing, and outbound transactional email. The public marketing website is unchanged.

**Performance Goals**: Payment-link projection and checkout/status API responses p95 under 2 seconds excluding provider latency; CRM payment list/modal load p95 under 2 seconds for hundreds of projects; confirmed receipt reconciliation visible within 10 seconds for 95% of attempts; scheduled runs finish before the next 15-minute invocation and never duplicate an occurrence; no per-row frontend mutation for financial reconciliation.

**Constraints**: USD cents only; active proposal snapshot is pricing authority; deposit is 30% rounded to cents and due on conversion date, then freezes at the first confirmed receipt; fees never count as principal; customer card surcharging is fixed off and is not configurable in this release; one active checkout per request locks all method changes; browser returns never prove payment; lifecycle-valid request links store a lookup hash plus service-only encrypted token ciphertext for reminder reuse and erase ciphertext on invalidation; every delivery resolves the current billing recipient; immutable ledger events and allocations; forward-only automatic status movement with no automatic regression after adjustments; seven-year minimized financial/audit retention with audited project-wide legal holds; no provider-initiated refunds from CRM; no card/bank data storage; no frontend privileged secrets; RLS and executable migration required; every Edge Function lives in its own directory, contains all of its own application logic, never imports `_shared`, another Edge Function, or any local shared module, and has no automated test file or harness targeting it; manual logging remains available; no agent-run commit or push.

**Scale/Scope**: One internal business-owner user, hundreds of projects, two primary obligations per project, multiple installments/requests/transactions per obligation, daily reminder scans, and seven years of minimized history. Routes: `/pay/:token`, `/pay/:token/status`, `/admin/payments`, existing lead conversion and `/admin/projects/:projectId`. Eight standalone function directories, one migration, declarative tables/functions, Angular models/repositories/services, conversion modal, Payments table/detail modal, Financial Summary, and activity panel.

## Constitution Check

*GATE: PASS before Phase 0 research. Re-checked after Phase 1 design below.*

- **Surface classification**: Cross-cutting CRM admin, isolated customer payment surface, Supabase backend, email, schedule, and provider callbacks. The requested `/pay/:token` surface is transactional and remains outside marketing navigation, SEO, sitemap, and public content.
- **Brownfield preservation**: Preserve lead acceptance/conversion contacts and proposal snapshot transfer, project routes/statuses, manual Venmo/check/cash recording, project details, Financial Summary/activity, Payments-era legacy records, proposal revision, private documents, and all marketing routes. Replace only unsafe mutable payment effects with compatible obligation/ledger behavior.
- **Supabase security**: All payment tables have RLS. Internal users can read operational data; mutations go through narrowly granted RPCs. Public browsers never query tables and call token-validating Edge Functions that return a minimal projection. Provider and Mailgun callbacks verify raw signatures. Service-role/provider secrets remain only in function environment variables. Raw tokens, card/bank details, provider secrets, and unnecessary payloads are never persisted.
- **Schema migration**: `20260719000000_integrated_project_payments.sql` applies after `20260718000002_proposal_revision_snapshots.sql`. It extends and classifies legacy records, creates immutable ledger/support tables, constraints/indexes/RLS/functions/grants and the Cron entry, and aborts or flags ambiguous data without inventing history. Matching declarative definitions are required.
- **Standalone edge functions**: `issue-payment-request`, `resolve-payment-request`, `create-payment-checkout`, `capture-venmo-order`, `stripe-payment-webhook`, `paypal-payment-webhook`, `process-payment-messages`, and the refactored `mailgun-webhook` each live in their own directory with one self-contained `index.ts`. They contain complete local validation, never import `_shared`, another Edge Function, or any local shared module, and no automated test file or harness targets, imports, invokes, or simulates them. Database RPCs provide the common invariant boundary.
- **Testing plan**: Focused Angular tests cover all touched UI/services, including PayPal SDK orchestration. PostgreSQL integration checks cover authorization, RLS, token contracts, idempotency, concurrency, money/allocation, schedule boundaries, delivery state, status transitions, legacy migration, proposal revision, retention, and protected statuses. Provider signatures and full Edge behavior are verified through sandbox smoke checks rather than Edge test files, advancing meaningful Angular coverage toward 80%.
- **Frontend boundary plan**: `/pay/:token` is a lazy transactional route with no CRM imports or authentication requirement. It uses the shared public header/footer chrome, but its route-owned header mode exposes only the home logo plus Facebook and Instagram links; marketing page navigation and the mobile menu are omitted. `/admin/payments` remains behind existing guards. This logical separation supports a future client-portal split without changing Netlify deployment now; rollback can disable provider/reminder switches while retaining manual logging.
- **Proposal workflow rule**: Preserve the active immutable proposal snapshot and manual Canva PDF flow. Payments consume `total_amount` and react to activated revisions; they do not mutate proposal history or generate invoice documents.
- **Security and privacy**: Minimize customer/event data in the public projection, email, activity, and provider metadata. Store a SHA-256 token digest, not the bearer token. Provider metadata uses opaque internal IDs. No PAN, bank account, signed URL, or full provider payload enters application storage or logs.
- **Git publication boundary**: No commit, push, or commit-capable hook is run; publication stays with the human operator.

## Project Structure

### Documentation (this feature)

```text
specs/007-project-payments/
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/
    integrated-project-payments.md
  checklists/
    requirements.md
```

### Source Code (repository root)

```text
src/app/
  app.routes.ts
  components/
    payment-access/                         # isolated unauthenticated transactional UI
      payment-options/
      payment-status/
    private/
      leads/components/lead-convert-modal/
      payments/                             # CRM table + obligation modal
      projects/components/
        project-payment-log-modal/
        project-financial-summary-card/
        project-activity-panel/
  core/
    models/payment-*.ts
    supabase/repositories/payment-*.service.ts
    supabase/services/payment-*.service.ts
  shared/components/private/sidebar/

supabase/
  migrations/20260719000000_integrated_project_payments.sql
  schemas/public/tables/payment_*.sql
  schemas/public/functions/payment_*.sql
  edge_functions/
    issue-payment-request/index.ts
    resolve-payment-request/index.ts
    create-payment-checkout/index.ts
    capture-venmo-order/index.ts
    stripe-payment-webhook/index.ts
    paypal-payment-webhook/index.ts
    process-payment-messages/index.ts
    mailgun-webhook/index.ts
```

**Structure Decision**: Keep the single Angular deployment but enforce route/component boundaries between public transaction and authenticated CRM code. Preserve the physical `project_payment_records` name to avoid a destructive brownfield rename; redefine it as the obligation aggregate and move all individual monetary events to append-only tables. Replace `refresh_project_payment_statuses`' 45-day mutable-record check with the new 60-day obligation/request transition contract. Common security and financial invariants live in SQL functions because edge functions must remain standalone.

## Phase 0 Research Outcomes

- Use Stripe-hosted Checkout Sessions, server-created with fixed USD line items, opaque metadata, explicit expiry, deterministic idempotency, and webhook-authoritative fulfillment.
- Customer card surcharging is fixed off and has no setting in this release because hosted Checkout cannot safely distinguish every debit/prepaid/ineligible transaction before fixed line items are created. Any later 3% mechanism requires a separately approved specification and compliant per-transaction eligibility design.
- Use PayPal Orders v2 plus a lazily loaded browser JavaScript SDK for verified Venmo; pass browser approval to the standalone server capture function and fulfill only on `COMPLETED`. Use the official Venmo business-profile share target as a manual-reconciliation fallback that creates a seven-day intention pause.
- Enforce the single active attempt and all permanent idempotency in Postgres; provider idempotency windows are helpful but not durable business invariants.
- Generate and AES-GCM encrypt opaque bearer tokens only inside `issue-payment-request`, using Edge secrets. SQL accepts digest, ciphertext, IV, and key version but never generates or returns plaintext. All customer reads/mutations pass through server validation; lifecycle invalidation erases ciphertext and replaces fixed expiry.
- Run one UTC Cron invocation every 15 minutes, calculate eligibility in the configured IANA business timezone, insert unique local-date occurrence keys, and send only claimed eligible deliveries.
- Reuse Mailgun transport/webhook conventions but add payment-specific delivery rows so retry, occurrence, transaction, recipient fallback, and audit state are explicit.
- Evolve legacy payment records in place into obligations, backfill immutable imported receipts only where evidence is sufficient, and create review exceptions for ambiguity.

See [research.md](./research.md) for rationale, provider caveats, and rejected alternatives.

## Phase 1 Design Artifacts

- [data-model.md](./data-model.md): obligation aggregate, request/token, checkout state, immutable ledger/allocation, intentions, delivery, provider-event, exceptions, settings, and transition rules.
- [contracts/integrated-project-payments.md](./contracts/integrated-project-payments.md): Angular routes, public/CRM APIs, RPCs, provider callbacks, scheduling, email, authorization, and error contracts.
- [quickstart.md](./quickstart.md): deployment order, configuration, migration validation, provider setup, and end-to-end acceptance checks.

## Migration And Rollout Strategy

1. Preflight legacy records for duplicate kinds, negative/inconsistent amounts, paid rows without evidence, and values beyond the active proposal; export the diagnostic result before mutation.
2. Apply the additive schema and RLS/functions. Add obligation fields to `project_payment_records`; retain legacy fields during transition and mark each row `migration_state=classified|ambiguous`.
3. Select one canonical obligation per project/kind. Convert evidence-backed paid values into immutable `imported` receipts/allocations and link them; retain unknown details as unavailable. Create exceptions for ambiguous rows rather than merging silently.
4. Deploy each self-contained Edge Function directory independently with global collection/reminder switches off. Type-check each directory and verify token, Mailgun, Stripe, and PayPal behavior through sandbox smoke checks; do not create an automated test file or harness that targets, imports, invokes, or simulates an Edge Function.
5. Deploy Angular compatibility readers, conversion obligation creation, project summary/activity, and `/admin/payments`; retain the existing manual form but route saves through the transactional receipt RPC.
6. Enable customer request generation, then Stripe, then integrated Venmo; keep business-profile/manual reconciliation available throughout.
7. Enable reminder scheduling after dry-run eligibility output matches boundary fixtures and business timezone/configuration are reviewed.
8. Observe failed deliveries, unmatched events, stale attempts, ambiguous migrations, adjustments, and overpayments before removing deprecated direct-update code.

**Rollback considerations**: Operational switches stop new checkout/request/reminder work without deleting history. Angular can fall back to obligation-only display and manual receipt RPC. Do not roll back immutable ledger constraints or drop new records after payments exist. Provider webhooks must remain reachable until outstanding events reconcile. A database rollback must preserve new identifiers, receipts, allocations, and adjustment history even if UI/provider collection is disabled.

## Post-Design Constitution Re-Check

**Status**: PASS

- The design isolates the explicitly authorized transactional customer page and leaves marketing routes/content unchanged.
- Existing proposal, lead, project, manual-payment, document, and activity workflows are preserved through an additive compatibility migration.
- Every data change has an executable migration, matching declarative schema, RLS intent, grants, retention fields, and deployment order.
- Financial mutation is stronger: immutable events, database allocation/status transactions, verified callbacks, and durable idempotency replace browser/direct-table trust.
- All Edge Functions remain self-contained in their own directories, use no shared/local cross-function imports, and are not targeted, imported, invoked, or simulated by any automated test file or harness; shared invariants are database contracts.
- Test scope covers authorization, provider authenticity, money, concurrency, reminders, email, migration, proposal revision, and regressions.
- Provider collection/reminders can be disabled independently while manual continuity remains.
- Git publication remains human-owned.

## Complexity Tracking

No constitution violations are required. The number of tables/functions reflects independently retained financial, provider, messaging, and customer-intention facts; collapsing them into mutable payment rows would violate traceability and idempotency requirements.
