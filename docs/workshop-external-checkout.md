# Workshop venue checkout

An optional **External Checkout URL** belongs to each workshop occurrence (date).
Leave it blank to keep the existing `/reserve` → Stripe Checkout flow. Set it to
an absolute HTTPS ticket URL to let the venue handle reservations and payment.
The field is available when creating or editing a workshop, including generating
dates and applying a series update. Whitespace-only input clears the override.

## Behavior and implementation

1. Store `external_checkout_url` as nullable text on `workshop_occurrences`. Existing
   rows remain NULL. Validate HTTPS, length, and absence of credentials, whitespace,
   and backslashes in the CRM and database.
2. Skip Stripe catalog synchronization for venue checkout. Publication still
   requires the usual workshop content, venue details, terms, and hero image.
   Stripe and local waitlist collection are disabled while the override is set.
3. Expose the URL through the public listing and detail projections. Date-specific
   Reserve seats links go directly to the venue in the current tab. Existing
   `/reserve` links redirect to the venue and provide a fallback link. Lifecycle
   status and registration dates continue to control when reservations are open.
4. Keep venue inventory unknown: hide public remaining-seat counts, ignore local
   capacity when displaying venue checkout availability, and label discovery cards
   “Book with venue.” The venue determines actual availability and booking terms.
5. Reject public local seat holds, Stripe checkout attempts, and waitlist actions
   for externally managed workshops. Staff keep using **Roster → Add Reservation**
   to record venue bookings. CRM capacity limits still apply to manual entries.
   CRM counts represent entered records only; there is no venue reservation or
   payment synchronization and no automatic purchase-conversion tracking.
6. Preserve existing bookings and financial history. An active local checkout hold
   blocks switching to venue checkout until it expires or resolves. Clearing the
   override configures Stripe again on save before normal checkout resumes.

Venue checkout does not change the workshop's displayed price, schedule, or terms
automatically. Staff should keep those details consistent with the venue listing.

## Rollout

Apply `supabase/migrations/20261102000000_workshop_external_checkout.sql` before
deploying the Angular app. It adds the nullable column and constraints and replaces
the affected commands/projections, restoring the public listing function grants
after its return type changes. No new Edge Function or secret is required.

Test on staging with one ordinary Stripe workshop and one venue workshop:

- Create, save, publish, reopen, edit, and clear the external URL.
- Check the individual date page, series page, discovery listing, and a direct
  `/reserve` bookmark. Closed or cancelled events must stay unavailable.
- Complete a normal Stripe sandbox booking; confirm its seat count and status.
- Confirm venue checkout creates no CRM booking automatically, then manually add
  a venue booking and confirm only the CRM roster changes.
- Try an unsafe URL and a provider switch during a live Stripe hold.

Focused Angular suites cover the editor, discovery, detail, reserve, roster,
preview, URL validation, and unchanged booking services. The SQL integration suite
is `supabase/tests/workshop_external_checkout.sql`; it exercises publication,
public projections, manual bookings, URL constraints, series changes, the active
checkout guard, authorization, and the default Stripe seat-hold path.

Local verification: 117 focused Angular tests passed, Angular compilation and
TypeScript checks passed, and the migration plus transactional SQL assertions
passed on PostgreSQL 18 using an isolated workshop schema and local Supabase auth
interfaces. The full Supabase stack and real Stripe/venue checkout remain staging
release checks; no live database migration or site deployment was performed.

For rollback, clear external URLs through the CRM to reconfigure Stripe before
reverting the app. Retain the additive database migration so saved venue workshops
cannot accidentally start accepting local payments through an older client.
