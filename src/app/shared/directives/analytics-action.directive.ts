import { Directive, HostListener, Input, inject } from '@angular/core';
import { AnalyticsAction } from '../../core/analytics/analytics.models';
import { WebsiteAnalyticsService } from '../../core/analytics/website-analytics.service';

@Directive({
  selector: '[appAnalyticsAction]',
  standalone: true,
})
export class AnalyticsActionDirective {
  private readonly analytics = inject(WebsiteAnalyticsService);

  @Input({ required: true }) appAnalyticsAction!: AnalyticsAction;

  @HostListener('click')
  onClick(): void {
    if (this.appAnalyticsAction) {
      this.analytics.trackAction(this.appAnalyticsAction);
    }
  }
}
