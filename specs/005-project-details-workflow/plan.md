# Implementation Plan: Project Details Workflow

**Branch**: `005-project-details-workflow` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-project-details-workflow/spec.md`

## Summary

Replace the current combined projects list/detail surface with a CRM-standard projects table and dedicated project details route. The feature adds project editing, quick actions, financial summary, project activity, proposal document grouping, invoice/document metadata comparison, project-level payment records, and payment-gated operational project statuses. Backend work updates project status values, adds payment tracking records, and provides an idempotent status refresh path so booked projects move to Awaiting Final Payment 45 days before the event when final payment is still unpaid.

## Technical Context

**Language/Version**: Angular 19 / TypeScript 5.8 for CRM frontend work; Supabase SQL migrations and repository/service updates for backend records. No new Supabase Edge Function is required for the first implementation.

**Primary Dependencies**: Angular Material/CDK where already used, Supabase client, Supabase Postgres/RLS, Supabase Storage signed URLs for private PDFs, Netlify Angular SSR/Express runtime, Karma/Jasmine. Reuse existing shared CRM components including `SearchFilterBarComponent`, `EntityTableShellComponent`, `StatusBadgeComponent`, CRM page header, loading/error states, and detail card/shell patterns.

**Storage**: Supabase Postgres for projects, project proposal invoice snapshots, project proposal document versions, activity log, and new project payment records. Supabase Storage remains private for proposal PDFs through existing `project_proposal_document_versions.storage_bucket/storage_path` records. Schema changes require a new executable migration, proposed as `supabase/migrations/20260718000000_project_details_workflow.sql`, plus declarative schema updates under `supabase/schemas/public/tables/` and any enum/function declarations used by the project.

**Testing**: Karma/Jasmine unit tests for projects table search/filter/reset, detail loading, edit modal validation/save/cancel, quick actions, financial summary, payment logging/status transitions, document tab grouping, active/inactive labels, metadata comparison, timeline empty/populated states, and source lead UUID hiding. Repository/service tests cover project payment records, project status refresh, project document ordering/grouping, signed PDF errors, and activity reads. Manual quickstart covers initial booking status, deposit logging, 45-day final-payment transition, final payment logging, revisions, and document display.

**Target Platform**: Netlify-hosted Angular CRM admin portal with Supabase backend services and private Supabase Storage documents.

**Project Type**: Brownfield Angular/Supabase CRM. This feature touches CRM admin project routes/components and Supabase project/payment/activity data. Public website and client proposal-access surfaces are out of scope.

**Performance Goals**: Projects table search/filter should feel instant for at least 25 sample projects and remain usable for hundreds of projects loaded into memory. Project details, active financial summary, document history, and activity timeline should become visible within a normal CRM data load without blocking independent sections when optional payment, document, or activity data is missing.

**Constraints**: Preserve brownfield behavior unless explicitly approved; no frontend service-role secrets; Supabase RLS and storage policies required for data changes; every new or modified table schema requires an executable SQL migration in `supabase/migrations/`; every Supabase Edge Function must be standalone with no `_shared` directory or local cross-function imports; public site changes require product owner approval; AI agents must not run git commit or push commands. Payment records introduced here are operational project records; Stripe integration and full payment detail screens are future work.

**Scale/Scope**: Affects `/admin/projects`, a dedicated `/admin/projects/:projectId` details route, project components and child components under `src/app/components/private/projects/`, project/payment/activity/document models and repositories under `src/app/core/`, project status migration/schema, project payment table/schema, activity log usage, proposal revision entry point, and project-facing proposal document presentation. Public routes, client portal, SignWell removal, and full payment screens are out of scope.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Surface classification**: CRM admin portal and Supabase backend. Supabase Storage private PDF access is read through existing signed URL flow. Public website and client portal are not changed.
- **Brownfield preservation**: Preserve leads, contacts, organizations, lead details, proposal builder calculations, manual Canva PDF upload/revision submission, private PDF storage, source lead relationship, contacts/organizations project linking, existing proposal invoice snapshots, and existing document version records. Authorized refactor is limited to project list/details UX, project edit modal, status/payment operational tracking, document section grouping, revision comparison, and related project activity display.
- **Supabase security**: New project payment records use RLS for authenticated internal CRM users only, matching existing CRM data access posture. Project/source lead/payment/document/customer data remains private. Browser code uses Supabase authenticated client permissions only; no service-role key enters frontend code. Private proposal PDFs continue to open through short-lived signed URLs.
- **Schema migration**: Add `supabase/migrations/20260718000000_project_details_workflow.sql` to update `project_status` values with data-preserving mapping, create `project_payment_records`, add indexes/RLS/policies, and add any helper function needed for idempotent 45-day status refresh. Update declarative schema files to match.
- **Standalone edge functions**: No new edge function is planned. Existing proposal submission/revision functions remain standalone and unchanged except where their returned project/document references are consumed by the project details page.
- **Testing plan**: Add focused Karma/Jasmine tests for all touched project components, modals, repositories, services, and workflow state transitions. Add repository contract tests for payment records and status refresh. Manual quickstart covers proposal, project, payment, document, and authorization-adjacent PDF access paths.
- **Frontend boundary plan**: Work stays in CRM admin private routes. It does not advance or block the future public/client/CRM frontend split.
- **Proposal workflow rule**: Preserved. Proposal builder remains the invoice/planning source; manual Canva PDF upload remains the document source; revisions remain builder-driven but are launched from project details.
- **Security and privacy**: No service-role keys or privileged secrets in frontend code. Customer data, proposal PDFs, signatures inside PDFs, invoice snapshots, and payment records stay inside authenticated CRM flows. Stripe fields are reserved for future metadata and do not introduce Stripe secrets or checkout flows.
- **Git publication boundary**: The AI agent will not run `git commit`, `git push`, or commit/push-capable automation. Source-control handoff remains human-owned.

## Project Structure

### Documentation (this feature)

```text
specs/005-project-details-workflow/
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/
    project-details-workflow.md
  checklists/
    requirements.md
```

### Source Code (repository root)

```text
src/
  app/
    app.routes.ts
    components/private/projects/
      projects.component.*                 # CRM-standard projects table
      project-details/                     # dedicated details route
      components/
        project-edit-modal/
        project-financial-summary-card/
        project-payment-log-modal/
        project-activity-panel/
        project-proposal-documents-section/
        project-revision-comparison-modal/
    core/
      models/
        project.ts
        project-payment-record.ts
        project-proposal-document-version.ts
        project-proposal-invoice-snapshot.ts
        activity-log.ts
      supabase/repositories/
        project-repository.service.ts
        project-payment-record-repository.service.ts
        project-proposal-document-version-repository.service.ts
        project-proposal-invoice-snapshot-repository.service.ts
        activity-repository.service.ts
      supabase/services/
        project-workflow.service.ts

supabase/
  migrations/
    20260718000000_project_details_workflow.sql
  schemas/public/tables/
    projects.sql
    project_payment_records.sql
    activity_log.sql
  schemas/public/functions/
    refresh_project_payment_statuses.sql
  schemas/storage/
    floral_proposals.sql
```

**Structure Decision**: Keep project work in the existing CRM admin area. Split `/admin/projects` into a table entry point and `/admin/projects/:projectId` as a dedicated details page, using shared list/detail primitives already used by leads, contacts, and organizations. Add small project-specific child components rather than continuing to grow a single combined `ProjectsComponent`.

## Complexity Tracking

No constitution violations are required for this plan.

## Post-Design Constitution Re-Check

**Status**: PASS

- Phase 0 research keeps scope inside CRM admin and Supabase backend.
- Phase 1 data model adds project payment records with RLS/migration requirements and preserves private proposal PDF handling.
- Contracts keep Stripe integration, full payment screens, PDF text extraction, and visual PDF comparison out of scope.
- No public website or client portal changes are introduced.
- No edge-function sharing or commit/push automation is required.
