import { TestBed } from '@angular/core/testing';

import { WorkshopHeldBooking } from '../../models/workshop-booking';
import {
  WorkshopBookingRepositoryService,
} from '../repositories/workshop-booking-repository.service';
import { SupabaseService } from '../clients/supabase.service';
import {
  WORKSHOP_ANALYTICS_OUTCOME_SESSION_KEY,
  WorkshopBookingService,
} from './workshop-booking.service';

describe('WorkshopBookingService', () => {
  let service: WorkshopBookingService;
  let repository: jasmine.SpyObj<WorkshopBookingRepositoryService>;
  let invoke: jasmine.Spy;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    repository = jasmine.createSpyObj<WorkshopBookingRepositoryService>(
      'WorkshopBookingRepositoryService',
      [
        'createHold',
        'choosePayment',
        'getStatus',
        'getStatusByCheckoutSession',
        'requestStatusAccess',
        'performCustomerAction',
      ],
    );
    invoke = jasmine.createSpy('invoke');
    TestBed.configureTestingModule({
      providers: [
        WorkshopBookingService,
        { provide: WorkshopBookingRepositoryService, useValue: repository },
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({ functions: { invoke } }),
          },
        },
      ],
    });
    service = TestBed.inject(WorkshopBookingService);
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('orchestrates hold then payment with independent idempotency keys', async () => {
    repository.createHold.and.resolveTo(heldFixture());
    repository.choosePayment.and.resolveTo({
      state: 'redirect',
      method: 'stripe',
      url: 'https://checkout.stripe.com/c/pay/cs_test',
      effectiveExpiresAt: '2026-10-01T16:30:00Z',
    });
    const localSet = spyOn(Storage.prototype, 'setItem').and.callThrough();

    const result = await service.startReservation({
      occurrenceSlug: 'garden-workshop',
      quantity: 2,
      contactName: 'Customer',
      contactEmail: 'customer@example.test',
      acceptedTermsVersion: 3,
      paymentMethod: 'stripe',
    });

    expect(result.handoff.state).toBe('redirect');
    expect(repository.createHold).toHaveBeenCalledWith(jasmine.objectContaining({
      occurrenceSlug: 'garden-workshop',
      commandKey: jasmine.any(String),
    }));
    expect(repository.choosePayment).toHaveBeenCalledWith(
      'raw-booking-token',
      'stripe',
      jasmine.any(String),
    );
    const holdKey = repository.createHold.calls.mostRecent().args[0].commandKey;
    const paymentKey = repository.choosePayment.calls.mostRecent().args[2];
    expect(holdKey).not.toBe(paymentKey);
    expect(localSet).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('keeps the booking token in memory while switching payment methods', async () => {
    repository.createHold.and.resolveTo(heldFixture());
    repository.choosePayment.and.resolveTo({
      state: 'pending_manual_payment',
      method: 'direct_venmo',
      approvedTarget: 'https://venmo.com/u/approved-business',
      amountMinor: 18190,
      currency: 'USD',
      reference: 'BBW-2026-TEST-A1B2C3',
      effectiveExpiresAt: '2026-10-02T16:00:00Z',
    });

    await service.startReservation({
      occurrenceSlug: 'garden-workshop',
      quantity: 2,
      contactName: 'Customer',
      contactEmail: 'customer@example.test',
      acceptedTermsVersion: 3,
      paymentMethod: 'direct_venmo',
    });
    await service.switchPaymentMethod('stripe');

    expect(repository.choosePayment.calls.mostRecent().args[0])
      .toBe('raw-booking-token');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('stores only the single-purpose analytics outcome grant in session storage', async () => {
    repository.getStatus.and.resolveTo({
      ...confirmedStatus(),
      analyticsOutcomeGrant: 'opaque-analytics-grant',
    });

    await service.getStatus('raw-status-token');

    expect(sessionStorage.length).toBe(1);
    expect(sessionStorage.getItem(WORKSHOP_ANALYTICS_OUTCOME_SESSION_KEY))
      .toBe('opaque-analytics-grant');
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('raw-status-token');
    expect(localStorage.length).toBe(0);
    expect(service.takePendingAnalyticsOutcome()).toBe('opaque-analytics-grant');
    expect(sessionStorage.length).toBe(0);
  });

  it('resolves a verified Stripe checkout without retaining its session id', async () => {
    repository.getStatusByCheckoutSession.and.resolveTo(confirmedStatus());

    await expectAsync(service.getStatusByCheckoutSession('cs_test_verified'))
      .toBeResolvedTo(confirmedStatus());
    expect(repository.getStatusByCheckoutSession)
      .toHaveBeenCalledOnceWith('cs_test_verified');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  function confirmedStatus() {
    return {
      state: 'confirmed' as const,
      publicWorkshopPath: '/workshops/garden-workshop/2026-08-15',
      workshopTitle: 'Garden Workshop',
      startAt: '2026-08-15T17:00:00.000Z',
      endAt: '2026-08-15T19:00:00.000Z',
      timezone: 'America/New_York',
      venueName: 'Black Begonia Studio',
      addressLine1: '100 Flower Lane',
      addressLine2: null,
      locality: 'Richmond',
      region: 'VA',
      postalCode: '23220',
      activeQuantity: 2,
      termsSnapshot: 'Accepted terms.',
    };
  }

  it('delegates generic recovery without retaining supplied booking details', async () => {
    repository.requestStatusAccess.and.resolveTo({
      state: 'accepted',
      message: 'If the details match an eligible booking, a new access link will be sent.',
    });
    const request = {
      email: 'customer@example.test',
      supportReference: 'BBW-2026-TEST',
    };

    await expectAsync(service.requestStatusAccess(request)).toBeResolvedTo({
      state: 'accepted',
      message: 'If the details match an eligible booking, a new access link will be sent.',
    });
    expect(repository.requestStatusAccess).toHaveBeenCalledWith(request);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('clears terminal booking access and requires recovery for later actions', async () => {
    repository.getStatus.and.resolveTo({ state: 'expired' });
    await service.getStatus('raw-status-token');

    await expectAsync(service.performCustomerAction(
      'cancel_booking',
      { quantity: 1 },
    )).toBeRejectedWithError('Workshop booking access is unavailable.');
    expect(repository.performCustomerAction).not.toHaveBeenCalled();
  });

  it('accepts a waitlist offer token and keeps only the returned booking token in memory', async () => {
    repository.performCustomerAction.and.resolveTo({
      state: 'accepted',
      quantity: 1,
      bookingToken: 'new-booking-token',
    });
    repository.choosePayment.and.resolveTo({
      state: 'pending_manual_payment',
      method: 'direct_venmo',
      approvedTarget: 'https://venmo.com/u/approved-business',
      amountMinor: 8500,
      currency: 'USD',
      reference: 'BBW-2026-WAITLIST',
      effectiveExpiresAt: '2026-10-01T16:30:00Z',
    });

    await service.performCustomerAction(
      'respond_to_waitlist',
      { response: 'accept', termsVersion: 3 },
      'raw-offer-token',
    );
    await service.switchPaymentMethod('direct_venmo');

    expect(repository.performCustomerAction).toHaveBeenCalledWith(
      'respond_to_waitlist',
      'raw-offer-token',
      { response: 'accept', termsVersion: 3 },
      jasmine.any(String),
    );
    expect(repository.choosePayment.calls.mostRecent().args[0])
      .toBe('new-booking-token');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('redeems one pending grant through the clean Edge boundary and clears it first', async () => {
    sessionStorage.setItem(
      WORKSHOP_ANALYTICS_OUTCOME_SESSION_KEY,
      'opaque-analytics-grant',
    );
    invoke.and.resolveTo({
      data: {
        event: 'workshop_booking_confirmed',
        publicContentId: 'garden-workshop',
        category: 'workshop',
        quantity: 2,
        currency: 'USD',
        valueMinor: 17000,
      },
      error: null,
    });

    await expectAsync(service.resolvePendingAnalyticsOutcome(true))
      .toBeResolvedTo({
        event: 'workshop_booking_confirmed',
        publicContentId: 'garden-workshop',
        category: 'workshop',
        quantity: 2,
        currency: 'USD',
        valueMinor: 17000,
      });
    expect(invoke).toHaveBeenCalledOnceWith(
      'redeem-workshop-analytics-outcome',
      {
        body: {
          command: 'redeem_analytics_outcome',
          analyticsOutcomeGrant: 'opaque-analytics-grant',
        },
      },
    );
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
    expect(document.cookie).not.toContain('opaque-analytics-grant');
    expect(location.href).not.toContain('opaque-analytics-grant');
  });

  it('durably discards a blocked outcome and never retains it for later replay', async () => {
    sessionStorage.setItem(
      WORKSHOP_ANALYTICS_OUTCOME_SESSION_KEY,
      'blocked-opaque-analytics-grant',
    );
    invoke.and.resolveTo({ data: { state: 'discarded' }, error: null });

    expect(await service.resolvePendingAnalyticsOutcome(false)).toBeNull();
    expect(invoke).toHaveBeenCalledOnceWith(
      'redeem-workshop-analytics-outcome',
      {
        body: {
          command: 'discard_analytics_outcome',
          analyticsOutcomeGrant: 'blocked-opaque-analytics-grant',
        },
      },
    );
    expect(await service.resolvePendingAnalyticsOutcome(true)).toBeNull();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });

  it('clears forged, expired, duplicate, and unavailable outcome responses', async () => {
    for (const state of ['forged', 'expired', 'duplicate', 'unavailable']) {
      sessionStorage.setItem(
        WORKSHOP_ANALYTICS_OUTCOME_SESSION_KEY,
        `${state}-opaque-analytics-grant`,
      );
      invoke.and.resolveTo({ data: { state: 'unavailable' }, error: null });
      expect(await service.resolvePendingAnalyticsOutcome(true)).toBeNull();
      expect(sessionStorage.length).toBe(0);
    }
    expect(localStorage.length).toBe(0);
  });

  it('treats a second-tab redemption of the same grant as unavailable', async () => {
    const outcome = {
      event: 'workshop_booking_confirmed',
      publicContentId: 'garden-workshop',
      category: 'workshop',
      quantity: 2,
      currency: 'USD',
      valueMinor: 17000,
    };
    invoke.and.returnValues(
      Promise.resolve({ data: outcome, error: null }),
      Promise.resolve({ data: { state: 'unavailable' }, error: null }),
    );

    sessionStorage.setItem(
      WORKSHOP_ANALYTICS_OUTCOME_SESSION_KEY,
      'shared-cross-tab-grant',
    );
    expect(await service.resolvePendingAnalyticsOutcome(true))
      .toEqual(outcome as any);

    sessionStorage.setItem(
      WORKSHOP_ANALYTICS_OUTCOME_SESSION_KEY,
      'shared-cross-tab-grant',
    );
    expect(await service.resolvePendingAnalyticsOutcome(true)).toBeNull();
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(sessionStorage.length).toBe(0);
  });
});

function heldFixture(): WorkshopHeldBooking {
  return {
    state: 'held',
    bookingToken: 'raw-booking-token',
    supportReference: 'BBW-2026-TEST',
    quantity: 2,
    priceMinor: 8500,
    subtotalMinor: 17000,
    taxMinor: 1190,
    taxRateBasisPoints: 700,
    taxRegion: 'RI',
    totalMinor: 18190,
    currency: 'USD',
    effectiveExpiresAt: '2026-10-01T16:30:00Z',
    methods: ['stripe', 'direct_venmo'],
  };
}
