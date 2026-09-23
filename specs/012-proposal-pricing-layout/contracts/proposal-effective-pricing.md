# Contract: Proposal Effective Pricing

## 1. Contract Boundaries

This contract governs:

- authenticated proposal authoring for leads and project revisions;
- mutable lead-proposal and revision-workspace persistence;
- legacy mutable-state adaptation;
- customer render data and submitted invoice snapshots;
- initial project conversion and revision finalization;
- downstream invoice/planning/payment totals.

It does not change catalog composition-row pricing, shopping-list sourcing, payment-provider requests, customer authentication, or Canva PDF storage.

## 2. Canonical Terms

| Term | Contract meaning |
|---|---|
| Calculated Unit Price | Read-only cent-rounded product price derived from Internal Catalog Composition |
| Actual Unit Price | Effective product price displayed to the florist; calculated price while following, override while overridden |
| Override | Nullable proposal-local amount entered by the florist; zero is valid |
| Unit Price | Customer-facing name for the effective Actual Unit Price |
| Row Unit Price | Existing pre-markup Internal Catalog Composition cost from spec 009; unrelated to Actual Unit Price |

## 3. Editor UI Contract

### Product line column order

```text
Item | Qty | Calculated Unit Price | Actual Unit Price | Subtotal | Actions
```

- Calculated Unit Price is visibly read-only.
- Actual Unit Price is an accessible currency input.
- Each product row exposes a visible and programmatically determinable state label: `Following calculated price` when the override is null and `Manual override` when it is non-null.
- The state label is derived from override nullability rather than price equality, so an override equal to Calculated Unit Price remains identifiable.
- Subtotal is visibly read-only and uses Actual Unit Price.
- Labor, fee, and discount rows retain their existing editable Unit Price control and do not display product-only calculated/actual controls.
- The layout may use contained horizontal table scrolling at narrow widths but must preserve DOM and keyboard order.

### Input outcomes

| Input/action | Result |
|---|---|
| Valid nonnegative value with at most two decimals | Set override; recalculate effective price, subtotal, and totals |
| `0` | Set a valid zero override |
| Clear field | Set override to null; repopulate current calculated price; resume following |
| Enter a value equal to calculated | Set an override and show Manual override until the field is cleared |
| Negative, nonnumeric, nonfinite, or more than two decimals | Preserve raw editor text, show line-level error, block save/finalize |
| Change component/markup while following | Refresh calculated and effective prices |
| Change component/markup while overridden | Refresh calculated price only |
| Replace selected product or change line type | Clear prior product override before applying replacement semantics |

There is no separate Reset to Calculated Price control.

### Accessibility

- Input accessible name includes the product name or stable row position.
- Read-only versus editable state is available without color alone.
- Following versus manual-override state is conveyed by text and is programmatically associated with the Actual Unit Price input.
- Validation is associated with the input and announced as an error.
- Clearing by keyboard produces the same reset behavior as pointer interaction.
- Focus remains on or predictably adjacent to the edited line after recalculation.

## 4. Internal Mutable Line Contract

```ts
type ProductPriceState = {
  calculated_unit_price: number;
  actual_unit_price_override: number | null;
  unit_price: number;
  actual_unit_price_input?: string | null;
  actual_unit_price_error?: string | null;
};
```

For a product:

```text
unit_price = round2(actual_unit_price_override ?? calculated_unit_price)
subtotal = round2(quantity × unit_price)
```

The input and error fields are editor-only. Every persistence boundary emits only validated numeric/null state.

## 5. Lead Proposal Persistence Contract

The normalized line continues to write:

```json
{
  "unit_price": 125.00,
  "subtotal": 375.00,
  "snapshot": {
    "calculated_unit_price": 100.00,
    "actual_unit_price_override": 125.00
  }
}
```

Rules:

- Existing unrelated snapshot keys are merged, not replaced.
- A following product stores `actual_unit_price_override: null`.
- A non-product line omits product pricing metadata and uses existing `unit_price` behavior.
- Reload never sources calculated price from the live catalog; it recalculates from recorded composition.
- Header snapshot, normalized lines/components, and shopping list continue through the existing save workflow; legacy conversion markers recover a partial save without duplication.

## 6. Editable Proposal Snapshot V3 Contract

Required top-level conditions:

- `schema_version` equals `3`;
- `proposal_status` equals `draft` while mutable;
- `line_items`, `tax_region`, `financial_terms`, `shopping_list`, `totals`, and `breakdown` have their established shapes;
- active `labor_percent` and `breakdown.calculatedLaborAmount` are absent;
- `breakdown.laborTotal` and `manualLaborTotal` represent explicit manual labor lines only.

Required product-line conditions:

- calculated price is finite, nonnegative, and cent-rounded;
- override is null or finite, nonnegative, and cent-rounded;
- effective `unit_price` equals override when non-null, otherwise calculated;
- subtotal equals quantity times effective price to cents.

Manual labor/fee/discount lines retain their current schema.

## 7. Legacy Adaptation Contract

### Inputs

- mutable lead proposal snapshot/normalized lines;
- existing V2 revision workspace;
- immutable V1/V2 invoice snapshot copied to initialize a new workspace.

### Outputs

- valid V3 mutable state;
- optional compatibility warning;
- or an invalid result with repair guidance and no persistence/submission.

### Labor conversion

The adapter uses conversion key `labor-percent-v1` and creates at most one ordinary manual labor line. It reconciles the amount and full totals within one cent. It removes active percentage fields from the output, persists V3 immediately for an existing workspace, and never writes an immutable input snapshot.

### Partial-state recovery

- Tagged line plus no top-level marker: reuse line and add marker.
- Marker plus no tagged line: reconstruct line from marker.
- Duplicate or disagreeing records: stop and request repair.
- Zero/missing percentage: mark not required and add no line.

## 8. Totals Contract

```text
productsTotal    = sum(product subtotals)
manualLaborTotal = sum(labor subtotals)
laborTotal       = manualLaborTotal
feesTotal        = sum(fee subtotals)
discountsTotal   = sum(discount subtotals under existing negative rule)
subtotal         = round2(products + labor + fees + discounts)
taxAmount        = round2(max(subtotal, 0) × tax rate)
totalAmount      = round2(subtotal + taxAmount)
```

No percentage argument or calculated-labor term is accepted by the active calculator.

## 9. Customer Render Contract

Customer line data remains compatible:

```json
{
  "quantity": 3,
  "unit_price": 125.00,
  "subtotal": 375.00
}
```

- `item.unit_price` and any equivalent customer binding resolve only effective `unit_price`.
- Calculated price, override value/state, and legacy conversion metadata are excluded from template merge values and rendered HTML.
- Manual labor lines remain visible as explicit quoted lines under existing customer formatting.
- The uploaded Canva PDF must be manually compared with the saved effective values before final submission.

## 10. Submission and Financial Contract

### Initial proposal conversion

Before initial submission, the authenticated builder/workflow validates and persists:

- current mutable snapshot schema is V3;
- active percentage labor fields are absent;
- effective product prices/subtotals and summed proposal totals agree;
- persisted scalar subtotal/tax/total agree with the snapshot.

The unchanged Edge Function and `convert_lead_to_project_with_payments` then reload and consume those authoritative database values, preserving the existing immutable snapshot, document, project, and deposit/final-obligation workflow.

### Project revision finalization

The authoritative function accepts V3 workspaces only after cutover, validates the same pricing invariants plus existing active-baseline/idempotency rules, copies the V3 snapshot to a new immutable version, and recalculates obligations from the validated total.

### Unchanged Edge boundary

`submit-floral-proposal` request and response fields remain unchanged. It does not accept client-calculated prices and performs no product or labor calculation.

## 11. Failure Contract

- Invalid Actual Unit Price blocks save/finalize with the line identified.
- Legacy conversion mismatch blocks editing/submission and preserves source state.
- V2/unsupported mutable schema at a finalization boundary is rejected with repair/reopen guidance.
- SQL total mismatch aborts the transaction; it creates no invoice snapshot, document version, obligation change, or activity entry.
- Autosave/network failure retains the user's current validated in-memory edits and exposes existing retry behavior.
- Immutable historical proposals remain readable even when they contain legacy labor fields.

## 12. Compatibility Contract

- `unit_price` remains the effective field for old renderers and financial readers.
- Existing V1/V2 immutable JSON is never rewritten.
- Existing manual lines remain readable/editable in mutable V3 state.
- Existing component and shopping-list contracts remain unchanged.
- Existing proposal document/upload paths, signatures, passcodes, and payment-provider contracts remain unchanged.
