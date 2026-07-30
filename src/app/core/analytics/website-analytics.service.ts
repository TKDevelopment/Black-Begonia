import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  NavigationStart,
  Router,
} from '@angular/router';
import { BehaviorSubject, filter, Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ANALYTICS_PRODUCTION_ORIGIN,
  AnalyticsAction,
  AnalyticsCampaignContext,
  AnalyticsEventName,
  AnalyticsEventParameters,
  AnalyticsInquiryType,
  AnalyticsOriginContext,
  AnalyticsPageCategory,
  AnalyticsRouteClassification,
  AnalyticsRouteData,
  AnalyticsRuntimeState,
} from './analytics.models';
import { AnalyticsPreferenceService } from './analytics-preference.service';
import { AnalyticsRegionService } from './analytics-region.service';
import { AnalyticsRoutePolicyService } from './analytics-route-policy.service';
import { AnalyticsSanitizerService } from './analytics-sanitizer.service';
import { AnalyticsScrollService } from './analytics-scroll.service';
import { GoogleAnalyticsClientService } from './google-analytics-client.service';

@Injectable({ providedIn: 'root' })
export class WebsiteAnalyticsService {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly preferences = inject(AnalyticsPreferenceService);
  private readonly region = inject(AnalyticsRegionService);
  private readonly routes = inject(AnalyticsRoutePolicyService);
  private readonly sanitizer = inject(AnalyticsSanitizerService);
  private readonly google = inject(GoogleAnalyticsClientService);
  private readonly scroll = inject(AnalyticsScrollService);
  private readonly browser = isPlatformBrowser(this.platformId);
  private subscriptions = new Subscription();
  private initialized = false;
  private decisionGeneration = 0;
  private measuredNavigationId: number | null = null;
  private currentRoute: AnalyticsRouteClassification = {
    eligible: false,
    canonicalPath: null,
    pageCategory: null,
  };
  private previousPage: string | null = null;
  private campaign: AnalyticsCampaignContext = {};

  private readonly stateSubject = new BehaviorSubject<AnalyticsRuntimeState>('inactive');
  readonly state$ = this.stateSubject.asObservable();
  state: AnalyticsRuntimeState = 'inactive';

  init(): void {
    if (!this.browser || this.initialized) {
      return;
    }
    this.initialized = true;
    this.campaign = this.sanitizer.campaignFromUrl(window.location.href);

    this.subscriptions.add(
      this.router.events
        .pipe(filter((event): event is NavigationStart | NavigationEnd =>
          event instanceof NavigationStart || event instanceof NavigationEnd
        ))
        .subscribe((event) => {
          if (event instanceof NavigationStart) {
            if (this.routes.isDefinitelyExcluded(event.url)) {
              this.decisionGeneration += 1;
              this.currentRoute = { eligible: false, canonicalPath: null, pageCategory: null };
              this.setState('disabled');
              this.scroll.stop();
              this.google.disable();
            }
            return;
          }
          void this.handleNavigation(event);
        })
    );

    this.subscriptions.add(
      this.preferences.changes$.subscribe(() => {
        if (this.currentRoute.eligible) {
          void this.evaluatePermission(this.router.lastSuccessfulNavigation?.id ?? -1, true);
        }
      })
    );

    queueMicrotask(() => {
      if (this.measuredNavigationId === null && !this.currentRoute.eligible) {
        void this.handleCurrentUrl();
      }
    });
  }

  destroy(): void {
    this.subscriptions.unsubscribe();
    this.scroll.stop();
    this.google.disable();
    this.initialized = false;
    this.setState('inactive');
  }

  trackInquiryStart(type: AnalyticsInquiryType, origin?: AnalyticsOriginContext): void {
    this.track('inquiry_start', {
      inquiry_type: type,
      ...(origin ? { origin_context: origin } : {}),
    });
  }

  trackConfirmedLead(type: AnalyticsInquiryType, origin?: AnalyticsOriginContext): void {
    this.track('generate_lead', {
      inquiry_type: type,
      ...(origin ? { origin_context: origin } : {}),
      ...this.campaignParameters(),
    });
  }

  trackContent(contentCategory: string, contentId?: string): void {
    this.track('select_content', {
      content_category: contentCategory,
      ...(contentId ? { content_id: contentId } : {}),
    });
  }

  trackAction(action: AnalyticsAction): void {
    this.track(action.event, {
      cta_location: action.location,
      ...(action.category ? { destination_category: action.category } : {}),
      ...(action.platform ? { social_platform: action.platform } : {}),
    });
  }

  trackNotFound(): void {
    this.track('not_found', { page_category: 'not_found' });
  }

  private async handleNavigation(event: NavigationEnd): Promise<void> {
    const data = this.leafAnalyticsData(this.router.routerState.snapshot.root);
    this.currentRoute = this.routes.classify(event.urlAfterRedirects, data);
    this.scroll.stop();

    if (!this.currentRoute.eligible) {
      this.setState('disabled');
      this.google.disable();
      return;
    }

    await this.evaluatePermission(event.id, true);
  }

  private async evaluatePermission(navigationId: number, sendPageView: boolean): Promise<void> {
    const generation = ++this.decisionGeneration;
    if (!this.canAttemptMeasurement()) {
      this.setState('inactive');
      this.google.disable();
      return;
    }

    if (this.preferences.isInternalBrowser() || this.preferences.browserGpcEnabled()) {
      this.setState('disabled');
      this.google.disable();
      return;
    }

    const savedChoice = this.preferences.getChoice();
    if (savedChoice === 'disabled') {
      this.setState('disabled');
      this.google.disable();
      return;
    }

    this.setState('resolving');
    const decision = await this.region.resolve();
    if (generation !== this.decisionGeneration) {
      return;
    }
    if (!decision || !decision.production) {
      this.setState('failed_closed');
      this.google.disable();
      return;
    }
    if (decision.gpc) {
      this.setState('disabled');
      this.google.disable();
      return;
    }

    const permitted = savedChoice === 'enabled' || decision.region === 'us';
    if (!permitted) {
      this.setState('awaiting_opt_in');
      this.google.disable();
      return;
    }

    this.setState('loading');
    const enabled = await this.google.enable(environment.ga4MeasurementId);
    if (generation !== this.decisionGeneration) {
      return;
    }
    if (!enabled) {
      this.setState('failed_closed');
      return;
    }
    this.setState('enabled');

    if (sendPageView && this.measuredNavigationId !== navigationId) {
      this.sendPageView();
      this.measuredNavigationId = navigationId;
    }
    this.scroll.start(() => this.track('scroll', { percent_scrolled: 90 }));
  }

  private track(name: AnalyticsEventName, parameters: AnalyticsEventParameters): void {
    if (this.state !== 'enabled' || !this.currentRoute.eligible) {
      return;
    }
    const sanitized = this.sanitizer.sanitizeEvent(name, {
      page_category: this.currentRoute.pageCategory ?? 'not_found',
      ...parameters,
    });
    if (sanitized) {
      this.google.send(name, sanitized);
    }
  }

  private sendPageView(): void {
    if (!this.currentRoute.canonicalPath || !this.currentRoute.pageCategory) {
      return;
    }
    const location = `${ANALYTICS_PRODUCTION_ORIGIN}${this.currentRoute.canonicalPath}`;
    const parameters: AnalyticsEventParameters = {
      page_location: location,
      page_category: this.currentRoute.pageCategory,
      ...(this.previousPage
        ? { page_referrer: this.previousPage }
        : document.referrer
          ? { page_referrer: document.referrer }
          : {}),
      ...(this.currentRoute.contentCategory
        ? { content_category: this.currentRoute.contentCategory }
        : {}),
      ...(this.currentRoute.contentId ? { content_id: this.currentRoute.contentId } : {}),
      ...this.campaignParameters(),
    };
    const sanitized = this.sanitizer.sanitizeEvent('page_view', parameters);
    if (sanitized) {
      this.google.send('page_view', sanitized);
      this.previousPage = location;
      if (this.currentRoute.pageCategory === 'not_found') {
        this.track('not_found', { page_category: 'not_found' });
      }
    }
  }

  private async handleCurrentUrl(): Promise<void> {
    const data = this.leafAnalyticsData(this.router.routerState.snapshot.root);
    this.currentRoute = this.routes.classify(this.router.url, data);
    if (this.currentRoute.eligible) {
      await this.evaluatePermission(-1, true);
    }
  }

  private campaignParameters(): AnalyticsEventParameters {
    return {
      ...(this.campaign.source ? { campaign_source: this.campaign.source } : {}),
      ...(this.campaign.medium ? { campaign_medium: this.campaign.medium } : {}),
      ...(this.campaign.campaign ? { campaign_name: this.campaign.campaign } : {}),
      ...(this.campaign.content ? { campaign_content: this.campaign.content } : {}),
      ...(this.campaign.term ? { campaign_term: this.campaign.term } : {}),
    };
  }

  private canAttemptMeasurement(): boolean {
    return (
      this.browser &&
      environment.production === true &&
      window.location.origin === ANALYTICS_PRODUCTION_ORIGIN &&
      /^G-[A-Z0-9]+$/i.test(environment.ga4MeasurementId) &&
      this.currentRoute.eligible
    );
  }

  private leafAnalyticsData(snapshot: ActivatedRouteSnapshot): AnalyticsRouteData | null {
    let current: ActivatedRouteSnapshot | null = snapshot;
    let found: AnalyticsRouteData | null = null;
    while (current) {
      const value = current.data?.['analytics'] as AnalyticsRouteData | undefined;
      if (value?.eligible) {
        found = value;
      }
      current = current.firstChild;
    }
    return found;
  }

  private setState(state: AnalyticsRuntimeState): void {
    this.state = state;
    this.stateSubject.next(state);
  }
}
