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
});
