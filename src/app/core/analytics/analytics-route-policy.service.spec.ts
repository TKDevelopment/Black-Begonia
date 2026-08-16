import { AnalyticsRoutePolicyService } from './analytics-route-policy.service';

describe('AnalyticsRoutePolicyService', () => {
  const service = new AnalyticsRoutePolicyService();

  it('requires explicit matching metadata for public routes', () => {
    expect(service.classify('/about', { eligible: true, pageCategory: 'about' })).toEqual(
      jasmine.objectContaining({ eligible: true, canonicalPath: '/about' })
    );
    expect(service.classify('/about')).toEqual({
      eligible: false,
      canonicalPath: null,
      pageCategory: null,
    });
    expect(service.classify('/about', { eligible: true, pageCategory: 'home' }).eligible).toBeFalse();
  });

  it('default-denies every sensitive route family before activation', () => {
    for (const url of [
      '/admin/projects/secret?x=1',
      '/pay/signed-token',
      '/login',
      '/password-recovery#token',
      '/change-password?code=secret',
    ]) {
      expect(service.isDefinitelyExcluded(url)).toBeTrue();
      expect(service.classify(url, { eligible: true, pageCategory: 'home' }).eligible).toBeFalse();
    }
  });

  it('uses audited location slugs and a generic portfolio fallback', () => {
    expect(
      service.classify('/locations/newport-ri-wedding-florist?utm_source=test', {
        eligible: true,
        pageCategory: 'location_detail',
      }).contentId
    ).toBe('newport-ri-wedding-florist');
    expect(
      service.classify('/locations/customer-name', {
        eligible: true,
        pageCategory: 'location_detail',
      }).eligible
    ).toBeFalse();
    const portfolio = service.classify('/portfolio/customer-and-venue', {
      eligible: true,
      pageCategory: 'portfolio_detail',
    });
    expect(portfolio).toEqual(
      jasmine.objectContaining({ eligible: true, canonicalPath: '/portfolio/detail' })
    );
    expect(portfolio.contentId).toBeUndefined();
  });

  it('maps unknown public paths to one safe Not Found category', () => {
    expect(
      service.classify('/encoded%20token?email=a@example.com#secret', {
        eligible: true,
        pageCategory: 'not_found',
      })
    ).toEqual({ eligible: true, canonicalPath: '/not-found', pageCategory: 'not_found' });
  });

  it('classifies an allowlisted workshop slug without retaining query or fragment data', () => {
    expect(service.classify(
      '/workshops/autumn-centerpiece?email=customer@example.test#secret',
      { eligible: true, pageCategory: 'workshop_detail' },
    )).toEqual({
      eligible: true,
      canonicalPath: '/workshops/autumn-centerpiece',
      pageCategory: 'workshop_detail',
      contentCategory: 'workshop',
      contentId: 'autumn-centerpiece',
    });
    expect(service.classify('/workshops/customer@example.test', {
      eligible: true,
      pageCategory: 'workshop_detail',
    }).eligible).toBeFalse();
    expect(service.classify('/workshops/autumn-centerpiece/2026-10-15', {
      eligible: true,
      pageCategory: 'workshop_detail',
    })).toEqual(jasmine.objectContaining({
      eligible: true,
      canonicalPath: '/workshops/autumn-centerpiece/2026-10-15',
      contentId: 'autumn-centerpiece',
    }));
  });

  it('classifies the clean reservation route but denies status, payment, and CRM routes', () => {
    expect(service.classify('/workshops/autumn-centerpiece/2026-10-15/reserve', {
      eligible: true,
      pageCategory: 'workshop_reservation',
    })).toEqual({
      eligible: true,
      canonicalPath: '/workshops/autumn-centerpiece/2026-10-15/reserve',
      pageCategory: 'workshop_reservation',
      contentCategory: 'workshop',
      contentId: 'autumn-centerpiece',
    });
    for (const url of [
      '/workshop-booking/status#grant',
      '/pay/signed-token',
      '/admin/workshops/occurrence-id',
    ]) {
      expect(service.isDefinitelyExcluded(url)).toBeTrue();
      expect(service.classify(url, {
        eligible: true,
        pageCategory: 'workshop_detail',
      }).eligible).toBeFalse();
    }
  });
});
