import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { WebsiteAnalyticsService } from '../../../core/analytics/website-analytics.service';
import { SeoService } from '../../../core/seo/seo.service';
import { JsonLdService } from '../../../core/seo/jsonld.service';
import { WorkshopPublicRepositoryService } from '../../../core/supabase/repositories/workshop-public-repository.service';
import { WorkshopBookingService } from '../../../core/supabase/services/workshop-booking.service';
import { publicWorkshopOccurrenceFixture, publicWorkshopSummaryFixture } from '../../../core/testing/workshop-testing';
import { WorkshopDetailComponent } from './workshop-detail.component';

describe('WorkshopDetailComponent', () => {
  let component: WorkshopDetailComponent;
  let fixture: ComponentFixture<WorkshopDetailComponent>;
  let repository: jasmine.SpyObj<WorkshopPublicRepositoryService>;
  let seo: jasmine.SpyObj<SeoService>;
  let analytics: jasmine.SpyObj<WebsiteAnalyticsService>;
  let jsonLd: jasmine.SpyObj<JsonLdService>;
  let bookingService: jasmine.SpyObj<WorkshopBookingService>;

  beforeEach(async () => {
    repository = jasmine.createSpyObj('WorkshopPublicRepositoryService', ['listUpcoming', 'getBySlug', 'getByRoute']);
    seo = jasmine.createSpyObj('SeoService', ['setPageMeta']);
    jsonLd = jasmine.createSpyObj('JsonLdService', ['setWorkshopEvent', 'clearPageSchemas']);
    analytics = jasmine.createSpyObj('WebsiteAnalyticsService', [
      'trackAction',
      'trackWorkshopDetailView',
      'processPendingWorkshopOutcome',
    ]);
    analytics.processPendingWorkshopOutcome.and.resolveTo();
    bookingService = jasmine.createSpyObj('WorkshopBookingService', [
      'resolvePendingAnalyticsOutcome',
    ]);
    const detail = publicWorkshopOccurrenceFixture({
      slug: 'summer-workshop',
      advertisingLine: 'Design something beautiful together',
      includedMaterials: 'One green compote\nDahlias\nEtc\nEtc',
      remainingSeats: 3,
      media: [
        { role: 'hero', url: '/hero.webp', altText: 'Hero flowers', displayOrder: 0 },
        { role: 'gallery', url: '/gallery.webp', altText: 'Guests arranging flowers', displayOrder: 1 },
      ],
    });
    repository.getBySlug.and.resolveTo(detail);
    repository.getByRoute.and.resolveTo(detail);
    repository.listUpcoming.and.resolveTo([
      publicWorkshopSummaryFixture(),
      publicWorkshopSummaryFixture({
        slug: 'summer-garden-centerpiece-2026-08-22',
        workshopDate: '2026-08-22',
        startAt: '2026-08-22T17:00:00Z',
      }),
    ]);
    await TestBed.configureTestingModule({
      imports: [WorkshopDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(new Map([
          ['seriesSlug', 'summer-garden-centerpiece'],
          ['workshopDate', '2026-08-15'],
        ])) } },
        { provide: WorkshopPublicRepositoryService, useValue: repository },
        { provide: WorkshopBookingService, useValue: bookingService },
        { provide: SeoService, useValue: seo },
        { provide: JsonLdService, useValue: jsonLd },
        {
          provide: WebsiteAnalyticsService,
          useValue: analytics,
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WorkshopDetailComponent);
    component = fixture.componentInstance;
  });

  it('renders the experience, full venue, gallery, and reserve action without inline terms', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Workshop seats are subject');
    expect(fixture.nativeElement.textContent).not.toContain('Workshop details');
    expect(fixture.nativeElement.querySelector('.experience-panel')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.hero-copy .lead')).toBeNull();
    expect(fixture.nativeElement.querySelector('.experience-panel h2').textContent.trim())
      .toBe('Design Something Beautiful Together');
    expect(getComputedStyle(
      fixture.nativeElement.querySelector('.hero-media > img'),
    ).aspectRatio).toBe('16 / 9');
    expect(fixture.nativeElement.querySelector('.hero-heading')).toBeNull();
    expect(fixture.nativeElement.querySelector('.hero-composition')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.hero-copy h1').textContent.trim())
      .toBe('Summer Garden Centerpiece');
    expect(fixture.nativeElement.querySelector('.hero-title-sr')).toBeNull();
    expect(getComputedStyle(
      fixture.nativeElement.querySelector('.hero-composition'),
    ).display).toBe('grid');
    expect(getComputedStyle(
      fixture.nativeElement.querySelector('.hero-composition'),
    ).alignItems).toBe('start');
    expect(getComputedStyle(
      fixture.nativeElement.querySelector('.hero-composition'),
    ).maxWidth).toBe('1440px');
    expect(getComputedStyle(
      fixture.nativeElement.querySelector('.detail-shell'),
    ).maxWidth).toBe('1440px');
    expect(getComputedStyle(
      fixture.nativeElement.querySelector('.breadcrumb'),
    ).marginBottom).toBe(
      window.matchMedia('(max-width: 640px)').matches ? '10px' : '21.6px',
    );
    const tabletHero = window.matchMedia('(max-width: 960px)').matches;
    const hero = fixture.nativeElement.querySelector('.hero') as HTMLElement;
    const heroMedia = fixture.nativeElement.querySelector('.hero-media') as HTMLElement;
    const heroImage = fixture.nativeElement.querySelector('.hero-media > img') as HTMLElement;
    const heroCopy = fixture.nativeElement.querySelector('.hero-copy') as HTMLElement;
    const heroFacts = fixture.nativeElement.querySelector('.hero-facts') as HTMLElement;
    const firstFact = fixture.nativeElement.querySelector('.hero-facts > div') as HTMLElement;
    const firstFactLabel = fixture.nativeElement.querySelector('.hero-facts dt') as HTMLElement;
    const firstFactDetail = fixture.nativeElement.querySelector('.hero-facts dd') as HTMLElement;
    const seatPrice = fixture.nativeElement.querySelector('.hero-facts > div:last-child dd') as HTMLElement;
    expect(getComputedStyle(hero).backgroundImage).toBe('none');
    expect(getComputedStyle(hero).borderTopWidth).toBe('0px');
    expect(getComputedStyle(heroMedia).aspectRatio).toBe('16 / 9');
    expect(Number.parseFloat(getComputedStyle(heroImage).height)).toBeGreaterThan(0);
    expect(getComputedStyle(heroImage).height).toBe(getComputedStyle(heroMedia).height);
    expect(getComputedStyle(heroImage).objectFit).toBe('cover');
    expect(getComputedStyle(heroCopy).backgroundColor)
      .toBe(tabletHero ? 'rgba(0, 0, 0, 0)' : 'rgb(46, 41, 38)');
    expect(getComputedStyle(heroCopy).display).toBe('flex');
    expect(getComputedStyle(heroCopy).flexDirection).toBe('column');
    expect(getComputedStyle(heroCopy).justifyContent).toBe('space-between');
    expect(getComputedStyle(heroCopy).aspectRatio).toBe(tabletHero ? 'auto' : '1 / 1');
    expect(getComputedStyle(heroCopy).overflowY).toBe(tabletHero ? 'visible' : 'auto');
    expect(Number.parseFloat(getComputedStyle(heroCopy).paddingTop)).toBeGreaterThan(0);
    const headingGroup = heroCopy.querySelector('.hero-heading-group') as HTMLElement;
    expect(heroCopy.firstElementChild).toBe(headingGroup);
    expect(headingGroup.firstElementChild?.classList.contains('eyebrow')).toBeTrue();
    expect(headingGroup.lastElementChild?.tagName).toBe('H1');
    expect(heroCopy.lastElementChild?.classList.contains('hero-booking')).toBeTrue();
    expect(getComputedStyle(headingGroup.querySelector('h1') as HTMLElement).marginBottom).toBe('0px');
    expect(getComputedStyle(heroFacts).display).toBe('flex');
    expect(getComputedStyle(heroFacts).flexDirection).toBe('column');
    expect(getComputedStyle(heroFacts).flexGrow).toBe('1');
    expect(getComputedStyle(heroFacts).justifyContent).toBe('space-evenly');
    expect(getComputedStyle(firstFact).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(firstFactLabel).fontSize).toBe('11.2px');
    expect(getComputedStyle(firstFactDetail).fontSize).toBe('18.4px');
    expect(getComputedStyle(seatPrice).fontSize).toBe('25.6px');
    expect(fixture.nativeElement.querySelectorAll('.hero-facts > div').length).toBe(3);
    expect(fixture.nativeElement.querySelector('.detail-shell')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('100 Flower Lane');
    const includedMaterials = fixture.nativeElement.querySelector('.included-materials') as HTMLElement;
    expect(includedMaterials.textContent).toContain('One green compote\nDahlias\nEtc\nEtc');
    expect(getComputedStyle(includedMaterials).whiteSpace).toBe('pre-line');
    expect(fixture.nativeElement.querySelectorAll('.gallery img').length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Reserve seats');
    expect(fixture.nativeElement.querySelector('.hero-upcoming-action')).toBeNull();
    expect(fixture.nativeElement.querySelector('.detail-footer__ornament')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.detail-footer__copy p').textContent)
      .toContain('Tell us about your group');
    expect(fixture.nativeElement.querySelector('.hero-facts')).not.toBeNull();
    expect(seo.setPageMeta).toHaveBeenCalled();
    expect(analytics.trackWorkshopDetailView)
      .toHaveBeenCalledWith('summer-workshop');
    expect(analytics.processPendingWorkshopOutcome)
      .toHaveBeenCalledWith(bookingService, 'summer-workshop');
  });

  it('derives open, limited, sold-out, and waitlist actions from public state', () => {
    expect(component.canReserve(publicWorkshopOccurrenceFixture({ availability: 'available' }))).toBeTrue();
    expect(component.canReserve(publicWorkshopOccurrenceFixture({ availability: 'limited' }))).toBeTrue();
    expect(component.canReserve(publicWorkshopOccurrenceFixture({ availability: 'sold_out' }))).toBeFalse();
    expect(component.canJoinWaitlist(publicWorkshopOccurrenceFixture({
      availability: 'waitlist_available',
      waitlistEligible: true,
    }))).toBeTrue();
  });

  it('shows the same bounded urgency fact on an occurrence detail', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.hero-copy .seat-urgency').textContent)
      .toContain('Only 3 seats remaining');
  });

  it('renders one series page with its upcoming occurrence list and dated reservation links', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await component.load('summer-garden-centerpiece');
    fixture.detectChanges();

    expect(component.seriesPage()).toBeTrue();
    expect(component.seriesOccurrences().length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.series-date-row').length).toBe(2);
    const upcomingAction = fixture.nativeElement.querySelector(
      '.hero-upcoming-action',
    ) as HTMLButtonElement;
    const upcomingSection = fixture.nativeElement.querySelector(
      '#upcoming-workshop-events',
    ) as HTMLElement;
    expect(upcomingAction.textContent?.trim()).toBe('View Upcoming Events');
    expect(upcomingAction.tagName).toBe('BUTTON');
    expect(upcomingAction.type).toBe('button');
    expect(upcomingAction.getAttribute('href')).toBeNull();
    expect(upcomingAction.closest('.hero-copy')).not.toBeNull();
    expect(upcomingAction.closest('.hero-booking')).toBe(
      fixture.nativeElement.querySelector('.hero-copy')?.lastElementChild,
    );
    expect(upcomingSection.getAttribute('aria-labelledby')).toBe('series-dates-title');
    expect(getComputedStyle(upcomingSection).scrollMarginTop).toBe('0px');
    if (upcomingAction.tagName === 'BUTTON') {
      const scrollSpy = spyOn(upcomingSection, 'scrollIntoView');
      const routerUrl = TestBed.inject(Router).url;
      upcomingAction.click();
      expect(scrollSpy).toHaveBeenCalledWith(jasmine.objectContaining({ block: 'center' }));
      expect(TestBed.inject(Router).url).toBe(routerUrl);
    }
    expect(fixture.nativeElement.querySelector('.series-date-actions .details-button').textContent.trim())
      .toContain('See Details');
    expect(fixture.nativeElement.querySelector('.series-date-actions .primary-action').getAttribute('href'))
      .toBe('/workshops/summer-garden-centerpiece/2026-08-15/reserve');
    expect(repository.getByRoute).toHaveBeenCalledWith(
      'summer-garden-centerpiece', '2026-08-15',
    );
  });

  it('presents completed, directly accessed cancelled, and rescheduled lifecycle states', () => {
    expect(component.lifecycleMessage(publicWorkshopOccurrenceFixture({
      lifecycleStatus: 'completed',
    }))).toContain('concluded');
    expect(component.lifecycleMessage(publicWorkshopOccurrenceFixture({
      lifecycleStatus: 'cancelled',
    }))).toContain('cancelled');
    expect(component.lifecycleMessage(publicWorkshopOccurrenceFixture({
      lifecycleStatus: 'rescheduled',
    }))).toContain('rescheduled');
  });

  it('shows not-found and follows an explicit retained-page redirect outcome', async () => {
    repository.getByRoute.and.resolveTo(null);
    await component.load('missing', '2026-08-15');
    expect(component.notFound()).toBeTrue();

    const router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    repository.getByRoute.and.resolveTo(publicWorkshopOccurrenceFixture({
      seoStatus: 'redirect',
      redirectUrl: '/workshops',
    }));
    await component.load('expired-status', '2026-08-15');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/workshops');
  });

  it('emits SSR-visible lifecycle metadata and replacement facts without indexing retained status pages', async () => {
    repository.getByRoute.and.resolveTo(publicWorkshopOccurrenceFixture({
      slug: 'old-summer-date',
      lifecycleStatus: 'rescheduled',
      seoStatus: 'noindex',
      startAt: '2026-08-14T22:00:00Z',
      endAt: '2026-08-15T00:00:00Z',
      replacementUrl: '/workshops/new-summer-date',
      replacementStartAt: '2026-08-21T22:00:00Z',
      replacementEndAt: '2026-08-22T00:00:00Z',
      media: [{ role: 'hero', url: 'https://cdn.example.test/hero.webp', altText: 'Flowers', displayOrder: 0 }],
    }));

    await component.load('summer-flowers', '2026-08-14');

    expect(seo.setPageMeta).toHaveBeenCalledWith(jasmine.objectContaining({
      url: 'https://blackbegoniaflorals.com/workshops/summer-flowers/2026-08-14',
      type: 'event',
      robots: 'noindex,follow',
    }));
    expect(jsonLd.setWorkshopEvent).toHaveBeenCalledWith(jasmine.objectContaining({
      status: 'rescheduled',
      previousStartDate: '2026-08-14T22:00:00Z',
      startDate: '2026-08-21T22:00:00Z',
      endDate: '2026-08-22T00:00:00Z',
    }));
  });
});
