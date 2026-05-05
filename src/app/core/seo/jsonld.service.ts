import { Injectable, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

type BreadcrumbItem = { name: string; url: string };

type FaqItem = {
  question: string;
  answer: string;
};

type LocationSchemaInput = {
  name: string;
  url: string;
  description: string;
  image: string;
  areaServed: string[];
  keywords?: string[];
  faq?: FaqItem[];
};

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

  private removeScript(id: string) {
    const script = this.doc.getElementById(id);
    if (script) {
      script.remove();
    }
  }

  clearPageSchemas() {
    this.removeScript('schema-page');
    this.removeScript('schema-faq');
    this.removeScript('schema-breadcrumbs');
    this.removeScript('schema-location-service');
    this.removeScript('schema-locations-hub');
    this.removeScript('schema-portfolio-gallery');
  }

  setLocalBusiness() {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'Florist',
      '@id': 'https://blackbegoniaflorals.com/#florist',
      name: 'Black Begonia Florals',
      image: 'https://blackbegoniaflorals.com/assets/images/og-default.png',
      url: 'https://blackbegoniaflorals.com',
      telephone: '401-871-4996',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '23 Gilman Rd',
        addressLocality: 'Hope Valley',
        addressRegion: 'RI',
        postalCode: '02832',
        addressCountry: 'US'
      },
      areaServed: [
        'Rhode Island',
        'Newport',
        'Watch Hill',
        'South Kingstown',
        'Narragansett',
        'Providence',
        'Bristol',
        'Connecticut',
        'Massachusetts',
        'New York',
        'Maine',
        'New Hampshire',
        'Vermont',
        'New England'
      ],
      sameAs: [
        'https://www.instagram.com/blackbegoniaflorist/',
        'https://www.facebook.com/blackbegoniaflorist'
      ],
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Wedding Floral Services',
        itemListElement: [
          {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: 'Bridal Bouquets'
            }
          },
          {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: 'Ceremony Flowers'
            }
          },
          {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: 'Reception Flowers'
            }
          },
          {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: 'Wedding Centerpieces'
            }
          },
          {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: 'Floral Installations'
            }
          }
        ]
      }
    };

    this.setScript('schema-local-business', data);
  }

  setWebsite() {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': 'https://blackbegoniaflorals.com/#website',
      name: 'Black Begonia Florals',
      url: 'https://blackbegoniaflorals.com'
    };

    this.setScript('schema-website', data);
  }

  setWebPage(input: {
    name: string;
    url: string;
    description: string;
    image?: string;
    keywords?: string[];
  }) {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: input.name,
      url: input.url,
      description: input.description,
      image: input.image,
      keywords: input.keywords?.join(', ')
    };

    this.setScript('schema-page', data);
  }

  setFaq(faqs: FaqItem[]) {
    if (!faqs?.length) {
      this.removeScript('schema-faq');
      return;
    }

    const data = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer
        }
      }))
    };

    this.setScript('schema-faq', data);
  }

  setBreadcrumbs(items: BreadcrumbItem[]) {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        item: item.url
      }))
    };

    this.setScript('schema-breadcrumbs', data);
  }

  setLocationPage(input: LocationSchemaInput) {
    this.setWebPage({
      name: input.name,
      url: input.url,
      description: input.description,
      image: input.image,
      keywords: input.keywords
    });

    this.setFaq(input.faq ?? []);

    const data = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      serviceType: 'Wedding Floral Design',
      name: input.name,
      provider: {
        '@type': 'Florist',
        name: 'Black Begonia Florals',
        url: 'https://blackbegoniaflorals.com'
      },
      areaServed: input.areaServed.map((area) => ({
        '@type': 'Place',
        name: area
      })),
      url: input.url,
      image: input.image,
      description: input.description,
      keywords: input.keywords?.join(', ')
    };

    this.setScript('schema-location-service', data);
  }

  setLocationsHub() {
    this.setWebPage({
      name: 'Locations We Serve | Black Begonia Florals',
      url: 'https://blackbegoniaflorals.com/locations',
      description:
        'Explore the locations Black Begonia Florals serves across Rhode Island, Connecticut, Massachusetts, and New England for wedding flowers and floral design.',
      image: 'https://blackbegoniaflorals.com/assets/images/website/1000005134.jpg',
      keywords: [
        'Rhode Island Wedding Florist',
        'New England Wedding Florist',
        'Locations Wedding Florist',
        'Newport Wedding Florist',
        'Watch Hill Wedding Florist',
        'Providence Wedding Florist',
        'Bristol Wedding Florist',
        'Narragansett Wedding Florist',
        'South Kingstown Wedding Florist',
        'Westerly Wedding Florist',
        'North Kingstown Florist',
        'Mystic CT Wedding Florist',
        'Stonington CT Wedding Florist',
        'Boston MA Wedding Florist'
      ]
    });

    const data = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Black Begonia Florals Service Locations',
      url: 'https://blackbegoniaflorals.com/locations',
      about: {
        '@type': 'Service',
        name: 'Wedding Floral Design'
      },
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          url: 'https://blackbegoniaflorals.com/locations/newport-ri-wedding-florist',
          name: 'Newport RI Wedding Florist'
        },
        {
          '@type': 'ListItem',
          position: 2,
          url: 'https://blackbegoniaflorals.com/locations/watch-hill-ri-wedding-florist',
          name: 'Watch Hill RI Wedding Florist'
        },
        {
          '@type': 'ListItem',
          position: 3,
          url: 'https://blackbegoniaflorals.com/locations/providence-ri-wedding-florist',
          name: 'Providence RI Wedding Florist'
        },
        {
          '@type': 'ListItem',
          position: 4,
          url: 'https://blackbegoniaflorals.com/locations/bristol-ri-wedding-florist',
          name: 'Bristol RI Wedding Florist'
        },
        {
          '@type': 'ListItem',
          position: 5,
          url: 'https://blackbegoniaflorals.com/locations/south-kingstown-ri-wedding-florist',
          name: 'South Kingstown RI Wedding Florist'
        },
        {
          '@type': 'ListItem',
          position: 6,
          url: 'https://blackbegoniaflorals.com/locations/narragansett-ri-wedding-florist',
          name: 'Narragansett RI Wedding Florist'
        },
        {
          '@type': 'ListItem',
          position: 7,
          url: 'https://blackbegoniaflorals.com/locations/westerly-ri-wedding-florist',
          name: 'Westerly RI Wedding Florist'
        },
        {
          '@type': 'ListItem',
          position: 8,
          url: 'https://blackbegoniaflorals.com/locations/north-kingstown-ri-florist',
          name: 'North Kingstown RI Florist'
        },
        {
          '@type': 'ListItem',
          position: 9,
          url: 'https://blackbegoniaflorals.com/locations/mystic-ct-wedding-florist',
          name: 'Mystic CT Wedding Florist'
        },
        {
          '@type': 'ListItem',
          position: 10,
          url: 'https://blackbegoniaflorals.com/locations/stonington-ct-wedding-florist',
          name: 'Stonington CT Wedding Florist'
        },
        {
          '@type': 'ListItem',
          position: 11,
          url: 'https://blackbegoniaflorals.com/locations/boston-ma-wedding-florist',
          name: 'Boston MA Wedding Florist'
        }
      ]
    };

    this.setScript('schema-locations-hub', data);
  }

  setPortfolioGallery(input: {
    name: string;
    url: string;
    description: string;
    image: string;
    location: string;
    images: string[];
  }) {
    this.setWebPage({
      name: input.name,
      url: input.url,
      description: input.description,
      image: input.image,
      keywords: ['wedding flowers', 'portfolio gallery', input.location],
    });

    const data = {
      '@context': 'https://schema.org',
      '@type': 'ImageGallery',
      name: input.name,
      url: input.url,
      description: input.description,
      about: {
        '@type': 'Event',
        name: input.name,
        location: {
          '@type': 'Place',
          name: input.location,
        },
      },
      primaryImageOfPage: input.image,
      image: input.images.length ? input.images : [input.image],
    };

    this.setScript('schema-portfolio-gallery', data);
  }
}
