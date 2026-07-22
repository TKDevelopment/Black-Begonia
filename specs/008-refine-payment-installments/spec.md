# Feature Specification: Refine Payment Installments

**Feature Branch**: `008-refine-payment-installments`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "Refine project payment installments so manual deposit receipts can be recorded successfully, customer cash/check intentions appear without being mistaken for received funds, and the project section is presented as Payments / Installments."

## Clarifications

### Session 2026-07-20

- Q: How should a manual receipt be allocated when its amount exceeds the selected installment? → A: Apply it to the selected installment first, then require explicit confirmation before carrying excess into the next installment.
- Q: How should an installment display receipts paid through multiple methods? → A: Keep the installment as an expandable summary row and show one child row per applied receipt, including each receipt's amount and method.

### Session 2026-07-21

- Q: Where should a single receipt appear when it funds more than one installment? → A: Show it beneath every affected installment with that installment's allocated amount and the same shared receipt reference.
- Q: What should the florist-facing action for entering received funds be called? → A: Use `Record Payment` for both the action and modal title, with supporting text explaining that it applies a received payment to an installment.
- Q: How should an active planned cash/check method affect the Record Payment modal? → A: Preselect the planned method but allow the florist to change it to the method actually received.
- Q: Where should a planned method appear when one payment request covers multiple installments? → A: Show it on every outstanding installment covered by the request without changing any financial fulfillment state.
- Q: When should installment receipt rows expand automatically? → A: Load installments collapsed, then automatically expand each affected installment after a payment is successfully recorded.
- Q: How should a refunded, reversed, disputed, or corrected payment appear inside an installment? → A: Keep the original receipt row, show its current status, and display its related adjustments beneath it.
- Q: How should a zero-dollar installment appear? → A: Keep it visible as `Not Required` and disable Record Payment for that installment.
- Q: What should happen to project status when a payment reversal reopens a previously fulfilled balance? → A: Preserve the current operational status and create a prominent needs-attention alert for the reopened balance.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record A Manual Installment Receipt (Priority: P1)

A florist records cash, check, Venmo, or another supported manual receipt against the existing deposit or final-payment installment. The installment is updated from the authoritative receipt without creating another installment row.

**Why this priority**: Recording received money accurately is the critical financial action. The current failure prevents the florist from booking a project after receiving its deposit.

**Independent Test**: On a project with an unpaid deposit and unpaid final installment, record the full deposit amount as cash with a valid received date. Confirm that the operation succeeds once, the deposit becomes Paid, its credited and outstanding amounts are correct, the final installment remains unchanged, and the project advances to Booked.

**Acceptance Scenarios**:

1. **Given** an unpaid deposit installment, **When** the florist records the full outstanding deposit as received by cash on a valid past or current date, **Then** the same deposit installment becomes Paid and shows zero outstanding without creating a third installment.
2. **Given** an unpaid deposit installment, **When** the florist records only part of the deposit, **Then** the installment becomes Partially Paid and shows both the credited amount and remaining balance.
3. **Given** a fully paid deposit and an unpaid final installment, **When** the receipt is saved, **Then** the project advances from Awaiting Deposit to Booked while the final installment remains unpaid.
4. **Given** a receipt submission is retried with the same operation identity, **When** the system receives the retry, **Then** it returns the original result without duplicating the receipt or credited amount.
5. **Given** receipt data is invalid or conflicts with a financial rule, **When** saving fails, **Then** no partial financial or project-status changes remain and the florist sees a useful, safe explanation.
6. **Given** a receipt exceeds the selected installment but does not exceed the project balance, **When** the florist submits it, **Then** the system shows the proposed spillover and records it only after explicit confirmation.
7. **Given** the florist is viewing Payments / Installments, **When** they choose Record Payment, **Then** a Record Payment modal explains that the received payment will be applied to an installment.
8. **Given** the deposit is fulfilled and a project is Awaiting Final Payment, **When** confirmed principal fulfills the remaining final-payment balance, **Then** future final-payment reminders stop and the project advances to Final Prep exactly once.
9. **Given** a project is Awaiting Deposit, **When** one confirmed receipt fulfills both the deposit and final-payment installments, **Then** both payment gates are applied and the project advances directly to Final Prep without stopping at Booked.
10. **Given** a project is already in a protected or terminal status, **When** its remaining final-payment balance is fulfilled, **Then** its installments update but its operational status is unchanged.

---

### User Story 2 - Distinguish Planned And Received Payment Methods (Priority: P1)

A florist can see that a customer selected cash or check from the public payment page while still understanding that the money has not been received. Once a receipt is recorded, the installment shows the actual received method.

**Why this priority**: A customer intention is operationally useful but is not proof of payment. Presenting the distinction prevents accidental booking or false financial reporting.

**Independent Test**: Have a customer choose cash for an unpaid deposit. Confirm the deposit row shows Cash as a planned method and remains Unpaid. Then record the cash receipt and confirm the same row shows Cash as the received method and becomes Paid.

**Acceptance Scenarios**:

1. **Given** a customer selected cash for the deposit, **When** the florist views the installment before receipt, **Then** the row displays `Cash (planned)` and remains Unpaid with its balance unchanged.
2. **Given** a customer selected check for the deposit, **When** the florist views the installment before receipt, **Then** the row displays `Check (planned)` and remains Unpaid.
3. **Given** a planned cash or check method, **When** the corresponding receipt is recorded, **Then** the intention is fulfilled, the row displays the received method without the planned qualifier, and the activity history preserves both events.
4. **Given** a customer planned one method but pays with another, **When** the florist records the actual receipt method, **Then** the installment displays the actual received method while history retains the earlier intention.
5. **Given** no intention or receipt exists, **When** the florist views the installment, **Then** the method is shown as not yet selected rather than implying a payment method.
6. **Given** an active Cash (planned) or Check (planned) intention, **When** the florist opens Record Payment for that installment, **Then** the planned method is preselected but remains editable.
7. **Given** one active request covers multiple outstanding installments and the customer selects cash or check, **When** the florist views Payments / Installments, **Then** every outstanding installment covered by that request displays the planned method while all credited amounts and fulfillment states remain unchanged.
8. **Given** a cash, check, or Venmo business-profile fallback intention is active, **When** reminder eligibility is evaluated during its seven-calendar-day pause, **Then** no reminder is sent; after the pause expires without a recorded receipt, only the next otherwise eligible occurrence may send and skipped occurrences are not backfilled.

---

### User Story 3 - Understand Payments As Invoice Installments (Priority: P2)

The project details screen presents the deposit and final payment as the two installments that fulfill the active invoice total, rather than describing the installment rows as payment logs.

**Why this priority**: Clear terminology helps the florist understand that installments are balances to fulfill, while receipts and activities are historical events applied to those balances.

**Independent Test**: Open a project with an active invoice and inspect the renamed Payments / Installments section. Confirm it contains one deposit row and one final-payment row whose targets equal the invoice total and whose values update after receipts without adding rows.

**Acceptance Scenarios**:

1. **Given** a project with an active invoice, **When** the florist views project details, **Then** the section title is `Payments / Installments` and shows exactly the canonical deposit and final-payment installments.
2. **Given** neither installment has received funds, **When** the section loads, **Then** the deposit may be Due, the final installment may be Not Due, and both remain visibly Unpaid.
3. **Given** receipts have been allocated, **When** the section loads, **Then** each installment shows its target, credited amount, outstanding balance, fulfillment state, planned or received method, and applicable due date.
4. **Given** a proposal revision changes the active invoice total under existing payment rules, **When** the revised invoice becomes active, **Then** the same canonical installments are recalculated without duplicating them or losing receipt history.
5. **Given** the florist opens installment details, **When** historical information is displayed, **Then** intentions, receipts, allocations, and delivery/activity history remain distinguishable events.
6. **Given** an installment has one or more applied receipts, **When** the florist expands its row, **Then** one child row per receipt shows that receipt's details without replacing or duplicating the installment summary row.
7. **Given** a $600 installment received $300 by Venmo and $300 by cash, **When** the section is displayed, **Then** the parent installment retains all summary fields and shows Multiple as its method while its expanded content shows separate $300 Venmo and $300 Cash receipt rows.
8. **Given** one confirmed receipt allocates $600 to the deposit and $100 to the final installment, **When** both installments are expanded, **Then** each shows a child row for its own allocated portion and both child rows show the same receipt reference.
9. **Given** the florist first opens project details, **When** Payments / Installments loads, **Then** both installment rows are collapsed.
10. **Given** a payment is successfully recorded, **When** refreshed financial data is displayed, **Then** every installment affected by that payment is expanded and shows its new receipt child row.
11. **Given** an installment receipt is later refunded, reversed, disputed, or corrected, **When** the installment is expanded, **Then** the original receipt remains visible with its current status and each related adjustment appears beneath it.
12. **Given** an installment target is exactly $0.00, **When** Payments / Installments loads, **Then** the installment remains visible as Not Required and Record Payment is unavailable for it.

---

### User Story 4 - Recover From Receipt Warnings And Failures (Priority: P2)

The florist can understand and respond to duplicate, overpayment, validation, or persistence failures without losing entered information or creating uncertain financial state.

**Why this priority**: Financial operations must be recoverable and must not leave the florist unsure whether money was recorded.

**Independent Test**: Trigger each supported warning and one failed save. Confirm the modal retains the attempted values, no receipt is credited until explicitly confirmed where required, and retrying a corrected submission succeeds exactly once.

**Acceptance Scenarios**:

1. **Given** a likely duplicate receipt, **When** the florist submits it, **Then** the system warns before recording and requires an explicit reason to continue.
2. **Given** a receipt exceeds the project balance, **When** the florist submits it, **Then** the system shows the overpayment amount and requires explicit confirmation.
3. **Given** saving fails, **When** the error is shown, **Then** the modal remains open with the florist's entries intact and the project-level notice distinguishes a failed save from a successful receipt.
4. **Given** a save succeeds, **When** refreshed project data is displayed, **Then** the modal closes and the financial summary, installment rows, project status, and activity agree.
5. **Given** a refund, reversal, dispute, or correction reopens a previously fulfilled installment, **When** financial state is recomputed, **Then** the project retains its current operational status and a prominent needs-attention alert identifies the reopened balance.

### Edge Cases

- A zero-dollar installment remains visible as Not Required; unavailable, waived, canceled, and already-paid installments retain their distinct states and cannot accept an ineligible payment.
- A receipt date is invalid, in the future, or crosses a business-time-zone boundary.
- A receipt amount is one cent below, exactly equal to, or one cent above the outstanding installment or project balance.
- A receipt is applied to the selected installment first and may spill into the next eligible installment only after the florist explicitly confirms the proposed allocation.
- Multiple browser tabs submit the same or different receipts concurrently.
- The selected installment no longer exists or changes state before submission.
- A cash/check intention expires, is superseded, or references an older payment request.
- A planned method differs from the method eventually received.
- A reversal, refund, correction, or dispute later reopens an installment balance.
- A reopened installment balance does not automatically regress project status; it creates a needs-attention alert for florist action.
- Legacy projects contain incomplete paid metadata or ambiguous imported receipts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project details section MUST be titled `Payments / Installments`.
- **FR-002**: Each project MUST retain one canonical deposit installment and one canonical final-payment installment for the active invoice lifecycle unless an installment is explicitly waived or canceled under existing rules.
- **FR-003**: Installment rows MUST represent amounts owed and fulfilled, not individual receipt log entries.
- **FR-004**: Receipts, adjustments, and intentions MUST remain separate historical events that are associated with the affected installment.
- **FR-005**: The system MUST allow an authorized florist to record a supported manual receipt against an eligible installment.
- **FR-005A**: The florist-facing action and modal title MUST use `Record Payment`, and the modal MUST explain that it applies a received payment to an installment.
- **FR-006**: A successful manual receipt MUST atomically preserve the receipt, allocate its principal, recompute affected installments, update applicable request/intention state, record activity, and advance the project status when its payment gate is fulfilled.
- **FR-007**: A failed manual receipt MUST leave no partial receipt, allocation, installment, intention, activity, delivery, or project-status changes.
- **FR-008**: A fully credited installment MUST satisfy all required paid-state information and be displayable as Paid without violating existing financial validation.
- **FR-009**: A partially credited installment MUST display Partially Paid and its exact remaining balance.
- **FR-009A**: An installment with an exact $0.00 target MUST remain visible as `Not Required` and MUST NOT permit Record Payment.
- **FR-010**: A receipt MUST store and display the actual received method and received date as evidence separate from a customer's earlier method intention.
- **FR-011**: A current cash or check intention MUST be projected onto its associated installment as `Cash (planned)` or `Check (planned)` while the installment remains unpaid.
- **FR-011A**: When one active payment request covers multiple outstanding installments, its cash/check intention MUST be projected as planned on every outstanding installment covered by that request.
- **FR-011B**: A cash, check, or Venmo business-profile fallback intention MUST pause automated reminders for exactly seven calendar days without stacking or extending an existing active pause. If no receipt is recorded, reminder delivery MUST resume with the next otherwise eligible occurrence after the pause and MUST NOT backfill skipped occurrences.
- **FR-012**: A payment intention MUST NOT increase credited principal, reduce the outstanding balance, mark an installment Paid, or advance project status.
- **FR-013**: When a receipt fulfills an active intention, the intention MUST become fulfilled while its historical record remains available.
- **FR-014**: When the received method differs from the planned method, the current installment display MUST prefer the actual received method and preserve the planned method in history.
- **FR-014A**: Record Payment MUST preselect an active planned cash or check method for the selected installment while allowing the florist to change it before saving.
- **FR-015**: Each installment row MUST show its installment type, target amount, credited principal, outstanding balance, fulfillment state, method state, and due date when available.
- **FR-015A**: Each installment row MUST be expandable and MUST retain all summary fields whether collapsed or expanded.
- **FR-015E**: Installments MUST load collapsed on initial page load and every installment affected by a newly recorded payment MUST expand automatically after the successful refresh.
- **FR-015B**: Expanded installment content MUST show one child row for each receipt allocated to that installment, including at minimum the allocated amount, actual received method, received date, and payment reference.
- **FR-015C**: When receipts allocated to one installment use more than one actual method, the parent installment's method summary MUST display `Multiple`; each child receipt row MUST display its own actual method.
- **FR-015D**: A receipt allocated across multiple installments MUST appear in each affected installment's expanded content with only that installment's allocated amount and the same shared receipt reference.
- **FR-015F**: A receipt affected by a refund, reversal, dispute, or correction MUST remain visible with its current status, and each related adjustment MUST appear beneath that receipt with its amount, type, date, and reference when available.
- **FR-016**: The deposit and final installment targets MUST continue to reconcile to the authoritative active invoice total according to the existing deposit-freeze and revision rules.
- **FR-017**: Recording the full deposit MUST advance an eligible Awaiting Deposit project to Booked and establish its booked date exactly once.
- **FR-018**: When the deposit is fulfilled and confirmed principal fulfills the final-payment installment, the system MUST stop future final-payment reminders and move an eligible project from Awaiting Final Payment to Final Prep exactly once. If one confirmed receipt fulfills both installments while the project is Awaiting Deposit, the system MUST apply both payment gates and move directly to Final Prep. Protected or terminal project statuses MUST remain unchanged.
- **FR-018A**: A refund, reversal, dispute, or correction that reopens an installment MUST NOT automatically regress project status and MUST create a prominent needs-attention alert identifying the reopened balance.
- **FR-019**: Receipt retries MUST be idempotent and MUST NOT duplicate financial credit, activity, or customer receipt delivery.
- **FR-020**: Duplicate and overpayment warnings MUST require the existing explicit florist confirmation before the receipt is recorded.
- **FR-020A**: A receipt MUST allocate to the florist-selected installment first; any excess MUST show the proposed next-installment allocation and require explicit confirmation before recording.
- **FR-021**: The receipt modal MUST retain entered values after a failed save and show a safe, actionable error message.
- **FR-022**: Successful receipt recording MUST refresh all project financial displays so installment rows, Financial Summary, activity, and project status agree without a manual page reload.
- **FR-023**: Existing unpaid deposit and final installments MUST be repaired in place when necessary; the feature MUST NOT replace them with newly generated duplicate rows.
- **FR-024**: Legacy paid installments with incomplete evidence MUST be classified or repaired without inventing receipt facts, and ambiguous cases MUST be flagged for review.
- **FR-025**: Customer-facing payment selection, payment reminders, electronic provider reconciliation, and proposal invoice calculation behavior MUST remain unchanged except where necessary to keep installment and intention projections consistent.

### Constitution Alignment *(mandatory)*

- **Surface**: This feature affects the CRM admin project-details surface and the payment data boundary. The public payment page is preserved except for the existing cash/check intention being reflected correctly in CRM state.
- **Product Owner Approval**: The requested CRM terminology and behavior are explicitly authorized by the product owner. No marketing content, SEO behavior, or unrelated public-site styling is changed.
- **Brownfield Preservation**: Existing canonical deposit/final obligations, immutable receipt history, duplicate and overpayment controls, proposal totals, reminders, provider reconciliation, and activity history are preserved. Manual receipt allocation, the generic `Payments` project-section label, and broken manual-receipt behavior are explicitly authorized for refinement.
- **Supabase Security**: Payment obligations, transactions, allocations, intentions, deliveries, activities, and projects remain unavailable for anonymous mutation. Only authenticated internal users may initiate manual receipts through the approved command boundary; trusted provider paths retain their existing privileged access.
- **Schema Migration**: Any changed financial constraint, obligation projection, or stored-data repair MUST include an executable migration for existing environments and a matching declarative definition. The migration MUST preserve existing installments and immutable financial history.
- **Standalone Edge Functions**: No Edge Function change is expected. If planning finds one necessary, it MUST remain independently deployable with no shared local imports, and no automated Edge Function test or harness may be created.
- **Testing Expectations**: Focused CRM component/service tests and database integration tests MUST cover full, partial, duplicate, overpayment, replay, concurrency, rollback, intention projection, exact seven-day non-stacking pause and no-backfill resumption, paid-state validation, and legacy repair. Edge Functions remain excluded from automated tests.
- **Sensitive Data**: Financial references, customer intentions, received methods, dates, notes, and actor information MUST be minimized by role and never expose provider payloads, payment tokens, secrets, or unnecessary customer data.
- **Proposal Workflow**: Active invoice totals, the planning data flow, manual Canva PDF upload, proposal revision history, and future payment/reporting data remain preserved.
- **Git Publication**: Commit and push actions remain the human operator's responsibility.

### Key Entities *(include if feature involves data)*

- **Payment Installment**: One canonical deposit or final-payment amount owed for a project, including its target, credited principal, outstanding balance, due date, fulfillment state, and current planned/received-method projection.
- **Payment Receipt**: Immutable evidence that funds were received, including amount, actual method, received date, reference, source, actor, and current adjustment state.
- **Receipt Allocation**: The exact principal from a receipt applied to a specific installment in a deterministic order.
- **Installment Receipt Row**: An expandable child presentation of a receipt allocation, including the amount applied to that installment and the receipt's actual method, received date, and reference.
- **Receipt Adjustment Row**: A child of an installment receipt row that explains a refund, reversal, dispute, or correction and its effect on credited principal.
- **Payment Intention**: A customer's time-limited plan to pay by cash or check; it informs the florist and reminder behavior but does not prove receipt.
- **Project Financial Summary**: The authoritative aggregate of invoice total, installment targets, credited principal, fees, outstanding balance, and overpayment.
- **Payment Activity**: A redacted, human-readable history entry describing intentions, receipts, allocations, failures, and project payment-status changes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of valid full-deposit manual receipts complete successfully and update the existing deposit installment without creating another installment row.
- **SC-002**: For every tested project, the deposit and final installment targets reconcile to the active invoice total to the cent, and their credited plus outstanding amounts reconcile to their targets to the cent.
- **SC-003**: Cash and check choices are displayed as planned methods within one project-details refresh while leaving credited principal and project status unchanged.
- **SC-004**: After a successful receipt, the installment row, Financial Summary, activity history, and project status agree within one refresh cycle in 100% of tested cases.
- **SC-005**: Replaying the same receipt operation up to five times produces exactly one receipt, one allocation set, one credited result, one payment activity, one customer receipt delivery, one intention-fulfillment effect, and no duplicate project-status transition.
- **SC-006**: All tested validation and persistence failures leave zero partial financial changes and retain the florist's modal input for correction.
- **SC-007**: A florist can identify whether a method is planned or actually received from the installment row without opening another screen in every usability test case.
- **SC-008**: Existing projects retain exactly their canonical deposit and final-payment installments after migration, with no loss or fabrication of receipt history.
- **SC-009**: For every tested split-method installment, expanding the parent row reveals one correctly valued child row per applied receipt and the child allocations sum exactly to the parent's credited principal.
- **SC-010**: For every tested spillover receipt, the allocated child amounts shown across affected installments sum exactly to the receipt principal and share one payment reference.
- **SC-011**: After every tested successful Record Payment action, all affected installments expand within the resulting refresh and display the new receipt without further florist interaction.
- **SC-012**: In every tested adjustment scenario, the original receipt and all related adjustments remain traceable from the installment expansion and reconcile to the installment's current credited principal.
- **SC-013**: In every tested reopened-balance scenario, the project retains its prior operational status and displays exactly one active needs-attention alert for the unresolved balance.
- **SC-014**: In reminder testing, every cash, check, and Venmo business-profile fallback intention pauses reminders for exactly seven calendar days without stacking or extension, after which only the next eligible occurrence may send without backfilling skipped reminders.
- **SC-015**: In every tested final-payment fulfillment, an eligible Awaiting Final Payment project advances to Final Prep exactly once, an Awaiting Deposit project whose two installments are fulfilled together advances directly to Final Prep, future final reminders stop, and protected or terminal statuses remain unchanged.

## Assumptions

- The two existing rows are canonical invoice installments, not duplicate or erroneous payment logs.
- `Paid` means verified received principal fulfills the installment; a customer intention alone always remains unpaid.
- The installment's method display uses an explicit `(planned)` qualifier until receipt evidence exists.
- Actual receipt method takes precedence in the current row display while intention history remains available.
- An active planned cash/check method is a convenience default in Record Payment, never a locked value or receipt fact.
- A consolidated intention applies only to the outstanding installments covered by its payment request and does not alter their financial fulfillment.
- Cash, check, and Venmo business-profile fallback intentions preserve the existing non-stacking seven-calendar-day reminder pause; recording a receipt fulfills the applicable intention before reminder eligibility is evaluated again.
- A parent installment with confirmed receipts from different methods displays `Multiple`; the expanded receipt rows provide the method-level detail.
- Existing deposit-freeze, project-status, duplicate, overpayment, reminder, retention, and immutable-ledger rules remain authoritative; manual receipt allocation is refined to selected-installment-first with confirmed spillover.
- Final-payment fulfillment preserves the existing forward-only gates: Awaiting Final Payment advances to Final Prep, simultaneous deposit/final fulfillment may advance Awaiting Deposit directly to Final Prep, and protected or terminal statuses never regress or change automatically.
- Reopened balances are operational exceptions: installment totals update immediately, while project status remains forward-only until the florist takes an authorized action.
- The current manual-receipt failure is treated as a consistency defect between paid installment state and its required receipt metadata, not as a reason to weaken financial validation.
- No new payment provider or customer-facing payment method is introduced.
