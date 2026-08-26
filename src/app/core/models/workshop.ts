export type WorkshopCurrency = 'USD';
export type WorkshopTaxRegion = 'RI' | 'CT' | 'MA';
export type WorkshopLifecycleStatus =
  | 'draft'
  | 'published_open'
  | 'registration_closed'
  | 'cancelled'
  | 'rescheduled'
  | 'completed'
  | 'archived';
export type WorkshopAvailability =
  | 'available'
  | 'limited'
  | 'sold_out'
  | 'waitlist_available'
  | 'closed';
export type WorkshopMediaRole = 'hero' | 'gallery';
export type WorkshopStripeCatalogState = 'not_configured' | 'pending' | 'ready' | 'failed';
export type WorkshopStripePriceState = 'pending' | 'active' | 'inactive' | 'failed';

export interface WorkshopDefinition {
  workshop_definition_id: string;
  title: string;
  theme: string;
  advertising_line: string;
  description: string;
  included_materials: string;
  accessibility_guidance: string | null;
  contact_guidance: string | null;
  default_terms: string;
  default_terms_version: number;
  default_currency: WorkshopCurrency;
  is_reusable: boolean;
  reusable_retired_at: string | null;
  stripe_product_id: string | null;
  stripe_catalog_state: WorkshopStripeCatalogState;
  stripe_catalog_error: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkshopSeries {
  workshop_series_id: string;
  workshop_definition_id: string;
  series_label: string;
  default_capacity: number;
  default_price_minor: number;
  default_tax_region: WorkshopTaxRegion;
  default_tax_rate_basis_points: number;
  default_currency: WorkshopCurrency;
  default_venue_name: string;
  default_address_line_1: string;
  default_address_line_2: string | null;
  default_locality: string;
  default_region: string;
  default_postal_code: string;
  default_country: string;
  default_timezone: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkshopSeriesInput {
  workshopDefinitionId: string;
  label: string;
  capacity: number;
  priceMinor: number;
  taxRegion: WorkshopTaxRegion;
  venueName: string;
  addressLine1: string;
  addressLine2?: string | null;
  locality: string;
  region: string;
  postalCode: string;
  country: string;
  timezone: string;
}

export type WorkshopSeriesUpdateScope = 'current' | 'selected' | 'all_future';

export interface WorkshopSeriesUpdatePatch {
  scope: WorkshopSeriesUpdateScope;
  previewOnly?: boolean;
  confirmedBookedOccurrenceIds?: string[];
  title?: string;
  advertisingLine?: string;
  description?: string;
  includedMaterials?: string;
  terms?: string;
  termsVersion?: number;
  venueName?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  locality?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  capacity?: number;
  perBookingLimit?: number;
  priceMinor?: number;
  taxRegion?: WorkshopTaxRegion;
  taxRateBasisPoints?: number;
  stripePriceVersionId?: string | null;
  stripeEnabled?: boolean;
  venmoEnabled?: boolean;
  waitlistEnabled?: boolean;
}

export interface WorkshopSeriesUpdateResult {
  previewOnly?: boolean;
  occurrenceIds: string[];
  bookedOccurrenceIds: string[];
  changedFields?: string[];
  occurrences?: WorkshopOccurrence[];
}

export interface WorkshopOccurrence {
  workshop_occurrence_id: string;
  workshop_definition_id: string;
  workshop_series_id: string | null;
  slug: string;
  status: WorkshopLifecycleStatus;
  title_snapshot: string;
  advertising_line_snapshot: string;
  description_snapshot: string;
  included_materials_snapshot: string;
  terms_snapshot: string;
  terms_version: number;
  venue_name: string;
  address_line_1: string;
  address_line_2: string | null;
  locality: string;
  region: string;
  postal_code: string;
  country: string;
  timezone: string;
  local_start: string;
  local_end: string;
  utc_offset_minutes: number;
  start_at: string;
  end_at: string;
  registration_opens_at: string;
  registration_closes_at: string;
  capacity: number;
  per_booking_limit: number;
  price_minor: number;
  tax_region: WorkshopTaxRegion;
  tax_rate_basis_points: number;
  currency: WorkshopCurrency;
  stripe_price_version_id: string | null;
  stripe_enabled: boolean;
  venmo_enabled: boolean;
  waitlist_enabled: boolean;
  waitlist_offer_duration_minutes: number;
  is_featured: boolean;
  featured_order: number | null;
  published_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  archived_at: string | null;
  replacement_occurrence_id: string | null;
  status_page_expires_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkshopMedia {
  workshop_media_id: string;
  workshop_definition_id: string | null;
  workshop_occurrence_id: string | null;
  media_role: WorkshopMediaRole;
  storage_path: string;
  public_url: string;
  alt_text: string;
  display_order: number;
  is_public: boolean;
  width: number;
  height: number;
  byte_size: number;
  mime_type: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkshopStripePriceVersion {
  workshop_stripe_price_version_id: string;
  workshop_definition_id: string;
  stripe_product_id: string;
  stripe_price_id: string;
  amount_minor: number;
  currency: WorkshopCurrency;
  state: WorkshopStripePriceState;
  provider_created_at: string;
  created_by: string | null;
  created_at: string;
  deactivated_at: string | null;
}

export interface WorkshopPublicMedia {
  role: WorkshopMediaRole;
  url: string;
  altText: string;
  displayOrder: number;
}

export interface PublicWorkshopSummary {
  slug: string;
  seriesSlug: string;
  workshopDate: string;
  title: string;
  advertisingLine: string;
  theme: string;
  heroImageUrl: string;
  heroAltText: string;
  startAt: string;
  endAt: string;
  timezone: string;
  venueName: string;
  locality: string;
  region: string;
  priceMinor: number;
  taxRegion: WorkshopTaxRegion;
  taxRateBasisPoints: number;
  currency: WorkshopCurrency;
  availability: WorkshopAvailability;
  remainingSeats: number | null;
  isFeatured: boolean;
  featuredOrder: number | null;
  updatedAt: string;
}

export interface PublicWorkshopOccurrence extends PublicWorkshopSummary {
  lifecycleStatus: WorkshopLifecycleStatus;
  description: string;
  includedMaterials: string;
  accessibilityGuidance: string | null;
  contactGuidance: string | null;
  terms: string;
  termsVersion: number;
  addressLine1: string;
  addressLine2: string | null;
  postalCode: string;
  country: string;
  perBookingLimit: number;
  stripeEnabled: boolean;
  venmoEnabled: boolean;
  waitlistEligible: boolean;
  media: WorkshopPublicMedia[];
  seoStatus: 'index' | 'noindex' | 'redirect';
  replacementUrl: string | null;
  replacementStartAt: string | null;
  replacementEndAt: string | null;
  redirectUrl: string | null;
}

export interface WorkshopOccurrenceDraft {
  workshopOccurrenceId?: string | null;
  workshopDefinitionId: string;
  workshopSeriesId?: string | null;
  slug: string;
  title: string;
  advertisingLine: string;
  description: string;
  includedMaterials: string;
  terms: string;
  termsVersion: number;
  venueName: string;
  addressLine1: string;
  addressLine2?: string | null;
  locality: string;
  region: string;
  postalCode: string;
  country: string;
  timezone: string;
  localStart: string;
  localEnd: string;
  utcOffsetMinutes: number;
  registrationOpensAt: string;
  registrationClosesAt: string;
  capacity: number;
  perBookingLimit: number;
  priceMinor: number;
  taxRegion: WorkshopTaxRegion;
  taxRateBasisPoints: number;
  currency: WorkshopCurrency;
  stripePriceVersionId?: string | null;
  stripeEnabled: boolean;
  venmoEnabled: boolean;
  waitlistEnabled: boolean;
  isFeatured: boolean;
  featuredOrder?: number | null;
}

export interface CreateWorkshopDefinitionInput {
  title: string;
  theme: string;
  advertisingLine: string;
  description: string;
  includedMaterials: string;
  accessibilityGuidance?: string | null;
  contactGuidance?: string | null;
  defaultTerms: string;
}

export interface WorkshopCatalogOverview {
  definitions: WorkshopDefinition[];
  occurrences: WorkshopOccurrence[];
}
