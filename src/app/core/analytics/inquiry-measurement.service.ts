import { Injectable, inject } from '@angular/core';
import {
  AnalyticsInquiryType,
  AnalyticsOriginContext,
} from './analytics.models';
import { WebsiteAnalyticsService } from './website-analytics.service';

@Injectable()
export class InquiryMeasurementService {
  private readonly analytics = inject(WebsiteAnalyticsService);
  private started = false;
  private confirmed = false;

  start(type: AnalyticsInquiryType, origin?: AnalyticsOriginContext): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.analytics.trackInquiryStart(type, origin);
  }

  confirm(type: AnalyticsInquiryType, origin?: AnalyticsOriginContext): void {
    if (this.confirmed) {
      return;
    }
    this.confirmed = true;
    this.analytics.trackConfirmedLead(type, origin);
  }

  reset(): void {
    this.started = false;
    this.confirmed = false;
  }
}
