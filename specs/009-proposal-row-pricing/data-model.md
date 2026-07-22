# Data Model: Proposal Catalog Row Pricing

## Model Boundary

The catalog records how an item is normally purchased. A proposal catalog row records the price the florist chooses for that item in one proposal. The shopping list projects purchasing needs from those proposal-owned row facts.

```text
Catalog Item (shared current values)
  full pack cost + pack quantity
             |
             | select or explicit reset
             v
Proposal Catalog Row (proposal-owned snapshot)
  per-unit cost + markup + quantity + pack quantity
             |
             +--> Product Line / Proposal Totals
             |
             +--> Shopping Contribution
                         |
                         v
                 Shopping List Item
```

Live catalog values never flow into a saved row merely because the proposal is opened or recalculated.

## 1. Catalog Item

Existing shared entity; no schema change.

| Field | Meaning | Validation / ownership |
|---|---|---|
| `item_id` | Stable catalog identity | Existing UUID identity |
| `name` | Search/display name | Existing required value |
| `unit_type` | Purchasing unit classification | Existing catalog enum |
| `pack_quantity` | Units contained in one purchased pack | Positive whole number when pack-priced; null for individual purchasing |
| `base_unit_cost` | Full current pack purchase cost for pack-priced items; individual unit cost otherwise | Nonnegative, cents, catalog-owned |
| `is_active` | Whether item is selectable for new/reset operations | Retired items remain readable in saved proposals |

Rules:

- Proposal editing never writes this entity.
- For pack-priced items, derived catalog per-unit cost is `round4(base_unit_cost / pack_quantity)`.
- For non-pack items, derived catalog per-unit cost is `round4(base_unit_cost)`.

## 2. Proposal Catalog Row

Existing normalized `floral_proposal_components` record plus builder/snapshot metadata.

| Field | Persistence | Meaning | Precision / validation |
|---|---|---|---|
| `floral_proposal_component_id` / `local_id` | Existing row identity | Durable normalized identity or draft-local identity | Unique within owning context |
| `catalog_item_id` | Existing normalized/reference | Selected catalog identity | Nullable for recorded/manual legacy rows |
| `catalog_item_name` | Existing normalized | Recorded display identity | Required for a valid component |
| `quantity_per_unit` | Existing normalized | Catalog units required for one parent product | Nonnegative, two decimals under existing rules |
| `extended_quantity` | Existing normalized/derived | `quantity_per_unit × parent line quantity` | Nonnegative, two decimals |
| `base_unit_cost` | Existing normalized and JSON | Proposal-specific cost per catalog unit before markup | Nonnegative, up to four decimals; normalized column widened to `numeric(14,4)` to preserve the existing integer range |
| `applied_markup_percent` | Existing normalized | Markup applied to row cost | Nonnegative, two decimals |
| `sell_unit_price` | Existing normalized/derived | `round2(base_unit_cost × (1 + markup / 100))` | Cents |
| `subtotal` | Existing normalized/derived | Selling amount contributed to one parent product unit | Cents |
| `reserve_percent` | Existing normalized/snapshot | Extra purchasing allowance | Existing nonnegative two-decimal rule |
| `pack_quantity` | Existing snapshot/workspace | Pack quantity captured at selection/reset | Positive whole number or null |
| `effective_pack_cost` | Derived snapshot/workspace fact | `round2(base_unit_cost × pack_quantity)` | Cents; null without pack purchasing |
| `item_type`, `unit_type`, color, variety, SKU | Existing snapshot/workspace | Recorded catalog context | Preserved independently of later catalog changes |
| `purchase_unit_cost` | Legacy snapshot alias only | Previously captured pack/individual purchase cost | Read for compatibility, not authoritative after recalculation |

### Row price state transitions

```text
Empty row
  -> Select catalog item
Catalog-derived row
  -> Edit unit price
Custom-priced row
  -> Reopen / refresh / reselect same item
Custom-priced row (unchanged)
  -> Reset to Catalog Price
Catalog-derived row using current catalog cost and pack quantity
  -> Select different item
Catalog-derived row for the new item
```

Rules:

- Selecting a new/different item replaces row identity context, pack snapshot, and derived per-unit cost.
- Direct row editing changes `base_unit_cost` only within the proposal and recalculates `effective_pack_cost`.
- Reset replaces both row cost and pack snapshot from current catalog values.
- Hydration, autosave resume, ordinary recalculation, and same-item re-selection preserve recorded row values.
- Blank/nonnumeric/negative values are invalid. Explicit zero is distinct from blank and remains zero.

## 3. Proposal Product Line

Existing client-facing line item; no schema change.

For a product line:

1. Recalculate every component sell unit price from its four-decimal row cost and markup.
2. Calculate component contribution as `sell_unit_price × quantity_per_unit`.
3. Sum component contributions and round the parent `unit_price` to cents.
4. Multiply parent unit price by parent quantity and round subtotal to cents.

Fee, discount, and manual labor line prices continue using their existing direct cent-valued input path.

## 4. Shopping Contribution

Transient calculation record produced from each proposal catalog row.

| Field | Derivation |
|---|---|
| identity | Catalog item ID, with recorded-name/unit fallback for unlinked rows |
| compatibility key | Identity + recorded unit type + recorded pack quantity |
| required units | Row extended quantity |
| reserve target units | Existing reserve rule applied to that contribution |
| total plus reserve | Required units + reserve target units |
| per-unit cost | Row `base_unit_cost`, four decimals |
| effective pack cost | Per-unit cost × recorded pack quantity, cents |

Contributions with the same catalog identity but incompatible unit types or pack quantities are not merged.

## 5. Shopping List Item

Existing persisted shopping-list item; all money fields remain cents.

| Field | Aggregation rule |
|---|---|
| `catalog_item_id`, `item_name`, `item_type`, `unit_type` | Recorded compatible group identity |
| `required_units` | Sum of contribution required units |
| `reserve_units` / `total_plus_reserve` | Sum of contribution reserve-adjusted facts before pack rounding |
| `units_per_pack` | Shared compatible snapshotted pack quantity |
| `required_pack_count` | `ceil(total_plus_reserve / units_per_pack)` once for the group |
| `total_units_to_buy` | Pack count × units per pack, or total plus reserve for non-pack items |
| pricing unit cost | Highest four-decimal row cost among contributions |
| `estimated_pack_cost` | Highest row cost × units per pack, rounded to cents |
| `total_estimated_cost` | Pack cost × pack count, or highest row cost × total units for non-pack items, rounded to cents |
| `notes` | Existing purchase guidance plus compatibility distinction when separate pack definitions exist |

The highest-price rule is intentionally conservative and does not change each proposal row's own product-price calculation.

## 6. Draft And Revision Workspace

`EditableProposalSnapshotV2` remains the top-level contract. No version bump is required.

Each component preserves:

- four-decimal `base_unit_cost`;
- snapshotted `pack_quantity`;
- derived `effective_pack_cost`;
- existing markup, sell price, subtotal, reserve, and catalog context;
- arbitrary legacy snapshot keys.

Legacy adaptation rules for effective pack cost:

1. For editable draft and revision rows, derive from recorded `base_unit_cost × pack_quantity` when a valid pack quantity exists.
2. If no valid pack quantity exists, retain individual-unit semantics and leave effective pack cost unset rather than consulting the live catalog.
3. Retain incoming `effective_pack_cost` and legacy `purchase_unit_cost` as non-authoritative compatibility metadata; never use either value to overwrite the recorded row cost or an editable-row calculation.
4. For immutable submitted history, preserve originally recorded effective-pack or legacy purchase-cost facts for historical display. A new editable revision based on that history recalculates from its recorded row cost and pack quantity.

Workspace autosave writes the complete recalculated draft. Current catalog data is consulted only by explicit selection/reset commands.

## 7. Submitted Proposal Version

Submitted normalized components and immutable project invoice snapshot retain the exact recorded row costs and pack facts.

- Existing normalized two-decimal values remain numerically identical after widening.
- New normalized component costs may contain up to four decimals.
- Existing cent-valued sell prices, subtotals, tax, total, retainer, final balance, and shopping estimates remain unchanged in precision.
- Submitted snapshots are not backfilled or repriced.
- Starting a revision adapts the submitted facts into an editable workspace without catalog refresh.

## 8. Database Change

```sql
alter table public.floral_proposal_components
  alter column base_unit_cost type numeric(14,4)
  using base_unit_cost::numeric(14,4);
```

Migration requirements:

- Apply after `20260721000000_refine_payment_installments.sql`.
- Preserve row count, identities, relationships, values, triggers, RLS state, and grants.
- Do not modify `catalog_items`, shopping-list money columns, proposal line items, project revision workspaces, or submitted snapshot JSON.
- Update the declarative table definition to match.

## 9. Invariants

1. Catalog pack cost changes only through catalog management, never proposal editing.
2. Proposal-row per-unit cost is the only pre-markup price used by row/product calculations.
3. Row per-unit cost has at most four decimals; all financial outputs have at most two.
4. Effective pack cost always derives from the row cost and the same row's pack snapshot.
5. Saved rows never reprice from live catalog data without an explicit selection/reset action.
6. One shopping group has one compatible unit type and pack quantity.
7. Mixed row prices use the highest cost for shopping estimation, not for proposal line pricing.
8. Existing proposals remain readable and retain recorded values.
9. Submitted proposal history remains immutable.
