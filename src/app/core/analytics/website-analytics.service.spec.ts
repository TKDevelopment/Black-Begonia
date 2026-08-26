import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AnalyticsPreferenceService } from './analytics-preference.service';
import { AnalyticsRegionService } from './analytics-region.service';
import { AnalyticsScrollService } from './analytics-scroll.service';
import { GoogleAnalyticsClientService } from './google-analytics-client.service';
import { WebsiteAnalyticsService } from './website-analytics.service';
import { WorkshopBookingService } from '../supabase/services/workshop-booking.service';

@Component({ standalone: true, template: '' })
class EmptyComponent {}

describe('WebsiteAnalyticsService', () => {
  let service: WebsiteAnalyticsService;
  let router: Router;
  let google: jasmine.SpyObj<GoogleAnalyticsClientService>;
  let scroll: jasmine.SpyObj<AnalyticsScrollService>;
  let preferences: jasmine.SpyObj<AnalyticsPreferenceService>;
  let region: jasmine.SpyObj<AnalyticsRegionService>;
  let changes: Subject<void>;

  beforeEach(() => {
    changes = new Subject<void>();
    google = jasmine.createSpyObj('GoogleAnalyticsClientService', ['enable', 'disable', 'send']);
    google.enable.and.resolveTo(true);
    scroll = jasmine.createSpyObj('AnalyticsScrollService', ['start', 'stop']);
    preferences = jasmine.createSpyObj(
      'AnalyticsPreferenceService',
      ['getChoice', 'isInternalBrowser', 'browserGpcEnabled'],
      { changes$: changes.asObservable() },
    );
    preferences.getChoice.and.returnValue(null);
    preferences.isInternalBrowser.and.returnValue(false);
    preferences.browserGpcEnabled.and.returnValue(false);
    region = jasmine.createSpyObj('AnalyticsRegionService', ['resolve']);
    region.resolve.and.resolveTo({
      region: 'us',
      gpc: false,
      production: true,
    });
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
          useValue: preferences,
        },
        {
          provide: AnalyticsRegionService,
          useValue: region,
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

  it('sends each workshop discovery and intent milestone exactly once', () => {
    (service as any).state = 'enabled';
    (service as any).currentRoute = {
      eligible: true,
      canonicalPath: '/workshops/garden-workshop',
      pageCategory: 'workshop_detail',
      contentCategory: 'workshop',
      contentId: 'garden-workshop',
    };

    service.trackWorkshopDetailView('garden-workshop');
    service.trackWorkshopDetailView('garden-workshop');
    service.trackWorkshopSelection('carousel', 'garden-workshop');
    service.trackWorkshopSelection('carousel', 'garden-workshop');
    service.trackWorkshopReservationStart('garden-workshop', 3);
    service.trackWorkshopCheckoutStart('direct_venmo', 3);

    expect(google.send.calls.allArgs()).toEqual([
      ['workshop_detail_view', {
        page_category: 'workshop_detail',
        content_category: 'workshop',
        content_id: 'garden-workshop',
      }],
      ['workshop_select', {
        page_category: 'workshop_detail',
        placement: 'carousel',
        content_category: 'workshop',
        content_id: 'garden-workshop',
      }],
      ['workshop_reservation_start', {
        page_category: 'workshop_detail',
        content_category: 'workshop',
        content_id: 'garden-workshop',
        quantity_band: 'three_plus',
      }],
      ['workshop_checkout_start', {
        page_category: 'workshop_detail',
        content_category: 'workshop',
        provider: 'direct_venmo',
        quantity_band: 'three_plus',
      }],
    ]);
  });

  it('redeems and sends only the matching safe confirmed outcome', async () => {
    const booking = jasmine.createSpyObj<WorkshopBookingService>(
      'WorkshopBookingService',
      ['resolvePendingAnalyticsOutcome'],
    );
    booking.resolvePendingAnalyticsOutcome.and.resolveTo({
      event: 'workshop_booking_confirmed',
      publicContentId: 'garden-workshop',
      category: 'workshop',
      quantity: 2,
      currency: 'USD',
      valueMinor: 17000,
    });
    (service as any).state = 'enabled';
    (service as any).currentRoute = {
      eligible: true,
      canonicalPath: '/workshops/garden-workshop',
      pageCategory: 'workshop_detail',
      contentCategory: 'workshop',
      contentId: 'garden-workshop',
    };

    await service.processPendingWorkshopOutcome(booking, 'garden-workshop');
    await service.processPendingWorkshopOutcome(booking, 'garden-workshop');

    expect(booking.resolvePendingAnalyticsOutcome)
      .toHaveBeenCalledWith(true);
    expect(google.send).toHaveBeenCalledOnceWith(
      'workshop_booking_confirmed',
      {
        page_category: 'workshop_detail',
        content_category: 'workshop',
        content_id: 'garden-workshop',
        currency: 'usd',
        value: 170,
      },
    );
    expect(JSON.stringify(google.send.calls.allArgs()))
      .not.toContain('analytics-grant');
  });

  it('discards blocked outcomes and cannot replay them after permission changes', async () => {
    const booking = jasmine.createSpyObj<WorkshopBookingService>(
      'WorkshopBookingService',
      ['resolvePendingAnalyticsOutcome'],
    );
    booking.resolvePendingAnalyticsOutcome.and.resolveTo(null);
    (service as any).state = 'disabled';
    (service as any).currentRoute = {
      eligible: true,
      canonicalPath: '/workshops/garden-workshop',
      pageCategory: 'workshop_detail',
      contentId: 'garden-workshop',
    };

    await service.processPendingWorkshopOutcome(booking, 'garden-workshop');
    (service as any).state = 'enabled';
    await service.processPendingWorkshopOutcome(booking, 'garden-workshop');

    expect(booking.resolvePendingAnalyticsOutcome.calls.argsFor(0))
      .toEqual([false]);
    expect(google.send).not.toHaveBeenCalled();
  });

  it('fails closed across opt-out, GPC, internal, region, and provider decisions', async () => {
    spyOn<any>(service, 'canAttemptMeasurement').and.returnValue(true);
    (service as any).currentRoute = {
      eligible: true,
      canonicalPath: '/workshops',
      pageCategory: 'workshop',
    };
    const evaluate = () =>
      (service as any).evaluatePermission(1, false) as Promise<void>;

    preferences.isInternalBrowser.and.returnValue(true);
    await evaluate();
    expect(service.state).toBe('disabled');
    expect(google.enable).not.toHaveBeenCalled();

    preferences.isInternalBrowser.and.returnValue(false);
    preferences.browserGpcEnabled.and.returnValue(true);
    await evaluate();
    expect(service.state).toBe('disabled');

    preferences.browserGpcEnabled.and.returnValue(false);
    preferences.getChoice.and.returnValue('disabled');
    await evaluate();
    expect(service.state).toBe('disabled');

    preferences.getChoice.and.returnValue(null);
    region.resolve.and.resolveTo({
      region: 'non_us',
      gpc: false,
      production: true,
    });
    await evaluate();
    expect(service.state).toBe('awaiting_opt_in');

    region.resolve.and.resolveTo({
      region: 'us',
      gpc: true,
      production: true,
    });
    await evaluate();
    expect(service.state).toBe('disabled');

    region.resolve.and.resolveTo(null);
    await evaluate();
    expect(service.state).toBe('failed_closed');

    preferences.getChoice.and.returnValue('enabled');
    region.resolve.and.resolveTo({
      region: 'non_us',
      gpc: false,
      production: true,
    });
    await evaluate();
    expect(service.state).toBe('enabled');
    expect(google.enable).toHaveBeenCalled();
  });
});
