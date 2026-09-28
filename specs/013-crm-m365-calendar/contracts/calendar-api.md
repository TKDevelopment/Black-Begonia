# Contract: CRM Calendar Reads and Controls

**Consumers**: authenticated Admin CRM calendar and dashboard. **Backend**: Supabase RPC plus `crm-m365-calendar-admin` Edge Function. Names below are the planned implementation contract; changes require updating the plan, SQL tests, and Angular types together.

## `list_crm_calendar_items(p_start_date date, p_end_date date)`

Authenticated internal-user RPC. Inclusive start/exclusive end in business local dates. Reject a nonpositive or excessively broad range; the UI requests only the visible month grid (including spillover days). Returns a JSON array of both live CRM projections and sanitized Microsoft-only cached occurrences. CRM records remain available when Microsoft is disconnected or unhealthy; cached Microsoft-only occurrences are marked stale during provider outage and withheld after explicit disconnect.

```json
{
  "id": "project_event:uuid-or-m365:connection-id:event-id",
  "sourceType": "lead_event | project_event | consultation | installment | workshop | microsoft",
  "sourceId": "uuid-or-null",
  "title": "First & Partner - Service Type",
  "start": "2026-10-17 or 2026-10-17T14:00:00Z",
  "end": "2026-10-18 or 2026-10-17T15:00:00Z",
  "allDay": true,
  "localDate": "2026-10-17",
  "status": "human-readable source status",
  "isInactive": false,
  "colorType": "lead | project | consultation | installment | workshop | microsoft",
  "destination": "/admin/projects/uuid or null"
}
```

`end` is exclusive for all-day items. The SQL source-title helper supplies the canonical `title` for every CRM item. The browser keeps that title for details and Microsoft export, but removes the final service/installment/type suffix in the calendar box to prevent overflow; it retains the source type text chip. Microsoft-only titles remain unchanged. The browser maps `colorType` to yellow, blue, purple, green, red, or neutral with a type label, with brighter yellow and dark text for leads in light mode. A nonprivate Microsoft-only item returned canceled has `status="Canceled"` and `isInactive=true`. A private Microsoft occurrence returns `title="Private event"`, `status=null`, `isInactive=false`, and date/time only as event details, even when canceled; the browser uses neutral styling without rendering a separate source/type/status label. Do not expose its provider status, location, or confidential text. Do not put payment amounts in the list response. An item key is stable across month/list/dashboard and repeated sync.

## `get_crm_calendar_item_details(p_source_type text, p_source_id text)`

Authenticated internal-user RPC. Re-read the current source row when the modal opens; return `not_found` if it was removed. CRM details reuse the SQL source-title helper used by the list and outbound projection. For Microsoft-only items, use the sanitized cache or refresh the requested occurrence if the cache is stale. Response is a discriminated union with common `id`, `sourceType`, `title`, `start`, `end`, `status`, `destination` fields, except that private Microsoft items omit event details beyond their permitted label and date/time:

| Type | Additional permitted fields |
|---|---|
| Lead/project | client and partner first names, service type, event date, guest count, venue and addresses where available, current lifecycle status. |
| Consultation | client and partner first names, scheduled time, 60-minute display end, consultation status, lead destination. |
| Installment | payment kind label, due date, total target amount, credited amount, current outstanding amount, fulfillment status, paid date and method if recorded, project installment destination. |
| Workshop | title, saved local start/end and timezone, venue/address, capacity, lifecycle status, occurrence destination. |
| Microsoft | permitted title/date/time/location and allowlisted Outlook open URL; private returns only `Private event` and date/time as details, plus the external open action. |

An authenticated user with no internal CRM role receives `403`; deleted/missing source returns `404`. The modal closes or shows a clear refresh message for a later `404`. SQL projection functions must not change payment states while reading.

## `queue_crm_calendar_month(p_month date, p_requested_by uuid)`

Service-role-only SQL command used after the `requestMonth` Edge action verifies an internal CRM user. It accepts the first day of one month, persists or coalesces one durable range request, and performs **no HTTP, `pg_net`, or Edge dispatch**. It never returns credentials or a Graph identifier. The current and adjacent months plus the 12 most recently requested distinct other months from the past 30 days form the scheduled set. For new distinct month requests, enforce at most 24 per user per rolling hour and three queued/running on-demand months per connection. A repeated pending month reuses its run without consuming another slot; viewing an already-current month updates its recency without a new run or limit charge. Return `current`, `queued`, `disconnected`, or `rate_limited` with a safe retry time; a rejected request does not change the scheduled set. SQL integration tests may call this queue command and inspect rows without reaching an Edge endpoint.

## `get_crm_calendar_status(p_month date default null)`

Authenticated internal-user RPC: `{ connectionStatus, calendarDisplayName, lastSuccessfulSyncAt, lastRunStatus, lastErrorCode, openConflictCount, staleMirrorWarning, requestedMonth, monthImportStatus, monthLastSuccessfulScanAt }`. When `p_month` is supplied, `monthImportStatus` is `not_loaded`, `loading`, `delayed`, `current`, `stale`, or `failed`. A tracked month is current only while its last completed scan is within the 15-minute freshness window and the provider is healthy; an untracked month is current only after a complete scan following its latest request. A queued/running request that has not completed within two minutes becomes `delayed`; the UI stops its loading indicator, shows a clear message and Retry, and keeps cached Microsoft items explicitly stale. A failed request also offers Retry. Repeating a pending request coalesces it and can redispatch the worker; a failed request can create a new run. It never returns tenant IDs, Graph IDs, secrets, delta links, or provider payloads. Staff see the sync health needed to trust the calendar; only administrators see conflict details.

The status RPC is available with the P1 synchronization flow. An authorized administrator can also read sanitized open-conflict details and request restoration in that flow; broader connect/refresh/reconnect/disconnect controls are completed in the later management story.

## `crm-m365-calendar-admin` Edge actions

All actions require a valid Supabase user JWT. `requestMonth` requires a server-verified internal CRM role and is available to staff and administrators; every other action below requires a server-verified integration-admin role even though `/admin` routes also admit staff. Mutations use service-role DB access only after role verification. Request bodies are bounded and validated.

| Action | Input | Result | Notable failure |
|---|---|---|---|
| `requestMonth` | `{ month: "YYYY-MM" }` | Queue command result; immediately dispatch a newly queued or retried request, while an already-current month needs no dispatch. A durable queued run remains for scheduled fallback if dispatch fails | `403` non-internal; `409` disconnected; `429` rate limited with retry time |
| `listCalendars` | none | Calendar IDs/names from the configured business mailbox, primary marker | `403` non-admin; `503` Graph setup unavailable |
| `connect` | `{ calendarId }` | Selected calendar name, connection status, initial sync run ID; all eligible CRM sources are queued for this calendar | `409` another connection active; `422` calendar not in scoped mailbox |
| `listConflicts` | none | Sanitized open conflict IDs, source labels, changed-field names, detection times, and permitted remote values for administrator review | `403` non-admin |
| `refresh` | `{ month?: "YYYY-MM" }` | Accepted run ID; UI polls status until success/failure within two minutes | `409` disconnected; `429` already running/rate limited |
| `restoreConflict` | `{ conflictId }` | Accepted restore job ID | `404`/`409` stale or resolved conflict |
| `disconnect` | none | Inactive connection with stale-mirror warning | `409` already disconnected |

The admin function may call the sync worker through a server-side secret; it never returns Graph tokens. `requestMonth` dispatch is checked only through standalone Edge type-checking and real sandbox smoke validation. Angular tests may stub the application-owned client transport or service to verify UI state, but must not call, intercept, mock, or simulate an Edge Function endpoint or handler. External open URLs must be validated against an Outlook HTTPS allowlist. UI navigation to a CRM source uses existing authenticated routes; there is no calendar-based source editing endpoint.
