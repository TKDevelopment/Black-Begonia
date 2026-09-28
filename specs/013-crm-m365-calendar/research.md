# Research: CRM Calendar and Microsoft 365 Sync

**Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

## Repository findings

- Angular 19 and FullCalendar 6 (`@fullcalendar/angular`, `daygrid`, `list`, `interaction`) are already installed. `src/app/components/private/calendar/` and `dashboard/` are placeholders; neither requires a new UI library. `/admin` already has authentication and internal-user guards, but the guard admits staff as well as administrators.
- `leads.event_date`, `projects.event_date`, and `project_payment_records.due_date` are SQL `date`; `leads.consultation_scheduled_at` is `timestamptz` with no stored end; workshops have `start_at`, `end_at`, `local_start`, `local_end`, and `timezone`. Reuse `src/app/core/utils/date-only.ts` for date-only rendering. Project names require `contacts`, `project_contacts`, and optionally `source_lead_id` joins. The existing lead/project repositories load broad sets and are unsuitable for a month-scoped calendar read.
- Existing named `pg_cron` plus `pg_net` Edge worker calls and Vault-backed scheduler secrets provide a deployment pattern (`supabase/migrations/20260729004400_workshop_scheduled_jobs.sql`). `public.is_internal_crm_user()` admits admin and staff; integration management needs an admin-only server check analogous to `is_workshop_privacy_admin()`.

## Decisions

### 1. Calendar UI and date projection

**Decision**: Use the installed FullCalendar day-grid and list plugins for the full `/admin/calendar` route. Build a small dashboard month component from the same typed, month-bounded calendar data service. Fetch CRM source items through a dedicated server-side date-range projection and load details on item selection from the current source record. A shared SQL title helper produces the five CRM source titles for list, detail, and outbound export; Angular does not reconstruct them.

**Rationale**: This meets month/list, overflow, keyboard, and responsive requirements without adding a dependency. A fresh detail read prevents a stale installment balance. SQL `date` values remain date-only strings; timed events are converted to instants with their recorded timezone. A 60-minute consultation end is display-only.

**Alternatives considered**: Reusing current lead/project repositories would scan full CRM lists and may mutate payment status during reads. Building the full grid from scratch duplicates FullCalendar behavior.

### 2. Microsoft 365 authentication and calendar selection

**Decision**: Use a tenant-owned application identity with Microsoft Graph client credentials, and Exchange Online Application RBAC scoped to the dedicated business mailbox. An administrator chooses one calendar from that mailbox; all CRM users read the same connection. Keep tenant/client credentials in Supabase Edge secrets, and keep the selected mailbox/calendar identity in a server-owned connection row. Preflight must reject an unscoped Entra application permission that would expand mailbox access beyond the Exchange RBAC scope.

**Rationale**: Scheduled sync works without a human refresh token, and mailbox-scoped application access fits one shared business calendar. Staff can view calendar data but cannot connect, select, disconnect, or resolve conflicts. The browser and Netlify SSR never receive Microsoft credentials or a Graph token.

**Alternatives considered**: Delegated OAuth needs an encrypted, rotating refresh token and can lose unattended access when the connecting user leaves or revokes consent. It also complicates shared-calendar notifications. Tenant-wide application permission without mailbox scoping grants excessive access. See [Exchange Application RBAC](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac) and [Microsoft Graph permissions](https://learn.microsoft.com/en-us/graph/permissions-reference).

### 3. Import strategy and 15-minute convergence

**Decision**: Run a named five-minute Supabase scheduled worker, plus administrator-triggered refresh. For the selected mailbox's **primary** calendar, use range-bound `calendarView/delta`, retaining the complete opaque delta link per tracked month. For a selected **secondary** calendar, use paged `/{calendarId}/calendarView` full reconciliation for tracked months because v1 calendar-view delta is documented for the primary calendar only. Schedule the current and adjacent months plus the 12 most recently requested distinct other months within a rolling 30 days (15 total maximum). A service-only SQL command validates and durably queues an on-demand month request without network I/O; the authenticated `requestMonth` Edge action dispatches the worker, and the scheduled job provides fallback. Coalesce duplicate requests, allow at most 24 new distinct month requests per user per rolling hour and three pending on-demand scans per connection, and return a retry time when limited. An evicted month is fetched again when opened and cannot mark its Microsoft items current until a complete fresh import. Expire idle remote-month caches only after a successful fresh scan. Export CRM changes independently of the displayed month. The 15-minute inbound target applies to the bounded scheduled set; outbound applies to all dated CRM sources.

**Rationale**: Five-minute scheduling leaves room for retries under the 15-minute target without relying on notification latency. The explicit 15-month ceiling makes the target testable with 200 items per month while the request limits prevent navigation from building an unbounded Graph backlog. Primary-calendar delta avoids repeated full scans. A month-specific fallback supports the administrator-selected secondary calendar without claiming unsupported Graph delta behavior. A user navigating to an uncached historical/future month gets a fresh bounded range query and a delayed or failed state with Retry after two minutes if it has not completed.

**Alternatives considered**: Graph webhook subscriptions are mailbox-wide and require public validation, renewal, lifecycle handling, and catch-up polling; they do not replace the scheduled reconciliation needed for reliability. Polling every month in an unbounded calendar would waste requests. See [calendar-view delta](https://learn.microsoft.com/en-us/graph/api/event-delta?view=graph-rest-1.0), [calendar view](https://learn.microsoft.com/en-us/graph/api/user-list-calendarview?view=graph-rest-1.0), [change notifications](https://learn.microsoft.com/en-us/graph/outlook-change-notifications-overview), and [throttling guidance](https://learn.microsoft.com/en-us/graph/throttling).

### 4. Outbound projection, identity, and conflicts

**Decision**: Transactional SQL triggers enqueue affected lead, project, consultation, installment, workshop, and title-dependency changes. A single worker lease processes a coalesced outbox. Persist one association per `(source_type, source_id)` and per Graph event. Use `Prefer: IdType="ImmutableId"` consistently, persist an outbound transaction ID before event creation, and compare normalized business fields rather than Graph metadata versions to identify user edits. Do not invite customers. A Graph edit to a CRM-origin mirror creates an administrator-visible conflict and freezes automatic overwrite until the administrator reviews and restores the CRM projection. Microsoft-only events never mutate business tables.

**Rationale**: Transactional enqueue captures deletions and conversions, and idempotent create/retry prevents duplicate mirrors. Comparing title/date/time/location ignores harmless provider metadata updates. CRM remains authoritative as clarified. See [immutable IDs](https://learn.microsoft.com/en-us/graph/outlook-immutable-id), [event properties and transaction ID](https://learn.microsoft.com/en-us/graph/api/resources/event?view=graph-rest-1.0), and [create event](https://learn.microsoft.com/en-us/graph/api/calendar-post-events?view=graph-rest-1.0).

**Alternatives considered**: Updating CRM records from Graph contradicts the clarification and could silently reschedule payments or workshops. Relying only on Graph IDs after a timed-out POST can duplicate events.

### 5. Privacy, timezones, and lifecycle

**Decision**: Store only the imported fields needed to render the calendar. For Graph `sensitivity=private` or `confidential`, replace the subject with `Private event` and drop location and description before persistence or logs; keep only an allowlisted Outlook event link for the requested external-open action. Never store Graph event bodies. A nonprivate Microsoft-only occurrence returned with `isCancelled=true` remains visible but inactive with Canceled status; a private canceled occurrence retains the same label/date/time presentation as any other private occurrence. A tombstone or absence after a complete range scan removes the occurrence. Outbound subjects use the canonical SQL title and contain the requested first names and type/title but no surnames, email, installment amount, payment method, or proposal content. Encode SQL dates as all-day midnight-to-next-midnight in the business timezone and verify the mailbox's supported timezone; preserve workshop instants and named timezone. Retire mirrors for deleted/cleared dates and canceled or superseded CRM commitments. Dated workshop drafts remain CRM-only until publication; completed/archived historical occurrences remain visibly inactive.

**Rationale**: Privacy redaction must happen before the database boundary. Date-only values must not shift during daylight-saving transitions. Inactive items remain available for CRM history without posing as current commitments. Microsoft Graph's event resource exposes `isCancelled`, and calendar-view delta reports additions, updates, and deletions; a completed range reconciliation handles occurrences no longer returned. See [event fields](https://learn.microsoft.com/en-us/graph/api/resources/event?view=graph-rest-1.0), [calendar-view delta](https://learn.microsoft.com/en-us/graph/delta-query-events), and [dateTimeTimeZone](https://learn.microsoft.com/en-us/graph/api/resources/datetimetimezone?view=graph-rest-1.0).

**Alternatives considered**: Converting date-only values to UTC midnight can move them to the previous local day. Exporting drafts makes tentative workshops appear confirmed in Microsoft 365.

### 6. Failure handling and deployment

**Decision**: Persist sync run status, last success, per-item retry state, and safe error codes. Honor Graph `Retry-After`; otherwise apply capped exponential backoff. Keep CRM source reads available if Microsoft is offline. Disconnect stops workers and imports but leaves existing Microsoft mirrors in place with a stale-warning message. Require preflight of Exchange RBAC, Edge secrets, `pg_cron`, `pg_net`, Vault scheduler secret, Graph timezone, and sandbox calendar before enabling sync.

**Rationale**: These are needed to meet outage visibility and convergence goals without discarding CRM dates. No public storage bucket or Netlify secret is needed.

**Alternatives considered**: Deleting mirrors on disconnect contradicts the owner's choice. Immediate retry loops risk Graph throttling. See [Graph throttling](https://learn.microsoft.com/en-us/graph/throttling).
