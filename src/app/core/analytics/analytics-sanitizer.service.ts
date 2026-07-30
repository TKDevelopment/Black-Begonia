import { Injectable } from '@angular/core';
import {
  AnalyticsCampaignContext,
  AnalyticsEventName,
  AnalyticsEventParameters,
  AnalyticsParameterValue,
} from './analytics.models';

const SAFE_VALUE_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const MAX_VALUE_LENGTH = 80;

const EVENT_PARAMETERS: Record<AnalyticsEventName, ReadonlySet<string>> = {
  page_view: new Set([
    'page_location',
    'page_referrer',
    'page_category',
    'content_category',
    'content_id',
    'campaign_source',
    'campaign_medium',
    'campaign_name',
    'campaign_content',
    'campaign_term',
  ]),
  select_content: new Set(['page_category', 'content_category', 'content_id']),
  cta_select: new Set(['page_category', 'cta_location', 'origin_context']),
  inquiry_start: new Set(['page_category', 'inquiry_type', 'origin_context']),
  generate_lead: new Set([
    'page_category',
    'inquiry_type',
    'origin_context',
    'campaign_source',
    'campaign_medium',
    'campaign_name',
  ]),
  phone_click: new Set(['page_category', 'cta_location']),
  email_click: new Set(['page_category', 'cta_location']),
  social_click: new Set(['page_category', 'cta_location', 'social_platform']),
  outbound_click: new Set(['page_category', 'cta_location', 'destination_category']),
  file_download: new Set(['page_category', 'resource_category']),
  scroll: new Set(['page_category', 'percent_scrolled']),
  not_found: new Set(['page_category']),
};

@Injectable({ providedIn: 'root' })
export class AnalyticsSanitizerService {
  sanitizeEvent(
    name: AnalyticsEventName,
    parameters: AnalyticsEventParameters
  ): AnalyticsEventParameters | null {
    const allowed = EVENT_PARAMETERS[name];
    if (!allowed) {
      return null;
    }

    const sanitized: AnalyticsEventParameters = {};
    for (const [key, value] of Object.entries(parameters)) {
      if (!allowed.has(key)) {
        continue;
      }

      const clean = this.sanitizeValue(key, value);
      if (clean !== null) {
        sanitized[key] = clean;
      }
    }

    return sanitized;
  }

  campaignFromUrl(url: string): AnalyticsCampaignContext {
    try {
      const parsed = new URL(url, 'https://blackbegoniaflorals.com');
      return {
        source: this.sanitizeCampaignValue(parsed.searchParams.get('utm_source')),
        medium: this.sanitizeCampaignValue(parsed.searchParams.get('utm_medium')),
        campaign: this.sanitizeCampaignValue(parsed.searchParams.get('utm_campaign')),
        content: this.sanitizeCampaignValue(parsed.searchParams.get('utm_content')),
        term: this.sanitizeCampaignValue(parsed.searchParams.get('utm_term')),
      };
    } catch {
      return {};
    }
  }

  private sanitizeCampaignValue(value: string | null): string | undefined {
    if (!value) {
      return undefined;
    }
    const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
    if (
      normalized.length === 0 ||
      normalized.length > MAX_VALUE_LENGTH ||
      !SAFE_VALUE_PATTERN.test(normalized)
    ) {
      return undefined;
    }
    return normalized;
  }

  private sanitizeValue(key: string, value: AnalyticsParameterValue): AnalyticsParameterValue | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'boolean') {
      return value;
    }

    if (key === 'page_location') {
      try {
        const parsed = new URL(value, 'https://blackbegoniaflorals.com');
        if (parsed.origin !== 'https://blackbegoniaflorals.com') {
          return null;
        }
        return `${parsed.origin}${parsed.pathname}`;
      } catch {
        return null;
      }
    }

    if (key === 'page_referrer') {
      try {
        const parsed = new URL(value);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          return null;
        }
        return parsed.origin === 'https://blackbegoniaflorals.com'
          ? `${parsed.origin}${parsed.pathname}`
          : parsed.origin;
      } catch {
        return null;
      }
    }

    const normalized = value.trim().toLowerCase();
    if (
      normalized.length === 0 ||
      normalized.length > MAX_VALUE_LENGTH ||
      !SAFE_VALUE_PATTERN.test(normalized)
    ) {
      return null;
    }
    return normalized;
  }
}
