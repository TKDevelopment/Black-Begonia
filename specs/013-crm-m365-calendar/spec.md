# Feature Specification: CRM Calendar and Microsoft 365 Sync

**Feature Branch**: 013-crm-m365-calendar
**Created**: 2026-09-27
**Updated**: 2026-09-27
**Status**: Draft
**Input**: User description: Add a full-width Admin CRM calendar and dashboard mini calendar showing dated leads, projects, consultations, installments, and workshop occurrences, with Microsoft 365 calendar sync, prescribed item titles, and themed item details modals.

## Clarifications

### Session 2026-09-27

- Q: What happens when someone edits a CRM-linked event in Microsoft 365? → A: CRM records stay authoritative; flag the conflict for administrator review, then restore the Microsoft 365 mirror from the CRM record.
- Q: How many Microsoft 365 calendars should the CRM connect to? → A: One administrator-selected business calendar shared by authorized CRM users.
- Q: Should dated draft workshop occurrences sync to Microsoft 365 before publication? → A: No; show drafts in the CRM for planning and begin Microsoft 365 sync when the occurrence is published.
- Q: What happens to CRM-created Microsoft 365 events when the calendar is disconnected? → A: Leave existing mirrors in Microsoft 365, stop updating them, and warn that they may become stale.
- Q: What should authorized CRM users see for a private Microsoft 365 event? → A: Show "Private event" and its date/time only; do not show its subject, location, or description in the CRM.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the business month at a glance (Priority: P1)

As the florist, I can open Calendar immediately below Dashboard in the CRM navigation and see all relevant work for the displayed month, so I can plan around client events, consultations, installments, and workshops.

**Why this priority**: A trustworthy month view is the feature's main daily use.

**Independent Test**: Populate all five CRM date types in one month, open Calendar, and verify placement, short box labels, canonical detail titles, colors, and navigation without connecting Microsoft 365.

**Acceptance Scenarios**:

1. **Given** dated leads, projects, consultations, installments, and workshop occurrences, **when** the florist opens Calendar, **then** each appears on the correct date with its type label and color: yellow, blue, purple, green, and red respectively.
2. **Given** the florist views another month, **when** they select Today, **then** the current month appears; Today is disabled while the current month is displayed.
3. **Given** the florist switches between Month and List, **when** the view changes, **then** the selected month stays the same and the list is ordered by date and time.
4. **Given** a calendar item linked to a CRM record, **when** the florist selects it, **then** its details modal opens and offers a link to the matching lead, project, consultation context, installment, or workshop record.

---

### User Story 2 - Inspect calendar item details (Priority: P1)

As the florist, I can open an item details modal from the month or list view, so I can confirm key details before following a link to the source record.

**Why this priority**: The calendar title is intentionally short; planning decisions require date, location, status, and installment context.

**Independent Test**: Select one item of each CRM type from both views and verify the modal content, source link, close behavior, and keyboard focus.

**Acceptance Scenarios**:

1. **Given** a lead or project event, **when** it is selected, **then** the modal shows the client names, service type, event date, current status, and available venue details.
2. **Given** a workshop occurrence, **when** it is selected, **then** the modal shows its title, start and end, timezone, venue, capacity, and current lifecycle status.
3. **Given** an installment due date, **when** it is selected, **then** the modal shows its title, due date, amount due, amount paid, outstanding balance, and current status.
4. **Given** a consultation, **when** it is selected, **then** the modal shows the client names, scheduled time, and a link to the lead.
5. **Given** either CRM theme, **when** the modal opens and closes by keyboard or pointer, **then** content remains legible, focus enters the modal, and focus returns to the selected calendar item after closing.
6. **Given** an ordinary Microsoft 365 event, **when** it is selected, **then** the modal shows its permitted title, time, and location and offers an action to open it in Microsoft 365.
7. **Given** a private Microsoft 365 event, **when** it appears in Month, List, or its details modal, **then** the CRM shows "Private event" and its date/time without its subject, location, or description; Dashboard may show only a day-level activity indicator.

---

### User Story 3 - Keep the CRM and Microsoft 365 calendars aligned (Priority: P1)

As the florist, I can connect the business Microsoft 365 calendar and see CRM dates there while seeing that calendar's events in the CRM, so neither planning view omits commitments.

**Why this priority**: The calendar must be reliable across the two places the florist works.

**Independent Test**: Connect a test business calendar, create or change one event in each direction, cancel or remove a Microsoft event, and confirm that the other calendar converges without duplicate entries. Edit a CRM mirror in Microsoft 365, then review and restore it as an administrator. Check scheduled convergence in a tracked month and open an untracked month to verify its initial import before its Microsoft items are marked current.

**Acceptance Scenarios**:

1. **Given** a connected business calendar, **when** a qualifying CRM date is created, changed, or removed, **then** its corresponding Microsoft 365 event is created, updated, or removed.
2. **Given** a connected business calendar, **when** an ordinary Microsoft 365 event is created, changed, canceled, or deleted, **then** the CRM calendar reflects that change in the relevant month without creating a lead, project, consultation, installment, or workshop. A nonprivate occurrence returned as canceled remains visible with an inactive Canceled status; a deleted occurrence or one absent after a complete range scan is removed. Private occurrences retain their privacy redaction even when canceled.
3. **Given** a CRM-origin event already mirrored to Microsoft 365, **when** it is encountered during import, **then** the CRM displays one item rather than an imported duplicate.
4. **Given** an interrupted connection or provider outage, **when** the florist opens Calendar, **then** locally available CRM items remain visible and the page shows the last successful sync and a useful connection status.
5. **Given** someone edits a CRM-linked event in Microsoft 365, **when** sync detects the difference, **then** the linked CRM record remains unchanged, an administrator can review the conflict, and the Microsoft 365 mirror is restored from the CRM record after review.
6. **Given** an administrator has selected the business calendar, **when** any authorized CRM user opens Calendar, **then** they see items from that same connected calendar.
7. **Given** a month outside the scheduled tracking set, **when** an authorized user opens it while the connection is healthy, **then** the CRM requests a complete import for that month, shows loading rather than treating old Microsoft items as current, and marks the month current only after the import succeeds. If the import has not completed within two minutes, the page replaces the loading state with a clear delayed or failed status and a Retry action; CRM dates remain visible.
8. **Given** many distinct months are requested, **when** the scheduled set reaches its limit, **then** the current and adjacent months stay scheduled, the 12 most recently requested other months remain scheduled, and an older requested month is refreshed on demand when reopened. A rate-limited request gives the user a retry time without hiding CRM dates.

---

### User Story 4 - Get a quick month preview on Dashboard (Priority: P2)

As the florist, I can see a compact calendar on Dashboard and open the full Calendar for details, so I can review the month without changing pages first.

**Why this priority**: The dashboard needs an immediately useful summary while remaining open to later widgets.

**Independent Test**: Open Dashboard with mixed calendar items, confirm correct day indicators and a link into the full calendar, and compare its month with the full view.

**Acceptance Scenarios**:

1. **Given** several items on the same day, **when** Dashboard loads, **then** its compact month view indicates that day's activity without clipping or exposing unnecessary client details.
2. **Given** a day or month in the mini calendar, **when** the florist opens the full calendar, **then** the relevant month is displayed.
3. **Given** the Microsoft 365 connection is unavailable, **when** Dashboard loads, **then** CRM dates still appear and a compact sync status is available.

---

### User Story 5 - Read and use the calendar in either theme (Priority: P2)

As the florist, I can use the full Calendar, item details modal, and mini calendar in light or dark mode and at desktop or mobile sizes without losing event meaning.

**Why this priority**: The CRM already offers two themes and multiple viewport sizes.

**Independent Test**: Review Month, List, item details, and Dashboard mini calendar in light and dark themes at narrow and wide widths, using keyboard navigation and 200% zoom.

**Acceptance Scenarios**:

1. **Given** either CRM theme, **when** Calendar, its details modal, or Dashboard renders, **then** the calendar body, all event types, controls, focus states, modal fields, and status messages remain legible.
2. **Given** colors are hard to distinguish, **when** the florist reads an event or legend, **then** the type is still identifiable by text or another non-color cue.
3. **Given** a wide desktop viewport, **when** Calendar opens, **then** its month or list view uses the full available CRM content area beside the existing sidebar.

---

### User Story 6 - Manage the connection safely (Priority: P2)

As an authorized CRM administrator, I can connect, review, refresh, and disconnect the selected business calendar, so I can correct access problems without risking CRM records.

**Why this priority**: Synchronization needs visible ownership and recoverable failures.

**Independent Test**: Connect and disconnect a test calendar, force an expired authorization or provider error, and verify clear status, recovery action, and preserved CRM data.

**Acceptance Scenarios**:

1. **Given** no connected calendar, **when** the administrator opens Calendar, **then** CRM dates still work and a connection action is available.
2. **Given** a connected calendar, **when** the administrator requests a refresh, **then** the page reports progress and its most recent successful sync.
3. **Given** authorization is revoked, **when** sync next runs, **then** the page requests reconnection and does not erase CRM records or falsely claim that events are current.
4. **Given** the administrator disconnects, **when** they return to Calendar, **then** Microsoft 365 imports and exports stop while CRM source records remain intact.
5. **Given** CRM-created mirrored events exist, **when** the administrator disconnects, **then** those events remain in Microsoft 365 and the CRM warns that they will no longer update.

### Edge Cases

- A lead becomes a project for the same event date: the calendar must avoid showing two active CRM event entries or leaving an obsolete Microsoft 365 mirror.
- A project has no linked lead or partner name, or a lead has no partner: titles must use a real available name without an empty ampersand or placeholder text.
- A workshop is drafted, published, rescheduled, canceled, completed, or archived: its visible status and mirrored event must reflect the current occurrence, and a replacement occurrence must not create a misleading duplicate active workshop.
- A dated draft workshop appears in the CRM calendar but has no Microsoft 365 mirror until publication; publication creates the mirror without duplicating the CRM item.
- A record has no date, an invalid date, or a cleared date: no undated placeholder appears; an existing mirror is retired when the date is cleared.
- Consultation timestamps span a daylight-saving transition; all-day event dates must not move to an adjacent day because of timezone conversion.
- An installment is partially paid, fully paid, canceled, waived, or rescheduled: its calendar status and Microsoft 365 mirror must match the current obligation without changing payment amounts.
- Microsoft 365 events may be all-day, multi-day, recurring, moved, canceled, private, or deleted; month and list views must represent each visible occurrence accurately and respect privacy flags. A nonprivate canceled occurrence returned by Microsoft is inactive; private occurrences retain their redaction. A deletion or absence after a completed scan removes it.
- A sync is repeated after a timeout, or the same item changes in both systems before the next refresh: the result must be stable, avoid duplicate entries, and identify unresolved conflicts rather than silently overwrite business-critical dates.
- A month has more items than fit in one cell or a small screen: all items remain reachable from the day or list view.
- Switching month or view during a refresh must not replace the visible month with stale results.
- A record changes or is deleted while its details modal is open: the modal must refresh or close with a clear message rather than display stale financial or event information as current.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Admin CRM MUST provide a Calendar navigation item directly below Dashboard and a dedicated Calendar screen within the existing authenticated CRM shell.
- **FR-002**: The Calendar screen MUST use the full available CRM content width and remaining viewport height beside the sidebar and below the fixed mobile header, with a monthly grid as its default view. The grid MUST stretch to the bottom of the page when there is spare vertical space.
- **FR-003**: The Calendar screen MUST provide a list view for the selected month, ordered chronologically, and preserve the selected month when switching views.
- **FR-004**: The Calendar screen MUST provide previous-month and next-month controls that work across year boundaries. Their arrow controls MUST use centered SVG chevrons inside square buttons.
- **FR-005**: The Calendar screen MUST provide a Today control that returns to the current month and is enabled only when another month is displayed.
- **FR-006**: The calendar MUST show a clear date, short display title, type, and relevant status for each item, except private Microsoft 365 items, which MUST show only "Private event" and date/time as required by FR-026. CRM event boxes MUST omit the final " - {service, installment, or item type}" suffix while retaining the canonical title in item details and Microsoft export. Text MUST remain inside its event box with ellipsis when needed. An accessible way to reach additional items when a day is crowded MUST remain available.
- **FR-007**: Lead event dates MUST be yellow, project event dates blue, client consultations purple, installment due dates green, and workshop occurrences red; a visible legend and text labels MUST convey the same meaning without relying on color alone. Lead items and their legend marker MUST use a brighter yellow with dark readable text in light mode.
- **FR-008**: Microsoft 365-only events MUST have a distinct, non-conflicting visual treatment and a Microsoft 365 source label, except private occurrences, which MUST use the neutral visual treatment without an additional source/type/status text label under FR-026.
- **FR-009**: Lead and project event dates and installment due dates MUST be treated as all-day dates; consultations MUST retain their scheduled time in the business timezone, and workshop occurrences MUST retain their saved start, end, and timezone.
- **FR-010**: A consultation with a start time but no stored end time MUST display with a 60-minute planning duration; this display convention MUST NOT alter the lead's saved consultation timestamp.
- **FR-011**: Selecting any calendar item in Month or List MUST first open an item details modal. The modal MUST offer a link to the matching CRM record or installment section for CRM-derived items, or an external open action for Microsoft 365-only items.
- **FR-012**: A converted lead's event MUST be replaced by its project event. Clearing or deleting a source date MUST remove its calendar item and Microsoft 365 mirror. Declined leads and canceled projects MUST show an inactive status instead of appearing as current commitments.
- **FR-013**: Installments with due dates MUST show whether they are unpaid, partially paid, or paid; canceled and waived installments MUST not appear as payable.
- **FR-014**: The CRM MUST allow an integration administrator to connect one selected Microsoft 365 business calendar at a time, identify that calendar, and use that same connection for every authorized CRM user's calendar view.
- **FR-015**: The CRM MUST create, update, and retire corresponding Microsoft 365 events when eligible CRM source dates among the five included types change, without sending customer invitations automatically. Draft workshop occurrences are not eligible for export until published.
- **FR-016**: The CRM MUST import all visible events from the selected Microsoft 365 calendar for the displayed date range, including all-day, multi-day, recurring, canceled, and private occurrences, and apply later edits and deletions. A nonprivate occurrence returned as canceled MUST remain visible with an inactive Canceled status; a deleted occurrence or one absent after a completed range scan MUST be removed. Private occurrences MUST expose only their date/time and a "Private event" label in the CRM, including when canceled. While healthy, a month outside the scheduled tracking set MUST complete a fresh import before its Microsoft items are presented as current. The CRM MUST show a delayed or failed state with a Retry action if that import has not completed within two minutes; Microsoft items remain marked stale or loading until a complete scan succeeds.
- **FR-017**: A Microsoft 365-only event MUST appear as a calendar item without creating or modifying an unrelated CRM business record.
- **FR-018**: Each linked CRM/Microsoft 365 pair MUST appear once in the CRM and remain associated across repeated syncs, retries, and source updates.
- **FR-019**: CRM business records MUST remain authoritative for their linked event dates and other CRM-derived event details. A Microsoft 365 edit to a mirrored CRM event MUST NOT change the linked CRM record; it MUST be flagged for administrator review before the Microsoft 365 mirror is restored from the CRM record. Microsoft 365-only events remain owned by Microsoft 365.
- **FR-020**: Sync failures, authorization loss, and unresolved conflicts MUST be visible to administrators with the last successful sync time and a recovery or reconnect action; existing CRM dates MUST remain usable during the failure.
- **FR-021**: An administrator MUST be able to request a refresh; routine changes MUST synchronize automatically without requiring the Calendar page to be open.
- **FR-022**: Disconnecting Microsoft 365 MUST stop future imports and exports while preserving CRM records and existing CRM-created Microsoft 365 events. The CRM MUST warn that those Microsoft 365 events will no longer update and may become stale.
- **FR-023**: Dashboard MUST contain a compact month rendition of the same five-type calendar data, with day-level activity indicators and a path to the full Calendar; the dashboard layout MUST leave room for separately specified future widgets.
- **FR-024**: The full calendar body, calendar items, item details modal, and dashboard mini calendar MUST follow the CRM light and dark themes, work with keyboard navigation and 200% zoom, and maintain readable item contrast.
- **FR-025**: Calendar data and connection controls MUST be restricted to authorized internal CRM users; only administrators authorized to manage integrations may connect or disconnect the Microsoft 365 calendar.
- **FR-026**: Sync MUST minimize customer and financial data sent to Microsoft 365. Microsoft 365 private events MUST display only "Private event" and date/time in the full calendar and details modal, while the mini calendar MAY show only a day-level activity indicator; their subject, location, and description MUST NOT be shown or stored as CRM event details.
- **FR-027**: The calendar MUST distinguish a source record's date from the current date and preserve date-only values across timezone and daylight-saving changes.
- **FR-028**: Canonical lead and project titles for details and Microsoft export MUST use "{Client first name} & {Partner first name} - {Service Type}" when both names exist. The service type MUST be a readable label. If the partner first name is absent, the title MUST omit the ampersand and use "{Client first name} - {Service Type}". If a project has no usable linked client first name, it MUST use its saved project name before the service type rather than show an empty name. Calendar boxes display only the name portion.
- **FR-029**: Canonical consultation titles MUST use "{Client first name} & {Partner first name} - Consultation" with the same absent-partner fallback. Canonical workshop titles MUST use "{Workshop title} - Workshop". Calendar boxes display only the name or workshop-title portion.
- **FR-030**: Canonical installment titles MUST use "{Client first name} & {Partner first name} - {Installment title}" with the same absent-partner and project-name fallbacks. The installment title MUST be a readable Deposit, Final Payment, or Revision Balance label derived from its payment kind. Calendar boxes display only the name portion.
- **FR-031**: Lead and project modals MUST show names, service type, event date, status, available venue and guest-count details, and a source-record link. Workshop modals MUST show title, start and end with timezone, venue/address, capacity, lifecycle status, and a source-record link. Consultation modals MUST show names, scheduled time, status, and a lead link. Microsoft 365-only modals MUST show permitted title, date/time, location when not private, and an external open action; private event modals MUST show only "Private event" and date/time as event details.
- **FR-032**: Installment modals MUST show title, due date, total amount due, amount paid, outstanding balance, payment status, and a link to the project installment record; paid date and payment method MUST appear when recorded. Amounts and status MUST reflect the current obligation when the modal opens.
- **FR-033**: Every details modal MUST have an accessible title and close control, support Escape, keep keyboard focus inside while open, return focus to the triggering item on close, and remain usable in both themes and narrow viewports.
- **FR-034**: Workshop occurrences MUST appear in the CRM at their saved local start/end times, including dated drafts. A draft MUST have no Microsoft 365 mirror until publication; a published occurrence MUST begin syncing at its saved local start/end times. Draft, published, closed, canceled, rescheduled, completed, and archived states MUST be distinguishable; canceled or superseded occurrences MUST not appear as active commitments.

### Constitution Alignment *(mandatory)*

- **Surface**: This feature changes the authenticated CRM calendar, dashboard, navigation, and calendar sync backend. It does not change the public website, client payment flow, or proposal access pages.
- **Product Owner Approval**: The request authorizes the CRM calendar and dashboard changes. Public website content, styling, SEO, routing, and forms remain outside scope.
- **Brownfield Preservation**: Existing lead, project, consultation, installment, payment, proposal, workshop occurrence, CRM theme, and navigation workflows remain the sources of truth. Calendar and its details modal are planning and navigation views; changing business dates, workshop schedules, or payment balances continues through their existing workflows.
- **Supabase Security**: Existing lead, project, workshop occurrence, and payment tables retain their authorization boundaries. Any new connection, link, imported-event, or sync-status records require explicit internal-user and integration-administrator access rules. Microsoft credentials and sync secrets stay server-side; no new public storage bucket is needed.
- **Schema Migration**: Planning must identify executable migrations and matching declarative definitions for every new or changed table, preserve existing data, and state deployment order.
- **Standalone Edge Functions**: Any sync functions must deploy independently with their own logic and without shared local edge-function modules. No automated tests may target, import, invoke, or simulate an Edge Function.
- **Testing Expectations**: Focused Angular tests must cover month/list controls, five-type event projection, short box labels with canonical detail titles, modal details and keyboard behavior, dashboard summary, navigation, themes, permissions, and failure states. PostgreSQL integration tests must cover date projection and canonical title fallbacks, workshop status and rescheduling, installment detail accuracy, sync associations, duplicate prevention, status changes, and authorization. Each affected Edge Function requires standalone type-checking and documented Microsoft 365 sandbox smoke validation instead of automated Edge Function tests.
- **Sensitive Data**: Sync must not send proposal PDFs, signatures, passcodes, email bodies, full payment records, or credentials to Microsoft 365. Synced titles may contain the requested client and partner first names, but no last names or installment amounts. The dashboard mini calendar must avoid unnecessary client or payment detail; the full details modal is restricted to authorized internal users.
- **Proposal Workflow**: Invoice/planning data, manual Canva PDF upload, and payment reconciliation are preserved; the calendar reads dates and installment states without altering those workflows.
- **Git Publication**: AI agents do not commit or push. The human operator owns branch publication and deployment.

### Key Entities *(include if feature involves data)*

- **Calendar item**: A displayable occurrence with source type, source identity, formatted title, start/end or all-day date, status, visual type, and destination.
- **CRM source record**: A lead, project, scheduled consultation, payment installment, or workshop occurrence whose saved date produces a calendar item.
- **Calendar item details**: The current permitted event or payment facts shown when an item is selected, including a destination to the source record.
- **Microsoft 365 connection**: The authorized business calendar identity, connection health, and last successful sync information.
- **Sync association**: The durable relationship and state between one CRM source item and its Microsoft 365 counterpart, used to avoid duplicates and surface conflicts.
- **Imported Microsoft 365 occurrence**: An event or recurrence instance from the selected business calendar that has no CRM business record.
- **Calendar view state**: The selected month, Month/List mode, and any day-level overflow or detail selection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a seeded month containing all five CRM source types, 100% of dated eligible records appear on the correct local date with the required short box label, canonical detail title, type labels, and colors; converted leads and rescheduled workshops produce no duplicate active event.
- **SC-002**: At least 95% of normal CRM-to-Microsoft 365 changes, regardless of event month, and Microsoft 365-to-CRM changes in scheduled tracked months appear in the other calendar within 15 minutes while the connection is healthy. Scheduled tracked months are the current month, adjacent months, and at most 12 other distinct months most recently requested in the past 30 days; the 15-minute result is measured with this full 15-month set and a representative 200 items per month. An untracked month starts a fresh import when opened, never presents its Microsoft items as current before a complete scan, and shows a delayed or failed state with Retry within 2 minutes if the scan has not completed. An administrator-requested refresh completes or reports a clear failure within 2 minutes.
- **SC-003**: Replaying the same sync or reopening a month produces zero duplicate calendar entries for the same linked source item.
- **SC-004**: A florist can reach an adjacent month in one action, switch to List in one action, and return to the current month in one action.
- **SC-005**: In light and dark themes at 375px, 1366px, and 2560px widths and 200% zoom, the calendar body, all five event types, primary controls, and details modal remain readable and keyboard reachable.
- **SC-006**: In a provider outage test, 100% of locally available CRM items remain visible, and the last successful sync and failure state are apparent on both Calendar and Dashboard.
- **SC-007**: The dashboard mini calendar loads the current month's activity within 3 seconds for a representative month of 200 combined items under normal connection conditions.
- **SC-008**: In a seeded review of at least two items per CRM type, 100% of item clicks open a modal with the type's required current fields, and 100% of keyboard closures return focus to the triggering item.
- **SC-009**: In a seeded review of private Microsoft 365 events, 100% appear as "Private event" with date/time in Month, List, and details modal, while Dashboard shows at most a day-level activity indicator; none expose their subject, location, or description.

## Assumptions

- The initial release serves one selected business Microsoft 365 calendar shared by authorized CRM users; it does not connect separate personal calendars for individual CRM users.
- Five CRM event types are in scope: lead event dates, project event dates, consultations, installment due dates, and workshop occurrences. Task due dates are a recommended later addition.
- Workshop occurrences use their saved title, time span, venue, and lifecycle status; dated drafts and inactive occurrences remain visible for internal planning but are clearly marked as such. Drafts remain CRM-only until publication.
- Lead partner first names are optional. Projects and installments derive first names from their linked contact and source lead where available; a saved project name is the fallback when no linked first name exists. The existing payment kind supplies the installment title.
- Workshops use red, the color previously assigned to consultations; consultations use purple. Microsoft 365-only events retain a separate neutral treatment.
- CRM records own lead, project, consultation, installment, and workshop dates; Microsoft 365 owns ordinary events created there. The calendar itself is a planning and navigation surface, not an alternate editor for financial obligations, workshop schedules, or project dates.
- Consultation planning duration is one hour when only a scheduled start is stored. Date-only event and installment dates are all-day in the business timezone.
- Microsoft 365 access and consent must be provided by the business account or tenant administrator; without a connection, the CRM-only calendar remains useful.
- Dashboard scope is the mini calendar and a responsive widget-ready layout. Other widgets will be defined in later feature work.

## Recommended Future Calendar Items

- **Task due dates**: Existing CRM tasks have due timestamps and could become a sixth type, useful for day-to-day workload planning.

