import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LOCATION_PAGES } from '../locations/locations.data';
import { SeoService } from '../../../core/seo/seo.service';
import { JsonLdService } from '../../../core/seo/jsonld.service';

type LocationHubCard = {
  slug: string;
  city: string;
  state: string;
  title: string;
  description: string;
  image: string;
  eyebrow: string;
};

@Component({
  selector: 'app-locations-hub',
  standalone: true,
  imports: [CommonModule, RouterModule, NgOptimizedImage],
  templateUrl: './locations-hub.component.html',
  styleUrl: './locations-hub.component.scss'
})
export class LocationsHubComponent implements OnInit {
  readonly locations: LocationHubCard[] = LOCATION_PAGES.map((page) => ({
    slug: page.slug,
    city: page.city,
    state: page.state,
    title: page.title,
    description: page.metaDescription,
    image: page.heroImage,
    eyebrow:
      page.state === 'Rhode Island'
        ? 'Rhode Island'
        : page.state === 'Connecticut'
        ? 'Connecticut'
        : 'Massachusetts'
  }));

  constructor(
    private seo: SeoService, 
    private jsonLd: JsonLdService
  ) {}

  ngOnInit(): void {
    this.seo.setPageMeta({
      title: 'Locations We Serve | Rhode Island & New England Wedding Florist',
      description:
        'Explore the locations Black Begonia Florals serves across Rhode Island, Connecticut, Massachusetts, and New England for wedding flowers and floral design.',
      url: 'https://blackbegoniaflorals.com/locations',
      image: 'https://blackbegoniaflorals.com/assets/images/website/1000005134.jpg',
      keywords: [
        'Rhode Island Wedding Florist',
        'New England Wedding Florist',
        'Newport Wedding Florist',
        'Watch Hill Wedding Florist',
        'Providence Wedding Florist',
        'Narragansett Wedding Florist',
        'Westerly Wedding Florist',
        'North Kingstown Florist',
        'Mystic CT Wedding Florist',
        'Boston MA Wedding Florist'
      ]
    });

    this.jsonLd.clearPageSchemas();
    this.jsonLd.setLocationsHub();
    this.jsonLd.setBreadcrumbs([
      { name: 'Home', url: 'https://blackbegoniaflorals.com/' },
      { name: 'Locations', url: 'https://blackbegoniaflorals.com/locations' }
    ]);
  }

  trackBySlug(_: number, item: LocationHubCard): string {
    return item.slug;
  }
}