# Requirements Traceability

| Requirement area | Implementation | Evidence |
|---|---|---|
| Public-only route measurement; excluded secure routes | Route metadata, route policy, analytics state machine | Route/policy specs; production manual matrix pending |
| SPA, direct load, hydration, deduplication | Router-owned manual page views; `send_page_view:false` | Service/build tests; live validation pending |
| Regional consent, GPC, withdrawal, internal traffic | Region endpoint, versioned preferences, preferences UI | Focused specs; qualified privacy review pending |
| PII prevention and campaign controls | Typed facade, event allowlists, canonical paths, sanitizer | Sanitizer/directive specs and content-ID audit |
| Inquiry funnel and confirmed leads | Per-attempt measurement and post-repository confirmation | Inquiry service/component specs |
| Content, social, CTA, scroll | Explicit directive, audited portfolio category, 90% listener | Focused specs; full CTA inventory expansion pending |
| Privacy, access, retention, incident handling | Privacy page and governance/runbook documents | Source review; provider evidence pending |
| Search Console and native reporting | Setup/link/runbook documents | External property setup and data pending |
| Resilience, SSR, performance | Browser-only activation, fail-closed endpoint/provider, async loading | Production build; live failure/performance checks pending |

The feature specification’s FR-001–FR-061 and SC-001–SC-018 are covered by these areas. Any row
with pending external evidence remains a release gate and must not be represented as production
acceptance.
