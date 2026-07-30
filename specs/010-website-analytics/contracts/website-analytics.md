# Contract: Public Website Analytics

## 1. Activation boundary

Analytics may activate only when every predicate is true:

1. Browser execution, not SSR/prerender.
2. Exact production origin and published production deploy.
3. Explicitly allowlisted public route.
4. Browser is not internally marked.
5. Browser GPC and HTTP `Sec-GPC` have both resolved false. The regional endpoint is always required before activation; an unavailable endpoint blocks analytics even when a saved opt-in exists.
6. A valid enabled preference exists, or no preference exists and region is confidently U.S.
7. A production Measurement ID is configured.

Every unknown/new route is denied. `/admin/*`, `/pay/*`, login, password recovery/change, authenticated, secure token-bearing, local, preview, staging, test, and internal-marked contexts are denied.

## 2. Regional endpoint

`GET /api/analytics-region`

Successful response:

```json
{
  "region": "us",
  "gpc": false,
  "production": true
}
```

- `region`: `us`, `non_us`, or `unknown` only.
- `gpc`: whether the HTTP request carried `Sec-GPC: 1`.
- `production`: true only for the published production deployment.
- Headers: `Content-Type: application/json`, `Cache-Control: private, no-store`.
- No request body, authentication, cookie, IP, location detail, logging identifier, or persistence.
- Any exception, missing geo, non-published context, timeout, malformed payload, or non-2xx response fails closed in the browser.

## 3. Preference contract

Storage key is versioned and contains only the `AnalyticsPreference` schema in [data-model.md](../data-model.md). Preference duration is at most 12 months. A changed material `policyVersion`, corruption, expiry, or unsupported schema invalidates it.

- Confident U.S., no choice: restricted analytics may activate; show clear notice and opt-out access.
- Non-U.S./unknown, no choice: no Google request; show affirmative enable/decline choice.
- Saved enabled: still resolve the regional endpoint before activation so HTTP GPC can override; endpoint failure blocks activation until the signal can be resolved.
- Saved disabled: no Google request.
- GPC: disabled regardless of saved enabled preference.
- Withdrawal: set GA disable flag first, stop dispatch, clear known GA cookies, persist disabled, and send no analytics event.
- Re-enable: load/configure only for the current eligible page and future activity; do not replay blocked events.
- Storage unavailable: no persistent assumption; unknown/non-U.S. remains disabled and core website behavior remains available.

The footer exposes an always-available keyboard/screen-reader-operable **Analytics Preferences** action wherever the public footer is rendered, including excluded payment or authentication routes. Preference visibility never grants route eligibility: excluded routes still cannot load or dispatch GA. Declining never blocks content, contact links, or inquiries.

The preferences interface includes a clearly labeled staff control that sets or removes the non-identifying internal-browser marker through `AnalyticsPreferenceService`. It is available only as a deliberate secondary action, explains that it excludes the current browser from business analytics, and does not claim to authenticate staff. Accidental use by a public visitor only disables analytics for that browser.

## 4. Provider initialization contract

When permitted, initialize exactly once:

- asynchronous direct `gtag.js` load;
- `send_page_view: false`;
- `ad_storage`, `ad_user_data`, and `ad_personalization`: denied;
- `allow_google_signals: false`;
- `allow_ad_personalization_signals: false`;
- URL passthrough: disabled;
- no User-ID, user-provided data, Ads destinations, remarketing, or audience activation;
- custom first-party cookie prefix if used for deterministic withdrawal cleanup.

Automatic/history page views and conflicting enhanced form, scroll, outbound, and download measurement remain off. Application code is the only event owner.

## 5. Route and URL contract

The route policy returns only canonical production paths/templates and controlled categories. It strips query strings and fragments before classification.

- Static public route: canonical static path.
- Known public portfolio/location detail: canonical path with a verified public slug.
- Unknown dynamic value: omit the value or deny measurement.
- Public wildcard/Not Found: explicitly eligible only when analytics is otherwise permitted and emits `page_category = other` or a recognized safe public category; no unknown path/value/title. It remains unmeasured when consent, GPC, environment, or internal-browser policy disables analytics.
- Referrer: sanitized prior public route or external origin/category only, never a complete personalized URL.

Raw `location.href`, `document.title`, query strings, fragments, tokens, email addresses, telephone numbers, outbound destination paths, form destinations, and submitted values are forbidden.

## 6. Event taxonomy contract

| Event | Trigger | Allowed business parameters | Category |
|---|---|---|---|
| `page_view` | One eligible successful navigation | safe page/content classification, canonical path, sanitized prior page | Traffic |
| `select_content` | Approved portfolio/content selection or view | content category, verified public slug | Engagement |
| `cta_select` | Approved service/promotional CTA | page category, CTA location, safe origin | Intent |
| `inquiry_start` | First user-driven meaningful visible-field change, once/attempt | inquiry type, safe origin, page category | Intent |
| `generate_lead` | Durable CRM lead creation succeeds, once/record journey | inquiry type, safe origin, page/acquisition context | Confirmed lead |
| `phone_click` | Approved public telephone action | originating page category only | Intent |
| `email_click` | Approved public email action | originating page category only | Intent |
| `social_click` | Instagram or Facebook action | platform, originating page category | Intent |
| `outbound_click` | Other explicitly approved external action | safe destination category, originating page category | Intent |
| `file_download` | Approved public resource download | safe resource category/name, originating page category | Engagement |
| `scroll` | First 90% threshold crossing per page view | page category | Engagement |
| `not_found` | Public wildcard view | recognized safe category or `other` only | Traffic quality |

No event accepts form values, free text, CRM IDs, payment values/methods, customer/event dates, raw contact destinations, secure URLs, authentication values, or arbitrary component parameters. `generate_lead` has no monetary `value` or `currency` and is the only initial key event.

## 7. Inquiry contract

- Start is not page entry, focus, programmatic patching, or hidden/honeypot activity.
- Validation failure and failed repository creation never create `generate_lead`.
- Durable lead creation creates `generate_lead` before inspiration upload, email, toast, or navigation; later failures do not suppress or duplicate it.
- Direct/refreshed success-page access never creates `generate_lead`.
- Workshop CTA retains `inquiry_type=general` and separately carries `origin_context=workshop`; CRM lead type remains unchanged.

## 8. Campaign contract

Supported keys are `utm_source`, `utm_medium`, `utm_campaign`, and approved optional `utm_content`/`utm_term`. Values are lowercased, length-limited, character-validated, and preferably selected from the documented campaign registry. Unsafe/unknown values are dropped. Raw queries and advertising click IDs are never forwarded.

Recommended lowercase examples:

- `instagram / social / spring_workshop_2026`
- `venue_name / referral / preferred_vendor_2026`
- `newsletter / email / summer_weddings_2026`

## 9. Failure and performance contract

Region, storage, script, CSP, network, ad-blocker, or GA failure produces a no-op analytics path. It never delays or rejects page rendering, routing, portfolio display, contact actions, form validation, lead persistence, or success navigation. Analytics scripts load asynchronously only after permission. Performance acceptance follows SC-010.

## 10. Manual console contract

Release evidence must verify:

- one business-owned production GA account/property/stream, Eastern time, USD;
- 14-month retention with reset-on-new-activity off;
- two business-controlled administrators, named least-privilege others;
- Google Signals, Ads links/personalization, user-provided data, granular device/location data, and unnecessary data sharing disabled;
- redaction configured as defense in depth;
- DNS-verified Search Console domain property with both owners and successful public sitemap;
- Search Console–GA4 link and published report collection;
- `generate_lead` marked as the only initial key event;
- completed privacy review, accurate policy, measurement matrix, and performance comparison.
