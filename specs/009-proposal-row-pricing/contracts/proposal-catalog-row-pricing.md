# Contract: Proposal Catalog Row Pricing

## 1. Scope And Authorization

This contract applies to authenticated internal CRM users editing:

- `/admin/leads/:leadId/floral-proposal-builder`
- `/admin/projects/:projectId/proposal-revision`

Existing route guards, proposal/workspace RLS, and catalog read permissions remain authoritative. This feature grants no new catalog write permission and changes no public, client, storage, email, payment, or Edge Function contract.

## 2. Canonical Pricing Terms

| Term | Contract meaning |
|---|---|
| Catalog Base Unit Cost | Full current purchase cost for a pack-priced catalog item; individual cost for a non-pack item |
| Row Unit Price | Proposal-specific pre-markup cost per stem/unit, retained to four decimals |
| Row Selling Price | Row Unit Price after markup, rounded to cents |
| Effective Pack Cost | Row Unit Price × the row's snapshotted pack quantity, rounded to cents |
| Product Line Unit Price | Sum of marked-up component contributions for one client-facing product, rounded to cents |

Templates, labels, tests, and documentation use these meanings consistently even where existing field names remain for compatibility.

## 3. Catalog Selection Contract

### Pack-priced item

Given:

- catalog Base Unit Cost = `$30.00`
- pack quantity = `10`

Selection produces:

- Row Unit Price = `3.0000`
- snapshotted pack quantity = `10`
- Effective Pack Cost = `$30.00`

### Non-pack item

Catalog Base Unit Cost becomes the four-decimal Row Unit Price directly and pack fields remain null.

### Replacement rules

- Selecting a different catalog item replaces catalog identity, recorded catalog context, pack snapshot, and derived row price.
- Typing an unmatched catalog query does not retain a stale catalog ID or pretend the row is linked.
- Re-selecting the same recorded item does not overwrite saved cost or pack facts.
- Retired/unavailable recorded catalog items remain editable from saved values but cannot reset until a current selectable catalog item can be resolved.

## 4. Row Editing Contract

The Internal Catalog Composition table renders Row Unit Price as an editable numeric control.

- Accepts `0` through the existing supported numeric range.
- Accepts at most four decimal places.
- Distinguishes blank from explicit zero.
- Rejects negative, nonnumeric, nonfinite, and excess-precision values with an actionable row-level message.
- Uses a descriptive accessible name containing the catalog row/item name.
- Does not save to or mutate the shared catalog item.

On each valid edit, the builder recalculates in memory:

1. effective pack cost;
2. marked-up row selling price;
3. row subtotal;
4. parent product-line price/subtotal;
5. labor/tax/proposal totals;
6. shopping-list projection.

No new per-keystroke network request is allowed. Existing lead save or revision autosave persists the resulting draft through its normal boundary.

## 5. Reset Contract

An explicit `Reset to Catalog Price` control is available when the row has a resolvable current catalog item.

On activation it:

1. reads the current catalog full-pack Base Unit Cost and pack quantity;
2. replaces the row's snapshotted pack quantity;
3. derives and replaces the four-decimal Row Unit Price;
4. recalculates Effective Pack Cost and all dependent values;
5. leaves the shared catalog unchanged.

Reset is disabled or unavailable with explanatory accessible text when the row has no current catalog identity, the item is retired/unavailable, or its required pack data is invalid. Failure preserves the current row values.

## 6. Calculation Contract

### Precision helpers

```text
round4(value) = proposal-row unit-cost precision
round2(value) = currency precision
```

### Component

```text
rowUnitCost       = round4(input)
sellUnitPrice     = round2(rowUnitCost × (1 + markupPercent / 100))
extendedQuantity = existing quantity normalization(quantityPerUnit × lineQuantity)
componentSubtotal = round2(sellUnitPrice × quantityPerUnit)
effectivePackCost = packQuantity ? round2(rowUnitCost × packQuantity) : null
```

### Product line and proposal

```text
productLineUnitPrice = round2(sum(sellUnitPrice × quantityPerUnit))
productLineSubtotal  = round2(productLineUnitPrice × lineQuantity)
```

Existing labor, discount, fee, tax, subtotal, and final-total formulas then consume cent-rounded product-line values unchanged.

## 7. Shopping Aggregation Contract

### Grouping

Contributions group by:

1. catalog identity (or existing recorded fallback identity);
2. recorded unit type;
3. snapshotted pack quantity.

Different row prices do not split an otherwise compatible group. Different unit types or pack quantities do split it and the shopping note distinguishes the purchasing definition.

### Aggregate pack calculation

For each compatible group:

```text
requiredUnits       = sum(contribution required units)
totalPlusReserve    = sum(contribution reserve-adjusted units)
pricingUnitCost     = max(contribution row unit cost)
requiredPackCount   = ceil(totalPlusReserve / packQuantity)
totalUnitsToBuy     = requiredPackCount × packQuantity
estimatedPackCost   = round2(pricingUnitCost × packQuantity)
totalEstimatedCost  = round2(estimatedPackCost × requiredPackCount)
```

For non-pack groups, total units to buy equals reserve-adjusted units and total estimated cost is `round2(highest row unit cost × total units to buy)`.

Pack rounding occurs once after compatible quantities are aggregated. Existing reserve calculation per contribution remains unchanged.

## 8. Persistence Contract

### Normalized initial/lead proposal records

- `floral_proposal_components.base_unit_cost` accepts and returns four decimals.
- `sell_unit_price`, component subtotal, product line prices/totals, proposal totals, and shopping money remain two decimals.
- Component snapshot records `pack_quantity` and derived `effective_pack_cost` alongside existing context.

### Revision workspace and invoice snapshots

- Keep top-level `schema_version = 2`.
- Preserve four-decimal component `base_unit_cost` as a JSON number.
- Preserve recorded pack quantity and derived effective pack cost.
- Do not consult live catalog data while adapting, reopening, autosaving, finalizing, or hydrating a submitted version.
- Existing `purchase_unit_cost` is accepted as legacy metadata but cannot override the recorded row cost.

### Repository behavior

Repositories map values only; calculation belongs to the builder service. Existing replace/upsert transaction ordering and error behavior remain unchanged.

## 9. Compatibility Contract

- Existing two-decimal normalized component costs remain exactly equal after migration.
- Existing v1/v2 JSON snapshots load recorded row cost, markup, pack quantity, and catalog context without repricing.
- If legacy effective pack metadata is absent, derive it from recorded row cost and pack quantity.
- If legacy pack quantity is absent, preserve the row as an individual-unit projection and show existing compatibility guidance where applicable; do not query catalog to fabricate history.
- New/different selection and explicit reset may use current catalog data because those are deliberate florist actions.

## 10. Failure And Recovery Contract

| Condition | Required result |
|---|---|
| Blank/negative/nonnumeric/excess precision | Row-level validation; no invalid save; retain other valid entries |
| Catalog item missing during reset | Preserve row; explain that current catalog pricing is unavailable |
| Invalid/missing pack quantity for pack-priced selection | Do not divide; preserve or reject selection with actionable guidance; never return Infinity/NaN |
| Save/autosave failure | Existing save error state; edited values remain in the open builder for retry |
| Legacy snapshot lacks optional pack facts | Preserve recorded prices; neutral individual-unit compatibility behavior, no live repricing |
| Incompatible pack snapshots for same catalog item | Separate shopping groups with clear notes |

## 11. Accessibility And Theme Contract

- Unit-price input and reset control are keyboard operable.
- Input, validation, and reset controls expose item-specific accessible names.
- Reset state and validation are not communicated by color alone.
- Focus remains predictable after recalculation; edits do not collapse the containing product row.
- Controls use existing CRM light/dark theme tokens and remain usable at supported horizontal-scroll/mobile widths.

## 12. Security And Privacy Contract

- Internal unit cost and markup stay within existing authenticated CRM and submitted-snapshot boundaries.
- Proposal-row updates cannot write `catalog_items`.
- No service-role key, provider secret, PDF URL, customer token, or payment credential enters new frontend state or logs.
- No new public response, anonymous read, Edge Function endpoint, email, storage policy, or external integration is introduced.
