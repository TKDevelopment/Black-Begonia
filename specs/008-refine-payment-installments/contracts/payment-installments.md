# Contract: Project Payment Installments

## 1. Scope And Authorization

This contract applies to authenticated internal CRM users on `/admin/projects/:projectId`. Anonymous users receive no table or RPC access. Existing public `/pay/:token` behavior and all Edge Function contracts are unchanged.

All money crossing the command boundary is integer USD cents. Read responses use the application's existing decimal-dollar model.

## 2. Project Financial Summary Read

### Operation

`get_project_financial_summary(project_id)`

This operation is read-only. It projects persisted financial and intention state and MUST NOT fulfill intentions, mutate reminder state, write activity, or advance project status.

### Success projection

```json
{
  "available": true,
  "proposalTotal": 1000.00,
  "depositTarget": 300.00,
  "finalTarget": 700.00,
  "creditedPrincipal": 600.00,
  "outstanding": 400.00,
  "customerFees": 0.00,
  "merchantFees": 18.00,
  "overpayment": 0.00,
  "needsAttention": [],
  "obligations": [
    {
      "project_payment_record_id": "deposit-id",
      "payment_kind": "deposit",
      "target_amount": 600.00,
      "credited_principal": 600.00,
      "outstanding_amount": 0.00,
      "status": "paid",
      "displayStatus": "paid",
      "methodSummary": {
        "state": "multiple",
        "label": "Multiple"
      },
      "plannedMethod": null,
      "receipts": [
        {
          "paymentTransactionId": "receipt-1",
          "paymentReference": "BBP-2026-000001",
          "receiptPrincipal": 300.00,
          "allocatedPrincipal": 300.00,
          "method": "venmo",
          "source": "paypal",
          "occurredAt": "2026-07-19T16:00:00Z",
          "status": "confirmed",
          "note": null,
          "adjustments": []
        },
        {
          "paymentTransactionId": "receipt-2",
          "paymentReference": "BBP-2026-000002",
          "receiptPrincipal": 300.00,
          "allocatedPrincipal": 300.00,
          "method": "cash",
          "source": "manual",
          "occurredAt": "2026-07-20T16:00:00Z",
          "status": "confirmed",
          "note": null,
          "adjustments": []
        }
      ]
    }
  ]
}
```

### Rules

- Existing top-level summary keys remain compatible.
- `obligations` contains the canonical non-canceled installments ordered Deposit then Final Payment.
- `displayStatus = not_required` only when target is exactly zero.
- `methodSummary.state` is:
  - `none`: no actual receipt and no active planned method;
  - `planned`: active cash/check intention and no actual receipt;
  - `received`: all currently credited receipt children use one actual method;
  - `multiple`: currently credited receipt children use more than one method.
- A planned method does not affect financial values.
- Each receipt child reports the allocation to this installment, not merely total receipt principal.
- A spillover receipt has the same reference under every affected installment.
- Adjustments are nested under their explicitly related receipt. Unlinked legacy adjustments remain visible as needs-attention/history data and are never silently attached.
- `needsAttention` contains safe internal summaries only; no provider payload or token data.

### Failure

- Unauthorized: command is rejected without data.
- Missing project: return the established unavailable projection.
- Data inconsistency: return unavailable/review state or safe error; never coerce missing values to zero when that would hide a failure.

## 3. Record Payment Command

### Inputs

| Field | Required | Rule |
|---|---|---|
| `projectId` | Yes | Existing project visible to internal user |
| `obligationId` | Yes | Eligible selected installment in project |
| `amountCents` | Yes | Positive integer |
| `method` | Yes | Existing supported actual receipt method |
| `receivedAt` | Yes | Valid nonfuture receipt timestamp |
| `note` | No | Trimmed, internal only |
| `suspectedReference` | Conditional | Required with duplicate override |
| `overrideReason` | Conditional | Required with duplicate override |
| `commandKey` | Yes | Stable UUID reused for the same user submission |
| `confirmSpillover` | Yes | Defaults false |
| `confirmOverpayment` | Yes | Defaults false |

### Validation order

1. Authorization, project, selected installment, amount/method/date
2. Idempotent command replay
3. Duplicate candidate warning
4. Selected-first allocation proposal
5. Spillover confirmation
6. Project overpayment confirmation
7. Atomic receipt write and effects

No warning response writes a transaction, allocation, activity, intention change, delivery, or project status.

### Spillover warning

```json
{
  "state": "spillover_warning",
  "spilloverAmount": 100.00,
  "proposedAllocations": [
    { "obligationId": "deposit-id", "paymentKind": "deposit", "amount": 600.00 },
    { "obligationId": "final-id", "paymentKind": "final_payment", "amount": 100.00 }
  ]
}
```

The UI shows this plan and resubmits with the same command key plus `confirmSpillover = true` only after explicit confirmation.

### Overpayment warning

```json
{
  "state": "overpayment_warning",
  "overpaymentAmount": 50.00,
  "proposedAllocations": [
    { "obligationId": "deposit-id", "paymentKind": "deposit", "amount": 600.00 },
    { "obligationId": "final-id", "paymentKind": "final_payment", "amount": 400.00 }
  ]
}
```

If both spillover and project overpayment apply, both confirmations must be true before recording; the warning response supplies the same deterministic allocation proposal.

### Duplicate warning

Existing suspected-reference and override-reason behavior remains unchanged.

### Recorded result

```json
{
  "state": "recorded",
  "replayed": false,
  "paymentReference": "BBP-2026-000003",
  "transactionId": "receipt-id",
  "allocations": [
    { "obligationId": "deposit-id", "paymentKind": "deposit", "amount": 600.00 }
  ],
  "affectedObligationIds": ["deposit-id"],
  "overpaymentAmount": 0.00
}
```

### Atomic success effects

- One immutable confirmed receipt and deterministic allocations
- Recomputed installment totals/states and safe compatibility projections
- Fulfilled applicable active intentions; history retained
- One redacted payment activity
- Existing required receipt delivery queued once
- Eligible Awaiting Deposit project advances to Booked exactly once
- Fulfilling final payment moves an eligible Awaiting Final Payment project to Final Prep exactly once and stops future final-payment reminders
- Fulfilling deposit and final payment together may move an Awaiting Deposit project directly to Final Prep without an intermediate Booked result
- Protected or terminal project statuses remain unchanged

### Error contract

- Safe validation message is returned for florist correction.
- No partial state remains after any exception.
- UI keeps the modal open and retains entries.
- Sensitive database details, provider payloads, secrets, and customer tokens are never displayed.

## 4. Adjustment Contract

- Every new adjustment with an exact original receipt must create one immutable `adjusts` relationship between the adjustment and receipt in the same reconciliation transaction.
- The relationship is rejected unless parent and child belong to the same project, the parent is a receipt, the child is an adjustment, and the child has no other adjustment parent.
- The related transaction must be a receipt for the same project.
- Adjustment allocations express the actual balance impact and remain immutable.
- Ambiguous original receipt matching must not select “latest”; it produces review/exception state.
- Recomputed balances may reopen installments and clear fulfillment timestamps.
- Project operational status never automatically regresses.
- One aggregated needs-attention alert is shown for active reopened-balance exceptions while detailed rows remain available.

## 5. Payments / Installments UI Contract

### Section

- Heading: `Payments / Installments`
- Supporting copy explains Deposit and Final Payment fulfill the active invoice.
- Primary manual action: `Record Payment`
- Empty state describes missing installments, not “no payment logs.”

### Parent installment row

Always displays:

- Expand/collapse control
- Installment type
- Fulfillment/display status
- Due date
- Fulfilled date when available
- Target, credited, and outstanding amounts
- Method summary
- Reminder action

Zero-dollar rows display Not Required and cannot be selected for Record Payment.

### Disclosure behavior

- Disclosure is a keyboard-operable button with `aria-expanded` and `aria-controls`.
- Both rows load collapsed.
- After successful Record Payment and refresh, every affected row expands.
- Expanding does not trigger another network request.

### Receipt child row

Displays allocated amount, actual method, received date, reference, status, and safe source/note details. Multiple receipt methods cause the parent method to show `Multiple`.

### Adjustment child row

Remains nested beneath the original receipt and shows kind, amount, date, reference, and status. The original receipt is never removed.

### Planned method

- `Cash (planned)` or `Check (planned)` appears on every outstanding installment covered by the active request.
- It never displays Paid or changes credited/outstanding amounts.
- Record Payment preselects it but allows editing.
- An actual received method replaces the planned qualifier in current summary; history retains the intention.
- Cash, check, and Venmo business-profile fallback intentions retain the existing exact seven-calendar-day pause. Repeated selection during an active pause does not stack or extend `pauseEndsAt`.
- If no receipt fulfills the intention, reminder claiming resumes only at the next otherwise eligible occurrence after `pauseEndsAt`; skipped occurrences are never backfilled.

## 6. Authorization And Privacy

- Internal authenticated users only for reads and Record Payment.
- RPC rechecks internal-user authorization and project/installment ownership.
- Transactions/allocations remain immutable and directly non-writable by authenticated clients.
- Returned notes are internal; no token digest/ciphertext, signed URL, provider raw payload, email body, or secret is included.
- No Edge Function or anonymous contract changes.
