import { Injectable } from '@angular/core';
import { SafeWorkshopAnalyticsOutcome } from '../../analytics/analytics.models';
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
import {
  WorkshopBookingRepositoryService,
} from '../repositories/workshop-booking-repository.service';
import { SupabaseService } from '../clients/supabase.service';

export const WORKSHOP_ANALYTICS_OUTCOME_SESSION_KEY =
  'bb.workshop.pendingAnalyticsOutcome';

export interface StartWorkshopReservationRequest
  extends Omit<CreateWorkshopBookingRequest, 'commandKey'> {
  paymentMethod: WorkshopPaymentMethod;
}

export interface StartedWorkshopReservation {
  held: WorkshopHeldBooking;
  handoff: WorkshopPaymentHandoff;
}

@Injectable({ providedIn: 'root' })
export class WorkshopBookingService {
  private activeBookingToken: string | null = null;

  constructor(
    private readonly repository: WorkshopBookingRepositoryService,
    private readonly supabase: SupabaseService,
  ) {}

  async startReservation(
    request: StartWorkshopReservationRequest,
  ): Promise<StartedWorkshopReservation> {
    const held = await this.repository.createHold({
      occurrenceSlug: request.occurrenceSlug,
      quantity: request.quantity,
      contactName: request.contactName,
      contactEmail: request.contactEmail,
      contactPhone: request.contactPhone,
      acceptedTermsVersion: request.acceptedTermsVersion,
      commandKey: crypto.randomUUID(),
    });
    this.activeBookingToken = held.bookingToken;

    const handoff = await this.repository.choosePayment(
      held.bookingToken,
      request.paymentMethod,
      crypto.randomUUID(),
    );
    return { held, handoff };
  }

  async switchPaymentMethod(
    method: WorkshopPaymentMethod,
  ): Promise<WorkshopPaymentHandoff> {
    return this.repository.choosePayment(
      this.requireActiveToken(),
      method,
      crypto.randomUUID(),
    );
  }

  async getStatus(bookingToken?: string): Promise<WorkshopCustomerStatus> {
    const token = bookingToken || this.requireActiveToken();
    const status = await this.repository.getStatus(token);
    if (status.state === 'confirmed' && status.analyticsOutcomeGrant) {
      this.storePendingAnalyticsOutcome(status.analyticsOutcomeGrant);
    }
    if (isTerminalStatus(status.state)) {
      this.activeBookingToken = null;
    }
    return status;
  }

  async getStatusByCheckoutSession(
    checkoutSessionId: string,
  ): Promise<WorkshopCustomerStatus> {
    const status = await this.repository.getStatusByCheckoutSession(
      checkoutSessionId,
    );
    if (status.state === 'confirmed' && status.analyticsOutcomeGrant) {
      this.storePendingAnalyticsOutcome(status.analyticsOutcomeGrant);
    }
    return status;
  }

  requestStatusAccess(
    request: WorkshopStatusAccessRequest,
  ): Promise<WorkshopStatusAccessAccepted> {
    return this.repository.requestStatusAccess(request);
  }

  async performCustomerAction(
    action: WorkshopCustomerAction,
    payload: Record<string, unknown>,
    accessToken?: string,
  ): Promise<WorkshopCustomerActionResult> {
    const result = await this.repository.performCustomerAction(
      action,
      accessToken || this.requireActiveToken(),
      payload,
      crypto.randomUUID(),
    );
    if (result.bookingToken) this.activeBookingToken = result.bookingToken;
    if (result.state === 'cancelled') this.activeBookingToken = null;
    return result;
  }

  takePendingAnalyticsOutcome(): string | null {
    const storage = getSessionStorage();
    if (!storage) return null;
    const grant = storage.getItem(WORKSHOP_ANALYTICS_OUTCOME_SESSION_KEY);
    storage.removeItem(WORKSHOP_ANALYTICS_OUTCOME_SESSION_KEY);
    return grant;
  }

  clearPendingAnalyticsOutcome(): void {
    getSessionStorage()?.removeItem(WORKSHOP_ANALYTICS_OUTCOME_SESSION_KEY);
  }

  async resolvePendingAnalyticsOutcome(
    measurementPermitted: boolean,
  ): Promise<SafeWorkshopAnalyticsOutcome | null> {
    const grant = this.takePendingAnalyticsOutcome();
    if (!grant) return null;
    const command = measurementPermitted
      ? 'redeem_analytics_outcome'
      : 'discard_analytics_outcome';
    try {
      const { data, error } = await this.supabase.getClient().functions.invoke(
        'redeem-workshop-analytics-outcome',
        {
          body: {
            command,
            analyticsOutcomeGrant: grant,
          },
        },
      );
      if (error || !measurementPermitted || !isSafeWorkshopOutcome(data)) {
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  clearActiveBooking(): void {
    this.activeBookingToken = null;
  }

  private storePendingAnalyticsOutcome(grant: string): void {
    if (!grant || grant.length > 2048) return;
    getSessionStorage()?.setItem(WORKSHOP_ANALYTICS_OUTCOME_SESSION_KEY, grant);
  }

  private requireActiveToken(): string {
    if (!this.activeBookingToken) {
      throw new Error('Workshop booking access is unavailable.');
    }
    return this.activeBookingToken;
  }
}

function getSessionStorage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

function isTerminalStatus(state: WorkshopCustomerStatus['state']): boolean {
  return [
    'confirmed',
    'expired',
    'cancelled',
    'refunded',
    'unavailable',
  ].includes(state);
}

function isSafeWorkshopOutcome(
  value: unknown,
): value is SafeWorkshopAnalyticsOutcome {
  if (typeof value !== 'object' || value === null) return false;
  const outcome = value as Record<string, unknown>;
  return outcome['event'] === 'workshop_booking_confirmed'
    && outcome['category'] === 'workshop'
    && typeof outcome['publicContentId'] === 'string'
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(outcome['publicContentId'])
    && Number.isSafeInteger(outcome['quantity'])
    && Number(outcome['quantity']) > 0
    && outcome['currency'] === 'USD'
    && (outcome['valueMinor'] === undefined
      || (Number.isSafeInteger(outcome['valueMinor'])
        && Number(outcome['valueMinor']) >= 0));
}
