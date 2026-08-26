import { AnalyticsSanitizerService } from './analytics-sanitizer.service';

describe('AnalyticsSanitizerService', () => {
  const service = new AnalyticsSanitizerService();

  it('retains only event-specific parameters and strips query/fragment values', () => {
    expect(
      service.sanitizeEvent('page_view', {
        page_location: 'https://blackbegoniaflorals.com/about?email=a@example.com#token',
        page_category: 'about',
        customer_id: 'secret',
      })
    ).toEqual({
      page_location: 'https://blackbegoniaflorals.com/about',
      page_category: 'about',
    });
  });

  it('rejects external URLs, PII-shaped values, unsafe characters, and excessive values', () => {
    expect(
      service.sanitizeEvent('page_view', {
        page_location: 'https://evil.example/customer',
        page_category: 'about',
      })
    ).toEqual({ page_category: 'about' });
    expect(
      service.sanitizeEvent('cta_select', {
        page_category: 'service',
        cta_location: 'morgan@example.com',
        origin_context: 'x'.repeat(81),
      })
    ).toEqual({ page_category: 'service' });
  });

  it('normalizes only documented UTM keys without retaining the raw URL', () => {
    expect(
      service.campaignFromUrl(
        'https://blackbegoniaflorals.com/?utm_source=Instagram&utm_medium=Social&utm_campaign=Summer Weddings&gclid=secret'
      )
    ).toEqual({
      source: 'instagram',
      medium: 'social',
      campaign: 'summer_weddings',
      content: undefined,
      term: undefined,
    });
  });

  it('reduces external referrers to origin and removes same-origin query values', () => {
    expect(
      service.sanitizeEvent('page_view', {
        page_location: 'https://blackbegoniaflorals.com/about',
        page_referrer: 'https://venue.example/customer/name?email=a@example.com',
      })
    ).toEqual({
      page_location: 'https://blackbegoniaflorals.com/about',
      page_referrer: 'https://venue.example',
    });
  });

  it('allowlists typed low-cardinality workshop milestone parameters', () => {
    expect(service.sanitizeEvent('workshop_select', {
      page_category: 'workshop',
      placement: 'carousel',
      content_category: 'workshop',
      content_id: 'autumn-centerpiece',
      raw_url: '/workshops/autumn-centerpiece?email=customer@example.test',
      booking_reference: 'BBW-SECRET',
    })).toEqual({
      page_category: 'workshop',
      placement: 'carousel',
      content_category: 'workshop',
      content_id: 'autumn-centerpiece',
    });
    expect(service.sanitizeEvent('workshop_checkout_start', {
      page_category: 'workshop_detail',
      content_category: 'workshop',
      provider: 'stripe',
      quantity_band: 'three_plus',
      customer_email: 'customer@example.test',
    })).toEqual({
      page_category: 'workshop_detail',
      content_category: 'workshop',
      provider: 'stripe',
      quantity_band: 'three_plus',
    });
  });

  it('rejects URL, query, fragment, and PII-shaped workshop content identifiers', () => {
    for (const value of [
      '/workshops/autumn-centerpiece',
      'autumn-centerpiece?token=secret',
      'autumn-centerpiece#customer',
      'customer@example.test',
      'x'.repeat(81),
    ]) {
      expect(service.normalizePublicContentId(value)).toBeNull();
    }
    expect(service.normalizePublicContentId(' Autumn-Centerpiece '))
      .toBe('autumn-centerpiece');
  });
});
