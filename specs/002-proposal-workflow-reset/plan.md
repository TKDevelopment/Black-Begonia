# Implementation Plan: Proposal Workflow Reset

**Branch**: `002-proposal-workflow-reset` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-proposal-workflow-reset/spec.md`

## Summary

Remove the in-app proposal-template authoring workflow and refactor the floral proposal flow so the builder remains the system of record for pricing, line items, shopping-list, version, and reporting data while final client documents are supplied as florist-controlled PDFs. The implementation approach is to retire proposal-template routes/components/services and generated-PDF orchestration, introduce an explicit finalize/edit/resubmit state flow in the builder and workflow service, add a document-submission modal centered on manual PDF upload with optional Canva import only when available, and preserve the existing client approval or decline cycle after submission.

## Technical Context

**Language/Version**: Angular 19 / TypeScript 5.8 for frontend work; Supabase Edge Functions TypeScript for proposal submission and client-response workflow updates.

**Primary Dependencies**: Angular Material/CDK, Supabase client, Supabase Edge Functions, Netlify, Angular SSR/Express, Karma/Jasmine, and existing proposal-related repositories/services under `src/app/core/supabase`. Existing Canva connection code may be reused only if it can support optional PDF import without reintroducing template-studio behavior.

**Storage**: Supabase Postgres (`floral_proposals`, `floral_proposal_line_items`, `floral_proposal_components`, `floral_proposal_shopping_lists`, `floral_proposal_shopping_list_items`, `document_templates`, `canva_connections`, `canva_oauth_sessions`), Supabase Storage bucket `floral-proposals`, and line-item image bucket `floral-proposal-line-items`. This feature is expected to remove template-authoring dependencies and may retire `document_templates` references where they no longer serve proposal submission.

**Testing**: Karma/Jasmine unit tests for builder, workflow service, modal, route/sidebar cleanup, proposal-access behavior, and any repository/service changes; focused integration checks for finalize, edit, document submission, decline, and resubmission paths touching Supabase edge-function boundaries.

**Target Platform**: Netlify-hosted Angular web application with CRM admin proposal workflow, client proposal-access portal, and Supabase backend services.

**Project Type**: Brownfield web application and CRM with public website, client portal, and CRM admin portal surfaces.

**Performance Goals**: Florists should be able to finalize proposal data and submit a client-ready PDF without waiting on server-side template rendering; document submission and client delivery should remain within normal CRM interaction expectations, with no new long-running in-app generation step.

**Constraints**: Preserve public website behavior; preserve client approval/decline workflow after submission; no frontend service-role secrets; manual PDF upload is the only required submission path in the initial release; Canva import must remain optional and must not block the release; replacement proposal documents must require proposal-data edit and re-finalization first; preserve future reporting, Stripe/payment-adjacent readiness, and financial traceability of proposal data.

**Scale/Scope**: Affects CRM admin routes and services for `floral-proposal-builder` and `proposal-templates`, shared proposal workflow services, proposal-related models, sidebar/navigation, Supabase proposal submission edge function, and possibly schema/repository cleanup for `document_templates` and `template_id` coupling. Preserves client-side proposal-auth and proposal-review surfaces while adapting them to florist-supplied PDFs instead of generated template PDFs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Surface classification**: CRM admin portal, client proposal-access portal, Supabase backend, and cross-cutting proposal workflow code. No intentional public website edits.
- **Brownfield preservation**: Preserve lead-to-builder entry, proposal calculations, line items, shopping lists, versioning, proposal data history, lead status progression, proposal-auth access, proposal-review response handling, and downstream client approval/decline behavior. Authorized removals: proposal-template routes, template-studio UI, template CRUD workflow, generated-template PDF workflow, and supporting renderer/template code paths no longer needed.
- **Supabase security**: Maintain approved client/server boundaries for proposal records, PDFs, passcodes, email delivery, and optional Canva connection state. If schema changes retire template data, document RLS expectations and ensure no client code gains service-role behavior. Uploaded PDFs remain in approved storage buckets and edge functions remain the only place where privileged email/passcode workflow occurs.
- **Testing plan**: Add focused Karma/Jasmine coverage for the builder finalize/edit state, document-submission modal, workflow-service payload changes, route/sidebar cleanup, proposal review continuity, and edge-function-facing service behavior. Include focused integration checks for finalize -> submit -> decline -> edit -> re-finalize -> resubmit.
- **Frontend boundary plan**: Work remains inside the current Angular app but must preserve logical boundaries between CRM admin proposal building and client proposal-access review. No frontend split is introduced.
- **Proposal workflow rule**: PASS. The plan explicitly preserves proposal-data calculation and invoice/planning continuity while making manual PDF upload the required primary submission path. Optional Canva import is secondary only.
- **Security and privacy**: No service-role keys or privileged secrets in frontend code. Proposal PDFs, client emails, passcodes, signatures, and customer data remain within approved Supabase and edge-function boundaries.

**Gate Result**: PASS. The feature is an explicitly authorized proposal-workflow refactor aligned with the constitution’s template-removal and manual-PDF direction.

## Project Structure

### Documentation (this feature)

```text
specs/002-proposal-workflow-reset/
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/
    proposal-document-submission-contract.md
  tasks.md
```

### Source Code (repository root)

```text
src/
  app/
    components/proposal-access/ # Client proposal auth/review surface
    components/private/
      floral-proposal-builder/  # CRM proposal builder entry and state flow
      proposal-templates/       # Retired template-studio and template CRUD workflow
    core/
      models/                   # Floral proposal and related workflow models
      proposal-templates/       # Template renderer/canva/template document code to retire or narrow
      supabase/
        repositories/           # Proposal/document template persistence boundaries
        services/               # Builder, renderer, workflow, and document services
  environments/

supabase/
  edge_functions/
    submit-floral-proposal.ts
    submit-floral-proposal-response.ts
    resend-floral-proposal-email.ts
    canva-connect.ts
  schemas/public/tables/
    floral_proposals.sql
    floral_proposal_line_items.sql
    floral_proposal_components.sql
    floral_proposal_shopping_lists.sql
    floral_proposal_shopping_list_items.sql
    document_templates.sql
    canva_connections.sql
    canva_oauth_sessions.sql
```

**Structure Decision**: Keep the refactor within the existing Angular CRM and proposal-access surfaces. Remove or narrow `src/app/components/private/proposal-templates` and `src/app/core/proposal-templates` as the template-authoring domain is retired. Preserve `floral-proposal-builder`, proposal-access components, and Supabase proposal tables as the long-lived proposal-data workflow. Update edge functions and repositories in place rather than introducing parallel proposal systems.

## Phase 0 Research

See [research.md](./research.md). All technical unknowns are resolved for planning:

- The initial release will treat manual PDF upload as the only required proposal-document submission path.
- Optional Canva import will be retained only if it can be decoupled from template-studio behavior; otherwise the first pass proceeds without blocking on it.
- Proposal finalization will become an explicit state distinct from draft and submitted, and resubmission after decline will require edit plus re-finalization.
- Generated HTML/PDF rendering, Gotenberg preview, and template-driven submission are retired from the primary workflow.
- Template schema cleanup should be staged to avoid breaking proposal history and client review, with active proposal data remaining authoritative in `floral_proposals` and related line-item tables.

## Phase 1 Design Artifacts

- Data model: [data-model.md](./data-model.md)
- Contract: [contracts/proposal-document-submission-contract.md](./contracts/proposal-document-submission-contract.md)
- Quickstart: [quickstart.md](./quickstart.md)
- Agent context: [AGENTS.md](../../AGENTS.md)

## Post-Design Constitution Check

- **Brownfield stability**: PASS. The design limits removals to the authorized proposal-template workflow and preserves lead entry, builder calculations, proposal history, and client review behavior.
- **Secure Supabase boundaries**: PASS. Proposal PDFs, passcodes, emails, and customer records remain behind existing storage and edge-function boundaries. No frontend secret expansion is introduced.
- **Tested CRM and proposal workflows**: PASS. Unit and integration coverage targets explicitly include finalize/edit/submission/resubmission transitions and proposal-access continuity.
- **Purpose-built frontend boundaries**: PASS. CRM admin and client proposal-access surfaces remain logically separate, with no public site impact.
- **Proposal workflow simplicity and financial traceability**: PASS. The design centers the builder as the record-keeping workflow and manual florist PDF submission as the required document path, while preserving future reporting and payment-readiness data.

## Complexity Tracking

No constitution violations are present. If any violation is introduced later, it requires explicit justification and product owner approval before implementation.
