import { DOCUMENT } from '@angular/common';
import { DefaultUrlSerializer, NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { JsonLdService } from './jsonld.service';
import { SeoRouteListenerService } from './seo-route-listener.service';
import { SeoService } from './seo.service';

describe('SeoRouteListenerService', () => {
  it('cleans schemas, applies static routes, and leaves dynamic workshop metadata to the component', () => {
    const events = new Subject<NavigationEnd>();
    const serializer = new DefaultUrlSerializer();
    const router = {
      events,
      parseUrl: (url: string) => serializer.parse(url),
    } as unknown as Router;
    const seo = jasmine.createSpyObj<SeoService>('SeoService', ['setPageMeta']);
    const jsonLd = jasmine.createSpyObj<JsonLdService>('JsonLdService', ['clearPageSchemas']);
    const service = new SeoRouteListenerService(router, seo, jsonLd, document);
    service.init();

    events.next(new NavigationEnd(1, '/about', '/about'));
    expect(seo.setPageMeta).toHaveBeenCalled();
    expect(jsonLd.clearPageSchemas).toHaveBeenCalled();

    seo.setPageMeta.calls.reset();
    events.next(new NavigationEnd(2, '/workshops/summer?ref=home', '/workshops/summer?ref=home'));
    expect(seo.setPageMeta).not.toHaveBeenCalled();
    expect(jsonLd.clearPageSchemas).toHaveBeenCalledTimes(2);
  });
});
