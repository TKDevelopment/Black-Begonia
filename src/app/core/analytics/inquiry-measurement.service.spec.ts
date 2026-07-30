import { TestBed } from '@angular/core/testing';
import { WebsiteAnalyticsService } from './website-analytics.service';
import { InquiryMeasurementService } from './inquiry-measurement.service';

describe('InquiryMeasurementService', () => {
  let service: InquiryMeasurementService;
  let analytics: jasmine.SpyObj<WebsiteAnalyticsService>;

  beforeEach(() => {
    analytics = jasmine.createSpyObj('WebsiteAnalyticsService', [
      'trackInquiryStart',
      'trackConfirmedLead',
    ]);
    TestBed.configureTestingModule({
      providers: [
        InquiryMeasurementService,
        { provide: WebsiteAnalyticsService, useValue: analytics },
      ],
    });
    service = TestBed.inject(InquiryMeasurementService);
  });

  it('records start and durable confirmation once per component attempt', () => {
    service.start('general', 'workshop');
    service.start('general', 'workshop');
    service.confirm('general', 'workshop');
    service.confirm('general', 'workshop');
    expect(analytics.trackInquiryStart).toHaveBeenCalledOnceWith('general', 'workshop');
    expect(analytics.trackConfirmedLead).toHaveBeenCalledOnceWith('general', 'workshop');
  });

  it('can reset transient attempt state without carrying identifiers', () => {
    service.start('wedding');
    service.confirm('wedding');
    service.reset();
    service.start('wedding');
    service.confirm('wedding');
    expect(analytics.trackInquiryStart).toHaveBeenCalledTimes(2);
    expect(analytics.trackConfirmedLead).toHaveBeenCalledTimes(2);
  });
});
