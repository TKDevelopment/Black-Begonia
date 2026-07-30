import { Injectable } from '@angular/core';
import {
  AnalyticsPageCategory,
  AnalyticsRouteClassification,
  AnalyticsRouteData,
} from './analytics.models';

const STATIC_PUBLIC_ROUTES = new Map<string, AnalyticsPageCategory>([
  ['/', 'home'],
  ['/about', 'about'],
  ['/portfolio', 'portfolio'],
  ['/locations', 'locations'],
  ['/inquiries', 'inquiry'],
  ['/inquiries/success', 'inquiry_success'],
  ['/inquiries/general', 'inquiry'],
  ['/inquiries/weddings', 'inquiry'],
  ['/services/weddings', 'service'],
  ['/services/general', 'service'],
  ['/workshops', 'workshop'],
  ['/testimonials', 'testimonials'],
  ['/privacy-policy', 'privacy'],
  ['/terms-and-conditions', 'terms'],
]);

const APPROVED_LOCATION_SLUGS = new Set([
  'newport-ri-wedding-florist',
  'watch-hill-ri-wedding-florist',
  'providence-ri-wedding-florist',
  'bristol-ri-wedding-florist',
  'south-kingstown-ri-wedding-florist',
  'narragansett-ri-wedding-florist',
  'westerly-ri-wedding-florist',
  'north-kingstown-ri-florist',
  'mystic-ct-wedding-florist',
  'stonington-ct-wedding-florist',
  'boston-ma-wedding-florist',
]);

// Portfolio slugs remain generic until each production value receives a PII audit.
const APPROVED_PORTFOLIO_ANALYTICS_SLUGS = new Set<string>();

@Injectable({ providedIn: 'root' })
export class AnalyticsRoutePolicyService {
  classify(url: string, routeData?: AnalyticsRouteData | null): AnalyticsRouteClassification {
    const path = this.normalizedPath(url);

    if (this.isDefinitelyExcluded(path) || !routeData?.eligible) {
      return { eligible: false, canonicalPath: null, pageCategory: null };
    }

    if (routeData.pageCategory === 'not_found') {
      return {
        eligible: true,
        canonicalPath: '/not-found',
        pageCategory: 'not_found',
      };
    }

    const staticCategory = STATIC_PUBLIC_ROUTES.get(path);
    if (staticCategory && staticCategory === routeData.pageCategory) {
      return { eligible: true, canonicalPath: path, pageCategory: staticCategory };
    }

    const locationMatch = path.match(/^\/locations\/([a-z0-9-]+)$/);
    if (
      locationMatch &&
      routeData.pageCategory === 'location_detail' &&
      APPROVED_LOCATION_SLUGS.has(locationMatch[1])
    ) {
      return {
        eligible: true,
        canonicalPath: `/locations/${locationMatch[1]}`,
        pageCategory: 'location_detail',
        contentCategory: 'location',
        contentId: locationMatch[1],
      };
    }

    const portfolioMatch = path.match(/^\/portfolio\/([a-z0-9-]+)$/);
    if (portfolioMatch && routeData.pageCategory === 'portfolio_detail') {
      const contentId = APPROVED_PORTFOLIO_ANALYTICS_SLUGS.has(portfolioMatch[1])
        ? portfolioMatch[1]
        : undefined;
      return {
        eligible: true,
        canonicalPath: '/portfolio/detail',
        pageCategory: 'portfolio_detail',
        contentCategory: 'portfolio',
        ...(contentId ? { contentId } : {}),
      };
    }

    return { eligible: false, canonicalPath: null, pageCategory: null };
  }

  isDefinitelyExcluded(url: string): boolean {
    const path = this.normalizedPath(url);
    return (
      path === '/login' ||
      path === '/password-recovery' ||
      path === '/change-password' ||
      path === '/pay' ||
      path.startsWith('/pay/') ||
      path === '/admin' ||
      path.startsWith('/admin/')
    );
  }

  normalizedPath(url: string): string {
    const withoutQuery = url.split(/[?#]/, 1)[0] || '/';
    const withLeadingSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
    if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')) {
      return withLeadingSlash.slice(0, -1);
    }
    return withLeadingSlash;
  }
}
