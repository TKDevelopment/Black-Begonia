import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  getLocationPageBySlug,
  LocationPageData
} from './locations.data';
import { SeoService } from '../../../core/seo/seo.service';
import { JsonLdService } from '../../../core/seo/jsonld.service';

@Component({
  selector: 'app-location-page',
  standalone: true,
  imports: [CommonModule, RouterModule, NgOptimizedImage],
  templateUrl: './locations.component.html',
  styleUrl: './locations.component.scss'
})
export class LocationsComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly jsonLd = inject(JsonLdService);

  page: LocationPageData | null = null;
  private sub?: Subscription;

  ngOnInit(): void {
    this.sub = this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') ?? '';
      const page = getLocationPageBySlug(slug);

      if (!page) {
        this.router.navigateByUrl('/not-found');
        return;
      }

      this.page = page;

      const url = `https://blackbegoniaflorals.com/locations/${page.slug}`;

      this.seo.setPageMeta({
        title: page.metaTitle,
        description: page.metaDescription,
        url,
        image: `https://blackbegoniaflorals.com/${page.heroImage}`,
        keywords: page.keywords,
        type: 'website'
      });

      this.jsonLd.setLocationPage({
        name: `Black Begonia Florals | ${page.city} Wedding Florist`,
        url,
        description: page.metaDescription,
        image: `https://blackbegoniaflorals.com/${page.heroImage}`,
        areaServed: [page.city, page.region, page.state, 'Rhode Island', 'New England'],
        keywords: page.keywords,
        faq: page.faqs
      });

      this.jsonLd.setBreadcrumbs([
        { name: 'Home', url: 'https://blackbegoniaflorals.com/' },
        { name: 'Locations', url: 'https://blackbegoniaflorals.com/locations' },
        { name: `${page.city}`, url }
      ]);
    });
  }

  trackByIndex(index: number): number {
    return index;
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}