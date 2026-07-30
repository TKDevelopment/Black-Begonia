# Phase 0 Research: Public Website Analytics and Search Insights

## Decision 1: Direct GA4 tag, not Google Tag Manager

**Decision**: Dynamically load direct `gtag.js` from reviewed Angular code only after eligibility is established.

**Rationale**: The site has one analytics vendor, one optional purpose, a small stable taxonomy, and unusually strict route/consent boundaries. Direct integration keeps every event and exclusion code-reviewed, reduces the CSP and governance surface, and makes the documented GA disable mechanism straightforward.

**Alternatives considered**:

- **Google Tag Manager**: Useful when non-developers manage several vendors/tags, but container publishing could bypass route and privacy safeguards. Reconsider only with formal container governance and multiple approved vendors.
- **Server-side tagging**: Adds infrastructure, cost, and governance without improving the first-party consent decision for this scope.

Sources: [Google tag consent guide](https://developers.google.com/tag-platform/security/guides/consent), [GTM overview](https://developers.google.com/tag-platform/tag-manager), [GTM consent APIs](https://developers.google.com/tag-platform/tag-manager/datalayer).

## Decision 2: Custom preferences UI, subject to privacy review

**Decision**: Use an accessible, first-party analytics preferences component rather than a CMP for the initial single-purpose deployment.

**Rationale**: It can express the selected U.S. default-on/non-U.S. opt-in policy, 12-month preference, withdrawal, and GPC precedence without another vendor or blocking dependency. A qualified privacy review remains a release gate.

**Alternatives considered**:

- **Consent-management platform**: Prefer if legal review requires jurisdiction-maintained rules, consent receipts, vendor scanning, IAB integration, or multiple purposes/vendors. It adds cost, script weight, and timing risk today.
- **Global opt-in**: Simpler but loses a material amount of legitimate U.S. acquisition/funnel data.
- **Global advanced Consent Mode**: Rejected because denied state can still transmit cookieless measurements, conflicting with the no-post-opt-out-request promise.

Sources: [Consent Mode overview](https://developers.google.com/tag-platform/security/concepts/consent-mode?hl=en), [Consent implementation](https://developers.google.com/tag-platform/security/guides/consent).

## Decision 3: First-party coarse region gate

**Decision**: Add a same-origin `/api/analytics-region` branch to the existing Netlify Angular handler in `src/server.ts`. It maps Netlify request context to `us`, `non_us`, or `unknown`, reports `Sec-GPC`, and indicates whether the deploy is published production. Return no IP or granular location and use `Cache-Control: private, no-store`.

**Rationale**: Google regional defaults operate after the Google tag loads and therefore cannot enforce zero Google requests for non-U.S./unknown pre-consent visitors. Netlify already has request country context, avoiding a new geolocation vendor. Failures and ambiguity resolve to `unknown`.

**Alternatives considered**:

- **Browser language/timezone inference**: Not reliable enough to establish location.
- **Third-party GeoIP API**: Adds a processor, latency, and disclosure burden.
- **Google region defaults alone**: Cannot meet the no-request boundary before tag load.

Sources: [Netlify Functions API](https://docs.netlify.com/build/functions/api/), [Angular on Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/angular/).

## Decision 4: Basic/no-load behavior and explicit withdrawal shutdown

**Decision**: Never load Google for excluded, non-U.S./unknown pre-consent, GPC, or opted-out contexts. On withdrawal, immediately set `window['ga-disable-MEASUREMENT_ID'] = true`, stop dispatch/listeners, clear queues, remove known first-party GA cookies, persist the choice, and send no withdrawal event.

**Rationale**: Advanced Consent Mode intentionally supports cookieless pings. The disable flag is Google's documented way to prevent the tag from setting cookies or sending data. GPC must be enforced by the application because official Google material does not promise automatic GA4 handling.

**Alternatives considered**:

- **Only `analytics_storage: denied`**: Insufficient for the stated zero-request requirement.
- **Consent-update event after withdrawal**: Could itself transmit; shutdown precedes any provider command.

Sources: [Basic and advanced Consent Mode](https://developers.google.com/tag-platform/security/concepts/consent-mode?hl=en), [Google privacy controls](https://developers.google.com/tag-platform/security/guides/privacy), [GPC specification](https://www.w3.org/TR/gpc/), [Google cookie configuration](https://developers.google.com/tag-platform/security/guides/customize-cookies).

## Decision 5: Angular-controlled SPA measurement

**Decision**: Set `send_page_view: false`, disable conflicting Enhanced Measurement behaviors, and let a browser-only Angular facade emit one sanitized page view per eligible `NavigationEnd`.

**Rationale**: One owner avoids hydration/history duplicates and permits exact route allowlisting. The facade can stop at `NavigationStart` into a private route and maintain a sanitized previous-page value without raw browser URLs.

**Alternatives considered**:

- **Enhanced Measurement history tracking**: Less code, but cannot reliably enforce the application's route, SSR, consent, and sanitization rules and risks duplicate page views.
- **GTM history triggers**: Adds the same duplication and governance risks.

Sources: [GA4 SPA measurement](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications), [Page-view configuration](https://developers.google.com/analytics/devguides/collection/ga4/views?hl=en).

## Decision 6: Strict event and URL minimization

**Decision**: Use a typed facade and safe enums/allowlists. Never send raw `location.href`, query, fragment, page title derived from unknown input, form value/destination, full contact/outbound target, CRM identifier, or token. Locally parse only documented UTM fields, normalize and validate them, and send approved values separately.

**Rationale**: Application-side prevention is controllable and testable; Google redaction is best-effort defense in depth. Custom contact, form, scroll, outbound, and download events avoid automatic parameters such as raw URLs and form destinations.

**Alternatives considered**:

- **Forward raw URLs and rely on redaction**: Rejected because redaction has documented limits.
- **Drop all campaign parameters**: Safe but defeats a core attribution goal; strict campaign allowlisting resolves the tension.

Sources: [Avoid sending PII](https://support.google.com/analytics/answer/6366371?hl=en), [GA4 data redaction](https://support.google.com/analytics/answer/13544947?hl=en), [Campaign URL guidance](https://support.google.com/analytics/answer/10917952?hl=en).

## Decision 7: Durable CRM creation is the lead boundary

**Decision**: Emit `inquiry_start` once after the first meaningful user-driven visible-field change, and `generate_lead` once immediately after the existing repository confirms durable lead creation.

**Rationale**: This separates intent from an accepted business record and prevents validation failures, direct success-page visits, and later email/upload/navigation failures from changing the lead result. No lead record data is transmitted.

**Alternatives considered**:

- **Submit click or success-page view**: Both overcount failed/manual/duplicate flows.
- **Wait for all supporting work**: Undercounts accepted leads when email or navigation fails.

Source: [GA4 recommended `generate_lead` event](https://developers.google.com/analytics/devguides/collection/ga4/reference/events?hl=en).

## Decision 8: GA4 and Search Console account model

**Decision**: One business-owned GA account, one production GA4 property and stream, Eastern timezone, USD, 14-month event/user retention with reset-on-new-activity off, and a DNS-verified Search Console domain property. The florist and a separate business-controlled recovery account are administrators/verified owners; everyone else receives named least privilege.

**Rationale**: This is proportionate to one website, supports 60–90-day and year-over-year decisions, and prevents ownership loss or undocumented third-party control. Search Console supplies pre-click data; GA4 supplies eligible post-click behavior.

**Alternatives considered**:

- **URL-prefix Search Console property**: Easier verification but narrower coverage than the canonical domain property.
- **Separate streams for local/preview**: Rejected; production ID should be absent and exact-host guarded, keeping test traffic out entirely.

Sources: [GA account structure](https://support.google.com/analytics/answer/9679158?hl=en), [GA retention](https://support.google.com/analytics/answer/7667196?hl=en), [GA access roles](https://support.google.com/analytics/answer/9305587?hl=en), [Search Console properties](https://support.google.com/webmasters/answer/34592?hl=en), [Ownership verification](https://support.google.com/webmasters/answer/9008080?hl=en).

## Decision 9: Native reporting only

**Decision**: Link Search Console to GA4, publish Google's Search Console report collection, and document a monthly review in native Search Console and GA4 reports. Mark `generate_lead` as the only initial key event.

**Rationale**: Native reports answer the initial business questions without a paid tool, warehouse, custom CRM dashboard, or scheduled report pipeline. Totals are expected to differ due to collection, attribution, consent, canonicalization, privacy, and reporting delays.

**Alternatives considered**:

- **Looker Studio or custom dashboard**: Unnecessary initial complexity and expressly outside the clarified scope.
- **BigQuery warehouse**: Not justified for present scale or 14-month detailed exploration needs.

Sources: [Search Console–GA4 linking](https://support.google.com/analytics/answer/10737381?hl=en-EN), [GA report library](https://support.google.com/analytics/answer/12949349?hl=en), [Search performance report](https://support.google.com/webmasters/answer/7576553?hl=en-EN), [Key events](https://support.google.com/analytics/answer/13128484?hl=en-SG).

## Decision 10: Defense-in-depth provider configuration and CSP

**Decision**: Explicitly deny advertising consent and disable signals, personalization, URL passthrough, Ads links, user-provided data, granular device/location data, and unnecessary account sharing. Dynamically load only non-advertising GA endpoints and validate the narrow CSP before enforcement.

**Rationale**: Code and property settings can drift independently; both must enforce minimization. Async conditional loading protects performance and website availability. Google's June 2026 controls change reinforces annual and change-triggered review.

**Alternatives considered**:

- **Rely on provider defaults**: Defaults can be permissive and change over time.
- **Pre-authorize Ads/DoubleClick endpoints**: Contradicts the permanent advertising exclusion.

Sources: [Tag privacy controls](https://developers.google.com/tag-platform/security/guides/privacy), [GA privacy controls](https://support.google.com/analytics/answer/9019185?hl=en), [Data-sharing settings](https://support.google.com/analytics/answer/1011397?hl=en), [Google CSP guidance](https://developers.google.com/tag-platform/security/guides/csp), [2026 data-control update](https://support.google.com/analytics/answer/17016975?hl=en).
