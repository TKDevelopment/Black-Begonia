# Research: Refine Payment Installments

## 1. Paid-State Integrity

**Decision**: Validate Paid/Overpaid installment state against `target_amount`, `credited_principal`, `outstanding_amount`, and `fulfilled_at`, whose values are derived from immutable transaction allocations. Stop requiring the single-value legacy `payment_method` and `paid_date` columns as the proof of payment.

**Rationale**: Split payments can have multiple methods and dates, so a single method/date cannot faithfully prove fulfillment. The current constraint rejects a valid full receipt because recomputation sets Paid before those legacy fields. Ledger allocations are the authoritative evidence and support partial, mixed-method, reversal, and replay behavior.

**Alternatives considered**:

- Populate one arbitrary method/date before status: rejected because it misrepresents split payments.
- Drop paid validation entirely: rejected because it weakens financial integrity.
- Replace installment rows with individual payments: rejected because installments and receipts have different lifecycles and the product owner explicitly retained both installments.

## 2. Compatibility Fields

**Decision**: Continue maintaining `amount_paid`, `paid_date`, `payment_method`, and `last_method` for brownfield compatibility, but compute them conservatively. `paid_date` may reflect the final fulfillment receipt date; `payment_method` is set only when one unambiguous actual method fulfills the installment and remains null for mixed/ambiguous history. New UI reads the enriched installment projection instead.

**Rationale**: Removing columns would be destructive, while forcing `other` for mixed payments invents a method. Conservative projection preserves older readers without making compatibility fields authoritative.

**Alternatives considered**:

- Add `multiple` as a receipt method: rejected because Multiple is a display aggregate, not a method used by an actual transaction.
- Leave all compatibility fields stale: rejected because existing reports may still inspect them.

## 3. Manual Allocation And Spillover

**Decision**: Lock both project installments, validate the selected installment, calculate a deterministic selected-first allocation proposal, and return a `spillover_warning` without writes unless spillover was explicitly confirmed. On confirmation, insert one immutable receipt and its selected-first allocations atomically. Project-level overpayment still requires its separate confirmation.

**Rationale**: The selected installment must mean what the florist chose. A dry warning response prevents hidden allocation and supports safe retry. Row locks plus a command key protect concurrency and idempotency.

**Alternatives considered**:

- Preserve unconditional deposit-first allocation: rejected by clarification.
- Reject every amount above the selected installment: rejected because one real receipt can legitimately cover both balances.
- Update installment totals directly: rejected because it bypasses immutable financial evidence.

## 4. Installment-Centric Read Model

**Decision**: Enrich `get_project_financial_summary` so each installment includes its derived display state, method summary, active planned method, receipt allocation children, nested related adjustments, and open alerts. Fetch the complete project projection in one RPC.

The summary RPC remains side-effect free. Intention fulfillment and project-status advancement occur only inside trusted receipt/reconciliation transactions, never during a CRM read.

**Rationale**: The page always has exactly two installment parents. A single bounded read avoids per-row calls, guarantees cent parity across the Financial Summary and installment section, and lets one receipt appear under every installment it funded with the correct allocated amount.

**Alternatives considered**:

- Call obligation detail once per expanded row: rejected due to N+1 latency and inconsistent refresh snapshots.
- Query raw tables directly from Angular: rejected because it duplicates financial joins and expands the frontend data boundary.
- Create a separate payments-history page: rejected because the clarified experience belongs within each project installment.

## 5. Planned Method Projection

**Decision**: Derive planned methods by joining active intentions through their payment request's covered installments. Project a consolidated intention to every covered installment that still has an outstanding balance. Do not use intention state as receipt evidence. Preselect the active planned method in Record Payment but keep it editable.

**Rationale**: `payment_intentions.obligation_id` cannot represent a consolidated request and is currently nullable. The request-obligation relationship already expresses the correct many-to-many scope. This also fixes reminder and CRM projection gaps without duplicating intentions.

**Alternatives considered**:

- Duplicate one intention row per installment: rejected because it complicates the one-active-intention lifecycle and can diverge.
- Show only the earliest installment: rejected by clarification.
- Copy planned method permanently onto installments: rejected because it becomes stale after expiry/supersession.

## 6. Adjustment Relationships

**Decision**: Add an append-only `payment_transaction_relationships` record that links an adjustment transaction to its original receipt. Reconciliation must use exact provider/request/checkout evidence to resolve the original; ambiguity creates/retains an exception rather than selecting the latest project receipt. Adjustment allocations remain the source of balance impact.

**Rationale**: The current “latest receipt” lookup can attach a refund to the wrong receipt. A separate immutable relationship makes nested audit display reliable, protects multi-receipt projects, and permits exact historical links to be added without updating immutable transaction rows.

**Alternatives considered**:

- Infer the relationship at read time from dates: rejected as nondeterministic.
- Add a self-reference by updating adjustment rows: rejected because existing ledger transactions are immutable.
- Store linkage only in unstructured normalized facts: rejected because integrity and indexing cannot be enforced.
- Mutate the original receipt: rejected by append-only ledger rules.

## 7. Reopened Balances And Alerts

**Decision**: Recompute installment balances after adjustments but never automatically regress project operational status. Aggregate open `adjustment_reopened_balance` exceptions into one prominent project-details alert while retaining every underlying exception/adjustment in history.

**Rationale**: A booked or active project may have downstream operational work that must not be undone automatically. The alert makes the financial exception visible without hiding audit detail.

**Alternatives considered**:

- Automatically return Booked projects to Awaiting Deposit: rejected by clarification and forward-only status policy.
- Reopen silently: rejected because the florist could miss a material balance.
- Require a new alert table: rejected because payment exceptions already model the condition.

## 8. Zero-Dollar And Expandable UX

**Decision**: Derive `not_required` as a display-only installment state when target is exactly zero; keep the canonical row and disable Record Payment. Use an accessible disclosure control on each installment, load collapsed, and expand every affected installment after a successful save.

**Rationale**: Zero dollars is not a receipt and should not become Paid. Keeping the row proves invoice reconciliation. Disclosure semantics retain a compact table and make the saved receipt immediately inspectable.

**Alternatives considered**:

- Hide zero-dollar installments: rejected because it obscures the two-part invoice model.
- Mark zero as Paid: rejected because no payment occurred.
- Persist expansion preference: rejected as unnecessary state for a two-row table.

## 9. Migration Repair

**Decision**: Repair only facts supported by existing immutable allocations/transactions. Backfill adjustment linkage only for one exact candidate. Leave ambiguous legacy rows unchanged, mark/reuse review exceptions, and report diagnostics rather than fabricate methods, dates, or receipt relationships.

**Rationale**: Financial audit data must remain explainable. Conservative migration is safer than making historical rows look complete.

**Alternatives considered**:

- Recreate installment rows: rejected because it breaks canonical IDs and request/history links.
- Infer missing evidence from project activity text: rejected because activity is descriptive, not authoritative financial evidence.

## 10. Performance And Observability

**Decision**: Add indexes for allocation-by-installment, transaction-by-project/date, related-adjustment lookup, and active intention/request joins. Bound the project projection to retained history, measure RPC latency, and expose safe manual-command states/errors to CRM while avoiding sensitive payloads.

**Rationale**: JSON aggregation over unindexed immutable history will degrade over seven years. The application needs actionable warnings without leaking tokens, provider payloads, or customer secrets.

**Alternatives considered**:

- Paginate two installment histories immediately: deferred because the supported per-project bound is modest; the contract can later add pagination without changing ledger identity.
- Log raw command payloads: rejected for privacy and secret-minimization reasons.
