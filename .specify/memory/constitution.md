<!--
Sync Impact Report
Version change: 1.1.0 -> 1.2.0
Modified principles:
- II. Secure Supabase Data Boundaries: require an executable SQL migration for
  every new or modified Supabase table schema
Added sections:
- None
Removed sections:
- None
Templates requiring updates:
- ✅ updated: .specify/templates/plan-template.md
- ✅ updated: .specify/templates/spec-template.md
- ✅ updated: .specify/templates/tasks-template.md
- ✅ verified not present: .specify/templates/commands/*.md
Runtime guidance updates:
- ✅ updated: README.md
Follow-up TODOs:
- None
-->

# Black Begonia Constitution

## Core Principles

### I. Brownfield Stability and Product Owner Approval
Black Begonia is a brownfield production application. Existing public website
behavior, routing, SEO metadata, page content, forms, and visual presentation
MUST remain untouched unless a feature specification explicitly authorizes the
change and the product owner approves it. Developer work MUST preserve current
functionality by default across the public website, client proposal access
surface, and CRM portal. Refactors MUST be scoped, named, justified, and tested;
incidental changes to finished workflows are constitution violations.

Rationale: The public website is largely complete and business-facing. Stability
is more valuable than opportunistic cleanup unless a planned feature needs the
change.

### II. Secure Supabase Data Boundaries
Supabase is the backend of record for the Black Begonia CRM engine, proposal
data, customer data, storage assets, and edge functions. Every new or changed
table MUST be designed with Row Level Security in mind before implementation.
Features that create or modify tables MUST document intended RLS policies,
allowed roles, edge-function access paths, and any storage bucket policies.
Every new or modified Supabase table schema MUST include a matching executable
SQL migration in `supabase/migrations/` as part of the same change. Updating a
declarative table definition alone is insufficient. The migration MUST contain
the statements needed to bring an existing Supabase environment to the intended
schema, preserve existing data unless a destructive change is explicitly
approved, and document any required application order or manual intervention.
Frontend code MUST NOT contain Supabase service-role keys or other privileged
secrets. Emails, proposal passcodes, signatures, payment-related records, and
customer data MUST be validated, minimized, and handled only through approved
client, server, or edge-function boundaries. Every Supabase Edge Function MUST
be a standalone deployment unit whose required application logic is contained
within that function's own directory. Edge functions MUST NOT create, use, or
import from an `_shared` directory, another edge function, or any local shared
function module. Generators, plans, and implementation tasks MUST NOT introduce
shared local edge-function code.

Rationale: The application stores sensitive lead, event, proposal, financial,
and customer response data. Security must be designed into the data model rather
than patched after release. Committed migrations make schema changes repeatable
and directly applicable to existing Supabase environments. Standalone functions
preserve independent deployment, make each function's security boundary
explicit, and prevent hidden runtime coupling between backend workflows.

### III. Tested CRM and Proposal Workflows
Karma/Jasmine unit testing is the default testing stack for Angular code. New
features MUST include focused unit tests for components, guards, services,
repositories, and workflow logic touched by the change. The project target is
at least 80% meaningful unit-test coverage, built incrementally from the current
brownfield baseline. Proposal, lead, and inquiry flows MUST also receive focused
integration checks when their behavior, data contracts, or edge-function
interactions change. Tests MUST cover success paths, important validation
failures, authorization boundaries, and state transitions.

Rationale: The CRM and proposal flows affect real business operations and client
trust. A growing system needs regression protection before larger architectural
changes are attempted.

### IV. Purpose-Built Frontend Boundaries
The target frontend architecture is three distinct experiences: public website,
client portal, and CRM admin portal. New architecture plans MUST evaluate
whether work belongs to the public site, client proposal/payment portal, or CRM
admin portal. Separation work SHOULD be staged behind explicit specifications,
with routing, authentication, deployment, shared libraries, environment config,
and Netlify build behavior planned before code movement begins. Until separation
is implemented, changes inside the single Angular application MUST preserve the
logical boundaries already represented by public, proposal-access, and private
admin routes.

Rationale: Separation can improve security, performance, and maintainability,
but a rushed migration could damage finished public pages or working CRM flows.

### V. Proposal Workflow Simplicity and Financial Traceability
The future proposal workflow MUST favor simple admin-controlled invoice and PDF
handling over dynamic in-app proposal template generation. The floral proposal
builder MUST remain a calculation, planning, and record-keeping workflow for
line items, catalog composition, markup, labor, tax regions, totals, shopping
lists, and later business reporting. Template-studio functionality, dynamic
template selection, and generated proposal PDFs MUST be removed only through a
planned refactor. Manual Canva-generated PDF upload MUST be the primary proposal
document path. Canva API import MAY be explored as a secondary path, but manual
drag-and-drop upload MUST remain available. Proposal data MUST be preserved for
future Stripe checkout, payment tracking, catalog usage metrics, dashboard
reporting, and tax preparation reporting.

Rationale: The florist's preferred creative workflow is Canva. The application
should support financial accuracy and client delivery without forcing complex
template authoring into the CRM.

## Current Project Context

Black Begonia is an Angular 19 brownfield web application for Black Begonia
Florals. The current single frontend hosts three logical surfaces:

- Public website routes for landing, about, portfolio, locations, services,
  workshops, testimonials, inquiries, privacy policy, terms, and SEO content.
- Client proposal-access routes for proposal authentication and review.
- CRM admin routes for dashboard, leads, contacts, organizations, projects,
  tasks, catalog items, tax regions, proposal builder, and proposal templates.

The backend uses Supabase schemas, storage, and edge functions for leads,
contacts, organizations, projects, catalog items, tax regions, activity logs,
document templates, Canva connections, portfolio content, floral proposals,
proposal line items, proposal components, shopping lists, email events, and
customer proposal responses.

The desired direction is to migrate toward separate public website, client
portal, and CRM admin frontend environments while preserving existing behavior
until a feature plan explicitly stages the migration.

## Architecture and Technology Constraints

Black Begonia's approved technology baseline is:

- Angular 19 with Angular Material/CDK for frontend application work.
- Supabase client, Supabase database, Supabase storage, and Supabase Edge
  Functions for backend workflows. Every edge function is self-contained; local
  `_shared` modules and imports between edge functions are prohibited. Table
  schema changes are delivered through executable SQL files in
  `supabase/migrations/`.
- Netlify deployment with Angular SSR/Express server build pieces where needed.
- FullCalendar for calendar experiences.
- Canva integration for proposal-document workflows where the API supports the
  business need.
- Mailgun/email workflows for inquiry, proposal, and notification flows.
- Karma/Jasmine for Angular unit tests.
- SEO route metadata and sitemap generation for public website discoverability.

Architecture decisions MUST favor explicit contracts, typed models, repository
or service boundaries already present in the codebase, and minimal disruption to
existing public and CRM behavior. Any proposal to introduce a new framework,
deployment model, database pattern, payment provider, PDF renderer, or frontend
split MUST be justified in the plan and approved before implementation.

## Development Workflow and Quality Gates

Every feature specification and implementation plan MUST classify its affected
surface as public website, client portal, CRM admin portal, Supabase backend, or
cross-cutting. Public website changes require product owner approval before code
edits.

Plans MUST document:

- Existing functionality that must remain unchanged.
- Data entities, RLS expectations, storage policies, and edge-function
  boundaries for Supabase changes, including confirmation that every affected
  edge function remains standalone and has no local shared-function dependency.
- The executable SQL migration path for every new or modified Supabase table,
  including data-preservation and deployment-order considerations.
- Unit-test and integration-check scope, including the path toward 80% coverage
  where relevant.
- Security considerations for secrets, customer data, emails, passcodes,
  signatures, proposal PDFs, and payment-related data.
- Deployment and environment impact for Netlify, SSR, and future separated
  frontend surfaces.
- For proposal work, whether the change preserves the invoice/planning data
  flow, manual PDF upload path, and future reporting/payment data needs.

Implementation MUST proceed in small, reviewable increments. Refactors that
remove template-studio behavior, split frontends, or alter proposal delivery
MUST be planned as dedicated features with migration steps, rollback
considerations, and regression tests.

## Governance

This constitution supersedes ad hoc developer preference for Black Begonia work.
When it conflicts with a feature request, the conflict MUST be identified in the
specification or plan before implementation.

Amendments require product owner approval and a documented Sync Impact Report in
this file. Versioning follows semantic versioning:

- MAJOR: Removes or redefines a core principle or governance rule.
- MINOR: Adds a new principle, required section, or materially expands project
  constraints.
- PATCH: Clarifies wording without changing obligations.

Compliance is reviewed during Spec Kit planning, task generation, and code
review. Plans that violate a principle MUST document the violation, explain why
it is necessary, and name the simpler or safer alternative that was rejected.

**Version**: 1.2.0 | **Ratified**: 2026-06-02 | **Last Amended**: 2026-06-27
