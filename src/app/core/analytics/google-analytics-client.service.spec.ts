import { TestBed } from '@angular/core/testing';
import { GtagWindow } from './analytics.models';
import { GoogleAnalyticsClientService } from './google-analytics-client.service';

describe('GoogleAnalyticsClientService', () => {
  let service: GoogleAnalyticsClientService;
  let target: GtagWindow;

  beforeEach(() => {
    document.getElementById('bb-google-analytics')?.remove();
    target = window as unknown as GtagWindow;
    delete target.gtag;
    delete target.dataLayer;
    delete target['ga-disable-G-TEST123'];
    TestBed.configureTestingModule({});
    service = TestBed.inject(GoogleAnalyticsClientService);
  });

  afterEach(() => {
    service.disable();
    document.getElementById('bb-google-analytics')?.remove();
  });

  it('queues advertising-denied consent before inserting one asynchronous script', async () => {
    const append = spyOn(document.head, 'appendChild').and.callFake(<T extends Node>(node: T): T => {
      queueMicrotask(() => node.dispatchEvent(new Event('load')));
      return node;
    });
    await expectAsync(service.enable('G-TEST123')).toBeResolvedTo(true);
    expect(append).toHaveBeenCalledTimes(1);
    expect(target.dataLayer?.[0]).toEqual([
      'consent',
      'default',
      jasmine.objectContaining({
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      }),
    ]);
    expect(target.dataLayer).toContain([
      'config',
      'G-TEST123',
      jasmine.objectContaining({
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        url_passthrough: false,
      }),
    ]);
    await expectAsync(service.enable('G-TEST123')).toBeResolvedTo(true);
    expect(append).toHaveBeenCalledTimes(1);
  });

  it('sets the disable flag before suppressing all later dispatch', async () => {
    spyOn(document.head, 'appendChild').and.callFake(<T extends Node>(node: T): T => {
      queueMicrotask(() => node.dispatchEvent(new Event('load')));
      return node;
    });
    await service.enable('G-TEST123');
    service.disable();
    service.send('page_view', { page_category: 'home' });
    expect(target['ga-disable-G-TEST123']).toBeTrue();
    expect(target.dataLayer?.some((entry) => entry[0] === 'event')).toBeFalse();
  });

  it('isolates provider load failure and invalid configuration', async () => {
    spyOn(document.head, 'appendChild').and.callFake(<T extends Node>(node: T): T => {
      queueMicrotask(() => node.dispatchEvent(new Event('error')));
      return node;
    });
    await expectAsync(service.enable('invalid')).toBeResolvedTo(false);
    await expectAsync(service.enable('G-TEST123')).toBeResolvedTo(false);
  });
});
