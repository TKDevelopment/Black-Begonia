import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  ANALYTICS_INTERNAL_BROWSER_STORAGE_KEY,
  ANALYTICS_POLICY_VERSION,
  ANALYTICS_PREFERENCE_STORAGE_KEY,
  AnalyticsInternalBrowserRecord,
  AnalyticsPreferenceChoice,
  AnalyticsPreferenceRecord,
  NavigatorWithGpc,
} from './analytics.models';

const PREFERENCE_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class AnalyticsPreferenceService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly browser = isPlatformBrowser(this.platformId);
  private readonly changesSubject = new BehaviorSubject<void>(undefined);

  readonly changes$ = this.changesSubject.asObservable();

  getChoice(): AnalyticsPreferenceChoice | null {
    const record = this.readJson<AnalyticsPreferenceRecord>(ANALYTICS_PREFERENCE_STORAGE_KEY);
    if (
      !record ||
      record.schemaVersion !== 1 ||
      record.policyVersion !== ANALYTICS_POLICY_VERSION ||
      (record.choice !== 'enabled' && record.choice !== 'disabled')
    ) {
      return null;
    }

    const expiresAt = Date.parse(record.expiresAt);
    const selectedAt = Date.parse(record.selectedAt);
    if (
      !Number.isFinite(expiresAt) ||
      !Number.isFinite(selectedAt) ||
      expiresAt <= Date.now() ||
      selectedAt > Date.now() + 5 * 60 * 1000
    ) {
      this.remove(ANALYTICS_PREFERENCE_STORAGE_KEY);
      return null;
    }
    return record.choice;
  }

  setChoice(choice: AnalyticsPreferenceChoice): boolean {
    const selectedAt = new Date();
    const record: AnalyticsPreferenceRecord = {
      schemaVersion: 1,
      policyVersion: ANALYTICS_POLICY_VERSION,
      choice,
      selectedAt: selectedAt.toISOString(),
      expiresAt: new Date(selectedAt.getTime() + PREFERENCE_LIFETIME_MS).toISOString(),
    };
    const saved = this.writeJson(ANALYTICS_PREFERENCE_STORAGE_KEY, record);
    this.changesSubject.next();
    return saved;
  }

  isInternalBrowser(): boolean {
    const record = this.readJson<AnalyticsInternalBrowserRecord>(
      ANALYTICS_INTERNAL_BROWSER_STORAGE_KEY
    );
    return record?.schemaVersion === 1 && record.excluded === true;
  }

  setInternalBrowser(excluded: boolean): boolean {
    const record: AnalyticsInternalBrowserRecord = {
      schemaVersion: 1,
      excluded,
      updatedAt: new Date().toISOString(),
    };
    const saved = this.writeJson(ANALYTICS_INTERNAL_BROWSER_STORAGE_KEY, record);
    this.changesSubject.next();
    return saved;
  }

  browserGpcEnabled(): boolean {
    if (!this.browser) {
      return false;
    }
    return (navigator as NavigatorWithGpc).globalPrivacyControl === true;
  }

  private readJson<T>(key: string): T | null {
    if (!this.browser) {
      return null;
    }
    try {
      const value = window.localStorage.getItem(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch {
      return null;
    }
  }

  private writeJson(key: string, value: unknown): boolean {
    if (!this.browser) {
      return false;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return window.localStorage.getItem(key) === JSON.stringify(value);
    } catch {
      // Storage is optional. Runtime policy will fail closed when state cannot persist.
      return false;
    }
  }

  private remove(key: string): void {
    if (!this.browser) {
      return;
    }
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore unavailable storage.
    }
  }
}
