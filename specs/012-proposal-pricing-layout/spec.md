# Feature Specification: Proposal Effective Pricing and CRM Ultrawide Layout

**Feature Branch**: `012-proposal-pricing-layout`

**Created**: 2026-09-08

**Status**: Draft

**Input**: User description: "Remove percentage-based labor pricing, add an overridable Actual Unit Price to proposal line items without changing internal composition costs, and allow every CRM screen to make effective use of a 34-inch ultrawide display."

## Clarifications

### Session 2026-09-08

- Q: Should manual labor line items remain available after percentage-based labor is retired? → A: Remove percentage-based labor only; manual labor line items remain available when the florist wants to add an additional labor charge.
- Q: Which proposal line types receive Calculated Unit Price and Actual Unit Price? → A: Only composition-backed product lines; labor, fee, and discount lines retain their existing editable price field.
- Q: What should happen when a legacy editable draft has a nonzero labor percentage? → A: Convert its current calculated labor amount into a manual labor line and preserve the draft total.
- Q: What pricing should customers see on submitted proposals? → A: Show only the effective quoted amount as Unit Price; keep Calculated Unit Price and override status internal.
- Q: How does the florist remove an Actual Unit Price override? → A: Clearing the Actual Unit Price field removes the override and restores the current calculated value; no separate reset action is shown.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quote an Intentional Client Price (Priority: P1)

While building an editable floral proposal, the florist sees the system-derived amount for each composition-backed product line as **Calculated Unit Price**. A separate **Actual Unit Price** starts with that same value and can be replaced with the amount the florist intends to quote. The product-line subtotal and all downstream proposal totals use the actual amount, while the internal catalog composition continues to represent the recipe and shopping costs. Manual labor, fee, and discount lines retain their existing editable price behavior.

**Why this priority**: The florist needs control over the quoted price without corrupting composition costs, markup inputs, or the shopping list that supports fulfillment.

**Independent Test**: Create a product line whose composition produces a calculated unit price of $100, set quantity to 3, override Actual Unit Price to $125, and verify that the line subtotal is $375 while the calculated price, composition rows, and shopping list remain unchanged.

**Acceptance Scenarios**:

1. **Given** a composition-backed product line with a calculated unit price of $100 and no manual override, **When** the line is displayed, **Then** Calculated Unit Price is read-only, Actual Unit Price displays $100, and an accessible status identifies that the line is following the calculated price.
2. **Given** that line has quantity 3, **When** the florist changes Actual Unit Price to $125, **Then** its subtotal becomes $375, every proposal total that depends on the line refreshes from $375, and an accessible status identifies the line as a manual override.
3. **Given** a product line has an overridden actual price, **When** its catalog composition or markup changes, **Then** Calculated Unit Price refreshes while Actual Unit Price remains $125 until the florist clears or replaces it.
4. **Given** a product line has an overridden actual price, **When** the shopping list is viewed, **Then** its item quantities, row costs, pack calculations, reserve calculations, and purchasing totals remain derived from the internal composition rather than the client-facing override.
5. **Given** an overridden product line, **When** the florist clears Actual Unit Price, **Then** the override is removed, the field is repopulated from the current Calculated Unit Price, and subsequent calculated-price changes flow through automatically.
6. **Given** a labor, fee, or discount line, **When** the florist prices it, **Then** the line retains its existing editable price field and does not display the product-only Calculated Unit Price and Actual Unit Price controls.

---

### User Story 2 - Preserve Effective Pricing Through Submission (Priority: P1)

The florist can save, reopen, preview, and submit a proposal without losing which lines follow the calculated price and which use an actual-price override. Customer-facing proposals show only the quoted unit price and subtotal; they do not disclose the florist's calculated benchmark or override status.

**Why this priority**: A correct editing experience is only valuable if the approved price survives the full workflow and becomes the authoritative basis for the customer proposal, project financials, payments, and reporting.

**Independent Test**: Override a line, save and reopen the draft, submit it, and verify that the editable workspace retains both prices while the immutable submitted version, customer-facing presentation, and financial totals consistently use the actual price.

**Acceptance Scenarios**:

1. **Given** a product line with an overridden Actual Unit Price, **When** the draft or revision workspace is saved and reopened, **Then** both the current Calculated Unit Price and the overridden Actual Unit Price are restored with the override still active.
2. **Given** a product line that has never been overridden, **When** its calculated price changes before submission, **Then** Actual Unit Price follows the new calculated price and the subtotal refreshes.
3. **Given** an approved editable proposal, **When** it is previewed or submitted, **Then** the customer-facing line displays the actual quoted price as its unit price and does not expose the calculated price or override state.
4. **Given** a submitted proposal version, **When** catalog prices, compositions, markups, or current pricing rules later change, **Then** the submitted version retains the exact quoted line prices and totals recorded at submission.
5. **Given** a submitted proposal becomes the basis of project financials or a payment obligation, **When** those values are prepared, **Then** they use the submitted actual prices and resulting totals.

---

### User Story 3 - Price Proposals Without Percentage-Based Labor (Priority: P1)

The florist prices labor through existing markup decisions instead of entering a separate labor percentage. Editable proposals no longer show, store as an active pricing input, calculate, summarize, or submit a percentage-derived labor surcharge.

**Why this priority**: Applying labor in both markup and a separate percentage risks double charging and makes the quoted total harder to reason about.

**Independent Test**: Open a new proposal and a legacy editable draft that previously had a labor percentage, then verify that neither exposes a labor-percentage control or calculated-labor row and that the legacy draft preserves its prior total through one manual labor line rather than an active percentage calculation.

**Acceptance Scenarios**:

1. **Given** a new or editable proposal, **When** the builder loads, **Then** no Labor Percentage input appears in the pricing controls or proposal summary.
2. **Given** product lines total $1,000, **When** proposal totals are calculated, **Then** no percentage-derived labor amount is added and no Calculated Labor item appears in the Totals section.
3. **Given** an editable legacy draft contains a nonzero saved labor percentage, **When** it is first opened under the new pricing rules, **Then** its current calculated labor amount is converted once into a clearly identified manual labor line, its total is preserved, and the retired percentage is removed from active pricing data.
4. **Given** an immutable proposal version was submitted before this feature, **When** it is reviewed for historical or financial purposes, **Then** its recorded prices and totals remain unchanged.
5. **Given** the florist wants to add an explicit additional labor charge, **When** they add a manual labor line item, **Then** it remains available and follows its existing line-item pricing and totaling behavior without restoring the retired labor percentage.

---

### User Story 4 - Use the Full CRM on an Ultrawide Display (Priority: P2)

On the florist's 34-inch ultrawide monitor, authenticated CRM pages expand their primary working area to use the horizontal room available after navigation. Dense tables, editors, dashboards, and card grids can expose useful information instead of being constrained to a narrow centered column, while smaller desktop and mobile layouts remain usable.

**Why this priority**: The CRM is a primary work surface, and unused horizontal space slows scanning and forces avoidable scrolling in information-dense workflows.

**Independent Test**: At a 3440-by-1440 viewport, visit every authenticated CRM route family and verify that its page shell occupies at least 90% of the width available after persistent navigation, without page-level horizontal overflow; repeat responsive checks at 2560, 1920, and 1366 pixels wide.

**Acceptance Scenarios**:

1. **Given** a 3440-by-1440 CRM viewport with persistent navigation visible, **When** any authenticated CRM route is opened, **Then** its primary page shell uses at least 90% of the horizontal content area available after navigation.
2. **Given** a CRM page contains a table, card grid, split view, editor, dashboard, or detail workspace, **When** wider space is available, **Then** the working surface can expand or reflow to expose useful content rather than retaining large empty outer gutters.
3. **Given** a viewport width of 1366, 1920, 2560, or 3440 pixels, **When** the florist navigates through the CRM, **Then** the page shell introduces no unintended page-level horizontal scrolling or overlapping controls.
4. **Given** a screen contains long-form explanatory text or a focused form, **When** its page shell expands, **Then** the shell may use the available width while individual reading lines and controls retain a usable width.
5. **Given** a modal, popover, customer preview, or other intentionally focused overlay, **When** it is opened on an ultrawide display, **Then** it may retain an appropriate task-specific maximum width and is not required to fill the CRM page.

### Edge Cases

- An Actual Unit Price of zero is valid and must remain zero through recalculation, save, reopen, preview, and submission rather than being replaced by the calculated value.
- Clearing Actual Unit Price is an intentional reset and must repopulate the current calculated value rather than leaving an invalid blank or saving zero.
- Negative, nonnumeric, nonfinite, or over-precision Actual Unit Price entries must not become authoritative; the florist receives clear line-level validation without losing other valid work.
- Quantity zero produces a zero subtotal. Fractional quantities retain the proposal builder's existing quantity rules and still multiply by Actual Unit Price.
- Discount, fee, and any retained manual line types keep their existing sign and totaling semantics even though the client-facing subtotal is based on the effective actual price.
- Changing a line to a different item or line type must not silently carry an unrelated manual override into the replacement line.
- If an override equals the calculated value, the displayed monetary result is the same, but the builder still identifies the line as manually overridden; clearing the field removes the override state, changes the status to following, and allows future calculated-price changes to flow through.
- A legacy editable draft with a nonzero percentage-derived labor surcharge must receive exactly one conversion line even if loading, autosave recovery, or reopening occurs repeatedly; existing manual labor lines remain separate and unchanged.
- A legacy editable draft whose saved labor percentage is zero or missing requires no conversion line.
- Historical proposal versions may contain retired labor fields or legacy pricing shapes. They must remain readable and reproduce their recorded totals without reapplying current calculations.
- Wide data tables may use contained horizontal scrolling when their minimum useful column width exceeds the viewport, but the overall CRM page must not overflow.
- Empty, loading, error, and authorization-denied CRM states must follow the same page-width contract as their populated states.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The proposal builder MUST remove the Labor Percentage input and every editable, summary, preview, and submission-flow representation of that percentage.
- **FR-002**: Current editable proposal totals MUST exclude every active percentage-derived labor calculation, and the Totals section MUST remove the Calculated Labor item. A one-time legacy conversion line or florist-entered manual labor line contributes only through the existing manual line-item rules.
- **FR-003**: New drafts and revision workspaces MUST neither initialize nor actively persist a labor-percentage pricing setting. On first load of a legacy editable draft with a nonzero percentage, the system MUST calculate the legacy surcharge under its recorded pricing state, create one clearly identified manual labor line for that amount, remove the percentage from active pricing data, and preserve the pre-conversion total. The conversion MUST be idempotent across loading, autosave recovery, and reopening; zero or missing percentages require no conversion line.
- **FR-004**: Immutable proposal versions submitted before this feature MUST preserve their originally recorded lines, labor amounts, totals, and financial meaning when viewed or used as historical records.
- **FR-005**: For composition-backed product lines, the existing top-level Unit Price label in the internal proposal builder MUST be renamed **Calculated Unit Price** and its value MUST remain read-only.
- **FR-006**: Every editable composition-backed product line MUST provide an **Actual Unit Price** field between Calculated Unit Price and Subtotal. Labor, fee, and discount lines MUST retain their existing editable price field instead of these product-only controls.
- **FR-007**: For a product line with no manual override, Actual Unit Price MUST equal and continue to follow the product line's current Calculated Unit Price, and the builder MUST identify this state as following the calculated price without relying on color alone.
- **FR-008**: Editing Actual Unit Price MUST establish a product-line-specific override without changing the Calculated Unit Price or any shared catalog record, and the builder MUST identify this state as a manual override even when the entered value equals Calculated Unit Price.
- **FR-009**: Once overridden, a product line's Actual Unit Price MUST remain stable when composition rows, their costs, quantities, markups, reserves, pack details, or catalog defaults change; those changes MUST continue to refresh Calculated Unit Price.
- **FR-010**: Clearing an overridden Actual Unit Price field MUST remove the override, repopulate the field from the current Calculated Unit Price, and resume automatic calculated-price following. The product line MUST NOT present a separate reset action.
- **FR-011**: A product-line subtotal MUST equal its quantity multiplied by Actual Unit Price and MUST be rounded to the application's currency precision. Other line types MUST retain their existing subtotal and sign rules.
- **FR-012**: Proposal subtotal, discounts, applicable taxes, total, retainer, payment obligations, project financials, and reporting values MUST use product-line subtotals derived from Actual Unit Price together with the unchanged effective values of other line types.
- **FR-013**: Product-line Actual Unit Price MUST accept zero and valid nonnegative currency values. A cleared field MUST invoke the reset behavior in FR-010; negative, nonnumeric, nonfinite, and more-than-two-decimal values MUST produce actionable line-level validation before save or submission.
- **FR-014**: A product line's Calculated Unit Price, Actual Unit Price, calculated-following or overridden state, and resulting subtotal MUST survive draft save, autosave, reopen, revision workspace recovery, preview, and submission as appropriate to each state.
- **FR-015**: Customer-facing proposal views and documents MUST show a product line's Actual Unit Price as its quoted **Unit Price**, use its resulting subtotal, and MUST NOT expose Calculated Unit Price or the internal override state. Other line types MUST retain their existing customer-facing presentation.
- **FR-016**: A submitted proposal version MUST retain every product line's actual quoted unit price and resulting totals as immutable historical facts, independent of later catalog, composition, markup, or calculated-price changes.
- **FR-017**: Editing Actual Unit Price MUST NOT change internal catalog composition rows, shared catalog items, shopping-list quantities, reserve amounts, pack calculations, internal row costs, or shopping-list purchasing totals.
- **FR-018**: Internal Catalog Composition **Row Unit Price**, catalog-derived defaults, Reset to Catalog Price, markup, reserve, pack, aggregation, and shopping-list behavior defined by spec 009 MUST remain distinct from and unaffected by Actual Unit Price.
- **FR-019**: When a product line's selected item is replaced, or when its line type changes to or from product, the system MUST clear any override belonging to the prior line identity. A resulting product line MUST initialize Actual Unit Price from its calculated value; a resulting non-product line MUST use its existing price behavior.
- **FR-020**: Existing fee and discount behavior MUST remain unchanged, and the florist MUST remain able to add and edit an optional manual labor line item for an explicit additional labor charge. Manual labor line items MUST retain their current line-type and sign semantics without restoring any percentage-derived labor calculation.
- **FR-021**: Every authenticated CRM route available at feature approval MUST be included in an ultrawide layout audit, including dashboards, leads, contacts, organizations, catalog and tax administration, proposals and revisions, projects and project details, payments, tasks, workshops, workshop editing, retention, rosters, financials, and occurrence details.
- **FR-022**: At a 3440-by-1440 viewport, each audited CRM page's primary shell MUST occupy at least 90% of the horizontal content area available after persistent navigation and intentional page padding.
- **FR-023**: CRM tables, grids, split views, dashboards, editors, and detail workspaces MUST expand or responsively reflow when the additional width improves task visibility; long-form copy and focused controls MAY retain narrower readable widths inside the expanded shell.
- **FR-024**: The ultrawide changes MUST introduce no page-level horizontal overflow, clipped primary actions, or overlapping content at 1366, 1920, 2560, or 3440 pixel viewport widths. A data region MAY scroll horizontally within its own visible container when necessary.
- **FR-025**: Intentionally focused overlays, modals, popovers, customer previews, and public or client-facing pages are outside the ultrawide fill requirement unless their containing CRM page itself violates the page-width contract.
- **FR-026**: Existing CRM responsive behavior, navigation, permissions, filters, sorting, editing, loading, empty, error, and dark-mode states MUST remain functional across the audited widths.

### Constitution Alignment *(mandatory)*

- **Surface**: This feature affects the authenticated CRM floral proposal builder, editable draft and revision pricing state, proposal render/submission contracts, immutable proposal history compatibility, downstream project financial values, and authenticated CRM page layouts. Customer-facing proposal output changes only to consume the effective quoted price; the public marketing website is otherwise unaffected.
- **Product Owner Approval**: The florist/product owner explicitly requested the CRM builder, submission, and CRM layout changes. No unrelated public website content, styling, SEO, routing, or form change is authorized.
- **Brownfield Preservation**: Preserve internal catalog composition row pricing from spec 009, shared catalog data, markup and reserve rules, shopping-list derivation, tax and discount rules, invoice/planning workflows, project revision autosave, immutable submitted versions, customer approvals, and manual Canva PDF upload. Authorized removals are limited to percentage-based labor pricing and its active representations. Authorized additions are limited to the effective unit-price override and responsive use of wide CRM page space.
- **Supabase Security**: Existing CRM authorization and row-level access policies remain mandatory for proposals, revisions, projects, catalog items, and financial records. Price overrides are proposal-scoped and MUST NOT grant catalog-write access. Existing storage policies for proposal documents remain unchanged.
- **Schema Migration**: Planning MUST identify all durable draft, revision, snapshot, and render-contract fields affected by labor retirement and effective pricing. Any persistent model change MUST include an executable, data-preserving migration plus the matching declarative schema update, with compatibility for legacy editable data and immutable submitted history.
- **Standalone Edge Functions**: No Edge Function change is assumed. If planning identifies an affected submission or document function, it MUST remain independently deployable without local shared imports, and no automated Edge Function test or harness may be created.
- **Testing Expectations**: Focused unit tests MUST cover labor removal, effective-price state transitions, validation, totals, persistence, revision recovery, render/submission behavior, legacy compatibility, and the isolation of shopping-list calculations. Responsive component tests and a documented route-by-route visual audit MUST cover the specified viewport widths. PostgreSQL integration tests are required for any changed database functions, constraints, policies, or durable contracts. Any affected Edge Function receives standalone type-checking and documented provider/customer sandbox smoke validation only.
- **Sensitive Data**: Customer contact details, events, internal costs, calculated prices, markups, override status, proposal documents, signatures, and payment records retain their current access boundaries. Customer-facing output exposes only the quoted actual price, never the internal calculated benchmark, component costs, markup details, or override state. No new secret, passcode, or payment credential is introduced.
- **Proposal Workflow**: The accepted proposal remains the source for invoice, planning, payment, and future reporting values. Actual Unit Price becomes the authoritative client-facing product-line price at submission, while other line types retain their existing effective prices. The manual Canva PDF upload path and existing approval/signature workflow remain supported.
- **Git Publication**: AI agents MUST NOT run commit, push, or commit/push-capable automation. Publication remains the human operator's responsibility.

### Key Entities *(include if feature involves data)*

- **Proposal Line Item**: A client-facing proposal entry with identity, line type, quantity, effective price, and subtotal. A composition-backed product line additionally has Calculated Unit Price, Actual Unit Price, and calculated-following or overridden state; labor, fee, and discount lines retain their existing price model.
- **Internal Catalog Composition Row**: A proposal-specific recipe component with catalog identity, quantity, row unit cost, markup, reserve, pack information, and shopping-list contribution. It informs Calculated Unit Price but is never rewritten by an Actual Unit Price override.
- **Proposal Draft or Revision Workspace**: Editable proposal state that preserves actual-price overrides, continues calculated-price refreshes, excludes percentage-derived labor, and can be safely resumed.
- **Submitted Proposal Version**: An immutable record of the customer-facing quoted prices, totals, supporting proposal state, and financial meaning at submission, including compatible rendering of versions created before this feature.
- **CRM Page Layout Contract**: The shared responsive expectations and route inventory used to verify that authenticated work surfaces make useful, overflow-safe use of desktop and ultrawide space.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of tested new proposals and editable revisions, no Labor Percentage control, proposal-summary value, Calculated Labor row, or active percentage-derived labor calculation appears in the pricing or submission flow.
- **SC-002**: Across representative composition-backed product, zero-price, and decimal scenarios, 100% of product-line subtotals and downstream totals match quantity multiplied by Actual Unit Price, while labor, fee, and discount regression scenarios retain their existing price and sign behavior.
- **SC-003**: In all persistence and submission tests, an actual-price override survives save, reopen, autosave recovery, revision, preview, and submission, while a non-overridden value continues to follow Calculated Unit Price.
- **SC-004**: Actual-price changes cause zero changes to shared catalog records, composition-row inputs, reserve and pack calculations, or shopping-list purchasing totals in all isolation tests.
- **SC-005**: Customer-facing proposals and downstream financial records use the quoted actual prices in 100% of submission scenarios and expose zero calculated benchmarks or override indicators to customers.
- **SC-006**: All approved legacy-history fixtures reproduce their originally recorded submitted totals, and 100% of tested legacy editable drafts with nonzero labor percentages preserve their pre-conversion totals through exactly one manual labor conversion line.
- **SC-007**: During timed acceptance testing, a florist can override a line price, confirm its updated subtotal, and use the visible and accessible state indicator to identify whether the line is following or manually overriding the calculated value in under 30 seconds, including when both displayed prices are equal.
- **SC-008**: At 3440-by-1440, 100% of authenticated CRM route families present a primary page shell using at least 90% of the available post-navigation content width.
- **SC-009**: At 1366, 1920, 2560, and 3440 pixel widths, 100% of audited CRM routes have no unintended page-level horizontal scrollbar, clipped primary action, or overlapping primary content.
- **SC-010**: The route audit records a pass for populated, loading, empty, error, and authorization-denied states supported by every affected CRM page family, with any intentionally contained table overflow documented.

## Assumptions

- **Calculated Unit Price** is the system-determined top-level price for a composition-backed product line; it is distinct from Internal Catalog Composition Row Unit Price introduced in spec 009 and does not apply to labor, fee, or discount lines.
- **Actual Unit Price** is the authoritative effective amount quoted per composition-backed product unit. It defaults to calculated-following behavior, and clearing the field returns an override to that behavior without a separate reset control. Other line types retain their existing editable price field.
- Currency inputs for the client-facing actual price use cents. Existing higher-precision internal composition costs remain unchanged.
- Percentage-derived labor is the functionality being retired. The florist may continue adding manual labor line items for explicit additional labor charges, and immutable historical labor facts remain supported.
- Legacy editable drafts preserve their current total by converting a nonzero percentage-derived amount into one manual labor line before continuing under the new rules. Immutable submitted, approved, accepted, signed, and financially referenced versions must not be rewritten.
- The ultrawide audit covers all authenticated CRM routes registered when this specification is approved. Public pages and task-focused overlays are not required to fill the display.
- The 3440-by-1440 viewport represents the florist's 34-inch ultrawide workstation; 1366, 1920, and 2560 pixel widths provide regression coverage for common desktop layouts.
- Existing roles and permissions are sufficient. This feature does not introduce a new user role or authorization boundary.

## Revision financial reconciliation amendment (2026-09-26)

The florist reported that an active V2 proposal for $4,500 left a project showing
its prior $3,210 total and zero balance after $963 deposit and $2,247 final
payment receipts. The active submitted snapshot is the project quote; receipt
history remains immutable.

- **FR-027**: Revision submission MUST persist the builder's current totals and
  atomically reconcile active installment targets against the newly active
  invoice snapshot. The financial summary MUST show the active quote and the
  collectible balance after existing credited principal for unpaid, partially
  paid, and fully paid projects.
- **FR-028**: Previously recorded receipts and allocations MUST remain attached
  to their installments. A higher quote can reopen a paid final installment;
  a later lower quote MUST release unpaid scheduled amounts before reducing
  amounts backed by receipts. Receipts above the current quote MUST be shown
  as an overpayment with no further collectible balance.
- **FR-029**: An internal CRM user MAY split an unscheduled increase caused by
  the active revision into a new installment with a chosen future due date.
  Scheduling MUST transfer principal from the final installment, preserve the
  project's total obligation and credited principal, and reject an amount
  above the unscheduled increase.
- **FR-030**: The project financial summary MUST show the active proposal total
  and outstanding balance. Deposit and final payment amounts remain visible
  in the installment section and do not need duplicate summary cards.

**Acceptance example**: With a $3,210 V1 quote and $3,210 credited across the
deposit and final installments, submitting a $4,500 V2 quote yields a $4,500
summary total and $1,290 outstanding. Scheduling a $1,290 revision installment
keeps that outstanding balance unchanged and leaves both original installments
paid. The same reconciliation is tested with only $963 credited and with no
receipts.

## Revision draft compatibility amendment (2026-09-26)

- **FR-031**: Reopening a project revision MUST tolerate unused, unnamed zero
  amount editor rows in a saved draft. The adapter removes those rows when
  named lines exist, preserves recorded totals, and leaves immutable submitted
  proposal snapshots unchanged.
- **FR-032**: An unnamed line with a price or other saved customer content MUST
  remain available for the florist to name. The revision MUST block persistence
  and finalization until the line is named; it must not silently discard or
  zero that content.
- **FR-033**: New revision drafts MUST omit inert unnamed rows when named lines
  exist. A draft containing only blank editor rows remains reopenable while
  the florist begins the proposal.

## Installment payment email amendment (2026-09-26)

- **FR-034**: Each payable installment row MUST offer **Send Payment Email**
  immediately after **Record Payment**. Paid, waived, canceled, and review
  required rows MUST NOT offer the email action. Project Details action
  button text is 15% larger than the initially reduced style, with tighter
  button padding.
- **FR-035**: The email MUST tell the billing recipient that the selected
  installment is due and include a secure checkout link for that installment's
  current outstanding amount. Sending a replacement link for one installment
  MUST leave unrelated installment links active.
- **FR-036**: A checkout for an installment link MUST credit that installment,
  even if another installment is also unpaid. A stale link MUST stop accepting
  payment when its obligation falls below the requested amount. An in-progress
  checkout MUST block replacement of its link.

## Customer payment-method switching amendment (2026-09-26)

- **FR-037**: A customer returning to `/pay/` after opening card checkout MUST
  be able to choose Venmo, card, check, or cash. Switching away from card MUST
  expire only an open provider checkout before the new method is recorded;
  a completed or processing payment MUST remain protected from a second choice.
- **FR-038**: Cash and check confirmation screens MUST offer a way back to the
  method list. Changing between cash, check, and Venmo MUST update the active
  intention without extending its seven-day reminder pause. Repeating the same
  method MUST reuse the existing intention.
- **FR-039**: Venmo MUST appear only when the stored business-profile target
  matches an approved handle or Venmo profile URL. Invalid targets MUST be
  rejected when settings are saved and reported clearly if checkout is tried.
