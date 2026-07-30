import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AnalyticsRegionService } from './analytics-region.service';

describe('AnalyticsRegionService', () => {
  let service: AnalyticsRegionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AnalyticsRegionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('accepts only the minimal valid same-origin response', async () => {
    const promise = service.resolve();
    http.expectOne('/api/analytics-region').flush({
      region: 'us',
      gpc: false,
      production: true,
    });
    await expectAsync(promise).toBeResolvedTo({
      region: 'us',
      gpc: false,
      production: true,
    });
  });

  it('fails closed for malformed, failed, and nonconforming responses', async () => {
    const malformed = service.resolve();
    http.expectOne('/api/analytics-region').flush({ region: 'us', production: true });
    await expectAsync(malformed).toBeResolvedTo(null);

    const failed = service.resolve();
    http.expectOne('/api/analytics-region').flush('failed', {
      status: 500,
      statusText: 'Server Error',
    });
    await expectAsync(failed).toBeResolvedTo(null);
  });
});
