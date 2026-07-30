# Data Model: Public Website Analytics and Search Insights

This feature adds no Supabase tables or durable business records. The model below describes browser-owned policy state, transient measurement state, a coarse same-origin regional response, and provider-side configuration entities.

## 1. Analytics Preference

Versioned first-party browser record controlling optional analytics.

| Field | Type | Rules |
|---|---|---|
| `schemaVersion` | integer | Exact supported storage schema; unknown versions are invalid |
| `policyVersion` | string | Changes on a material analytics/privacy-policy change |
| `choice` | `enabled \| disabled` | Explicit visitor choice; no inferred third value is stored |
| `selectedAt` | ISO timestamp | Valid timestamp, no longer than reasonable clock skew in future |
| `expiresAt` | ISO timestamp | Twelve months after selection at most |

Validation failure, expiry, unsupported version, parse failure, or storage unavailability produces `undetermined`; it never produces permission. GPC overrides `enabled` at runtime without silently rewriting the visitor's historical choice.

## 2. Internal Browser Preference

First-party marker used on known florist browsers.

| Field | Type | Rules |
|---|---|---|
| `schemaVersion` | integer | Exact supported version |
| `excluded` | boolean | `true` prevents classification, tag loading, and dispatch |
| `updatedAt` | ISO timestamp | Operational information only |

It contains no user identity and is not sent to GA. If storage is cleared, the florist must deliberately restore it through the documented browser procedure.

## 3. Region Decision

Response from the same-origin regional endpoint.

| Field | Type | Rules |
|---|---|---|
| `region` | `us \| non_us \| unknown` | Only coarse classification exposed |
| `gpc` | boolean | True when `Sec-GPC: 1` is observed |
| `production` | boolean | True only for the published production context |

No IP, country code, state, city, postal code, coordinates, or request identifier is returned or persisted. Timeout, HTTP failure, malformed response, missing geo, or ambiguous deploy context maps to `unknown`/not permitted.

## 4. Route Analytics Policy

Static application policy derived from an Angular route, never from an untrusted title.

| Field | Type | Rules |
|---|---|---|
| `eligible` | boolean | Defaults to false |
| `canonicalPath` | string or null | Allowlisted public path/template, no query or fragment |
| `pageCategory` | enum or null | Controlled low-cardinality reporting category |
| `contentKind` | enum or null | `portfolio`, `location`, `service`, etc. |
| `contentId` | safe slug or null | Only a verified public catalog slug; otherwise omitted |

Private, payment, authentication, recovery, token-bearing, and unmatched future routes are ineligible. Not Found uses only a recognized category or `other`; it carries no unknown segment.

## 5. Analytics Runtime State

Browser-only in-memory state machine.

| State | Meaning |
|---|---|
| `inactive` | SSR, non-production, excluded route, or not initialized |
| `resolving` | Reading preferences/browser GPC and always resolving coarse region plus HTTP GPC before activation |
| `awaiting_opt_in` | Non-U.S. or unknown without a valid enabled choice |
| `loading` | Google tag requested after permission |
| `enabled` | Current eligible/future events may dispatch |
| `disabled` | GPC, visitor opt-out, internal marker, or excluded context blocks dispatch |
| `failed_closed` | Classification/tag/storage error; site works, analytics remains inactive |

### State transitions

```text
inactive → resolving
resolving → disabled          (GPC, saved disabled, internal, excluded, non-production)
resolving → enabled/loading   (successful endpoint resolution plus saved enabled or confident U.S. default)
resolving → failed_closed     (endpoint unavailable, including when a saved opt-in exists)
resolving → awaiting_opt_in   (non-U.S./unknown with no choice)
awaiting_opt_in → loading     (visitor enables)
loading → enabled             (tag configured)
loading → failed_closed       (tag/config failure)
enabled → disabled            (withdrawal, GPC, internal/excluded navigation)
disabled → loading            (later affirmative enable on an eligible public route)
any → inactive                (server execution)
```

Blocked history is never replayed after enabling. On excluded navigation, dispatch is disabled before destination measurement.

## 6. Analytics Event Envelope

Transient, typed facade input.

| Field | Type | Rules |
|---|---|---|
| `name` | approved event enum | No component-defined arbitrary strings |
| `navigationKey` | transient string | Deduplication only; never sent |
| `pageCategory` | controlled enum | Required where applicable |
| `contentCategory` | controlled enum | Optional, low cardinality |
| `contentId` | allowlisted public slug | Optional; never a CRM/database identifier |
| `inquiryType` | `general \| wedding` | Optional |
| `originContext` | `workshop` or other approved enum | Separate from inquiry type |
| `ctaLocation` | approved enum | Optional |
| `socialPlatform` | `instagram \| facebook` | Optional |
| `campaign` | sanitized campaign context | Optional |

Every event schema defines exact allowed parameters and length/character limits. Extra fields are discarded or reject the event. No monetary value is attached to a lead.

## 7. Campaign Context

Sanitized session acquisition context parsed locally from approved keys.

| Field | Rules |
|---|---|
| `source` | Lowercase controlled value |
| `medium` | Lowercase controlled value |
| `campaign` | Lowercase documented value |
| `content` | Optional controlled creative distinction |
| `term` | Optional only when policy-approved; never free-form user data |

Unknown keys, click IDs, excess length, unsafe characters, and values outside policy are discarded. The raw query and full landing URL are never sent.

## 8. Inquiry Measurement State

Transient per-form-attempt state.

| Field | Type | Purpose |
|---|---|---|
| `attemptKey` | in-memory identifier | Dedup only; never transmitted |
| `started` | boolean | Prevents multiple `inquiry_start` events |
| `leadRecorded` | boolean | Prevents multiple `generate_lead` events |
| `inquiryType` | `general \| wedding` | Safe business classification |
| `originContext` | approved enum or null | Carries `workshop` independently |

`started` becomes true only on the first user-driven meaningful visible-field change. `leadRecorded` becomes true only after durable lead creation succeeds. Form values and returned lead IDs never enter this state.

## 9. Provider Governance Record

Human-maintained operational evidence, not application data:

- GA account/property/stream business owner and recovery administrator
- Search Console verified owners and sitemap status
- Named user roles and third-party access
- 14-month retention and reset-toggle state
- disabled advertising, Signals, product-link, granular-data, and sharing settings
- privacy-review approval and policy version
- pre/post performance baseline and measurement-validation date
- annual/change-triggered review date

Credentials, recovery secrets, and DNS-provider access are never recorded in the repository.
