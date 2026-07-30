import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import {
  ANALYTICS_COOKIE_PREFIX,
  AnalyticsEventName,
  AnalyticsEventParameters,
  GtagWindow,
} from './analytics.models';

@Injectable({ providedIn: 'root' })
export class GoogleAnalyticsClientService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly browser = isPlatformBrowser(this.platformId);
  private loading?: Promise<boolean>;
  private measurementId = '';
  private active = false;

  async enable(measurementId: string): Promise<boolean> {
    if (!this.browser || !/^G-[A-Z0-9]+$/i.test(measurementId)) {
      return false;
    }

    this.measurementId = measurementId;
    const target = window as unknown as GtagWindow;
    target[`ga-disable-${measurementId}`] = false;

    if (this.active) {
      return true;
    }
    if (this.loading) {
      return this.loading;
    }

    target.dataLayer = target.dataLayer ?? [];
    target.gtag =
      target.gtag ??
      ((...args: unknown[]) => {
        target.dataLayer?.push(args);
      });
    target.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      wait_for_update: 500,
    });

    this.loading = this.loadScript(measurementId);
    const loaded = await this.loading;
    this.loading = undefined;
    if (!loaded) {
      return false;
    }

    target.gtag('js', new Date());
    target.gtag('config', measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      url_passthrough: false,
      cookie_prefix: ANALYTICS_COOKIE_PREFIX,
    });
    this.active = true;
    return true;
  }

  send(name: AnalyticsEventName, parameters: AnalyticsEventParameters): void {
    if (!this.browser || !this.active || !this.measurementId) {
      return;
    }
    const target = window as unknown as GtagWindow;
    if (target[`ga-disable-${this.measurementId}`] === true) {
      return;
    }
    try {
      target.gtag?.('event', name, parameters);
    } catch {
      // Analytics must never affect application behavior.
    }
  }

  disable(): void {
    if (!this.browser) {
      return;
    }
    const target = window as unknown as GtagWindow;
    if (this.measurementId) {
      target[`ga-disable-${this.measurementId}`] = true;
    }
    this.active = false;
    this.clearAnalyticsCookies();
  }

  private loadScript(measurementId: string): Promise<boolean> {
    const id = 'bb-google-analytics';
    if (this.document.getElementById(id)) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      const script = this.document.createElement('script');
      script.id = id;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
        measurementId
      )}`;
      script.addEventListener('load', () => resolve(true), { once: true });
      script.addEventListener('error', () => resolve(false), { once: true });
      this.document.head.appendChild(script);
    });
  }

  private clearAnalyticsCookies(): void {
    const cookieNames = this.document.cookie
      .split(';')
      .map((entry) => entry.split('=', 1)[0].trim())
      .filter((name) => name.startsWith(ANALYTICS_COOKIE_PREFIX));

    for (const name of cookieNames) {
      this.document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
      this.document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.blackbegoniaflorals.com; SameSite=Lax`;
    }
  }
}
