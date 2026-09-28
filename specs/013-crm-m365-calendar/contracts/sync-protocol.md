# Contract: CRM ↔ Microsoft 365 Sync

## Boundary and identity

`crm-m365-calendar-sync` is a standalone Edge Function invoked by a named five-minute `pg_cron`/`pg_net` job or a server-authorized manual or on-demand month request from `crm-m365-calendar-admin`. It accepts only a high-entropy scheduler secret or a verified internal call from that admin-function boundary; browser JWTs do not authorize worker mutation. It uses Graph client credentials with Exchange Application RBAC scoped to the configured business mailbox. The selected calendar ID is server-owned. `Prefer: IdType="ImmutableId"` is sent on every relevant Graph request.

One CRM event is identified by `(source_type, source_id)`. One Microsoft-only occurrence is identified by `(connection_id, immutable_graph_occurrence_id)`. Store a stable outbound `transactionId` before the first create POST. `crm_m365_event_associations` has unique constraints for both sides. Never use subject/time matching as identity.

## Outbound mapping

| Source | Graph subject | Graph time | Fields deliberately omitted |
|---|---|---|---|
| Lead/project | `{Client first name} & {Partner first name} - {Service Type}` with spec fallbacks | all-day local event date | surnames, email, proposal details, guests |
| Consultation | `{Client first name} & {Partner first name} - Consultation` | saved start plus 60-minute display end | client contact information |
| Installment | `{Client first name} & {Partner first name} - {Installment title}` | all-day due date | amount, payment method, receipts |
| Workshop | `{Workshop title} - Workshop` | saved start/end instants and timezone | registration/customer/financial details |

These subjects are supplied by the service-only `get_crm_m365_export_projection` SQL command, which reuses the source-title helper behind CRM list and detail reads. The worker does not assemble names or title fallbacks. The SQL and Angular title tests verify one canonical output.

No attendee is added, so sync sends no customer invitation. All-day Graph end is exclusive next-day midnight in the same supported business timezone. A blank source date or source deletion retires the mapped event. Converted lead, declined lead, canceled project, canceled/waived installment, and canceled/rescheduled workshop have no active mirror. Dated workshop drafts are CRM-only. A completed/archived workshop that had been published stays as historical inactive calendar data.

Export consumes a coalesced outbox row under lease. If no association exists, create with the persisted `transactionId`, then save Graph immutable ID and exported fingerprint. If an association exists, fetch current Graph state and compare normalized subject/start/end/location with the last exported fingerprint. A provider edit or `412` conditional update becomes a conflict; CRM source is not changed. Retry `429` using `Retry-After`, else capped exponential backoff; retry safe 5xx/timeouts with the same transaction ID. A run commits the outbox generation only after Graph success; later generations remain pending.

## Inbound month processing

1. Create or reuse a tracked `(connection, month_start)` row. The visible FullCalendar range is bounded; request adjacent month data separately if needed.
2. If the selected calendar is the business mailbox's primary calendar, call `/users/{mailbox}/calendarView/delta` for that month's fixed start/end and follow every opaque `nextLink` until `deltaLink`. Save only the completed `deltaLink`. For a selected secondary calendar, page `/users/{mailbox}/calendars/{calendarId}/calendarView` and reconcile against a scan generation after the final page.
3. For every Graph occurrence, check the association by immutable event ID. Suppress CRM-origin mirrors from the imported-event cache and display. For Microsoft-only occurrences, sanitize before persistence. An occurrence returned with `isCancelled=true` remains cached; show a nonprivate one as inactive Canceled. Private or confidential sensitivity becomes `Private event` plus date/time and no subject/location/body or exposed canceled status; preserve an allowlisted Outlook event URL without sensitive query parameters only for the open action. Recurring occurrences and exceptions retain distinct occurrence IDs and correct local dates.
4. Apply Graph deletions/tombstones and full-scan absence only to the relevant completed range, then update the month's last-success timestamp. This also removes canceled recurring occurrences that Graph no longer returns. An interrupted pagination round cannot delete cached items or advance the cursor. A later move across months removes the old occurrence and adds the new one when both ranges reconcile.
5. During provider outage, serve live CRM items and previously sanitized Microsoft cache with visible stale status. Explicit disconnect hides Microsoft-only cache, stops worker calls, and leaves exported Microsoft events untouched.

The scheduled set is the current and adjacent months plus the 12 most recently requested distinct other months in the past 30 days, at most 15 months total. The 15-minute inbound convergence target applies to this bounded set, with a full-set 200-items-per-month validation. An authorized internal user opening another month calls the admin function's internal-user `requestMonth` action. That function verifies the role, uses the service-only queue command, then dispatches the worker with its server-side secret; SQL queueing itself makes no network call. Limit new distinct requests to 24 per user per rolling hour and three queued/running on-demand months per connection. Return `429` with retry time when limited, without changing the scheduled set. If immediate dispatch fails, the queued run remains for the named scheduled worker to pick up. The UI reads `get_crm_calendar_status(p_month)` and shows Microsoft items as loading or explicitly stale until a complete scan succeeds. At two minutes without completion, it shows `delayed` or `failed` with Retry instead of an indefinite loading state; retries coalesce a pending run or start a new one after failure. The 15-minute outbound target applies to CRM source changes in every month. Work is bounded per run and continued in later five-minute runs; a manual refresh reports success or a safe failure within two minutes.

## Conflict and observability

On Microsoft edits to a CRM mirror, insert one open conflict per association with safe changed-field metadata, current remote time, and a nonprivate title if available. The worker blocks further overwrite of that mirror until an administrator reviews and requests `restoreConflict`. Restoration reprojects the **current** CRM source, updates Graph conditionally, and resolves only after confirmation. Never apply the Microsoft change to a CRM business row.

The staff-safe `get_crm_calendar_status(p_month)` RPC, queue-only month SQL command, internal-user `requestMonth` Edge action, and admin conflict review/restore SQL and Edge actions ship with synchronization. Automated SQL tests inspect queued requests without dispatching or invoking Edge; real sandbox checks validate dispatch and provider effects. The initial Calendar UI exposes conflict review and restore to administrators; the later connection panel consolidates those controls and adds refresh, reconnect, and disconnect.

Record run start/end, counters, last success, safe error codes, retry time, and open-conflict count. Do not log bearer tokens, raw Graph responses, private subjects, client surnames, installment amounts, payment details, or email bodies. Separate authorization loss, RBAC denial, provider outage, throttling, and data validation in status shown to administrators.
