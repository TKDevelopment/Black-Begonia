# Feature Specification: Integrated Project Payments

**Feature Branch**: `007-project-payments`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "Add integrated project payment tracking for deposits, installments, invoice fulfillment, conversion-time deposit email choice, secure customer payment links with Venmo, card, check, and cash options, automatic payment reconciliation and status changes, final-payment reminder emails, a CRM payments table with detail modal, Stripe processing fees, and complete project financial and activity visibility while preserving existing project payment functionality."

## Clarifications

### Session 2026-07-19

- Q: Who controls the amount of an electronic installment request? -> A: The florist may issue fixed-amount installment requests; customers cannot edit the requested amount.
- Q: What happens when a customer card-processing fee is not permitted? -> A: Charge the 3% fee only when permitted; otherwise Black Begonia absorbs it and card payment remains available.
- Q: How should Venmo collection work when verified integrated checkout is not available? -> A: Prefer integrated Venmo checkout with verified confirmation; fall back to the Black Begonia business-profile link and manual reconciliation.
- Q: What happens to project status after a payment reversal, refund, dispute, or correction reopens a balance? -> A: Keep the current status, create an urgent payment exception, and let the florist decide whether to change status.
- Q: What does each row on the Payments table represent? -> A: One deposit or final-payment obligation; its modal contains every related request, installment, receipt, fee, and event.
- Q: Should outstanding deposits receive automatic reminder emails? -> A: Yes. After the initial deposit email is sent, remind the customer weekly until the deposit is paid.
- Q: Which customer receives payment-request and reminder emails? -> A: The designated billing contact; if none is designated, use the primary project contact.
- Q: How long should a secure customer payment link remain valid? -> A: While its payment request is active; invalidate it on fulfillment, supersession, project cancellation, or florist revocation.
- Q: What date should the project deposit obligation use as its due date? -> A: Always use the project conversion date.
- Q: What happens when a project still has an unpaid deposit at the 60-day final-collection boundary? -> A: Supersede separate customer requests with one request for the full outstanding project balance.
- Q: What should customers see after returning from an electronic payment provider? -> A: A branded status page showing processing, confirmed, failed, or still outstanding from trusted payment state.
- Q: When should customers receive Black Begonia payment receipt emails? -> A: Automatically after every confirmed electronic or florist-recorded manual payment.
- Q: What happens to reminders after a customer records a cash/check intention? -> A: Pause them for seven days, then resume automatically if no receipt has been recorded.
- Q: What manual controls should the florist have over automated reminders? -> A: Per-obligation pause/resume controls plus a global emergency on/off switch.
- Q: Which financial adjustments should automatically notify the customer? -> A: Confirmed refunds and provider reversals; dispute and manual-correction notices remain florist-controlled.
- Q: What does invoice fulfillment include in this feature? -> A: Track fulfillment of deposit/final obligations against the active proposal; do not generate separate invoice documents or accounting integrations.
- Q: Where do customer-facing cash and check instructions come from? -> A: Florist-managed global instructions, snapshotted onto each payment request when it is issued.
- Q: How should payment principal above one obligation's remaining amount be allocated? -> A: Apply it to the next outstanding obligation on the same project; flag only value beyond the entire project balance.
- Q: How many active electronic checkout attempts may one payment request have? -> A: One; reuse it until resolved, expired, or canceled by the florist.
- Q: May a customer switch payment methods while an electronic checkout is active? -> A: No; all method changes remain locked until resolution, expiry, or florist cancellation.
- Q: Which Stripe customer-payment surface should card payments use? -> A: A Stripe-hosted Checkout page created for the fixed one-time payment request.
- Q: How long should minimized payment financial and audit records be retained? -> A: Seven years after project completion; invalidate secrets and discard unnecessary raw provider data earlier.
- Q: Should receipts and adjustments have a shared customer-facing reference format? -> A: Yes. Generate a unique immutable Black Begonia reference for every receipt and adjustment.
- Q: What happens when a manual payment appears to duplicate an existing receipt? -> A: Warn and require an explicit florist override reason before recording it.
- Q: How should a true project overpayment be resolved? -> A: The florist records an external refund, retained customer credit, or correction with a required reference/note; the CRM does not initiate refunds.
- Q: Which recipient should later messages use after project contacts change? -> A: Resolve the current billing contact, or primary-contact fallback, for every delivery; retain the request's original recipient only for audit.
- Q: What happens to the deposit target after any confirmed receipt and a later proposal revision? -> A: Freeze the deposit target at the amount in effect for the first confirmed receipt; later revisions change final and project outstanding balances only.
- Q: Which delivery state anchors the seven-day deposit-reminder interval? -> A: The Mailgun acceptance time for the initial deposit request anchors the interval; later delivery events remain separate audit states.
- Q: When may the 3% customer card fee be enabled? -> A: Keep it disabled and merchant-absorbed until an approved mechanism can establish transaction eligibility and compliance; only then charge eligible credit-card transactions.
- Q: Does a Venmo business-profile fallback handoff pause reminders? -> A: Yes. It creates a zero-value intention and the same non-stacking seven-day pause as cash or check.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Convert A Lead And Request The Deposit (Priority: P1)

As a florist converting an accepted lead, I want to decide whether to send the customer a deposit-payment email so the project is created immediately and I can either begin digital collection or handle the deposit manually.

**Why this priority**: Every new project enters the payment lifecycle through conversion, and collecting the 30% deposit is the gate to booking the event.

**Independent Test**: Convert one accepted lead with the email option selected and another without it; verify both projects enter Awaiting Deposit and only the selected customer receives a usable deposit request.

**Acceptance Scenarios**:

1. **Given** an accepted lead with an eligible proposal total and customer email, **When** the florist converts the lead, **Then** the conversion experience asks whether to send a deposit-payment email and identifies the 30% deposit amount due on the conversion date.
2. **Given** the florist chooses to send the email, **When** conversion succeeds, **Then** the project is immediately marked Awaiting Deposit, a deposit obligation due on the conversion date is created, and a deposit email containing a secure project-specific payment link is requested for the customer.
3. **Given** the florist chooses not to send the email, **When** conversion succeeds, **Then** the project is immediately marked Awaiting Deposit, its deposit obligation remains visible to the florist, and no customer payment email is sent.
4. **Given** conversion succeeds but email delivery fails, **When** the florist views the result or project, **Then** the converted project remains intact and Awaiting Deposit, the failure is visible, and the florist can retry sending the payment request.
5. **Given** neither the designated billing contact nor the primary project contact has a usable email, **When** the florist converts the lead, **Then** sending is unavailable with a clear explanation while conversion and manual payment logging remain available.
6. **Given** Mailgun accepted the initial deposit email and the deposit remains outstanding, **When** each seven-day interval from that acceptance time is reached, **Then** the customer receives no more than one weekly deposit reminder containing the current secure payment link.
7. **Given** the florist declined the initial deposit email, **When** weekly reminder processing runs, **Then** no deposit reminder is sent unless the florist later sends or activates a deposit request.

---

### User Story 2 - Choose A Secure Payment Method (Priority: P1)

As a customer, I want a simple branded payment-options page for my specific project so I can choose Venmo, debit/credit card, check, or cash without accessing the florist's CRM.

**Why this priority**: The customer-facing payment choice is the primary collection experience and must be trustworthy, minimal, and secure.

**Independent Test**: Open a valid deposit or final-payment link as an unauthenticated customer and exercise each payment choice, including invalid and already-paid link states.

**Acceptance Scenarios**:

1. **Given** an outstanding payment request with a valid secure link, **When** the customer opens it, **Then** a mobile-friendly, Linktree-style page shows Black Begonia branding, the payment purpose, project/event context, base amount due, applicable fee, total to be charged, and Venmo, debit/credit card, check, and cash choices.
2. **Given** the customer chooses Venmo and verified integrated checkout is available, **When** the handoff is created, **Then** the customer enters the Venmo checkout experience for the florist-defined amount and the resulting provider confirmation can be matched to the payment request.
3. **Given** verified integrated Venmo checkout is unavailable, **When** the customer chooses Venmo, **Then** the customer is directed to the official Black Begonia Venmo business profile with the intended amount and a project-specific reconciliation reference wherever supported, a zero-value intention pauses reminders for seven days without stacking, and the page explains that the florist will confirm receipt.
4. **Given** the customer chooses debit/credit card, **When** the handoff is created, **Then** the customer is redirected to a Stripe-hosted Checkout page for that fixed one-time payment request and the displayed charge includes a 3% processing fee when that fee is permitted for the transaction.
5. **Given** a customer card-processing fee is not permitted for the transaction, **When** the customer chooses debit/credit card, **Then** card payment remains available, the customer is charged only the requested principal, and Black Begonia absorbs the processing cost.
6. **Given** the customer chooses cash or check, **When** they confirm the choice, **Then** the system records a payment intention rather than a completed payment, shows customer instructions, and notifies the florist through the project activity history.
7. **Given** a link is invalid, revoked, no longer applicable, or belongs to a fulfilled obligation, **When** it is opened, **Then** no private project data or payment action is exposed and the customer sees a safe, actionable status message.
8. **Given** a customer revisits a valid link after choosing cash or check, **When** the obligation is still outstanding, **Then** the page shows the recorded intention and still permits choosing another available method without recording duplicate paid funds.
9. **Given** the florist creates an installment request for less than the outstanding obligation, **When** the customer opens the payment page, **Then** the page and provider handoffs use the florist-defined amount and do not allow the customer to change it.
10. **Given** an older email contains the link for a payment request that remains active, **When** the customer opens it, **Then** the same link remains usable without requiring a replacement solely because time elapsed.
11. **Given** a customer returns from integrated Venmo or card checkout, **When** trusted confirmation is not yet available, **Then** a branded payment-status page shows Processing without marking funds paid and later shows Confirmed, Failed, or Still Outstanding from the authoritative payment state.
12. **Given** the customer confirms a cash/check intention, **When** reminder eligibility is evaluated during the next seven calendar days, **Then** automated reminders are paused; after that period, the next otherwise eligible reminder is sent if no receipt has been recorded.
13. **Given** the florist changes the configured cash or check instructions after a payment request was issued, **When** a customer opens that existing request, **Then** it continues to show the snapshotted instructions originally issued while new requests use the updated instructions.
14. **Given** an electronic checkout for the payment request is already active, **When** the customer selects the same electronic method again or opens another tab, **Then** the active checkout is reused and no concurrent checkout is created; a replacement becomes available only after trusted resolution, provider expiry, or florist cancellation.
15. **Given** an electronic checkout is active, **When** the customer attempts to select another electronic method, cash, or check, **Then** method changes are unavailable and the customer is directed to the checkout's Processing state until it resolves, expires, or the florist cancels it.

---

### User Story 3 - Reconcile Receipts And Advance The Project (Priority: P1)

As a florist, I want confirmed payments from every supported method to be reflected once, allocated to the correct project obligation, and used to advance project status so the CRM accurately represents what is still owed.

**Why this priority**: Incorrect or duplicate financial records can cause revenue loss, premature booking, and customer disputes.

**Independent Test**: Confirm deposit and final-payment receipts through card, Venmo, cash, and check flows; replay provider confirmations; test partial installments and verify balances, fulfillment, activity, and project statuses.

**Acceptance Scenarios**:

1. **Given** an outstanding deposit, **When** verified receipt transactions cumulatively satisfy the deposit amount, **Then** the deposit is marked paid, the project moves from Awaiting Deposit to Booked, and one auditable status transition is recorded.
2. **Given** an outstanding final-payment balance, **When** verified receipt transactions cumulatively satisfy that balance, **Then** final payment is marked paid, reminders stop, and the project moves from Awaiting Final Payment to Final Prep unless it is already in a protected terminal status.
3. **Given** a customer completes only part of an obligation, **When** the receipt is recorded, **Then** the installment appears in payment history, the obligation remains partially paid, the remaining balance is recalculated, and the project does not advance through the payment gate.
4. **Given** the same provider confirmation is delivered more than once, **When** it is processed repeatedly or concurrently, **Then** only one receipt and one corresponding financial effect exist.
5. **Given** a customer selected cash or check, **When** the florist later records the funds as received, **Then** a manual receipt is created against the original obligation and the same fulfillment and project-status rules apply.
6. **Given** a payment is reversed, refunded, disputed, or manually corrected and an obligation becomes outstanding again, **When** the change is verified and recorded, **Then** balances and fulfillment are recalculated, prior history remains auditable, project status is retained, and an urgent payment exception asks the florist whether to change that status.
7. **Given** a full-outstanding-balance request covers both an unpaid deposit and final payment, **When** receipt value is confirmed, **Then** it is allocated to the deposit first and any remainder to final payment, with each obligation and project gate updated from its allocated amount; fulfillment of both obligations moves the project directly to Final Prep.
8. **Given** an electronic payment is confirmed or the florist records a manual cash/check payment, **When** the receipt transaction is committed, **Then** it receives an immutable Black Begonia reference and the resolved billing recipient automatically receives a receipt email identifying that reference, project, payment purpose, principal credited, separately charged fee if any, method, and receipt date.
9. **Given** a refund or provider reversal is confirmed, **When** the adjustment is committed, **Then** it receives an immutable Black Begonia reference and the resolved billing recipient automatically receives an adjustment notice; dispute and manual-correction notices are sent only when the florist chooses.
10. **Given** confirmed principal exceeds the remaining deposit amount while final payment is outstanding, **When** allocation occurs, **Then** the deposit is fulfilled, the excess is automatically credited to final payment, and only value beyond the entire remaining project balance is flagged as overpayment.
11. **Given** a manual payment resembles an existing receipt, **When** the florist attempts to save it, **Then** the system identifies the suspected match and requires explicit confirmation plus an override reason before creating a new immutable receipt.
12. **Given** a true project overpayment is flagged, **When** the florist resolves it, **Then** they record an externally completed refund, retained customer credit, or corrective ledger event with a required reference or note, and the resolution preserves the original receipt without initiating a provider refund.

---

### User Story 4 - Collect The Final Balance With Reminders (Priority: P1)

As a florist, I want final-payment requests and reminders to be sent automatically according to the event date until the balance is paid so overdue collections do not depend on daily manual follow-up.

**Why this priority**: Final balances represent most project revenue and must be collected before event preparation.

**Independent Test**: Place unpaid projects at each reminder boundary and run the reminder process repeatedly; verify the correct request is sent once per scheduled day and that paid, canceled, completed, ineligible, or past-event projects are skipped.

**Acceptance Scenarios**:

1. **Given** a booked project has an event 60 days away and an unpaid final balance, **When** the reminder schedule is evaluated, **Then** the designated billing contact, or primary project contact when no billing contact is designated, receives a final-payment email with a secure link and the four supported methods.
2. **Given** the final balance remains unpaid, **When** the project reaches 45, 38, and 31 days before the event, **Then** one reminder is sent at each milestone.
3. **Given** the final balance remains unpaid from 30 days before the event through the event date, **When** each local calendar day's schedule is evaluated, **Then** no more than one reminder is sent for that project and payment obligation on that day.
4. **Given** the final balance has been fulfilled, waived, or canceled, or the project is canceled or completed, **When** a reminder becomes due, **Then** no reminder is sent.
5. **Given** a reminder run is retried, delayed, or executed more than once, **When** it processes the same scheduled occurrence, **Then** the customer does not receive a duplicate reminder for that occurrence.
6. **Given** the active proposal total changes before final fulfillment, **When** the next final-payment request is presented, **Then** it uses the latest authoritative total less confirmed project-payment credits and clearly reflects the resulting balance.
7. **Given** a project remains Awaiting Deposit at 60 days before the event, **When** final-payment collection begins, **Then** separate active deposit or final requests are superseded by one full-outstanding-balance request showing the unpaid deposit portion, final-payment portion, and combined amount due.
8. **Given** a consolidated full-balance request is active, **When** later scheduled reminders become due, **Then** they use that request and do not send separate deposit reminders.
9. **Given** a cash/check intention pauses reminders across one or more scheduled occurrences, **When** the seven-day pause ends without a recorded receipt, **Then** reminder delivery resumes with the next eligible occurrence and does not backfill skipped messages.
10. **Given** the florist pauses one obligation or disables reminders globally, **When** scheduled occurrences become due, **Then** no affected emails are sent and payment status is unchanged; after reminders resume, only future eligible occurrences are sent.

---

### User Story 5 - Manage Payments Across The CRM (Priority: P2)

As a florist, I want a Payments CRM table and payment detail modal so I can monitor all project payment obligations, receipts, intentions, and exceptions without opening every project.

**Why this priority**: Centralized operational visibility makes unpaid and failed collections actionable while keeping the established CRM navigation pattern.

**Independent Test**: Load payments representing multiple projects, statuses, kinds, methods, and due dates; search and filter them, open row modals, and verify no separate payment details route is used.

**Acceptance Scenarios**:

1. **Given** payment obligations exist, **When** the florist opens Payments, **Then** a table visually consistent with other CRM table pages shows one row for each project's deposit obligation and one row for its final-payment obligation, summarizing project/customer, event date, payment kind, amount due, amount paid, outstanding balance, payment status, method, and relevant date.
2. **Given** many payment records exist, **When** the florist searches, filters, sorts, or resets the table, **Then** they can isolate records by project/customer, payment kind, status, method, and due/event timing.
3. **Given** the florist selects a payment row, **When** it opens, **Then** a modal shows the obligation calculation, installments/receipts, processing fees, customer method intentions, request and reminder history, external reconciliation references, notes, and related activity.
4. **Given** the detail modal is open, **When** the florist follows its project action, **Then** the related project details screen opens.
5. **Given** the florist closes the modal, **When** they return to the table, **Then** their current search, filters, sort, and table position are preserved.
6. **Given** a payment requires attention because delivery, checkout, reconciliation, or reminder processing failed, **When** it appears in the table or modal, **Then** the failure and an appropriate retry or manual-resolution action are clear.
7. **Given** an obligation's payment modal is open, **When** the florist pauses or resumes its automated reminders, **Then** the control updates that obligation only, records the actor and time, and leaves its financial and fulfillment state unchanged.

---

### User Story 6 - Understand Project Financial Activity (Priority: P2)

As a florist reviewing a project, I want the Financial Summary and activity log to explain every payment state and event so I can answer customer questions and understand the remaining balance without reconstructing history.

**Why this priority**: Project details are the operational source of truth for an individual event and must agree with the central Payments screen.

**Independent Test**: Exercise request creation, email delivery, method intent, partial receipt, fee, fulfillment, reminder, failure, reversal, and manual-payment events; verify the project summary and timeline remain consistent with the Payments modal.

**Acceptance Scenarios**:

1. **Given** a project has an active proposal and payment activity, **When** its Financial Summary loads, **Then** it distinguishes proposal total, deposit target, final-payment target, credited receipts, processing fees, and outstanding project balance.
2. **Given** installments exist, **When** the summary is viewed, **Then** the florist can distinguish partially paid from fully paid obligations and can open or log relevant payment information.
3. **Given** a payment request, email, reminder, customer intention, checkout attempt, confirmed receipt, manual receipt, correction, reversal, or status transition occurs, **When** project activity is viewed, **Then** a timestamped, human-readable entry identifies the action, result, amount where relevant, payment kind, method, and actor or system source without exposing secrets.
4. **Given** financial source data is missing or inconsistent, **When** project details loads, **Then** unavailable values are not treated as zero and the florist sees an actionable warning without losing access to the rest of the project.
5. **Given** the Payments screen, payment modal, and project Financial Summary are viewed after the same activity, **When** their totals are compared, **Then** proposal total, credited amount, fees, and outstanding balance agree.
6. **Given** deposit or final-payment receipts are recorded, **When** invoice fulfillment is reviewed, **Then** fulfillment is derived from those obligations against the active proposal without creating a separate invoice document.

### Edge Cases

- The proposal total is zero, negative, unavailable, or lacks an active authoritative version when a payment obligation would be created; collection is blocked and the florist receives correction guidance.
- Currency calculations produce fractional cents; each displayed and charged amount uses consistent currency rounding, and allocation totals remain internally consistent.
- A proposal is revised before the deposit is paid; the outstanding deposit target updates to 30% of the new authoritative total and the prior request is superseded.
- A proposal is revised after the deposit is paid; the paid deposit remains historical credit and the final balance becomes the current authoritative total minus all valid credited receipts.
- A project reaches 60 days before the event with an unpaid deposit; separate active collection requests are superseded without deleting either obligation, and one full-balance request spans the remaining deposit and final amounts.
- Confirmed principal exceeds one obligation but not the project balance; the source obligation is fulfilled and the excess is automatically allocated to the next outstanding project obligation.
- Confirmed principal exceeds the entire current project balance; the true overpayment is displayed explicitly and is not silently discarded, automatically refunded, or used to create a negative balance.
- A retained customer credit exists after overpayment resolution; it remains visible and unapplied until the florist performs a later explicit audited allocation, and it is never moved automatically to another obligation or project.
- A provider reports success after the payment request was superseded, revoked, or already fulfilled; the receipt is retained for reconciliation, never duplicated, and flagged if it creates an exception.
- Verified integrated Venmo checkout is unavailable or ineligible; the system falls back to the official Black Begonia business profile, choosing Venmo does not mark the obligation paid, and the florist must reconcile or record the receipt from trustworthy evidence.
- A card checkout is abandoned, expires, or fails; the obligation remains outstanding, no receipt is created, and the customer may retry safely.
- A provider redirects the customer before its trusted confirmation arrives or the confirmation is delayed; the payment-status page remains in Processing, does not infer success, and offers safe refresh or return guidance.
- Multiple tabs or repeated customer actions request electronic checkout concurrently; all receive the same active checkout identity and only one provider checkout can accept payment for that request at a time.
- A customer wants to switch to cash, check, or another provider while an electronic checkout remains active; the method is locked, no new intention or checkout is created, and the customer receives guidance to wait or contact the florist for cancellation.
- A customer changes from cash/check intent to an electronic method; intent history is retained but only confirmed funds count toward fulfillment.
- A customer records a second cash/check intention while a pause is active; it updates the intention history but does not extend or stack the existing seven-day pause unless the first intention was superseded by a genuinely new payment request.
- Event dates are changed after reminders have been scheduled; future occurrences follow the new date and previously sent messages remain in history.
- The designated billing contact changes or loses a usable email; future messages use the current designated billing contact or fall back to the primary project contact while prior delivery history remains unchanged.
- Neither the designated billing contact nor the primary project contact has a usable email; automated delivery is blocked, the intended occurrence remains visible for correction, and no successful delivery is fabricated.
- An initial deposit email or weekly reminder is retried or processed concurrently; each intended delivery is recorded no more than once, and a failed attempt remains retryable.
- The global reminder switch is disabled while scheduled occurrences become due; affected occurrences are recorded as suppressed for operational visibility, are not delivered or backfilled, and future occurrences resume only after the switch is re-enabled.
- A project is canceled, completed, or manually placed in a later operational state while a provider event or reminder is in flight; funds are recorded if received, and no status is overwritten silently.
- A reversal, refund, dispute, or correction reopens a previously fulfilled balance; the current project status is retained, an urgent payment exception remains visible until resolved, and only the florist may choose a new operational status.
- Two staff actions or automated confirmations attempt to satisfy the same obligation concurrently; totals, fulfillment, and status change exactly once.
- A suspected manual duplicate is legitimate; the florist may override the warning with a required reason, and the new receipt retains both that reason and the suspected matching reference for audit.
- Legacy payment records lack request, transaction, fee, or reminder details; they remain visible as imported/manual history and are not fabricated.
- Customer access links are forwarded; the page reveals only the minimum payment context and never grants access to CRM, proposal details, internal notes, or other projects.
- A project reaches the end of its seven-year payment-record retention period while subject to a documented legal or dispute hold; scheduled deletion is suspended until the hold is released.
- Automated email service or payment provider is temporarily unavailable; failures are observable and retryable without duplicating obligations, receipts, or scheduled messages.
- A payment is confirmed but its receipt email fails; the financial transaction and project status remain committed, the failed delivery is visible and retryable, and retrying cannot duplicate the payment or send more than one successful receipt for that transaction.
- A refund or provider reversal is committed but its customer notice fails; the adjustment remains effective, the delivery failure is visible and retryable, and no duplicate adjustment or successful notice is created.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST preserve existing project payment records, manual payment logging, project Financial Summary, activity history, proposal financial values, and payment-gated project statuses unless this specification explicitly strengthens their behavior.
- **FR-002**: System MUST represent each project's deposit and final-payment obligation independently from individual customer intentions, payment requests, receipt transactions, fees, and message deliveries, even when one consolidated request collects both obligations. Invoice fulfillment in this feature MUST mean fulfillment of those obligations against the active proposal.
- **FR-003**: System MUST associate every payment obligation, request, intention, transaction, reminder, and exception with exactly one project and its applicable payment purpose. A request MAY cover both deposit and final-payment obligations only when it is the consolidated full-outstanding-balance request created at or within 60 days of the event.
- **FR-004**: System MUST calculate the initial deposit obligation as 30% of the authoritative project proposal total, rounded consistently to currency precision, and MUST use the project conversion date as its due date regardless of any earlier proposal retainer due date.
- **FR-005**: System MUST calculate the final-payment obligation from the latest authoritative project proposal total less all valid receipt credits applied to the project.
- **FR-006**: Provider processing fees MUST NOT reduce the project principal credited as paid or inflate the proposal total or remaining project balance.
- **FR-007**: A card payment MUST add a processing fee equal to 3% of the florist-defined requested base amount only after an approved mechanism can establish that the specific credit-card transaction is eligible and compliant, MUST round it consistently to currency precision, and MUST disclose the base amount, fee, and total charge before handoff. Customer surcharging MUST remain disabled until that mechanism is configured and approved. When eligibility cannot be established, card payment MUST remain available, the customer MUST be charged only the requested principal, and Black Begonia MUST absorb the provider processing cost.
- **FR-008**: Venmo, cash, and check MUST NOT add the card processing fee.
- **FR-009**: Lead conversion MUST ask the florist whether to send the deposit-payment email before the conversion is confirmed.
- **FR-010**: Lead conversion MUST set the resulting project to Awaiting Deposit regardless of the email choice.
- **FR-011**: Lead conversion MUST create or establish the project's deposit obligation regardless of the email choice.
- **FR-012**: Choosing not to send the deposit email MUST leave manual payment recording available, MUST NOT be treated as an email failure, and MUST suppress weekly deposit reminders unless the florist later sends or activates a deposit request.
- **FR-013**: A deposit-email delivery failure MUST NOT roll back a successful conversion and MUST be visible with a retry action. After Mailgun accepts the initial deposit email, the system MUST use that acceptance time as the seven-day reminder anchor and send no more than one reminder at each interval while the deposit remains outstanding and the deposit-only request remains active; later delivery events remain separate audit facts, and reminders MUST stop when a consolidated full-balance request supersedes it.
- **FR-014**: Each customer payment delivery MUST resolve the current designated billing contact or, when none is designated, the current primary project contact, and MUST snapshot that resolved recipient and fallback decision on the delivery. The payment request MUST retain its originally resolved recipient for audit only. Messages MUST identify Black Begonia, the payment purpose, project/event context sufficient for recognition, amount requested, and a secure payment-options link.
- **FR-015**: Customer access links MUST be unguessable, scoped to one payment request, revocable, and valid only while that request remains active. They MUST be invalidated immediately upon obligation fulfillment, request supersession, project cancellation, or florist revocation rather than expiring solely because a fixed time elapsed.
- **FR-016**: Customer access links and displayed pages MUST expose only the minimum customer-facing payment context and MUST NOT expose internal identifiers, internal notes, proposal line-item details, CRM access, secrets, or another project's data.
- **FR-017**: A valid customer payment page MUST remain revisitable through the same link while its request is active so a customer can recover from an abandoned handoff, open an older reminder, or reconsider a cash/check intention.
- **FR-018**: The customer payment page MUST be responsive and visually present Venmo, debit/credit card, check, and cash as distinct choices in a simple branded layout.
- **FR-019**: The customer payment page MUST show the payment purpose, florist-defined fixed base amount currently requested, any applicable processing fee, total charge, and safe project/event context before the customer selects a provider handoff, and the customer MUST NOT be able to edit that amount.
- **FR-020**: Venmo handoff MUST prefer a verified integrated checkout that uses the florist-defined amount and unique reconciliation identity. When verified integrated checkout is unavailable, it MUST use Black Begonia's approved Venmo business-profile destination, pass the amount and reconciliation reference where supported, create a zero-value payment intention, and pause reminders for seven days without stacking.
- **FR-021**: Electronic payment handoff MUST be created for the exact payment request and MUST pass sufficient project, obligation, amount, fee, and reconciliation context to match a verified provider result without trusting customer-edited return data. Card payments MUST use a Stripe-hosted Checkout page for the fixed one-time payment request, not Stripe Customer Portal, embedded Checkout, or a custom card form. Each payment request MUST have at most one active electronic checkout, which repeat attempts reuse and which locks all payment-method changes until trusted resolution, provider expiry, or audited florist cancellation. The customer MUST return to a branded payment-status page scoped to that request.
- **FR-022**: Selecting Venmo, starting card checkout, or returning from either provider MUST NOT by itself mark any amount paid. The return page MUST show Processing until trusted state resolves to Confirmed, Failed, or Still Outstanding.
- **FR-023**: When no electronic checkout is active, selecting cash or check MUST show the method-specific florist-managed instructions snapshotted when the request was issued, record a customer payment intention, keep the obligation outstanding, keep a deposit-stage project Awaiting Deposit, add a florist-visible activity entry or note, and pause automated reminders for seven calendar days. Cash/check selection MUST be unavailable while an electronic checkout is active.
- **FR-024**: Cash, check, and Venmo business-profile fallback intention records MUST retain method, time, request, reminder-pause start/end, and current/superseded state while contributing zero to amount paid. Repeated selection during the same active pause MUST NOT stack or extend that pause.
- **FR-025**: Credited payment value MUST be created only by an authenticated provider-confirmation workflow or an authorized florist's idempotent manual-receipt command; no browser-originated handoff, approval callback, return parameter, or business-profile visit may invoke the credited-value boundary directly.
- **FR-026**: Every receipt MUST receive a unique immutable human-readable Black Begonia reference and record amount, payment purpose, method, receipt time, source, external reconciliation reference when available, and the person or trusted system that recorded it. After an electronic or manual receipt is committed, the system MUST automatically email the resolved billing recipient a Black Begonia receipt showing its reference, project context, principal credited, separately charged customer fee if any, method, and receipt date.
- **FR-027**: The system MUST allow the florist to issue fixed-amount installment requests against the deposit or final-payment obligation, support multiple resulting receipts, and derive not paid, partially paid, paid, overpaid, waived, or canceled fulfillment from valid credits and obligation state. Principal MUST allocate to the deposit first and then to final payment whenever a receipt spans or exceeds the deposit's remaining amount.
- **FR-028**: Repeated or concurrent checkout creation MUST resolve to the one active checkout for the payment request, and repeated or concurrent processing of the same external payment confirmation or manual submission MUST NOT create duplicate credited receipts, activity, or project-status effects.
- **FR-029**: Verified refunds, reversals, disputes, voids, and corrections MUST receive their own unique immutable human-readable Black Begonia reference and be represented as additional auditable financial events rather than destructive edits to receipt history. Confirmed refunds and provider reversals MUST automatically create a customer adjustment notice containing that reference; dispute and manual-correction notices MUST require florist choice. When an event reopens a balance, the system MUST retain the current project status and create an urgent payment exception for florist review.
- **FR-030**: Fulfilling the deposit MUST move an eligible Awaiting Deposit project to Booked exactly once unless the same reconciliation also fulfills final payment, in which case both payment gates MUST be applied without leaving the project at Booked.
- **FR-031**: A cash/check intention MUST NOT move a project to Booked; only recorded receipt value satisfying the deposit may do so.
- **FR-032**: Fulfilling final payment MUST stop future final-payment reminders and move an eligible active project whose deposit is also fulfilled to Final Prep exactly once, including a project that began the consolidated reconciliation in Awaiting Deposit.
- **FR-033**: Payment reversals, refunds, disputes, and corrections MUST NOT automatically regress any project status. The florist MUST explicitly decide whether to change status after reviewing the resulting urgent payment exception.
- **FR-034**: At 60 days before the event, a Booked project with an unpaid final balance MUST begin final-payment collection. If the project still has an unpaid deposit, the system MUST supersede separate active deposit/final requests with one request for the full outstanding project balance while retaining both underlying obligations.
- **FR-035**: An unpaid final or consolidated full-project balance MUST receive follow-up reminders at 45, 38, and 31 days before the event and once per local calendar day from 30 days before the event through the event date.
- **FR-036**: Reminder eligibility MUST be reevaluated using current project status, event date, the current designated billing contact or current primary-contact fallback, obligation state, outstanding balance, active cash/check/Venmo-fallback pause, florist-controlled obligation pause, and global reminder switch before each send. Each attempt MUST snapshot the newly resolved recipient. Skipped or suppressed occurrences MUST NOT be backfilled; only the next otherwise eligible occurrence may send after all applicable pauses end.
- **FR-037**: No final-payment reminder MUST be sent for a fulfilled, waived, or canceled obligation; a Canceled or Completed project; a nonpositive balance; or an event date that has passed.
- **FR-038**: Each scheduled reminder occurrence MUST be sent no more than once even when processing is retried or run concurrently.
- **FR-039**: Request, reminder, receipt-email, and adjustment-notice delivery history MUST record the intended occurrence or source transaction, resolved recipient and whether billing-contact fallback was used, relevant amount, outcome, and time without storing customer-access secrets in activity text. Message failure MUST NOT roll back or duplicate the committed payment or adjustment.
- **FR-040**: Failed reminder delivery MUST remain visible and retryable without advancing the schedule as if delivery succeeded or creating duplicate successful deliveries. Authorized florists MUST be able to pause/resume reminders for one obligation and enable/disable all automated reminders globally without changing financial, fulfillment, or project status; each control change and suppressed occurrence MUST be auditable.
- **FR-041**: The CRM MUST include a Payments destination using the established visual and interaction conventions of other CRM table pages, with each row representing one project deposit or final-payment obligation rather than an individual request or financial transaction.
- **FR-042**: Each Payments table obligation row MUST summarize related project/customer, event date, payment purpose, amount due, amount credited across all related receipts, outstanding balance, fulfillment status, latest method or intent, and relevant due/paid date.
- **FR-043**: Florists MUST be able to search, filter, sort, and reset the Payments table by relevant project/customer, payment purpose, fulfillment state, method, and due/event timing.
- **FR-044**: Selecting a Payments table obligation row MUST open a modal containing every related request, installment, receipt, fee, intention, delivery, exception, and activity event and MUST NOT navigate to a dedicated payment details screen.
- **FR-045**: The payment modal MUST show the obligation basis, receipts/installments, fees, customer intentions, requests, reminders, delivery outcomes, external reconciliation references, notes, exceptions, and related activity available for that payment.
- **FR-046**: The payment modal MUST provide navigation to the related project and preserve the Payments table state when closed.
- **FR-047**: Authorized florists MUST be able to create a manual receipt for deposit, final payment, or an installment using Venmo, check, cash, or another documented method.
- **FR-048**: Manual receipt entry MUST validate positive amount, receipt date, method, payment purpose, and project association. A likely duplicate MUST require explicit florist confirmation and a nonempty override reason before recording; the immutable receipt and activity history MUST retain the reason and suspected matching receipt reference. A likely true overpayment MUST present a separate overpayment warning.
- **FR-049**: The project Financial Summary MUST distinguish authoritative proposal total, deposit target, final target, credited project principal, separately charged processing fees, and remaining balance.
- **FR-050**: The project Financial Summary MUST distinguish unavailable values from zero and partially paid obligations from fulfilled obligations.
- **FR-051**: Payments table totals, the payment modal, project Financial Summary, and project status MUST derive from the same authoritative obligations and auditable financial events.
- **FR-052**: Project activity MUST record creation and supersession of requests, email/reminder outcomes, customer intentions, checkout outcomes when meaningful, receipts, manual entries, fees, corrections, reversals, fulfillment, and payment-caused status changes in human-readable terms.
- **FR-053**: Activity and payment displays MUST identify whether an event was performed by a florist, customer, payment provider, or automated schedule while omitting access tokens and sensitive provider payloads. Minimized payment obligations, transactions, allocations, request metadata, delivery outcomes, provider-event audit fields, and payment activity MUST be retained for seven years after project completion or cancellation, subject to documented legal/dispute holds; access secrets MUST follow their shorter invalidation lifecycle and unnecessary raw provider payloads MUST NOT be retained. An authorized florist MUST be able to place or release a project-wide legal/dispute hold from the payment obligation modal, with a required reason and immutable actor/time audit history; release MUST resume ordinary retention eligibility without deleting records synchronously.
- **FR-054**: When a proposal changes before any confirmed receipt, the open deposit obligation MUST be recalculated to 30% of the new authoritative total and any obsolete request MUST no longer collect the prior amount. Once the first confirmed receipt exists, the deposit target MUST remain frozen at the amount in effect for that receipt, even when the deposit is only partially fulfilled.
- **FR-055**: When a proposal changes after any confirmed receipt, historical credited principal and the frozen deposit target MUST remain unchanged, and the open final and project outstanding balances MUST be recalculated from the new authoritative total less valid credits without retroactively charging a second deposit difference.
- **FR-056**: Principal above one obligation's remaining amount MUST be automatically allocated to the next outstanding obligation on the same project. Only value beyond the entire project balance is a true overpayment; it and unmatched provider receipts MUST be retained and visibly flagged for florist reconciliation rather than discarded, automatically refunded, silently assigned outside the project, or represented as a negative balance. The florist MUST resolve a true overpayment by recording an externally completed refund, retained customer credit, or corrective ledger event with a required reference or note. Retained credit MUST remain unapplied until a later explicit audited allocation.
- **FR-057**: Legacy project payment records MUST remain visible and usable after migration, with unknown request, fee, transaction, or reminder details clearly represented as unavailable rather than inferred.
- **FR-058**: Customer payment access and provider-confirmation handling MUST not require the customer to authenticate into the CRM.
- **FR-059**: The system MUST provide actionable observability for email, secure-link, checkout, provider-confirmation, reconciliation, reminder, and status-transition failures.
- **FR-060**: Initiating provider refunds or chargebacks, recurring billing, stored payment methods, customer financing, separate invoice-document generation, and external accounting-platform synchronization are outside this feature; recording externally completed refunds, retained customer credit, corrections, and other verified financial outcomes remains in scope for accurate reconciliation.

### Constitution Alignment *(mandatory)*

- **Surface**: Feature affects the authenticated CRM admin portal, a narrowly scoped public customer payment-options surface, payment and project data, outbound email, scheduled processing, and trusted payment-provider callbacks. It does not change the public marketing website or create a general client portal.
- **Product Owner Approval**: The customer payment-options page is an explicitly requested transactional surface. Planning MUST keep it isolated from public marketing content, SEO navigation, inquiry forms, and unrelated public-site styling.
- **Brownfield Preservation**: Existing lead conversion, Awaiting Deposit/Booked/Awaiting Final Payment/Final Prep gates, manual Venmo/check/cash logging, project payment records, proposal totals, project Financial Summary, project activity, private proposal documents, proposal revision, and Projects screens remain available. Authorized expansion covers customer payment requests, provider collection/reconciliation, installments, reminders, the Payments CRM table/modal, and richer financial/activity presentation.
- **Supabase Security**: Planning MUST identify affected existing payment/project/activity records and the new records required for obligations, receipt events, customer intentions, payment requests, message delivery, and provider-event deduplication. CRM records require internal-user row-level access. The public payment surface may access only a narrow server-validated request projection. Provider secrets and privileged credentials MUST remain server-side; trusted callbacks MUST authenticate their source and MUST NOT rely on browser success redirects as proof of payment.
- **Schema Migration**: Every new or modified table, constraint, policy, function, schedule-supporting record, or payment status value MUST be delivered through an executable migration with matching declarative definitions. Migration MUST preserve and classify existing project payment records and MUST provide validation for ambiguous or duplicate legacy data.
- **Standalone Edge Functions**: Any payment-link, provider-checkout, provider-callback, email, or scheduled-reminder Edge Function affected during planning MUST remain independently deployable with no `_shared` directory, local shared function module, or import from another edge function. No automated test may target, import, invoke, or simulate an Edge Function.
- **Testing Expectations**: Angular unit coverage is required for amount/fee/balance calculations, conversion choices, payment page states, manual logging, table/modal behavior, Financial Summary, activity rendering, and project status presentation. PostgreSQL integration checks are required for authorization boundaries, persisted secure-link contracts, provider-event reconciliation/deduplication inputs, concurrent fulfillment, reminder eligibility/deduplication, proposal revisions, payment reversals, migration of legacy records, legal holds, and lead/project/proposal data regressions. Edge Functions receive independent type-checking and documented provider/customer sandbox smoke validation only, with no automated Edge Function tests.
- **Sensitive Data**: Customer contact and event data, payment records, external references, provider event data, signed access credentials, email content, and reconciliation notes are private. The system MUST NOT store card or bank credentials, expose provider secrets to the browser, place signed-link values in activity logs, or retain full provider payloads when minimized verification/audit fields suffice. Minimized financial/audit records are retained for seven years after project completion or cancellation unless a documented hold requires longer retention; access secrets and unnecessary raw payload data follow shorter lifecycles.
- **Proposal Workflow**: The proposal builder, invoice/planning calculations, active immutable financial snapshot, manual approved/signed Canva PDF upload, and proposal revision workflow remain the source of project pricing. Payment records consume the authoritative proposal total but do not replace or mutate proposal history.
- **Git Publication**: AI agents MUST NOT run `git commit`, `git push`, or commit/push-capable automation. Commit and push remain human operator responsibilities.

### Key Entities *(include if feature involves data)*

- **Payment Obligation**: The amount a project is expected to satisfy for a deposit or final payment, including basis total/version, due date, fulfillment state, amount credited, outstanding balance, and florist-controlled reminder pause state. A deposit obligation is due on the project conversion date. The obligation is the row-level record shown in the Payments table and owns the detailed history opened in its modal.
- **Payment Request**: A revocable, purpose-specific customer collection invitation with a florist-defined fixed requested principal, active state, lifecycle-based link validity, supersession relationship, and snapshots of the cash/check instructions effective when issued. It normally targets one obligation, but the 60-day full-outstanding-balance request spans both deposit and final-payment obligations and displays their breakdown. The customer cannot edit its amount, and its link remains valid only until fulfillment, supersession, project cancellation, or florist revocation.
- **Payment Transaction**: An immutable receipt, refund, reversal, dispute, void, or correction event with a unique human-readable Black Begonia reference, principal amount, method, source, time, external reconciliation identity, and one or more obligation allocations; excess deposit principal allocates to final payment before any value is classified as project overpayment. A florist-overridden suspected duplicate also retains the override reason and suspected matching reference. Its reference is for customer support and audit, not authentication.
- **Payment Intention**: A customer's declared plan to pay by cash or check, or a non-confirming Venmo business-profile fallback handoff, which informs the florist, carries no paid value, and creates one non-stacking seven-day reminder pause.
- **Payment Fee**: A separately tracked customer charge or merchant-absorbed processing cost associated with a payment transaction; the customer card fee is 3% of requested principal only where permitted and is excluded from project principal and proposal balance.
- **Payment Message Delivery**: An initial request, scheduled reminder, transaction-receipt email, or financial-adjustment notice attempt, including the resolved billing or primary-contact recipient, fallback use, scheduled occurrence or source transaction, relevant amount, outcome, retry relationship, and send time.
- **Provider Event Receipt**: A minimal authenticated record of an external payment event used to guarantee deduplication, reconciliation, and auditable processing.
- **Project Financial Summary**: A projection combining the active authoritative proposal total with obligations and valid payment transactions to present deposit, final balance, credited principal, fees, overpayment, and invoice fulfillment without a separate invoice document.
- **Payment Activity Entry**: A human-readable audit event connected to a project and, when applicable, its obligation, request, transaction, message, intention, or status transition.
- **Payment Collection Settings**: Florist-managed business settings for current cash and check instructions; edits affect newly issued requests only because each request retains its own instruction snapshot.
- **Payment Legal Hold**: An immutable project-scoped place/release audit event with hold type, required reason, actor, and timestamp. The latest event determines whether retention deletion is suspended for every payment and audit record on that project.
- **Electronic Checkout Attempt**: The single active provider checkout for a payment request, including method, requested principal, fee decision, provider identity, lifecycle state, creation/expiry/resolution times, and audited florist cancellation. Card attempts use Stripe-hosted Checkout for one-time payment. An attempt's active state locks all other payment-method selections; historical resolved attempts remain available for reconciliation.
- **Overpayment Exception**: Value beyond the entire project balance requiring florist resolution as an externally completed refund, retained customer credit, or corrective ledger event, including resolution actor, time, required reference/note, and any later explicit allocation.

## Recommendations For Planning

- Treat obligations, immutable financial transactions, customer intentions, payment requests, and message deliveries as separate lifecycle concepts. This keeps an abandoned checkout or cash intention from masquerading as money received.
- Make the financial transaction ledger append-only. Corrections, refunds, reversals, and disputes should offset prior entries while preserving the original event and actor.
- Derive fulfillment and outstanding balances from the authoritative proposal snapshot plus allocated ledger entries. Store enough calculated context on each request and transaction to explain historical charges after a proposal revision.
- Keep deposit and final-payment obligations distinct when a 60-day consolidated request is created. Associate the request with both obligations, show their breakdown, and allocate confirmed principal to deposit before final payment.
- Centralize money, allocation, fulfillment, and project-status rules behind one trusted transactional boundary so manual entry and provider confirmation cannot disagree or race each other.
- Require stable idempotency identities for provider events, checkout creation, manual submissions, scheduled reminder occurrences, email attempts, fulfillment, and resulting activity entries.
- Enforce one active electronic checkout per payment request and return that same checkout for concurrent or repeated creation attempts; retain resolved/expired/canceled attempts as history.
- Scope customer links to a payment request rather than directly exposing a project. Use revocation and supersession so revised amounts and completed obligations cannot be paid from stale links.
- Create provider handoffs from trusted current obligation data. Treat browser redirects as customer experience only; verified provider confirmation or florist reconciliation is the receipt authority.
- Plan Venmo as a provider adapter that prefers verified integrated checkout and falls back to the official Black Begonia business profile with manual reconciliation. The system must never infer receipt merely from a handoff or return visit.
- Use one reminder eligibility policy and one occurrence identity per project, obligation, and scheduled local date. Recheck eligibility immediately before delivery to avoid stale messages after payment, cancellation, or event-date changes.
- Preserve a clear distinction among proposal principal, credited principal, provider fees, amount charged, outstanding balance, and overpayment in storage and every UI surface.
- Backfill current deposit/final records conservatively into obligations and historical transactions. Flag ambiguous paid records, duplicates, or amounts exceeding proposal totals for review rather than inventing missing history.
- Add operational views for failed deliveries, unmatched provider events, stale cash/check/Venmo-fallback intentions, overdue balances, overpayments, and reversals; these exceptions matter more to day-to-day collections than a generic success dashboard.
- Keep provider credentials, webhook verification material, and customer-link secrets outside browser-readable configuration and activity metadata, with rotation and replay protection included in rollout planning.
- Roll out provider collection and reminders behind controllable operational switches, validate callback and email behavior in a non-production environment, and retain manual logging as the safe fallback throughout deployment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of successful lead conversions create an Awaiting Deposit project and a 30%-of-total deposit obligation, regardless of the email choice.
- **SC-002**: At least 95% of test customers can open a valid payment link, identify the requested amount and any fee, and select one of the four payment methods within 60 seconds on mobile and desktop.
- **SC-003**: Across duplicate and concurrent provider-event tests, each real receipt changes credited principal, fulfillment, activity, and project status no more than once.
- **SC-004**: For all tested projects, the Payments table/modal and project Financial Summary agree to the cent on proposal principal, credited principal, fees, and outstanding balance.
- **SC-005**: In boundary-date testing, 100% of eligible unpaid final or consolidated full-project balances receive exactly one message at each 60-, 45-, 38-, and 31-day occurrence and at most one per local day from 30 days through the event date.
- **SC-006**: In testing, 100% of projects that become ineligible before delivery receive no subsequent final-payment reminders.
- **SC-007**: In acceptance testing, florists can find an unpaid or failed payment, open its complete modal history, and navigate to its project within 30 seconds.
- **SC-008**: In acceptance testing, florists can record a cash/check receipt or installment and see the updated balance, fulfillment, activity, and eligible project status within 10 seconds in 95% of attempts.
- **SC-009**: No security test using an invalid, revoked, fulfilled, altered, or cross-project customer link reveals private CRM data or permits a payment against the wrong obligation.
- **SC-010**: All tested request, provider, reminder, and email failures remain retryable or manually resolvable without losing the project, duplicating credited funds, or fabricating successful delivery.
- **SC-011**: Existing converted projects and legacy payment records remain visible and financially interpretable after migration in 100% of validated fixtures, with ambiguous records explicitly flagged.
- **SC-012**: In user acceptance review, the Payments table is recognized as consistent with the rest of the CRM and the customer payment page is rated clear and trustworthy in at least 90% of scenarios.
- **SC-013**: In reminder-boundary testing, 100% of opted-in outstanding deposits receive no more than one reminder per seven-day interval anchored to the initial request's Mailgun acceptance time, while opted-out, fulfilled, waived, canceled, or inactive deposit requests receive none.
- **SC-014**: In 100% of delayed, failed, and successful electronic-payment callback tests, the customer return page never displays Confirmed before trusted receipt confirmation and reflects the authoritative outcome once available.
- **SC-015**: In acceptance testing, 100% of confirmed electronic and florist-recorded manual payments create exactly one successful customer receipt email after delivery succeeds, and receipt-delivery failures never undo or duplicate the payment.
- **SC-016**: In reminder testing, 100% of cash, check, and Venmo business-profile fallback intentions pause automated reminders for exactly seven calendar days without stacking, after which the next eligible reminder resumes only when no receipt has been recorded.
- **SC-017**: In reminder-control testing, per-obligation and global pauses suppress 100% of affected scheduled sends without changing payment or project status, and resumption sends no skipped-message backlog.
- **SC-018**: In adjustment-notification testing, 100% of confirmed refunds and provider reversals produce exactly one successful customer notice after delivery succeeds, while disputes and manual corrections produce none without florist choice.
- **SC-019**: In acceptance testing, 100% of existing payment requests retain their originally issued cash/check instructions after global settings change, while newly issued requests use the updated instructions.
- **SC-020**: In allocation testing, 100% of receipt principal first fulfills deposit and then final payment on the same project, and only value beyond the complete project balance is classified as overpayment.
- **SC-021**: Across repeated-click, multiple-tab, and concurrent-request tests, each payment request has no more than one active electronic checkout and replacement is possible only after resolution, expiry, or florist cancellation.
- **SC-022**: In 100% of pending-checkout tests, attempts to choose another provider, cash, or check create no checkout or intention until the active checkout resolves, expires, or is canceled by the florist.
- **SC-023**: Retention testing preserves 100% of required minimized financial/audit records through seven years after project completion or cancellation, excludes invalidated secrets and unnecessary raw provider payloads, and defers deletion for records under documented hold.
- **SC-024**: In uniqueness and replay testing, 100% of receipts and adjustments receive exactly one immutable Black Begonia reference that appears consistently in applicable customer messages and CRM history without granting record access.
- **SC-025**: In suspected-duplicate testing, no manual receipt is created without explicit florist confirmation and a nonempty override reason, and every override retains its reason and suspected matching reference.
- **SC-026**: In overpayment testing, 100% of true project overpayments remain flagged until the florist records an external refund, retained credit, or correction with the required reference/note, and no provider refund or cross-project allocation occurs automatically.

## Assumptions

- The primary CRM user is an authenticated Black Begonia florist; customers use narrowly scoped payment links without CRM accounts.
- The authoritative project total comes from the active proposal invoice snapshot established by the existing proposal workflow.
- The project deposit obligation always uses the project conversion date as its operational due date; any earlier proposal retainer date remains historical proposal information.
- The final-payment due date remains 30 days before the event, consistent with prior proposal requirements; reminders begin before that due date to support collection.
- "Payment received by Venmo" means a trustworthy integrated-checkout confirmation when available or an authorized florist's reconciled manual receipt from the business-profile fallback; opening Venmo, selecting it, or returning from it is not proof of payment.
- The 3% customer card fee remains disabled and Black Begonia absorbs provider processing costs until an approved mechanism can establish transaction eligibility and compliance. If that mechanism is later enabled, only eligible credit-card transactions receive the fee; only principal satisfies the obligation.
- The deposit target remains adjustable until the first confirmed receipt. At that point the target freezes at the amount then in effect; later proposal changes preserve all credits and affect the remaining final/project balance rather than retroactively charging a second deposit difference.
- Every delivery resolves the current designated billing contact or current primary-contact fallback. The request retains its original recipient only for audit, so changing either contact affects future delivery attempts without rewriting history.
- Currency is USD for this release, and all money calculations use consistent cent-level rounding.
- Minimized payment financial and audit records are retained for seven years after project completion or cancellation; documented legal/dispute holds may extend retention, while access secrets and unnecessary raw provider data are invalidated or discarded earlier.
- Reminder dates use the florist's configured business timezone. Deposit reminders recur every seven calendar days from the initial request's Mailgun acceptance time until the deposit is no longer outstanding; final-payment reminders stop after the event date.
- Existing manual payment logging remains available as the continuity and exception-handling path even after provider integrations are enabled.
- Payment initiation for refunds, chargebacks, recurring billing, financing, tips, taxes calculated by a payment provider, and saved customer payment methods is outside this release.
- Card collection uses Stripe-hosted Checkout for fixed one-time requests; Stripe Customer Portal, embedded Checkout, and custom card-entry forms are outside this release.
- No standalone payment details route or general-purpose customer portal is included; CRM detail is modal-based and customer access is request-specific.
- Invoice fulfillment refers only to satisfying deposit and final-payment obligations against the active proposal; separate invoice documents and accounting-platform synchronization are not included.
