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
records where applicable; document table, migration SQL, RLS, and storage policy
impact.

**Testing**: Karma/Jasmine unit tests for affected Angular code and focused
PostgreSQL integration tests for affected migrations, RLS, functions, and data
contracts. Do not create automated tests for Supabase Edge Functions; validate
each affected function by independent type-checking and documented
provider/customer sandbox smoke checks.

**Target Platform**: Netlify-hosted Angular web application with SSR/server
build pieces as needed, plus Supabase backend services.

**Project Type**: Brownfield web application and CRM with public website,
client portal, and CRM admin portal surfaces.

**Performance Goals**: [Domain-specific performance goal or NEEDS CLARIFICATION]

**Constraints**: Preserve brownfield behavior unless explicitly approved; no
frontend service-role secrets; Supabase RLS and storage policies required for
data changes; every new or modified table schema requires an executable SQL
migration in `supabase/migrations/`; every Supabase Edge Function must be
standalone with no `_shared` directory or local cross-function imports; public
site changes require product owner approval; automated tests targeting Supabase
Edge Functions are prohibited; AI agents must not run git commit or push
commands.

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
- **Schema migration**: Identify the executable `supabase/migrations/*.sql` file
  that applies every new or modified table schema to an existing environment;
  describe data preservation, application order, and any manual intervention.
- **Standalone edge functions**: Confirm every affected Supabase Edge Function
  is independently deployable and contains no `_shared` directory, local shared
  function module, or import from another edge function. Confirm no automated
  test file or harness targets, imports, invokes, or simulates an Edge Function.
- **Testing plan**: Define Karma/Jasmine unit tests for Angular code and focused
  PostgreSQL integration tests for affected database workflows. Explain how the
  Angular work contributes toward the 80% coverage target. For each affected
  Edge Function, define independent type-check and documented provider/customer
  sandbox smoke validation without automated Edge Function tests.
- **Frontend boundary plan**: State whether the work affects the future public
  website, client portal, or CRM admin separation. For migration work, include
  staged routing, auth, deployment, shared code, and rollback considerations.
- **Proposal workflow rule**: If proposal functionality is touched, preserve the
  invoice/planning data flow and manual Canva PDF upload direction unless the
  approved spec explicitly says otherwise.
- **Security and privacy**: Confirm no service-role keys or privileged secrets
  enter frontend code, and describe handling for emails, proposal passcodes,
  signatures, customer data, PDFs, and payment-related records.
- **Git publication boundary**: Confirm the AI agent will not run `git commit`,
  `git push`, or commit/push-capable automation. Record any source-control
  summary or suggested commit message as human handoff only.

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
  migrations/                   # Executable SQL for every table schema change
  schemas/public/tables/        # Supabase table definitions
  edge_functions/               # Standalone Supabase Edge Functions; no _shared
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
