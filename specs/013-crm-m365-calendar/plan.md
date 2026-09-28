# Implementation Plan: CRM Calendar and Microsoft 365 Sync

**Branch**: `013-crm-m365-calendar` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/013-crm-m365-calendar/spec.md`

## Summary

Add a full-width, month-first CRM calendar with chronological list mode, type-colored events, current-data detail modals, and a dashboard mini calendar. Read the five CRM source types through a bounded, authorized database projection. Synchronize one administrator-selected Microsoft 365 business calendar through mailbox-scoped application access, a transactional CRM outbox, five-minute scheduled reconciliation, primary-calendar delta or secondary-calendar range scans, and a sanitized imported-event cache. CRM-origin events stay authoritative; Microsoft-only events remain Microsoft-owned. Keep the existing public, proposal, payment, and workshop workflows unchanged.

## Technical Context

**Language/Version**: Angular 19.2 / TypeScript 5.8; standalone Supabase Edge Functions in Deno TypeScript; PostgreSQL SQL/PLpgSQL.

**Primary Dependencies**: Existing FullCalendar 6 Angular/core/daygrid/list packages, Angular Material/CDK dialog and focus utilities, Angular Router, Supabase JS, Microsoft Graph v1.0 HTTP API, Supabase `pg_cron`, `pg_net`, Vault, Netlify-hosted Angular app, Karma/Jasmine. No new frontend runtime package is required.

**Storage**: Supabase Postgres for connection metadata, month sync cursors, source-to-Graph associations, coalesced outbound work, sanitized imported occurrences, conflicts, and run status. Executable migration `supabase/migrations/20260927010000_crm_m365_calendar.sql` plus matching declarative table/function files under `supabase/schemas/public/`. Existing source tables get enqueue triggers, not new business columns. No Supabase Storage bucket. Microsoft app credentials stay in Edge secrets; scheduler secret stays in Vault.

**Testing**: Focused Karma/Jasmine tests for source projection adapters, month/list controls, title fallbacks, five color/type presentations, date-only/timezone handling, modal content/focus, dashboard mini calendar, client-side permissions, and outage states. PostgreSQL integration tests for projection, title joins, conversion deduplication, workshop/obligation lifecycle, outbox/association idempotence, conflict commands, RLS, privacy sanitization, and queue-only month requests with no network dispatch. Angular tests stub the application's client transport boundary and assert UI/service state without calling, mocking, or simulating Edge Function endpoints or handlers. Every affected Edge Function is independently type-checked and validated with documented Microsoft 365 sandbox smoke checks. **No automated test or harness may target, import, invoke, or simulate an Edge Function.**

**Target Platform**: Current Netlify Angular application and Supabase backend. Business Microsoft 365 tenant with a dedicated mailbox and Exchange Application RBAC limited to that mailbox.

**Project Type**: Brownfield Angular/Supabase CRM inside a single frontend with logically separate public, customer, and admin surfaces.

**Performance Goals**: Dashboard mini month with 200 combined items renders within three seconds under normal conditions; 95% of normal outbound CRM changes across all months and inbound Microsoft changes in the bounded scheduled set of at most 15 months converge within 15 minutes; an untracked month completes a fresh import before Microsoft items are marked current and exits its loading state for a delayed/failure state with Retry within two minutes if not complete; manual refresh completes or reports failure within two minutes. Benchmark the full tracked set at 200 items per month. Keep month reads bounded and indexable; paginate Graph reads and process a bounded worker batch per run.

**Constraints**: One shared selected business calendar, five CRM source types, workshop drafts CRM-only until publication, CRM authority over CRM-derived dates, private Microsoft events limited to a label and date/time, no customer invitations, no public-route changes, no frontend privileged secrets, no shared local Edge Function modules, no Edge Function automated tests, no agent commits or pushes.

**Scale/Scope**: `/admin/calendar`, dashboard mini calendar, sidebar, two standalone Edge Functions, calendar projection/read and integration tables/functions/triggers/scheduler. A representative month has 200 combined items; range queries and Graph pagination must work beyond that. Tasks and other future dashboard widgets are outside this feature.

## Constitution Check

*Gate evaluated before research and again after design: PASS. No exception or approval is required for the specified CRM and Supabase work.*

- **Surface classification**: Authenticated CRM admin portal and Supabase backend only. Public website, customer portal, SEO, forms, and proposal access are untouched.
- **Brownfield preservation**: Existing lead/project/workshop editors, consultation storage, installment reconciliation, payment checkout, proposal PDFs, manual Canva upload, public workshops, and theme toggle remain their sources of truth. Calendar only reads them; export writes Microsoft events, not business rows.
- **Supabase security**: Calendar projection functions check `is_internal_crm_user()`. Staff see sanitized calendar items and status. A server-verified admin role is required for connect/select/disconnect/refresh/conflict review. New tables have explicit RLS; source tables keep current RLS. Service-role writes remain inside Edge/SQL worker boundaries. Raw Graph payloads, secrets, and private event fields never enter client tables or logs.
- **Schema migration**: `20260927010000_crm_m365_calendar.sql` creates every new table, index, RLS policy, projection/worker function, enqueue trigger, and an idempotent named-schedule installer. Matching declarative definitions live under `supabase/schemas/public/`. The migration is additive after the 2026-09-26 payment migrations; it does not rewrite existing business records. Activate the job only after `pg_cron`, `pg_net`, Vault, Edge secrets, and Graph access pass preflight.
- **Standalone edge functions**: `supabase/edge_functions/crm-m365-calendar-admin/index.ts` and `crm-m365-calendar-sync/index.ts` each contain all required local logic, including Graph calls; neither imports `_shared` or another Edge Function. No automated Edge-targeting tests are created.
- **Testing plan**: Add focused Angular and PostgreSQL integration coverage with meaningful branches toward the 80% Angular target. SQL tests run the queue-only month command and inspect persisted requests without `pg_net`, Edge secrets, or an Edge endpoint; Angular tests stub only the application-owned client transport/service boundary and never intercept an Edge URL or fake an Edge handler. Independently type-check each Edge Function and run provider sandbox scenarios for create/update/cancel/delete, recurrence, private events, conflict restoration, full 15-month convergence, on-demand retry/rate limits, disconnect, throttling, and lost authorization. SQL tests may validate Edge-consumed commands but cannot call or simulate the Edge runtime.
- **Frontend boundary plan**: Lazy `/admin/calendar` route under existing auth/internal guards, sidebar item directly below Dashboard, and dashboard mini widget. No frontend split, SSR route migration, or Netlify configuration change beyond the normal app build. The server never renders or requests Graph data directly.
- **Proposal workflow rule**: The calendar reads installment dates and current obligation facts without changing payment allocation, invoice/planning data, proposal revision, or manual PDF upload.
- **Security and privacy**: Microsoft client credentials and app token stay in Supabase Edge secrets/memory. Exported titles contain first names only; no last names, email, amount, payment method, PDF, signature, passcode, or message body. Private imported events are redacted before persistence. External Outlook links are allowlisted and require the viewer's own Microsoft access.
- **Git publication boundary**: AI work stops at reviewable files and verification; commit and push remain with the human operator.

## Design and delivery sequence

1. **Database foundation**: Add month-bounded `list_crm_calendar_items` and live `get_crm_calendar_item_details` commands with internal-user checks, correct date-only and timezone logic, first-name joins, converted-lead suppression, and installment status/amount projection. Centralize the five CRM title patterns and fallbacks in a SQL source-title helper reused by list, details, and the service-only outbound projection; Angular retains the returned canonical title for details but shortens the calendar-box label, while the worker exports the canonical title without reconstructing it. Add internal source-change outbox triggers for leads, projects, project contacts/contacts, payment records, and workshop occurrences. Seed outbox from existing dated records after migration without modifying those records.
2. **Integration state and controls**: Add singleton connection, month cursor, association, sanitized import, conflict, outbound work, and run tables described in [data-model.md](./data-model.md). Add RLS, the staff-safe month-aware status RPC, and a service-only `queue_crm_calendar_month` SQL command that validates and coalesces one-month requests without network I/O. The admin Edge Function exposes `requestMonth` to any authorized internal CRM user; it verifies the user, calls the queue command, and dispatches the worker with a server-side secret. All other connection controls require integration-admin authorization. Limit scheduled imports to the current and adjacent months plus the 12 most recently requested distinct other months in a rolling 30 days, allow at most 24 new distinct month requests per user in a rolling hour and three pending on-demand month scans per connection, and return a retry time on rejection. Configure a mailbox-scoped Microsoft app. Connecting or selecting a different calendar re-enqueues every eligible CRM source for that connection's initial export. Story 3 includes admin conflict review and restoration; Story 6 adds the remaining management controls and consolidates their UI.
3. **Sync worker**: Deploy the standalone worker, then activate a named five-minute `pg_cron`/`pg_net` enqueue job through the migration's installer. Worker obtains a short lease, exports coalesced CRM changes for any month, imports the bounded tracked set, sanitizes private events, handles returned Microsoft-only canceled events as inactive and completed-scan removals as deletions, updates association/cursors atomically after complete Graph pages, records safe status, and honors `Retry-After`. `requestMonth` dispatches an accepted untracked-month request immediately; the scheduled job also picks up durable queued requests if dispatch fails. On-demand work must not starve the 15-minute scheduled set. A requested month is current only after a complete scan; older requested months leave the scheduled set in least-recently-requested order but remain available for later on-demand import. Primary calendar uses calendar-view delta; secondary calendar uses full paged range reconciliation. Never treat a partial page set as a completed month scan.
4. **CRM UI**: Replace the calendar scaffold with FullCalendar day-grid/list views that fill the available CRM content width and remaining viewport height beside the sidebar and mobile header. Add square SVG previous/next month controls, a Today control disabled in the current month, a legend, loading/empty/error/sync states, and a typed item-detail dialog. Keep event-box labels short and clipped, with a bright yellow lead treatment in light mode. On month navigation, call `requestMonth` when needed and read month-specific freshness before treating Microsoft items as current; CRM items remain immediately visible. After two minutes without a completed scan, replace the loading indicator with a delayed or failed message and Retry action; honor rate-limit retry time. Story 3 provides last-sync status and an admin-only conflict review/restore action; Story 6 adds the complete connection panel. Add calendar navigation immediately below Dashboard and a compact dashboard month widget using the same data service. Date range loads are cancelable or keyed so a late response cannot replace a newly selected month. Both views share the same event identity and click behavior.
5. **Release validation**: Run Angular and SQL suites, independent Edge type-checks, and the sandbox matrix in [quickstart.md](./quickstart.md). Deploy SQL before Edge and UI. Keep the connection disabled until Graph application RBAC, Edge secrets, and scheduler preflight pass. Run initial backfill and inspect counts, last sync, duplicates, private-event redaction, and conflict status. Rollback by disconnecting (leaving Microsoft mirrors per the spec), disabling the named cron job, and reverting app/Edge deployments; retain additive tables for audit/retry.

## Key design boundaries

- **Projection versus mutation**: Calendar item identity is `(source_type, source_id)` for CRM records or `(connection_id, immutable Graph occurrence ID)` for Microsoft-only events. A shared SQL title helper produces canonical CRM list, detail, and outbound titles; the browser adapter shortens only the visible event-box label. Selecting an item loads current permitted details. Calendar does not edit project dates, installments, or workshops.
- **Outbound eligibility**: Dated active lead events (excluding converted leads), projects, consultations, installments, and published/registration-closed workshops export. Completed/archived workshops export as historical items only when `published_at` exists and they were not canceled or rescheduled. Draft workshops and canceled/superseded commitments stay visible but inactive in CRM and have no active mirror. Paid installment history remains date-visible without posing as unpaid/current commitments. Clearing or deleting a source date retires its mirror.
- **Conflict rule**: Compare the Graph event's normalized business fields with the last exported projection. A Microsoft edit to a CRM mirror marks conflict; do not mutate CRM or silently overwrite Graph. Admin review offers restoration from the current CRM source. A 412 precondition failure during update/delete follows the same path.
- **Date and time rule**: Treat SQL `date` as a local calendar date; all-day Graph end is exclusive next-day midnight. Timed consultation uses the saved instant and a display-only 60-minute end. Workshop uses saved start/end instants and named zone; preserve local start/end when formatting. Use business `America/New_York` for display and validate Graph timezone support at connection setup.
- **Disconnect rule**: Mark the connection inactive, halt scheduled and manual import/export, retain CRM source records and existing Microsoft mirrors, and display an explicit stale-mirror warning. A later reconnection to the same calendar reconciles saved associations rather than creating duplicates.

## Project Structure

### Documentation (this feature)

```text
specs/013-crm-m365-calendar/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/calendar-api.md
  contracts/sync-protocol.md
  tasks.md                 # generated by /speckit-tasks, not this command
```

### Source Code (repository root)

```text
src/app/app.routes.ts
src/app/components/private/calendar/                  # full calendar page and detail dialog
src/app/components/private/dashboard/                 # mini calendar widget
src/app/shared/components/private/sidebar/            # Calendar link after Dashboard
src/app/core/supabase/repositories/                    # typed calendar reads/status
src/app/core/models/                                    # calendar item contracts
src/app/core/utils/date-only.ts                        # existing date-only helper
supabase/migrations/20260927010000_crm_m365_calendar.sql
supabase/schemas/public/tables/                        # declarative integration tables
supabase/schemas/public/functions/                     # projection and worker commands
supabase/edge_functions/crm-m365-calendar-admin/index.ts
supabase/edge_functions/crm-m365-calendar-sync/index.ts
supabase/tests/crm_m365_calendar.sql
```

**Structure Decision**: Keep the feature in the existing private CRM and Supabase directories. Use the installed FullCalendar packages and current private shell/theme. New functions are standalone deployment units; no local shared Edge module or storage bucket is introduced.
