# Data Model: Refine Payment Installments

## Model Boundary

The project invoice is fulfilled by exactly two canonical installment aggregates: Deposit and Final Payment. Installments are not payment logs. Immutable receipt and adjustment transactions are allocated to one or both installments, and the aggregates are recomputed from those allocations.

```text
Project
  ├─ Active Invoice Snapshot
  ├─ Deposit Installment
  │    ├─ Receipt Allocation ─ Receipt Transaction
  │    │                         └─ Adjustment Transactions
  │    └─ Planned Method ← Payment Intention ← Payment Request
  └─ Final Payment Installment
       ├─ Receipt Allocation ─ Receipt Transaction
       │                         └─ Adjustment Transactions
       └─ Planned Method ← Payment Intention ← Payment Request
```

## 1. Payment Installment

**Existing record**: `project_payment_records`

**Identity**: `project_payment_record_id`

**Uniqueness**: At most one non-canceled row per `(project_id, payment_kind)`; supported kinds remain `deposit` and `final_payment`.

### Authoritative fields

| Field | Meaning | Validation |
|---|---|---|
| `project_id` | Owning project | Required; cannot be crossed by allocations |
| `payment_kind` | Deposit or final payment | Required; canonical kind constraint |
| `target_amount` | Principal required for this installment | Nonnegative USD amount |
| `credited_principal` | Net sum of immutable allocations | Recomputed; never directly entered |
| `outstanding_amount` | Remaining target | `max(target - credited, 0)` |
| `status` / `fulfillment_state` | Durable installment state | Derived except waived/canceled/review-required |
| `due_date` | Collection due date | Existing lifecycle rules preserved |
| `fulfilled_at` | First/current time the positive target became fulfilled | Required for Paid/Overpaid; null when reopened |
| `basis_snapshot_id`, `basis_version`, `basis_total` | Invoice basis | Existing active-snapshot contract preserved |

### Compatibility projections

`amount_due`, `amount_paid`, `paid_date`, `payment_method`, `payment_source`, `last_method`, and `last_intention_method` remain for brownfield readers. They are not receipt evidence.

- `amount_paid` mirrors net credited principal.
- `paid_date` may show the final fulfillment receipt date when uniquely derivable.
- `payment_method` may show one unambiguous actual method; it remains null for mixed or ambiguous history.
- `last_method` may show the most recent confirmed actual receipt method.
- Planned method is derived from active request/intention links rather than trusted from a stale copied value.

### State derivation

| Condition | Durable state | CRM display |
|---|---|---|
| `target_amount = 0` | Existing due/not-due representation may remain | `Not Required` |
| Net credited = 0 and due date not reached | `not_due` | `Unpaid` / Not Due |
| Net credited = 0 and due date reached | `due` | `Unpaid` / Due |
| `0 < credited < target` | `partially_paid` | Partially Paid |
| `credited = target > 0` | `paid` | Paid |
| `credited > target > 0` | `overpaid` | Overpaid / Needs Attention as applicable |
| Administrative exception | `waived`, `canceled`, or `review_required` | Matching distinct state |

Paid and Overpaid require target/credited/outstanding parity and a non-null fulfillment timestamp. No single method/date is required because multiple receipts may fulfill one installment.

## 2. Payment Receipt

**Existing record**: `payment_transactions` with `kind = 'receipt'`

**Identity**: `payment_transaction_id`; human-safe identity is `payment_reference`.

**Key fields**: Project, principal amount, actual method, source, occurred/recorded timestamps, actor, provider or command idempotency evidence, note, notice state.

Receipts are append-only. A retry with the same command key or provider effect resolves to the original receipt.

## 3. Receipt Allocation

**Existing record**: `payment_transaction_allocations`

**Relationship**: Many receipt/adjustment transactions to many installments, bounded to the two installments of one project.

**Key fields**:

- `payment_transaction_id`
- `obligation_id`
- `allocated_principal` (positive receipt credit; negative adjustment effect)
- `sequence` (allocation order within the transaction)

### Manual allocation algorithm

1. Lock all eligible project installments.
2. Validate the selected installment remains eligible.
3. Allocate up to its outstanding amount to the selected installment.
4. If principal remains, propose allocation to the other eligible installment.
5. Do not write unless spillover is explicitly confirmed.
6. Any amount beyond the total project outstanding remains an overpayment and requires the existing separate confirmation/exception flow.

## 4. Payment Adjustment

**Existing record extended**: `payment_transactions` where kind is refund, reversal, dispute, void, correction, credit allocation, or external refund.

### New append-only relationship

**New record**: `payment_transaction_relationships`

| Field | Meaning |
|---|---|
| `payment_transaction_relationship_id` | Relationship identity |
| `project_id` | Project boundary shared by both transactions |
| `parent_transaction_id` | Original receipt transaction |
| `child_transaction_id` | Adjustment transaction |
| `relationship_type` | `adjusts` |
| `evidence_source` | Provider correlation, migration exact match, or authorized resolution |
| `created_at` | Relationship recording time |

One adjustment has at most one `adjusts` parent. Both foreign keys use restrictive deletion, and the relationship row is protected by the financial-history immutability trigger. Existing transaction and allocation rows are never updated. New adjustment reconciliation must resolve an exact original receipt; otherwise it records/reuses a review exception and does not invent a relationship.

Relationship creation validates that the parent is a receipt, the child is an adjustment, both transactions belong to `project_id`, parent and child differ, and the adjustment child has no other `adjusts` parent.

Adjustment allocations carry negative or corrective principal and drive installment recomputation. Reopening a balance clears fulfillment state as needed but never automatically regresses project operational status.

## 5. Payment Intention

**Existing record**: `payment_intentions`

An intention records a customer's plan to pay by cash/check (or existing manual Venmo fallback). It never credits principal.

### Coverage relationship

The authoritative coverage path is:

`payment_intentions.payment_request_id → payment_request_obligations → project_payment_records`

The nullable single `obligation_id` remains compatibility data and must not limit consolidated requests.

### Lifecycle

`active → fulfilled | superseded | expired`

- Active intentions project `Cash (planned)` or `Check (planned)` to every covered outstanding installment.
- Record Payment preselects the planned cash/check method but allows change.
- A corresponding successful receipt fulfills affected active intentions while preserving history.
- Cash, check, and Venmo business-profile fallback intentions pause reminders for exactly seven calendar days. Repeated selection during an active pause reuses the existing pause end and cannot stack or extend it.
- When an unfulfilled pause expires, reminder scheduling resumes at the next otherwise eligible occurrence and never backfills occurrences skipped during the pause.
- Intention alone does not alter credited, outstanding, fulfillment, or project status.

## 6. Payment Exception / Needs-Attention Alert

**Existing record**: `payment_exceptions`

Open `adjustment_reopened_balance` exceptions are the durable evidence for reopened balances. The project read model aggregates them into one prominent needs-attention alert while retaining each underlying exception for detailed history/resolution.

Project status remains forward-only. Resolving the alert follows the existing exception workflow and does not delete adjustments.

## 7. Project Installment Read Model

**Returned by**: `get_project_financial_summary(project_id)` to internal CRM users.

This RPC is a side-effect-free read projection. It may report active or fulfilled intention state but never fulfills intentions, writes financial state, or advances project status.

### Project summary

- Existing `available`, proposal/target, credited, outstanding, fee, and overpayment fields
- `obligations`: two enriched installment projections
- `needsAttention`: aggregated open adjustment/reconciliation alerts

### Enriched installment projection

- Raw aggregate identity/basis/amount/due/reminder fields
- `displayStatus`: includes derived `not_required`
- `methodSummary`: `none`, `planned`, `received`, or `multiple`
- `plannedMethod`: active cash/check method when applicable
- `receipts`: ordered installment receipt child rows

### Installment receipt child

- Transaction ID and payment reference
- Total receipt principal
- Amount allocated to this installment
- Actual method, source, occurred date, status, and safe note
- `adjustments`: ordered related adjustment rows

### Adjustment child

- Transaction ID and reference
- Kind/status
- Amount affecting this installment
- Occurred date and safe description

One spillover receipt appears under each affected installment using that installment's allocated amount and the same shared payment reference.

## 8. Manual Payment Command

### Input

- Project ID
- Selected installment ID
- Positive amount in cents
- Actual received method/date
- Optional note
- Duplicate evidence/override
- Stable command key
- `confirm_spillover`
- `confirm_overpayment`

### No-write warning states

- `duplicate_warning`
- `spillover_warning` with proposed allocations and spillover amount
- `overpayment_warning` with overpayment amount and proposed allocations

### Success state

`recorded` returns the receipt, exact allocations, affected installment IDs, overpayment amount, and replay indicator.

All financial writes, intention updates, activity, delivery enqueue, recomputation, and eligible forward project transition occur in one transaction. Full final-payment fulfillment advances Awaiting Final Payment to Final Prep exactly once; simultaneous deposit/final fulfillment may advance Awaiting Deposit directly to Final Prep; protected and terminal statuses remain unchanged.

## 9. Indexes And Bounds

- Allocation lookup by `(obligation_id, payment_transaction_id)`
- Project transaction history by `(project_id, occurred_at desc)`
- Relationship lookup by `(parent_transaction_id, child_transaction_id)` and unique adjustment child
- Existing active request/intention and request-obligation indexes retained

The project read contract supports up to 250 receipt/adjustment transactions in one bounded project projection. No per-installment network call is required.

## 10. Migration Classification

- **Native/valid**: Aggregate parity and immutable evidence agree; recompute projections.
- **Evidence-backed repair**: One exact receipt/adjustment relationship is derivable; insert a new immutable relationship record without altering either transaction.
- **Ambiguous**: Multiple/no exact receipt candidates or missing ledger evidence; do not invent data, keep/reclassify for review, and expose a needs-attention signal where operationally relevant.
