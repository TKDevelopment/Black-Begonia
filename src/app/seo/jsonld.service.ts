import { Injectable, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class JsonLdService {
  constructor(@Inject(DOCUMENT) private doc: Document) {}

  private setScript(id: string, data: object) {
    let script = this.doc.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = this.doc.createElement('script');
      script.type = 'application/ld+json';
      script.id = id;
      this.doc.head.appendChild(script);
    }
    script.text = JSON.stringify(data);
  }

  setLocalBusiness() {
    const data = {
      "@context": "https://schema.org",
      "@type": "Florist",
      "name": "Black Begonia Florals",
      "image": "https://blackbegoniaflorals.com/assets/images/landing/BlackBegoniaTag.png",
      "@id": "https://blackbegoniaflorals.com",
      "url": "https://blackbegoniaflorals.com",
      "telephone": "401-871-4996",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "23 Gilman Rd",
        "addressLocality": "Hope Valley",
        "addressRegion": "RI",
        "postalCode": "02832",
        "addressCountry": "US"
      },
      "areaServed": ["Rhode Island", "Connecticut", "Massachusetts", "New York", "New Hampshire", "Vermont", "Maine", "New England", "Providence", "Newport", "Mystic", "Hartford", "New London", "Westerly", "Watch Hill", "South Kingstown", "Springfield"],
      "sameAs": [
        "https://www.instagram.com/blackbegoniaflorist/",
        "https://www.facebook.com/blackbegoniaflorist"
      ]
    };
    this.setScript('schema-local-business', data);
  }

  setWebsite() {
    const data = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Black Begonia Florals",
      "url": "https://blackbegoniaflorals.com",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://blackbegoniaflorals.com/search?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    };
    this.setScript('schema-website', data);
  }

  setBreadcrumbs(items: { name: string; url: string }[]) {
    const data = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": items.map((item, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "name": item.name,
        "item": item.url
      }))
    };
    this.setScript('schema-breadcrumbs', data);
  }
}
