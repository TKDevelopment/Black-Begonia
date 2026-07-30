import { TestBed } from '@angular/core/testing';
import {
  ANALYTICS_INTERNAL_BROWSER_STORAGE_KEY,
  ANALYTICS_POLICY_VERSION,
  ANALYTICS_PREFERENCE_STORAGE_KEY,
} from './analytics.models';
import { AnalyticsPreferenceService } from './analytics-preference.service';

describe('AnalyticsPreferenceService', () => {
  let service: AnalyticsPreferenceService;

  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AnalyticsPreferenceService);
  });

  afterEach(() => window.localStorage.clear());

  it('stores explicit choices for twelve months with the current policy version', () => {
    expect(service.setChoice('disabled')).toBeTrue();
    const record = JSON.parse(window.localStorage.getItem(ANALYTICS_PREFERENCE_STORAGE_KEY)!);
    expect(record.policyVersion).toBe(ANALYTICS_POLICY_VERSION);
    expect(service.getChoice()).toBe('disabled');
    const lifetime = Date.parse(record.expiresAt) - Date.parse(record.selectedAt);
    expect(lifetime).toBe(365 * 24 * 60 * 60 * 1000);
  });

  it('invalidates expired, corrupted, and obsolete-policy choices', () => {
    window.localStorage.setItem(ANALYTICS_PREFERENCE_STORAGE_KEY, '{bad');
    expect(service.getChoice()).toBeNull();
    window.localStorage.setItem(
      ANALYTICS_PREFERENCE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        policyVersion: 'old',
        choice: 'enabled',
        selectedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10000).toISOString(),
      })
    );
    expect(service.getChoice()).toBeNull();
  });

  it('sets and reverses a browser-local internal exclusion marker', () => {
    expect(service.setInternalBrowser(true)).toBeTrue();
    expect(service.isInternalBrowser()).toBeTrue();
    expect(service.setInternalBrowser(false)).toBeTrue();
    expect(service.isInternalBrowser()).toBeFalse();
    expect(window.localStorage.getItem(ANALYTICS_INTERNAL_BROWSER_STORAGE_KEY)).toContain(
      '"excluded":false'
    );
  });
});
