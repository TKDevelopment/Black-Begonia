import { Injectable } from '@angular/core';

export type WorkshopSafeErrorCode =
  | 'invalid_request'
  | 'not_found'
  | 'registration_closed'
  | 'insufficient_capacity'
  | 'payment_unavailable'
  | 'payment_pending'
  | 'rate_limited'
  | 'access_expired'
  | 'conflict'
  | 'temporarily_unavailable';

export interface WorkshopSafeError {
  code: WorkshopSafeErrorCode;
  message: string;
  retryable: boolean;
}

const SAFE_ERRORS: Record<WorkshopSafeErrorCode, WorkshopSafeError> = {
  invalid_request: { code: 'invalid_request', message: 'Please review the workshop details and try again.', retryable: false },
  not_found: { code: 'not_found', message: 'This workshop could not be found.', retryable: false },
  registration_closed: { code: 'registration_closed', message: 'Registration is no longer available for this workshop.', retryable: false },
  insufficient_capacity: { code: 'insufficient_capacity', message: 'The requested seats are no longer available.', retryable: false },
  payment_unavailable: { code: 'payment_unavailable', message: 'That payment option is currently unavailable.', retryable: true },
  payment_pending: { code: 'payment_pending', message: 'Your payment is still being confirmed.', retryable: true },
  rate_limited: { code: 'rate_limited', message: 'Please wait a moment before trying again.', retryable: true },
  access_expired: { code: 'access_expired', message: 'This secure access link has expired.', retryable: false },
  conflict: { code: 'conflict', message: 'This workshop was updated. Refresh and try again.', retryable: true },
  temporarily_unavailable: { code: 'temporarily_unavailable', message: 'Workshop booking is temporarily unavailable.', retryable: true },
};

@Injectable({ providedIn: 'root' })
export class WorkshopValidationService {
  readonly bounds = {
    title: 160,
    advertisingLine: 240,
    description: 10_000,
    terms: 20_000,
    contactName: 160,
    contactEmail: 320,
    contactPhone: 40,
    galleryImages: 8,
    bookingQuantity: 20,
    capacity: 10_000,
    priceMinor: 100_000_000,
  } as const;

  toSafeError(value: unknown): WorkshopSafeError {
    const code = this.extractCode(value);
    return SAFE_ERRORS[code] ?? SAFE_ERRORS.temporarily_unavailable;
  }

  normalizeCurrency(value: string): 'USD' {
    if (value.trim().toUpperCase() !== 'USD') {
      throw new Error('invalid_currency');
    }
    return 'USD';
  }

  normalizeMinorUnits(value: number): number {
    if (!Number.isSafeInteger(value) || value < 0 || value > this.bounds.priceMinor) {
      throw new Error('invalid_minor_units');
    }
    return value;
  }

  normalizeIsoDate(value: string): string {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) {
      throw new Error('invalid_date');
    }
    return date.toISOString();
  }

  boundedText(value: string, field: keyof Pick<typeof this.bounds, 'title' | 'advertisingLine' | 'description' | 'terms' | 'contactName' | 'contactEmail' | 'contactPhone'>): string {
    const normalized = value.trim();
    if (!normalized || normalized.length > this.bounds[field]) {
      throw new Error(`invalid_${field}`);
    }
    return normalized;
  }

  boundedInteger(value: number, minimum: number, maximum: number): number {
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
      throw new Error('invalid_integer');
    }
    return value;
  }

  redactTokens(value: string): string {
    return value
      .replace(/([?&](?:token|access_token|status_token|code)=)[^&#\s]+/gi, '$1[REDACTED]')
      .replace(/\b(?:sk|pk|whsec)_(?:live|test)_[A-Za-z0-9_-]+\b/g, '[REDACTED]')
      .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*\b/gi, 'Bearer [REDACTED]');
  }

  private extractCode(value: unknown): WorkshopSafeErrorCode {
    if (typeof value === 'string' && value in SAFE_ERRORS) {
      return value as WorkshopSafeErrorCode;
    }
    if (value && typeof value === 'object' && 'code' in value) {
      const code = String((value as { code: unknown }).code);
      if (code in SAFE_ERRORS) {
        return code as WorkshopSafeErrorCode;
      }
    }
    return 'temporarily_unavailable';
  }
}
