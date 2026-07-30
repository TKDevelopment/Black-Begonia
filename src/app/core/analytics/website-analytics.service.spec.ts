import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AnalyticsPreferenceService } from './analytics-preference.service';
import { AnalyticsRegionService } from './analytics-region.service';
import { AnalyticsScrollService } from './analytics-scroll.service';
import { GoogleAnalyticsClientService } from './google-analytics-client.service';
import { WebsiteAnalyticsService } from './website-analytics.service';

@Component({ standalone: true, template: '' })
class EmptyComponent {}

describe('WebsiteAnalyticsService', () => {
  let service: WebsiteAnalyticsService;
  let router: Router;
  let google: jasmine.SpyObj<GoogleAnalyticsClientService>;
  let scroll: jasmine.SpyObj<AnalyticsScrollService>;
  let changes: Subject<void>;

  beforeEach(() => {
    changes = new Subject<void>();
    google = jasmine.createSpyObj('GoogleAnalyticsClientService', ['enable', 'disable', 'send']);
    google.enable.and.resolveTo(true);
    scroll = jasmine.createSpyObj('AnalyticsScrollService', ['start', 'stop']);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'about',
            component: EmptyComponent,
            data: { analytics: { eligible: true, pageCategory: 'about' } },
          },
          { path: 'pay/:token', component: EmptyComponent },
        ]),
        {
          provide: AnalyticsPreferenceService,
          useValue: {
            changes$: changes.asObservable(),
            getChoice: () => null,
            isInternalBrowser: () => false,
            browserGpcEnabled: () => false,
          },
        },
        {
          provide: AnalyticsRegionService,
          useValue: {
            resolve: jasmine.createSpy('resolve').and.resolveTo({
              region: 'us',
              gpc: false,
              production: true,
            }),
          },
        },
        { provide: GoogleAnalyticsClientService, useValue: google },
        { provide: AnalyticsScrollService, useValue: scroll },
      ],
    });
    service = TestBed.inject(WebsiteAnalyticsService);
    router = TestBed.inject(Router);
  });

  afterEach(() => service.destroy());

  it('remains inert on local development even for an approved public route', async () => {
    service.init();
    await router.navigateByUrl('/about');
    await Promise.resolve();
    expect(google.enable).not.toHaveBeenCalled();
    expect(service.state).toBe('inactive');
  });

  it('disables immediately when navigation begins toward a secure route', async () => {
    service.init();
    await router.navigateByUrl('/pay/secure-token');
    expect(google.disable).toHaveBeenCalled();
    expect(scroll.stop).toHaveBeenCalled();
  });

  it('dispatches only sanitized typed actions through the facade', () => {
    (service as any).state = 'enabled';
    (service as any).currentRoute = {
      eligible: true,
      canonicalPath: '/about',
      pageCategory: 'about',
    };
    service.trackAction({
      event: 'social_click',
      location: 'footer',
      platform: 'instagram',
    });
    expect(google.send).toHaveBeenCalledOnceWith('social_click', {
      page_category: 'about',
      cta_location: 'footer',
      social_platform: 'instagram',
    });
  });
});
