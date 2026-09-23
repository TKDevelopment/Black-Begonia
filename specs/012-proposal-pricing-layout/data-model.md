# Data Model: Proposal Effective Pricing and CRM Ultrawide Layout

## Model Boundary

The feature separates the internal composition-derived benchmark from the amount quoted to the customer without introducing a second customer-price contract.

```text
Internal Catalog Composition (spec 009)
  row costs + quantities + markup
                  |
                  v
       Calculated Unit Price
                  |
          override is null? ---- no ----> Actual override
                  | yes                       |
                  +-------------+-------------+
                                v
                    effective `unit_price`
                                |
                    quantity × effective price
                                v
                 line subtotal -> proposal total
                                |
                   submitted invoice/payment facts

Shopping list continues from Internal Catalog Composition and never from the
Actual override.
```

## 1. Mutable Proposal Line

Mutable lines form a discriminated union by `line_item_type`.

### Composition-backed product line

| Field | Persistence | Meaning | Validation |
|---|---|---|---|
| `local_id` / normalized line ID | Existing | Stable mutable identity | Unique within proposal/workspace |
| `line_item_type` | Existing | Always `product` for this shape | Required discriminator |
| `item_name` | Existing | Customer-facing product name | Existing nonblank rule before save/submission |
| `quantity` | Existing | Number of product units quoted | Existing nonnegative whole-number rule |
| `calculated_unit_price` | Private line snapshot and V3 workspace | Current composition-derived client price | Finite, nonnegative, cents; read-only in UI |
| `actual_unit_price_override` | Private line snapshot and V3 workspace | Florist-entered quote override | Null means follow; otherwise finite, nonnegative, maximum two decimals; zero is valid |
| `unit_price` | Existing normalized/render/snapshot field | Effective Actual Unit Price | `actual_unit_price_override ?? calculated_unit_price` |
| `actual_unit_price_input` | Ephemeral editor only | Raw input needed to distinguish blank and invalid values | Never persisted |
| `actual_unit_price_error` | Ephemeral editor only | Actionable validation message | Never persisted |
| `subtotal` | Existing | Customer line total | `round2(quantity × unit_price)` |
| `components` | Existing | Internal catalog composition | Remains governed by spec 009 |
| `snapshot` | Existing private JSON | Product price-state and compatibility metadata | Preserves unrelated existing keys |

### Manual line

Labor, fee, and discount lines retain the existing shape:

| Field | Meaning |
|---|---|
| `line_item_type` | `labor`, `fee`, or `discount` |
| `quantity` | Existing manual-line quantity |
| `unit_price` | Existing florist-entered nonnegative amount |
| `subtotal` | Quantity times unit price, with the existing negative sign for discounts |
| `components` | Empty under existing behavior |

Manual lines do not persist or render `calculated_unit_price` or `actual_unit_price_override`.

### Product price state transitions

```text
Calculated-following
  override = null
  unit_price = calculated
       |
       | enter valid value, including 0
       v
Manual override
  override = entered value
  unit_price = override
       |
       | clear Actual Unit Price
       v
Calculated-following using current calculated value
```

Additional transitions:

- Composition cost/quantity/markup changes always refresh `calculated_unit_price`.
- While following, a calculated change also refreshes `unit_price` and subtotal.
- While overridden, a calculated change does not alter the override or effective price.
- Replacing the product identity or changing line type clears the prior override before applying the new line shape.
- Entering a value equal to calculated still records an override; only clearing removes it.

## 2. Internal Catalog Composition Row

No entity or persistence change.

Existing fields remain authoritative for recipe and shopping behavior:

- proposal-owned `base_unit_cost` with four-decimal capability;
- component quantity and extended quantity;
- applied markup and calculated selling contribution;
- reserve percentage;
- snapshotted pack quantity and effective pack cost;
- shopping-list grouping and conservative mixed-price aggregation.

An Actual Unit Price edit never writes, derives backward into, or reallocates any component or shopping field.

## 3. Normalized Lead Proposal Line

`public.floral_proposal_line_items` retains its current columns. No relational price column is added.

| Existing location | V3 meaning |
|---|---|
| `unit_price numeric(12,2)` | Effective quoted price for all line types |
| `subtotal numeric(12,2)` | Effective line subtotal |
| `snapshot.calculated_unit_price` | Product-only calculated benchmark |
| `snapshot.actual_unit_price_override` | Product-only nullable override |
| other `snapshot` keys | Preserved unchanged |

Legacy product rows without the new keys adapt as calculated-following with `calculated_unit_price = unit_price` and null override before composition recalculation. Current snapshotted components, not live catalog data, remain the calculation source.

## 4. Editable Proposal Snapshot V3

Version 3 replaces the mutable V2 contract.

```json
{
  "schema_version": 3,
  "proposal_status": "draft",
  "tax_region": {
    "tax_region_id": "uuid-or-null",
    "name": "New York",
    "tax_rate": 0.08875,
    "was_active": true
  },
  "default_markup_percent": 300,
  "financial_terms": {
    "retainer_amount": 300,
    "final_balance_amount": 700,
    "retainer_due_date": "2026-10-01",
    "final_balance_due_date": "2027-01-01"
  },
  "line_items": [
    {
      "line_item_type": "product",
      "quantity": 3,
      "calculated_unit_price": 100,
      "actual_unit_price_override": 125,
      "unit_price": 125,
      "subtotal": 375,
      "components": []
    }
  ],
  "shopping_list": [],
  "totals": {
    "subtotal": 375,
    "taxAmount": 33.28,
    "totalAmount": 408.28
  },
  "breakdown": {
    "productsTotal": 375,
    "laborTotal": 0,
    "manualLaborTotal": 0,
    "feesTotal": 0,
    "discountsTotal": 0,
    "subtotal": 375,
    "taxAmount": 33.28,
    "totalAmount": 408.28
  },
  "legacy_labor_conversion": null
}
```

V3 invariants:

1. `labor_percent` is absent.
2. `calculatedLaborAmount` is absent.
3. Every product line has valid calculated, nullable override, effective price, and subtotal facts.
4. Non-product lines do not carry product override state.
5. Sum of effective line subtotals equals proposal subtotal.
6. Tax and total match the existing cent-rounding rules.
7. Workspace scalar financial columns equal the snapshot totals.

## 5. Legacy Labor Conversion

### Conversion metadata

Top-level V3 metadata:

| Field | Meaning |
|---|---|
| `conversion_key` | Stable value `labor-percent-v1` |
| `source_labor_percent` | Recorded legacy percentage for audit/repair context |
| `converted_amount` | Cent-rounded manual labor amount |
| `status` | `converted` or `not_required` |

Converted manual labor line snapshot metadata:

| Field | Meaning |
|---|---|
| `origin` | `legacy_labor_percentage_conversion` |
| `conversion_key` | `labor-percent-v1` |
| `source_labor_percent` | Original percentage |
| `converted_amount` | Amount represented by this line |

The line uses quantity `1`, unit price equal to converted amount, and an explicit item name such as `Labor (converted from legacy percentage)`.

### Amount resolution

Candidate order:

1. finite nonnegative recorded `breakdown.calculatedLaborAmount`;
2. `round2(recorded subtotal - sum(existing line subtotals))`;
3. `round2(recorded products total × source labor percent / 100)`.

All available candidates must agree within one cent and replacing the percentage term with the line must reproduce the recorded subtotal, tax, and total. Otherwise adaptation returns an invalid/repair state and does not save or submit.

### Idempotency and partial recovery

| Existing state | Result |
|---|---|
| Neither marker nor tagged line; positive percentage | Create one tagged line and marker |
| Neither; zero/missing percentage | Write `not_required` marker, no line |
| Tagged line only | Reuse it and reconstruct matching marker |
| Marker only | Reconstruct exactly one tagged line from marker amount |
| Both agree | Reuse unchanged |
| Duplicate/mismatched line or marker | Block with repair guidance |

The adapter runs for mutable lead drafts, existing V2 revision workspaces, and immutable historical snapshots only when copied into a new mutable revision. It never writes back to immutable source history.

## 6. Submitted Proposal Version

Submitted snapshots remain immutable and retain:

- effective customer `unit_price` and line subtotal;
- V3 private product price facts for a future revision baseline;
- explicit manual labor lines, including a legacy conversion line if created in mutable state;
- scalar subtotal, tax, total, retainer, and final balance;
- existing document, approval, signature, and submission metadata.

Existing V1/V2 submitted versions remain byte-for-byte unchanged and render from their recorded `unit_price` and totals. They are adapted only into a new mutable V3 workspace.

## 7. Customer Render Projection

The customer projection is intentionally narrower than internal V3 state.

| Internal fact | Customer projection |
|---|---|
| `unit_price` | Exposed as `item.unit_price`, labeled Unit Price |
| `subtotal` | Exposed as existing line total |
| `calculated_unit_price` | Not exposed |
| `actual_unit_price_override` | Not exposed |
| conversion metadata | Not exposed |
| manual labor line | Exposed as an ordinary explicit quoted line under existing rules |

`FloralProposalRenderContract.pricing` no longer carries labor percentage. `totals.labor_total` may remain and equals only the sum of manual labor lines.

## 8. Proposal Totals and Financial Projection

```text
products_total  = sum(product subtotals using effective unit_price)
manual_labor    = sum(manual labor subtotals)
fees_total      = sum(fee subtotals)
discounts_total = sum(negative discount subtotals)
subtotal        = round2(products + manual_labor + fees + discounts)
tax_amount      = round2(max(subtotal, 0) × tax_rate)
total_amount    = round2(subtotal + tax_amount)
```

There is no percentage labor term. Existing project conversion and revision finalization copy the validated scalar values to the active invoice snapshot. Existing payment functions continue using `total_amount`; no payment entity changes.

## 9. Revision Workspace

`project_proposal_revision_workspaces` retains its current columns and RLS policies.

- `schema_version` default changes from `2` to `3`.
- `draft_snapshot` must satisfy the V3 contract before finalization.
- Existing V2 workspace load performs adaptation and immediate V3 persistence before editing/submission.
- Autosave writes V3 JSON and duplicated scalar totals together.
- Concurrent active-baseline and submission-idempotency protections remain unchanged.

## 10. CRM Page Layout Contract

This is a UI contract, not persisted business data.

| Attribute | Meaning |
|---|---|
| `data-crm-page-shell` | Stable page-root marker used for route audit measurement |
| `.crm-page-frame` | Shared full-width, min-width-zero, border-box page-frame behavior |
| private main rectangle | Width remaining after responsive/fixed navigation |
| page-frame ratio | `page frame width / private main width`; at least `0.90` at 3440-by-1440 |
| contained overflow region | Named table/data wrapper allowed to scroll horizontally without page overflow |

No database entity or telemetry record is required. Acceptance evidence records route, state, theme, viewport, frame ratio, page overflow, contained overflow, action clipping, overlap, and notes.

## 11. Database Change

`supabase/migrations/20260908010000_proposal_effective_pricing_v3.sql`:

1. Changes `project_proposal_revision_workspaces.schema_version` default from 2 to 3.
2. Replaces `finalize_project_proposal_revision` with the same signature and security/grant boundary plus V3/effective-total validation.
3. Leaves `convert_lead_to_project_with_payments` unchanged; it continues consuming the effective proposal totals persisted by the authenticated builder.
4. Does not update existing workspace JSON, normalized proposal lines, immutable invoice snapshots, finalized proposal snapshots, documents, payments, or customer records.
5. Is mirrored in the declarative workspace and revision-function files.

## 12. Invariants

1. Effective `unit_price` is the only product unit price consumed outside private editing state.
2. Null override means follow; zero is a valid override.
3. Composition changes never overwrite a non-null override.
4. Actual overrides never alter composition or shopping-list facts.
5. Clearing is the only normal action that removes an override, even when override equals calculated.
6. Percentage labor is absent from V3 active pricing; manual labor remains valid.
7. One legacy percentage produces at most one conversion line and preserves the recorded total.
8. Immutable submitted versions are never upgraded in place.
9. Customer projection never exposes calculated price, override state, or conversion metadata.
10. CRM page width changes never globally remove focused-content maximum widths or create page-level overflow.
