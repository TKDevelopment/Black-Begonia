# Spec 012 Implementation Acceptance Record

Last updated: 2026-09-23

## Scope and boundaries

Spec 012 changes authenticated proposal authoring, mutable proposal persistence,
proposal revision finalization, customer-render projections, and routed CRM page
width. It preserves the following boundaries:

- manual florist-supplied PDF upload remains the primary proposal-document path;
- Canva import remains optional and disabled in the active submission UI;
- `supabase/edge_functions/submit-floral-proposal.ts` keeps its existing request and
  response contract and is not changed or covered by an automated request/response
  test in this feature;
- `supabase/schemas/public/functions/convert_lead_to_project_with_payments.sql`
  keeps its existing source contract;
- customer/public routes, overlays, modals, popovers, customer previews, and
  intentionally focused inner copy/forms are excluded from the CRM page-frame
  expansion;
- immutable V1/V2 invoice and finalized proposal snapshots are read-only history.

## Authenticated route inventory

The 24 visual route patterns below map to 18 component families. `/admin` and
`/admin/workshops/privacy-policy` are redirects and are not additional visual
surfaces.

| # | Route pattern | Component family | Representative record/fixture | Supported states to verify |
|---:|---|---|---|---|
| 1 | `/admin/dashboard` | Dashboard | authenticated administrator | populated/placeholder, authorization denied |
| 2 | `/admin/leads` | Leads list | lead collection | populated, loading, empty, error, authorization denied |
| 3 | `/admin/leads/:leadId` | Lead detail | representative lead ID | populated, loading, error, authorization denied |
| 4 | `/admin/leads/:leadId/floral-proposal-builder` | Proposal builder | draft lead proposal | populated, loading, error, authorization denied |
| 5 | `/admin/contacts` | Contacts list/detail | contact collection | populated, loading, empty, error, authorization denied |
| 6 | `/admin/contacts/:contactId` | Contacts list/detail | representative contact ID | populated, loading, error, authorization denied |
| 7 | `/admin/organizations` | Organizations list/detail | organization collection | populated, loading, empty, error, authorization denied |
| 8 | `/admin/organizations/:organizationId` | Organizations list/detail | representative organization ID | populated, loading, error, authorization denied |
| 9 | `/admin/catalog-items` | Catalog list/detail | catalog collection | populated, loading, empty, error, authorization denied |
| 10 | `/admin/catalog-items/:itemId` | Catalog list/detail | representative catalog item ID | populated, loading, error, authorization denied |
| 11 | `/admin/tax-regions` | Tax list/detail | tax-region collection | populated, loading, empty, error, authorization denied |
| 12 | `/admin/tax-regions/:taxRegionId` | Tax list/detail | representative tax-region ID | populated, loading, error, authorization denied |
| 13 | `/admin/projects` | Projects list | project collection | populated, loading, empty, error, authorization denied |
| 14 | `/admin/projects/:projectId` | Project detail | representative project ID | populated, loading, error, authorization denied |
| 15 | `/admin/projects/:projectId/proposal-revision` | Proposal builder | V2/V3 revision workspace | populated, loading, error, authorization denied |
| 16 | `/admin/payments` | Payments | payment/obligation collection | populated, loading, empty, error, authorization denied |
| 17 | `/admin/tasks` | Tasks | task collection | populated, loading, empty, error, authorization denied |
| 18 | `/admin/workshops` | Workshops list | workshop collection | populated, loading, empty, error, authorization denied |
| 19 | `/admin/workshops/new` | Workshop editor | new workshop fixture | populated, loading, error, authorization denied |
| 20 | `/admin/workshops/:occurrenceId/edit` | Workshop editor | representative occurrence ID | populated, loading, error, authorization denied |
| 21 | `/admin/settings/workshop-privacy-policy` | Workshop retention | authorized administrator | populated, loading, error, authorization denied |
| 22 | `/admin/workshops/:occurrenceId/roster` | Workshop roster | occurrence with bookings/waitlist | populated, loading, empty, error, authorization denied |
| 23 | `/admin/workshops/:occurrenceId/financials` | Workshop financials | occurrence with charges/refunds | populated, loading, empty, error, authorization denied |
| 24 | `/admin/workshops/:occurrenceId` | Workshop occurrence detail | representative occurrence ID | populated, loading, error, authorization denied |

The 18 families are Dashboard, Leads list, Lead detail, Proposal builder,
Contacts list/detail, Organizations list/detail, Catalog list/detail, Tax
list/detail, Projects list, Project detail, Payments, Tasks, Workshops list,
Workshop editor, Workshop retention, Workshop roster, Workshop financials, and
Workshop occurrence detail.

Representative proposal fixtures required by the implementation are: following
calculated price, manual override, zero override, invalid raw price, legacy
percentage labor, partial legacy conversion, immutable V2 history, and a
100-line/1,000-component performance proposal.

## Pre-implementation baseline

Run date: 2026-09-23

| Check | Result | Notes |
|---|---|---|
| Existing non-Edge proposal suites | PASS, 67/67 | Used the five-spec command from `quickstart.md`; `floral-proposal-workflow.service.spec.ts` was deliberately excluded. Coverage emitted by the existing Karma configuration: statements 46.97%, branches 30.72%, functions 50.66%, lines 47.18%. |
| Existing routed CRM component suites | PASS, 176/176 | Covered the private layout and all 18 routed component families. Expected error-path console messages appeared but no test failed. Coverage: statements 43.87%, branches 22.64%, functions 37.52%, lines 45.91%. |
| `npm run build:prod` | PASS | Initial total 1.07 MB; existing initial-bundle and component-style budget warnings remain. Prerender logged failed requests to placeholder `example.supabase.co`, but generated 24 routes and exited successfully. |
| Edge Function request/response automation | EXCLUDED | Constitution and task contract prohibit generating or running it for this feature. |

## Target database preflight

Status: **blocked pending configured target access**.

The workstation has Docker installed, but the Docker Desktop Linux engine was not
running during preflight. No global or repository-local Supabase CLI is installed,
and checked-in Angular environments intentionally contain placeholder public
credentials. Therefore no target row counts, representative obligation values, or
immutable snapshot hashes have been fabricated or recorded.

Before applying the migration, export and append the exact results of the preflight
queries in `quickstart.md`, including:

- workspace counts grouped by `schema_version`;
- mutable lead/workspace records with active `labor_percent`;
- proposal, normalized line, and workspace row counts;
- representative project obligation and active invoice snapshot values;
- invoice snapshot count/hash and finalized proposal count/hash;
- IDs for the new draft, zero-percent and nonzero-percent legacy drafts, V2
  workspace, immutable V2 submitted snapshot, mixed manual-line proposal, and
  catalog/component fixtures.

The post-migration hashes must match the preflight hashes exactly.

## Deployment and rollback

1. The human operator exports and reviews the target preflight evidence.
2. Begin a short proposal-editing/submission maintenance window.
3. Confirm migrations through
   `20260908000000_workshop_expired_booking_deletion.sql` are present.
4. Apply `20260908010000_proposal_effective_pricing_v3.sql` and validate the V3
   workspace default plus the retained function security/grant contract.
5. Run the repository pgTAP database suites and verify immutable counts/hashes.
6. Deploy the V3 Angular application before reopening proposal editing.
7. Complete authenticated browser, Canva PDF comparison, initial submission, and
   project revision smoke tests.

The migration and application are a coordinated cutover: an old frontend can
overwrite V3 effective prices, while the new frontend expects V3 finalization.
RLS, storage, secrets, Edge Function deployment, customer authentication, and
payment-provider boundaries are unchanged.

Rollback is read-only for proposals already saved as V3. Do not restore an old
frontend against mutable V3 proposals or rewrite immutable history. If a release
must be withdrawn, close proposal editing/submission, preserve the V3 data, and
ship a forward-compatible corrective release.

Git commit and push are human-only handoff actions. AI agents must not run them.

## Post-implementation evidence

### Implemented pricing behavior

- Product rows display read-only Calculated Unit Price and editable Actual Unit
  Price in the approved column order. Override identity is based on nullability,
  so zero and equal-valued overrides remain explicit; clearing resumes following.
- Invalid, negative, nonnumeric, nonfinite, or over-precision raw values stay in
  ephemeral editor state and block save/finalize. They are not persisted.
- Product effective `unit_price` and subtotal round-trip with product-only
  calculated/override metadata. Manual labor, fee, and discount rows retain one
  editable Unit Price and do not receive product metadata.
- Active percentage labor UI, calculation, and customer projection are absent.
  The legacy adapter converts a reconciling nonzero mutable surcharge once using
  `labor-percent-v1`, repairs marker-only/line-only partial state, and blocks
  mismatches without mutating its source object.
- V3 snapshots are validated before lead save/submission and revision autosave.
  Customer template rendering uses only effective price/subtotal and ordinary
  manual lines; calculated, override, conversion, and retired labor metadata are
  not rendered.

### Automated evidence

| Check | Result | Notes |
|---|---|---|
| Integrated safe proposal suites | PASS, 88/88 | Builder service/component, normalized repository, pure workflow snapshot validation, revision service, customer renderer, and scene renderer. The prohibited Edge Function request/response spec was not included. Expected GoTrue multi-client test warnings only. |
| Pure snapshot/renderer slice | PASS, 9/9 | Following, zero override, inconsistent scalar/effective-price rejection, manual labor visibility, private metadata exclusion, and immutable compatibility rendering. |
| Repository/revision persistence slice | PASS, 27/27 | Includes nullable/zero override persistence, manual metadata omission, V2 workspace upgrade, autosave, and repository behavior. |
| Revision validation slice | PASS, 10/10 | Unsafe repair and inconsistent V3 autosave are blocked before repository mutation. |
| Shared layout/payments slice | PASS, 25/25 | Shared min-width/contained-overflow contracts and payments page shell. |
| Contacts/organizations/catalog/tax/tasks slice | PASS, 49/49 | Real templates render one shared shell; expected error-path console output only. |
| Routed dashboard/leads/projects/workshops batch | PASS after correction | Initial batch ran 123 passing tests and exposed one test-only empty-template override in the workshop editor. The override was removed and the full editor suite then passed 27/27. |
| Projects list/detail slice | PASS, 19/19 | The project detail test now exercises the real route template and verifies its single fluid shell, responsive main/bounded-aside split, and payment-table overflow owner. |
| Broad Angular coverage run | 871 PASS, 2 unrelated failures | The prohibited Edge Function request/response spec was explicitly excluded. Statements 75.36% (7,036/9,336), branches 58.91% (3,277/5,562), functions 74.33% (1,587/2,135), and lines 77.93% (6,640/8,520). The two failures are in untouched public workshop specs: `WorkshopBookingStatusComponent`'s pending-Venmo contact-path assertion and `WorkshopDetailComponent`'s alignment assertion. Neither component is in the spec 012 diff. Changed pricing, persistence, rendering, and routed CRM layout logic has focused coverage even though the repository-wide 80% target is not yet met. |
| Development build | PASS | Generated browser/server bundles and prerendered 24 routes. Placeholder Supabase requests failed during prerender as expected; build exited successfully. |
| Production build | PASS | `npm run build:prod` generated browser/server bundles and prerendered 24 routes. Initial bundle is 1.07 MB (244.23 kB estimated transfer), retaining the existing 500 kB initial budget warning and component-style budget warnings, including the proposal builder at 8.31 kB. Placeholder `example.supabase.co` prerender fetches remain expected. The layout work adds no data request or runtime dependency. |
| Performance/isolation | PASS | Twenty price-edit samples on the representative 100-line/1,000-component fixture met the required 19-of-20 under 200 ms assertion; composition and shopping-list facts remained equal. |

### Database contract prepared

`20260908010000_proposal_effective_pricing_v3.sql` changes only the workspace
default and the existing finalization function. The function signature, security
definer, search path, revokes, grants, RLS, and existing rows remain unchanged.
It requires V3, validates following/zero/overridden product prices, line and
scalar totals, rejects product metadata on manual lines and active percentage
labor, and retains replay behavior. Declarative schema mirrors the migration.

The pgTAP fixtures now cover atomic rejection, immutable legacy hash preservation,
effective pricing, V3 finalization, and payment-function propagation. Execution is
pending because Docker Desktop's Linux engine is stopped and no Supabase CLI or
configured target database is available.

### CRM width contract

All 18 routed component families now render `.crm-page-frame` with the unique
`data-crm-page-shell` marker for the active route branch. Page-level 1,880px,
1,152px, and 1,180px caps were removed. Focused copy/forms, bounded detail asides,
modal widths, and contained table overflow remain. The workshop roster retains
its spec 011 mobile `repeat(3, minmax(0, 1fr))` count grid, compact toolbar, and
compact table rules.

Interactive geometry evidence remains pending: the in-app browser runtime had no
connected browser surface, so 3440px ratios, multi-viewport overflow, zoom,
keyboard, and light/dark observations were not fabricated.

### Privacy and unchanged-boundary review

- Customer merge/render and scene-template code exposes effective unit price,
  subtotal, and ordinary manual lines only. Calculated price, override state,
  conversion markers, component cost, markup, and percentage-labor metadata are
  excluded and covered by focused tests.
- Frontend environment files contain only public configuration placeholders; no
  service-role secret was introduced.
- `src/app/app.routes.ts`, public components, proposal-access components,
  standalone Edge Function source, and the conversion function are unchanged in
  the feature diff. Public website/SEO, customer passcodes/authentication,
  signatures, proposal storage, and payment-provider contracts remain outside
  the implementation boundary.
- Final source review found no new runtime dependency or CRM-layout data request.

### Human-operated release checklist

1. Start the isolated Docker/Supabase runtime or connect to the approved target.
2. Export the T004 preflight counts, representative obligations, and immutable
   proposal/invoice hashes before applying any migration.
3. Open the proposal editing/submission maintenance window and apply migration
   `20260908010000_proposal_effective_pricing_v3.sql`.
4. Run both pgTAP suites, confirm RLS/function grants, compare row counts and
   immutable hashes to preflight, and record the results here.
5. Deploy the V3 Angular build before reopening proposal editing.
6. Complete the authenticated browser matrix at 390x844, 768x1024, 1366px,
   1920px, 2560px, and 3440px, plus keyboard, 200% zoom, and light/dark checks.
7. Compare stored effective prices to the florist-supplied Canva PDF, then submit
   one initial proposal and one revision and verify document, snapshot,
   obligation, replay, and customer-render results.
8. Review the two unrelated public-workshop test failures separately. The human
   operator may then commit, push, deploy, and close the maintenance window.

Suggested commit summary: `feat(proposals): add effective unit pricing and fluid CRM layouts`

### Final diff review

`git diff --check` completed successfully; its output contains line-ending notices
only. The source and schema change set was reviewed against FR-001 through FR-026
and SC-001 through SC-010. No approved functional deviation was found. The
uncompleted items below are environment- or human-dependent validation gates,
not omitted implementation. The two broad-suite failures listed above are in
unchanged public workshop components. Existing user-owned changes to
`.specify/feature.json` and `AGENTS.md` were preserved, and no commit or push was
run.

### Remaining release gates

- export target database preflight counts and immutable hashes;
- run the two pgTAP suites after starting the isolated database runtime;
- complete authenticated 1366/1920/2560/3440, mobile, 200% zoom, keyboard, and
  light/dark browser checks;
- compare effective prices with the florist-supplied Canva PDF and submit one
  initial proposal plus one project revision through the unchanged boundary;
- run the target-backed preflight and pgTAP evidence before migration/deployment;
- complete the unavailable interactive browser geometry/accessibility matrix;
- have the human operator perform commit, push, migration, and deployment actions.

### Revision financial reconciliation addendum (2026-09-26)

The reported $3,210 fully paid to $4,500 revised quote now uses the active
invoice snapshot as the financial-summary total. Reconciliation preserves the
$963 deposit and $2,247 final receipts, reopens $1,290 as collectible, and can
transfer up to that increase into a dated revision installment. Deposit and
final amounts remain in the installment table; their duplicate summary cards
were removed. The builder saves and checks current revision totals before
submitting the PDF. A lower later quote releases unpaid scheduled principal;
receipts above the new quote are shown as overpayment.

| Check | Result | Notes |
|---|---|---|
| Project/revision/builder Angular slice | PASS, 62/62 | Includes current-draft persistence, summary rendering, installment availability, and completed-project guard. |
| Payment workflow/modal/activity/list slice | PASS, 23/23 | Includes manual receipt selection and the payments list that now exposes revision balances. |
| Development build | PASS | Angular browser/server bundles and 24 prerendered routes generated. Placeholder remote data fetches reported expected network errors. |
| Production build retry | BLOCKED by network | Font inlining could not reach `fonts.googleapis.com` (`EACCES`). The prior production build above passed before this amendment; the updated production build remains unverified. |
| SQL migration and fixture | Prepared, not executed | Docker Desktop Linux engine is unavailable; `docker info` could not connect to its named pipe. The fixture covers $3,210, $963, and $0 credited against $4,500, authorization, scheduling, a later $4,000 quote, and a $3,000 quote below receipts. |
| `git diff --check` | PASS | Line-ending conversion notices only; no whitespace errors. |

Before deployment, export active snapshot totals, payment target/credit/outstanding
values, and immutable snapshot hashes; run the V3 migration followed by
`20260926010000_reconcile_revision_finances.sql` in the authorized maintenance
window; run `supabase/tests/revision_financial_reconciliation.sql` alongside the
existing proposal/payment suites; compare receipts, allocations, and snapshot
hashes; then deploy the matching Angular build. Retest the reported project on
the project details page and schedule the $1,290 revision installment. The
database execution, target-backed smoke test, and production build with font
access are open release gates.

### Revision draft reopen addendum (2026-09-26)

The reported `loadProjectRevision` error occurs when an unnamed line appears in
the snapshot being adapted. The builder can retain an unused blank editor row
in a draft workspace; the former adapter rejected it alongside any populated
unnamed row. The adapter now removes only inert rows with zero quoted value,
then checks that the remaining line subtotals match the recorded subtotal.
Rows with a price or saved content remain editable and require a name before
autosave or submission. Named legacy rows retain the existing type fallback.

| Check | Result | Notes |
|---|---|---|
| Proposal builder, workflow snapshot, revision service, and builder component suites | PASS, 79/79 | Covers reopening and cleaning a saved workspace, retaining a populated unnamed row for repair, the blank-only draft, autosave repair, and builder serialization. |
| Development build | PASS | Browser/server bundles generated and 24 routes prerendered. Remote placeholder data fetches reported network `EACCES` in this sandbox. |
| `git diff --check` | PASS | Line-ending notices only. |
| Reported live project | Not connected | Reopen the affected revision after deployment, confirm the quote is unchanged, and verify any populated unnamed line is named before finalization. |

### Installment payment email addendum (2026-09-26)

The payment/installment table offers **Send Payment Email** after **Record
Payment** for each payable row. The email says the installment is due and links
to the existing secure checkout route for its outstanding amount. The SQL
request records the selected obligation, supports simultaneous links for
different installments, and allocates a provider receipt to the selected row.
Stale balances make a link unavailable, and an active checkout blocks resending
an overlapping request. Project Details action-button text is 15% larger than
the initially reduced style, and button padding is smaller. The redundant
header deposit-email action was removed.

| Check | Result | Notes |
|---|---|---|
| Focused Angular suites | PASS, 30/30 | Project row action, installment request payload, dispatch errors, and checkout copy. |
| Development build | PASS | Angular browser/server bundles and prerender generated. |
| SQL fixture | Prepared, not executed | Local PostgreSQL and Supabase runtimes are unavailable. |

Apply `20260926020000_installment_payment_email.sql` after the earlier payment
migrations, deploy `issue-payment-request` and `process-payment-messages`, then
deploy Angular. Run `supabase/tests/installment_payment_requests.sql` and a
customer checkout/provider receipt smoke test before production acceptance.

### Customer payment-method switching addendum (2026-09-26)

Returning from card checkout leaves all four methods selectable. Choosing a
manual method closes an open Stripe session before changing the local attempt;
a completed or processing session remains locked. Cash/check confirmations
offer **Choose another payment method**. Changing manual methods preserves the
original reminder-pause end. Venmo appears only for a valid business-profile
target, and checkout displays a clear error if that option is unavailable.

| Check | Result | Notes |
|---|---|---|
| Focused payment-page/service Angular suites | PASS, 18/18 | Return path, manual-method choice, and server error copy. |
| Checkout Edge Function syntax | PASS | Parsed locally with esbuild. |
| SQL fixture and provider switch | Prepared, not executed | No local PostgreSQL/Supabase runtime or Stripe sandbox credentials. |

Apply `20260926030000_payment_method_switch.sql` after the installment-email
migration. Deploy `create-payment-checkout` and Angular together, run
`supabase/tests/payment_method_switch.sql`, and verify card cancel to Venmo,
cash, check, and card again in Stripe sandbox before production acceptance.

### Venmo profile URL follow-up (2026-09-26)

The florist's saved business link uses `account.venmo.com/u/`, which the
initial validation omitted. Migration
`20260926040000_accept_account_venmo_profiles.sql` permits that host in
settings, customer method projection, and intention recording. The checkout
Edge Function retains the account-domain link for the customer handoff.
The SQL fixture now covers this target. Apply the migration and deploy the
matching Edge Function before retesting the Venmo button and handoff.

### Abandoned card checkout and payment-page copy follow-up (2026-09-26)

Stripe's cancel URL now identifies the checkout attempt. Returning through
Stripe Cancel or the browser Back button expires an open Stripe session before
the payment page refreshes. The existing method-choice path also closes an
open session before recording a different method. A completed or provider
processing payment remains protected from switching. The payment chooser no
longer shows the payment-instructions notice, and the reminder notice explains
that the seven-day pause allows the florist to confirm payment. The check
confirmation retains its specific florist instructions.

| Check | Result | Notes |
|---|---|
| Focused payment-page/service Angular suites | PASS, 21/21 | Cancel return, browser Back restore, method choices, and reminder copy. |
| Development build | PASS | Angular browser/server bundles and 24 prerendered routes; placeholder data fetches hit sandbox `EACCES`. |
| Checkout Edge Function syntax | PASS | Parsed locally with esbuild. |
| `git diff --check` | PASS | Line-ending notices only. |
| Live Stripe cancel/Back flow | Not run | Requires deployed Angular/Edge Function and Stripe sandbox. |

Deploy `create-payment-checkout` and Angular together, then verify Stripe
Cancel and browser Back from an unpaid card checkout both restore payment
choices and allow Venmo, cash, or check. Confirm completed card payments still
cannot be switched.
