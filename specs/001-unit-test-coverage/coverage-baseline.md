# Coverage Baseline

**Captured**: 2026-06-02

## Baseline Command

```powershell
npm run test -- --watch=false --browsers=ChromeHeadless --code-coverage
```

## Initial Dependency-Blocked Result

The first baseline attempt could not produce coverage because local dependencies were not installed.

```text
Error: Could not find the '@angular-devkit/build-angular:karma' builder's node package.
```

Dependencies were installed with `npm install` on 2026-06-02.

## Post-Foundation Result

After dependency installation and Phase 2 coverage setup, the suite runs but fails existing shallow tests.

```text
TOTAL: 42 FAILED, 30 SUCCESS
Statements   : 8.3% (317/3816)
Branches     : 0.86% (20/2316)
Functions    : 3.3% (27/816)
Lines        : 7.99% (288/3601)
```

Primary failure classes:

- Missing `ActivatedRoute` providers in standalone component tests.
- Invalid Supabase URL in tests that instantiate `SupabaseService` with test environment config.
- Existing creation-only component specs missing required input data.
- `AppComponent` title assertion expects removed default Angular starter copy.

## US1 Shell/Layout Checkpoint

After adding router providers to the app shell, public/private layouts, header, and footer specs, and replacing the obsolete `AppComponent` starter assertion:

```text
TOTAL: 20 FAILED, 57 SUCCESS
Statements   : 17.37% (663/3816)
Branches     : 2.63% (61/2316)
Functions    : 12.74% (104/816)
Lines        : 17.52% (631/3601)
```

Remaining primary failure classes:

- Missing `ActivatedRoute` providers in other existing standalone component specs.
- Existing component specs missing required input data.
- Shallow tests instantiating real Supabase clients instead of using mocks.

## US1 Route Provider Checkpoint

After adding router providers to remaining public/auth route specs and required input data for the lead summary card:

```text
TOTAL: 80 SUCCESS
Statements   : 27.91% (1068/3826)
Branches     : 3.82% (89/2324)
Functions    : 21.69% (177/816)
Lines        : 28.46% (1028/3611)
```

Remaining quality issues:

- Some shallow specs still instantiate real Supabase clients and emit failed fetch logs.
- Karma still waits for pending async work and reports a browser disconnect after the successful test run.
- Coverage remains far below the 80% target because most eligible source now appears in coverage and needs behavioral tests.

## US1 Shared UI Checkpoint

After expanding shared app shell, toast, feedback, private shell, filter, dialog, status, empty-state, detail-shell, and task-list panel specs:

```text
TOTAL: 112 SUCCESS
Statements   : 29.43% (1126/3826)
Branches     : 4.69% (109/2324)
Functions    : 24.75% (202/816)
Lines        : 29.88% (1079/3611)
```

Remaining quality issues:

- Several creation-only specs still instantiate real Supabase clients and emit failed fetch logs.
- Multiple GoTrueClient instance warnings remain from tests that create real Supabase clients.
- Public image-heavy component tests emit NgOptimizedImage zero-height warnings in the Karma DOM.
- Coverage remains far below the 80% target pending workflow service/repository/component behavior tests.

## US2 Inquiry Form Checkpoint

After expanding general and wedding inquiry form specs with mocked lead repositories, mocked Supabase edge-function/storage clients, mocked router navigation, mocked toast feedback, and mocked SEO:

```text
TOTAL: 121 SUCCESS
Statements   : 32.59% (1247/3826)
Branches     : 6.75% (157/2324)
Functions    : 27.2% (222/816)
Lines        : 33.12% (1196/3611)
```

Inquiry coverage added:

- General inquiry invalid-submit tooltip behavior.
- General inquiry successful lead payload, duplicate inspiration URL persistence, email trigger invocation, success toast, and success navigation.
- General inquiry repository failure feedback.
- Wedding inquiry invalid-submit tooltip behavior.
- Wedding inquiry service-type budget reset behavior.
- Wedding inquiry successful lead payload, inspiration URL persistence, email trigger invocation, success toast, and success navigation.
- Wedding inquiry repository failure feedback.

Remaining inquiry issues:

- `src/app/core/supabase/services/inquiry.service.ts` is currently an empty injectable, so T027 has no success/failure behavior to validate yet.
- Live Supabase fetch logs still come from unrelated shallow CRM/proposal specs that instantiate real repositories.

## US2 Inquiry Routing Checkpoint

After expanding inquiry selection and inquiry success specs:

```text
TOTAL: 125 SUCCESS
Statements   : 32.69% (1251/3826)
Branches     : 6.79% (158/2324)
Functions    : 27.2% (222/816)
Lines        : 33.23% (1200/3611)
```

Inquiry routing coverage added:

- Inquiry selection page renders wedding and general inquiry choices.
- Inquiry selection page binds the wedding and general choices to `/inquiries/weddings` and `/inquiries/general`.
- Inquiry success page renders confirmation copy, next-step copy, and the return-home route.

## US2 Lead Workflow Service Checkpoint

After expanding `LeadWorkflowService` with mocked repositories:

```text
TOTAL: 132 SUCCESS
Statements   : 33.89% (1297/3826)
Branches     : 7.65% (178/2324)
Functions    : 28.79% (235/816)
Lines        : 34.5% (1246/3611)
```

Lead workflow coverage added:

- Mark-contacted updates and activity logging.
- Allowed and invalid status transitions.
- Decline reason persistence and activity logging.
- Consultation scheduling/completion success and rejection paths.
- Closed-unbooked reopen success and rejection paths.
- Consultation button labels, disabled-state helpers, and allowed next-status lists.

## US2 Lead Conversion Service Checkpoint

After expanding `LeadConversionService` with mocked repositories:

```text
TOTAL: 136 SUCCESS
Statements   : 34.86% (1334/3826)
Branches     : 9.46% (220/2324)
Functions    : 29.65% (242/816)
Lines        : 35.5% (1282/3611)
```

Lead conversion coverage added:

- Accepted lead conversion creates primary, partner, and planner contacts when applicable.
- Conversion creates a project, links project contacts, updates the source lead, and logs conversion activity with metadata.
- Non-accepted leads are rejected before persistence calls.
- Project creation failure does not update lead conversion state or log conversion activity.
- Default project names are generated from lead names and event dates.

## US2 Lead Repository Checkpoint

After replacing the creation-only `LeadRepositoryService` spec with mocked Supabase query chains:

```text
TOTAL: 147 SUCCESS
Statements   : 35.54% (1360/3826)
Branches     : 11.44% (266/2324)
Functions    : 30.26% (247/816)
Lines        : 36.22% (1308/3611)
```

Lead repository coverage added:

- Lead list query uses the expected table, select projection, and newest-first ordering.
- Single-lead lookup filters by `lead_id` and returns `null` on Supabase failure.
- General and wedding lead creation normalize names, email addresses, optional fields, source defaults, event type, and numeric guest-count edge cases.
- Create, update, and delete failures throw while logging repository-specific errors.
- Lead updates include a fresh `updated_at` timestamp and filter by lead id.

## US2 Lead List Component Checkpoint

After replacing the creation-only `LeadsComponent` spec with mocked repository, router, and toast dependencies:

```text
TOTAL: 157 SUCCESS
Statements   : 37.32% (1428/3826)
Branches     : 15.79% (367/2324)
Functions    : 33.57% (274/816)
Lines        : 38.1% (1376/3611)
```

Lead list coverage added:

- Initial load requests leads, proposals, and proposal response activity with loading-state coverage.
- Empty-state rendering appears when no leads match.
- Load failure resets lead, proposal, and proposal response state.
- Search, status visibility, event type, and service type filtering behavior is covered.
- Proposal and proposal-response summaries are mapped to leads.
- Row navigation and manual lead creation success/failure paths use mocked router, activity, repository, and toast dependencies.

## US2 Lead Detail Workflow Checkpoint

After replacing the creation-only `LeadDetailComponent` spec with mocked repositories, workflow services, router, and toast dependencies:

```text
TOTAL: 169 SUCCESS
Statements   : 43.59% (1668/3826)
Branches     : 20.69% (481/2324)
Functions    : 39.82% (325/816)
Lines        : 44.5% (1607/3611)
```

Lead detail coverage added:

- Initial route-driven load, missing route id navigation, and missing lead error state.
- Mark-contacted, consultation scheduling/completion, proposal-builder routing, decline, status update, and closed-unbooked reopen workflows.
- Proposal access resend success/failure behavior.
- Lead conversion success behavior and toast feedback.
- Lead edit persistence with changed-field activity metadata.
- Internal note validation and save behavior.
- Related task open/create/update behavior.
- Lead deletion success and linked-record failure messaging.

## US2 Lead Modal and Status Component Checkpoint

After replacing creation-only modal/status specs for lead conversion, decline, and status selection:

```text
TOTAL: 177 SUCCESS
Statements   : 44.04% (1685/3826)
Branches     : 21.08% (490/2324)
Functions    : 40.8% (333/816)
Lines        : 44.91% (1622/3611)
```

Lead modal/status coverage added:

- Convert modal hydrates default project names from the lead conversion service.
- Convert modal renders source lead, partner contact, and planner contact summaries.
- Convert modal trims confirmation payloads and blocks close while saving.
- Decline modal open/closed rendering, reason trimming, reset, and saving guard behavior.
- Status selector option formatting, status-change emission, and disabled-state input contract.

## US2 Lead Supporting Components Checkpoint

After adding missing specs for lead upsert, lead note, and lead proposal history components:

```text
TOTAL: 196 SUCCESS
Statements   : 46.54% (1789/3844)
Branches     : 24.63% (573/2326)
Functions    : 43.52% (356/818)
Lines        : 47.35% (1718/3628)
```

Lead supporting component coverage added:

- Lead upsert modal create/edit rendering, edit hydration, event-type service reset, required-field validation, valid-service validation, guest-count validation, normalized wedding payload emission, and close/save guards.
- Lead note modal open/closed rendering, required note validation, trimmed note emission, reset behavior, and saving guards.
- Lead proposal history card empty state, submit action, proposal selection and fallback behavior, active/version rendering, latest response rendering, open/resend/submit events, resend permission guard, date formatting, preview URL sanitization, and latest-response lookup.

## US2 Fixture Expansion Checkpoint

After expanding shared workflow fixtures for inquiry and lead workflow tests:

```text
TOTAL: 196 SUCCESS
Statements   : 46.63% (1796/3851)
Branches     : 24.63% (573/2326)
Functions    : 43.52% (356/818)
Lines        : 47.45% (1725/3635)
```

Fixture coverage support added:

- General and wedding lead variants for event-type-specific tests.
- Proposal-accepted and converted lead variants for workflow state tests.
- General and wedding upsert payload fixtures for component/repository normalization tests.
- Proposal-response activity fixture for lead proposal history and summary mapping tests.

## US2 Focused Inquiry and Lead Coverage Checkpoint

Focused command:

```powershell
npx ng test --watch=false --browsers=ChromeHeadless --code-coverage --include src/app/core/supabase/services/inquiry.service.spec.ts --include src/app/components/public/general-inquiries/general-inquiries.component.spec.ts --include src/app/components/public/wedding-inquiries/wedding-inquiries.component.spec.ts --include src/app/components/public/inquiries/inquiries.component.spec.ts --include src/app/components/public/inquiries/inquiry-success/inquiry-success.component.spec.ts --include src/app/core/supabase/services/lead-workflow.service.spec.ts --include src/app/core/supabase/services/lead-conversion.service.spec.ts --include src/app/core/supabase/repositories/lead-repository.service.spec.ts --include src/app/components/private/leads/leads.component.spec.ts --include src/app/components/private/leads/lead-detail/lead-detail.component.spec.ts --include src/app/components/private/leads/components/lead-convert-modal/lead-convert-modal.component.spec.ts --include src/app/components/private/leads/components/lead-decline-modal/lead-decline-modal.component.spec.ts --include src/app/components/private/leads/components/lead-status-selector/lead-status-selector.component.spec.ts --include src/app/components/private/leads/components/lead-upsert-modal/lead-upsert-modal.component.spec.ts --include src/app/components/private/leads/components/lead-note-modal/lead-note-modal.component.spec.ts --include src/app/components/private/leads/components/lead-proposal-history-card/lead-proposal-history-card.component.spec.ts
```

Result:

```text
TOTAL: 97 SUCCESS
Statements   : 45.05% (1134/2517)
Branches     : 27% (501/1855)
Functions    : 41.12% (220/535)
Lines        : 45.68% (1100/2408)
```

Focused US2 notes:

- Inquiry and lead specs run independently and pass with deterministic mocked repository, router, toast, storage, edge-function, and workflow dependencies.
- The run records a focused imported-code coverage summary rather than exact workflow-bucket percentages because the current Karma reporter emits HTML coverage only and no `lcov.info` bucket artifact.
- The US2 behavioral assertions cover success and failure paths, but the focused imported-code summary remains below the 80% target. This keeps the US2 checkpoint target open at the acceptance level while completing the T040 run-and-record task.

## US3 Proposal Builder Service Checkpoint

After adding `FloralProposalBuilderService` tests for builder math, payload generation, shopping lists, and hydration:

Focused service result:

```text
TOTAL: 9 SUCCESS
Statements   : 95.89% (140/146)
Branches     : 58.2% (110/189)
Functions    : 94.82% (55/58)
Lines        : 95.83% (138/144)
```

Full suite result:

```text
TOTAL: 205 SUCCESS
Statements   : 48.43% (1936/3997)
Branches     : 27.15% (683/2515)
Functions    : 46.91% (411/876)
Lines        : 49.29% (1863/3779)
```

Proposal builder coverage added:

- Empty line/component defaults.
- Catalog item application, pack-priced unit normalization, markup, reserve, and snapshot behavior.
- Product, fee, discount, manual labor, calculated labor, tax, and total calculations.
- Render payload filtering, trimming, line labels, totals, and breakdowns.
- Line item payloads, component payload maps, shopping-list aggregation, reserve/pack purchasing math, and persisted line/component hydration.

## US3 Proposal Workflow Service Checkpoint

After adding `FloralProposalWorkflowService` tests for proposal access, storage, edge functions, render contracts, and submission payloads:

Focused service result:

```text
TOTAL: 13 SUCCESS
Statements   : 22.29% (167/749)
Branches     : 14.56% (96/659)
Functions    : 17.29% (32/185)
Lines        : 22.7% (166/731)
```

Full suite result:

```text
TOTAL: 218 SUCCESS
Statements   : 51.21% (2047/3997)
Branches     : 30.61% (770/2515)
Functions    : 50% (438/876)
Lines        : 52.23% (1974/3779)
```

Proposal workflow coverage added:

- Lead proposal loading with signed PDF URLs and fallback URL behavior.
- Proposal submit eligibility rules.
- Line-item image upload, removal, signed URL normalization, missing-image handling, and repository cleanup.
- Submit, preview PDF, and resend edge-function success and failure paths.
- Render contract creation with lead, template, tax, totals, line-item asset, logo, and renderer metadata.
- Submission payload creation with render HTML, terms/privacy versions, shopping list, product components, and snapshot payloads.

## US3 Proposal Renderer Service Checkpoint

After adding `FloralProposalRendererService` wrapper tests:

Focused service result:

```text
TOTAL: 2 SUCCESS
Statements   : 11.33% (46/406)
Branches     : 1.65% (6/363)
Functions    : 5.21% (6/115)
Lines        : 11.33% (45/397)
```

Full suite result:

```text
TOTAL: 220 SUCCESS
Statements   : 51.26% (2049/3997)
Branches     : 30.61% (770/2515)
Functions    : 50.22% (440/876)
Lines        : 52.28% (1976/3779)
```

Proposal renderer coverage added:

- HTML rendering delegates to `ProposalTemplateSceneRendererService`.
- Renderer errors surface to callers.

## US3 Floral Proposal Repository Checkpoint

After adding `FloralProposalRepositoryService` tests with mocked Supabase query chains:

Focused repository result:

```text
TOTAL: 14 SUCCESS
Statements   : 67.11% (100/149)
Branches     : 50.43% (58/115)
Functions    : 81.48% (22/27)
Lines        : 66.43% (97/146)
```

Full suite result:

```text
TOTAL: 234 SUCCESS
Statements   : 53.06% (2121/3997)
Branches     : 32.84% (826/2515)
Functions    : 52.73% (462/876)
Lines        : 54.11% (2045/3779)
```

Floral proposal repository coverage added:

- Proposal list, lead proposal list, proposal lookup, and active proposal lookup query shape.
- Joined template-array normalization.
- Line item and component loading with display-order behavior and nested join cleanup.
- Proposal create/update payload normalization and error propagation.
- Line item replacement delete/insert behavior including empty payload handling.
- Component replacement, image metadata clearing, and shopping-list create/update item persistence.

## US3 Document Template Service Checkpoint

After adding `DocumentTemplateService` tests with mocked repository and Supabase storage dependencies:

Focused service result:

```text
TOTAL: 12 SUCCESS
Statements   : 52% (52/100)
Branches     : 14.54% (8/55)
Functions    : 54.16% (13/24)
Lines        : 51.51% (51/99)
```

Full suite result:

```text
TOTAL: 246 SUCCESS
Statements   : 54.49% (2178/3997)
Branches     : 33.24% (836/2515)
Functions    : 54.22% (475/876)
Lines        : 55.59% (2101/3779)
```

Document template service coverage added:

- Template create/update delegation.
- Activate/deactivate repository update behavior.
- Template deletion with optional logo cleanup and cleanup warning behavior.
- Template logo and asset uploads with sanitized storage paths, signed URLs, and friendly failure handling.
- Template logo/asset removal and empty-path guard behavior.
- Signed URL failure handling and template asset refresh with per-asset fallback.

## US3 Proposal Template Document Service Checkpoint

After adding `ProposalTemplateDocumentService` tests for stored config, document, asset, text, validation, and preview behavior:

Focused service result:

```text
TOTAL: 11 SUCCESS
Statements   : 76.04% (200/263)
Branches     : 48.93% (92/188)
Functions    : 81.08% (60/74)
Lines        : 76.56% (196/256)
```

Full suite result:

```text
TOTAL: 257 SUCCESS
Statements   : 58.56% (2341/3997)
Branches     : 36.5% (918/2515)
Functions    : 60.27% (528/876)
Lines        : 59.83% (2261/3779)
```

Proposal template document coverage added:

- Stored config validation, cloning, draft/published lookup, version history, and trashed state.
- Default document generation fallback.
- Draft and published config stamping, asset/import cloning, version history limiting, and legacy config cleanup.
- Resolved asset URL application to documents and stored configs.
- Document validation for missing pages, invalid page/node dimensions, and table layout issues.
- Image table-cell normalization, placeholder lookup, segment parsing/rendering/serialization, list formatting, sample preview data, and clone behavior.

## US3 Proposal Access Service Checkpoint

After adding `ProposalAccessService` tests for client proposal access, session storage, and response submission behavior:

Focused service result:

```text
TOTAL: 9 SUCCESS
Statements   : 76% (76/100)
Branches     : 56.14% (32/57)
Functions    : 64.28% (9/14)
Lines        : 76.28% (74/97)
```

Full suite result:

```text
TOTAL: 266 SUCCESS
Statements   : 59.13% (2399/4057)
Branches     : 37.19% (950/2554)
Functions    : 60.67% (537/885)
Lines        : 60.4% (2317/3836)
```

Proposal access coverage added:

- Valid session hydration from session storage and expired/malformed session cleanup.
- Access verification credential normalization, edge-function invocation, session persistence, invalid credential errors, and invoke failure handling.
- Accepted response payloads with terms, privacy policy, signature, session response-state updates, and persisted feedback cleanup.
- Declined response payloads with trimmed feedback and local response-state tracking.
- Response submission guards for missing sessions and already-responded proposals.
- Response edge-function failures, failed response payloads, response-state helpers, and session clearing.

## US3 Proposal Auth Component Checkpoint

After adding `ProposalAuthComponent` tests for client proposal access form behavior:

Focused component result:

```text
TOTAL: 6 SUCCESS
Statements   : 25% (27/108)
Branches     : 6.55% (4/61)
Functions    : 22.22% (4/18)
Lines        : 25% (26/104)
```

Full suite result:

```text
TOTAL: 272 SUCCESS
Statements   : 59.37% (2423/4081)
Branches     : 37.29% (954/2558)
Functions    : 60.85% (541/889)
Lines        : 60.63% (2340/3859)
```

Proposal auth coverage added:

- Existing valid-session redirect to the proposal review route.
- No-session form rendering with email/passcode input contract.
- Invalid form submission marking and validation messaging without access verification.
- Valid credential submission, loading button copy, access verification delegation, and review navigation.
- Verification error logging, user-facing error rendering, fallback non-Error message handling, and loading-state reset.

## US3 Proposal Review Component Checkpoint

After adding `ProposalReviewComponent` tests for client proposal review and response behavior:

Focused component result:

```text
TOTAL: 11 SUCCESS
Statements   : 53.03% (105/198)
Branches     : 26.43% (23/87)
Functions    : 37.03% (10/27)
Lines        : 53.55% (98/183)
```

Full suite result:

```text
TOTAL: 283 SUCCESS
Statements   : 60.03% (2509/4179)
Branches     : 37.75% (977/2588)
Functions    : 61.08% (551/902)
Lines        : 61.31% (2419/3945)
```

Proposal review coverage added:

- Invalid-session redirect and missing-session rendering.
- Valid session metadata, PDF link/viewer rendering, missing-preview rendering, and date fallback formatting.
- Already-responded accepted state hydration and response-modal blocking.
- Accept modal validation for terms, privacy acknowledgement, and signature.
- Accepted response submission with trimmed signature, success state, and submission-state reset.
- Accept failure logging, error rendering, modal-state reset, and completed-action guard preservation.
- Decline notes validation, trimmed decline feedback submission, success state, fallback failure messaging, and secure sign-out navigation.

## US3 Floral Proposal Builder Component Checkpoint

After adding `FloralProposalBuilderComponent` tests for CRM proposal builder workflow behavior:

Focused component result:

```text
TOTAL: 11 SUCCESS
Statements   : 34.38% (546/1588)
Branches     : 16.66% (210/1260)
Functions    : 35.44% (151/426)
Lines        : 34.61% (523/1511)
```

Full suite result:

```text
TOTAL: 294 SUCCESS
Statements   : 60.44% (2874/4755)
Branches     : 38.36% (1114/2904)
Functions    : 61.58% (654/1062)
Lines        : 61.91% (2765/4466)
```

Floral proposal builder component coverage added:

- Missing lead route redirect, successful builder loading, active template/tax/catalog filtering, not-found handling, retry behavior, and dependency failure messaging.
- Editable line item add, update, expand, reorder, remove, and shopping-list refresh behavior.
- Catalog item selection, component quantity/markup changes, default markup propagation, and shopping-list reserve updates.
- Draft save repository payload intent, line/component/shopping-list persistence, activity logging, success toast, reload, and save failure feedback.
- Preview generation with persisted draft, render contract, submission payload, preview PDF state, preview failure reset, and submit success with stored PDF base64.
- Submit prerequisite validation, line-item image upload/removal/invalid-drop behavior, export-popup guard behavior, printable HTML writing, and print invocation.

## US3 Proposal Templates List Component Checkpoint

After adding `ProposalTemplatesComponent` tests for template registry behavior:

Focused component result:

```text
TOTAL: 9 SUCCESS
Statements   : 38.77% (228/588)
Branches     : 19.14% (63/329)
Functions    : 29.33% (44/150)
Lines        : 38.77% (221/570)
```

Full suite result:

```text
TOTAL: 303 SUCCESS
Statements   : 61.09% (3021/4945)
Branches     : 38.84% (1160/2986)
Functions    : 61.44% (682/1110)
Lines        : 62.56% (2908/4648)
```

Proposal templates list coverage added:

- Template loading, trashed-template filtering, rendered registry rows, search filtering, load error messaging, and retry reload.
- Create/edit modal state, close guard while saving, and modal reset behavior.
- Template creation payload intent, service-profile/template-config setup, success toast, reload, and studio navigation.
- Template edit payload intent with existing stored document config, template config rebuild, update success toast, and save error feedback.
- Activate/deactivate behavior, toggle failure messaging, delete confirmation cancel/success paths, foreign-key delete error mapping, studio navigation, and renderer-label fallback.

## US3 Proposal Fixture Expansion Checkpoint

After expanding shared proposal fixtures in `src/app/core/testing/workflow-fixtures.ts`:

```text
TOTAL: 303 SUCCESS
Statements   : 61.13% (3026/4950)
Branches     : 38.81% (1159/2986)
Functions    : 61.44% (682/1110)
Lines        : 62.6% (2913/4653)
```

Proposal fixture support added:

- Reusable synthetic `DocumentTemplate`, `TaxRegion`, and `CatalogItem` records.
- Persisted proposal component and shopping-list item records linked to the synthetic proposal line item.
- Richer proposal render contract line-item, component, tax-region, template, and shopping-list data for proposal workflow tests.

## US3 Proposal Testing Doubles Checkpoint

After adding `src/app/core/testing/proposal-testing.ts` and focused helper coverage:

Focused helper result:

```text
TOTAL: 4 SUCCESS
Statements   : 100% (9/9)
Branches     : 80% (4/5)
Functions    : 100% (6/6)
Lines        : 100% (9/9)
```

Full suite result:

```text
TOTAL: 307 SUCCESS
Statements   : 61.12% (3031/4959)
Branches     : 38.84% (1162/2991)
Functions    : 61.64% (688/1116)
Lines        : 62.59% (2918/4662)
```

Proposal testing doubles added:

- Browser popup double with document write/focus/print spies for proposal export tests.
- Canva popup double with mutable URL assignment and postMessage spy for future Canva integration tests.
- Storage bucket double for upload, remove, signed URL, and public URL flows.
- Synthetic image and PDF file helpers that avoid real customer data.

Note: The full run emitted the existing late Chrome disconnect noise after reporting `TOTAL: 307 SUCCESS` and coverage, while the command exited successfully.

## US3 Focused Proposal Coverage Checkpoint

Focused command:

```powershell
npx ng test --watch=false --browsers=ChromeHeadless --code-coverage --include src/app/core/supabase/services/floral-proposal-builder.service.spec.ts --include src/app/core/supabase/services/floral-proposal-workflow.service.spec.ts --include src/app/core/supabase/services/floral-proposal-renderer.service.spec.ts --include src/app/core/supabase/repositories/floral-proposal-repository.service.spec.ts --include src/app/core/supabase/services/document-template.service.spec.ts --include src/app/core/proposal-templates/proposal-template-document.service.spec.ts --include src/app/core/proposal-access/proposal-access.service.spec.ts --include src/app/components/proposal-access/proposal-auth/proposal-auth.component.spec.ts --include src/app/components/proposal-access/proposal-review/proposal-review.component.spec.ts --include src/app/components/private/floral-proposal-builder/floral-proposal-builder.component.spec.ts --include src/app/components/private/proposal-templates/proposal-templates.component.spec.ts --include src/app/core/testing/proposal-testing.spec.ts
```

Result:

```text
TOTAL: 111 SUCCESS
Statements   : 67.5% (1336/1979)
Branches     : 42.25% (600/1420)
Functions    : 67.19% (340/506)
Lines        : 68.79% (1292/1878)
```

Focused US3 notes:

- Proposal specs run independently and pass with deterministic mocked repository, renderer, storage, edge-function, router, toast, browser-popup, and proposal-access dependencies.
- The run records a focused imported-code coverage summary rather than exact workflow-bucket percentages because the current Karma reporter emits HTML coverage only and no `lcov.info` bucket artifact.
- The US3 behavioral assertions now cover proposal calculations, persistence intent, rendering, client access, review responses, template behavior, dependency failures, and UI validation paths, but the focused imported-code summary remains below the 80% target. This keeps the US3 checkpoint target open at the acceptance level while completing the T055 run-and-record task.

## US4 Focused Environment Coverage Checkpoint

Focused command:

```powershell
npx ng test --watch=false --browsers=ChromeHeadless --code-coverage --include src/app/core/supabase/clients/supabase.service.spec.ts --include src/environments/environment.spec.ts --include src/environments/environment.dev.spec.ts --include src/environments/environment.prod.spec.ts
```

Result:

```text
TOTAL: 14 SUCCESS
Statements   : 92.3% (24/26)
Branches     : 77.77% (14/18)
Functions    : 100% (5/5)
Lines        : 92.3% (24/26)
```

Focused US4 notes:

- Environment specs run independently and cover default, development, and production configuration shapes.
- Supabase client validation covers missing URL/key failures and auth helper error handling.
- The run emitted the existing Supabase multiple-client warning during real client construction, but the command exited successfully.

## US5 Focused Authorization Coverage Checkpoint

Focused command:

```powershell
npx ng test --watch=false --browsers=ChromeHeadless --code-coverage --include src/app/core/auth/auth.service.spec.ts --include src/app/core/guards/auth.guard.spec.ts --include src/app/core/guards/guest.guard.spec.ts --include src/app/core/guards/admin-role.guard.spec.ts --include src/app/core/guards/proposal-access.guard.spec.ts
```

Result:

```text
TOTAL: 23 SUCCESS
Statements   : 56.3% (125/222)
Branches     : 30% (30/100)
Functions    : 60.86% (28/46)
Lines        : 56.27% (121/215)
```

Focused US5 notes:

- Authorization specs run independently and pass with deterministic mocked Supabase, router, platform, and proposal-access dependencies.
- The run records a focused imported-code coverage summary rather than exact workflow-bucket percentages because the current Karma reporter emits HTML coverage only and no `lcov.info` bucket artifact.
- The US5 behavioral assertions cover auth initialization, login/logout, password helpers, browser/server guard behavior, internal-user routing, unauthenticated redirects, and proposal access redirects, but the focused imported-code summary remains below the 80% target. This keeps the authorization checkpoint target open at the acceptance level while completing the T070 run-and-record task.

## Final Full-Suite Coverage Checkpoint

Command:

```powershell
npm run test:coverage
```

Result:

```text
TOTAL: 342 SUCCESS
Statements   : 63.29% (3154/4983)
Branches     : 40.08% (1203/3001)
Functions    : 63.58% (716/1126)
Lines        : 64.81% (3037/4686)
```

Final verification notes:

- The full Karma/Jasmine suite passes, but overall coverage remains below the 80% acceptance target for statements, branches, functions, and lines.
- Focused US2, US3, and US5 imported-code coverage summaries also remain below the 80% per-critical-workflow target. US4 environment coverage is above 80% for statements, functions, and lines, with branches at 77.77%.
- Current inventory check found 157 non-spec `src/app` TypeScript files, 87 `src/app` spec files, 3 environment config files, 3 environment spec files, and 27 documented exclusions. The simple spec-or-exclusion ratio is 117 of 160, or 73.1%, below the 95% acceptance target.
- Changed-path verification found no Supabase schema, RLS policy, storage policy, or edge-function changes. Public route/content/style files were not intentionally changed; public `.spec.ts` files were expanded. `src/app/app.config.seo.ts` has an import-path/newline diff only, not SEO metadata content.
- `npm run build` exited successfully. Prerender logged Supabase URL errors because the local prebuild wrote placeholder `undefined` Supabase values without deploy-time secrets, and bundle budget warnings remain existing build output.

## Inventory Summary

- Non-spec frontend TypeScript files under `src/app`: 152
- Existing frontend spec files under `src/app`: 70
- Environment TypeScript files under `src/environments`: 3
- Current measurable coverage: 29.43% statements, 4.69% branches, 24.75% functions, 29.88% lines

## Foundation Issues

- Existing spec inventory appears broad, but many specs are creation-only or shallow and need behavioral assertions.
- Several existing tests lack required route, Supabase, or input providers.
- Coverage is now low because eligible untested source is visible, which is expected at this baseline stage.

## Next Coverage Checkpoint

After dependencies are available, rerun the baseline command and record:

- Overall statements, branches, functions, and lines
- Inquiry workflow bucket coverage
- Lead generation/CRM workflow bucket coverage
- Proposal building/review workflow bucket coverage
- Authorization/access workflow bucket coverage
- Eligible-unit spec or exclusion ratio
