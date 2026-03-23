import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { Title, Meta, MetaDefinition } from '@angular/platform-browser';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';

export type SeoInput = {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'profile' | string;
  keywords?: string[];
};

@Injectable({ providedIn: 'root' })
export class SeoService {
  constructor(
    private titleSrv: Title,
    private meta: Meta,
    @Inject(DOCUMENT) private doc: Document,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  setPageMeta(input: SeoInput) {
    const {
      title = 'Black Begonia Florals',
      description = 'Black Begonia Florals by Becca Shappy — New England wedding florist providing luxury, elegant bouquets and event florals throughout Newport, Watch Hill, the Narragansett Bay Area, and across Rhode Island, Connecticut, and Massachussetts.',
      image = 'https://blackbegoniaflorals.com/assets/images/og-default.jpg',
      url = 'https://blackbegoniaflorals.com/',
      type = 'website',
      keywords = []
    } = input;

    // Title
    this.titleSrv.setTitle(title);

    // Base meta
    this.updateTag({ name: 'description', content: description });
    if (keywords.length) {
      this.updateTag({ name: 'keywords', content: keywords.join(', ') });
    }

    // Canonical
    this.setCanonicalUrl(url);

    // Open Graph
    this.updateTag({ property: 'og:title', content: title });
    this.updateTag({ property: 'og:description', content: description });
    this.updateTag({ property: 'og:type', content: type });
    this.updateTag({ property: 'og:url', content: url });
    this.updateTag({ property: 'og:image', content: image });
    this.updateTag({ property: 'og:site_name', content: 'Black Begonia Florals' });

    // Twitter
    this.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.updateTag({ name: 'twitter:title', content: title });
    this.updateTag({ name: 'twitter:description', content: description });
    this.updateTag({ name: 'twitter:image', content: image });
  }

  private updateTag(def: MetaDefinition) {
    const key = (def.name ? `name='${def.name}'` : `property='${def.property}'`);
    const existing = this.meta.getTag(key);
    if (existing) {
      this.meta.updateTag(def);
    } else {
      this.meta.addTag(def);
    }
  }

  private setCanonicalUrl(url: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    const head = this.doc.getElementsByTagName('head')[0];
    let link: HTMLLinkElement | null = this.doc.querySelector("link[rel='canonical']");
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
