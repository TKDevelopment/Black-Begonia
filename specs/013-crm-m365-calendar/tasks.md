# Tasks: CRM Calendar and Microsoft 365 Sync

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), and [quickstart.md](./quickstart.md)

**Tests**: The spec and project constitution require focused Karma/Jasmine coverage for changed Angular code and PostgreSQL integration coverage for new SQL, RLS, and data contracts. Edge Functions receive independent type-checking and real Microsoft sandbox smoke validation only. Do not create any automated test or harness that targets, imports, invokes, or simulates an Edge Function.

**Scope**: Authenticated CRM and Supabase backend. Preserve public routes, customer payment/proposal flows, and existing business-record editors. Commit and push actions remain with the human operator.

## Phase 1: Setup

**Purpose**: Establish the brownfield and provider baselines before implementation.

- [X] T001 Confirm the existing `/admin` shell, calendar/dashboard scaffolds, route/sidebar tests, and unaffected public/client routes in `src/app/app.routes.ts`, `src/app/components/private/calendar/calendar.component.ts`, `src/app/components/private/dashboard/dashboard.component.ts`, and `specs/013-crm-m365-calendar/quickstart.md`.
- [X] T002 Confirm the installed FullCalendar packages, Deno/SQL test tooling, and sandbox-only Microsoft mailbox/RBAC prerequisites in `package.json`, `supabase/config.toml`, and `specs/013-crm-m365-calendar/quickstart.md`; record any missing local prerequisite without adding a new UI dependency.

---

## Phase 2: Foundational

**Purpose**: Establish shared calendar types and date rules used by every story.

- [X] T003 [P] Define discriminated calendar item/detail, source identity, range, status, and sync-health types matching `contracts/calendar-api.md` in `src/app/core/models/crm-calendar.ts`.
- [X] T004 [P] Implement business-month bounds, SQL date-only/all-day conversion, exclusive end dates, and DST-safe timed-event formatting using `src/app/core/utils/date-only.ts` in `src/app/core/utils/crm-calendar-date.ts`.
- [X] T005 Add Karma/Jasmine cases for year boundaries, local date-only values, all-day exclusive ends, consultation display duration, and DST transitions in `src/app/core/utils/crm-calendar-date.spec.ts`.

**Checkpoint**: Shared types and date behavior are ready. Do not start story implementation until this phase is complete.

---

## Phase 3: User Story 1 - See the business month at a glance (Priority: P1)

**Goal**: Deliver a useful CRM-only Calendar with all five event types, short box labels and canonical detail titles, month/list navigation, colors, status, overflow, and a basic item detail/source link.

**Independent Test**: Seed a month with dated leads, projects, consultations, installments, and draft/published workshops without connecting Microsoft; verify local dates, short box labels, canonical details, type labels/colors, inactive states, previous/next/Today, list order, and item selection.

### Tests for User Story 1

- [X] T006 [P] [US1] Add SQL integration cases for five source projections, canonical title fallbacks, converted-lead suppression, inactive states, date bounds, and internal-user authorization in `supabase/tests/crm_m365_calendar.sql`.
- [X] T007 [P] [US1] Add Karma/Jasmine month-range, response-error, and typed event loading cases in `src/app/core/supabase/repositories/crm-calendar-repository.service.spec.ts`.
- [X] T008 [P] [US1] Add route and sidebar-order expectations for `/admin/calendar` immediately below Dashboard in `src/app/app.routes.spec.ts` and `src/app/shared/components/private/sidebar/sidebar.component.spec.ts`.
- [X] T009 [P] [US1] Add mapper cases that retain server-provided canonical titles for details, shorten only calendar-box labels, and apply kind colors, text labels, all-day dates, consultation hour, and workshop status in `src/app/core/models/crm-calendar-event.mapper.spec.ts`; canonical title construction is asserted in T006 SQL cases.
- [X] T010 [P] [US1] Add Calendar component cases for Month/List state, year crossing, Today disabled in current month, chronological list, crowded days, late-response cancellation, and basic item click in `src/app/components/private/calendar/calendar.component.spec.ts`.

### Implementation for User Story 1

- [X] T011 [US1] Implement the canonical SQL source-title helper and CRM-only, half-open-range `list_crm_calendar_items` projection across the five source tables with first-name joins, converted-lead suppression, installment statuses, and internal-role check in `supabase/migrations/20260927010000_crm_m365_calendar.sql`.
- [X] T012 [US1] Mirror the source-title helper, list projection, and locked-down execute grants in `supabase/schemas/public/functions/crm_calendar_source_title.sql` and `supabase/schemas/public/functions/list_crm_calendar_items.sql`.
- [X] T013 [US1] Implement bounded range loading and safe error states through Supabase RPC in `src/app/core/supabase/repositories/crm-calendar-repository.service.ts`.
- [X] T014 [US1] Add the lazy `/admin/calendar` route and the sidebar link directly after Dashboard in `src/app/app.routes.ts` and `src/app/shared/components/private/sidebar/sidebar.component.ts`.
- [X] T015 [US1] Implement a typed CRM-to-FullCalendar event adapter with stable IDs, retained canonical title in item data, short event-box label, status, and five non-color type cues in `src/app/core/models/crm-calendar-event.mapper.ts`.
- [X] T016 [US1] Create a basic accessible item dialog with title/date/status and a source-record link in `src/app/components/private/calendar/calendar-item-details-dialog/calendar-item-details-dialog.component.ts`, `.html`, and `.scss`.
- [X] T017 [US1] Replace the calendar scaffold with full-content-width, remaining-viewport-height day-grid/list UI, square SVG previous/next controls, Today, legend, loading/empty/error states, bounded event text, day overflow, and item click in `src/app/components/private/calendar/calendar.component.ts`, `.html`, and `.scss`.
- [ ] T018 [US1] Run the US1 Angular and SQL cases and record the CRM-only seeded-month result in `src/app/components/private/calendar/calendar.component.spec.ts`, `supabase/tests/crm_m365_calendar.sql`, and `specs/013-crm-m365-calendar/quickstart.md`.

**Checkpoint**: User Story 1 works with Microsoft disconnected. Its basic modal is enriched by User Story 2.

---

## Phase 4: User Story 2 - Inspect calendar item details (Priority: P1)

**Goal**: Show current, type-specific modal facts for every CRM item and Microsoft-only items, with correct source links and keyboard focus behavior.

**Independent Test**: Select two items of each type in Month and List; verify current lead/project/workshop/consultation/installment details, current payment amounts, source navigation, Escape/close, and returned focus.

### Tests for User Story 2

- [X] T019 [P] [US2] Add SQL cases for current per-type details, paid/partial installment math, missing/deleted records, and role denial in `supabase/tests/crm_m365_calendar.sql`.
- [X] T020 [P] [US2] Add repository tests for current-detail reads, stale-source `404`, and safe error mapping in `src/app/core/supabase/repositories/crm-calendar-repository.service.spec.ts`.
- [X] T021 [P] [US2] Add dialog tests for required fields per type, private Microsoft redaction, focus trap, Escape, close button, and return focus in `src/app/components/private/calendar/calendar-item-details-dialog/calendar-item-details-dialog.component.spec.ts`.

### Implementation for User Story 2

- [X] T022 [US2] Implement `get_crm_calendar_item_details` as a fresh, authorized read for the five CRM source types, reusing the canonical SQL title helper, in `supabase/migrations/20260927010000_crm_m365_calendar.sql` and `supabase/schemas/public/functions/get_crm_calendar_item_details.sql`.
- [X] T023 [US2] Add the typed details RPC method and current-data error handling in `src/app/core/supabase/repositories/crm-calendar-repository.service.ts`.
- [X] T024 [US2] Expand the dialog with all type-specific fields, installment amounts/status/paid metadata, workshop timezone/venue/capacity, Microsoft open action, and CDK focus handling in `src/app/components/private/calendar/calendar-item-details-dialog/calendar-item-details-dialog.component.ts`, `.html`, and `.scss`.
- [X] T025 [US2] Load details only when an item is selected and handle source changes while the dialog is open in `src/app/components/private/calendar/calendar.component.ts` and `src/app/components/private/calendar/calendar.component.spec.ts`.

**Checkpoint**: Details are live and independently usable without a Microsoft connection; Microsoft-only detail behavior is exercised when Story 3 provides imported items.

---

## Phase 5: User Story 3 - Keep the CRM and Microsoft 365 calendars aligned (Priority: P1)

**Goal**: Export eligible CRM dates, import one selected business calendar, prevent duplicates, flag Graph edits to CRM mirrors, and keep CRM dates visible through provider failures.

**Independent Test**: Connect a sandbox calendar through the admin endpoint; create, change, cancel, delete, and replay applicable events. Verify primary and secondary calendar import paths, recurrence, private-event sanitization, admin conflict review/restore, retry, and last-sync status. Check scheduled convergence in a tracked month and fresh import when opening an untracked month.

### Tests for User Story 3

- [X] T026 [US3] Add PostgreSQL cases for new table constraints, service-only mutations, internal read boundaries, and association uniqueness in `supabase/tests/crm_m365_calendar.sql`.
- [X] T027 [US3] Add PostgreSQL cases for coalesced outbox generations, source deletion tombstones, conversion/reschedule replay, initial requeue, and worker leases in `supabase/tests/crm_m365_calendar.sql`.
- [X] T028 [US3] Add PostgreSQL cases for private-row constraints, canceled nonprivate/private projection, complete-scan deletion rules, delta cursor commits, service-only queue coalescing, the 12-month recent-set and 24-per-user-hour/three-pending limits, delayed/month freshness status, conflict uniqueness/review/restore authorization, and disconnected-cache exclusion in `supabase/tests/crm_m365_calendar.sql`. Test the queue command with no network dispatch, `pg_net`, Edge secret, or Edge endpoint.
- [X] T029 [P] [US3] Add Angular repository, client-service, and component tests for imported-item merge, one linked-item display, month-request loading/delayed/failed/rate-limit/Retry states, last-success/provider failure status, and admin-only conflict review/restore in `src/app/core/supabase/repositories/crm-calendar-repository.service.spec.ts`, `src/app/core/supabase/services/crm-m365-calendar-admin.service.spec.ts`, and `src/app/components/private/calendar/calendar.component.spec.ts`. Stub only the application-owned service/transport boundary; do not call, intercept, mock, or simulate an Edge Function endpoint or handler.

### Implementation for User Story 3

- [X] T030 [US3] Create connection, coalesced outbox, and event-association tables with indexes/RLS in `supabase/migrations/20260927010000_crm_m365_calendar.sql` and matching `supabase/schemas/public/tables/crm_m365_calendar_connections.sql`, `crm_m365_calendar_outbox.sql`, and `crm_m365_event_associations.sql`.
- [X] T031 [US3] Create sanitized imported-occurrence, tracked-month, conflict, and run tables with private-event constraints/RLS in `supabase/migrations/20260927010000_crm_m365_calendar.sql` and matching `supabase/schemas/public/tables/crm_m365_imported_occurrences.sql`, `crm_m365_sync_months.sql`, `crm_m365_sync_conflicts.sql`, and `crm_m365_sync_runs.sql`.
- [X] T032 [US3] Add a server-verifiable admin-only integration role helper and service-only connection/association commands with fixed SQL search paths in `supabase/migrations/20260927010000_crm_m365_calendar.sql` and `supabase/schemas/public/functions/is_calendar_integration_admin.sql`.
- [X] T033 [US3] Add transactional, non-network outbox triggers for date/status/title changes and deletes in `supabase/migrations/20260927010000_crm_m365_calendar.sql` and `supabase/schemas/public/functions/enqueue_crm_calendar_source_change.sql`; mirror trigger declarations in `supabase/schemas/public/tables/leads.sql`, `projects.sql`, `contacts.sql`, `project_contracts.sql`, `project_payment_records.sql`, and `workshop_occurrences.sql`.
- [X] T034 [US3] Implement initial seed, same-calendar reconnect, and new-calendar requeue of all eligible dated source identities in `supabase/migrations/20260927010000_crm_m365_calendar.sql` and `supabase/schemas/public/functions/requeue_crm_calendar_sources.sql`.
- [X] T035 [US3] Implement service-only run leases, outbox generation claims/acks, month scan commits, canonical-title outbound projection, a network-free service-only `queue_crm_calendar_month` command with coalescing and 24-per-user-hour/three-pending limits, a 12-recent-month scheduled selector, month-aware staff-safe `get_crm_calendar_status` with two-minute delayed state, admin-only conflict review/restore commands, and connection-state checks in `supabase/migrations/20260927010000_crm_m365_calendar.sql` and matching `supabase/schemas/public/functions/` definitions including `get_crm_m365_export_projection.sql`, `queue_crm_calendar_month.sql`, `get_crm_calendar_status.sql`, `list_crm_m365_conflicts.sql`, and `restore_crm_m365_conflict.sql`.
- [ ] T036 [US3] Provision or verify the sandbox Microsoft application with Exchange Application RBAC scoped to the business mailbox, exclude additive unscoped calendar grants, configure Edge secrets, and record only non-secret verification in `specs/013-crm-m365-calendar/quickstart.md`.
- [X] T037 [US3] Implement internal-user `requestMonth` with server role verification, queue-command call, immediate secret-protected worker dispatch and durable scheduled fallback on dispatch failure; add admin-only calendar listing, initial connect, conflict review/`restoreConflict` actions, Exchange mailbox-scope preflight, and no browser Graph token in `supabase/edge_functions/crm-m365-calendar-admin/index.ts`; register the standalone entrypoint in `supabase/config.toml`.
- [X] T038 [US3] Implement idempotent Graph export using the canonical title returned by `get_crm_m365_export_projection`, with no attendees/amounts, all-day and timezone mapping, persisted transaction IDs, immutable IDs, and conditional updates in `supabase/edge_functions/crm-m365-calendar-sync/index.ts`; register its standalone entrypoint in `supabase/config.toml`.
- [X] T039 [US3] Implement paged primary-calendar delta and secondary-calendar full range reconciliation, recurring occurrence identity, returned Microsoft-only `isCancelled` as inactive for nonprivate items, completed-scan/tombstone removal, and private/confidential redaction including canceled private items before persistence in `supabase/edge_functions/crm-m365-calendar-sync/index.ts`.
- [X] T040 [US3] Add Graph change detection, administrator conflict creation, admin-requested conditional restoration from the current CRM projection, `412` handling, `Retry-After`/backoff, authorization loss, and safe run counters in `supabase/edge_functions/crm-m365-calendar-sync/index.ts`.
- [X] T041 [US3] Add an idempotent named five-minute `pg_cron`/`pg_net` installer with Vault/Edge preflight and queued-range-request fallback, without activating it before secrets exist, in `supabase/migrations/20260927010000_crm_m365_calendar.sql` and `supabase/schemas/public/functions/install_crm_m365_sync_job.sql`.
- [X] T042 [US3] Extend calendar list and details RPCs to include sanitized Microsoft-only occurrences, show nonprivate canceled items inactive, keep private canceled details redacted, suppress mapped mirrors, and withhold imports after disconnect in `supabase/migrations/20260927010000_crm_m365_calendar.sql`, `supabase/schemas/public/functions/list_crm_calendar_items.sql`, and `supabase/schemas/public/functions/get_crm_calendar_item_details.sql`.
- [X] T043 [US3] Call the internal-user `requestMonth` action through an injected client transport interface when needed, poll month-specific freshness, replace loading with delayed/failed and Retry within two minutes, honor `429` retry time, surface staff-safe last-success/outage and stale states, and provide admin-only conflict review/restore controls while retaining live CRM items in `src/app/core/supabase/repositories/crm-calendar-repository.service.ts`, `src/app/core/supabase/services/crm-m365-calendar-admin.service.ts`, and `src/app/components/private/calendar/calendar.component.ts`, `.html`, and `.spec.ts`.
- [X] T044 [US3] Independently type-check `supabase/edge_functions/crm-m365-calendar-admin/index.ts` and `supabase/edge_functions/crm-m365-calendar-sync/index.ts`; confirm neither imports `_shared`, another Edge Function, or a local shared module and that no automated Edge test was added.
- [ ] T045 [US3] Execute and document real Microsoft sandbox create/update/cancel/delete, all-day/multi-day/recurrence, private and canceled-private events, `requestMonth` Edge dispatch/fallback/rate limit, admin conflict review/restore, and failure smoke scenarios in `specs/013-crm-m365-calendar/quickstart.md`.
- [ ] T046 [US3] Measure 15-minute scheduled convergence for outbound changes in any month and inbound changes across all 15 tracked months at 200 items per month, verify a fresh untracked-month import before Microsoft items are marked current and delayed/failure with Retry by two minutes, and check zero linked duplicates after retry/reopen against `specs/013-crm-m365-calendar/quickstart.md`.

**Checkpoint**: Synchronization works without the Calendar page being open; CRM-only dates survive Graph outages. Administrators can review and restore conflicts, and staff can see safe sync status. Story 6 adds the full connection-management UI.

---

## Phase 6: User Story 4 - Get a quick month preview on Dashboard (Priority: P2)

**Goal**: Show a compact current-month activity view and link into the full calendar without consuming space reserved for later widgets.

**Independent Test**: Load Dashboard with mixed dates and multiple events on one day; verify day indicators, selected-month navigation to the full page, and a compact failure/last-sync state with Microsoft unavailable.

### Tests for User Story 4

- [X] T047 [P] [US4] Add mini-calendar tests for same five-type data, crowded-day indicators, month link, and no unnecessary client/payment details in `src/app/components/private/dashboard/calendar-mini/calendar-mini.component.spec.ts`.
- [X] T048 [P] [US4] Add dashboard tests for current-month load, widget-ready layout, and sync status during outage in `src/app/components/private/dashboard/dashboard.component.spec.ts`.

### Implementation for User Story 4

- [X] T049 [US4] Build the compact month widget from the shared calendar repository, stable item identities, and day-level indicators in `src/app/components/private/dashboard/calendar-mini/calendar-mini.component.ts`, `.html`, and `.scss`.
- [X] T050 [US4] Replace the dashboard placeholder with the mini widget and a full-calendar link that preserves the chosen month in `src/app/components/private/dashboard/dashboard.component.ts`, `.html`, and `.scss`.
- [X] T051 [US4] Check the representative 200-item month renders in under three seconds and record the result in `src/app/components/private/dashboard/dashboard.component.spec.ts` and `specs/013-crm-m365-calendar/quickstart.md`.

**Checkpoint**: Dashboard remains useful with or without a Microsoft connection.

---

## Phase 7: User Story 5 - Read and use the calendar in either theme (Priority: P2)

**Goal**: Make full month/list, detail modal, and mini calendar legible and keyboard reachable in light/dark mode, narrow/wide viewports, and 200% zoom.

**Independent Test**: Audit both themes at 375px, 1366px, and 2560px plus 200% zoom, with keyboard-only navigation; all types remain identifiable without color and dialogs retain/return focus.

### Tests for User Story 5

- [X] T052 [US5] Add focused theme, type-label, focus, and responsive behavior cases in `src/app/components/private/calendar/calendar.component.spec.ts`, `src/app/components/private/calendar/calendar-item-details-dialog/calendar-item-details-dialog.component.spec.ts`, and `src/app/components/private/dashboard/calendar-mini/calendar-mini.component.spec.ts`.

### Implementation for User Story 5

- [X] T053 [P] [US5] Style the full-width day-grid/list body, type chips, legend, focus rings, overflow, and light/dark tokens for narrow/wide screens in `src/app/components/private/calendar/calendar.component.scss`.
- [X] T054 [P] [US5] Style the modal's light/dark surfaces, contrast, scrolling, close control, and CDK focus states in `src/app/components/private/calendar/calendar-item-details-dialog/calendar-item-details-dialog.component.scss`.
- [X] T055 [P] [US5] Style the dashboard mini calendar and widget shell for both CRM themes and 200% zoom in `src/app/components/private/dashboard/calendar-mini/calendar-mini.component.scss` and `src/app/components/private/dashboard/dashboard.component.scss`.
- [X] T056 [US5] Verify `.crm-theme-dark` propagation and non-color type cues across Calendar, modal, and Dashboard in `src/app/components/private/calendar/calendar.component.ts` and `src/app/components/private/dashboard/dashboard.component.ts`.
- [ ] T057 [US5] Document the keyboard/contrast/viewport audit and any fixed defects in `specs/013-crm-m365-calendar/quickstart.md` and the affected calendar/dashboard component styles.

**Checkpoint**: No event meaning or action depends on color alone; all three surfaces work in both themes.

---

## Phase 8: User Story 6 - Manage the connection safely (Priority: P2)

**Goal**: Give administrators explicit selected-calendar, refresh, reconnect, and disconnect controls; consolidate the conflict controls delivered in Story 3 while staff continue to view shared status and calendar data.

**Independent Test**: As admin, select/refresh/disconnect a sandbox calendar, force a provider authorization loss, review and restore a conflicting mirror, and verify existing Graph mirrors remain after disconnect. Repeat controls as staff and expect denial.

### Tests for User Story 6

- [X] T058 [P] [US6] Add SQL cases for admin/staff role separation, one active calendar, reconnection mapping reuse, and disconnect preservation in `supabase/tests/crm_m365_calendar.sql`; Story 3 SQL cases already cover conflict review and restore.
- [X] T059 [P] [US6] Extend Angular admin-control service cases for client-side role denial, refresh polling state, reconnect, and safe error presentation in `src/app/core/supabase/services/crm-m365-calendar-admin.service.spec.ts`; stub only the application-owned transport boundary and never call, intercept, mock, or simulate an Edge Function endpoint or handler.
- [X] T060 [P] [US6] Add connection-panel tests for calendar identity, sync time, busy/error states, conflict restoration, and stale-mirror warning in `src/app/components/private/calendar/calendar-connection-panel/calendar-connection-panel.component.spec.ts`.

### Implementation for User Story 6

- [X] T061 [US6] Implement authorized connection selection/reconnect/disconnect commands in `supabase/migrations/20260927010000_crm_m365_calendar.sql` and `supabase/schemas/public/functions/connect_crm_m365_calendar.sql` plus `disconnect_crm_m365_calendar.sql`; reuse the staff-safe status and conflict commands delivered in T035.
- [X] T062 [US6] Extend the standalone admin function with refresh, reconnect, disconnect, server-side admin checks, and safe error responses in `supabase/edge_functions/crm-m365-calendar-admin/index.ts`; retain Story 3 conflict restoration.
- [X] T063 [US6] Extend the typed admin service from T043 with refresh/reconnect/disconnect calls and manual-run polling without Graph secrets in `src/app/core/supabase/services/crm-m365-calendar-admin.service.ts`.
- [X] T064 [US6] Build and integrate the connection panel with admin-only management controls, the existing conflict review/restore action, and staff-visible health in `src/app/components/private/calendar/calendar-connection-panel/calendar-connection-panel.component.ts`, `.html`, `.scss`, and `src/app/components/private/calendar/calendar.component.html`.
- [ ] T065 [US6] Independently type-check the final `supabase/edge_functions/crm-m365-calendar-admin/index.ts` and document real sandbox role, revoked-access, restore, disconnect, and same-calendar reconnect checks in `specs/013-crm-m365-calendar/quickstart.md`.

**Checkpoint**: One selected business calendar is shared; disconnection leaves CRM records and existing Microsoft mirrors intact with a clear stale warning.

---

## Phase 9: Polish and Cross-Cutting Validation

- [ ] T066 Run the full focused SQL suite, fix migration/declarative drift, and record replay/RLS/privacy results in `supabase/tests/crm_m365_calendar.sql` and `specs/013-crm-m365-calendar/quickstart.md`.
- [X] T067 Run focused Karma/Jasmine coverage for all changed calendar, dashboard, sidebar, route, repository, utility, and admin-service specs, confirm their application-level stubs never call, intercept, mock, or simulate an Edge endpoint/handler, and record the coverage impact toward 80% in `specs/013-crm-m365-calendar/quickstart.md`.
- [X] T068 Run the Angular production build and inspect `/admin/calendar` lazy route plus unchanged public/client route metadata in `src/app/app.routes.ts` and `specs/013-crm-m365-calendar/quickstart.md`.
- [X] T069 Audit RLS/grants, Graph mailbox scoping, private-event storage, outbound payload minimization, Edge secrets, and absence of automated Edge tests in `supabase/migrations/20260927010000_crm_m365_calendar.sql`, `supabase/edge_functions/crm-m365-calendar-admin/index.ts`, `supabase/edge_functions/crm-m365-calendar-sync/index.ts`, and `specs/013-crm-m365-calendar/quickstart.md`.
- [ ] T070 Complete the sandbox and performance matrix for the full 15-month tracked set at 200 items per month, 15-minute convergence, two-minute manual refresh and on-demand delayed/failed feedback, `requestMonth` dispatch/fallback/rate-limit/Retry, recurrence, conflict, disconnect, and outage in `specs/013-crm-m365-calendar/quickstart.md`.
- [X] T071 Document SQL-before-Edge-before-UI deployment, named-job activation, required secrets/RBAC, initial backfill, and disconnect-based rollback in `specs/013-crm-m365-calendar/quickstart.md` and `README.md`.
- [X] T072 Verify unchanged lead/project/payment/workshop editors, proposal/manual Canva PDF path, and public/client routes against `specs/013-crm-m365-calendar/plan.md`; leave commit and push to the human operator.
- [X] T073 Apply the 2026-09-28 calendar presentation refinements: fill remaining viewport height, shorten only event-box labels, clip long titles, use a brighter light-mode lead yellow, center SVG chevrons in square buttons, and verify focused browser tests in `src/app/components/private/calendar/`, `src/app/core/models/crm-calendar-event.mapper.ts`, and `specs/013-crm-m365-calendar/quickstart.md`.

---

## Dependencies and Execution Order

```text
Setup (T001-T002)
  -> Foundation (T003-T005)
  -> US1 CRM-only calendar (T006-T018)
       -> US2 detailed modal (T019-T025)
       -> US3 Microsoft sync (T026-T046)
       -> US4 dashboard mini calendar (T047-T051)
  -> US5 theme/accessibility (T052-T057) after US2 and US4
  -> US6 connection controls (T058-T065) after US3
  -> Polish (T066-T072) after all chosen stories
```

US2 and the Edge/SQL portions of US3 can progress after US1 on disjoint files, but edits to the single migration and calendar repository must be serialized. US4 can begin after US1. Story tests can be authored before their implementations. The `20260927010000` migration is applied once as a complete release artifact; its additions across story phases are development increments, not separate production migrations.

## Parallel Execution Examples

- **US1**: After T003-T005, write `supabase/tests/crm_m365_calendar.sql` cases (T006), `crm-calendar-repository.service.spec.ts` (T007), route/sidebar specs (T008), and mapper specs (T009) in separate files. Serialize migration, repository, and page edits.
- **US2**: Write details SQL cases (T019) and dialog Jasmine cases (T021) in separate files; merge them before T022/T024 implementation.
- **US3**: Once integration table contracts exist, develop Graph worker logic in `crm-m365-calendar-sync/index.ts` (T038-T040) while Angular status tests are written in `crm-calendar-repository.service.spec.ts` (T029). Keep all edits to the migration sequential.
- **US4**: Write mini-widget specs (T047) and Dashboard specs (T048) in separate files, then implement the widget and host.
- **US5**: After the component behavior is stable, calendar (T053), modal (T054), and mini/dashboard (T055) styles can be tuned in separate files.
- **US6**: SQL authorization tests (T058), admin-service specs (T059), and panel specs (T060) touch separate files and can be prepared together.

## Implementation Strategy

**MVP first**: Complete Setup, Foundation, and US1. This yields a useful five-type CRM calendar with no Microsoft dependency. Then complete US2 for current details and US3 for bidirectional calendar visibility, authoritative CRM mirrors, staff-safe status, and administrator conflict review/restore. Add Dashboard (US4), theme/accessibility polish (US5), and broader connection controls (US6). Release only after Phase 9 checks and real Microsoft sandbox validation; keep the production connection inactive until mailbox RBAC, Edge secrets, and scheduler preflight pass.

**Constraints carried through every phase**: No change to business source dates from Microsoft edits; no workshop draft export; no private Microsoft subject/location/body persistence; no customer invitations or installment amounts in outbound events; no service key in Angular; no `_shared` Edge code or automated Edge Function tests; no agent commit or push.

