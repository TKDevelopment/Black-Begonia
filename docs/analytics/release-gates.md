# Analytics Production Release Gates

Production activation is blocked until every gate below has named evidence:

- A qualified privacy professional has reviewed the regional default, GPC behavior, notice,
  opt-out, and deployed Privacy Policy.
- Two recoverable, business-controlled administrators own both GA4 and Search Console.
- The production GA4 property uses Eastern Time, USD, 14-month event retention, and reset-on-new-
  activity disabled.
- Google Ads links, Google Signals, user-provided data, advertising personalization, remarketing,
  audience activation, URL passthrough, and unnecessary Google data sharing are disabled.
- Enhanced Measurement features replaced by application-owned events are disabled.
- `generate_lead` is the only initial key event. Only approved safe custom dimensions are registered.
- Search Console domain ownership, public sitemap status, and the production GA4 link are verified.
- Desktop/mobile route, consent, GPC, PII, inquiry, provider-failure, and performance validation is
  recorded in `validation-record.md`.
- `GA4_MEASUREMENT_ID` is configured only in the published production environment.

Rollback is configuration-first: blank `GA4_MEASUREMENT_ID`. The site and preferences UI remain
functional while analytics stays inert. Source-control publication, deployment, property ownership,
and legal approval are human-only actions.
