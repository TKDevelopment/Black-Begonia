# Data Model: Workshop Events and Booking

**Branch**: `011-workshop-booking`  
**Date**: 2026-07-29  
**Specification**: [spec.md](./spec.md)  
**Research**: [research.md](./research.md)

## Modeling principles

- Postgres is authoritative for capacity, lifecycle, booking, waitlist, and
  financial state.
- Public projections contain no customer, hold, payment, expense, or CRM data.
- Customer/payment state changes are command-driven and auditable.
- Money and quantity use immutable source facts plus append-only adjustments.
- Provider arrival time never substitutes for trusted provider occurrence time.
- Local schedule intent, timezone, UTC offset, and resolved instant are retained.
- Anonymous customer access is token scoped; raw tokens are never stored.
- Existing project-payment records remain separate and unchanged.
- Workshop money is stored in integer minor currency units. The published
  per-seat amount is pre-tax; each occurrence snapshots a fixed supported state
  tax rate, and each booking snapshots subtotal, tax, and required total.
- Analytics outcome eligibility is created only from trusted confirmation. The
  Edge Function creates each raw grant; Postgres registers and stores only its
  digest and redeems it atomically without exposing booking data.

## Entity relationship overview

```text
Workshop Definition
  â”œâ”€â”€ Workshop Media
  â”œâ”€â”€ Stripe Price Versions
  â””â”€â”€ Workshop Series
        â”œâ”€â”€ Workshop Media overrides
        â””â”€â”€ Workshop Occurrence
              â”œâ”€â”€ Workshop Media overrides
              â”œâ”€â”€ Seat Holds
              â”œâ”€â”€ Bookings â”€â”€ Attendees
              â”‚     â”œâ”€â”€ Booking Adjustments
              â”‚     â”œâ”€â”€ Reschedule Responses
              â”‚     â”œâ”€â”€ Payment Attempts
              â”‚     â”œâ”€â”€ Payment Transactions
              â”‚     â”œâ”€â”€ Payment Exceptions
              â”‚     â”œâ”€â”€ Analytics Outcome Grants
              â”‚     â””â”€â”€ Communications
              â”œâ”€â”€ Waitlist Entries â”€â”€ Waitlist Offers
              â”œâ”€â”€ Expenses
              â””â”€â”€ Audit Events
```

## 1. `workshop_definitions`

Reusable workshop concept and shared marketing defaults.

| Field | Type | Rules |
|---|---|---|
| `workshop_definition_id` | uuid | Primary key |
| `title` | text | Required, trimmed, bounded |
| `theme` | text | Required controlled public category |
| `advertising_line` | text | Required, concise, bounded |
| `description` | text | Required public copy |
| `included_materials` | text | Required before publication |
| `accessibility_guidance` | text | Optional public copy |
| `contact_guidance` | text | Optional public copy |
| `default_terms` | text | Required before publication |
| `default_terms_version` | integer | Monotonic positive value |
| `default_currency` | text | Initially `USD` |
| `is_reusable` | boolean | Defaults false; promoted true only by successful occurrence publication; may be set false to retire the concept from future selection without deleting history |
| `reusable_retired_at` | timestamptz | Nullable; set when the florist removes the concept from future reuse and prevents later draft publication from reactivating it |
| `stripe_product_id` | text | Nullable, unique when present |
| `stripe_catalog_state` | text | `not_configured`, `pending`, `ready`, `failed` |
| `stripe_catalog_error` | text | Redacted, nullable |
| `created_by`, `updated_by` | uuid | Internal profile references |
| `created_at`, `updated_at` | timestamptz | Audit timestamps |

Definitions required by drafts or media may exist in a staged non-reusable
state. Successful occurrence publication atomically promotes the definition to
the reusable concept library. Removing a concept option sets `is_reusable` to
false while preserving linked occurrences, media, payments, and audit history.
Selecting a reusable definition retains its identifier and never clones it.

## 2. `workshop_series`

Logical grouping for generated occurrences.

| Field | Type | Rules |
|---|---|---|
| `workshop_series_id` | uuid | Primary key |
| `workshop_definition_id` | uuid | Required parent |
| `series_label` | text | Required internal/public relationship label |
| `default_capacity` | integer | Positive |
| `default_price_minor` | bigint | Non-negative pre-tax per-seat amount |
| `default_tax_region` | text | `RI`, `CT`, or `MA`; defaults `RI` |
| `default_tax_rate_basis_points` | integer | Fixed by state: RI `700`, CT `635`, MA `625` |
| `default_currency` | text | Initially `USD` |
| `default_venue_*` | text | Name/address/locality/region/postal/country |
| `default_timezone` | text | Valid named timezone |
| `created_by`, `updated_by` | uuid | Internal profile references |
| `created_at`, `updated_at` | timestamptz | Audit timestamps |

Series edits produce explicit selected-occurrence commands. Per-occurrence
overrides are never overwritten without preview and confirmation.

## 3. `workshop_occurrences`

One dated operational and public event.

| Field | Type | Rules |
|---|---|---|
| `workshop_occurrence_id` | uuid | Primary key |
| `workshop_definition_id` | uuid | Required |
| `workshop_series_id` | uuid | Nullable |
| `slug` | text | Stable, globally unique, URL-safe; CRM-generated from title/date with collision-safe numeric suffix allocation |
| `status` | text | Lifecycle state below |
| `title_snapshot`, `advertising_line_snapshot`, `description_snapshot` | text | Public occurrence copy |
| `included_materials_snapshot`, `terms_snapshot` | text | Immutable per published terms version |
| `terms_version` | integer | Required positive value |
| `venue_name`, address fields | text | Required before publication |
| `timezone` | text | Fixed to `America/New_York` for workshop scheduling |
| `local_start`, `local_end` | timestamp without time zone | Florist wall-time intent |
| `utc_offset_minutes` | smallint | Automatically resolved DST offset; not florist-entered |
| `start_at`, `end_at` | timestamptz | Resolved unambiguous instants |
| `registration_opens_at`, `registration_closes_at` | timestamptz | Valid ordered window |
| `capacity` | integer | Positive |
| `per_booking_limit` | integer | Positive and no greater than capacity |
| `price_minor` | bigint | Non-negative pre-tax per-seat amount |
| `tax_region` | text | `RI`, `CT`, or `MA` |
| `tax_rate_basis_points` | integer | Fixed by `tax_region`: RI `700`, CT `635`, MA `625` |
| `currency` | text | Initially `USD` |
| `stripe_price_version_id` | uuid | Required when Stripe enabled |
| `stripe_enabled`, `venmo_enabled`, `waitlist_enabled` | boolean | Persisted compatibility flags; CRM workshop writes set all three true and expose no florist toggle |
| `waitlist_offer_duration_minutes` | integer | Default 1440; between 60 and 4320 |
| `is_featured` | boolean | Persisted carousel compatibility flag; CRM workshop writes set true automatically |
| `featured_order` | smallint | Nullable |
| `published_at`, `completed_at`, `cancelled_at`, `archived_at` | timestamptz | State timestamps |
| `replacement_occurrence_id` | uuid | Nullable self-reference |
| `status_page_expires_at` | timestamptz | Cancelled/rescheduled + 12 months |
| `created_by`, `updated_by` | uuid | Internal profiles |
| `created_at`, `updated_at` | timestamptz | Audit timestamps |

### Occurrence lifecycle

```text
draft â”€â”€publishâ”€â”€> published_open
published_open â”€â”€closeâ”€â”€> registration_closed
draft/published_open/registration_closed â”€â”€cancelâ”€â”€> cancelled
published_open/registration_closed â”€â”€replaceâ”€â”€> rescheduled
published_open/registration_closed â”€â”€reviewâ”€â”€> completed
rescheduled/cancelled/completed â”€â”€archiveâ”€â”€> archived
```

- Available, limited, sold-out, and waitlist-available are separately derived
  from capacity, registration, and waitlist facts; they are not values persisted
  in the occurrence `status` column and cannot override manual closed states.
- Passing `end_at` creates an operational review condition; it does not change
  state automatically.
- A materially rescheduled occurrence retains its source URL and points to a
  replacement occurrence. Existing bookings enter the transfer-response flow.
- Completed occurrences remain permanently public as non-bookable Past
  Workshops. Archived records remain operationally available; archival alone
  does not erase historical public-retention rules.

## 4. `workshop_media`

Ordered hero/gallery records for a definition or occurrence.

| Field | Type | Rules |
|---|---|---|
| `workshop_media_id` | uuid | Primary key |
| `workshop_definition_id` | uuid | Nullable |
| `workshop_occurrence_id` | uuid | Nullable |
| `media_role` | text | `hero` or `gallery` |
| `storage_path` | text | Unique public-bucket object path |
| `public_url` | text | Derived/stored crawlable URL |
| `alt_text` | text | Required for published media |
| `display_order` | smallint | Non-negative |
| `is_public` | boolean | Publication projection gate |
| `width`, `height`, `byte_size`, `mime_type` | integer/text | Validated metadata |
| `created_by`, `created_at`, `updated_at` | uuid/timestamptz | Audit |

Exactly one owner is required. A published occurrence resolves an occurrence
override first, otherwise the definition hero/gallery. One effective hero is
required before publication.

## 5. `workshop_stripe_price_versions`

Durable mapping between Black Begonia pricing and Stripe catalog objects.

| Field | Type | Rules |
|---|---|---|
| `workshop_stripe_price_version_id` | uuid | Primary key |
| `workshop_definition_id` | uuid | Required |
| `stripe_product_id`, `stripe_price_id` | text | Required, unique |
| `amount_minor` | bigint | Positive required total amount for the payment attempt |
| `currency` | text | Required |
| `state` | text | `pending`, `active`, `inactive`, `failed` |
| `provider_created_at` | timestamptz | Provider fact |
| `created_by`, `created_at`, `deactivated_at` | uuid/timestamptz | Audit |

Amount/currency never change. A new amount creates a new row and Stripe Price.
Historical occurrence and booking snapshots keep the old reference.

## 6. `workshop_seat_holds`

Time-limited capacity claim.

| Field | Type | Rules |
|---|---|---|
| `workshop_seat_hold_id` | uuid | Primary key |
| `workshop_occurrence_id` | uuid | Required |
| `booking_id` | uuid | Nullable until booking shell exists |
| `quantity` | integer | Positive |
| `state` | text | `active`, `confirmed`, `expired`, `released`, `cancelled`, `exception` |
| `payment_method` | text | `stripe` or `direct_venmo` |
| `normal_expires_at` | timestamptz | Configured duration |
| `effective_expires_at` | timestamptz | Earliest valid cutoff |
| `resolved_at`, `resolution_reason` | timestamptz/text | Nullable |
| `command_key` | uuid | Unique retry key |
| `created_at` | timestamptz | Audit |

Only `active` holds consume provisional capacity. Hold transitions occur under
an occurrence row lock. Expiration is idempotent.

## 7. `workshop_bookings`

Customer reservation and current operational projection.

| Field | Type | Rules |
|---|---|---|
| `workshop_booking_id` | uuid | Primary key |
| `workshop_occurrence_id` | uuid | Required |
| `booking_reference` | text | Unique, non-secret support reference |
| `status_token_digest` | text | Unique digest; raw token never stored |
| `status_token_expires_at` | timestamptz | Required; 30 days after the later of occurrence end or latest unresolved action deadline |
| `contact_name`, `contact_email` | text/citext | Required |
| `contact_phone` | text | Optional |
| `purchased_quantity` | integer | Immutable original quantity |
| `active_quantity` | integer | Current capacity-bearing quantity |
| `status` | text | Booking lifecycle below |
| `payment_state` | text | Payment lifecycle below |
| `price_per_seat_minor_snapshot`, `subtotal_minor_snapshot` | bigint | Immutable; subtotal equals pre-tax unit price times purchased quantity |
| `tax_region_snapshot`, `tax_rate_basis_points_snapshot`, `tax_minor_snapshot` | text/integer/bigint | Immutable supported-state tax facts applied to the subtotal |
| `total_minor_snapshot` | bigint | Immutable; total equals subtotal plus tax and required charges |
| `required_charges_minor_snapshot` | bigint | Immutable zero for initial release |
| `currency` | text | Immutable |
| `terms_snapshot`, `terms_version` | text/integer | Immutable acceptance |
| `payment_method` | text | Nullable until selected |
| `confirmed_at`, `cancelled_at`, `checked_in_at` | timestamptz | Nullable |
| `created_at`, `updated_at` | timestamptz | Audit |

### Booking lifecycle

```text
pending_payment â”€â”€verifiedâ”€â”€> confirmed â”€â”€check-inâ”€â”€> checked_in
pending_payment â”€â”€expiry/cancelâ”€â”€> expired/cancelled
confirmed â”€â”€full cancellationâ”€â”€> cancelled
confirmed â”€â”€disputeâ”€â”€> payment_disputed â”€â”€resolveâ”€â”€> confirmed/cancelled
confirmed â”€â”€rescheduleâ”€â”€> transfer_action_required
transfer_action_required â”€â”€acceptâ”€â”€> transferred
transfer_action_required â”€â”€decline/cancelâ”€â”€> cancelled
```

Partial cancellation adjusts `active_quantity` without replacing the booking or
rewriting `purchased_quantity`.

### Payment lifecycle

`unselected`, `pending`, `processing`, `paid`, `partially_refunded`, `refunded`,
`disputed`, `reversed`, `exception`.

Payment state and booking state are separate. A dispute does not automatically
release seats.

## 8. `workshop_attendees`

Optional participant details associated with booked seats.

| Field | Type | Rules |
|---|---|---|
| `workshop_attendee_id` | uuid | Primary key |
| `workshop_booking_id` | uuid | Required |
| `seat_number` | smallint | Positive within purchased quantity |
| `display_name` | text | Optional |
| `accommodation_details` | text | Optional, sensitive |
| `attendance_state` | text | `expected`, `checked_in`, `absent`, `cancelled` |
| `checked_in_at`, `checked_in_by` | timestamptz/uuid | Nullable |
| `created_at`, `updated_at` | timestamptz | Audit |

Rows are optional; a booking contact and quantity are sufficient to purchase.

## 9. `workshop_booking_adjustments`

Append-only quantity and booking-state changes.

| Field | Type | Rules |
|---|---|---|
| `workshop_booking_adjustment_id` | uuid | Primary key |
| `workshop_booking_id` | uuid | Required |
| `adjustment_type` | text | `partial_cancel`, `full_cancel`, `transfer`, `manual`, `complimentary`, `correction` |
| `quantity_delta` | integer | Non-zero when capacity changes |
| `amount_minor_delta` | bigint | May be zero |
| `reason` | text | Required |
| `command_key` | uuid | Unique |
| `actor_type`, `actor_id` | text/uuid | Required actor provenance |
| `created_at` | timestamptz | Immutable |

## 10. `workshop_reschedule_responses`

Consent-based transfer workflow.

| Field | Type | Rules |
|---|---|---|
| `workshop_reschedule_response_id` | uuid | Primary key |
| `workshop_booking_id` | uuid | Required |
| `source_occurrence_id`, `replacement_occurrence_id` | uuid | Required |
| `protected_quantity` | integer | Positive |
| `state` | text | `awaiting`, `accepted`, `declined`, `expired`, `staff_resolved` |
| `response_token_digest` | text | Unique |
| `response_deadline` | timestamptz | Required |
| `responded_at`, `resolved_by` | timestamptz/uuid | Nullable |
| `created_at` | timestamptz | Audit |

Awaiting responses consume protected replacement capacity. Expiration flags
florist follow-up and does not silently accept.

## 11. `workshop_waitlist_entries`

Ordered customer interest without payment.

| Field | Type | Rules |
|---|---|---|
| `workshop_waitlist_entry_id` | uuid | Primary key |
| `workshop_occurrence_id` | uuid | Required |
| `contact_name`, `contact_email`, `contact_phone` | text/citext | Minimal contact |
| `requested_quantity` | integer | Positive, within per-booking limit |
| `state` | text | `waiting`, `offered`, `fulfilled`, `declined`, `expired`, `removed` |
| `queue_sequence` | bigint | Monotonic per occurrence |
| `created_at`, `updated_at` | timestamptz | Audit |

## 12. `workshop_waitlist_offers`

Time-limited availability offered to one entry.

| Field | Type | Rules |
|---|---|---|
| `workshop_waitlist_offer_id` | uuid | Primary key |
| `workshop_waitlist_entry_id` | uuid | Required |
| `offered_quantity` | integer | Positive, at most requested and available |
| `state` | text | `active`, `accepted`, `declined`, `expired`, `cancelled` |
| `offer_token_digest` | text | Unique |
| `normal_expires_at` | timestamptz | Configured 1â€“72 hour duration |
| `effective_expires_at` | timestamptz | Earliest of normal expiry, registration close, or occurrence start |
| `resolved_at` | timestamptz | Nullable |
| `created_at` | timestamptz | Audit |

At most one active offer exists per entry and occurrence allocation. Acceptance
requires trusted time strictly before `effective_expires_at`; late acceptance
has no capacity effect. Reduced acceptance fulfills the entry, while decline or
expiry advances the queue exactly once.

## 13. `workshop_payment_attempts`

One provider choice/attempt for a booking.

| Field | Type | Rules |
|---|---|---|
| `workshop_payment_attempt_id` | uuid | Primary key |
| `workshop_booking_id`, `workshop_seat_hold_id` | uuid | Required |
| `method` | text | `stripe` or `direct_venmo` |
| `status` | text | `creating`, `active`, `processing`, `paid`, `failed`, `expired`, `cancelled`, `superseded` |
| `amount_minor`, `currency`, `quantity` | bigint/text/integer | Immutable snapshots |
| `provider_session_id`, `provider_payment_id` | text | Nullable, unique |
| `stripe_price_id` | text | Nullable |
| `venmo_target_snapshot`, `reconciliation_reference` | text | Nullable, non-secret |
| `normal_expires_at`, `effective_expires_at` | timestamptz | Required |
| `create_idempotency_key` | text | Unique |
| `resolved_at`, `created_at` | timestamptz | Audit |

Only one `creating|active|processing` attempt exists per booking. Switching
methods supersedes the old attempt. A later duplicate payment is still recorded
but never creates a second booking or capacity effect.

## 14. `workshop_payment_transactions`

Append-only financial facts.

| Field | Type | Rules |
|---|---|---|
| `workshop_payment_transaction_id` | uuid | Primary key |
| `workshop_booking_id`, `workshop_occurrence_id` | uuid | Required |
| `workshop_payment_attempt_id` | uuid | Nullable |
| `transaction_reference` | text | Unique |
| `kind` | text | `receipt`, `refund`, `external_refund`, `fee`, `discount`, `reversal`, `dispute`, `correction` |
| `status` | text | `pending`, `confirmed`, `failed`, `resolved` |
| `amount_minor`, `currency` | bigint/text | Signed minor-unit amount convention |
| `method` | text | `stripe`, `direct_venmo`, `manual`, `complimentary` |
| `provider_reference` | text | Nullable |
| `trusted_occurred_at` | timestamptz | Provider/business fact |
| `recorded_at` | timestamptz | Receipt time |
| `actor_type`, `actor_id` | text/uuid | Provenance |
| `command_key` | uuid | Nullable unique |
| `normalized_facts` | jsonb | Allowlisted non-secret facts |
| `payload_digest` | text | Nullable |
| `note` | text | Optional |

Rows cannot be updated or deleted. Corrections and refunds are new rows.
Before a pending Stripe refund row/provider request is created, the authoritative
command validates the original trusted charge, actor, matching currency,
positive amount no greater than the remaining refundable balance, and unique
command/provider state. Refund initiation never changes booking capacity. A
seat-aware CRM refund order stores its bounded seat quantity separately from the
append-only money fact: verified Stripe reconciliation releases that quantity,
while a florist-confirmed, externally completed Venmo refund records the money
fact and seat release in one database transaction.

## 15. `workshop_payment_provider_events`

Deduplicated signed Stripe event facts.

| Field | Type | Rules |
|---|---|---|
| `workshop_payment_provider_event_id` | uuid | Primary key |
| `provider` | text | `stripe` |
| `provider_event_id` | text | Unique |
| `provider_object_id`, `provider_object_type` | text | Nullable |
| `event_type` | text | Required |
| `trusted_occurred_at`, `signature_verified_at`, `received_at` | timestamptz | Separate times |
| `payload_digest` | text | Required |
| `normalized_facts` | jsonb | Minimized |
| `processing_state` | text | `received`, `processed`, `duplicate`, `failed`, `unmatched` |
| `workshop_payment_attempt_id`, `workshop_payment_transaction_id` | uuid | Nullable |
| `processing_error`, `processed_at` | text/timestamptz | Redacted/nullable |

## 16. `workshop_payment_exceptions`

Operational resolution queue.

| Field | Type | Rules |
|---|---|---|
| `workshop_payment_exception_id` | uuid | Primary key |
| booking/occurrence/attempt/transaction/provider-event IDs | uuid | Relevant nullable links |
| `exception_type` | text | Late payment, duplicate, under/overpayment, missing reference, cancellation race, dispute, reconciliation failure |
| `urgency` | text | `normal`, `urgent` |
| `state` | text | `open`, `acknowledged`, `resolved` |
| `amount_minor`, `currency` | bigint/text | Nullable |
| `summary`, `redacted_detail` | text | Required/nullable |
| `resolution`, `resolution_reference` | text | Nullable controlled result |
| `resolved_by`, `resolved_at`, `created_at` | uuid/timestamptz | Audit |

Resolution appends financial/booking/audit records; it never edits an original
transaction.

## 17. `workshop_expenses`

Direct workshop costs.

| Field | Type | Rules |
|---|---|---|
| `workshop_expense_id` | uuid | Primary key |
| `workshop_occurrence_id`, `workshop_series_id` | uuid | Exactly one required |
| `category` | text | Controlled reporting category |
| `amount_minor`, `currency` | bigint/text | Positive |
| `expense_date` | date | Required |
| `vendor_or_payee`, `note` | text | Optional |
| `receipt_storage_path` | text | Nullable private path |
| `created_by`, `created_at` | uuid/timestamptz | Audit |

Corrections use reversal/replacement records or an explicit audited correction
command; financial exports never expose receipt paths publicly.

## 18. `workshop_communications`

Durable outbound message work and delivery outcomes.

| Field | Type | Rules |
|---|---|---|
| `workshop_communication_id` | uuid | Primary key |
| occurrence/booking/waitlist IDs | uuid | Relevant nullable links |
| `communication_type` | text | Confirmation, receipt, reminder, change, cancellation, waitlist, refund |
| `recipient_email` | citext | Required, protected |
| `template_version`, `content_facts` | text/jsonb | No secrets/freeform provider payload |
| `status` | text | `queued`, `claimed`, `accepted`, `delivered`, `temporary_failed`, `permanent_failed`, `suppressed`, `cancelled` |
| `attempt_number`, `idempotency_key` | integer/text | Bounded/unique |
| `scheduled_at`, `claimed_at`, `accepted_at`, `delivered_at` | timestamptz | Nullable lifecycle |
| `provider_message_id`, `redacted_error` | text | Nullable |
| `created_at` | timestamptz | Audit |

## 19. `workshop_audit_events`

Append-only trace of significant staff, customer-command, schedule, and provider
actions.

| Field | Type | Rules |
|---|---|---|
| `workshop_audit_event_id` | uuid | Primary key |
| definition/series/occurrence/booking IDs | uuid | Relevant links |
| `event_type` | text | Controlled |
| `actor_type`, `actor_id` | text/uuid | Provenance |
| `summary` | text | Florist-readable |
| `metadata` | jsonb | Allowlisted, no credentials/raw payloads |
| `command_key` | uuid | Nullable unique |
| `created_at` | timestamptz | Immutable |

## 20. `workshop_analytics_outcome_grants`

Short-lived authorization for one sanitized verified-booking analytics outcome
on an otherwise eligible public workshop page.

| Field | Type | Rules |
|---|---|---|
| `workshop_analytics_outcome_grant_id` | uuid | Primary key |
| `workshop_booking_id` | uuid | Required, unique; protected internal linkage |
| `workshop_occurrence_id` | uuid | Required |
| `grant_digest` | text | Nullable while eligible; required/unique once issued; raw grant never stored |
| `safe_public_content_id` | text | Controlled non-secret public identifier |
| `safe_category` | text | Allowlisted low-cardinality value |
| `seat_quantity` | integer | Positive, approved analytics context |
| `currency` | text | Approved value context |
| `approved_value_minor` | bigint | Nullable approved aggregate value |
| `state` | text | `eligible`, `issued`, `consumed`, `discarded`, `expired` |
| `issued_at`, `expires_at`, `consumed_at`, `discarded_at` | timestamptz | Twenty-four-hour maximum lifetime |

Trusted confirmation creates at most one `eligible` row per booking. The
standalone booking-status/recovery Edge Function generates the raw grant, hashes
it, and asks the database to atomically register the digest and change the row
to `issued`; no database command generates or returns a raw value. For
redemption or discard, the standalone analytics-outcome Edge Function hashes
the presented raw grant and passes only the digest to Postgres. The database
command locks the digest-matched row, rejects expired/non-issued state, marks it
consumed atomically, and returns only the safe fields above. No database call
receives or hashes the raw grant.
It cannot resolve booking, contact, attendee, payment, or provider information.
When consent or route policy is ineligible, the client discards the raw grant
and must not retain it for replay; the Edge Function may submit its digest to
record that terminal state without exposing booking truth.

## 21. `workshop_personal_data_requests`

Durable correction or minimization case linked to one booking.

| Field | Type | Rules |
|---|---|---|
| `workshop_personal_data_request_id` | uuid | Primary key |
| `workshop_booking_id` | uuid | Required protected booking link |
| `request_type` | text | `correction` or `minimization` |
| `requested_field_categories` | text[] | Required validated allowlist; no raw values |
| `protected_proposed_corrections` | jsonb | Nullable protected operational payload; never audited or analyzed |
| `state` | text | `pending_verification`, `verified`, `approved`, `deferred`, `completed`, `denied`, `expired` |
| `verification_method` | text | `booking_status_token` or `email_link` |
| `verification_token_digest` | text | Nullable, unique; required only for an active email link |
| `verification_expires_at`, `verified_at` | timestamptz | Email link expires within 24 hours |
| `replacement_email_token_digest` | text | Nullable, unique; digest only |
| `replacement_email_expires_at`, `replacement_email_confirmed_at` | timestamptz | Proposed address confirmation expires within 24 hours |
| `retention_policy_version` | text | Nullable until evaluated; required for approval, deferral, completion, or denial |
| `processed_by` | uuid | Nullable internal profile |
| `reason_category` | text | Nullable controlled safe category; no free text or personal value |
| `earliest_eligible_at` | timestamptz | Nullable; required when deferral is time-bounded |
| `created_at`, `updated_at`, `processed_at` | timestamptz | Lifecycle timestamps |

A valid booking-status token may verify the request directly. Otherwise the
system sends a single-use link only to the booking's current contact email and
stores its digest. Support reference, name, supplied email, and internal CRM
authentication alone do not verify customer authority. Raw verification
tokens, removed/replacement values, free text, accommodation details, email,
and phone are excluded from audit and analytics.
A proposed replacement email remains inside the protected correction payload
and cannot replace the active contact address until its separate one-time link
is confirmed. Activation invalidates the prior status-token digest and all
other active privacy-verification digests.

## 22. `workshop_data_retention_policies`

Versioned authorization for personal-data retention and minimization.

| Field | Type | Rules |
|---|---|---|
| `workshop_data_retention_policy_id` | uuid | Primary key |
| `policy_version` | text | Required immutable unique version |
| `state` | text | `draft`, `approved`, `active`, `retired` |
| `effective_at` | timestamptz | Required before activation |
| `field_rules` | jsonb | Validated allowlist of field category, permitted action, prerequisites, and minimum age |
| `operational_retention_days` | integer | Non-negative approved period |
| `communication_retention_days` | integer | Non-negative approved period |
| `financial_retention_days` | integer | Non-negative approved period |
| `dispute_retention_days` | integer | Non-negative approved period |
| `audit_retention_days` | integer | Non-negative approved period |
| `approved_by`, `approved_at` | uuid/timestamptz | Required before activation |
| `activated_by`, `activated_at` | uuid/timestamptz | Required when the version becomes active |
| `retired_by`, `retired_at` | uuid/timestamptz | Set only by the controlled active-to-retired transition |
| `created_at`, `updated_at` | timestamptz | Lifecycle timestamps |

Example allowlisted field categories are `contact_email`, `contact_phone`,
`attendee_name`, and `accommodation_details`; rules may allow correction,
minimization after prerequisites, or required retention. The migration creates
no active default. Only one effective active version may govern a command, an
active row's policy content is immutable, and a policy-content change requires a
newly approved version. An active row permits only the controlled
`active -> retired` state transition and its `retired_by`/`retired_at`
metadata; retired rows are fully immutable. Active CRM users assigned the
existing `admin` role in `public.user_roles` use transitions
`draft -> approved -> active -> retired`; activation requires explicit
confirmation, records approval and activation actors/times, and retires the
prior active row atomically.

## Public and reporting projections

### `get_public_workshop_listing()`

Returns only published, eligible occurrence fields needed by the carousel and
ordered vertical list: slug, title, advertising line, theme, hero image/alt,
start/end/timezone, concise venue, price/currency, status/availability band,
featured state, and updated time. No exact remaining count is required where a
low-stock band is safer. Cancelled and rescheduled source occurrences are
excluded even while their canonical status pages remain directly available.

### `get_public_workshop_occurrence(p_slug)`

Returns the complete public occurrence projection, resolved media, visible
terms, exact venue address, public availability, waitlist eligibility, SEO
status, replacement URL, and redirect destination. It returns no base-table IDs
that are usable as authorization and no customer/financial records.

### Public series/date routing projection

`get_public_workshop_listing()` also exposes `seriesSlug` (the normalized
workshop title/concept) and `workshopDate` (the occurrence's New York-local
calendar date). `get_public_workshop_occurrence_route(seriesSlug, workshopDate)`
resolves that public pair to the authoritative occurrence projection. Public
series grouping never replaces occurrence identity for capacity or booking.

### `workshop_financial_entries`

Normalized internal view:

`source_type`, `source_id`, `workshop_series_id`, `workshop_occurrence_id`,
`entry_date`, `entry_category`, `signed_amount_minor`, `currency`, `method`,
`transaction_state`, `traceable_reference`.

The view contains no contact, attendee, token, provider payload, or receipt path.

## Schema delivery slices

The declarative schema is delivered through five ordered additive migrations:

1. `20260729000000_workshop_catalog_media.sql`: definitions, series,
   occurrences, media, Stripe catalog versions, shared workshop audit events,
   pre-booking public projections, and storage.
2. `20260729001000_workshop_booking_capacity.sql`: holds, bookings, attendees,
   adjustments, and capacity commands.
3. `20260729002000_workshop_payments_reconciliation.sql`: payment attempts,
   transactions, provider events, exceptions, expenses, financial projections,
   Stripe/Venmo reconciliation, and PayPal runtime retirement constraints.
4. `20260729003000_workshop_operations_lifecycle.sql`: reschedule responses,
   waitlists, communications, lifecycle, cancellation,
   rescheduling, roster, and scheduled operational commands.
5. `20260729004000_workshop_privacy_analytics.sql`: analytics outcome grants,
   verified personal-data requests, retention policies, privacy commands, and
   analytics digest commands.

Each slice includes the RLS, grants, triggers, indexes, functions, and
data-preservation behavior for the objects it introduces. Later slices may
depend only on earlier slices.

## Authoritative database commands

The ordered migrations and declarative functions define at least:

- `save_workshop_occurrence`
- `publish_workshop_occurrence`
- `generate_workshop_series_occurrences`
- `apply_workshop_series_update`
- `create_workshop_seat_hold`
- `switch_workshop_payment_method`
- `expire_workshop_holds`
- `confirm_workshop_stripe_payment`
- `record_workshop_venmo_receipt`
- `record_workshop_payment_exception`
- `resolve_workshop_payment_exception`
- `cancel_workshop_booking_quantity`
- `cancel_workshop_occurrence`
- `begin_workshop_reschedule`
- `respond_to_workshop_reschedule`
- `join_workshop_waitlist`
- `offer_workshop_waitlist_seats`
- `accept_workshop_waitlist_offer`
- `record_workshop_expense`
- `request_workshop_refund`
- `claim_workshop_communications`
- `record_workshop_delivery_outcome`
- `redeem_workshop_analytics_outcome`
- `discard_workshop_analytics_outcome`
- `rotate_workshop_status_token`
- `create_workshop_personal_data_request`
- `verify_workshop_personal_data_request`
- `confirm_workshop_replacement_email`
- `process_workshop_personal_data_request`
- `correct_workshop_personal_data`
- `minimize_workshop_personal_data`
- `save_workshop_data_retention_policy`
- `approve_workshop_data_retention_policy`
- `activate_workshop_data_retention_policy`
- `retire_workshop_data_retention_policy`

Each command validates actor/purpose, locks required rows, enforces state
transitions, applies a unique command key, appends audit facts, and returns a
minimal typed result.

## RLS and grants

- **Anonymous**: no base-table grants. Execute only public projection functions
  and reach tokenized mutation/status flows through Edge Functions.
- **Authenticated internal CRM user**: select operational tables under
  `is_internal_crm_user()`. Direct content/media CRUD may be allowed where no
  invariant is crossed; lifecycle, capacity, customer, and finance mutations are
  function-only.
- **Service role**: standalone Edge Functions and scheduled processors only.
- **Personal-data requests**: customers use only token-scoped Edge Function
  commands; internal users may read/process verified cases but cannot bypass
  verification. Protected proposed values never enter general roster exports.
- **Retention policies**: active CRM users assigned the existing `admin` role in
  `public.user_roles` may draft, approve, activate, and retire versions. Active
  `staff` users may read the active policy while processing verified requests
  but cannot mutate any policy version. Commands and RLS enforce immutable
  active policy content, with only the controlled `active -> retired`
  transition and retirement metadata permitted after activation.
- **Storage**: anyone can read the public `workshop-media` bucket; only internal
  CRM users can mutate it. Receipt evidence is private and internal-only.

## Retention

- Completed public occurrence pages: permanent.
- Cancelled/rescheduled source page: public status for 12 months, then redirect.
- Booking/payment/expense/audit retention: policy-controlled financial period;
  initial migration marks eligibility without deleting records.
- Raw status/response/offer tokens: digest-only and expired promptly.
- Booking status tokens: valid through 30 days after occurrence end or the
  latest unresolved qualifying customer-action deadline. Qualifying deadlines
  are material-reschedule responses, exceptional-payment refund/transfer
  choices, cancellation outcomes requiring confirmation, or other explicitly
  versioned booking decisions. Internal dates, retries, passive dispute
  monitoring, retention periods, waitlist offers, and analytics expiry do not
  qualify. Successful email reissue rotates the digest and invalidates the
  prior token.
- Analytics outcome grants: digest-only, maximum 24-hour lifetime, then consumed,
  discarded, or expired; raw grants are never retained or placed in URLs.
- Provider payloads: retain digest and normalized facts, not unnecessary raw
  bodies.
- Customer/attendee correction or minimization: process only a verified request
  against the atomically resolved active retention-policy version. If no active
  policy exists, minimization fails safely. Contact-email minimization is
  deferred while recovery, qualifying customer action, required communication,
  payment/refund/transfer work, an active privacy link, or policy restrictions
  require it. When eligible, invalidate status access and privacy links,
  suppress non-required communication, remove eligible fields, preserve
  financial facts, and retain only safe request/outcome metadata. Removed and
  replacement values are never copied into audit history.
