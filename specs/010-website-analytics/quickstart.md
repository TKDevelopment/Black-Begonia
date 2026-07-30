# Quickstart: Configure and Validate Website Analytics

This is the implementation and production-acceptance runbook. It does not replace the required qualified privacy review.

## 1. Prerequisites and ownership

Before production activation:

1. Confirm the florist has a named business-controlled Google account.
2. Establish a separate recoverable business-controlled Google account.
3. Record both as the only standing administrators/verified owners.
4. Give other users named Viewer/Analyst access only; use temporary Editor access when configuration work genuinely requires it and revoke afterward.
5. Complete the qualified review of the U.S. default-on/non-U.S. opt-in policy, GPC behavior, notice, contractual/property settings, applicable thresholds, and pending law changes.
6. Approve the privacy-policy language and a dated policy version.

Do not place passwords, recovery information, DNS credentials, or service credentials in this repository. A GA Measurement ID is public configuration, but it must still be environment-scoped so non-production builds cannot pollute production reports.

## 2. Create Google properties

### GA4

1. Create/select one business-owned Google Analytics account.
2. Create one production GA4 property and one web stream for `https://blackbegoniaflorals.com`.
3. Set reporting timezone to U.S. Eastern and currency to USD.
4. Set event/user retention to 14 months and turn **Reset user data on new activity** off.
5. Add the florist and recovery account as Administrators.
6. Disable Google Signals, user-provided data, Ads personalization, granular device/location data, and all Google Ads/product links.
7. Turn off unnecessary account data-sharing options. Leave technical-support sharing off unless deliberately enabled for a support case.
8. Enable email and known sensitive-query redaction as defense in depth.
9. Configure Enhanced Measurement so automatic/history page views and application-owned form, scroll, outbound, and download events cannot duplicate or leak unsafe values.
10. Register `generate_lead` as the only initial key event and register only approved safe custom dimensions.

### Search Console

1. Create a Domain property for `blackbegoniaflorals.com`.
2. Add and retain Google's DNS TXT verification record.
3. Verify both business-controlled owner accounts.
4. Submit `https://blackbegoniaflorals.com/sitemap.xml` and confirm **Success**.
5. Confirm the sitemap contains only canonical public indexable URLs and excludes admin, payment, authentication, recovery, and token-bearing routes.
6. Link the Domain property to the production GA4 web stream from GA Admin → Product links → Search Console Links.
7. Publish the Search Console report collection from the GA4 Library.

Search Console and GA4 totals will differ. Search Console data is delayed and privacy/canonicalization limited; GA4 is consent, browser, and attribution limited.

## 3. Application configuration

1. Add `ga4MeasurementId` to the typed environment model and generation script.
2. Keep it blank/disabled in local, test, preview, and staging configurations.
3. Supply `GA4_MEASUREMENT_ID` only to the published production Netlify context.
4. Require an exact `https://blackbegoniaflorals.com` runtime host match and published deploy context.
5. Add `/api/analytics-region` to the existing `src/server.ts` Netlify handler. Return only `region`, `gpc`, and `production`, with `Cache-Control: private, no-store`.
6. Add the minimum non-advertising Google tag script and GA collection endpoints to CSP. Do not add Ads or DoubleClick hosts. Validate CSP in report-only/testing form first if deployment tooling supports it.
7. Update the public privacy policy and add the footer **Analytics Preferences** action.

## 4. Automated verification

Run focused tests while implementing, then the complete frontend suite and build:

```powershell
npm run test -- --watch=false --browsers=ChromeHeadless
npm run build
```

Required automated coverage includes route default-deny, SSR/browser and exact-host guards, consent/GPC/expiry/storage states, regional failure, dynamic tag loading and shutdown, sanitization, route/page/event deduplication, inquiry boundaries, workshop origin, 90% scroll, safe Not Found behavior, and accessible preferences UI.

No Supabase migration, database integration test, or Supabase Edge Function test is required because this feature changes none of those surfaces.

## 5. Local and preview smoke checks

Use Netlify Dev or a preview deploy to exercise the server endpoint and UI, but keep the production Measurement ID absent.

1. Request `/api/analytics-region`; verify only the three documented fields are returned and caching is private/no-store.
2. Simulate U.S., non-U.S., missing geo, endpoint failure, and `Sec-GPC: 1` where the Netlify tooling permits.
3. Confirm every local/preview scenario makes zero production Google requests.
4. Confirm all public pages, SSR output, hydration, routing, portfolio loading, contact actions, and both inquiry flows work when the regional endpoint and all Google endpoints are blocked.
5. Inspect built output/configuration for accidental privileged values.

## 6. Production measurement matrix

Use browser Network tools, Tag Assistant, GA DebugView/Realtime, and supported mobile/desktop sizes.

| Scenario | Expected result |
|---|---|
| U.S., no saved choice | Restricted GA loads; one sanitized current page view; clear opt-out available |
| Non-U.S., no choice | No Google request until affirmative enable |
| Unknown/endpoint failure | No Google request until affirmative enable |
| Saved enable with endpoint failure | No Google request until the endpoint resolves; saved choice overrides region, not unresolved GPC |
| GPC with prior enable | No Google request |
| Saved enable with `Sec-GPC: 1` | No Google request; HTTP GPC overrides the saved choice |
| Manual withdrawal mid-session | No request begins after withdrawal processing; no cookieless ping |
| Re-enable later | Current/future eligible activity only; no replay |
| Direct `/admin/*`, `/pay/*`, login/recovery/change-password | No tag activation or request |
| Public → excluded SPA navigation | Dispatch disabled before destination; zero excluded-route request/event |
| Excluded → public | Re-evaluate policy; measure only if currently permitted |
| Internal-marked florist browser | No production Google request |
| Public direct load/refresh/hydration/client navigation | Exactly one page view per actual navigation |
| Query/hash with test email/token text | Test text absent from every GA request |
| Unknown Not Found path | Only `other` or safe category; no raw/encoded path |
| First meaningful inquiry field change | One `inquiry_start` |
| Validation/repository failure | No `generate_lead` |
| Durable lead created, later email/navigation fails | Exactly one `generate_lead` |
| Success route entered/refreshed manually | No `generate_lead` |
| Google blocked/unavailable | Website and inquiry remain fully functional |

Also confirm no request is sent to Ads, DoubleClick, remarketing, or unexpected Google endpoints.

## 7. Content-identifier privacy audit

Before enabling item-level portfolio reporting, audit every proposed public slug. Reject customer/couple names, UUIDs, event dates, or reversible customer identifiers. Approve only editorial non-personal slugs. For any uncertain item, emit the generic `portfolio_detail` category without an item identifier. Privacy takes priority over per-item granularity.

## 8. Performance and release acceptance

1. Record the pre-release p75 Core Web Vitals using an approved production measurement source, route/device cohort, sampling method, and observation window; approve the minimum comparable post-release window before activation.
2. Validate async post-eligibility tag loading and no content/form blocking.
3. Record the post-release comparison only after the approved minimum window using the same source, route/device cohort, sampling method, and comparable traffic conditions.
4. Do not accept a move from good to needs-improvement/poor or a regression over 10% without explicit product-owner approval.
5. Save the completed measurement matrix, privacy review, provider settings, ownership/access list, retention setting, sitemap/link status, policy version, and performance evidence.

Rollback by removing/blanking the production Measurement ID or setting the production analytics feature configuration off, then confirm zero Google requests. Website and inquiry behavior must remain unchanged.

## 9. Monthly and annual operations

### Monthly native review

In Search Console, compare the previous complete month with the prior month and, when meaningful, prior year: clicks, impressions, CTR, position trends, queries, pages, country, device, location/service URL groups, and rising-impression/low-CTR opportunities.

In GA4, review Traffic acquisition, User acquisition, Landing page, Pages and screens, Events, Key events, linked Organic Search reports, and funnel/path Explorations. Compare source/medium, campaign, landing/content category, device, `inquiry_start`, `generate_lead`, and key-event rate. Label low-volume, delayed, thresholded, consent-limited, and unavailable results; do not infer causation from correlation.

Collect 60–90 days before major conclusions. GA4 does not improve rankings directly; it shows eligible post-click behavior while Search Console shows pre-click Google Search performance.

### Annual/change-triggered review

Review access, recovery ownership, retention, data sharing, Signals/Ads/product links, redaction, event schemas, route allowlist, public slugs, campaign registry, privacy policy, GPC behavior, target markets, traffic volume, applicable laws, and Google control changes at least annually and after any material change.

### Incident response

If unintended or prohibited data is detected: disable production analytics, preserve minimal diagnostic evidence without copying the sensitive value further, correct the source/sanitizer, review access and provider-side deletion/remediation options, update policy/process as needed, and rerun the full validation matrix before reactivation.
