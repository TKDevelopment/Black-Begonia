# Contract: CRM Ultrawide Layout

## 1. Scope

The contract applies to every routed page rendered inside `PrivateLayoutComponent` at feature approval. It does not apply to public/customer routes, modals, popovers, customer previews, or intentionally focused inner copy/forms.

`PrivateLayoutComponent` remains the owner of navigation width. The available post-navigation width is the routed main element's client width minus its logical inline padding, which currently reserves the fixed sidebar.

## 2. Shared Page Frame

Every routed CRM component has one primary element with:

- class `.crm-page-frame`;
- attribute `data-crm-page-shell`;
- inline size `100%`;
- no arbitrary desktop maximum inline size;
- `min-inline-size: 0` and border-box sizing;
- responsive common inline gutters;
- no page-level horizontal overflow.

The marker is unique within a rendered route and wraps loading, error, empty, authorization-denied, and populated states so all supported states follow the same geometry.

## 3. Route Inventory

| Route pattern(s) | Component family | Current action |
|---|---|---|
| `/admin/dashboard` | Dashboard | Add standard frame around existing placeholder; no dashboard feature work |
| `/admin/leads` | Leads list | Remove 1,880px cap |
| `/admin/leads/:leadId` | Lead detail | Remove 1,880px cap; preserve inner detail/copy sizing |
| `/admin/leads/:leadId/floral-proposal-builder` | Proposal builder | Remove 1,880px cap; let editor/tables use width |
| `/admin/contacts`, `/admin/contacts/:contactId` | Contacts list/detail | Remove both 1,880px branch caps |
| `/admin/organizations`, `/admin/organizations/:organizationId` | Organizations list/detail | Remove both 1,880px branch caps |
| `/admin/catalog-items`, `/admin/catalog-items/:itemId` | Catalog list/detail | Remove both 1,880px branch caps |
| `/admin/tax-regions`, `/admin/tax-regions/:taxRegionId` | Tax list/detail | Remove both 1,880px branch caps |
| `/admin/projects` | Projects list | Remove 1,880px cap |
| `/admin/projects/:projectId` | Project detail | Remove 1,880px cap; preserve fluid main/fixed aside behavior |
| `/admin/projects/:projectId/proposal-revision` | Proposal builder | Same shared builder contract |
| `/admin/payments` | Payments | Remove 1,880px cap |
| `/admin/tasks` | Tasks | Remove 1,880px cap |
| `/admin/workshops` | Workshops list | Remove 1,880px cap |
| `/admin/workshops/new`, `/admin/workshops/:occurrenceId/edit` | Workshop editor | Remove 1,152px cap; review wide form grids |
| `/admin/settings/workshop-privacy-policy` | Workshop retention | Adopt/verify frame; existing root is fluid |
| `/admin/workshops/:occurrenceId/roster` | Workshop roster | Adopt/verify frame; preserve responsive roster/table rules |
| `/admin/workshops/:occurrenceId/financials` | Workshop financials | Remove 1,180px cap; retain focused forms |
| `/admin/workshops/:occurrenceId` | Workshop occurrence detail | Adopt/verify frame; retain focused 38rem form |

`/admin` and `/admin/workshops/privacy-policy` are redirects, not additional visual surfaces. The unrouted private calendar component is outside the approval-time route audit.

## 4. Geometry Acceptance

At 3440-by-1440:

```text
available width = private main client width - inline-start padding - inline-end padding
page-frame ratio = page shell border-box width / available width
page-frame ratio >= 0.90
```

Common page gutters count as intentional space. The shell itself remains full-width within its containing main.

At 1366, 1920, 2560, and 3440 pixels:

```text
document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1px
```

- Every primary action rectangle remains inside the visible main rectangle.
- Primary content overlap and clipping count must be zero.
- Any permitted horizontal overflow must belong to an identified data wrapper whose own rectangle remains inside the page frame.

## 5. Responsive Reflow

- Entity tables remain fluid and use their existing contained overflow wrapper.
- Search/filter controls continue flexing and wrapping at their current breakpoints.
- Entity and project detail shells keep their fixed/bounded aside with fluid `min-width: 0` main area.
- Proposal line/composition/shopping tables consume added width but retain contained overflow when narrow.
- Workshop editor uses added columns only where fields/cards gain operational value; narrative inputs remain comfortably bounded.
- Workshop financial metrics and two-column sections expand without stretching focused data-entry controls across the display.
- Roster, occurrence, and retention grids keep current mobile breakpoints.
- Visual reflow never changes DOM order or keyboard sequence solely to obtain a desired desktop arrangement.

## 6. Intentional Width Limits

Preserve task-specific limits including:

- page-header subtitle/long-form copy widths;
- the roster's readable header copy;
- focused occurrence and financial forms;
- modal/dialog shells;
- workshop customer preview;
- popovers, tooltips, and other overlays.

The implementation must not use a global `max-width: none !important` rule.

## 7. Overflow and Accessibility

- Page-level two-dimensional scrolling is prohibited at audited widths and 200% zoom.
- A table/data region may scroll horizontally if columns cannot remain usable; it must be keyboard reachable and visibly contained.
- Focus rings and focused actions must not be clipped by overflow containers.
- Headings, landmarks, labels, tables, and live loading/error semantics remain intact.
- Light/dark theme contrast and state distinction remain unchanged.
- The page shell marker is for test/audit geometry only and introduces no user tracking.

## 8. Evidence Matrix

For every route family record:

| Field | Required evidence |
|---|---|
| Route and representative record | Exact path or fixture |
| State | Populated plus supported loading/empty/error/authorization-denied states |
| Theme | Light and dark |
| Viewport | 1366, 1920, 2560, 3440-by-1440; mobile smoke at 390-by-844 and 768-by-1024 |
| Page-frame ratio | Required at 3440 |
| Page overflow | Pass/fail with scroll/client widths |
| Primary action visibility | Pass/fail |
| Overlap/clipping | Zero or defect reference |
| Contained data overflow | Wrapper identity and keyboard result, if present |
| 200% zoom | Pass/fail on representative dense routes |

Karma/Jasmine tests assert the common marker and retained contained-overflow structure. Browser/DevTools evidence, not unit tests alone, proves computed geometry.
