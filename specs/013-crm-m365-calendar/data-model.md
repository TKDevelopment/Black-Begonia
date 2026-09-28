# Data Model: CRM Calendar and Microsoft 365 Sync

**Source**: [spec.md](./spec.md) and [research.md](./research.md) | **Date**: 2026-09-27

## Existing source records (unchanged)

| Calendar kind | Durable identity and date | Details/title dependencies | Export rule |
|---|---|---|---|
| Lead event | `leads.lead_id`, `event_date date` | first/partner first name, service type, venues, guests, status | Dated, not converted or declined. A converted lead event is suppressed in favor of its project. |
| Project event | `projects.project_id`, `event_date date` | primary `contacts`, partner `project_contacts`, source lead fallback, service type, venues, guests, status | Dated and not canceled. |
| Consultation | `leads.lead_id`, `consultation_scheduled_at timestamptz` | lead names, consultation status; display end is start + 60 minutes | Dated consultation, including historical completed consultation. No saved end is changed. |
| Installment | `project_payment_records.project_payment_record_id`, `due_date date` | project/contact names; `payment_kind`, `target_amount`, `credited_principal`, `outstanding_amount`, `paid_date`, `payment_method`, status | Dated non-canceled/non-waived installment; paid remains historical. No amount exported to Microsoft. |
| Workshop | `workshop_occurrences.workshop_occurrence_id`, `start_at`/`end_at` and `timezone` | title snapshot, local times, venue/address, capacity, lifecycle status | Dated draft shown only in CRM; published/registration-closed exported; completed/archived exported as history if previously published and not canceled/rescheduled; canceled/rescheduled mirror retired. |

All source rows and payment allocations remain authoritative in their existing tables. The calendar adds no source date or financial fields. A SQL projection uses half-open date ranges `[month_start, next_month_start)` and a bounded spillover range for the month grid. It returns a stable calendar item key; it never writes to source tables. One SQL source-title helper applies the five title patterns and fallbacks; list, detail, and service-only outbound projections reuse it. Angular and the Graph worker consume the returned title without reconstructing it.

## New tables

### `crm_m365_calendar_connections`

One selected calendar connection is active at a time. Fields: `connection_id uuid PK`, `tenant_id text`, `mailbox_user_id text`, `mailbox_upn text`, `calendar_id text`, `calendar_name text`, `is_primary boolean`, `business_timezone text`, `status` (`connected`, `action_required`, `disconnected`), `connected_by uuid`, `connected_at`, `disconnected_at`, `last_successful_sync_at`, `last_error_code`, `lease_owner uuid`, `lease_expires_at`, `created_at`, `updated_at`. A partial unique index permits at most one `connected`/`action_required` row. No Graph token or client secret is stored here. Reconnecting the same mailbox/calendar reuses its connection identity and associations; changing calendars creates a new connection identity and leaves prior remote events untouched with a stale warning.

**Access**: Service-role writes. Internal users read a sanitized status projection, not raw mailbox identifiers beyond the connected display name. Admin-only Edge action selects/changes/disconnects. No anonymous access.

### `crm_m365_calendar_outbox`

Coalesced source-change queue. Fields: `outbox_id uuid PK`, `source_type` (`lead_event`, `project_event`, `consultation`, `installment`, `workshop`), `source_id uuid`, `generation bigint`, `changed_at`, `attempt_count`, `next_attempt_at`, `last_error_code`, `state` (`pending`, `leased`, `blocked_conflict`), `lease_expires_at`. Unique `(source_type, source_id)`; source rows are deliberately not foreign keys so delete-trigger tombstones survive. Trigger upsert increments generation in the same transaction as source changes. Worker marks a generation complete only if the row's generation is unchanged, so later edits are not lost.

Initial connection and calendar replacement re-enqueue all eligible dated source identities, including records unchanged since the migration. A same-calendar reconnect reuses mappings and re-enqueues sources for reconciliation.

**Access**: Service role only; no direct browser reads. Add indexes on state/next attempt and lease expiry.

### `crm_m365_event_associations`

Durable CRM-to-Graph mapping. Fields: `association_id uuid PK`, `connection_id FK`, `source_type`, `source_id`, `graph_event_id text`, `transaction_id text`, `last_export_fingerprint text`, `last_export_change_key text`, `state` (`creating`, `active`, `conflict`, `retired`), `last_exported_at`, `created_at`, `updated_at`. Unique `(connection_id, source_type, source_id)`, `(connection_id, graph_event_id)` where ID exists, and `(connection_id, transaction_id)`. Preserve associations for retired source items and on disconnect to prevent duplicate recreation. `graph_event_id` is read/written with the immutable-ID preference.

**Access**: Service role writes; administrator reads a sanitized association/conflict summary through a command, not raw Graph IDs through broad table select.

### `crm_m365_imported_occurrences`

Sanitized Microsoft-only occurrence cache. Fields: `connection_id FK`, `graph_occurrence_id text`, `series_master_id text null`, `start_at timestamptz`, `end_at timestamptz`, `local_start_date date`, `local_end_date date` (exclusive), `is_all_day boolean`, `display_title text`, `location text null`, `outlook_web_url text null`, `is_private boolean`, `provider_status text`, `last_seen_scan_id uuid`, `updated_at`. Primary key `(connection_id, graph_occurrence_id)`; index on local date range. `provider_status='canceled'` projects `isInactive=true` and a Canceled label for nonprivate items when Graph returns `isCancelled=true`; completed-scan absence or a deletion tombstone removes the row. A private or confidential Graph event maps to `is_private=true`, `display_title='Private event'`, and `location IS NULL`; no subject, body, description, attendee list, or raw Graph JSON column exists. A private canceled occurrence exposes only the private label and date/time, with null status and neutral presentation indistinguishable from any other private occurrence. Only allowlisted Outlook HTTPS event URLs without sensitive query parameters may be stored. A matching source association excludes the row from CRM results, even if Graph returns the mirror during import.

**Access**: Internal-user read through the calendar range projection; service-role writes. No anonymous read. When disconnected, cached Microsoft-only occurrences are withheld from active calendar results; they are retained for a same-calendar reconnect until normal retention cleanup.

### `crm_m365_sync_months`

One range cursor per selected calendar and month. Fields: `connection_id FK`, `month_start date`, `strategy` (`primary_delta`, `full_reconcile`), `opaque_delta_link text null`, `last_requested_at`, `last_successful_scan_at`, `last_error_code`, `retry_after_at`, `scan_generation uuid null`. Primary key `(connection_id, month_start)`. Delta links are server-only and treated as opaque secrets. The scheduled set is the current month, adjacent months, and the 12 most recently requested distinct other months with `last_requested_at` in the past 30 days; least-recently-requested months fall out of scheduled polling when a new month enters. An accepted view of an already-current month updates `last_requested_at` to reflect recency without creating a redundant run or consuming a new-distinct-month limit. A service-only `queue_crm_calendar_month` command validates one month, coalesces duplicate pending work, enforces request limits, and persists a run without network I/O. The authenticated `requestMonth` Edge action calls it and immediately dispatches newly queued or retried work with server-side credentials; the scheduled worker also drains queued work if that dispatch fails. A previously untracked month is not marked current until a complete import after that request succeeds. The staff-safe status RPC projects month freshness without exposing the cursor. A full scan marks unseen imported occurrences deleted only after every page succeeds. An incomplete delta round does not replace the previous completed delta link.

**Access**: Service role only. Cleanup may retire idle month cursors after 30 days, but a later request must fetch fresh before showing Microsoft data. The currently viewed month remains tracked.

### `crm_m365_sync_conflicts`

Administrator review queue for CRM-origin events changed in Microsoft. Fields: `conflict_id uuid PK`, `association_id FK`, `remote_change_key text`, `changed_fields text[]`, `remote_start_at timestamptz null`, `remote_end_at timestamptz null`, `remote_title text null` (null if private), `is_remote_private boolean`, `detected_at`, `status` (`open`, `restoring`, `resolved`), `reviewed_by uuid null`, `reviewed_at null`, `resolved_at null`. Unique open conflict per association. No Graph body, attendee list, or private title is stored. The conflict blocks automatic outbound overwrite; an authorized administrator explicitly restores the current CRM projection, then the worker clears the conflict after Graph confirms it.

**Access**: Admin-only read/review command; service-role mutation. Staff see an aggregate sync warning without conflict values.

### `crm_m365_sync_runs`

Operational record. Fields: `run_id uuid PK`, `connection_id FK`, `trigger` (`scheduled`, `manual`, `range_request`), `requested_month date null`, `requested_by uuid null`, `requested_at timestamptz`, `status` (`queued`, `running`, `succeeded`, `failed`), `started_at`, `finished_at`, `exported_count`, `imported_count`, `conflict_count`, `last_error_code`. Index on connection/start and on `(requested_by, requested_at)` for range-request limits. Do not store raw provider responses or secrets. The queue command permits at most 24 new distinct month requests per user in a rolling hour and three queued/running range-request months per connection; repeats for an already pending month coalesce without consuming another slot. It returns a safe retry time when limited. A manual run must report success or a safe failure within two minutes; a range request still running after two minutes is shown as delayed with Retry, while long initial backfill is split into subsequent runs.

**Access**: Internal users read a sanitized last-run/last-success summary; administrators see safe per-run counters. Service role writes.

## Read models and state transitions

`CalendarItem` is a typed response, not a new business record: `id`, `sourceType`, `sourceId`, `title`, `start`, `end`, `allDay`, `localDate`, `status`, `colorType`, `isInactive`, `destination`. The `id` is stable across month/list/dashboard and source edits. `CalendarItemDetails` is fetched when the modal opens; installment amounts come from the current obligation and allocation data, never from a stale imported cache. The staff-safe `get_crm_calendar_status(p_month)` read, service-only queue command, internal-user `requestMonth` Edge action, and admin conflict review/restore commands are part of the P1 sync slice.

| Transition | Calendar effect | Microsoft effect |
|---|---|---|
| Lead converted to project | Suppress lead event; show project event | Retire lead mirror; create/update project mirror. Consultation history remains separate. |
| Draft workshop published | Same CRM occurrence changes status | Create one mirror at saved start/end. |
| Workshop canceled/rescheduled | Retain inactive CRM occurrence and show replacement if present | Retire old active mirror; create replacement's mirror only when eligible. |
| Installment paid | Keep dated historical item with paid status | Update status treatment without amount or payment method in Microsoft. |
| Date cleared/source deleted | Remove dated CRM item | Retire linked mirror; retain association tombstone. |
| Graph-only occurrence edited/deleted | Update/remove sanitized cache after completed scan | No CRM business row changes. |
| Graph-only occurrence returned canceled | Keep sanitized item with inactive Canceled status | No CRM business row changes; a later deletion or completed-scan absence removes it. |
| CRM mirror edited in Graph | Keep CRM item unchanged; show admin conflict | Freeze mirror writes pending review, then restore current CRM version. |
| Disconnect | CRM items remain; imported cache is hidden as stale | Stop calls; leave already-created Graph events untouched. |

## Migration and authorization rules

`supabase/migrations/20260927010000_crm_m365_calendar.sql` must create these tables and indexes, explicit RLS policies, internal-user projection and details functions, admin role check/commands, service-only worker commands, and coalescing triggers. Declarative table/function definitions mirror the migration. Source trigger functions avoid recursive writes and do not invoke network calls. SQL functions set a fixed `search_path`, revoke default `PUBLIC` execute, and grant only the required authenticated/service roles. Existing source RLS is preserved. Deployment does not require a storage policy or destructive backfill; only outbox seed rows are added for existing dated sources.
