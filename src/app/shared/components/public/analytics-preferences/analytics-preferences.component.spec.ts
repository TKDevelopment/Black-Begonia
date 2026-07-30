import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { AnalyticsPreferenceService } from '../../../../core/analytics/analytics-preference.service';
import { AnalyticsRuntimeState } from '../../../../core/analytics/analytics.models';
import { WebsiteAnalyticsService } from '../../../../core/analytics/website-analytics.service';
import { AnalyticsPreferencesComponent } from './analytics-preferences.component';

describe('AnalyticsPreferencesComponent', () => {
  let fixture: ComponentFixture<AnalyticsPreferencesComponent>;
  let component: AnalyticsPreferencesComponent;
  let state: BehaviorSubject<AnalyticsRuntimeState>;
  let changes: Subject<void>;
  let preference: jasmine.SpyObj<AnalyticsPreferenceService>;

  beforeEach(async () => {
    state = new BehaviorSubject<AnalyticsRuntimeState>('awaiting_opt_in');
    changes = new Subject<void>();
    preference = jasmine.createSpyObj<AnalyticsPreferenceService>(
      'AnalyticsPreferenceService',
      ['getChoice', 'isInternalBrowser', 'browserGpcEnabled', 'setChoice', 'setInternalBrowser'],
      { changes$: changes.asObservable() }
    );
    preference.getChoice.and.returnValue(null);
    preference.isInternalBrowser.and.returnValue(false);
    preference.browserGpcEnabled.and.returnValue(false);
    preference.setChoice.and.returnValue(true);
    preference.setInternalBrowser.and.returnValue(true);

    await TestBed.configureTestingModule({
      imports: [AnalyticsPreferencesComponent],
      providers: [
        provideRouter([]),
        { provide: AnalyticsPreferenceService, useValue: preference },
        {
          provide: WebsiteAnalyticsService,
          useValue: { state: 'awaiting_opt_in', state$: state.asObservable() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticsPreferencesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('offers a balanced opt-in prompt without blocking public content', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Analytics is off');
    expect(text).toContain('Enable analytics');
    expect(text).toContain('Keep analytics off');
  });

  it('persists enable, disable, and reversible internal-browser choices', () => {
    component.enable();
    component.disable();
    component.setInternalBrowser(true);
    component.setInternalBrowser(false);
    expect(preference.setChoice).toHaveBeenCalledWith('enabled');
    expect(preference.setChoice).toHaveBeenCalledWith('disabled');
    expect(preference.setInternalBrowser).toHaveBeenCalledWith(true);
    expect(preference.setInternalBrowser).toHaveBeenCalledWith(false);
  });

  it('explains GPC and keeps the dialog keyboard-addressable', () => {
    preference.browserGpcEnabled.and.returnValue(true);
    fixture = TestBed.createComponent(AnalyticsPreferencesComponent);
    component = fixture.componentInstance;
    component.open = true;
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain('Global Privacy Control');
    expect(dialog.getAttribute('tabindex')).toBe('-1');
  });

  it('links to the privacy policy and uses a centered icon for the close action', () => {
    component.open = true;
    fixture.detectChanges();

    const privacyPolicyLink = fixture.nativeElement.querySelector(
      'a[href="/privacy-policy"]'
    ) as HTMLAnchorElement;
    const closeButton = fixture.nativeElement.querySelector(
      '.close-button'
    ) as HTMLButtonElement;

    expect(privacyPolicyLink.textContent?.trim()).toBe('Privacy Policy');
    expect(closeButton.querySelector('svg.close-icon')).toBeTruthy();
    expect(closeButton.textContent?.trim()).toBe('');
  });
});
