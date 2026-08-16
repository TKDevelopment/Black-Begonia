import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';

import { PublicWorkshopSummary } from '../../../core/models/workshop';
import { WebsiteAnalyticsService } from '../../../core/analytics/website-analytics.service';
import { JsonLdService } from '../../../core/seo/jsonld.service';
import { SeoService } from '../../../core/seo/seo.service';
import { WorkshopPublicRepositoryService } from '../../../core/supabase/repositories/workshop-public-repository.service';
import { AnalyticsActionDirective } from '../../../shared/directives/analytics-action.directive';

@Component({
  selector: 'app-workshops',
  standalone: true,
  imports: [CommonModule, RouterModule, NgOptimizedImage, AnalyticsActionDirective],
  templateUrl: './workshops.component.html',
  styleUrl: './workshops.component.scss',
})
export class WorkshopsComponent implements OnInit {
  private readonly repository = inject(WorkshopPublicRepositoryService);
  private readonly analytics = inject(WebsiteAnalyticsService);
  private readonly seo = inject(SeoService);
  private readonly jsonLd = inject(JsonLdService);

  readonly workshops = signal<PublicWorkshopSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly carouselIndex = signal(0);
  readonly featured = computed(() => {
    const firstOccurrenceBySeries = new Map<string, PublicWorkshopSummary>();
    for (const workshop of this.workshops()) {
      if (workshop.isFeatured && !firstOccurrenceBySeries.has(workshop.seriesSlug)) {
        firstOccurrenceBySeries.set(workshop.seriesSlug, workshop);
      }
    }
    return [...firstOccurrenceBySeries.values()].sort(
      (a, b) => (a.featuredOrder ?? Number.MAX_SAFE_INTEGER)
        - (b.featuredOrder ?? Number.MAX_SAFE_INTEGER)
        || new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );
  });
  readonly activeFeatured = computed(() => {
    const items = this.featured();
    return items.length ? items[this.carouselIndex() % items.length] : null;
  });

  seriesEventCount(seriesSlug: string): number {
    return this.workshops().filter((workshop) => workshop.seriesSlug === seriesSlug).length;
  }

  ngOnInit(): void {
    const url = 'https://blackbegoniaflorals.com/workshops';
    const description = 'Explore upcoming floral workshops from Black Begonia Florals, with dates, venues, themes, and seat availability.';
    this.seo.setPageMeta({
      title: 'Floral Workshops | Black Begonia Florals',
      description,
      url,
      keywords: ['floral workshops', 'flower arranging workshop', 'Rhode Island floral workshop'],
    });
    this.jsonLd.setWebPage({
      name: 'Floral Workshops | Black Begonia Florals',
      description,
      url,
    });
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const workshops = await this.repository.listUpcoming();
      this.workshops.set([...workshops].sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      ));
      this.carouselIndex.set(0);
    } catch (error) {
      console.error('[PublicWorkshopsComponent] load error:', error);
      this.error.set('Upcoming workshops are temporarily unavailable.');
      this.workshops.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  nextFeatured(): void {
    const length = this.featured().length;
    if (length) this.carouselIndex.update((index) => (index + 1) % length);
  }

  previousFeatured(): void {
    const length = this.featured().length;
    if (length) this.carouselIndex.update((index) => (index - 1 + length) % length);
  }

  showFeatured(index: number): void {
    if (index >= 0 && index < this.featured().length) this.carouselIndex.set(index);
  }

  trackSelection(
    workshop: PublicWorkshopSummary,
    placement: 'carousel' | 'list',
  ): void {
    this.analytics.trackWorkshopSelection(placement, workshop.slug);
  }

  formatDate(value: string, timezone: string): string {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
      timeZoneName: 'short',
    }).format(new Date(value));
  }

  formatMoney(minor: number, currency: string): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency })
      .format(minor / 100);
  }
}
