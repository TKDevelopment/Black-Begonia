import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { WebsiteAnalyticsService } from '../../../core/analytics/website-analytics.service';
import { WorkshopPublicRepositoryService } from '../../../core/supabase/repositories/workshop-public-repository.service';
import { publicWorkshopSummaryFixture } from '../../../core/testing/workshop-testing';
import { WorkshopsComponent } from './workshops.component';

describe('Public WorkshopsComponent', () => {
  let component: WorkshopsComponent;
  let fixture: ComponentFixture<WorkshopsComponent>;
  let repository: jasmine.SpyObj<WorkshopPublicRepositoryService>;
  let analytics: jasmine.SpyObj<WebsiteAnalyticsService>;

  beforeEach(async () => {
    repository = jasmine.createSpyObj('WorkshopPublicRepositoryService', ['listUpcoming']);
    analytics = jasmine.createSpyObj('WebsiteAnalyticsService', [
      'trackAction',
      'trackWorkshopSelection',
    ]);
    repository.listUpcoming.and.resolveTo([
      publicWorkshopSummaryFixture({
        slug: 'later',
        seriesSlug: 'series-a',
        workshopDate: '2026-10-01',
        startAt: '2026-10-01T17:00:00Z',
        featuredOrder: 2,
      }),
      publicWorkshopSummaryFixture({
        slug: 'earlier',
        seriesSlug: 'series-a',
        workshopDate: '2026-09-01',
        startAt: '2026-09-01T17:00:00Z',
        featuredOrder: 1,
        remainingSeats: 2,
      }),
      publicWorkshopSummaryFixture({
        slug: 'second-series',
        seriesSlug: 'series-b',
        workshopDate: '2026-11-01',
        startAt: '2026-11-01T17:00:00Z',
        featuredOrder: 3,
      }),
    ]);
    await TestBed.configureTestingModule({
      imports: [WorkshopsComponent],
      providers: [
        provideRouter([]),
        { provide: WorkshopPublicRepositoryService, useValue: repository },
        {
          provide: WebsiteAnalyticsService,
          useValue: analytics,
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WorkshopsComponent);
    component = fixture.componentInstance;
  });

  it('renders a manually controlled featured carousel and chronological vertical list', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.workshops().map((item) => item.slug)).toEqual(['earlier', 'later', 'second-series']);
    expect(component.featured().map((item) => item.seriesSlug)).toEqual(['series-a', 'series-b']);
    expect(component.activeFeatured()?.slug).toBe('earlier');
    expect(fixture.nativeElement.querySelector('.featured-count').textContent.trim())
      .toBe('2 upcoming events');
    component.nextFeatured();
    expect(component.activeFeatured()?.slug).toBe('second-series');
    expect(fixture.nativeElement.querySelectorAll('.workshop-row').length).toBe(3);
    expect(fixture.nativeElement.querySelector('.carousel-controls')).not.toBeNull();
    const featured = fixture.nativeElement.querySelector('.featured');
    const featuredCopy = fixture.nativeElement.querySelector('.featured-copy');
    const featuredImageFrame = fixture.nativeElement.querySelector('.featured-image');
    const featuredImage = featuredImageFrame.querySelector('img');
    const featuredFrameStyle = getComputedStyle(featuredImageFrame);
    const featuredInset = Number.parseFloat(featuredFrameStyle.paddingTop);
    expect(getComputedStyle(featured).alignItems).toBe('stretch');
    expect(getComputedStyle(featuredCopy).alignSelf).toBe('stretch');
    expect(getComputedStyle(featuredImage).aspectRatio).toBe('16 / 9');
    expect(featuredInset).toBeGreaterThan(0);
    expect(Number.parseFloat(featuredFrameStyle.paddingLeft)).toBe(featuredInset);
    if (window.matchMedia('(max-width: 850px)').matches) {
      expect(getComputedStyle(featuredCopy).overflowY).toBe('visible');
      expect(Number.parseFloat(featuredFrameStyle.paddingBottom)).toBe(0);
    } else {
      expect(getComputedStyle(featuredCopy).overflowY).toBe('auto');
      expect(getComputedStyle(featuredImage).height).toBe('100%');
      expect(Number.parseFloat(featuredFrameStyle.paddingBottom)).toBe(featuredInset);
    }
    const rowCopy = fixture.nativeElement.querySelector('.workshop-copy');
    const rowTitle = rowCopy.querySelector('h3') as HTMLElement;
    expect(getComputedStyle(rowCopy).minWidth).toBe('0px');
    expect(getComputedStyle(rowTitle).wordBreak).toBe('normal');
    expect(getComputedStyle(
      fixture.nativeElement.querySelector('.workshop-row > img'),
    ).aspectRatio).toBe('16 / 9');
    expect(fixture.nativeElement.querySelector('calendar')).toBeNull();
    expect(fixture.nativeElement.textContent.toLowerCase()).not.toContain('calendar');
    expect(fixture.nativeElement.querySelector('main').getAttribute('aria-busy')).toBe('false');

    component.trackSelection(component.activeFeatured()!, 'carousel');
    component.trackSelection(component.workshops()[0], 'list');
    expect(analytics.trackWorkshopSelection.calls.allArgs()).toEqual([
      ['carousel', 'second-series'],
      ['list', 'earlier'],
    ]);
  });

  it('keeps the original hero and introduction without the removed upcoming intro', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const hero = fixture.nativeElement.querySelector('main > header');
    const introduction = fixture.nativeElement.querySelector('[aria-labelledby="workshops-introduction"]');
    const featured = fixture.nativeElement.querySelector('.featured');
    expect(hero.querySelector('h1').textContent.trim()).toBe('WORKSHOPS');
    expect(hero.querySelector('img').getAttribute('src')).toContain('FizzFritesLadyFingerLounge_Apr3_KCP208.jpg');
    expect(introduction.textContent).toContain('WORKSHOPS DESIGNED TO');
    expect(introduction.textContent).toContain('gather,\u00a0 create,\u00a0 celebrate');
    expect(introduction.textContent).toContain('From festive holiday centerpieces');
    expect(fixture.nativeElement.textContent).not.toContain('Gather, create, and flower');
    expect(fixture.nativeElement.textContent).not.toContain('Upcoming floral workshops');
    expect(introduction.compareDocumentPosition(featured) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('preserves separators, lazy list imagery, and the private inquiry CTA', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.workshop-row');
    expect(rows[0].querySelector('img').getAttribute('loading')).toBe('lazy');
    expect(rows[1].classList).toContain('workshop-row');
    expect(rows[0].querySelector('.workshop-copy a').getAttribute('href'))
      .toBe('/workshops/series-a/2026-09-01');
    const detailAction = rows[0].querySelector('.details-button') as HTMLAnchorElement;
    expect(detailAction.textContent?.trim()).toContain('See Details');
    expect(detailAction.getAttribute('href'))
      .toBe('/workshops/series-a/2026-09-01');
    expect(detailAction.querySelector('[aria-hidden="true"]')).not.toBeNull();
    const inquiry = fixture.nativeElement.querySelector('.private-inquiry a');
    expect(inquiry.getAttribute('href')).toBe('/inquiries/general');
    expect(fixture.nativeElement.querySelector('.private-inquiry__ornament')).not.toBeNull();
  });

  it('shows the bounded remaining-seat prompt on discovery cards', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const prompts = fixture.nativeElement.querySelectorAll('.seat-urgency');
    expect(prompts.length).toBe(2);
    expect(prompts[0].textContent).toContain('Only 2 seats remaining');
  });

  it('shows a useful empty state while retaining the inquiry path', async () => {
    repository.listUpcoming.and.resolveTo([]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No public workshop dates');
    expect(fixture.nativeElement.querySelector('.private-inquiry a')).not.toBeNull();
  });

  it('exposes loading and recoverable failure states', async () => {
    let reject!: (reason?: unknown) => void;
    repository.listUpcoming.and.returnValue(new Promise((_, rejectPromise) => {
      reject = rejectPromise;
    }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Gathering the upcoming dates');

    spyOn(console, 'error');
    reject(new Error('offline'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('temporarily unavailable');
    expect(fixture.nativeElement.querySelector('.outline-button')).not.toBeNull();
  });
});
