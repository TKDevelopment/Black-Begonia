# Public Content Identifier Audit

Location identifiers in the route-policy allowlist are editorial geographic slugs already published
as public SEO routes. They identify a service area, not a customer, event, project, or payment.

Portfolio identifiers are not yet approved for analytics. Portfolio content can include names,
venues, or event context and therefore uses the fixed category and canonical path
`/portfolio/detail`. The raw slug is never dispatched. To approve a portfolio identifier later,
record the reviewer/date and verify it contains only durable editorial taxonomy with no person,
venue booking, event, UUID, or customer reference.

The Not Found fallback always uses `/not-found`; the unknown requested path, encoded value, title,
query, and fragment are discarded.
