# Implementation Plan: Public Website Analytics and Search Insights

**Branch**: `010-website-analytics` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-website-analytics/spec.md`

## Summary

Add privacy-restricted GA4 measurement to explicitly approved public Angular routes and establish a business-owned Google Search Console domain property. The application will use direct `gtag.js`, loaded only in the browser after a first-party Netlify country classification, GPC, saved preference, exact production-host, internal-browser, and route checks all permit collection. Angular owns sanitized SPA page views and a small typed event taxonomy; automatic GA page, form, outbound, scroll, and download measurement is disabled to prevent duplicates and unsafe parameters. A custom accessible preferences experience is proportionate to this single analytics purpose, subject to the required qualified privacy review. Native GA4 and Search Console reports provide the operational reporting surface.

## Technical Context

**Language/Version**: Angular 19.2 / TypeScript 5.8 in the browser and existing Netlify Angular server handler

**Primary Dependencies**: Angular Router, Angular SSR/hydration, browser Web APIs, direct Google tag (`gtag.js`), GA4, Google Search Console, and the existing Netlify Angular server handler context; no GTM or CMP dependency in the initial implementation

**Storage**: Versioned, non-sensitive browser preference and internal-browser marker in first-party local storage; GA4-managed first-party cookies only while analytics is permitted. No Supabase database, storage, RLS, or schema changes.

**Testing**: Karma/Jasmine unit tests for all Angular analytics policy, sanitization, consent, routing, event, and inquiry-boundary logic; existing inquiry component tests extended. The regional branch in the existing Netlify Angular server handler is type-checked by the server build and manually exercised with Netlify Dev/deploy-context smoke checks. No Supabase Edge Function is created or changed.

**Target Platform**: Netlify-hosted Angular application at `https://blackbegoniaflorals.com`, including SSR/prerendered public entries and client-side navigation; modern desktop and mobile browsers

**Project Type**: Brownfield Angular public website and CRM in one deployment, with a strict analytics boundary between public marketing routes and private/payment/authentication surfaces

**Performance Goals**: Analytics must load asynchronously after eligibility resolution; provider failure must not block any public task; no p75 Core Web Vital may change from good to needs-improvement/poor or regress by more than 10% without product-owner approval

**Constraints**: Explicit public-route allowlist and default deny for new routes; zero GA activation or requests on `/admin/*`, `/pay/*`, authentication/password, token-bearing, local, preview, staging, automated, or internal-marked contexts; unknown geography fails closed; GPC/manual opt-out permits no later GA request or cookieless ping; advertising features remain disabled; no PII, raw unknown route, query, fragment, form value, CRM, authentication, project, or payment data; qualified privacy review precedes activation; no agent-run commit or push

**Scale/Scope**: One production property and stream, one Search Console domain property, approximately twenty public route families, a lean taxonomy of page/content/CTA/inquiry/contact/social/download/scroll/not-found events, two inquiry workflows, a footer preferences control, privacy-policy update, and operational runbooks

## Constitution Check

*GATE: Passed before Phase 0 and re-checked after Phase 1.*

- **Surface classification**: Public website and cross-cutting browser infrastructure only. The specification is explicit product-owner authorization for analytics, preferences, privacy-policy, public event hooks, and Netlify configuration changes. CRM, payment, proposal-access, and authentication surfaces are exclusion boundaries, not measurement targets.
- **Brownfield preservation**: Existing public pages, inquiry validation and persistence, SEO metadata, sitemap generation, SSR/prerender, CRM, authentication, proposals, and payments remain unchanged except for approved non-blocking instrumentation and disclosures. Successful lead persistence remains the CRM source of truth.
- **Supabase security**: No Supabase data, RLS, storage, secrets, or Edge Functions change. Analytics receives no lead ID or field values. The classifier branch in the existing Netlify server handler returns only `us`, `non_us`, or `unknown` plus GPC/deploy eligibility signals and never returns IP or granular location.
- **Schema migration**: Not applicable; no table is created or modified and no migration is needed.
- **Standalone edge functions**: No Supabase Edge Function is affected. The small branch added to the existing Netlify Angular server handler is not a Supabase Edge Function and has no bearing on the standalone-function or Edge Function test prohibition.
- **Testing plan**: Focused Karma/Jasmine coverage will test route default-deny, SSR/browser guards, consent state transitions, expiry/version invalidation, GPC precedence, sanitization, event deduplication, inquiry boundaries, 90% scroll, and fail-open website behavior. No database tests are needed because no durable backend contract changes.
- **Frontend boundary plan**: Code lives in a public analytics module and public preferences UI. Before an excluded SPA navigation, dispatch is disabled; direct excluded entries never inject Google. Because already executed JavaScript cannot literally be unloaded during a same-document public-to-private transition, acceptance is defined as zero destination event/request, enforced with the GA disable flag and stopped listeners. No frontend split is introduced.
- **Proposal workflow rule**: Not applicable; proposal calculation, Canva PDF upload, and financial traceability are untouched.
- **Security and privacy**: The Measurement ID is public configuration, not a credential. No privileged Google account data enters source control. Central route and parameter allowlists prevent raw URLs, form fields, customer IDs, tokens, and secure data from reaching GA. Google-side redaction is defense in depth only.
- **Git publication boundary**: The agent will not run commit, push, or commit-capable automation. Source-control publication remains a human handoff.

**Post-design re-check**: Pass. The data model and contracts introduce no Supabase or privileged frontend boundary, keep private routes default-denied, retain inquiry persistence as authoritative, and specify testable privacy/performance behavior. No constitution exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/010-website-analytics/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/
    website-analytics.md
  checklists/
    requirements.md
  tasks.md                 # generated in the next Spec Kit phase
```

### Source Code (repository root)

```text
src/app/
  core/analytics/
    analytics.models.ts
    analytics-route-policy.service.ts
    analytics-preference.service.ts
    analytics-region.service.ts
    analytics-sanitizer.service.ts
    analytics.service.ts
    analytics-scroll.service.ts
    analytics-link.directive.ts
    *.spec.ts
  core/layouts/public-layout/
  shared/components/public/
    analytics-preferences/
    footer/
  components/public/
    general-inquiries/
    wedding-inquiries/
    workshops/
    portfolio/
    not-found/
    privacy-policy/
  environments/

src/server.ts                 # existing Netlify Angular handler; adds /api/analytics-region
netlify.toml
set-env.cts
```

**Structure Decision**: Keep analytics policy in a dedicated browser-safe `core/analytics` boundary, use explicit public component/directive hooks for approved business interactions, and keep the preferences UI under shared public components. A small same-origin `/api/analytics-region` branch in the existing `src/server.ts` Netlify handler supplies coarse regional and HTTP GPC signals before Google loads. This works for prerendered entries because classification occurs in a later browser request. No generic global click scraper, Supabase integration, GTM container, or analytics code is added to private components.

## Architecture and Delivery Design

### Phase 0: Research outcome

All technical unknowns are resolved in [research.md](./research.md): direct tag versus GTM, custom control versus CMP, pre-tag regional classification, basic/no-load consent behavior, GPC and withdrawal handling, SPA/SSR measurement ownership, PII/UTM sanitization, inquiry boundaries, provider ownership, native reporting, and CSP/privacy controls. No clarification marker remains.

### Phase 1: Design artifacts

- [data-model.md](./data-model.md) defines the versioned browser preference, internal marker, coarse region result, route policy, runtime state machine, typed event envelope, campaign context, inquiry state, and human governance record.
- [contracts/website-analytics.md](./contracts/website-analytics.md) defines activation, endpoint, preference, provider, route, event, inquiry, campaign, failure, and console contracts.
- [quickstart.md](./quickstart.md) defines property setup, environment configuration, automated and manual validation, the privacy audit, rollback, monthly reporting, annual review, and incident response.

The repository agent context points to this plan. The standard context-update script is not present in this repository, so the SPECKIT-managed plan reference in `AGENTS.md` was updated directly.

### Runtime decision flow

1. On a browser entry or navigation, classify the normalized Angular route before doing any provider work. Unknown routes are denied by default.
2. If the hostname/deploy context is not exact production, the browser is internally marked, or the route is excluded, set the GA disable flag and remain inert.
3. Read browser-level GPC and the versioned preference, then always request the same-origin regional endpoint before enabling analytics so its HTTP `Sec-GPC` result cannot be bypassed by a saved opt-in. If the endpoint fails, its region and HTTP GPC state are unresolved and analytics remains disabled.
4. Merge browser and HTTP GPC signals first. Either signal disables analytics regardless of a saved preference. Only after the endpoint successfully resolves may the application apply a valid saved choice. When no valid preference exists, a confident U.S. result permits restricted analytics by default while non-U.S. or unknown results require opt-in. Saved choices override regional defaults but never detected or unresolved GPC.
5. Only when permitted, inject `gtag.js` asynchronously, initialize all advertising consent as denied, disable signals/personalization/URL passthrough, set `send_page_view: false`, and dispatch the latest current eligible page once.
6. Angular `NavigationEnd` owns subsequent sanitized page views. `NavigationStart` toward an excluded route immediately disables dispatch so no excluded-route event or request occurs. The explicitly configured public wildcard remains eligible only for a constant safe Not Found classification and never exposes the unmatched URL.
7. On withdrawal or GPC, set `window['ga-disable-G-…'] = true` before any further provider command, stop/clear queues and listeners, remove known first-party GA cookies, persist the disabled state, and emit no opt-out analytics event. The validation boundary is that no new GA request may begin after withdrawal processing starts; an already in-flight request cannot be recalled. Re-opt-in measures only the current and future eligible activity, never replaying blocked history.

### Measurement design

- Disable Enhanced Measurement for automatic page changes, form interactions, scroll, outbound clicks, and file downloads where application-controlled equivalents exist.
- A typed analytics facade is the sole caller of `gtag`. Components submit safe enums and allowlisted public content identifiers; the facade applies route, state, schema, character, cardinality, and length checks.
- Parse only documented UTM keys locally, normalize to lowercase controlled values, discard invalid/unknown values, and never send the raw URL, query string, fragment, click identifier, form destination, or full outbound URL.
- Fire `inquiry_start` once per attempt on the first user-driven change to a meaningful visible field. Fire `generate_lead` once immediately after durable CRM lead creation succeeds, before email, inspiration upload, toast, or navigation work. A success-page visit never creates a lead event.
- Track the 90% scroll threshold once per normalized page view. Not Found reports only a recognized public category or `other`.
- Expose a clearly labeled **Black Begonia staff: Exclude this browser from analytics** control inside Analytics Preferences. It invokes the internal-browser preference service, is reversible on the same browser, contains no identity, and has the same privacy-preserving effect if a non-staff visitor uses it.

### Manual provider and governance work

- Create one business GA account, one production GA4 property/web stream, Eastern reporting timezone, USD currency, 14-month retention with reset-on-new-activity disabled, and two business-controlled administrators.
- Disable Ads/product links, Google Signals, user-provided data, ads personalization, granular device/location data, and unnecessary account data sharing. Enable email and known sensitive-query redaction as defense in depth.
- Create a DNS-verified Search Console domain property, retain the DNS record, verify both business owners, submit the public sitemap, link the property to the production stream, and publish the Search Console report collection.
- Register `generate_lead` as the only initial key event and only safe custom dimensions. Use named least-privilege accounts and review them annually and on third-party changes.
- Keep production activation behind the qualified privacy review and a completed validation record.

## Rollout and Rollback

1. Add code and configuration with the production Measurement ID absent/disabled; validate unit tests, SSR build, accessibility, route boundaries, and sanitizer behavior.
2. Configure GA4 and Search Console manually, record ownership/settings, and complete the privacy-policy and qualified privacy review.
3. Deploy with the regional endpoint and foundational CSP allowlist, but keep production analytics disabled by configuration while smoke testing public functionality.
4. Register `generate_lead` as the only initial key event, complete the privacy, ownership, route, consent, and pre-release performance gates, then configure the Measurement ID only in the published production context and record the activation time.
5. Validate U.S./non-U.S./unknown/GPC/internal/excluded-route matrices in Network tools, Tag Assistant, DebugView, and Realtime, then record the acceptance evidence.
5. Compare Core Web Vitals to the approved baseline and begin the 60–90-day reporting baseline.

Rollback is configuration-first: remove/blank the production Measurement ID or disable analytics in the production environment, which leaves all tracking paths inert while preserving the website and preference control. If necessary, revert the CSP allowances and regional function in a later human-managed deployment. Provider-side properties and Search Console verification remain business-owned but can be unlinked without affecting the site.

## Complexity Tracking

No constitution violations require justification.
