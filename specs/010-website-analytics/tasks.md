# Tasks: Public Website Analytics and Search Insights

**Input**: Design documents from `/specs/010-website-analytics/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/website-analytics.md`, `quickstart.md`

**Tests**: Karma/Jasmine tests are required for every affected Angular service, component, directive, route policy, and inquiry workflow. The regional branch in `src/server.ts` is validated by the Angular server build and documented Netlify smoke checks. No Supabase schema, migration, RLS, storage, database-contract, or Edge Function change is included, so no PostgreSQL or Supabase Edge Function tests are created.

**Organization**: Tasks are grouped by user story so each business increment can be implemented and validated independently after the shared foundation is complete.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the approved scope, typed environment boundary, and operational evidence locations before analytics code is introduced.

- [ ] T001 Create the implementation scope, approved public-route inventory, excluded-route inventory, and brownfield behavior baseline in `docs/analytics/implementation-scope.md`
- [ ] T002 Create the production-activation gate covering qualified privacy approval, two business-controlled owners, provider configuration, and human-only source-control publication in `docs/analytics/release-gates.md`
- [ ] T003 Add optional production GA4 measurement configuration with no privileged values to `src/environments/environment.model.ts`, `src/environments/environment.ts`, and `src/environments/environment.prod.ts`
- [ ] T004 [P] Extend environment shape and secret-boundary coverage for blank non-production analytics configuration in `src/environments/environment.spec.ts`, `src/environments/environment.dev.spec.ts`, and `src/environments/environment.prod.spec.ts`
- [ ] T005 Update production environment generation to read `GA4_MEASUREMENT_ID` without treating it as an account credential in `set-env.cts`
- [ ] T006 [P] Create the initial event dictionary, safe parameter registry, campaign naming convention, and prohibited-data register in `docs/analytics/measurement-dictionary.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the default-deny, privacy-preserving measurement core required by every user story.

**CRITICAL**: No user story implementation begins until this phase passes its focused tests.

- [ ] T007 Define route categories, consent/preference records, regional states, runtime states, event envelopes, safe campaign values, GPC typing, and `gtag` browser typing in `src/app/core/analytics/analytics.models.ts`
- [ ] T008 [P] Add default-deny route-classification tests for static public, dynamic public, payment, authentication, admin, token-bearing, query, fragment, future, and unknown routes in `src/app/core/analytics/analytics-route-policy.service.spec.ts`
- [ ] T009 Implement explicit public route allowlisting, sanitized canonical paths, excluded-route detection, safe dynamic-slug handling, and Not Found categorization in `src/app/core/analytics/analytics-route-policy.service.ts`
- [ ] T010 [P] Add negative sanitization and campaign-normalization tests covering PII, IDs, tokens, raw URLs, queries, fragments, unknown parameters, unsafe slugs, and excessive values in `src/app/core/analytics/analytics-sanitizer.service.spec.ts`
- [ ] T011 Implement typed event schemas, strict parameter allowlists, safe campaign parsing, length/character limits, referrer minimization, and fail-closed portfolio slug handling in `src/app/core/analytics/analytics-sanitizer.service.ts`
- [ ] T012 [P] Add preference-state tests for U.S. defaults, non-U.S./unknown opt-in, explicit enable/disable, 12-month expiry, policy-version invalidation, corrupted/unavailable storage, internal-browser exclusion, and GPC precedence in `src/app/core/analytics/analytics-preference.service.spec.ts`
- [ ] T013 Implement versioned analytics preferences, internal-browser marker management, storage-failure behavior, expiry, material-policy invalidation, and browser/HTTP GPC precedence in `src/app/core/analytics/analytics-preference.service.ts`
- [ ] T014 Add the same-origin `GET /api/analytics-region` branch returning only `us|non_us|unknown`, HTTP GPC, and published-production status with private no-store caching in `src/server.ts`
- [ ] T015 [P] Add region-resolution tests for U.S., non-U.S., unknown, browser GPC, HTTP GPC, saved-enable plus HTTP GPC, saved-enable plus endpoint failure, undetermined visitor plus endpoint failure, malformed response, timeout, and non-production results, requiring every endpoint failure to block analytics in `src/app/core/analytics/analytics-region.service.spec.ts`
- [ ] T016 Implement asynchronous regional and HTTP GPC resolution against `/api/analytics-region` before any saved-enable decision, blocking analytics on endpoint failure while allowing saved choices to override only successfully resolved regional defaults in `src/app/core/analytics/analytics-region.service.ts`
- [ ] T017 [P] Add Google client tests for browser-only loading, one script instance, advertising-denied configuration, `send_page_view:false`, disable-flag ordering, queue shutdown, cookie cleanup, and provider failure isolation in `src/app/core/analytics/google-analytics-client.service.spec.ts`
- [ ] T018 Implement direct asynchronous `gtag.js` loading, privacy-restricted configuration, typed dispatch, deterministic disable behavior, cookie cleanup, and no-throw provider isolation in `src/app/core/analytics/google-analytics-client.service.ts`
- [ ] T019 Add only the required non-advertising Google tag and GA collection hosts to the foundational CSP while excluding Ads and DoubleClick hosts in `netlify.toml`
- [ ] T020 [P] Add orchestration tests for exact production origin, internal browser, browser/HTTP GPC precedence including saved-enable plus `Sec-GPC: 1`, saved-enable plus endpoint failure, direct load, hydration, queued initial navigation, `NavigationStart` exclusion, one `NavigationEnd` page view, consent changes, no replay, and provider failure in `src/app/core/analytics/website-analytics.service.spec.ts`
- [ ] T021 Implement the browser-only analytics state machine, router lifecycle ownership, latest-eligible-navigation queue, sanitized previous-page context, event facade, and fail-silent dispatch in `src/app/core/analytics/website-analytics.service.ts`
- [ ] T022 [P] Add one-per-page 90% threshold and listener-cleanup tests in `src/app/core/analytics/analytics-scroll.service.spec.ts`
- [ ] T023 Implement navigation-scoped 90% meaningful-scroll tracking without automatic GA scroll measurement in `src/app/core/analytics/analytics-scroll.service.ts`
- [ ] T024 [P] Extend browser-versus-SSR initialization and non-blocking failure tests in `src/app/app.component.spec.ts`
- [ ] T025 Initialize the analytics orchestrator without delaying SEO, authentication, rendering, or routing in `src/app/app.component.ts`
- [ ] T026 Document why no Supabase schema, migration, RLS, storage, database test, or Edge Function change is required in `docs/analytics/implementation-scope.md`
- [ ] T027 Run the focused foundational Karma/Jasmine specs and the Angular server build, and record results in `docs/analytics/validation-record.md`

**Checkpoint**: The measurement core is browser-only, production-only, default-deny, sanitized, consent-aware, and safe to consume from story-specific components.

---

## Phase 3: User Story 1 - Measure Qualified Inquiry Journeys (Priority: P1)

**Goal**: Distinguish inquiry intent from exactly one durable confirmed lead and retain only safe acquisition/journey context.

**Independent Test**: Exercise successful, invalid, failed, retried, refreshed, manual-success-route, and post-persistence-support-failure wedding/general inquiries; verify one start per real attempt and one `generate_lead` only after durable lead creation.

### Tests for User Story 1

- [ ] T028 [P] [US1] Add per-attempt start and confirmed-lead state tests without form values or returned IDs in `src/app/core/analytics/inquiry-measurement.service.spec.ts`
- [ ] T029 [P] [US1] Extend general inquiry tests for first meaningful user edit, validation failure, repository failure, durable creation, supporting-step failure, deduplication, and manual success navigation in `src/app/components/public/general-inquiries/general-inquiries.component.spec.ts`
- [ ] T030 [P] [US1] Extend wedding inquiry tests for first meaningful user edit, validation failure, repository failure, durable creation, supporting-step failure, deduplication, and manual success navigation in `src/app/components/public/wedding-inquiries/wedding-inquiries.component.spec.ts`

### Implementation for User Story 1

- [ ] T031 [US1] Implement transient per-attempt start/lead deduplication and typed safe inquiry events in `src/app/core/analytics/inquiry-measurement.service.ts`
- [ ] T032 [US1] Instrument the general inquiry start after the first user-driven meaningful visible-field change and `generate_lead` immediately after durable repository success in `src/app/components/public/general-inquiries/general-inquiries.component.ts`
- [ ] T033 [US1] Instrument the wedding inquiry start after the first user-driven meaningful visible-field change and `generate_lead` immediately after durable repository success in `src/app/components/public/wedding-inquiries/wedding-inquiries.component.ts`
- [ ] T034 [US1] Verify inquiry templates expose no analytics bindings to form values, hidden fields, honeypots, contact data, or submit clicks in `src/app/components/public/general-inquiries/general-inquiries.component.html` and `src/app/components/public/wedding-inquiries/wedding-inquiries.component.html`
- [ ] T035 [US1] Add confirmed-lead, inquiry-start, acquisition-context, and deduplication evidence for both inquiry types to `docs/analytics/validation-record.md`
- [ ] T036 [US1] Run the US1 Karma/Jasmine specs and document that CRM persistence, inspiration handling, email, toast, and success navigation remain behaviorally unchanged in `docs/analytics/validation-record.md`

**Checkpoint**: Inquiry starts and durable confirmed leads are independently measurable without changing CRM records or exposing inquiry data.

---

## Phase 4: User Story 2 - Protect Private and Sensitive Journeys (Priority: P1)

**Goal**: Prove that private, payment, authentication, token-bearing, unknown, and unsafe dynamic journeys never enter analytics.

**Independent Test**: Inspect direct loads, refreshes, and public-to-excluded/client transitions for all excluded route families and inspect every allowed payload for prohibited values.

### Tests for User Story 2

- [ ] T037 [P] [US2] Extend route tests to require controlled metadata on approved marketing/inquiry routes and the safe public wildcard while default-denying payment, login, recovery, password, admin, token-bearing, and future unclassified routes in `src/app/app.routes.spec.ts`
- [ ] T038 [P] [US2] Add direct excluded-entry and public-to-excluded zero-dispatch tests in `src/app/core/analytics/website-analytics.service.spec.ts`
- [ ] T039 [P] [US2] Add Not Found tests proving only a safe recognized category or `other` is emitted without raw, hashed, encoded, title-derived, query, fragment, or token data in `src/app/components/public/not-found/not-found.component.spec.ts`
- [ ] T040 [P] [US2] Add an end-to-end-shaped negative payload matrix at the analytics facade boundary in `src/app/core/analytics/analytics-sanitizer.service.spec.ts`

### Implementation for User Story 2

- [ ] T041 [US2] Annotate only approved marketing/inquiry routes and the public wildcard with controlled analytics categories while leaving payment, authentication, admin, token-bearing, and future routes unmarked in `src/app/app.routes.ts`
- [ ] T042 [US2] Disable dispatch before excluded-route activation and re-evaluate current consent only after returning to an eligible public route in `src/app/core/analytics/website-analytics.service.ts`
- [ ] T043 [US2] Instrument the public Not Found view using only safe category-or-`other` input in `src/app/components/public/not-found/not-found.component.ts`
- [ ] T044 [US2] Audit dynamic portfolio and location slugs, approve only editorial non-personal identifiers, and document generic-category fallback decisions in `docs/analytics/public-content-identifier-audit.md`
- [ ] T045 [US2] Record Network-tool evidence for zero activation on `/admin/*`, `/pay/*`, login, password recovery/change, and token-bearing journeys plus one safe Not Found event only when analytics is permitted and zero raw or encoded unknown URL data in `docs/analytics/validation-record.md`

**Checkpoint**: Sensitive routes and values are prevented before collection rather than filtered after transmission.

---

## Phase 5: User Story 3 - Make a Meaningful Analytics Choice (Priority: P1)

**Goal**: Give visitors an accessible enable, decline, withdraw, and revisit experience that implements the selected regional/GPC policy without blocking the site.

**Independent Test**: Exercise U.S., non-U.S., unknown, GPC, stored, changed, expired, corrupted, unavailable-storage, internal-browser, desktop, mobile, keyboard, and assistive-technology states.

### Tests for User Story 3

- [ ] T046 [P] [US3] Create component tests for notice variants, enable/decline/withdraw, GPC override, the deliberate staff-only internal-browser control and reversal, focus management, keyboard operation, labels, and non-blocking behavior in `src/app/shared/components/public/analytics-preferences/analytics-preferences.component.spec.ts`
- [ ] T047 [P] [US3] Extend footer tests for the persistent Analytics Preferences action without changing existing social/navigation behavior in `src/app/shared/components/public/footer/footer.component.spec.ts`
- [ ] T048 [P] [US3] Extend public-layout tests so Analytics Preferences remains available wherever the public footer renders, including payment/authentication children, while proving excluded children never activate or dispatch analytics in `src/app/core/layouts/public-layout/public-layout.component.spec.ts`

### Implementation for User Story 3

- [ ] T049 [US3] Implement the accessible U.S. notice, non-U.S./unknown opt-in prompt, preferences dialog, GPC explanation, enable/disable actions, and a clearly labeled reversible Black Begonia staff control that invokes the internal-browser preference service without claiming staff authentication in `src/app/shared/components/public/analytics-preferences/analytics-preferences.component.ts`
- [ ] T050 [US3] Build semantic dialog/notice markup with focus restoration and understandable choice text in `src/app/shared/components/public/analytics-preferences/analytics-preferences.component.html`
- [ ] T051 [US3] Style responsive light/dark preferences states without manipulative emphasis or content obstruction in `src/app/shared/components/public/analytics-preferences/analytics-preferences.component.scss`
- [ ] T052 [US3] Add the persistent Analytics Preferences control while preserving logo, navigation, and social links in `src/app/shared/components/public/footer/footer.component.html` and `src/app/shared/components/public/footer/footer.component.ts`
- [ ] T053 [US3] Integrate preferences visibility independently from provider eligibility so the control remains available throughout the public layout while excluded child routes cannot activate analytics in `src/app/core/layouts/public-layout/public-layout.component.ts` and `src/app/core/layouts/public-layout/public-layout.component.html`
- [ ] T054 [US3] Document how the florist uses the Analytics Preferences staff control to mark, verify, restore, and remove the internal-browser preference on each browser/device without fingerprinting in `docs/analytics/internal-browser-guide.md`
- [ ] T055 [US3] Record desktop/mobile keyboard, screen-reader, GPC, withdrawal, re-enable, expiry, and storage-failure results in `docs/analytics/validation-record.md`

**Checkpoint**: Every visitor can make and revise a meaningful analytics choice while all public functionality remains available.

---

## Phase 6: User Story 4 - Connect Search Visibility to Website Outcomes (Priority: P2)

**Goal**: Establish business-controlled Search Console and GA4 properties and a repeatable native-report comparison of pre-click search visibility with post-click lead outcomes.

**Independent Test**: With authorized production properties and representative data, compare organic landing-page search metrics with GA engagement and confirmed inquiries without requiring totals to match.

### Implementation for User Story 4

- [ ] T056 [P] [US4] Create/configure the GA4 account, production property, web stream, Eastern timezone, USD currency, and two business-controlled administrators and record evidence in `docs/analytics/ga4-property-setup.md`
- [ ] T057 [US4] Configure `generate_lead` as the only initial GA4 key event, register only approved safe custom dimensions, and record configuration evidence in `docs/analytics/ga4-property-setup.md`
- [ ] T058 [P] [US4] Create/configure the Search Console Domain property, DNS verification, two owners, public-only sitemap submission, and successful status and record evidence in `docs/analytics/search-console-setup.md`
- [ ] T059 [US4] Configure and record the Search Console-to-GA4 production stream link and publish the native Search Console report collection in `docs/analytics/property-linking.md`
- [ ] T060 [P] [US4] Document expected Search Console delay, canonicalization, anonymized-query limits, GA consent/attribution limits, and why totals do not reconcile in `docs/analytics/monthly-reporting-runbook.md`
- [ ] T061 [US4] Document the monthly native Search Console and GA4 workflow for queries, impressions, clicks, CTR, position, landing pages, engagement, inquiry starts, confirmed leads, devices, geography, and time comparisons in `docs/analytics/monthly-reporting-runbook.md`
- [ ] T062 [US4] Complete a representative organic landing-page dry run or mark data-waiting evidence with owner/date in `docs/analytics/validation-record.md`

**Checkpoint**: The florist can connect search visibility to eligible post-click outcomes using business-owned native tools.

---

## Phase 7: User Story 5 - Understand Content and Marketing Performance (Priority: P2)

**Goal**: Measure approved public content, CTA, social, contact, referral, and campaign interactions with safe, consistent context.

**Independent Test**: Generate representative organic, direct, social, referral, email, campaign, portfolio, service, location, workshop, contact, and CTA journeys and verify distinct traffic, engagement, intent, and confirmed-lead reporting categories.

### Tests for User Story 5

- [ ] T063 [P] [US5] Add typed action-directive tests proving it emits only configured enums and never reads DOM text, href values, contact destinations, query strings, or form data in `src/app/shared/directives/analytics-action.directive.spec.ts`
- [ ] T064 [P] [US5] Extend portfolio-detail tests for successful-view timing, audited slug fallback, invalid slug/redirect exclusion, and absence of names, venue, UUID, or event data in `src/app/components/public/portfolio-detail/portfolio-detail.component.spec.ts`
- [ ] T065 [P] [US5] Extend workshop tests for safe `workshop` origin handoff to the unchanged general inquiry type in `src/app/components/public/workshops/workshops.component.spec.ts`
- [ ] T066 [P] [US5] Extend general inquiry tests to consume only the allowlisted workshop origin and strip/ignore arbitrary origin values in `src/app/components/public/general-inquiries/general-inquiries.component.spec.ts`

### Implementation for User Story 5

- [ ] T067 [US5] Implement an explicit typed directive for approved CTA, social, contact, outbound, and download events in `src/app/shared/directives/analytics-action.directive.ts`
- [ ] T068 [US5] Instrument existing Instagram and Facebook actions with platform and originating-page enums only in `src/app/shared/components/public/header/header.component.html` and `src/app/shared/components/public/footer/footer.component.html`
- [ ] T069 [US5] Inventory approved phone, email, outbound, promotional, service, location, portfolio, and inquiry CTA bindings with safe event enums and exact component/template paths before code changes in `docs/analytics/measurement-dictionary.md`
- [ ] T070 [P] [US5] Add approved CTA binding tests for landing, about, wedding services, general services, and inquiry selection in `src/app/components/public/landing/landing.component.spec.ts`, `src/app/components/public/about/about.component.spec.ts`, `src/app/components/public/wedding-services/wedding-services.component.spec.ts`, `src/app/components/public/general-services/general-services.component.spec.ts`, and `src/app/components/public/inquiries/inquiries.component.spec.ts`
- [ ] T071 [P] [US5] Add approved CTA binding tests for location hub/detail, testimonials, and inquiry success in `src/app/components/public/locations-hub/locations-hub.component.spec.ts`, `src/app/components/public/locations/locations.component.spec.ts`, `src/app/components/public/testimonials/testimonials.component.spec.ts`, and `src/app/components/public/inquiries/inquiry-success/inquiry-success.component.spec.ts`
- [ ] T072 [US5] Instrument the approved landing, about, service, and inquiry CTA bindings from the inventory without transmitting destinations in `src/app/components/public/landing/landing.component.html`, `src/app/components/public/about/about.component.html`, `src/app/components/public/wedding-services/wedding-services.component.html`, `src/app/components/public/general-services/general-services.component.html`, and `src/app/components/public/inquiries/inquiries.component.html`
- [ ] T073 [US5] Instrument the approved location, testimonial, and inquiry-success CTA bindings from the inventory without transmitting destinations in `src/app/components/public/locations-hub/locations-hub.component.html`, `src/app/components/public/locations/locations.component.html`, `src/app/components/public/testimonials/testimonials.component.html`, and `src/app/components/public/inquiries/inquiry-success/inquiry-success.component.html`
- [ ] T074 [US5] Emit a portfolio-content event only after successful content resolution and only with an audited editorial slug or generic category in `src/app/components/public/portfolio-detail/portfolio-detail.component.ts`
- [ ] T075 [US5] Carry the allowlisted `workshop` origin through workshop CTA navigation without changing the general inquiry route or CRM lead type in `src/app/components/public/workshops/workshops.component.ts` and `src/app/components/public/workshops/workshops.component.html`
- [ ] T076 [US5] Consume the safe workshop origin separately from inquiry type and exclude arbitrary query values from analytics in `src/app/components/public/general-inquiries/general-inquiries.component.ts`
- [ ] T077 [US5] Validate lowercase UTM attribution, content categories, CTA/social/contact events, portfolio privacy fallback, and workshop-to-general lead context in `docs/analytics/validation-record.md`

**Checkpoint**: Public content and marketing interactions are actionable without becoming customer profiles or leaking destinations.

---

## Phase 8: User Story 6 - Operate Trustworthy Measurement (Priority: P2)

**Goal**: Make property ownership, privacy disclosure, retention, event meanings, access, incidents, and recurring review understandable and maintainable.

**Independent Test**: Audit the deployed policy and provider settings against the event dictionary, ownership record, access roles, retention, campaign convention, validation record, and monthly/annual procedures.

### Tests for User Story 6

- [ ] T078 [P] [US6] Replace placeholder privacy-policy tests with analytics disclosure, choices, GPC, retention, Google-provider, excluded-data, withdrawal, and contact-content assertions in `src/app/components/public/privacy-policy/privacy-policy.component.spec.ts`

### Implementation for User Story 6

- [ ] T079 [US6] Replace the placeholder policy with qualified-review-approved plain-language analytics, storage, regional default, GPC, Google role, 14-month retention, exclusion, withdrawal, and privacy-contact disclosures in `src/app/components/public/privacy-policy/privacy-policy.component.html`
- [ ] T080 [US6] Style the complete privacy policy for readable responsive light/dark presentation in `src/app/components/public/privacy-policy/privacy-policy.component.scss`
- [ ] T081 [P] [US6] Document ongoing named least-privilege access reviews, temporary third-party access, recovery testing, ownership transfer, revocation, obsolete-user removal, and annual review after the initial administrator assignment in `docs/analytics/access-and-governance.md`
- [ ] T082 [P] [US6] Configure/document 14-month retention with reset-on-new-activity off, detailed-versus-aggregate limitations, owner, review point, and future export decision criteria in `docs/analytics/retention-governance.md`
- [ ] T083 [P] [US6] Configure/document Google Signals, Ads, personalization, user-provided data, granular device/location data, product links, URL passthrough, and unnecessary sharing as disabled in `docs/analytics/provider-configuration-checklist.md`
- [ ] T084 [P] [US6] Create the prohibited-data incident containment, provider-remediation, access-review, correction, revalidation, and reactivation procedure in `docs/analytics/incident-response.md`
- [ ] T085 [US6] Record the privacy review decision, deployed policy version, property owners, user roles, retention, disabled settings, and next annual/change-triggered review in `docs/analytics/validation-record.md`
- [ ] T086 [US6] Verify the live privacy policy and Analytics Preferences behavior match observed production collection in `docs/analytics/validation-record.md`

**Checkpoint**: The florist owns and can govern the measurement system without undocumented accounts, settings, or event meanings.

---

## Phase 9: User Story 7 - Preserve Website Reliability and Experience (Priority: P3)

**Goal**: Ensure analytics remains optional, asynchronous, fail-silent, and performance-safe across SSR, hydration, navigation, and inquiry workflows.

**Independent Test**: Block regional and Google endpoints, exercise every critical public task on desktop/mobile, validate single page views when enabled, and compare approved pre/post Core Web Vitals.

### Tests for User Story 7

- [ ] T087 [P] [US7] Extend application tests for blocked regional/Google requests, script rejection, storage exceptions, and unchanged SEO/auth/public initialization in `src/app/app.component.spec.ts`
- [ ] T088 [P] [US7] Extend public-layout tests for SSR/hydration-safe rendering and provider-independent navigation/content availability in `src/app/core/layouts/public-layout/public-layout.component.spec.ts`
- [ ] T089 [P] [US7] Extend general and wedding inquiry tests so analytics exceptions cannot prevent validation, repository persistence, supporting work, or success navigation in `src/app/components/public/general-inquiries/general-inquiries.component.spec.ts` and `src/app/components/public/wedding-inquiries/wedding-inquiries.component.spec.ts`

### Implementation for User Story 7

- [ ] T090 [US7] Capture the approved pre-release p75 Core Web Vitals source, route/device cohort, sampling method, observation window, values, comparable-traffic assumptions, and minimum post-release observation window before activation in `docs/analytics/performance-baseline.md`
- [ ] T091 [US7] Confirm the qualified privacy review, deployed policy, route/GPC/consent validation, business-controlled ownership, disabled advertising settings, foundational CSP, and pre-release performance baseline are complete, then configure `GA4_MEASUREMENT_ID` only in the published production Netlify context, deploy, verify exact-origin activation, and record the activation timestamp in `docs/analytics/validation-record.md`
- [ ] T092 [US7] Define and run the desktop/mobile route-navigation sample with an explicit route list, direct/refresh/SSR/hydration/SPA cases, sample denominator, missing/duplicate formula, blocked-provider/contact/portfolio/inquiry cases, and calculated 95% result from `specs/010-website-analytics/quickstart.md` in `docs/analytics/validation-record.md`
- [ ] T093 [US7] After the approved minimum observation window, capture post-release p75 Core Web Vitals using the same source, route/device cohort, sampling method, and comparable traffic conditions, calculate category and percentage changes, and record any product-owner exception in `docs/analytics/performance-baseline.md`
- [ ] T094 [US7] Run the complete Karma/Jasmine suite and production Angular build, verify sitemap/robots/SEO/public routes remain intact, and record commands/results in `docs/analytics/validation-record.md`

**Checkpoint**: Analytics observes the public experience without becoming a dependency or causing an unapproved performance regression.

---

## Phase 10: Polish & Cross-Cutting Release Closure

**Purpose**: Reconcile documentation, complete production acceptance, and leave an operational handoff.

- [ ] T095 [P] Reconcile event names, safe parameters, route categories, campaign vocabulary, policy version, and consent behavior across `docs/analytics/measurement-dictionary.md`, `src/app/core/analytics/analytics.models.ts`, and `specs/010-website-analytics/contracts/website-analytics.md`
- [ ] T096 [P] Review all changed Angular files for accidental raw URL, title, referrer, form value, contact destination, CRM ID, payment, authentication, or token transmission and record findings in `docs/analytics/validation-record.md`
- [ ] T097 Verify GA DebugView/Realtime receives one event per intended action and zero Ads/DoubleClick requests while standard reports are allowed their documented processing delay in `docs/analytics/validation-record.md`
- [ ] T098 Verify the production Search Console sitemap status, GA4 link, published report collection, `generate_lead` key event, 14-month retention, two administrators, and disabled advertising/data-sharing settings in `docs/analytics/validation-record.md`
- [ ] T099 Execute the rollback drill by disabling the production Measurement ID/configuration and confirming the website remains functional with zero Google requests, then restore only after validation in `docs/analytics/validation-record.md`
- [ ] T100 Create the 60-to-90-day baseline follow-up entry with owner, activation date, due window, native report locations, and low-volume caveat in `docs/analytics/monthly-reporting-runbook.md`
- [ ] T101 Perform a final requirements trace from FR-001 through FR-061 and SC-001 through SC-018 to implementation and evidence in `docs/analytics/requirements-traceability.md`
- [ ] T102 Prepare a human-operated source-control handoff summary and suggested commit message in `docs/analytics/validation-record.md` without running commit or push commands

---

## Dependencies & Execution Order

### Phase dependencies

```text
Phase 1 Setup
  → Phase 2 Foundational (blocks every story)
      → US1 Qualified Inquiry Journeys (P1)
      → US2 Sensitive Journey Protection (P1)
      → US3 Analytics Choice (P1)
          → US4 Search Visibility + Outcomes (P2)
          → US5 Content + Marketing Performance (P2)
          → US6 Trustworthy Operations (P2)
              → US7 Reliability + Experience (P3)
                  → Release Closure
```

### User story dependencies

- **US1** depends only on the foundational analytics facade and can deliver the first business outcome independently.
- **US2** depends only on the foundational route policy/sanitizer and may proceed in parallel with US1 after Phase 2.
- **US3** depends on foundational preference, region, Google client, and route policy services and may proceed in parallel with US1/US2 after Phase 2.
- **US4** is operationally useful once US1 produces confirmed-lead events and the production properties can be configured; property setup documentation can begin earlier.
- **US5** depends on the typed facade and benefits from US1 inquiry context plus US2's identifier audit; directive and component tests can begin after Phase 2.
- **US6** depends on the final consent/event behavior from US1–US5 so disclosures and governance evidence match reality.
- **US7** validates the integrated implementation and therefore follows the desired P1/P2 stories, although baseline capture and failure tests can start earlier.

## Parallel Execution Examples

### US1

```text
Parallel: T028 inquiry state tests, T029 general inquiry tests, T030 wedding inquiry tests
Then: T031 → T032 and T033 in parallel → T034 → T035–T036
```

### US2

```text
Parallel: T037 route metadata tests, T038 transition tests, T039 Not Found tests, T040 payload tests
Then: T041, T043, and T044 in parallel → T042 → T045
```

### US3

```text
Parallel: T046 preferences tests, T047 footer tests, T048 layout tests
Then: T049–T051 → T052 and T053 → T054 and T055
```

### US4

```text
Parallel: T056 GA property setup, T058 Search Console setup, T060 limitations guide
Then: T057 and T059 → T061 → T062
```

### US5

```text
Parallel: T063 directive tests, T064 portfolio tests, T065 workshop tests, T066 general-origin tests, T070 CTA group tests, T071 CTA group tests
Then: T067 → T068; T069 → T072 and T073; T074; T075 → T076 → T077
```

### US6

```text
Parallel: T078 privacy tests, T081 access guide, T082 retention guide, T083 provider checklist, T084 incident guide
Then: T079–T080 → T085–T086
```

### US7

```text
Parallel: T087 app failure tests, T088 layout tests, T089 inquiry failure tests, T090 baseline capture
Then: T019 and T090 plus all documented release gates → T091 → T092 → T093–T094
```

## Implementation Strategy

### MVP first

1. Complete Setup and Foundational phases.
2. Complete US1 to establish trustworthy inquiry starts and durable confirmed leads.
3. Complete US2 and US3 before any production activation; although independently testable, both are mandatory privacy release gates.
4. Validate the P1 increment with the zero-request and consent matrices before adding broader interaction events.

### Incremental delivery

1. **P1 measurement core**: US1 + US2 + US3.
2. **Decision support**: US4 + US5.
3. **Operational readiness**: US6.
4. **Production acceptance**: US7 + release closure.

Production analytics must remain disabled until the qualified privacy review, accurate privacy policy, P1 tests, sensitive-route Network checks, property governance, and performance baseline are complete.

## Notes

- Every `[P]` task is limited to files that can be worked independently at that point; coordinate before parallel work if the worktree already contains overlapping user changes.
- Tests should be written first where practical and must fail for the intended reason before implementation satisfies them.
- No task may add GTM, a CMP, Google Ads, Signals, remarketing, audience activation, user-provided data, raw URL collection, a Supabase schema change, or a Supabase Edge Function.
- Never create an automated test that targets a Supabase Edge Function; none is affected by this feature.
- Provider-console and privacy-review tasks require the named human/business owner and cannot be truthfully marked complete from repository code alone.
- AI agents must not run `git commit`, `git push`, or commit/push-capable automation.
