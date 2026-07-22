# Implementation Plan: Refine Payment Installments

**Branch**: `008-refine-payment-installments` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-refine-payment-installments/spec.md`

## Summary

Repair manual receipt recording without weakening financial validation, preserve the deposit and final-payment rows as the two canonical invoice installments, and make receipts/adjustments visible as expandable children of those installments. The database command will allocate to the selected installment first, return an explicit spillover proposal before touching financial state, write one immutable receipt plus allocations atomically, recompute compatibility and authoritative installment fields together, fulfill applicable intentions, and advance only eligible forward project statuses. Awaiting Final Payment advances to Final Prep when final principal is fulfilled; simultaneous deposit/final fulfillment may advance Awaiting Deposit directly to Final Prep; protected and terminal statuses remain unchanged. The side-effect-free project financial-summary read becomes the single CRM projection for installment summaries, planned method state, nested receipt allocations, nested adjustments, and open reopened-balance alerts. Angular renames the surface to **Payments / Installments**, adds accessible expandable rows, changes **Log Payment** to **Record Payment**, and retains modal values through warnings or errors.

## Technical Context

**Language/Version**: Angular 19.2 / TypeScript 5.8; PostgreSQL/PL/pgSQL for financial commands, read projections, integrity constraints, and migration repair. No Supabase Edge Function code is changed.

**Primary Dependencies**: Existing Angular standalone components, signals, template-driven forms, CRM table/theme primitives, Supabase JS/PostgREST RPC, immutable payment transaction/allocation tables, Karma/Jasmine, pgTAP-style PostgreSQL integration tests, Netlify Angular SSR/Express.

**Storage**: Supabase Postgres. Retain `project_payment_records` as the installment aggregate and `payment_transactions` plus `payment_transaction_allocations` as immutable evidence. Add an append-only `payment_transaction_relationships` table that links an adjustment to its original receipt without mutating either ledger row, replace the obsolete paid-row validation with ledger-aligned fulfillment validation, add lookup indexes, and update matching declarative definitions. Apply through `supabase/migrations/20260721000000_refine_payment_installments.sql` after all 007 payment migrations.

**Testing**: Karma/Jasmine for installment DTO mapping, Record Payment form defaults/warnings, row expansion, split-method display, spillover children, zero-dollar state, adjustment nesting, error retention, automatic post-save expansion, and project alerts. PostgreSQL integration tests cover paid constraint repair, full/partial receipts, selected-first allocation, spillover confirmation, overpayment/duplicate precedence, replay/concurrency with exact receipt/allocation/activity/delivery/intention/status-effect counts, intention projection/fulfillment, exact seven-day non-stacking pauses and no-backfill resumption, Awaiting Final Payment-to-Final Prep and direct Awaiting Deposit-to-Final Prep gates, protected-status preservation, reminder suppression, mixed methods, adjustment linkage, forward-only project status, RLS, rollback at every receipt side-effect stage, and conservative legacy repair. No automated test may target, import, invoke, or simulate an Edge Function; none is affected.

**Target Platform**: Existing Netlify-hosted Angular CRM and Supabase backend. The authenticated `/admin/projects/:projectId` experience changes; public payment routes and provider callbacks remain behaviorally unchanged.

**Project Type**: Brownfield Angular/Supabase CRM refinement.

**Performance Goals**: Load the complete two-installment projection, including up to 250 receipts/adjustments for one project, in one database round trip with p95 under 1 second in the production region; refresh and render affected installment rows within 2 seconds after a successful manual receipt; avoid per-row database requests and unbounded history scans.

**Constraints**: USD decimal/cents parity; exactly one active deposit and final installment per project; immutable transactions and allocations; no invented legacy receipt facts; selected-installment-first manual allocation with explicit spillover confirmation; planned methods never credit principal; cash/check/Venmo-fallback intentions retain the existing exact seven-calendar-day non-stacking pause and no-backfill resumption; actual methods override planned display; zero-dollar installments are display-only Not Required; automatic project statuses remain forward-only with Awaiting Final Payment-to-Final Prep and direct Awaiting Deposit-to-Final Prep fulfillment gates while protected/terminal statuses remain unchanged; financial-summary reads are side-effect free; RLS and narrow security-definer functions remain mandatory; no public/marketing changes; no service-role secrets in Angular; no Edge Function changes or automated Edge Function tests; no agent-run commit or push.

**Scale/Scope**: One internal florist, hundreds of projects, exactly two canonical installments per project, typically fewer than 20 receipt/adjustment events and a supported bound of 250 for a project detail view. Affected code is limited to project payment models/repository/workflow, project details and Record Payment modal, payment declarative SQL/read/command functions, one migration, and database/Angular tests.

## Constitution Check

*GATE: PASS before Phase 0 research. PASS after Phase 1 design.*

- **Surface classification**: CRM admin plus Supabase payment backend only. Public payment selection remains unchanged; only its already-persisted intentions are projected more accurately in CRM. No marketing, SEO, sitemap, or public styling work is authorized.
- **Brownfield preservation**: Preserve `/admin/projects/:projectId`, two canonical installment rows, active proposal totals, deposit freeze, reminder controls, public request/checkout flows, provider reconciliation, immutable receipts/allocations, activity, delivery history, duplicate/overpayment safeguards, and project status names. Refine only manual allocation, installment read/display semantics, paid validation, and adjustment linkage.
- **Supabase security**: Existing payment RLS remains enabled. Authenticated internal users receive only the enriched redacted read model and call the narrow manual-receipt command. Anonymous table access remains denied; service-role/provider paths remain unchanged. Notes and references are returned only to internal users.
- **Schema migration**: `supabase/migrations/20260721000000_refine_payment_installments.sql` changes the paid constraint, adds the append-only transaction-relationship table and indexes, inserts conservative evidence-backed relationship rows, updates functions/grants, and requests schema-cache reload. Matching table/function declarative files change in the same work.
- **Standalone edge functions**: No Edge Function is modified or redeployed. Existing standalone functions continue to contain no shared local imports. No automated Edge Function test or harness will be created.
- **Testing plan**: Focused Angular tests cover every new DTO/UI branch and contribute meaningful project-details/payment-form coverage toward 80%. Database integration tests exercise authorization, constraints, atomic rollback, allocation/warning/idempotency/concurrency, read parity, intention state, adjustment relationships, and migration fixtures. Edge validation is not applicable because no Edge code changes.
- **Frontend boundary plan**: Work remains inside authenticated CRM components and core payment models/repositories. No route, auth, deployment, shared public component, or future frontend-separation change is required. Rollback may restore the prior Angular presentation while the additive backend projection remains compatible.
- **Proposal workflow rule**: Active invoice snapshots and revision recalculation remain authoritative. Manual Canva PDF upload and all proposal document behavior are untouched.
- **Security and privacy**: No new secrets or customer data are introduced. The read DTO excludes tokens, encrypted token material, provider payloads, email bodies, and unnecessary customer attributes. Financial notes remain internal. Immutable evidence is retained rather than overwritten.
- **Git publication boundary**: No commit, push, or commit-capable hook is run. Source-control publication remains a human handoff.

## Project Structure

### Documentation (this feature)

```text
specs/008-refine-payment-installments/
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/
    payment-installments.md
  checklists/
    requirements.md
  tasks.md
```

### Source Code (repository root)

```text
src/app/
  components/private/projects/
    project-details/
      project-details.component.ts
      project-details.component.html
      project-details.component.scss
      project-details.component.spec.ts
    components/project-payment-log-modal/
      project-payment-log-modal.component.ts
      project-payment-log-modal.component.html
      project-payment-log-modal.component.spec.ts
  core/
    models/
      project-payment-record.ts
      payment-transaction.ts
    supabase/
      repositories/project-payment-record-repository.service.ts
      repositories/project-payment-record-repository.service.spec.ts
      services/project-workflow.service.ts
      services/project-workflow.service.spec.ts

supabase/
  migrations/20260721000000_refine_payment_installments.sql
  schemas/public/
    tables/
      project_payment_records.sql
      payment_transaction_allocations.sql
      payment_transactions.sql
      payment_transaction_relationships.sql
    functions/
      record_manual_payment.sql
      recompute_project_payment_obligations.sql
      get_project_financial_summary.sql
      record_payment_intention.sql
      reconcile_payment_event.sql
      claim_payment_deliveries.sql
  tests/integrated_project_payments.sql
```

**Structure Decision**: Extend the existing project-details and payment domain files rather than create a second payment UI or ledger. Keep database invariants in declarative SQL plus one ordered migration. Use the existing financial-summary RPC as the single page-level read to avoid N+1 detail calls; retain the obligation-detail RPC for the separate CRM payments modal.

## Phase 0 Research Outcomes

- Treat immutable transactions and allocations—not legacy `paid_date`/`payment_method` columns—as proof that an installment is fulfilled.
- Keep legacy columns as compatibility projections, but never use them to represent mixed methods or manufacture missing evidence.
- Add an explicit append-only related-receipt relationship for future adjustments; insert links only for uniquely provable historical relationships and leave ambiguous adjustments unlinked with review evidence.
- Make the project financial-summary RPC return installment-centric nested receipt/allocation/adjustment DTOs and planned-method state in one query.
- Resolve cash/check intentions through payment-request-to-installment links so consolidated requests project to every covered outstanding installment.
- Preserve the existing exact seven-calendar-day non-stacking intention pause and resume only the next otherwise eligible reminder without backfilling skipped occurrences.
- Extend manual receipt recording with a no-write spillover warning and explicit confirmation, then allocate selected installment first inside the same locked transaction.
- Preserve forward-only project status after adjustments and surface open adjustment exceptions as a single prominent needs-attention condition.
- Use accessible disclosure buttons with `aria-expanded`/`aria-controls`; load collapsed and expand affected installments after save.

See [research.md](./research.md) for rationale and rejected alternatives.

## Phase 1 Design Artifacts

- [data-model.md](./data-model.md): installment aggregate, receipt/allocation/adjustment hierarchy, intention projection, warning command, and state transitions.
- [contracts/payment-installments.md](./contracts/payment-installments.md): manual command request/results, financial-summary DTO, UI behavior, authorization, and error contracts.
- [quickstart.md](./quickstart.md): migration order, Supabase deployment, repair verification, Angular/database tests, and end-to-end scenarios.

## Migration And Rollout Strategy

1. Run preflight diagnostics for paid/overpaid aggregate parity, paid rows lacking allocation evidence, duplicate active installment kinds, adjustments without a unique source receipt, and intentions whose requests do not cover an active installment. Export results before mutation.
2. Apply `20260721000000_refine_payment_installments.sql` after `20260720080000_harden_payment_processor_enqueue.sql`. Create the append-only adjustment relationship table, RLS, immutability trigger, grants, and supporting indexes first.
3. Insert relationship rows only where project, request/checkout/provider evidence, and allocation reversal identify exactly one original receipt. Never update existing transaction/allocation rows. Leave ambiguous adjustments unlinked and ensure a review exception exists; never infer a receipt method or date.
4. Replace `project_payment_records_paid_check` with a ledger-aligned paid/overpaid fulfillment constraint. Recompute every project with allocation evidence so authoritative totals, fulfillment timestamps, and safe compatibility fields agree.
5. Replace the manual command and summary/intention/reminder/reconciliation functions, restore least-privilege grants, and reload the API schema cache. The new final manual-command parameter has a default so the previous Angular build remains usable during staged deployment.
6. Run database integration and parity checks before deploying Angular. Abort Angular rollout if any project has target/credited/outstanding mismatch, duplicate active installments, or an invalid fulfilled state.
7. Deploy Angular models, repository/service, Record Payment modal, and expandable Payments / Installments table together. Verify a full cash deposit, split methods, spillover, failed save, planned cash, and reopened balance in the production-like Supabase environment.
8. Observe manual-command errors, open adjustment exceptions, and read-model latency. No Edge Function or Cron redeployment is required.

**Rollback considerations**: The Angular UI can be rolled back independently because existing summary fields remain present. Do not remove the new adjustment relation or immutable evidence during rollback. The updated constraint fixes a production defect and should not be restored to the legacy metadata requirement. If the enriched read must be rolled back, retain the new command/constraint and return the original summary keys alongside the new data. Never delete or rewrite receipts/allocations to reverse rollout.

## Post-Design Constitution Re-Check

**Status**: PASS

- Design changes only the approved CRM/payment surfaces.
- One executable migration mirrors every declarative schema/function change and preserves existing data.
- RLS, narrow RPC authorization, immutable evidence, secret boundaries, and forward-only project status are preserved or strengthened.
- No Edge Function changes, shared local Edge imports, or prohibited Edge tests are introduced.
- Angular and PostgreSQL tests cover all critical state transitions; proposal/PDF and public marketing behavior remain untouched.
- Git commit and push remain human-owned.

## Complexity Tracking

No constitution violations require justification.
