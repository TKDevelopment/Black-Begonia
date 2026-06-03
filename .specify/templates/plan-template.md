# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See
`.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

**Language/Version**: Angular 19 / TypeScript 5.8 for frontend work; Supabase
Edge Functions TypeScript where backend edge code is involved, or NEEDS
CLARIFICATION if the feature introduces a different runtime.

**Primary Dependencies**: Angular Material/CDK, Supabase client, Supabase Edge
Functions, Netlify, Angular SSR/Express, Karma/Jasmine, and any feature-specific
libraries such as FullCalendar, Canva, GrapesJS, or Mailgun.

**Storage**: Supabase Postgres, Supabase Storage, and edge-function-managed
records where applicable; document table, RLS, and storage policy impact.

**Testing**: Karma/Jasmine unit tests by default; focused integration checks for
proposal, lead, inquiry, Supabase, and edge-function flows when touched.

**Target Platform**: Netlify-hosted Angular web application with SSR/server
build pieces as needed, plus Supabase backend services.

**Project Type**: Brownfield web application and CRM with public website,
client portal, and CRM admin portal surfaces.

**Performance Goals**: [Domain-specific performance goal or NEEDS CLARIFICATION]

**Constraints**: Preserve brownfield behavior unless explicitly approved; no
frontend service-role secrets; Supabase RLS and storage policies required for
data changes; public site changes require product owner approval.

**Scale/Scope**: [Feature scope, affected routes, affected tables, users, and
operational workflows or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Surface classification**: Identify whether the feature touches the public
  website, client portal, CRM admin portal, Supabase backend, or cross-cutting
  code. Public website changes require product owner approval before edits.
- **Brownfield preservation**: List existing routes, components, services,
  edge functions, tables, and behaviors that MUST remain unchanged.
- **Supabase security**: For any database/storage/edge-function change,
  document RLS intent, role access, storage policies, secret handling, and
  frontend/backend data boundaries.
- **Testing plan**: Define Karma/Jasmine unit tests and any focused integration
  checks required for proposal, lead, inquiry, or authorization flows. Explain
  how the work contributes toward the 80% coverage target.
- **Frontend boundary plan**: State whether the work affects the future public
  website, client portal, or CRM admin separation. For migration work, include
  staged routing, auth, deployment, shared code, and rollback considerations.
- **Proposal workflow rule**: If proposal functionality is touched, preserve the
  invoice/planning data flow and manual Canva PDF upload direction unless the
  approved spec explicitly says otherwise.
- **Security and privacy**: Confirm no service-role keys or privileged secrets
  enter frontend code, and describe handling for emails, proposal passcodes,
  signatures, customer data, PDFs, and payment-related records.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/
  tasks.md
```

### Source Code (repository root)

```text
src/
  app/
    components/public/          # Public website routes and content
    components/proposal-access/ # Client proposal access surface
    components/private/         # CRM admin portal
    core/                       # Auth, guards, models, SEO, Supabase services
    shared/                     # Shared public/private UI primitives
  environments/                 # Environment config

supabase/
  schemas/public/tables/        # Supabase table definitions
  edge_functions/               # Supabase Edge Functions
  s3_storage/                   # Storage bucket organization

scripts/                        # Build and sitemap helpers
.specify/                       # Spec Kit memory, templates, workflows
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., public site edit before approval] | [current need] | [why deferring or isolating change is insufficient] |
| [e.g., frontend split migration] | [specific problem] | [why route-level isolation in current app is insufficient] |
