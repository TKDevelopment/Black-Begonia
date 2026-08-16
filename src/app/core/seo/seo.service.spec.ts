import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  let service: SeoService;
  let document: Document;
  let meta: Meta;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SeoService);
    document = TestBed.inject(DOCUMENT);
    meta = TestBed.inject(Meta);
  });

  afterEach(() => {
    document.querySelector("link[rel='canonical']")?.remove();
    ['description', 'robots', 'keywords', 'twitter:title'].forEach((name) => meta.removeTag(`name='${name}'`));
    ['og:title', 'og:description', 'og:type', 'og:url', 'og:image', 'og:site_name']
      .forEach((property) => meta.removeTag(`property='${property}'`));
  });

  it('sets dynamic title, canonical, social, keywords, and robots metadata', () => {
    service.setPageMeta({
      title: 'Summer Flowers',
      description: 'A seasonal workshop.',
      url: 'https://blackbegoniaflorals.com/workshops/summer',
      image: 'https://cdn.example.test/summer.webp',
      type: 'event',
      keywords: ['flowers', 'workshop'],
      robots: 'noindex,follow',
    });
    expect(TestBed.inject(Title).getTitle()).toBe('Summer Flowers');
    expect(document.querySelector("link[rel='canonical']")?.getAttribute('href'))
      .toBe('https://blackbegoniaflorals.com/workshops/summer');
    expect(meta.getTag("property='og:type'")?.content).toBe('event');
    expect(meta.getTag("name='robots'")?.content).toBe('noindex,follow');
    expect(meta.getTag("name='keywords'")?.content).toBe('flowers, workshop');
  });

  it('removes stale keywords and restores index robots on the next page', () => {
    service.setPageMeta({ keywords: ['stale'], robots: 'noindex,follow' });
    service.setPageMeta({ title: 'Next page', keywords: [] });
    expect(meta.getTag("name='keywords'")).toBeNull();
    expect(meta.getTag("name='robots'")?.content).toBe('index,follow,max-image-preview:large');
  });
});
