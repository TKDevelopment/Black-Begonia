# Analytics Validation Record

## Automated validation

| Date | Check | Result |
|---|---|---|
| 2026-07-23 | Focused analytics and preferences | `npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox` with the analytics, directive, and preferences specs: 27/27 pass. |
| 2026-07-23 | Wedding/general inquiry measurement | Focused wedding and general inquiry suites: 13/13 pass. |
| 2026-07-23 | Affected UI components | Focused App, layout, footer, preferences, privacy, and public CTA suites pass. |
| 2026-07-23 | Angular production browser/server build | Optimized production build succeeds in a clean output directory; 24 static routes prerendered. Placeholder Supabase values log a non-fatal portfolio discovery warning. |
| 2026-07-23 | Complete repository Karma suite | 617/621 pass. Four unrelated brownfield failures remain in pre-existing lead/payment tests; analytics-focused suites are green. |

## Required pre-release evidence

Pending: desktop/mobile direct loads and SPA navigation, one page view per approved navigation,
zero requests on every excluded route, GPC/browser plus HTTP precedence,
U.S./non-U.S./unknown branches, enable/decline/withdraw/re-enable, unavailable storage/provider,
inquiry invalid/failure/retry/support-failure/success matrices, manual success URL, sanitized
campaigns, Not Found, PII inspection, Tag Assistant/DebugView/Realtime, internal-browser exclusion,
keyboard/screen reader checks, and before/after Core Web Vitals.

Provider/account evidence, qualified privacy approval, live Search Console/GA4 data, and the
60–90-day baseline are deliberately not marked complete by source-code implementation.

## Source payload audit

The analytics boundary contains no reads of inquiry values, DOM text, href destinations, CRM/payment
models, authentication values, or secure tokens. Only the inquiry type and allowlisted workshop
origin cross the inquiry boundary. Dynamic locations use an audited editorial allowlist; portfolio
details and Not Found use fixed generic canonical paths. Query strings and fragments are removed,
UTMs are parsed by allowlist, and external referrers are reduced to origin.

## Human source-control handoff

No commit or push was performed. Suggested commit message:

`feat(analytics): add privacy-restricted GA4 measurement foundation`

Body:

- allowlist public Angular routes and exclude CRM, payment, and authentication surfaces
- add regional consent/GPC handling, preferences UI, sanitization, and typed events
- measure durable inquiry outcomes, safe public actions, portfolio engagement, and scroll depth
- update the privacy policy, CSP, environment generation, governance docs, and validation coverage
