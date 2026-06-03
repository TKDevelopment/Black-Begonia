import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { JsonLdService } from '../../../core/seo/jsonld.service';
import { SeoService } from '../../../core/seo/seo.service';
import { SupabaseService } from '../../../core/supabase/clients/supabase.service';
import { PortfolioDetailComponent } from './portfolio-detail.component';

describe('PortfolioDetailComponent', () => {
  let component: PortfolioDetailComponent;
  let fixture: ComponentFixture<PortfolioDetailComponent>;
  let routeParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let router: jasmine.SpyObj<Router>;
  let supabaseService: jasmine.SpyObj<SupabaseService>;
  let seo: jasmine.SpyObj<SeoService>;
  let jsonLd: jasmine.SpyObj<JsonLdService>;
  let galleryResponse: { data: unknown; error: unknown };
  let imagesResponse: { data: unknown[] | null; error: unknown };
  let consoleErrorSpy: jasmine.Spy;

  beforeEach(async () => {
    routeParams = new BehaviorSubject(convertToParamMap({ slug: 'avery-bloom' }));
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    seo = jasmine.createSpyObj<SeoService>('SeoService', ['setPageMeta']);
    jsonLd = jasmine.createSpyObj<JsonLdService>('JsonLdService', [
      'clearPageSchemas',
      'setLocalBusiness',
      'setWebsite',
      'setBreadcrumbs',
      'setPortfolioGallery',
    ]);

    galleryResponse = {
      data: {
        gallery_id: 'gallery-001',
        slug: 'avery-bloom',
        couple_names: 'Avery & Bloom',
        venue: 'Rose Hall',
        cover_image_url: 'https://example.test/cover.jpg',
        hero_image_url: 'https://example.test/hero.jpg',
        description: 'A spring wedding.',
      },
      error: null,
    };
    imagesResponse = {
      data: [
        {
          image_id: 'image-001',
          gallery_id: 'gallery-001',
          alt_text: null,
          view_order: 1,
          is_visible: true,
          thumb_url: 'https://example.test/thumb.jpg',
          full_url: 'https://example.test/full.jpg',
          created_at: '2026-05-10T00:00:00.000Z',
        },
      ],
      error: null,
    };

    const client = {
      from: jasmine.createSpy('from').and.callFake((table: string) => {
        if (table === 'portfolio_galleries') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => galleryResponse,
              }),
            }),
          };
        }

        if (table === 'portfolio_images') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: async () => imagesResponse,
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    supabaseService = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['getClient']);
    supabaseService.getClient.and.returnValue(client as never);

    await TestBed.configureTestingModule({
      imports: [PortfolioDetailComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: routeParams.asObservable() },
        },
        { provide: Router, useValue: router },
        { provide: SupabaseService, useValue: supabaseService },
        { provide: SeoService, useValue: seo },
        { provide: JsonLdService, useValue: jsonLd },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    })
      .overrideComponent(PortfolioDetailComponent, { set: { template: '' } })
      .compileComponents();

    consoleErrorSpy = spyOn(console, 'error');
    fixture = TestBed.createComponent(PortfolioDetailComponent);
    component = fixture.componentInstance;
  });

  it('navigates back to the portfolio list when no slug is present', fakeAsync(() => {
    routeParams.next(convertToParamMap({}));

    void component.ngOnInit();
    tick();

    expect(router.navigate).toHaveBeenCalledWith(['/portfolio']);
  }));

  it('loads gallery data, maps images, and applies portfolio SEO metadata', async () => {
    await (component as any).loadGallery('avery-bloom');

    expect(component.gallery).toEqual(
      jasmine.objectContaining({
        slug: 'avery-bloom',
        coupleNames: 'Avery & Bloom',
        heroImage: 'https://example.test/hero.jpg',
      })
    );
    expect(component.gallery?.images[0].altText).toBe('Avery & Bloom');
    expect(seo.setPageMeta).toHaveBeenCalled();
    expect(jsonLd.setBreadcrumbs).toHaveBeenCalled();
    expect(jsonLd.setPortfolioGallery).toHaveBeenCalled();
    expect(component.errorMessage).toBe('');
  });

  it('navigates away when the gallery record is missing', async () => {
    galleryResponse = { data: null, error: null };

    await (component as any).loadGallery('missing-gallery');

    expect(router.navigate).toHaveBeenCalledWith(['/portfolio']);
    expect(component.gallery).toBeUndefined();
  });

  it('shows an image-load error when the gallery images request fails', async () => {
    const error = new Error('images failed');
    imagesResponse = { data: null, error };

    await (component as any).loadGallery('avery-bloom');

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching gallery images:', error);
    expect(component.errorMessage).toBe('Failed to load gallery images.');
  });

  it('shows a fallback error when gallery loading throws unexpectedly', async () => {
    galleryResponse = {
      get data() {
        throw new Error('unexpected load failure');
      },
      error: null,
    } as never;

    await (component as any).loadGallery('avery-bloom');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Unexpected gallery load error:',
      jasmine.any(Error)
    );
    expect(component.errorMessage).toBe('Failed to load gallery.');
  });

  it('opens and closes the desktop image modal and clears it on resize/escape', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
    component['isDesktop'] = true;

    const image = {
      imageId: 'image-001',
      thumbUrl: 'https://example.test/thumb.jpg',
      fullUrl: 'https://example.test/full.jpg',
      altText: 'Avery & Bloom',
      viewOrder: 1,
    };

    component.openImageModal(image);
    expect(component.selectedImage).toEqual(image);
    expect(document.body.style.overflow).toBe('hidden');

    component.onEscapeKey();
    expect(component.selectedImage).toBeNull();
    expect(document.body.style.overflow).toBe('');

    component.selectedImage = image;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 640 });
    component.onResize();
    expect(component.selectedImage).toBeNull();
  });
});
