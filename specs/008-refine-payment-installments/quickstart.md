# Quickstart: Refine Payment Installments

## 1. Scope

This refinement repairs manual receipt recording and changes the authenticated project payment presentation. It requires one Supabase migration and one Angular deployment. It does not require Edge Function, webhook, Cron, Mailgun, Stripe, PayPal, public-route, or secret changes.

## 2. Preflight Diagnostics

Run against the target Supabase environment and export the results before migration.

```sql
-- Duplicate active installment kinds must be zero.
select project_id, payment_kind, count(*)
from public.project_payment_records
where status <> 'canceled'
group by project_id, payment_kind
having count(*) > 1;

-- Aggregate parity mismatches must be reviewed.
select project_payment_record_id, project_id, payment_kind,
       target_amount, credited_principal, outstanding_amount, status,
       paid_date, payment_method, fulfilled_at
from public.project_payment_records
where abs(target_amount - credited_principal - outstanding_amount) > 0.01
   or (status in ('paid','overpaid') and
       (target_amount <= 0 or credited_principal < target_amount
        or outstanding_amount <> 0 or fulfilled_at is null));

-- Paid rows without immutable positive allocation evidence cannot be repaired by inference.
select o.project_payment_record_id, o.project_id, o.payment_kind, o.status
from public.project_payment_records o
where o.status in ('paid','overpaid')
  and not exists (
    select 1
    from public.payment_transaction_allocations a
    join public.payment_transactions t using (payment_transaction_id)
    where a.obligation_id = o.project_payment_record_id
      and t.status in ('confirmed','resolved')
      and a.allocated_principal > 0
  );

-- Existing adjustments need exact-match classification before relationship insertion.
select payment_transaction_id, project_id, payment_reference, kind,
       payment_request_id, payment_checkout_attempt_id, provider_reference
from public.payment_transactions
where kind <> 'receipt';
```

After migration, compare this inventory with `payment_transaction_relationships`; unlinked rows must remain visible for review rather than being attached by date alone.

## 3. Apply Backend Changes

1. Confirm all 007 payment migrations through `20260720080000_harden_payment_processor_enqueue.sql` are applied.
2. Apply `supabase/migrations/20260721000000_refine_payment_installments.sql`.
3. Verify the migration completed its constraint, indexes, function replacements, grants, and API schema-cache reload.
4. Do not deploy Angular until parity and database tests pass.

Expected migration behavior:

- No installment or financial ledger deletion.
- No new deposit/final installment rows.
- Append-only adjustment relationship inserted only for exact evidence; no ledger row updated.
- Ambiguous history retained and flagged rather than guessed.
- Paid/Overpaid integrity aligned with ledger aggregates.
- Existing legacy summary keys remain available.

## 4. Database Validation

Run `supabase/tests/integrated_project_payments.sql` using the project's configured PostgreSQL/pgTAP workflow.

Required scenarios:

1. **Original defect**: unpaid deposit + full cash receipt dated 2026-07-19 records successfully, becomes Paid, sets zero outstanding, and advances Awaiting Deposit to Booked.
2. **Partial receipt**: deposit remains Partially Paid with exact cent parity.
3. **Selected-first**: choose Final Payment while Deposit is outstanding; principal applies to Final Payment first.
4. **Spillover no-write warning**: amount exceeds selected installment; warning returns proposal and all financial row counts/totals remain unchanged.
5. **Confirmed spillover**: same command key plus confirmation creates one receipt and two allocations.
6. **Replay**: repeat the same confirmed command key five times; exactly one receipt, one allocation set, one credited result, one payment activity, one customer receipt delivery, one intention-fulfillment effect, and no duplicate project-status transition exist.
7. **Concurrency**: simultaneous commands lock installments and cannot over-credit or cross projects.
8. **Mixed method**: cash and Venmo receipts produce two children and a Multiple parent summary.
9. **Planned cash/check**: active intention projects to every covered outstanding installment with zero credit; matching receipt fulfills it. Cash, check, and Venmo business-profile fallback intentions pause reminders for exactly seven calendar days without stacking or extension, then resume only the next eligible occurrence without backfill when still unfulfilled.
10. **Adjustment**: exact related receipt, nested adjustment projection, reopened balance, open alert, unchanged project status.
11. **Ambiguous adjustment**: no latest-receipt guess; review state remains.
12. **Zero target**: Not Required projection and manual command rejection.
13. **RLS/authorization**: anonymous and non-internal callers cannot read or record.
14. **Rollback**: force failure after receipt, allocations, recompute, intention fulfillment, activity, customer receipt-delivery enqueue, and project transition stages; every stage rolls back the receipt, allocations, installment totals, intention state, activity, delivery, and status change completely.
15. **Final-payment gates**: fulfilling final principal moves Awaiting Final Payment to Final Prep exactly once and suppresses future final reminders; one receipt fulfilling both installments moves Awaiting Deposit directly to Final Prep; protected or terminal statuses remain unchanged.

Post-test parity:

```sql
select count(*) as mismatches
from public.project_payment_records
where abs(target_amount - credited_principal - outstanding_amount) > 0.01;
```

Expected: `0`.

## 5. Angular Validation

Run focused tests first:

```powershell
npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include=src/app/components/private/projects/components/project-payment-log-modal/project-payment-log-modal.component.spec.ts
npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include=src/app/components/private/projects/project-details/project-details.component.spec.ts
npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include=src/app/core/supabase/services/project-workflow.service.spec.ts
npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include=src/app/core/supabase/repositories/project-payment-record-repository.service.spec.ts
```

Then run:

```powershell
npm run test:coverage
npm run build:prod
```

No Edge Function automated test may be created or run.

## 6. CRM Acceptance Matrix

### Initial display

- Section reads **Payments / Installments**.
- Deposit and Final Payment are the only parent rows.
- Both initially load collapsed.
- Existing target, credited, outstanding, due, status, method, and reminder information remains visible.
- A $0 installment reads Not Required and cannot be selected in Record Payment.

### Planned cash/check

1. Open a valid customer payment link and choose Cash.
2. Refresh project details.
3. Confirm every outstanding installment covered by that request shows `Cash (planned)` and no amount/status changed.
4. Click Record Payment for the deposit; Cash is preselected but editable.
5. Confirm reminders are suppressed until exactly seven calendar days after the intention began.
6. Repeat the method selection during the active pause and confirm the original pause end is not extended.
7. Without recording a receipt, advance beyond the pause and confirm only the next otherwise eligible reminder may send, with no skipped-message backfill.

### Full deposit

1. Record the exact deposit amount as cash with a valid date.
2. Confirm the modal closes only after success.
3. Confirm Deposit automatically expands and displays one Cash child with allocated amount/date/reference.
4. Confirm Deposit is Paid, outstanding is $0, project is Booked, Final Payment remains unchanged, and Financial Summary/activity agree.

### Split methods

1. Record $300 Venmo and $300 cash against a $600 installment.
2. Confirm parent method reads Multiple.
3. Expand and confirm two $300 child rows with distinct methods/references.
4. Confirm children sum exactly to parent credited principal.

### Spillover

1. Select a $600-outstanding Deposit and enter $700 while Final Payment is outstanding.
2. Confirm the first submission shows $600 Deposit + $100 Final proposal and writes nothing.
3. Confirm spillover and save with the same command identity.
4. Confirm both parent rows expand; each shows its allocated portion with the same receipt reference.

### Failure retention

1. Trigger a safe validation/database failure.
2. Confirm modal remains open with installment, amount, date, method, notes, and confirmations retained.
3. Confirm no new receipt, allocation, activity, delivery, credit, or project transition exists.

### Adjustment

1. Reconcile a refund/reversal against an exact receipt.
2. Confirm original child remains, shows current status, and the adjustment nests beneath it.
3. Confirm balance reopens, project status stays forward, and one needs-attention alert appears.

## 7. Performance And Accessibility

- Seed a project with 250 receipt/adjustment transactions across two installments.
- Measure the summary RPC p95 under 1 second in the production region and page refresh/render under 2 seconds.
- Confirm one project-summary RPC and no per-row history requests.
- Navigate disclosure buttons and child rows using keyboard only.
- Verify `aria-expanded`, `aria-controls`, visible focus, screen-reader row labels, and light/dark CRM contrast.
- Verify horizontal table scrolling and readable child hierarchy at supported mobile widths.

## 8. Rollout And Monitoring

1. Apply migration and database validation.
2. Deploy Angular.
3. Smoke-test one unpaid test project before recording production receipts.
4. Monitor manual RPC errors, `adjustment_reopened_balance`/reconciliation exceptions, summary latency, and parity diagnostics.
5. No Edge Function, Cron, Vault, Mailgun, Stripe, PayPal, or Netlify environment changes are required.

## 9. Rollback

- Roll back Angular presentation independently if required; original top-level summary keys remain.
- Do not restore the obsolete paid constraint or broken manual allocation function.
- Do not delete transaction relationships, receipts, allocations, or adjustment history.
- If the enriched projection must be reverted, keep new command/constraint behavior and return the older summary keys from a compatibility read.
- Resolve production inconsistencies through additive corrections and exceptions, never destructive ledger edits.

## 10. Implementation Validation Record

Recorded 2026-07-21:

- Production Angular build: **PASS** with the repository's existing bundle/style budget warnings. The prerender step also reports the expected placeholder `example.supabase.co` lookup warning.
- Focused workflow, repository, Record Payment modal, and project-details suites: **27/27 PASS** in ChromeHeadlessNoSandbox.
- Full Angular suite: **571/575 PASS**. The four failures are existing tests outside the feature's changed surfaces:
  - `PaymentsComponent maps one server row per obligation and preserves unavailable-versus-zero display`
  - `LeadConvertModalComponent disables deposit email without a recipient and preserves manual collection`
  - `PaymentStatusComponent ignores browser return wording and renders only the polled server state in a live region`
  - `PaymentObligationModalComponent renders ordered histories, separate fees, references, exceptions, and no secrets`
- Declarative/migration parity: **PASS** for all five replaced functions; each complete declarative function body occurs exactly in the migration.
- Source formatting: `git diff --check` reports no whitespace errors.
- Edge Function boundary: **PASS**; no file under `supabase/functions` was changed and no Edge Function test was created or run.
- PostgreSQL execution, production preflight, 250-event regional p95, and manual CRM accessibility/acceptance checks remain deployment-environment steps. No local Supabase CLI or PostgreSQL runner was available, so these are intentionally not reported as passing.

## 11. Human-Operated Source-Control Handoff

Deployment order:

1. Export the Section 2 preflight diagnostics from the target Supabase project.
2. Apply `supabase/migrations/20260721000000_refine_payment_installments.sql` after `20260720080000_harden_payment_processor_enqueue.sql`.
3. Run `supabase/tests/integrated_project_payments.sql` and the post-test parity query.
4. Complete the CRM acceptance and accessibility matrix.
5. Deploy the Angular build only after the database checks pass.

The migration creates the immutable adjustment relationship, classifies unsupported legacy paid rows for review, repairs the paid-state constraint, replaces the manual/recompute/summary/reminder/reconciliation functions, preserves least-privilege grants, and reloads the PostgREST schema cache. It does not require Edge Function, Cron, Vault, provider, secret, or public-route changes.

Suggested commit message:

`feat(payments): refine project installments and receipt tracking`

Suggested body:

- record manual receipts against a selected installment with explicit spillover, duplicate, and overpayment confirmation
- derive installment totals and forward project gates from immutable allocations
- distinguish planned payment methods from received methods
- add expandable receipt and adjustment history to Payments / Installments
- add exact adjustment relationships, legacy review classification, bounded summary history, and deployment migration
