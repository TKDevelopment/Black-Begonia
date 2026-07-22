# Feature Specification: Proposal Catalog Row Pricing

**Feature Branch**: `009-proposal-row-pricing`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "Allow the florist to set the unit price for each catalog item row inside the floral proposal builder while retaining pack quantities and calculating shopping-list pack prices from the row's current unit price."

## Clarifications

### Session 2026-07-21

- Q: For pack-purchased items, what does catalog Base Unit Cost represent and how does a proposal-row override affect pack pricing? → A: Catalog Base Unit Cost remains the full pack purchase price; selection divides it by pack quantity to prefill the row's per-unit price, and overriding the row price recalculates that row's effective pack cost as row unit price multiplied by pack quantity without changing the shared catalog.
- Q: When the same catalog item has different per-unit prices across proposal rows, how should its combined shopping-list estimate be priced? → A: Aggregate the required quantities into one shopping-list item and use the highest contributing per-unit price for a conservative pack and total cost estimate.
- Q: How does the florist restore a catalog-derived price after overriding a proposal row? → A: Provide an explicit Reset to Catalog Price action that uses the catalog item's current full-pack Base Unit Cost divided by its current pack quantity.
- Q: What precision should a catalog-derived proposal-row unit price retain when full pack cost does not divide evenly by pack quantity? → A: Retain up to four decimal places for per-unit pricing calculations and round pack, subtotal, tax, invoice, and other monetary totals to cents.
- Q: If catalog pack quantity changed after a proposal row was saved, what does Reset to Catalog Price update? → A: Replace both the row's per-unit price and its snapshotted pack quantity using the catalog item's current full-pack Base Unit Cost and current pack quantity, then recalculate all dependent values.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set A Catalog Row Unit Price (Priority: P1)

While composing a product line in a floral proposal, the florist searches for a catalog item, adds it to the Internal Catalog Composition, enters the quantity and markup, and sets the unit price that applies to that specific proposal row. The row price is editable even when the selected item has a price recorded in the catalog.

**Why this priority**: Vendor and market prices change frequently. The florist must be able to price the actual event without first changing the shared catalog or accepting an outdated cost.

**Independent Test**: Add Red Freedom Rose to a product line, enter a quantity, unit price, and markup, and verify that the row and product-line totals use the entered unit price.

**Acceptance Scenarios**:

1. **Given** an editable product line with an empty catalog row, **When** the florist selects Red Freedom Rose, **Then** the row provides an editable nonnegative unit-price value for that selection.
2. **Given** a selected catalog row, **When** the florist changes its unit price, **Then** the row's marked-up selling price, subtotal, parent product-line price, and proposal totals recalculate from the new value.
3. **Given** the same catalog item is used in two rows or proposals, **When** the florist assigns different unit prices, **Then** each row retains and calculates from its own value without changing the other row.
4. **Given** a saved proposal draft or revision workspace, **When** it is reopened, **Then** every catalog row restores the unit price previously saved for that proposal rather than silently adopting a later catalog price.

---

### User Story 2 - Override The Catalog-Derived Starting Price (Priority: P2)

When a pack-purchased catalog item is selected, the builder divides its current full-pack Base Unit Cost by pack quantity to prefill the proposal row's per-unit price. The florist can override that row price, which recalculates the row's effective pack cost without changing the catalog item.

**Why this priority**: The derived starting price speeds data entry while keeping proposal-specific vendor pricing independent from the shared catalog.

**Independent Test**: Select an item with a $30 Base Unit Cost and pack quantity of 10, verify the row starts at $3 per unit, override it to $4, and verify the row's effective pack cost becomes $40 while the catalog remains $30.

**Acceptance Scenarios**:

1. **Given** a pack-purchased catalog item with a $30 Base Unit Cost and pack quantity of 10, **When** it is selected for a new composition row, **Then** the row is initialized at $3 per unit and remains editable.
2. **Given** a row price is changed, **When** the proposal is saved, **Then** the catalog item's shared/default price is not changed by the proposal edit.
3. **Given** the catalog item's shared/default price changes after a proposal row has been saved, **When** the saved proposal is reopened, **Then** the saved row price remains unchanged.
4. **Given** the florist overrides the $3 row price to $4 and the recorded pack quantity is 10, **When** shopping costs are recalculated, **Then** that row's effective pack cost is $40 while the catalog Base Unit Cost remains $30.
5. **Given** a row contains an overridden price or an older snapshotted pack quantity, **When** the florist chooses Reset to Catalog Price, **Then** the row price and snapshotted pack quantity are replaced from the catalog item's current full-pack Base Unit Cost and current pack quantity and all dependent totals refresh.

---

### User Story 3 - Calculate Shopping Purchases By Pack (Priority: P1)

The florist continues to maintain a pack quantity on each applicable catalog item. The shopping list converts the required and reserve-adjusted number of units into whole packs and values each pack from the catalog row's current per-unit price.

**Why this priority**: Correct proposal pricing without correct purchasing estimates could understate event costs and cause the florist to buy too little or budget incorrectly.

**Independent Test**: Use a catalog item with a pack quantity of 25 and a row unit price of $2.00; verify that the shopping list values each pack at $50.00 and multiplies that amount by the whole packs required after reserve is applied.

**Acceptance Scenarios**:

1. **Given** a row unit price of $2.00 and a pack quantity of 25, **When** the shopping list is calculated, **Then** the estimated price per pack is $50.00.
2. **Given** required quantity plus reserve does not divide evenly by the pack quantity, **When** the shopping list is calculated, **Then** the required pack count rounds up to the next whole pack and the estimated total uses that pack count.
3. **Given** the florist changes the unit price on a proposal row, **When** the shopping list refreshes, **Then** its estimated pack and total costs update while its pack quantity remains unchanged.
4. **Given** an item that is not purchased in packs, **When** its shopping-list estimate is calculated, **Then** its current row unit price is multiplied by the total units to purchase without inventing a pack quantity.
5. **Given** the same catalog item contributes quantities at different row unit prices but uses the same recorded unit type and pack quantity, **When** the shopping list aggregates those quantities, **Then** it produces one purchasing entry whose pack and total estimates use the highest contributing per-unit price.
6. **Given** the same catalog item contributes rows with different recorded unit types or pack quantities, **When** the shopping list is calculated, **Then** those incompatible contributions remain separate, clearly identified purchasing entries.
7. **Given** a $35 full-pack Base Unit Cost and a pack quantity of 12, **When** the row price is derived, **Then** the per-unit calculation retains up to four decimal places and the resulting pack and monetary totals round to cents.

---

### User Story 4 - Preserve Submitted Proposal History (Priority: P2)

Once a proposal version is submitted, its catalog-row prices, markups, pack quantities, calculated selling prices, and shopping-list estimates remain a faithful record of what the florist approved at that time.

**Why this priority**: Proposal revisions, reporting, and payment totals depend on immutable historical pricing rather than today's catalog values.

**Independent Test**: Submit a proposal, later change the catalog item's current price or pack quantity, and verify that the submitted version still displays its recorded row and pack calculations while a newly selected catalog item in an editable row derives its starting per-unit price from the current catalog full-pack cost and pack quantity.

**Acceptance Scenarios**:

1. **Given** a submitted proposal version, **When** a catalog price or pack quantity later changes, **Then** the submitted version retains its recorded pricing and shopping-list facts.
2. **Given** a project proposal revision starts from an existing submitted version, **When** the revision opens, **Then** it begins with the recorded row prices and pack quantities and permits authorized edits only in the revision workspace.

### Edge Cases

- A row unit price may be zero, but the builder must visibly preserve zero rather than substituting a catalog value during save, reopen, or recalculation.
- Negative, nonnumeric, blank, or otherwise invalid row prices must not be accepted as valid calculated pricing; the florist receives actionable validation.
- Changing the selected catalog item must derive the new row price from that item's current catalog Base Unit Cost and pack quantity and must not accidentally retain a price belonging to the previously selected item.
- Re-selecting the same catalog item or reopening the proposal must not overwrite a deliberate saved row price or pack-quantity snapshot; only the explicit Reset to Catalog Price action replaces both with current catalog-derived values.
- Proposal-row per-unit prices retain up to four decimal places; effective pack costs, subtotals, taxes, invoice totals, and other monetary totals round to cents consistently.
- Pack quantity must remain a positive whole number where applicable; missing or invalid pack quantities must not cause division errors or fabricated pack totals.
- When compatible rows for the same catalog item use different prices, shopping-list aggregation must retain the combined required units and use the highest contributing per-unit price. Rows with incompatible recorded unit types or pack quantities must remain separate.
- Retired catalog items already recorded in proposals must remain readable and retain their saved pricing and pack facts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow the florist to enter and edit a nonnegative unit price on every catalog row in the Internal Catalog Composition of an editable product line.
- **FR-002**: A catalog row's unit price MUST represent the proposal-specific cost per catalog unit before that row's markup is applied.
- **FR-003**: The system MUST recalculate the row selling price, row subtotal, parent product-line unit price and subtotal, proposal subtotal, applicable taxes, and proposal total whenever a row unit price changes.
- **FR-004**: For a pack-purchased catalog item, the catalog Base Unit Cost MUST remain the full pack purchase price; when selected, the system MUST divide that cost by pack quantity to prefill the proposal row's editable per-unit price.
- **FR-005**: Editing a proposal row's unit price MUST NOT modify the shared catalog item or any other proposal row.
- **FR-006**: The system MUST save the effective unit price with the proposal row so drafts, autosaved revision workspaces, reopened proposals, and submitted versions reproduce the same calculations independently of later catalog changes.
- **FR-007**: Selecting a different catalog item for an existing row MUST derive a new per-unit row price from that item's current catalog Base Unit Cost and pack quantity and MUST NOT silently reuse the previous item's price.
- **FR-008**: Re-selecting the same catalog item, refreshing, or reopening a saved row MUST preserve its explicit proposal-row price and snapshotted pack quantity. The system MUST provide a Reset to Catalog Price action that replaces both using the catalog item's current full-pack Base Unit Cost and current pack quantity and recalculates all dependent values.
- **FR-009**: The system MUST retain each catalog item's pack quantity and associate the applicable pack quantity with the proposal row and shopping-list record without changing the shared catalog value when row pricing is overridden.
- **FR-010**: For pack-purchased items, the system MUST calculate the proposal row's effective pack cost as the row's current per-unit price multiplied by the row's recorded units per pack, replacing the catalog-derived pack cost only within that proposal row and its shopping calculations.
- **FR-011**: The system MUST calculate required whole packs by rounding the reserve-adjusted required unit quantity up to the next complete pack.
- **FR-012**: The system MUST calculate the shopping-list estimated total as the effective price per pack multiplied by required pack count; items without pack purchasing MUST use row unit price multiplied by total units to buy.
- **FR-013**: Changes to row unit price, quantity, markup, reserve percentage, or pack quantity MUST refresh all affected proposal and shopping-list calculations consistently.
- **FR-014**: When the same catalog item is contributed by multiple proposal rows with compatible recorded unit types and pack quantities, the shopping list MUST combine their required quantities into one item, round the required pack count once after aggregation, and use the highest contributing per-unit price for its effective pack price and total estimated cost. Contributions with different recorded unit types or pack quantities MUST remain separate, clearly identified shopping entries.
- **FR-015**: The system MUST reject blank, negative, nonnumeric, nonfinite, and more-than-four-decimal row prices, display actionable row-level validation, and preserve the florist's other valid row entries when validation fails. An explicit zero MUST remain valid and MUST NOT be replaced with a catalog-derived value.
- **FR-016**: Submitted proposal versions MUST retain their recorded catalog-row unit price, markup, pack quantity, calculated selling price, and shopping-list cost facts as immutable historical values.
- **FR-017**: Existing proposals and revision workspaces MUST remain readable and calculable when they contain catalog rows saved before this feature.
- **FR-018**: Fee, discount, labor, and other existing manual line-price behaviors outside Internal Catalog Composition MUST remain unchanged.
- **FR-019**: Catalog searching, row quantity, markup, reserve, product-line rollup, taxes, labor, autosave, revision, submission, PDF upload, and shopping-list workflows MUST continue to operate with the new row-pricing behavior.
- **FR-020**: The system MUST retain proposal-row per-unit prices to a maximum of four decimal places for derivation and calculation while rounding effective pack costs, subtotals, taxes, invoice totals, and other monetary totals to two decimal places.

### Constitution Alignment *(mandatory)*

- **Surface**: This feature affects the authenticated CRM floral proposal builder, proposal draft/revision data, submitted proposal snapshots, and internal shopping-list calculations. It does not change the public website or client payment surfaces.
- **Product Owner Approval**: Florist/product-owner feedback explicitly authorizes the CRM proposal-builder pricing change. No public website approval is required because public website behavior, content, styling, SEO, routing, and forms remain unchanged.
- **Brownfield Preservation**: Preserve catalog search, pack quantities, waste/reserve behavior, markup, product-line pricing rollup, labor, taxes, shopping-list generation, lead proposal creation, project revision autosave, immutable submitted versions, and manual Canva PDF upload. Only proposal catalog-row unit-price entry and its dependent calculations are authorized for modification.
- **Supabase Security**: Existing internal CRM authorization and row-level access expectations remain in force for catalog items, proposals, components, revision workspaces, and shopping lists. Proposal-row price edits are proposal-scoped and must not grant broader catalog write access. Storage policies are unchanged.
- **Schema Migration**: Planning MUST determine whether existing persisted fields already represent the required per-row unit price and pack cost semantics. Any table change MUST include a matching executable, data-preserving migration and declarative schema update; no schema change may reinterpret historical values without a safe compatibility strategy.
- **Standalone Edge Functions**: No Edge Function change is expected. If planning discovers an affected proposal submission function, it MUST remain independently deployable with no shared local imports, and no automated Edge Function test or harness may be created.
- **Testing Expectations**: Focused proposal-builder, calculation-service, persistence, draft/revision, and workflow unit tests MUST cover row-price entry, recalculation, save/reopen behavior, default-price behavior after clarification, pack math, mixed-price aggregation, legacy compatibility, and immutable version hydration. PostgreSQL integration tests are required only for changed database functions, constraints, policies, or durable contracts. Any affected Edge Function receives standalone type-checking and documented smoke validation only, never automated tests.
- **Sensitive Data**: Unit costs, markups, shopping estimates, customer/event context, proposal documents, and payment totals remain internal or follow their existing approved proposal boundaries. No new secrets, email data, passcodes, signatures, payment credentials, or public disclosures are introduced.
- **Proposal Workflow**: The proposal remains the source for invoice/planning calculations and future payment/reporting data. The manual Canva-generated PDF upload and approved/signed document workflow remain unchanged.
- **Git Publication**: AI agents MUST NOT run commit, push, or commit/push-capable automation. Publication remains the human operator's responsibility.

### Key Entities *(include if feature involves data)*

- **Catalog Item**: A reusable flower, greenery, hardgood, or other purchasable item with identity, unit type, pack quantity, availability, and a shared Base Unit Cost that represents the full purchase cost for pack-purchased items.
- **Proposal Catalog Row**: A proposal-specific use of a catalog item containing quantity per product unit, effective unit price, markup, calculated selling price, reserve, pack quantity snapshot, and calculated subtotal.
- **Proposal Product Line**: A client-facing proposal item whose unit price is the sum of its internal catalog-row selling amounts and whose subtotal contributes to proposal totals.
- **Shopping List Item**: An internal purchasing projection derived from proposal catalog rows, aggregated required quantities, reserve, units per pack, required pack count, and a conservative effective pack and total cost based on the highest contributing row price when row prices differ.
- **Proposal Draft Or Revision Workspace**: The editable proposal state that must preserve proposal-row prices and recalculate consistently across autosave and resume.
- **Submitted Proposal Version**: The immutable historical pricing and planning snapshot used for project financials, reporting, and revision baselines.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of tested editable product rows, a florist can select a catalog item, enter or override its unit price, and see all affected proposal totals update without leaving the builder.
- **SC-002**: Across representative single-row, multi-row, decimal-price, reserve, and mixed-price scenarios, proposal and shopping-list calculations match independently calculated expected values to the application's currency precision in 100% of cases.
- **SC-003**: For every tested pack-purchased item, estimated pack price equals row unit price multiplied by units per pack, required packs round up correctly, and total estimated purchase cost matches required packs multiplied by pack price.
- **SC-004**: Saved drafts and revision workspaces restore 100% of their recorded row prices, pack quantities, and calculated results after reopening, even after the shared catalog item changes.
- **SC-005**: Existing proposals created before this feature remain readable and reproduce their previously recorded totals in all compatibility scenarios approved during planning.
- **SC-006**: A florist can add and completely price a catalog composition row—including item, quantity, unit price, and markup—in under 30 seconds during acceptance testing.
- **SC-007**: Proposal-row price edits cause zero unintended changes to shared catalog pricing or unrelated proposal rows in all acceptance tests.
- **SC-008**: Submitted proposal versions preserve their recorded pricing and purchasing facts in 100% of history and revision-baseline tests.
- **SC-009**: Across all tested non-even pack-cost divisions, four-decimal per-unit calculations reproduce the expected pack cost and every resulting monetary total rounds correctly to cents.

## Assumptions

- The unit price requested by the florist is the proposal-specific cost per catalog unit, such as price per stem, before markup; it is distinct from the calculated selling price presented through the parent proposal line.
- Proposal-row price overrides are local to that row and do not update the catalog master.
- Pack quantity remains catalog-managed but is snapshotted with proposal data so later catalog changes do not rewrite existing proposal history; a row-price override recalculates only the proposal row's effective pack cost.
- Existing markup, reserve, tax, labor, and product-line rollup rules remain authoritative; this feature explicitly permits four-decimal proposal-row unit prices while retaining cent-rounded monetary totals.
- Existing internal-user authorization is sufficient; this feature does not introduce a new role or permission.
- Pricing a catalog item differently across multiple proposal rows is valid and must remain traceable in shopping-list cost calculations.
- Public pages, client payment pages, proposal PDF generation strategy, approval/signature workflow, and payment collection are outside this feature's scope.
