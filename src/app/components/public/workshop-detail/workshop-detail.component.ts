import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { PublicWorkshopOccurrence, PublicWorkshopSummary } from '../../../core/models/workshop';
import { WebsiteAnalyticsService } from '../../../core/analytics/website-analytics.service';
import { SeoService } from '../../../core/seo/seo.service';
import { JsonLdService } from '../../../core/seo/jsonld.service';
import { WorkshopPublicRepositoryService } from '../../../core/supabase/repositories/workshop-public-repository.service';
import { WorkshopBookingService } from '../../../core/supabase/services/workshop-booking.service';
import { AnalyticsActionDirective } from '../../../shared/directives/analytics-action.directive';

@Component({
  selector: 'app-workshop-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, AnalyticsActionDirective],
  templateUrl: './workshop-detail.component.html',
  styleUrl: './workshop-detail.component.scss',
})
export class WorkshopDetailComponent implements OnInit, OnDestroy {
  @ViewChild('upcomingEvents') private upcomingEvents?: ElementRef<HTMLElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly repository = inject(WorkshopPublicRepositoryService);
  private readonly bookingService = inject(WorkshopBookingService);
  private readonly analytics = inject(WebsiteAnalyticsService);
  private readonly seo = inject(SeoService);
  private readonly jsonLd = inject(JsonLdService);

  readonly workshop = signal<PublicWorkshopOccurrence | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly notFound = signal(false);
  readonly seriesPage = signal(false);
  readonly seriesOccurrences = signal<PublicWorkshopSummary[]>([]);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => void this.load(
      params.get('seriesSlug') ?? '',
      params.get('workshopDate'),
    ));
  }

  ngOnDestroy(): void {
    this.jsonLd.clearPageSchemas();
  }

  async load(seriesSlug: string, workshopDate: string | null = null): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.notFound.set(false);
    this.seriesPage.set(!workshopDate);
    this.seriesOccurrences.set([]);
    try {
      let workshop: PublicWorkshopOccurrence | null = null;
      if (seriesSlug && workshopDate) {
        workshop = await this.repository.getByRoute(seriesSlug, workshopDate);
      } else if (seriesSlug) {
        const occurrences = (await this.repository.listUpcoming())
          .filter((item) => item.seriesSlug === seriesSlug);
        this.seriesOccurrences.set(occurrences);
        workshop = occurrences.length
          ? await this.repository.getByRoute(seriesSlug, occurrences[0].workshopDate)
          : null;
      }
      if (!workshop) {
        this.notFound.set(true);
        return;
      }
      if (workshop.seoStatus === 'redirect' && workshop.redirectUrl) {
        await this.router.navigateByUrl(workshop.redirectUrl);
        return;
      }
      this.workshop.set(workshop);
      this.analytics.trackWorkshopDetailView(this.seriesPage() ? seriesSlug : workshop.slug);
      void this.analytics.processPendingWorkshopOutcome(
        this.bookingService,
        workshop.slug,
      );
      this.applySeo(workshop, seriesSlug, workshopDate);
    } catch (error) {
      console.error('[WorkshopDetailComponent] load error:', error);
      this.error.set('This workshop could not be loaded right now.');
    } finally {
      this.loading.set(false);
    }
  }

  canReserve(workshop: PublicWorkshopOccurrence): boolean {
    return workshop.lifecycleStatus === 'published_open'
      && ['available', 'limited'].includes(workshop.availability);
  }

  canJoinWaitlist(workshop: PublicWorkshopOccurrence): boolean {
    return workshop.lifecycleStatus === 'published_open'
      && workshop.waitlistEligible
      && ['sold_out', 'waitlist_available'].includes(workshop.availability);
  }

  canReserveSummary(workshop: PublicWorkshopSummary): boolean {
    return ['available', 'limited'].includes(workshop.availability);
  }

  scrollToUpcomingEvents(): void {
    const reducedMotion = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.upcomingEvents?.nativeElement.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'center',
    });
  }

  lifecycleMessage(workshop: PublicWorkshopOccurrence): string {
    switch (workshop.lifecycleStatus) {
      case 'cancelled': return 'This workshop has been cancelled. Its details remain available to guests with a direct link.';
      case 'rescheduled': return 'This workshop was rescheduled. Use the replacement link below for the new date.';
      case 'completed': return 'This workshop has concluded. Browse the upcoming schedule for another gathering.';
      case 'registration_closed': return 'Registration for this workshop is closed.';
      default: return '';
    }
  }

  formatDate(value: string, timezone: string): string {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(new Date(value));
  }

  formatMoney(minor: number, currency: string): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency })
      .format(minor / 100);
  }

  private applySeo(
    workshop: PublicWorkshopOccurrence,
    seriesSlug: string,
    workshopDate: string | null,
  ): void {
    const route = workshopDate ? `${seriesSlug}/${workshopDate}` : seriesSlug;
    const url = `https://blackbegoniaflorals.com/workshops/${route}`;
    this.seo.setPageMeta({
      title: `${workshop.title} | Black Begonia Florals`,
      description: workshop.advertisingLine,
      image: workshop.heroImageUrl,
      url,
      type: 'event',
      keywords: [workshop.theme, 'floral workshop', workshop.locality],
      robots: workshop.seoStatus === 'noindex'
        || ['cancelled', 'rescheduled'].includes(workshop.lifecycleStatus)
        ? 'noindex,follow'
        : 'index,follow,max-image-preview:large',
    });
    const rescheduled = workshop.lifecycleStatus === 'rescheduled'
      && workshop.replacementStartAt
      && workshop.replacementEndAt;
    this.jsonLd.setWorkshopEvent({
      name: workshop.title,
      description: workshop.description,
      url,
      startDate: rescheduled ? workshop.replacementStartAt! : workshop.startAt,
      endDate: rescheduled ? workshop.replacementEndAt! : workshop.endAt,
      previousStartDate: rescheduled ? workshop.startAt : null,
      status: workshop.lifecycleStatus === 'cancelled'
        ? 'cancelled'
        : workshop.lifecycleStatus === 'rescheduled'
          ? 'rescheduled'
          : 'scheduled',
      images: workshop.media.map((item) => item.url),
      venueName: workshop.venueName,
      streetAddress: [workshop.addressLine1, workshop.addressLine2].filter(Boolean).join(', '),
      locality: workshop.locality,
      region: workshop.region,
      postalCode: workshop.postalCode,
      country: workshop.country,
      priceMinor: workshop.priceMinor,
      currency: workshop.currency,
      availability: workshop.availability,
      validFrom: workshop.updatedAt,
    });
  }
}
