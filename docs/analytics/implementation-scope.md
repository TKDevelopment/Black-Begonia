# Public Website Analytics Implementation Scope

## Included

Analytics is limited to the explicitly annotated public marketing routes in
`src/app/app.routes.ts`: home, about, portfolio, approved portfolio detail categories, locations,
approved location details, inquiry landing/forms/success, public services, workshops, testimonials,
privacy, terms, and the sanitized public Not Found category.

The implementation measures controlled page categories, safe campaign labels, selected public
actions, a 90% page-depth threshold, inquiry starts, and durable confirmed inquiries. Angular
`NavigationEnd` owns page views; automatic GA page changes, form collection, outbound clicks,
downloads, and scroll measurement must remain disabled in GA4 Enhanced Measurement.

## Excluded

Analytics never activates for `/admin/*`, `/pay/*`, login, password recovery/change, token-bearing
routes, local development, preview/staging hosts, or future routes without explicit metadata.
Unknown paths may produce only the constant `/not-found` page location and `not_found` category.
Query strings, fragments, form values, CRM records, payment data, authentication data, and secure
identifiers are outside the measurement boundary.

## Brownfield guarantees

Analytics and region-provider failures are isolated from rendering, routing, SEO, authentication,
payments, and inquiry persistence. A visitor who declines analytics can use every public feature.
SSR and prerender do not load Google or dispatch events.

## No Supabase impact

This feature needs no Supabase schema, migration, RLS, storage, database contract, or Edge Function
change. Preferences are browser-local, region classification is a same-origin Netlify/Angular
server response, and analytics delivery is browser-to-Google after policy approval. Accordingly,
no Supabase Edge Function or database tests are created.

## Approved dynamic identifier policy

Location slugs are restricted to the audited editorial list in the route-policy service. Portfolio
slugs currently fall back to the generic `/portfolio/detail` canonical path because production
portfolio names may contain venue or customer context. A slug can be added to the approved set only
after a documented content/PII audit.
