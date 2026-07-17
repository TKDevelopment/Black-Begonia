import { fakeAsync, tick } from '@angular/core/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';

import { SupabaseService } from '../../../core/supabase/clients/supabase.service';
import { PortfolioComponent } from './portfolio.component';

describe('PortfolioComponent', () => {
  let component: PortfolioComponent;
  let fixture: ComponentFixture<PortfolioComponent>;
  let supabaseService: jasmine.SpyObj<SupabaseService>;
  let router: jasmine.SpyObj<Router>;
  let galleriesResponse: { data: unknown[] | null; error: unknown };
  let consoleErrorSpy: jasmine.Spy;

  beforeEach(async () => {
    galleriesResponse = {
      data: [
        {
          gallery_id: 'gallery-001',
          slug: 'avery-bloom',
          couple_names: 'Avery & Bloom',
          venue: 'Rose Hall',
          event_date: '2026-05-01',
          cover_image_url: 'https://example.test/cover-1.jpg',
          hero_image_url: 'https://example.test/hero-1.jpg',
          description: 'A spring wedding.',
          is_featured: true,
          is_active: true,
          created_at: '2026-05-10T00:00:00.000Z',
        },
        {
          gallery_id: 'gallery-002',
          slug: 'jules-ivy',
          couple_names: 'Jules & Ivy',
          venue: 'Harbor View',
          event_date: null,
          cover_image_url: 'https://example.test/cover-2.jpg',
          hero_image_url: null,
          description: null,
          is_featured: false,
          is_active: true,
          created_at: '2026-05-11T00:00:00.000Z',
        },
      ],
      error: null,
    };

    const portfolioQuery = {
      select: jasmine.createSpy('select').and.returnValue({
        eq: jasmine.createSpy('eq').and.returnValue({
          order: jasmine.createSpy('order').and.callFake(async () => galleriesResponse),
        }),
      }),
    };
    const client = {
      from: jasmine.createSpy('from').and.returnValue(portfolioQuery),
    };

    supabaseService = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['getClient']);
    supabaseService.getClient.and.returnValue(client as never);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [PortfolioComponent],
      providers: [
        { provide: SupabaseService, useValue: supabaseService },
        { provide: Router, useValue: router },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    })
      .overrideComponent(PortfolioComponent, { set: { template: '' } })
      .compileComponents();

    consoleErrorSpy = spyOn(console, 'error');
    fixture = TestBed.createComponent(PortfolioComponent);
    component = fixture.componentInstance;
  });

  it('loads galleries, featured hero media, and derived chunk/display state', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });

    await component.ngOnInit();

    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toBe('');
    expect(component.galleries.length).toBe(2);
    expect(component.heroImage).toBe('https://example.test/hero-1.jpg');
    expect(component.galleries[0]).toEqual(
      jasmine.objectContaining({
        galleryId: 'gallery-001',
        position: 'right',
      })
    );
    expect(component.galleryChunks.length).toBe(1);
    expect(component.getDisplayPosition(component.galleries[0])).toBe('right');
  });

  it('handles empty gallery responses and mobile display fallback', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 480 });
    galleriesResponse = { data: [], error: null };

    await component.ngOnInit();

    expect(component.loading).toBeFalse();
    expect(component.galleries).toEqual([]);
    expect(component.galleryChunks).toEqual([]);
    expect(component.isMobileOrSmall).toBeTrue();
  });

  it('surfaces gallery-load failures', async () => {
    const error = new Error('gallery load failed');
    galleriesResponse = { data: null, error };

    await component.ngOnInit();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error loading portfolio galleries:',
      error
    );
    expect(component.errorMessage).toBe('Unable to load portfolio galleries right now.');
    expect(component.loading).toBeFalse();
  });

  it('navigates to a gallery slug once and ignores repeated clicks while pending', fakeAsync(() => {
    component.onGalleryClick('avery-bloom');
    component.onGalleryClick('second-click');

    expect(component.navigatingSlug).toBe('avery-bloom');
    expect(router.navigate).not.toHaveBeenCalled();

    tick(2000);
    expect(router.navigate).toHaveBeenCalledWith(['/portfolio', 'avery-bloom']);
  }));

  it('updates mobile state on resize and tracks gallery ids', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
    await component.ngOnInit();

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 640 });
    component.onResize();

    expect(component.isMobileOrSmall).toBeTrue();
    expect(component.trackByGallery(0, component.galleries[0])).toBe('gallery-001');
  });
});
