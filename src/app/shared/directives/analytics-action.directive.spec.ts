import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WebsiteAnalyticsService } from '../../core/analytics/website-analytics.service';
import { AnalyticsActionDirective } from './analytics-action.directive';

@Component({
  standalone: true,
  imports: [AnalyticsActionDirective],
  template: `
    <a
      href="mailto:private@example.com?subject=private"
      [appAnalyticsAction]="{ event: 'email_click', location: 'footer' }"
    >Private DOM text</a>
  `,
})
class HostComponent {}

describe('AnalyticsActionDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let analytics: jasmine.SpyObj<WebsiteAnalyticsService>;

  beforeEach(async () => {
    analytics = jasmine.createSpyObj('WebsiteAnalyticsService', ['trackAction']);
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: WebsiteAnalyticsService, useValue: analytics }],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('dispatches only the configured typed action and never reads DOM text or href', () => {
    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    anchor.addEventListener('click', (event) => event.preventDefault());
    anchor.click();
    expect(analytics.trackAction).toHaveBeenCalledOnceWith({
      event: 'email_click',
      location: 'footer',
    });
  });
});
