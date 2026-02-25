import { inject } from '@angular/core';
import { SeoRouteListenerService } from './core/seo-route-listener.service';

export function initSeo(domain: string) {
  const listener = inject(SeoRouteListenerService);
  return () => listener.init(domain);
}