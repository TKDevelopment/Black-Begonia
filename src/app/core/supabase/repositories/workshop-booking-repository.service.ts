import { Injectable } from '@angular/core';
import {
  CreateWorkshopBookingRequest,
  WorkshopCustomerAction,
  WorkshopCustomerActionResult,
  WorkshopCustomerStatus,
  WorkshopHeldBooking,
  WorkshopPaymentHandoff,
  WorkshopPaymentMethod,
  WorkshopStatusAccessAccepted,
  WorkshopStatusAccessRequest,
} from '../../models/workshop-booking';
import { SupabaseService } from '../clients/supabase.service';

const GENERIC_RECOVERY_RESPONSE: WorkshopStatusAccessAccepted = {
  state: 'accepted',
  message: 'If the details match an eligible booking, a new access link will be sent.',
};

const SAFE_ERROR_CODES = new Set([
  'unavailable',
  'quantity_changed',
  'registration_closed',
  'terms_changed',
  'payment_method_unavailable',
  'rate_limited',
  'invalid_request',
]);

export class WorkshopBookingApiError extends Error {
  constructor(
    readonly code: string,
    message = 'We could not complete that workshop booking request.',
  ) {
    super(message);
    this.name = 'WorkshopBookingApiError';
  }
}

export interface WorkshopBookingRepository {
  createHold(request: CreateWorkshopBookingRequest): Promise<WorkshopHeldBooking>;
  choosePayment(
    bookingToken: string,
    method: WorkshopPaymentMethod,
    commandKey: string,
  ): Promise<WorkshopPaymentHandoff>;
  getStatus(bookingToken: string): Promise<WorkshopCustomerStatus>;
  getStatusByCheckoutSession(checkoutSessionId: string): Promise<WorkshopCustomerStatus>;
  requestStatusAccess(
    request: WorkshopStatusAccessRequest,
  ): Promise<WorkshopStatusAccessAccepted>;
  performCustomerAction(
    action: WorkshopCustomerAction,
    bookingToken: string,
    payload: Record<string, unknown>,
    commandKey: string,
  ): Promise<WorkshopCustomerActionResult>;
}

@Injectable({ providedIn: 'root' })
export class WorkshopBookingRepositoryService implements WorkshopBookingRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async createHold(request: CreateWorkshopBookingRequest): Promise<WorkshopHeldBooking> {
    const body = {
      command: 'create_hold',
      occurrenceSlug: request.occurrenceSlug,
      quantity: request.quantity,
      contact: {
        name: request.contactName.trim(),
        email: request.contactEmail.trim().toLowerCase(),
        phone: request.contactPhone?.trim() || null,
      },
      termsVersion: request.acceptedTermsVersion,
      commandKey: request.commandKey,
    };
    const data = await this.invoke(
      'create-workshop-booking',
      body,
      'We could not reserve those workshop seats.',
    );
    if (!isHeldBooking(data)) {
      throw new WorkshopBookingApiError(
        'invalid_response',
        'We could not reserve those workshop seats.',
      );
    }
    return data;
  }

  async choosePayment(
    bookingToken: string,
    method: WorkshopPaymentMethod,
    commandKey: string,
  ): Promise<WorkshopPaymentHandoff> {
    const data = await this.invoke(
      'create-workshop-booking',
      {
        command: 'choose_payment',
        bookingToken,
        method,
        commandKey,
      },
      'We could not start that payment option.',
    );
    if (!isPaymentHandoff(data)) {
      throw new WorkshopBookingApiError(
        'invalid_response',
        'We could not start that payment option.',
      );
    }
    return data;
  }

  async getStatus(bookingToken: string): Promise<WorkshopCustomerStatus> {
    const data = await this.invoke(
      'manage-workshop-booking-access',
      { command: 'status', bookingToken },
      'We could not open that booking status.',
    );
    if (!isCustomerStatus(data)) {
      throw new WorkshopBookingApiError(
        'invalid_response',
        'We could not open that booking status.',
      );
    }
    return data;
  }

  async getStatusByCheckoutSession(
    checkoutSessionId: string,
  ): Promise<WorkshopCustomerStatus> {
    const data = await this.invoke(
      'manage-workshop-booking-access',
      { command: 'stripe_checkout_status', checkoutSessionId },
      'We could not open that booking confirmation.',
    );
    if (!isCustomerStatus(data)) {
      throw new WorkshopBookingApiError(
        'invalid_response',
        'We could not open that booking confirmation.',
      );
    }
    return data;
  }

  async requestStatusAccess(
    request: WorkshopStatusAccessRequest,
  ): Promise<WorkshopStatusAccessAccepted> {
    await this.invoke(
      'manage-workshop-booking-access',
      {
        command: 'request_status_access',
        email: request.email.trim().toLowerCase(),
        supportReference: request.supportReference.trim().toUpperCase(),
      },
      'We could not submit that access request.',
    );
    return GENERIC_RECOVERY_RESPONSE;
  }

  async performCustomerAction(
    action: WorkshopCustomerAction,
    bookingToken: string,
    payload: Record<string, unknown>,
    commandKey: string,
  ): Promise<WorkshopCustomerActionResult> {
    const data = await this.invoke(
      'manage-workshop-booking-access',
      {
        command: action,
        bookingToken,
        ...payload,
        commandKey,
      },
      'We could not complete that booking action.',
    );
    if (!isCustomerActionResult(data)) {
      throw new WorkshopBookingApiError(
        'invalid_response',
        'We could not complete that booking action.',
      );
    }
    return data;
  }

  private async invoke(
    functionName: string,
    body: Record<string, unknown>,
    fallbackMessage: string,
  ): Promise<unknown> {
    const { data, error } = await this.supabase.getClient().functions.invoke(
      functionName,
      { body },
    );
    if (error) {
      throw await toSafeError(error, fallbackMessage);
    }
    return data;
  }
}

async function toSafeError(error: unknown, fallbackMessage: string): Promise<Error> {
  let code = 'request_failed';
  if (isRecord(error) && isRecord(error['context'])) {
    const json = error['context']['json'];
    if (typeof json === 'function') {
      try {
        const payload = await json.call(error['context']);
        if (
          isRecord(payload)
          && typeof payload['code'] === 'string'
          && SAFE_ERROR_CODES.has(payload['code'])
        ) {
          code = payload['code'];
        }
      } catch {
        // The provider error is intentionally not surfaced or logged.
      }
    }
  }
  return new WorkshopBookingApiError(code, fallbackMessage);
}

function isHeldBooking(value: unknown): value is WorkshopHeldBooking {
  return isRecord(value)
    && value['state'] === 'held'
    && typeof value['bookingToken'] === 'string'
    && typeof value['supportReference'] === 'string'
    && typeof value['quantity'] === 'number'
    && typeof value['priceMinor'] === 'number'
    && typeof value['subtotalMinor'] === 'number'
    && typeof value['taxMinor'] === 'number'
    && typeof value['taxRateBasisPoints'] === 'number'
    && typeof value['taxRegion'] === 'string'
    && typeof value['totalMinor'] === 'number'
    && value['currency'] === 'USD'
    && typeof value['effectiveExpiresAt'] === 'string'
    && Array.isArray(value['methods']);
}

function isPaymentHandoff(value: unknown): value is WorkshopPaymentHandoff {
  if (!isRecord(value)) return false;
  if (value['state'] === 'redirect') {
    return value['method'] === 'stripe'
      && typeof value['url'] === 'string'
      && value['url'].startsWith('https://checkout.stripe.com/')
      && typeof value['effectiveExpiresAt'] === 'string';
  }
  return value['state'] === 'pending_manual_payment'
    && value['method'] === 'direct_venmo'
    && typeof value['approvedTarget'] === 'string'
    && typeof value['amountMinor'] === 'number'
    && value['currency'] === 'USD'
    && typeof value['reference'] === 'string'
    && typeof value['effectiveExpiresAt'] === 'string';
}

function isCustomerStatus(value: unknown): value is WorkshopCustomerStatus {
  if (!isRecord(value) || typeof value['state'] !== 'string') return false;
  if (value['state'] === 'confirmed') {
    const path = value['publicWorkshopPath'];
    const grant = value['analyticsOutcomeGrant'];
    return typeof path === 'string'
      && /^\/workshops\/[a-z0-9]+(?:-[a-z0-9]+)*\/\d{4}-\d{2}-\d{2}$/.test(path)
      && isNonEmptyString(value['workshopTitle'])
      && isIsoDateTime(value['startAt'])
      && isIsoDateTime(value['endAt'])
      && value['timezone'] === 'America/New_York'
      && isNonEmptyString(value['venueName'])
      && isNonEmptyString(value['addressLine1'])
      && (value['addressLine2'] === null
        || typeof value['addressLine2'] === 'string')
      && isNonEmptyString(value['locality'])
      && isNonEmptyString(value['region'])
      && isNonEmptyString(value['postalCode'])
      && Number.isSafeInteger(value['activeQuantity'])
      && Number(value['activeQuantity']) > 0
      && isNonEmptyString(value['termsSnapshot'])
      && (grant === undefined
        || (typeof grant === 'string'
          && grant.length >= 32
          && grant.length <= 256));
  }
  return [
    'processing',
    'pending_venmo',
    'expired',
    'cancelled',
    'refunded',
    'action_required',
    'privacy_verification_pending',
    'proposed_email_pending',
    'proposed_email_confirmed',
    'proposed_email_expired',
    'unavailable',
  ].includes(value['state']);
}

function isCustomerActionResult(value: unknown): value is WorkshopCustomerActionResult {
  return isRecord(value)
    && typeof value['state'] === 'string'
    && (value['activeQuantity'] === undefined
      || typeof value['activeQuantity'] === 'number')
    && (value['refundProcessingState'] === undefined
      || ['not_required', 'pending_review'].includes(
        String(value['refundProcessingState']),
      ))
    && (value['quantity'] === undefined || typeof value['quantity'] === 'number')
    && (value['effectiveExpiresAt'] === undefined
      || typeof value['effectiveExpiresAt'] === 'string')
    && (value['bookingToken'] === undefined
      || typeof value['bookingToken'] === 'string')
    && (value['replayed'] === undefined
      || typeof value['replayed'] === 'boolean')
    && (value['responseId'] === undefined
      || typeof value['responseId'] === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string'
    && !Number.isNaN(Date.parse(value));
}
