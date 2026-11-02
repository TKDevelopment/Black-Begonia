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

The migration preserves `get_public_workshop_occurrence(p_occurrence_slug text)`,
the RPC signature introduced by `20260923020000_workshop_lifecycle_automation.sql`.
It does not drop that function or overwrite the existing archive, delete, refund,
reconciliation, or lifecycle transition implementations. Public RPC definitions
are maintained in the function schema files, rather than duplicated in the
occurrence table schema file.

If the earlier version failed in SQL Editor with “cannot change name of input
parameter”, replace the editor contents with the complete corrected migration and
run it, including `begin` and `commit`. The column, constraints, and trigger support
retries, including recovery from a partially applied earlier run. No manual function
drop or CASCADE is needed.

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
checkout guard, authorization, the deployed named RPC argument, dated public
routes, calendar outbox writes, Stripe payment selection and attachment,
reconciliation, confirmation queuing, and preserving payment history.

Local verification: 121 focused Angular tests passed. The PostgreSQL regression
replays all 33 earlier workshop migrations from this repository, with the actual
CRM profile/role schemas and calendar outbox integration. It reproduced the
original parameter-name failure, then verified clean application, retrying a
partial run, applying twice, atomic rollback on failure, preservation of unrelated
functions, and the checkout assertions. Supabase auth/storage infrastructure uses
local interfaces; no Edge Function, provider, or live database is called.

Run the regression with PostgreSQL tools in PATH:

```sh
node scripts/test-workshop-migrations.cjs
```

Alternatively set `PGBIN` to the PostgreSQL binary directory (for example,
`C:/Program Files/PostgreSQL/18/bin`). The script creates and removes a disposable,
localhost-only cluster. Real Stripe/venue checkout remains a staging release check.

For rollback, clear external URLs through the CRM to reconfigure Stripe before
reverting the app. Retain the additive database migration so saved venue workshops
cannot accidentally start accepting local payments through an older client.
