import {
  PublicWorkshopOccurrence,
  PublicWorkshopSummary,
  WorkshopDefinition,
  WorkshopOccurrence,
  WorkshopSeries,
} from '../models/workshop';
import { WorkshopBooking } from '../models/workshop-booking';

export const WORKSHOP_TEST_ID = '10000000-0000-4000-8000-000000000001';
export const WORKSHOP_OCCURRENCE_TEST_ID = '10000000-0000-4000-8000-000000000002';
export const WORKSHOP_BOOKING_TEST_ID = '10000000-0000-4000-8000-000000000003';
export const WORKSHOP_SERIES_TEST_ID = '10000000-0000-4000-8000-000000000004';
export const WORKSHOP_NOW = '2026-07-29T12:00:00.000Z';

export function workshopDefinitionFixture(
  overrides: Partial<WorkshopDefinition> = {},
): WorkshopDefinition {
  return {
    workshop_definition_id: WORKSHOP_TEST_ID,
    title: 'Summer Garden Centerpiece',
    theme: 'seasonal',
    advertising_line: 'Design a garden-inspired centerpiece with us.',
    description: 'A welcoming hands-on floral workshop.',
    included_materials: 'Flowers, vessel, tools, and instruction.',
    accessibility_guidance: null,
    contact_guidance: null,
    default_terms: 'Workshop seats are subject to the published cancellation policy.',
    default_terms_version: 1,
    default_currency: 'USD',
    is_reusable: true,
    reusable_retired_at: null,
    stripe_product_id: null,
    stripe_catalog_state: 'not_configured',
    stripe_catalog_error: null,
    created_by: null,
    updated_by: null,
    created_at: WORKSHOP_NOW,
    updated_at: WORKSHOP_NOW,
    ...overrides,
  };
}

export function workshopOccurrenceFixture(
  overrides: Partial<WorkshopOccurrence> = {},
): WorkshopOccurrence {
  return {
    workshop_occurrence_id: WORKSHOP_OCCURRENCE_TEST_ID,
    workshop_definition_id: WORKSHOP_TEST_ID,
    workshop_series_id: null,
    slug: 'summer-garden-centerpiece-2026-08-15',
    status: 'published_open',
    title_snapshot: 'Summer Garden Centerpiece',
    advertising_line_snapshot: 'Design a garden-inspired centerpiece with us.',
    description_snapshot: 'A welcoming hands-on floral workshop.',
    included_materials_snapshot: 'Flowers, vessel, tools, and instruction.',
    terms_snapshot: 'Workshop seats are subject to the published cancellation policy.',
    terms_version: 1,
    venue_name: 'Black Begonia Studio',
    address_line_1: '100 Flower Lane',
    address_line_2: null,
    locality: 'Richmond',
    region: 'VA',
    postal_code: '23220',
    country: 'US',
    timezone: 'America/New_York',
    local_start: '2026-08-15T13:00:00',
    local_end: '2026-08-15T15:00:00',
    utc_offset_minutes: -240,
    start_at: '2026-08-15T17:00:00.000Z',
    end_at: '2026-08-15T19:00:00.000Z',
    registration_opens_at: WORKSHOP_NOW,
    registration_closes_at: '2026-08-15T16:00:00.000Z',
    capacity: 12,
    per_booking_limit: 4,
    price_minor: 8500,
    tax_region: 'RI',
    tax_rate_basis_points: 700,
    currency: 'USD',
    stripe_price_version_id: null,
    stripe_enabled: true,
    venmo_enabled: true,
    waitlist_enabled: true,
    waitlist_offer_duration_minutes: 1440,
    is_featured: true,
    featured_order: 1,
    published_at: WORKSHOP_NOW,
    completed_at: null,
    cancelled_at: null,
    archived_at: null,
    replacement_occurrence_id: null,
    status_page_expires_at: null,
    created_by: null,
    updated_by: null,
    created_at: WORKSHOP_NOW,
    updated_at: WORKSHOP_NOW,
    ...overrides,
  };
}

export function workshopSeriesFixture(
  overrides: Partial<WorkshopSeries> = {},
): WorkshopSeries {
  return {
    workshop_series_id: WORKSHOP_SERIES_TEST_ID,
    workshop_definition_id: WORKSHOP_TEST_ID,
    series_label: 'Seasonal centerpiece series',
    default_capacity: 12,
    default_price_minor: 8500,
    default_tax_region: 'RI',
    default_tax_rate_basis_points: 700,
    default_currency: 'USD',
    default_venue_name: 'Black Begonia Studio',
    default_address_line_1: '100 Flower Lane',
    default_address_line_2: null,
    default_locality: 'Richmond',
    default_region: 'VA',
    default_postal_code: '23220',
    default_country: 'US',
    default_timezone: 'America/New_York',
    created_by: null,
    updated_by: null,
    created_at: WORKSHOP_NOW,
    updated_at: WORKSHOP_NOW,
    ...overrides,
  };
}

export function publicWorkshopSummaryFixture(
  overrides: Partial<PublicWorkshopSummary> = {},
): PublicWorkshopSummary {
  return {
    slug: 'summer-garden-centerpiece-2026-08-15',
    seriesSlug: 'summer-garden-centerpiece',
    workshopDate: '2026-08-15',
    title: 'Summer Garden Centerpiece',
    advertisingLine: 'Design a garden-inspired centerpiece with us.',
    theme: 'seasonal',
    heroImageUrl: '/images/workshops/summer-garden.jpg',
    heroAltText: 'A seasonal garden centerpiece',
    startAt: '2026-08-15T17:00:00.000Z',
    endAt: '2026-08-15T19:00:00.000Z',
    timezone: 'America/New_York',
    venueName: 'Black Begonia Studio',
    locality: 'Richmond',
    region: 'VA',
    priceMinor: 8500,
    taxRegion: 'RI',
    taxRateBasisPoints: 700,
    currency: 'USD',
    availability: 'available',
    remainingSeats: null,
    isFeatured: true,
    featuredOrder: 1,
    updatedAt: WORKSHOP_NOW,
    ...overrides,
  };
}

export function publicWorkshopOccurrenceFixture(
  overrides: Partial<PublicWorkshopOccurrence> = {},
): PublicWorkshopOccurrence {
  return {
    ...publicWorkshopSummaryFixture(),
    lifecycleStatus: 'published_open',
    description: 'A welcoming hands-on floral workshop.',
    includedMaterials: 'Flowers, vessel, tools, and instruction.',
    accessibilityGuidance: null,
    contactGuidance: null,
    terms: 'Workshop seats are subject to the published cancellation policy.',
    termsVersion: 1,
    addressLine1: '100 Flower Lane',
    addressLine2: null,
    postalCode: '23220',
    country: 'US',
    perBookingLimit: 4,
    stripeEnabled: true,
    venmoEnabled: true,
    waitlistEligible: false,
    media: [],
    seoStatus: 'index',
    replacementUrl: null,
    replacementStartAt: null,
    replacementEndAt: null,
    redirectUrl: null,
    ...overrides,
  };
}

export function workshopBookingFixture(
  overrides: Partial<WorkshopBooking> = {},
): WorkshopBooking {
  return {
    workshop_booking_id: WORKSHOP_BOOKING_TEST_ID,
    workshop_occurrence_id: WORKSHOP_OCCURRENCE_TEST_ID,
    booking_reference: 'BBW-260729-TEST',
    status_token_expires_at: '2026-09-14T19:00:00.000Z',
    contact_name: 'Workshop Guest',
    contact_email: 'guest@example.com',
    contact_phone: null,
    purchased_quantity: 2,
    active_quantity: 2,
    status: 'confirmed',
    payment_state: 'paid',
    price_per_seat_minor_snapshot: 8500,
    subtotal_minor_snapshot: 17000,
    tax_region_snapshot: 'RI',
    tax_rate_basis_points_snapshot: 700,
    tax_minor_snapshot: 1190,
    total_minor_snapshot: 18190,
    required_charges_minor_snapshot: 0,
    currency: 'USD',
    terms_snapshot: 'Workshop seats are subject to the published cancellation policy.',
    terms_version: 1,
    payment_method: 'stripe',
    confirmed_at: WORKSHOP_NOW,
    cancelled_at: null,
    checked_in_at: null,
    created_at: WORKSHOP_NOW,
    updated_at: WORKSHOP_NOW,
    ...overrides,
  };
}

export interface SupabaseResult<T> {
  data: T | null;
  error: { code?: string; message: string } | null;
}

export function supabaseSuccess<T>(data: T): Promise<SupabaseResult<T>> {
  return Promise.resolve({ data, error: null });
}

export function supabaseFailure<T = never>(
  message: string,
  code = 'workshop_test_error',
): Promise<SupabaseResult<T>> {
  return Promise.resolve({ data: null, error: { code, message } });
}
