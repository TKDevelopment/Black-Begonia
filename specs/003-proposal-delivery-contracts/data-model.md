# Data Model: SignWell Proposal Delivery

## Lead

Adds nullable `ceremony_venue_address`, `ceremony_venue_zipcode`, `reception_venue_address`, and `reception_venue_zipcode`. Existing city/state fields form `City, ST ZIP` values. Applicable wedding services require complete address groups at delivery time.

The CRM edit modal exposes all lead business values: service/event type, client and partner names, contact preferences, event date and timing, ceremony/reception details, budget and guest count, inquiry/source, workflow status, assignment, decline context, consultation milestones, and planner details. It excludes `lead_id`, conversion foreign keys/timestamps, `declined_at`, `last_contacted_at`, `created_at`, and `updated_at` because those are identity, relationship, or system-maintained metadata.

### Service type persistence

CRM labels are normalized to `public.service_type` enum values before insert/update:

| CRM label | Database value |
|---|---|
| Full-Service Wedding | `full-service wedding` |
| Ceremony-Only Wedding | `ceremony-only wedding` |
| Reception-Only Wedding | `reception-only wedding` |
| Elopement | `elopement` |
| Engagements | `engagement` |
| Birthday Celebrations | `birthday` |
| Memorial Florals | `funeral` |
| Corporate Events | `corporate` |
| Bridal Showers | `bridal shower` |
| Baby Showers | `baby shower` |
| Anniversary Dinners | `anniversary` |
| Rehearsal Dinners | `rehearsal` |
| Proposal Florals | `proposal` |
| Floral Subscriptions | `subscription` |
| Private Lessons | `private lessons` |
| Private Workshops | `workshop` |
| Private Gatherings | `private event` |
| Quinceanera Celebrations / Build-Your-Own Flower Bar | `private event` |

Values already matching the enum remain unchanged.

## Project

Adds nullable ceremony/reception ZIP codes and reuses existing address fields. Lead conversion copies all venue name, street, city, state, and ZIP values.

## Floral Proposal

- `final_balance_amount`: authoritative `total_amount` snapshot.
- `retainer_amount`: rounded 30% of final balance.
- `final_balance_due_date`: event date minus 30 calendar days.
- `retainer_due_date`: nullable until verified completion.
- `canva_pdf_storage_path` / `canva_pdf_file_name`: private source attachment.
- Existing signing/status/provider fields remain the proposal delivery summary.
- `passcode_hash` becomes nullable for direct-delivery records; historical hashes remain valid.

## Proposal Signing Session

- `provider_document_id`: unique SignWell document reference.
- `idempotency_key`: unique CRM finalization attempt reference.
- `send_state`: `not_started`, `draft_created`, `sending`, `sent`, `failed`, or `unknown`.
- Existing embedded-session fields remain nullable for historical compatibility.

## Storage

The private `floral-proposals` bucket accepts PDFs up to 50 MB. Authenticated active admin/staff users may manage objects; edge functions read and write with service-role access.

## Production migration

`supabase/migrations/20260627000000_signwell_proposal_delivery.sql` adds the lead, project, proposal, and signing-session fields without recreating tables or deleting historical data. It also creates the signing-session uniqueness indexes, makes legacy `passcode_hash` nullable, and notifies PostgREST to reload its schema cache.
