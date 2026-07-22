# Research: Proposal Catalog Row Pricing

## Decision 1: Preserve Catalog Base Unit Cost As Full Pack Cost

**Decision**: Keep `catalog_items.base_unit_cost` cent-valued and interpret it as the full purchase price for pack-priced catalog units. A newly selected proposal row derives per-unit cost as `catalog pack cost / pack quantity`.

**Rationale**: This is the established calculation and matches the florist's clarification. It preserves every catalog record, avoids a catalog-wide migration, and keeps catalog maintenance aligned with vendor pack pricing.

**Alternatives considered**:

- Reinterpret catalog Base Unit Cost as per-stem cost: rejected because it would silently change existing data meaning and require risky catalog conversion.
- Store both catalog pack and per-unit cost: rejected because one value is deterministically derived and dual editable sources could diverge.

## Decision 2: Reuse Proposal Component Base Unit Cost At Four Decimals

**Decision**: Continue using component `base_unit_cost` as the proposal-row per-unit cost, but widen only `floral_proposal_components.base_unit_cost` from `numeric(12,2)` to `numeric(14,4)`. This preserves the existing ten-digit integer range while adding two fractional digits. TypeScript continues to use `number`; calculation helpers explicitly round row cost to four decimals.

**Rationale**: The field already owns the correct row-level meaning throughout builder, snapshot, workflow, and repository paths. Widening is additive and lossless, while a new parallel column would require synchronization and duplicate truth.

**Alternatives considered**:

- Add `proposal_unit_cost`: rejected as redundant with existing component `base_unit_cost`.
- Keep two decimals: rejected because non-even pack divisions can change the reconstructed pack cost materially.
- Store integer ten-thousandths in frontend DTOs: rejected because the repository currently uses PostgreSQL numeric values and the contained calculation surface does not warrant a second money representation.

## Decision 3: Keep Financial Outputs At Cent Precision

**Decision**: Retain up to four decimals only for proposal-row cost. Calculate marked-up sell unit price, effective pack cost, line subtotal, labor, tax, proposal total, shopping-list pack cost, and total estimated cost with the existing cent-rounding boundary.

**Rationale**: Four-decimal input prevents division loss, while invoices, purchases, taxes, and payments remain real currency amounts. Centralized rounding also avoids different component/template displays disagreeing.

**Alternatives considered**:

- Carry four decimals into all totals: rejected because customer-facing and persisted financial totals are cent-valued.
- Round derived row price immediately to cents: rejected by the clarified precision requirement.

## Decision 4: Derive Effective Pack Cost Instead Of Adding A Column

**Decision**: Define effective pack cost as `roundCurrency(row base_unit_cost × snapshotted pack_quantity)` for pack-priced rows. Keep it in builder/workspace/submitted snapshot projections for traceability, but do not add a second normalized authoritative column. Legacy snapshot key `purchase_unit_cost` is accepted as a compatibility alias; new calculations always derive from the current row cost.

**Rationale**: The pack cost is deterministic from two persisted facts. Derivation prevents stale values after an override and avoids schema duplication. Snapshotting the derived value remains useful for inspection without making it authoritative.

**Alternatives considered**:

- Persist an authoritative `effective_pack_cost` column: rejected because every row price or pack change would need synchronized writes.
- Continue trusting legacy `purchase_unit_cost`: rejected because it currently remains at the catalog pack cost after a row override and would violate the feature.

## Decision 5: Keep Revision Snapshot Schema Version 2

**Decision**: Do not bump `PROJECT_PROPOSAL_REVISION_SCHEMA_VERSION`. Additive snapshot metadata and higher numeric precision remain valid within the existing JSON contract. Editable draft and revision rows derive `effective_pack_cost` from the recorded proposal-row `base_unit_cost` multiplied by a valid recorded `pack_quantity`; incoming `effective_pack_cost` and legacy `purchase_unit_cost` values remain compatibility metadata and never override that calculation or the recorded row cost. Immutable submitted history retains its originally recorded effective-pack or legacy purchase-cost facts for historical display. When an immutable version becomes the baseline for a new editable revision, the editable revision uses the recorded row cost and pack quantity for its calculations. If no valid pack quantity exists, hydration treats the row as an individual-unit projection, leaves effective pack cost unset, and does not consult the live catalog to fabricate historical data.

**Rationale**: The top-level and component structures remain compatible, PostgreSQL JSON numbers already support the precision, and the finalization function need not change. This avoids migrating active workspaces or touching the standalone proposal submission boundary.

**Alternatives considered**:

- Bump to schema version 3 and migrate all active workspaces: rejected because no breaking JSON shape change exists and it would expand backend/finalization scope.
- Rebuild old rows from live catalog data: rejected because it would rewrite historical pricing.

## Decision 6: Explicit Reset Is The Only Live-Catalog Refresh

**Decision**: New/different catalog selection initializes both per-unit cost and pack snapshot from the selected catalog item. Reopening or re-selecting the same item preserves recorded values. `Reset to Catalog Price` explicitly replaces both row cost and pack snapshot from current catalog values.

**Rationale**: This honors deliberate overrides, makes catalog refresh intentional, and keeps row price and pack math consistent after catalog pack-size changes.

**Alternatives considered**:

- Refresh on every load: rejected because it would silently reprice drafts and revisions.
- Reset price but retain old pack quantity: rejected because the derived price and shopping pack math would refer to different pack definitions.

## Decision 7: Aggregate Shopping Contributions Before Pack Rounding

**Decision**: Group contributions by catalog identity plus compatible unit type and snapshotted pack quantity. Sum required and reserve-adjusted units, choose the highest contributing per-unit row cost, round required packs once from the aggregate, and calculate pack/total cost from that highest cost. If pack quantity or unit type differs, emit separate clearly identified shopping entries rather than merge incompatible purchasing units.

**Rationale**: The florist selected a conservative price rule, and aggregate pack rounding prevents duplicate packs caused solely by the same item appearing in multiple proposal lines. Splitting incompatible pack definitions avoids invalid arithmetic.

**Alternatives considered**:

- Quantity-weighted average price: rejected by florist choice.
- Separate entries for every distinct row price: rejected because it can overstate pack count for compatible purchases.
- Use the most recent or first row price: rejected as arbitrary and non-conservative.
- Merge differing pack quantities: rejected because one required pack count cannot accurately represent multiple pack sizes.

## Decision 8: Keep UI And Persistence Responsibilities Separated

**Decision**: The builder component owns input events, catalog lookup, reset commands, and accessible messaging. `FloralProposalBuilderService` owns derivation, validation normalization, recalculation, compatibility adaptation, and shopping aggregation. Existing repositories persist the resulting DTOs without calculating prices.

**Rationale**: This follows the current architecture, keeps calculation tests deterministic, and prevents lead and project revision flows from drifting.

**Alternatives considered**:

- Calculate in the template/component: rejected because persistence and revision hydration also require identical rules.
- Calculate in PostgreSQL: rejected because drafts and immediate builder feedback are client-owned today and no transactional server calculation is needed.

## Decision 9: No Edge Function Or External Integration Change

**Decision**: Do not change `submit-floral-proposal` or any other Edge Function. The existing workflow receives calculated payloads and snapshots; the additive precision remains serializable through the same contract.

**Rationale**: No provider, security boundary, endpoint, or privileged behavior changes. Avoiding Edge changes also preserves the constitution's standalone deployment rule and prohibited automated-test boundary.

**Alternatives considered**:

- Validate component precision in the Edge Function: rejected because it duplicates builder/domain validation and expands an otherwise unchanged boundary.
