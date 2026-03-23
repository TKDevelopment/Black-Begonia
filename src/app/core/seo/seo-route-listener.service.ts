import { Injectable, Inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SeoService } from './seo.service';
import { ROUTE_META } from './seo.routes-meta';
import { DOCUMENT } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class SeoRouteListenerService {
  constructor(
    private router: Router,
    private seo: SeoService,
    @Inject(DOCUMENT) private doc: Document
  ) {}

  init(domain = 'https://blackbegoniaflorals.com') {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
      const urlTree = this.router.parseUrl(e.urlAfterRedirects || e.url);
      const path = (urlTree.root.children['primary']?.segments.map(s => s.path).join('/') || '').toLowerCase();
      const meta = ROUTE_META.find(m => m.path.toLowerCase() === path);
      const canonicalUrl = `${domain}${path ? '/' + path : '/'}`;

      if (meta) {
        this.seo.setPageMeta({
          title: meta.title,
          description: meta.description,
          url: canonicalUrl,
          image: meta.image || `${domain}/assets/images/og-default.jpg`,
          keywords: meta.keywords || []
        });
      } else {
        // still keep canonical updated
        this.seo.setPageMeta({ url: canonicalUrl });
      }
    });
  }
}
