# Implementation Plan: Unit Test Coverage

**Branch**: `001-unit-test-coverage` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-unit-test-coverage/spec.md`

## Summary

Expand the Angular frontend unit test suite so eligible application code reaches at least 80% statement, branch, function, and line coverage overall and at least 80% for each critical workflow area: inquiry, lead generation/CRM, proposal building/review, and authorization/access. The latest coverage report shows 63.29% statements, 40.08% branches, 63.58% functions, and 64.81% lines, so the next implementation pass must prioritize branch-heavy gaps in Supabase repositories, CRM contacts/organizations/tasks pages, CRM modals, proposal template renderer/studio behavior, lead detail/proposal builder conditionals, and public auth/portfolio pages. The technical approach is to make untested eligible source visible to coverage reporting, extend existing `.spec.ts` files where present, add missing unit specs for eligible behavioral units, use synthetic fixtures and controlled test doubles for Supabase and browser dependencies, and document any exclusions.

## Technical Context

**Language/Version**: Angular 19.2.x / TypeScript 5.8.x for frontend application code.

**Primary Dependencies**: Angular Material/CDK, Supabase client, Angular Router, RxJS, Karma/Jasmine, karma-coverage, FullCalendar where calendar-adjacent units are touched, Canva and GrapesJS-related code only through mocked proposal-template dependencies.

**Storage**: No database, storage bucket, or edge-function schema changes. Supabase-facing tests use mocked repositories, mocked Supabase clients, and synthetic records only.

**Testing**: Karma/Jasmine unit tests. The implementation must run `npm run test -- --watch=false --browsers=ChromeHeadless --code-coverage` or an equivalent project script that produces a coverage report and clear pass/fail result.

**Target Platform**: Netlify-hosted Angular web application with public website, proposal-access/client portal, and CRM admin surfaces. Unit tests run in the Angular/Karma browser test environment.

**Project Type**: Brownfield Angular web application and CRM frontend.

**Performance Goals**: The complete unit suite should finish in under 10 minutes on a typical development machine while producing coverage output.

**Constraints**: Preserve brownfield behavior; do not alter public copy, styling, routing, SEO, Supabase schemas, RLS policies, storage policies, or edge functions unless a failing test exposes a separately approved defect. No production credentials, real customer data, service-role keys, live email delivery, or live network dependencies in tests.

**Scale/Scope**: Approximately 222 frontend TypeScript files and 70 existing `.spec.ts` files were observed at planning time. Current coverage is 63.29% statements (3154/4983), 40.08% branches (1203/3001), 63.58% functions (716/1126), and 64.81% lines (3037/4686). Reaching 80% requires roughly 833 additional covered statements, 1,198 additional covered branches, 185 additional covered functions, and 712 additional covered lines. Scope is eligible frontend code under `src/app` plus environment-dependent behavior under `src/environments` where it changes runtime behavior. Critical workflow coverage buckets are inquiry, lead generation/CRM, proposal building/review, and authorization/access.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Surface classification**: Cross-cutting frontend quality feature touching public website units, proposal-access units, CRM admin units, shared UI, route guards, and frontend service layers through tests only.
- **Brownfield preservation**: Public website routes and content, proposal authentication/review, CRM lead/contact/project/task behavior, Supabase repositories/services, and proposal builder/template behavior must remain unchanged except for minimal testability fixes approved during implementation.
- **Supabase security**: No Supabase schema/storage/edge-function change. Tests must mock Supabase clients, repositories, edge-function invocations, storage calls, and auth/session responses. Synthetic emails, passcodes, signatures, proposal IDs, PDFs, and payment-adjacent records only.
- **Testing plan**: Use Karma/Jasmine to expand or add specs for components, guards, services, repositories, workflow helpers, and shared UI. Measure 80% overall coverage and 80% per critical workflow area. Include success, validation failure, dependency failure, loading, empty, permission denial, and user-feedback paths where present.
- **Frontend boundary plan**: This work reinforces current logical boundaries but does not split frontends or move code. Tests should preserve public website, proposal access/client portal, and CRM admin route boundaries.
- **Proposal workflow rule**: Proposal tests must preserve the invoice/planning data flow, proposal builder calculations, proposal review behavior, and manual Canva PDF upload direction. Template-studio removal or proposal delivery changes are out of scope.
- **Security and privacy**: No frontend service-role secrets or privileged secrets. Test fixtures must be synthetic and must not include real customer records, emails, proposal passcodes, signatures, PDFs, or payment records.

**Gate Result**: PASS. The plan adds tests and coverage reporting without changing production behavior or data boundaries.

## Project Structure

### Documentation (this feature)

```text
specs/001-unit-test-coverage/
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/
    coverage-report-contract.md
  tasks.md
```

### Source Code (repository root)

```text
src/
  app/
    components/public/          # Public website and inquiry units
    components/proposal-access/ # Client proposal auth/review units
    components/private/         # CRM admin and proposal builder units
    core/                       # Auth, guards, models, Supabase services/repositories
    shared/                     # Shared public/private UI primitives
  environments/                 # environment.ts, environment.dev.ts, environment.prod.ts

angular.json                    # Angular Karma test target
tsconfig.spec.json              # Test TypeScript config
```

**Structure Decision**: Keep tests beside the units they validate, reusing existing `.spec.ts` files when present. Add shared test fixtures/helpers only when repeated setup appears across workflow specs and place them close to the tested domain, such as `src/app/core/testing` or local `testing` folders, following existing project style.

## Phase 0 Research

See [research.md](./research.md). All technical unknowns are resolved for planning:

- Coverage reporting should include untested eligible source files.
- Critical workflow buckets should be measured through a coverage manifest and report review.
- Branch-heavy follow-up work should start with the latest uncovered backlog: Supabase repositories, CRM contacts/organizations/tasks pages, CRM modals, proposal template renderer/studio behavior, lead detail/proposal builder conditionals, and public auth/portfolio pages.
- Supabase, auth, storage, email, Canva, browser, and router dependencies should be mocked with typed test doubles.
- Environment-specific behavior should be tested only where behavior differs across `environment.ts`, `environment.dev.ts`, and `environment.prod.ts`.

## Phase 1 Design Artifacts

- Data model: [data-model.md](./data-model.md)
- Coverage contract: [contracts/coverage-report-contract.md](./contracts/coverage-report-contract.md)
- Quickstart: [quickstart.md](./quickstart.md)
- Agent context: [AGENTS.md](../../AGENTS.md)

## Post-Design Constitution Check

- **Brownfield stability**: PASS. Design artifacts require tests and optional testability fixes only.
- **Secure Supabase boundaries**: PASS. No schema or policy changes; all external dependencies are mocked.
- **Tested CRM and proposal workflows**: PASS. Critical workflow buckets and 80% per-area target are explicit.
- **Purpose-built frontend boundaries**: PASS. Public, proposal-access, and CRM admin surfaces remain logically separated.
- **Proposal workflow simplicity and traceability**: PASS. Proposal builder and review coverage preserve existing planning and manual document direction.
- **Latest coverage gap alignment**: PASS. Design artifacts prioritize the current branch deficit and high-impact uncovered workflow areas without authorizing production behavior changes.

## Complexity Tracking

No constitution violations require justification.
