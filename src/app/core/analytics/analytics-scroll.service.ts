import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AnalyticsScrollService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly browser = isPlatformBrowser(this.platformId);
  private callback?: () => void;
  private fired = false;

  start(callback: () => void): void {
    this.stop();
    if (!this.browser) {
      return;
    }
    this.callback = callback;
    this.fired = false;
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.onScroll();
  }

  stop(): void {
    if (this.browser) {
      window.removeEventListener('scroll', this.onScroll);
    }
    this.callback = undefined;
    this.fired = false;
  }

  private readonly onScroll = (): void => {
    if (this.fired || !this.callback) {
      return;
    }
    const root = this.document.documentElement;
    const scrollable = Math.max(root.scrollHeight - window.innerHeight, 0);
    const percent = scrollable === 0 ? 100 : ((window.scrollY + window.innerHeight) / root.scrollHeight) * 100;
    if (percent >= 90) {
      this.fired = true;
      window.removeEventListener('scroll', this.onScroll);
      this.callback();
    }
  };
}
