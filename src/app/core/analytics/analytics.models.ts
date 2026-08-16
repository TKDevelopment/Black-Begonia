export const ANALYTICS_POLICY_VERSION = '2026-07-23';
export const ANALYTICS_PREFERENCE_STORAGE_KEY = 'bb.analytics.preference.v1';
export const ANALYTICS_INTERNAL_BROWSER_STORAGE_KEY = 'bb.analytics.internal-browser.v1';
export const ANALYTICS_COOKIE_PREFIX = 'bbga';
export const ANALYTICS_PRODUCTION_ORIGIN = 'https://blackbegoniaflorals.com';

export type AnalyticsPreferenceChoice = 'enabled' | 'disabled';
export type AnalyticsRegion = 'us' | 'non_us' | 'unknown';
export type AnalyticsRuntimeState =
  | 'inactive'
  | 'resolving'
  | 'awaiting_opt_in'
  | 'loading'
  | 'enabled'
  | 'disabled'
  | 'failed_closed';

export type AnalyticsPageCategory =
  | 'home'
  | 'about'
  | 'portfolio'
  | 'portfolio_detail'
  | 'locations'
  | 'location_detail'
  | 'inquiry'
  | 'inquiry_success'
  | 'service'
  | 'workshop'
  | 'workshop_detail'
  | 'workshop_reservation'
  | 'testimonials'
  | 'privacy'
  | 'terms'
  | 'not_found';

export type AnalyticsEventName =
  | 'page_view'
  | 'select_content'
  | 'cta_select'
  | 'inquiry_start'
  | 'generate_lead'
  | 'phone_click'
  | 'email_click'
  | 'social_click'
  | 'outbound_click'
  | 'file_download'
  | 'scroll'
  | 'not_found'
  | 'workshop_select'
  | 'workshop_detail_view'
  | 'workshop_reservation_start'
  | 'workshop_checkout_start'
  | 'workshop_booking_confirmed';

export type AnalyticsInquiryType = 'general' | 'wedding';
export type AnalyticsOriginContext = 'workshop';
export type AnalyticsSocialPlatform = 'instagram' | 'facebook';
export type WorkshopAnalyticsPlacement = 'carousel' | 'list';
export type WorkshopAnalyticsProvider = 'stripe' | 'direct_venmo';
export type WorkshopAnalyticsQuantityBand = 'one' | 'two' | 'three_plus';

export interface AnalyticsPreferenceRecord {
  schemaVersion: 1;
  policyVersion: string;
  choice: AnalyticsPreferenceChoice;
  selectedAt: string;
  expiresAt: string;
}

export interface AnalyticsInternalBrowserRecord {
  schemaVersion: 1;
  excluded: boolean;
  updatedAt: string;
}

export interface AnalyticsRegionDecision {
  region: AnalyticsRegion;
  gpc: boolean;
  production: boolean;
}

export interface AnalyticsRouteData {
  eligible: true;
  pageCategory: AnalyticsPageCategory;
}

export interface AnalyticsRouteClassification {
  eligible: boolean;
  canonicalPath: string | null;
  pageCategory: AnalyticsPageCategory | null;
  contentCategory?: 'portfolio' | 'location' | 'service' | 'workshop';
  contentId?: string;
}

export interface AnalyticsCampaignContext {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
}

export type AnalyticsParameterValue = string | number | boolean;
export type AnalyticsEventParameters = Record<string, AnalyticsParameterValue>;

export interface AnalyticsAction {
  event:
    | 'cta_select'
    | 'phone_click'
    | 'email_click'
    | 'social_click'
    | 'outbound_click'
    | 'file_download';
  location: string;
  category?: string;
  platform?: AnalyticsSocialPlatform;
}

export interface SafeWorkshopAnalyticsOutcome {
  event: 'workshop_booking_confirmed';
  publicContentId: string;
  category: 'workshop';
  quantity: number;
  currency: 'USD';
  valueMinor?: number;
}

export interface GtagWindow extends Window {
  dataLayer?: unknown[][];
  gtag?: (...args: unknown[]) => void;
  [key: `ga-disable-${string}`]: boolean | undefined;
}

export interface NavigatorWithGpc extends Navigator {
  globalPrivacyControl?: boolean;
}
