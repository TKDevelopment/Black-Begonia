# Coverage Manifest

**Captured**: 2026-06-02

## Scope

Eligible frontend code is application behavior under `src/app` plus environment-dependent behavior under `src/environments` where behavior differs by runtime context.

## Counts

| Category | Count |
|----------|-------|
| Non-spec TypeScript files under `src/app` | 152 |
| Existing `.spec.ts` files under `src/app` | 70 |
| Environment TypeScript files under `src/environments` | 3 |

## Critical Workflow Buckets

### Inquiry

Representative eligible units:

- `src/app/core/supabase/services/inquiry.service.ts`
- `src/app/components/public/general-inquiries/general-inquiries.component.ts`
- `src/app/components/public/wedding-inquiries/wedding-inquiries.component.ts`
- `src/app/components/public/inquiries/inquiries.component.ts`
- `src/app/components/public/inquiries/inquiry-success/inquiry-success.component.ts`

Existing specs:

- `src/app/core/supabase/services/inquiry.service.spec.ts`
- `src/app/components/public/general-inquiries/general-inquiries.component.spec.ts`
- `src/app/components/public/wedding-inquiries/wedding-inquiries.component.spec.ts`
- `src/app/components/public/inquiries/inquiries.component.spec.ts`
- `src/app/components/public/inquiries/inquiry-success/inquiry-success.component.spec.ts`

Current inquiry bucket evidence:

- `src/app/components/public/general-inquiries/general-inquiries.component.spec.ts` covers SEO setup, invalid required-field submission, successful lead payload creation, inspiration URL persistence, email trigger invocation, success toast/navigation, and repository failure feedback using mocked dependencies.
- `src/app/components/public/wedding-inquiries/wedding-inquiries.component.spec.ts` covers SEO setup, invalid required-field submission, service-type budget reset behavior, successful lead payload creation, inspiration URL persistence, email trigger invocation, success toast/navigation, and repository failure feedback using mocked dependencies.
- `src/app/components/public/inquiries/inquiries.component.spec.ts` covers inquiry choice rendering and route-link targets for wedding and general inquiry forms.
- `src/app/components/public/inquiries/inquiry-success/inquiry-success.component.spec.ts` covers success confirmation copy, next-step copy, and return-home route link.
- `src/app/core/supabase/services/inquiry.service.ts` has no executable behavior beyond construction at this point; success/failure service tests are deferred until the service owns workflow logic.

Inquiry bucket verification notes:

- Success paths covered: general inquiry submission, wedding inquiry submission, lead payload mapping, inspiration URL persistence, email trigger intent, success toast, and success navigation.
- Failure paths covered: required-field validation, invalid form feedback, wedding service-type dependent budget reset, and lead repository failure feedback.
- Remaining gap: `InquiryService` is currently construction-only; the spec now documents that no executable success/failure workflow methods exist yet, and inquiry workflow behavior is covered through the public inquiry components.

### Lead Generation/CRM

Representative eligible units:

- `src/app/core/supabase/services/lead-workflow.service.ts`
- `src/app/core/supabase/services/lead-conversion.service.ts`
- `src/app/core/supabase/repositories/lead-repository.service.ts`
- `src/app/components/private/leads/leads.component.ts`
- `src/app/components/private/leads/lead-detail/lead-detail.component.ts`
- `src/app/components/private/leads/components/lead-convert-modal/lead-convert-modal.component.ts`
- `src/app/components/private/leads/components/lead-decline-modal/lead-decline-modal.component.ts`
- `src/app/components/private/leads/components/lead-status-selector/lead-status-selector.component.ts`
- `src/app/components/private/leads/components/lead-upsert-modal/lead-upsert-modal.component.ts`
- `src/app/components/private/leads/components/lead-note-modal/lead-note-modal.component.ts`
- `src/app/components/private/leads/components/lead-proposal-history-card/lead-proposal-history-card.component.ts`

Existing specs:

- `src/app/core/supabase/services/lead-workflow.service.spec.ts`
- `src/app/core/supabase/services/lead-conversion.service.spec.ts`
- `src/app/core/supabase/repositories/lead-repository.service.spec.ts`
- `src/app/components/private/leads/leads.component.spec.ts`
- `src/app/components/private/leads/lead-detail/lead-detail.component.spec.ts`
- `src/app/components/private/leads/components/lead-convert-modal/lead-convert-modal.component.spec.ts`
- `src/app/components/private/leads/components/lead-decline-modal/lead-decline-modal.component.spec.ts`
- `src/app/components/private/leads/components/lead-status-selector/lead-status-selector.component.spec.ts`

Current lead generation/CRM bucket evidence:

- Shared fixtures in `src/app/core/testing/workflow-fixtures.ts` include baseline, general, wedding, proposal-accepted, and converted lead states plus general/wedding upsert payloads and proposal-response activity metadata for deterministic workflow assertions.
- `src/app/core/supabase/services/lead-workflow.service.spec.ts` covers mark-contacted updates, allowed and invalid status transitions, decline behavior, consultation scheduling/completion, closed-unbooked reopening, activity logging intent, consultation labels, disabled-state helpers, and allowed next statuses with mocked repositories.
- `src/app/core/supabase/services/lead-conversion.service.spec.ts` covers accepted lead conversion, primary/partner/planner contact creation, project creation, project-contact linking, source lead conversion updates, conversion activity metadata, non-accepted lead rejection, project creation failure behavior, and default project naming with mocked repositories.
- `src/app/core/supabase/repositories/lead-repository.service.spec.ts` covers lead list and detail queries, general and wedding lead normalization, create/update/delete success paths, create/update/delete failure paths, and repository-specific error logging with mocked Supabase query chains.
- `src/app/components/private/leads/leads.component.spec.ts` covers lead list loading, empty state, load failure reset behavior, filters, proposal and proposal-response mapping, lead navigation, and manual lead creation success/failure behavior with mocked repositories, router, and toast.
- `src/app/components/private/leads/lead-detail/lead-detail.component.spec.ts` covers route-driven detail loading, not-found handling, mark-contacted, consultation, proposal navigation, proposal resend, conversion, decline, status update, reopen, edit, internal note, task, and delete workflows with mocked repositories, workflow services, router, and toast.
- `src/app/components/private/leads/components/lead-convert-modal/lead-convert-modal.component.spec.ts` covers conversion modal hydration, source lead rendering, partner/planner summary rendering, trimmed payload emission, close reset, and saving guards.
- `src/app/components/private/leads/components/lead-decline-modal/lead-decline-modal.component.spec.ts` covers modal open/closed rendering, trimmed reason emission, close reset, and saving guards.
- `src/app/components/private/leads/components/lead-status-selector/lead-status-selector.component.spec.ts` covers option rendering, label formatting, status-change emission, and disabled-state input handling.
- `src/app/components/private/leads/components/lead-upsert-modal/lead-upsert-modal.component.spec.ts` covers create/edit rendering, lead hydration, event/service coordination, required and invalid input validation, normalized payload emission, and close/save guards.
- `src/app/components/private/leads/components/lead-note-modal/lead-note-modal.component.spec.ts` covers open/closed rendering, required note validation, trimmed note emission, reset behavior, and saving guards.
- `src/app/components/private/leads/components/lead-proposal-history-card/lead-proposal-history-card.component.spec.ts` covers proposal history empty state, selected proposal resolution, version/active/response rendering, select/open/resend/submit events, resend guard, date formatting, signed-preview sanitization, and latest-response lookup.

Missing specs:

- None currently identified for the lead generation/CRM bucket component list.

Lead generation/CRM bucket verification notes:

- Success paths covered: lead creation, list loading, filtering, detail loading, manual lead creation, status updates, mark-contacted, consultation scheduling/completion, decline, reopen, conversion, proposal access resend, internal notes, related tasks, and deletion.
- Failure paths covered: repository query/mutation errors, load failures, invalid status transitions, consultation and reopen rejection paths, non-accepted lead conversion rejection, project creation failure, manual creation failure, proposal resend failure, and linked-record deletion failure.
- Remaining gap: focused bucket coverage percentages are pending T040.

### Proposal Building/Review

Representative eligible units:

- `src/app/core/supabase/services/floral-proposal-builder.service.ts`
- `src/app/core/supabase/services/floral-proposal-workflow.service.ts`
- `src/app/core/supabase/services/floral-proposal-renderer.service.ts`
- `src/app/core/supabase/services/document-template.service.ts`
- `src/app/core/supabase/repositories/floral-proposal-repository.service.ts`
- `src/app/core/supabase/repositories/document-template-repository.service.ts`
- `src/app/core/proposal-access/proposal-access.service.ts`
- `src/app/core/proposal-templates/proposal-template-document.service.ts`
- `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.ts`
- `src/app/components/private/proposal-templates/proposal-templates.component.ts`
- `src/app/components/private/proposal-templates/template-studio/proposal-template-studio.component.ts`
- `src/app/components/proposal-access/proposal-auth/proposal-auth.component.ts`
- `src/app/components/proposal-access/proposal-review/proposal-review.component.ts`

Existing specs:

- `src/app/core/supabase/services/floral-proposal-builder.service.spec.ts`
- `src/app/core/supabase/services/floral-proposal-workflow.service.spec.ts`
- `src/app/core/supabase/services/floral-proposal-renderer.service.spec.ts`
- `src/app/core/supabase/repositories/floral-proposal-repository.service.spec.ts`
- `src/app/core/supabase/services/document-template.service.spec.ts`
- `src/app/core/proposal-templates/proposal-template-document.service.spec.ts`
- `src/app/core/proposal-access/proposal-access.service.spec.ts`
- `src/app/components/proposal-access/proposal-auth/proposal-auth.component.spec.ts`
- `src/app/components/proposal-access/proposal-review/proposal-review.component.spec.ts`
- `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts`
- `src/app/components/private/proposal-templates/proposal-templates.component.spec.ts`

Current proposal building/review bucket evidence:

- Shared fixtures in `src/app/core/testing/workflow-fixtures.ts` include reusable synthetic proposal, proposal line item, proposal component, proposal shopping-list item, document template, tax region, catalog item, proposal access session, and render contract records for deterministic proposal workflow assertions.
- Shared proposal test doubles in `src/app/core/testing/proposal-testing.ts` include browser popup, Canva popup, storage bucket, synthetic image file, and synthetic PDF file helpers for deterministic proposal workflow dependency assertions.
- `src/app/core/supabase/services/floral-proposal-builder.service.spec.ts` covers proposal builder defaults, component catalog application, pack-based pricing, component and line recalculation, totals, render payloads, persistence payloads, shopping-list aggregation, persisted proposal hydration, and line type labels.
- `src/app/core/supabase/services/floral-proposal-workflow.service.spec.ts` covers lead proposal loading, PDF signing fallback behavior, submit eligibility, line-item image upload/removal/signing, missing image cleanup, submit/preview/resend edge-function success and failure paths, render contract assembly, and submission payload construction with mocked Supabase, repository, renderer, and template dependencies.
- `src/app/core/supabase/services/floral-proposal-renderer.service.spec.ts` covers delegation to the scene renderer and error propagation.
- `src/app/core/supabase/repositories/floral-proposal-repository.service.spec.ts` covers proposal queries, joined template normalization, line item/component queries, proposal create/update success and failure paths, line item/component replacement, line-item image clearing, and shopping-list upsert behavior with mocked Supabase query chains.
- `src/app/core/supabase/services/document-template.service.spec.ts` covers repository delegation, activation/deactivation, deletion logo cleanup, logo/asset upload and removal, signed URL error handling, and template asset refresh fallback behavior with mocked storage dependencies.
- `src/app/core/proposal-templates/proposal-template-document.service.spec.ts` covers stored config parsing, default document fallback, draft/published config creation, template config cleanup, asset URL resolution, document validation, table-cell normalization, text segment helpers, sample preview data, and clone behavior.
- `src/app/core/proposal-access/proposal-access.service.spec.ts` covers session hydration, expired/malformed session cleanup, access verification, credential normalization, accepted and declined response submission payloads, duplicate/no-session guards, edge-function failures, response-state helpers, and session clearing.
- `src/app/components/proposal-access/proposal-auth/proposal-auth.component.spec.ts` covers valid-session redirect, no-session form rendering, invalid email/passcode validation, successful access verification and review navigation, loading-state copy, verification errors, and fallback failure messaging.
- `src/app/components/proposal-access/proposal-review/proposal-review.component.spec.ts` covers invalid-session redirect, proposal metadata and PDF rendering, missing-preview messaging, already-responded state, accept validation/submission/failure behavior, decline validation/submission/fallback errors, date fallbacks, and secure sign-out.
- `src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts` covers builder route handling, load/retry/error states, editable line item workflows, catalog composition, shopping-list reserve behavior, draft persistence intent, activity logging, preview/submit success and failure paths, line-item image handling, and export-popup behavior.
- `src/app/components/private/proposal-templates/proposal-templates.component.spec.ts` covers template registry loading, trashed-template filtering, search, load errors and retry, create/edit modal state, create/update payloads, stored-config rebuilds, activate/deactivate, delete confirmation and foreign-key errors, studio navigation, and renderer-label fallback.

Missing specs:

- `src/app/core/supabase/repositories/document-template-repository.service.spec.ts`

Proposal building/review bucket verification notes:

- Success paths covered: proposal builder defaults and pricing calculations, proposal hydration, render payload creation, shopping-list aggregation, repository query/mutation intent, template activation and asset handling, document config parsing and validation, proposal access verification, client auth/review rendering, builder load/edit/save/preview/submit/export workflows, proposal template list create/update/toggle/delete/navigation flows, and deterministic browser/storage/Canva dependency doubles.
- Failure paths covered: invalid builder inputs, proposal and template repository failures, storage upload/signing/removal failures, edge-function preview/submit/resend failures, invalid or expired access sessions, duplicate/no-session response guards, client auth validation and verification errors, client review validation and response failures, builder load/save/preview/submit errors, invalid line-item image drops, template list load/save/toggle/delete failures, and foreign-key delete error mapping.
- Remaining gaps: `src/app/core/supabase/repositories/document-template-repository.service.spec.ts` is still missing and `src/app/components/private/proposal-templates/template-studio/proposal-template-studio.component.ts` remains a representative proposal surface that will need either behavioral tests or an approved exclusion during the remaining coverage pass.
- Coverage status: T055 must run the focused proposal spec set and record the imported-code coverage summary before the proposal bucket checkpoint can be evaluated against the 80% acceptance target.

### Authorization/Access

Representative eligible units:

- `src/app/core/auth/auth.service.ts`
- `src/app/core/guards/auth.guard.ts`
- `src/app/core/guards/guest.guard.ts`
- `src/app/core/guards/admin-role.guard.ts`
- `src/app/core/guards/proposal-access.guard.ts`
- `src/app/core/proposal-access/proposal-access.service.ts`

Existing specs:

- `src/app/core/auth/auth.service.spec.ts`
- `src/app/core/guards/auth.guard.spec.ts`
- `src/app/core/guards/guest.guard.spec.ts`
- `src/app/core/guards/admin-role.guard.spec.ts`
- `src/app/core/guards/proposal-access.guard.spec.ts`
- `src/app/core/proposal-access/proposal-access.service.spec.ts`

Current authorization/access bucket evidence:

- `src/app/core/auth/auth.service.spec.ts` covers browser/server initialization, session hydration, active profile and role loading, initialization failure reset behavior, normalized login payloads, internal-user CRM navigation, non-internal login denial and cleanup, login error handling, logout cleanup/redirect behavior, sign-out failure logging, password reset email normalization, and password update error handling with mocked Supabase and router dependencies.
- `src/app/core/guards/auth.guard.spec.ts` covers server-side allow behavior, browser initialization before decisions, authenticated allow behavior, unauthenticated login redirects, and child-route parity.
- `src/app/core/guards/guest.guard.spec.ts` covers server-side allow behavior, browser initialization before decisions, guest allow behavior, and authenticated internal-user dashboard redirects.
- `src/app/core/guards/admin-role.guard.spec.ts` covers server-side allow behavior, browser initialization before decisions, unauthenticated redirects, non-internal redirects, internal allow behavior, and child-route parity.
- `src/app/core/guards/proposal-access.guard.spec.ts` covers valid proposal access session allow behavior and missing/invalid session redirect behavior.
- `src/app/core/proposal-access/proposal-access.service.spec.ts` covers client proposal session hydration, access verification, response submission, duplicate/no-session guards, edge-function failures, and session clearing.

Missing specs:

- None currently identified for the authorization/access bucket component list.

Authorization/access bucket verification notes:

- Success paths covered: internal-user authentication initialization, CRM login navigation, password reset/update delegation, authenticated route allow behavior, guest route allow behavior, admin route allow behavior, proposal access session allow behavior, proposal access verification, accepted/declined proposal responses, and session clearing.
- Failure paths covered: initialization failure reset, login failure messaging, non-internal login denial, logout sign-out failure logging, unauthenticated route redirects, non-internal admin redirects, missing proposal access session redirects, invalid proposal access credentials, duplicate/no-session response guards, and proposal response edge-function failures.
- Remaining gap: T070 must record the focused authorization coverage checkpoint before the authorization bucket is complete.

### Environment-Specific Behavior

Representative eligible units:

- `src/app/core/supabase/clients/supabase.service.ts`
- `src/environments/environment.ts`
- `src/environments/environment.dev.ts`
- `src/environments/environment.prod.ts`

Existing specs:

- `src/app/core/supabase/clients/supabase.service.spec.ts`
- `src/environments/environment.spec.ts`
- `src/environments/environment.dev.spec.ts`
- `src/environments/environment.prod.spec.ts`

Current environment bucket evidence:

- `src/app/core/supabase/clients/supabase.service.spec.ts` covers service construction with the default synthetic test configuration, missing Supabase URL/key validation errors, session lookup failure logging/null return behavior, user lookup failure logging/null return behavior, and sign-out error logging/rethrow behavior.
- `src/environments/environment.spec.ts` covers default synthetic Supabase credentials, default production/bypassAuth placeholders, and placeholder browser integration keys used by tests.
- `src/environments/environment.dev.spec.ts` covers development-only `production: false`, `bypassAuth: true`, the `supabaseAnonKey` shape consumed by `SupabaseService`, and deterministic Google integration placeholders.
- `src/environments/environment.prod.spec.ts` covers production-only `production: true`, `bypassAuth: false`, required Supabase config keys, absence of the legacy `supabaseKey` shape, and deploy-time placeholders for externally supplied keys.

Environment bucket verification notes:

- Runtime differences covered: default uses synthetic Supabase values for deterministic tests, development enables auth bypass while remaining non-production, and production disables auth bypass while preserving deploy-time placeholders for secrets/configuration.
- Failure paths covered: missing Supabase URL, missing Supabase anon key, failed session lookup, failed user lookup, and failed sign-out behavior.
- Config drift fixed during US4: `src/environments/environment.dev.ts` now exposes `supabaseAnonKey`, matching the key read by `SupabaseService`.
- Remaining gap: T061 must run and record the focused environment coverage checkpoint before the environment bucket is complete.

## Existing Spec Quality

Initial heuristic scan flagged all 70 existing specs as likely shallow or creation-first candidates. A US1 review pass on 2026-06-02 classified specs with only one creation/truthy assertion as creation-only and specs with additional assertions as behavior-started.

Current reviewed status:

| Status | Count | Notes |
|--------|-------|-------|
| Behavior-started existing specs | 17 | App shell, layouts, shared public header/footer, toast, and selected shared private UI specs now include behavioral assertions. |
| Creation-only existing specs | 53 | Still require workflow, rendering, validation, guard, repository, or service behavior coverage before counting as sufficient evidence. |

Behavior-started existing specs:

- `src/app/app.component.spec.ts`
- `src/app/core/layouts/private-layout/private-layout.component.spec.ts`
- `src/app/core/layouts/public-layout/public-layout.component.spec.ts`
- `src/app/core/services/toast.service.spec.ts`
- `src/app/shared/components/private/confirm-dialog/confirm-dialog.component.spec.ts`
- `src/app/shared/components/private/empty-state/empty-state.component.spec.ts`
- `src/app/shared/components/private/entity-detail-shell/entity-detail-shell.component.spec.ts`
- `src/app/shared/components/private/entity-table-shell/entity-table-shell.component.spec.ts`
- `src/app/shared/components/private/error-state-block/error-state-block.component.spec.ts`
- `src/app/shared/components/private/loading-state-block/loading-state-block.component.spec.ts`
- `src/app/shared/components/private/search-filter-bar/search-filter-bar.component.spec.ts`
- `src/app/shared/components/private/sidebar/sidebar.component.spec.ts`
- `src/app/shared/components/private/status-badge/status-badge.component.spec.ts`
- `src/app/shared/components/private/task-list-panel/task-list-panel.component.spec.ts`
- `src/app/shared/components/public/footer/footer.component.spec.ts`
- `src/app/shared/components/public/header/header.component.spec.ts`
- `src/app/shared/components/toast/toast.component.spec.ts`

Creation-only existing specs remaining:

- `src/app/components/private/calendar/calendar.component.spec.ts`
- `src/app/components/private/contacts/contacts.component.spec.ts`
- `src/app/components/private/dashboard/dashboard.component.spec.ts`
- `src/app/components/private/organizations/organizations.component.spec.ts`
- `src/app/components/private/projects/projects.component.spec.ts`
- `src/app/components/private/projects/components/project-contacts-panel/project-contacts-panel.component.spec.ts`
- `src/app/components/private/projects/components/project-organizations-panel/project-organizations-panel.component.spec.ts`
- `src/app/components/private/projects/components/project-summary-card/project-summary-card.component.spec.ts`
- `src/app/components/private/tasks/tasks.component.spec.ts`
- `src/app/components/public/about/about.component.spec.ts`
- `src/app/components/public/change-password/change-password.component.spec.ts`
- `src/app/components/public/general-inquiries/general-inquiries.component.spec.ts`
- `src/app/components/public/general-services/general-services.component.spec.ts`
- `src/app/components/public/inquiries/inquiries.component.spec.ts`
- `src/app/components/public/inquiries/inquiry-success/inquiry-success.component.spec.ts`
- `src/app/components/public/landing/landing.component.spec.ts`
- `src/app/components/public/locations/locations.component.spec.ts`
- `src/app/components/public/locations-hub/locations-hub.component.spec.ts`
- `src/app/components/public/login/login.component.spec.ts`
- `src/app/components/public/password-recovery/password-recovery.component.spec.ts`
- `src/app/components/public/portfolio/portfolio.component.spec.ts`
- `src/app/components/public/portfolio-detail/portfolio-detail.component.spec.ts`
- `src/app/components/public/privacy-policy/privacy-policy.component.spec.ts`
- `src/app/components/public/terms-and-conditions/terms-and-conditions.component.spec.ts`
- `src/app/components/public/testimonials/testimonials.component.spec.ts`
- `src/app/components/public/wedding-inquiries/wedding-inquiries.component.spec.ts`
- `src/app/components/public/wedding-services/wedding-services.component.spec.ts`
- `src/app/components/public/workshops/workshops.component.spec.ts`
- `src/app/core/auth/auth.service.spec.ts`
- `src/app/core/guards/admin-role.guard.spec.ts`
- `src/app/core/guards/auth.guard.spec.ts`
- `src/app/core/guards/guest.guard.spec.ts`
- `src/app/core/supabase/clients/supabase.service.spec.ts`
- `src/app/core/supabase/repositories/activity-repository.service.spec.ts`
- `src/app/core/supabase/repositories/contact-repository.service.spec.ts`
- `src/app/core/supabase/repositories/internal-user-repository.service.spec.ts`
- `src/app/core/supabase/repositories/organization-repository.service.spec.ts`
- `src/app/core/supabase/repositories/project-repository.service.spec.ts`
- `src/app/core/supabase/repositories/task-repository.service.spec.ts`
- `src/app/core/supabase/services/inquiry.service.spec.ts`
- `src/app/core/supabase/services/lead-conversion.service.spec.ts`
- `src/app/core/supabase/services/lead-workflow.service.spec.ts`
- `src/app/core/supabase/services/task-workflow.service.spec.ts`
- `src/app/shared/components/private/activity-timeline/activity-timeline.component.spec.ts`
- `src/app/shared/components/private/crm-page-header/crm-page-header.component.spec.ts`
- `src/app/shared/components/private/entity-detail-card/entity-detail-card.component.spec.ts`

## Documented Exclusions

Use this format for every exclusion:

```text
path: <project-relative path>
reason: <generated | type-only | static configuration | bootstrap-only | external declaration | approved other>
notes: <short explanation>
```

Initial candidates:

- `src/app/core/models/*.ts` may be excluded only when type-only with no executable behavior.
- `src/app/core/**/**/*.models.ts` and `src/app/core/**/**/*.types.ts` may be excluded only when type-only with no executable behavior.
- `src/app/app.config.server.ts` may be excluded if confirmed bootstrap-only.
- `src/app/app.config.seo.ts` may be excluded if confirmed static configuration only.
- `src/environments/environment*.ts` may be excluded from coverage only if environment behavior is validated elsewhere or documented as static configuration.

Approved exclusions confirmed on 2026-06-02:

```text
path: src/app/app.config.ts
reason: bootstrap-only
notes: Angular provider wiring for router, animations, hydration, and zone change detection; no business logic.

path: src/app/app.config.server.ts
reason: bootstrap-only
notes: Server rendering provider merge only; no business logic.

path: src/app/core/models/activity-log.ts
reason: type-only
notes: Interface/type declarations only.

path: src/app/core/models/catalog-item.ts
reason: type-only
notes: Interface/type declarations only.

path: src/app/core/models/contact.ts
reason: type-only
notes: Interface/type declarations only.

path: src/app/core/models/create-general-lead-input.ts
reason: type-only
notes: Interface/type declarations only.

path: src/app/core/models/create-wedding-lead-input.ts
reason: type-only
notes: Interface/type declarations only.

path: src/app/core/models/floral-proposal.ts
reason: type-only
notes: Interface/type declarations only.

path: src/app/core/models/internal-user.ts
reason: type-only
notes: Interface/type declarations only.

path: src/app/core/models/lead-activity.ts
reason: type-only
notes: Interface/type declarations only.

path: src/app/core/models/lead-consultation.ts
reason: type-only
notes: Interface/type declarations only.

path: src/app/core/models/lead-create-request.ts
reason: type-only
notes: Interface/type declarations only.

path: src/app/core/models/lead-inspiration-url.ts
reason: type-only
notes: Interface/type declarations only.

path: src/app/core/models/lead-status.ts
reason: type-only
notes: Type/enum-style declaration only with no runtime logic.

path: src/app/core/models/lead.ts
reason: type-only
notes: Interface/type declarations only.

path: src/app/core/models/organization.ts
reason: type-only
notes: Interface/type declarations only.

path: src/app/core/models/profile.ts
reason: type-only
notes: Interface/type declarations only.

path: src/app/core/models/project-contact.ts
reason: type-only
notes: Interface/type declarations only.

path: src/app/core/models/project-organization.ts
reason: type-only
notes: Interface/type declarations only.

path: src/app/core/models/project.ts
reason: type-only
notes: Interface/type declarations only.

path: src/app/core/models/task.ts
reason: type-only
notes: Interface/type declarations only.

path: src/app/core/models/tax-region.ts
reason: type-only
notes: Interface/type declarations only.

path: src/app/core/models/user-role.ts
reason: type-only
notes: Type/role declaration only with no runtime logic.

path: src/app/core/auth/auth.models.ts
reason: type-only
notes: Auth state/profile type declarations only.

path: src/app/core/proposal-access/proposal-access.models.ts
reason: type-only
notes: Proposal access type declarations only.

path: src/app/core/proposal-templates/proposal-renderer.types.ts
reason: type-only
notes: Proposal renderer type declarations only.

path: src/app/core/proposal-templates/proposal-template-document.models.ts
reason: type-only
notes: Proposal document model declarations only.
```

Non-exclusions:

- `src/app/app.config.seo.ts` remains in scope because `initSeo()` has injectable runtime behavior and is covered from `src/app/app.component.spec.ts`.
- `src/app/app.routes.ts` remains in scope because route structure, lazy route wiring, and guard usage are runtime behavior.
- `src/environments/environment*.ts` remain in scope for US4 environment-specific tests.

## Coverage Bucket Verification

For each critical workflow area, record:

- Included files
- Spec files that cover the included files
- Success paths covered
- Failure paths covered
- Statements, branches, functions, and lines coverage once available
- Remaining missing tests or approved exclusions

## Coverage Configuration Notes

- `angular.json` enables `codeCoverage` on the Angular Karma test target.
- `tsconfig.spec.json` includes `src/**/*.ts` so eligible untested source remains visible to the test compiler and coverage instrumentation.
- `package.json` includes `test:coverage` for repeatable headless coverage execution.
- Shared synthetic fixtures and test doubles live under `src/app/core/testing`.
- `workflow-fixtures.ts` now includes inquiry, lead, proposal, route, auth, and activity fixtures used by the US2 inquiry and lead workflow tests without production data.
- T074 verification found no service-role keys, Mailgun dependencies, real customer data fixtures, or direct Supabase client creation in specs. The only project Supabase URL reference is the development environment config, and popup/storage/edge-function behavior covered by workflow specs uses Jasmine doubles. Some legacy shallow specs still emit Supabase client warnings in full-suite runs, but the suite does not require live Supabase, Mailgun, Canva, storage, browser popup, production credentials, or real customer data to pass.

## Missing Spec Verification

Verified on 2026-06-02:

- Shared private UI components under `src/app/shared/components/private/**/*.component.ts`: no missing colocated `.component.spec.ts` files found.
- Public route components under `src/app/components/public/**/*.component.ts`: no missing colocated `.component.spec.ts` files found.

Remaining US1 work is therefore behavioral expansion and documented exclusions, not colocated spec creation for these two surfaces.
