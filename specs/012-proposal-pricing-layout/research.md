# Research: Proposal Effective Pricing and CRM Ultrawide Layout

## Decision 1: Preserve `unit_price` as the effective quoted price

**Decision**: Keep the existing top-level `unit_price` field as the effective amount used by customer rendering, line subtotals, proposal totals, invoice snapshots, and payments. For composition-backed products, add private mutable fields `calculated_unit_price` and nullable `actual_unit_price_override`; resolve effective `unit_price` as `actual_unit_price_override ?? calculated_unit_price`.

**Rationale**: Current repositories, snapshots, renderer bindings, conversion functions, and financial consumers already agree that `unit_price` is the customer price. Keeping that boundary avoids a broad rename and makes downstream code consume the override without knowing about editor state. Null provides an unambiguous following state and preserves zero as a valid override.

**Alternatives considered**:

- Rename `unit_price` to `actual_unit_price`: rejected because it would churn normalized rows, renderer/template bindings, legacy snapshots, and financial integrations without changing business meaning.
- Persist both `actual_unit_price` and `unit_price`: rejected because two authoritative effective-price fields can drift.
- Infer override state by comparing calculated and actual values: rejected because a deliberate override may equal the calculated value and must remain stable until cleared.

## Decision 2: Store product editor metadata in existing private JSON

**Decision**: Keep normalized `floral_proposal_line_items.unit_price` as the queryable effective amount. Store `calculated_unit_price` and `actual_unit_price_override` in the existing line `snapshot` JSON for lead drafts and directly on V3 revision snapshot product lines. Do not add relational price columns.

**Rationale**: The new fields are product-only mutable editor state, while the effective amount is already normalized. Existing line snapshots are proposal-owned, returned by the repository, and intended for compatibility metadata. This minimizes schema surface and prevents catalog writes while still allowing save/reopen and revision adaptation.

**Alternatives considered**:

- Add nullable calculated/override columns: provides easier database querying but duplicates product-only editing state that no current report consumes and adds repository/schema churn.
- Store only the override boolean: rejected because the override value must survive independent of later calculated changes.
- Recalculate the calculated benchmark from live catalog data on load: rejected because spec 009 makes proposal composition snapshots authoritative and forbids silent repricing.

## Decision 3: Use a versioned product price state

**Decision**: Bump mutable proposal revision state from schema version 2 to version 3. A V3 product line contains calculated price, nullable override, effective `unit_price`, quantity, subtotal, and composition. Labor, fee, and discount lines retain their existing manual `unit_price` shape. V3 omits active `labor_percent` and percentage-derived breakdown fields.

**Rationale**: The meaning of product `unit_price` changes from always calculated to effective quoted price, and the active labor shape is removed. A version bump lets adapters distinguish legacy state, validate invariants, and preserve immutable historical V1/V2 data.

**Alternatives considered**:

- Extend V2 in place: rejected because consumers could not reliably distinguish old product price semantics or whether labor conversion had occurred.
- Eagerly upgrade every snapshot: rejected because submitted proposal and invoice snapshots are immutable financial evidence.

## Decision 4: Convert legacy labor lazily and idempotently

**Decision**: A shared V1/V2-to-V3 adapter upgrades only mutable lead drafts, existing revision workspaces, and historical baselines copied into a new mutable workspace. For nonzero legacy labor, create exactly one quantity-one manual labor line tagged with stable conversion key `labor-percent-v1`, preserve conversion metadata at the snapshot level, and omit the active percentage. Derive the amount from a valid recorded `calculatedLaborAmount`, otherwise from recorded subtotal minus existing line subtotals, with legacy percentage math as a cross-check/fallback. Require agreement within one cent or block with repair guidance.

**Rationale**: The florist chose to preserve in-progress totals while retiring the percentage mechanism. Durable line and top-level markers make repeated load/autosave and partial lead-proposal saves recoverable without duplicate charges. Cross-checking protects financial meaning rather than silently changing a draft.

**Alternatives considered**:

- Drop the legacy surcharge: rejected by clarification because it lowers in-progress quoted totals.
- Keep the hidden percentage active: rejected because percentage labor is explicitly retired.
- Convert on every total calculation: rejected because it can duplicate charges and cannot distinguish conversion labor from an intentional manual line.
- Bulk-rewrite immutable snapshots: rejected because it violates proposal-history immutability.

## Decision 5: Centralize calculated/following/override transitions

**Decision**: Extend `FloralProposalBuilderService.recalculateLine` and its adapters as the single price-state owner. Composition changes always refresh calculated price. They refresh effective price only while override is null. A valid Actual Unit Price edit sets the nullable override, clearing sets it to null, and item/type replacement discards the prior product override. Ephemeral input/error strings distinguish blank reset from zero and invalid input.

**Rationale**: Current product and shopping calculations already live in this service. Keeping state transitions there makes component code an input adapter and prevents divergence between lead and revision flows.

**Alternatives considered**:

- Implement override logic only in the component: rejected because hydration, autosave, revision, rendering, and tests would each need duplicate rules.
- Allow Actual Unit Price to feed composition: rejected because it corrupts shopping cost and defeats the feature's purpose.

## Decision 6: Remove only calculated labor, not manual labor totals

**Decision**: Remove labor-percentage controls, `labor_percent`, and `calculatedLaborAmount` from active V3 state and render contracts. Retain `laborTotal` as the sum of explicit manual labor lines and retain the labor line type.

**Rationale**: Clarification explicitly keeps optional manual labor charges. Existing totals already separate manual and calculated labor, making the retired term removable without changing line-type semantics.

**Alternatives considered**:

- Remove the labor line type: rejected by clarification.
- Rename all manual labor concepts: deferred because the existing label is accurate and changing it adds no requested value.

## Decision 7: Keep calculated pricing private from customer output

**Decision**: Customer-facing render/template data exposes only effective `unit_price`, labeled Unit Price. Calculated price and override metadata remain in internal snapshots and never enter template placeholder values. The manually uploaded Canva PDF remains the authoritative submitted document and receives a manual price-parity smoke check.

**Rationale**: Clarification selected a single quoted price for customers. Existing `item.unit_price` bindings already provide the correct public shape. The application cannot reliably introspect an externally authored PDF to prove its displayed values.

**Alternatives considered**:

- Show Actual Unit Price as a new customer label: rejected by clarification.
- Show both values: rejected because the calculated benchmark and override decision are internal business information.
- Redesign PDF generation: rejected as outside scope and contrary to preserving the Canva path.

## Decision 8: Validate V3 at the mutable and revision-finalization boundaries

**Decision**: Validate effective product state and the absence of active percentage labor before the authenticated builder persists/submits a lead proposal. Update `finalize_project_proposal_revision` through one additive migration so revision submission also rejects active percentage labor, unsupported mutable schema, and inconsistent effective line/scalar totals. Keep `convert_lead_to_project_with_payments` unchanged; it consumes the validated proposal snapshot and scalar totals under its existing immutable/payment rules.

**Rationale**: Lead submission always persists through the authenticated builder before the unchanged Edge Function reloads authoritative database totals. Revision workspaces can live independently and already have a strict SQL schema gate, so that function must move to V3. Payments consume only authoritative snapshot totals; regression coverage proves propagation without redesigning conversion/payment functions.

**Alternatives considered**:

- Leave revision validation at V2: rejected because it would block legitimate V3 workspaces or allow retired labor through a relaxed version gate.
- Recalculate all composition pricing in SQL: rejected because SQL lacks the typed editor context and would duplicate established calculation logic; revision invariant checks are sufficient.
- Modify initial conversion SQL: rejected because effective `unit_price` and scalar totals are already persisted authoritatively before the function runs, and changing the transactional conversion adds risk without a new downstream data need.
- Modify `submit-floral-proposal`: rejected because it transports opaque authoritative state and does not calculate line prices.

## Decision 9: Use a coordinated V3 release

**Decision**: Apply `20260908010000_proposal_effective_pricing_v3.sql` and deploy the V3-capable Angular application during a short proposal-editing maintenance window. Existing mutable V2 state upgrades on first open; new submission requires V3. Never rewrite immutable history.

**Rationale**: Allowing old code to edit V3 product lines can erase overrides, while allowing V2 finalization after cutover can resubmit retired percentage labor. A brief coordinated release is safer than a long dual-write period for this single-operator CRM.

**Alternatives considered**:

- Accept both V2 and V3 indefinitely: rejected because it weakens the labor-retirement invariant.
- Deploy new Angular first without pausing submission: rejected because V3 revision finalization would fail against the old function.
- Roll back to old Angular after V3 writes: rejected unless proposal editing is placed in read-only maintenance mode.

## Decision 10: Fix page frames, not the authenticated shell

**Decision**: Keep `PrivateLayoutComponent` as the post-sidebar width owner. Introduce a prefixed global `.crm-page-frame` plus `data-crm-page-shell` measurement marker with full width, no arbitrary desktop maximum, `min-inline-size: 0`, border-box sizing, and responsive gutters. Adopt it at every routed CRM page root. Remove page caps of 1,880px, 1,180px, and 1,152px; retain intentional limits on prose, focused forms, previews, and overlays.

**Rationale**: The private main element is already fluid with matched 192/224/272px sidebar offsets. Current 1,880px pages use only about 59% of the post-navigation width at 3440; the workshop editor/financial pages use about 36–37%. A shared, measurable page contract fixes the repeated cause without globally overriding legitimate component widths.

**Alternatives considered**:

- Change sidebar/private-layout geometry: rejected because it is not the bottleneck.
- Remove every `max-width` globally: rejected because it would harm modal, preview, form, and reading usability.
- Patch only pages found by text search: rejected because roster, occurrence, retention, dashboard, loading, and error states still require route-wide acceptance evidence.

## Decision 11: Use responsive grids and contained data overflow

**Decision**: Let entity tables, split views, card grids, proposal tables, and workshop operational panels use the wider page frame through existing fluid/flex behavior or targeted `minmax`/auto-fit improvements. Permit horizontal scrolling only inside labeled table/data wrappers. Preserve DOM/tab order and mobile breakpoints.

**Rationale**: Ultrawide value comes from seeing more work context, not stretching every text input. Contained overflow prevents page-level two-dimensional scrolling while preserving minimum useful table columns.

**Alternatives considered**:

- Scale typography/controls with viewport width: rejected because it reduces information density and was not requested.
- Add a new browser automation dependency: rejected; the repository has Karma/Jasmine, and computed geometry is better recorded through a targeted browser/DevTools acceptance audit.

## Decision 12: Use measurable performance and viewport evidence

**Decision**: Retain the existing proposal benchmark of 95% of 20 representative edits completing visible recalculation within 200ms on a 100-line/1,000-component fixture. For layout, require `page frame width / private main width >= 0.90` at 3440-by-1440 and `documentElement.scrollWidth <= clientWidth + 1px` at 1366, 1920, 2560, and 3440. Add 390-by-844, 768-by-1024, and 200% zoom regressions.

**Rationale**: These tests translate the feature's speed and ultrawide goals into repeatable pass/fail evidence while avoiding false claims that DOM unit tests prove browser layout.

**Alternatives considered**:

- Visual judgment only: rejected because it cannot prove the 90% criterion consistently.
- End-to-end framework adoption: rejected as unnecessary scope and dependency growth.
