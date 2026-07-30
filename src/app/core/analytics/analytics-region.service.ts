import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { AnalyticsRegionDecision } from './analytics.models';

@Injectable({ providedIn: 'root' })
export class AnalyticsRegionService {
  private readonly http = inject(HttpClient, { optional: true });

  async resolve(): Promise<AnalyticsRegionDecision | null> {
    if (!this.http) {
      return null;
    }
    try {
      const response = await firstValueFrom(
        this.http
          .get<unknown>('/api/analytics-region')
          .pipe(timeout({ first: 2500 }))
      );
      return this.parse(response);
    } catch {
      return null;
    }
  }

  private parse(value: unknown): AnalyticsRegionDecision | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const candidate = value as Partial<AnalyticsRegionDecision>;
    if (
      !['us', 'non_us', 'unknown'].includes(candidate.region ?? '') ||
      typeof candidate.gpc !== 'boolean' ||
      typeof candidate.production !== 'boolean'
    ) {
      return null;
    }
    return {
      region: candidate.region as AnalyticsRegionDecision['region'],
      gpc: candidate.gpc,
      production: candidate.production,
    };
  }
}
