# Implementation Plan: Manual Proposal Booking

**Branch**: `004-manual-proposal-booking` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-manual-proposal-booking/spec.md`

## Summary

Refactor the proposal workflow so the florist keeps the existing floral proposal builder and pricing preview through `Finalize Proposal`, then uploads an already-signed Canva proposal/services agreement PDF to book the lead as a project. The implementation removes SignWell, client proposal-access signing, signing emails, and provider session data; introduces project-owned signed document version history; and records an active invoice snapshot each time a confirmed proposal PDF is submitted for the booked project.

## Technical Context

**Language/Version**: Angular 19 / TypeScript 5.8 for frontend CRM work; standalone Supabase Edge Functions in TypeScript/Deno for booking submission and storage orchestration.

**Primary Dependencies**: Angular Material/CDK, Supabase client, Supabase Edge Functions, Supabase Storage, Netlify Angular SSR/Express runtime, Karma/Jasmine. Existing Mailgun support remains only for unrelated inquiry/message workflows; SignWell dependencies, environment variables, and edge contracts are removed from proposal booking.

**Storage**: Supabase Postgres for leads, projects, floral proposal invoice data, project invoice snapshots, and project proposal document versions. Supabase Storage keeps private PDFs, using the existing `floral-proposals` bucket or its successor policy with project-oriented object paths. Schema changes require declarative schema updates plus an executable cleanup migration under `supabase/migrations/`.

**Testing**: Karma/Jasmine unit tests for CRM proposal builder, workflow service, route removal, repository/model mapping, and project document history. Supabase edge functions require Deno type checks and focused request/response tests where feasible. Manual quickstart verifies initial booking, project revision, legacy URL removal, and storage history.

**Target Platform**: Netlify-hosted Angular CRM admin portal with Supabase backend services and private Supabase Storage documents.

**Project Type**: Brownfield Angular/Supabase CRM. This feature touches CRM admin proposal flow, the retiring client proposal-access surface, and Supabase backend artifacts.

**Performance Goals**: Florists should see totals/shopping list updates with existing builder responsiveness while editing. Confirmed PDF submission should avoid duplicate booking on retry and complete within a normal upload/edge-function round trip, with clear progress and error states for PDF validation, storage, and conversion failures.

**Constraints**: Preserve brownfield behavior unless explicitly approved by this spec; no frontend service-role secrets; Supabase RLS and storage policies required for data changes; every new or modified table schema requires an executable SQL migration in `supabase/migrations/`; every Supabase Edge Function must be standalone with no `_shared` directory or local cross-function imports; public site changes require product owner approval; AI agents must not run git commit or push commands.

**Scale/Scope**: Affects `/admin/leads/:leadId/floral-proposal-builder`, lead conversion, project records, proposal document history on project view, proposal workflow services/repositories/models, proposal-access routes/components/services/guards/layout removal, Supabase schemas/migrations/storage policies, and proposal-related edge functions. Public website and unrelated inquiry/Mailgun flows are out of scope.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Surface classification**: CRM admin portal, retired client proposal-access surface, Supabase Postgres, Supabase Storage, and Supabase Edge Functions. Public website is not changed.
- **Brownfield preservation**: Preserve proposal builder configuration, catalog item builder, dynamic totals, shopping list preview, line item editing, tax regions, markup/labor calculations, lead details, converted lead history, project records, inquiry email processing, Mailgun webhooks unrelated to proposal access, and current private CRM auth boundaries.
- **Supabase security**: PDF uploads remain private. Browser code uploads only through authenticated CRM/Supabase client paths allowed by RLS/storage policies or through an authenticated edge function. Service-role operations stay in edge functions only. Legacy passcode/signature/customer portal data is deleted rather than exposed or migrated into frontend state.
- **Schema migration**: Add a cleanup migration such as `supabase/migrations/20260717000000_manual_proposal_booking_cleanup.sql` to drop `proposal_signing_sessions`, remove SignWell/portal columns from `floral_proposals`, create project proposal document version and invoice snapshot structures, add project active snapshot/version references, and preserve useful lead/project/venue/invoice data. Update `supabase/schemas/public/tables/*.sql` to match the post-migration state.
- **Standalone edge functions**: Refactor `submit-floral-proposal.ts` as a standalone booking/revision submission function. Retire `signwell-webhook.ts`, `verify-floral-proposal-access.ts`, `submit-floral-proposal-response.ts`, `send-proposal-email.ts`, and `resend-floral-proposal-email.ts` for proposal access. `preview-floral-proposal-pdf.ts` may remain only if it supports internal preview/export without client signing.
- **Testing plan**: Add or update Karma/Jasmine tests for the finalize modal PDF flow, workflow service response mapping, duplicate/invalid submission states, project history presentation, and route removal. Add edge-function type checks for the refactored submission function and schema contract checks for migrations where practical.
- **Frontend boundary plan**: Remove the proposal-access client portal from routing and code paths. Keep all active workflow entry points under CRM admin. Legacy proposal-access URLs must resolve as not found or inaccessible.
- **Proposal workflow rule**: Preserved. The builder remains the source of invoice/planning data; finalization now requires a florist-supplied signed Canva PDF rather than SignWell or an embedded client portal.
- **Security and privacy**: No service-role keys in frontend code. Proposal passcodes, signatures, signature IP/user agent, provider session references, and SignWell webhook payloads are removed. Signed PDFs and invoice snapshots are private project records.
- **Git publication boundary**: The AI agent will not run `git commit`, `git push`, or commit/push-capable automation. Any source-control summary is human handoff only.

## Project Structure

### Documentation (this feature)

```text
specs/004-manual-proposal-booking/
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/
    manual-proposal-booking.md
  tasks.md
```

### Source Code (repository root)

```text
src/
  app/
    app.routes.ts                         # Remove proposal-access routes; keep CRM builder route(s)
    components/private/
      floral-proposal-builder/            # Replace SignWell finalization with signed PDF modal
      leads/                              # Lead conversion/status and proposal history affordances
      projects/                           # Project view proposal document history and active snapshot
    components/proposal-access/           # Remove retired client proposal/signature portal
    core/
      guards/proposal-access.guard.ts     # Remove with proposal-access portal
      layouts/proposal-access-layout/     # Remove with proposal-access portal
      models/                             # Remove signing model, add project document/snapshot models
      proposal-access/                    # Remove retired portal service/models
      supabase/
        repositories/                     # Refactor proposal/project repositories
        services/                         # Refactor floral proposal workflow service

supabase/
  migrations/                             # Manual booking cleanup migration
  schemas/public/tables/                  # Post-cleanup table declarations
  schemas/storage/                        # Private PDF bucket/policies
  edge_functions/                         # Refactored submit function; retired signing/access functions removed
```

**Structure Decision**: Keep the feature inside the existing Angular/Supabase app during this refactor. Remove the retired client portal files instead of hiding them, because the approved workflow makes public signing URLs inaccessible. Add project-owned proposal document and invoice snapshot structures beside existing project/proposal data rather than overloading SignWell-oriented fields.

## Complexity Tracking

No constitution violations are required for this plan.
