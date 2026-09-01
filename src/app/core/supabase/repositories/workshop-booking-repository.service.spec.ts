import { TestBed } from '@angular/core/testing';

import { WorkshopHeldBooking } from '../../models/workshop-booking';
import { SupabaseService } from '../clients/supabase.service';
import {
  WorkshopBookingApiError,
  WorkshopBookingRepositoryService,
} from './workshop-booking-repository.service';

describe('WorkshopBookingRepositoryService', () => {
  let service: WorkshopBookingRepositoryService;
  let invoke: jasmine.Spy;

  beforeEach(() => {
    invoke = jasmine.createSpy('invoke');
    const supabase = jasmine.createSpyObj<SupabaseService>(
      'SupabaseService',
      ['getClient'],
    );
    supabase.getClient.and.returnValue({ functions: { invoke } } as never);
    TestBed.configureTestingModule({
      providers: [
        WorkshopBookingRepositoryService,
        { provide: SupabaseService, useValue: supabase },
      ],
    });
    service = TestBed.inject(WorkshopBookingRepositoryService);
  });

  it('maps hold creation to the standalone endpoint without flattening contact secrets', async () => {
    const held = heldFixture();
    invoke.and.resolveTo({ data: held, error: null });

    await expectAsync(service.createHold({
      occurrenceSlug: 'garden-workshop',
      quantity: 2,
      contactName: ' Customer Name ',
      contactEmail: ' CUSTOMER@EXAMPLE.TEST ',
      contactPhone: ' 555-0100 ',
      acceptedTermsVersion: 3,
      commandKey: 'command-hold',
    })).toBeResolvedTo(held);

    expect(invoke).toHaveBeenCalledWith('create-workshop-booking', {
      body: {
        command: 'create_hold',
        occurrenceSlug: 'garden-workshop',
        quantity: 2,
        contact: {
          name: 'Customer Name',
          email: 'customer@example.test',
          phone: '555-0100',
        },
        termsVersion: 3,
        commandKey: 'command-hold',
      },
    });
  });

  it('maps Stripe selection as a separate token-body command', async () => {
    const redirect = {
      state: 'redirect',
      method: 'stripe',
      url: 'https://checkout.stripe.com/c/pay/cs_test',
      effectiveExpiresAt: '2026-10-01T16:30:00Z',
    } as const;
    invoke.and.resolveTo({ data: redirect, error: null });

    await expectAsync(
      service.choosePayment('raw-booking-token', 'command-payment'),
    ).toBeResolvedTo(redirect);

    expect(invoke).toHaveBeenCalledWith('create-workshop-booking', {
      body: {
        command: 'choose_payment',
        bookingToken: 'raw-booking-token',
        method: 'stripe',
        commandKey: 'command-payment',
      },
    });
    expect(JSON.stringify(invoke.calls.mostRecent().args[0]))
      .not.toContain('raw-booking-token');
  });

  it('rejects a hold response that advertises a non-Stripe checkout method', async () => {
    invoke.and.resolveTo({
      data: { ...heldFixture(), methods: ['direct_venmo'] },
      error: null,
    });

    await expectAsync(service.createHold({
      occurrenceSlug: 'garden-workshop',
      quantity: 2,
      contactName: 'Customer Name',
      contactEmail: 'customer@example.test',
      contactPhone: '(555) 555-0100',
      acceptedTermsVersion: 3,
      commandKey: 'command-hold',
    })).toBeRejectedWith(jasmine.any(WorkshopBookingApiError));
  });

  it('accepts only clean canonical public paths from confirmed status', async () => {
    const confirmed = {
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
    invoke.and.resolveTo({
      data: confirmed,
      error: null,
    });
    await expectAsync(service.getStatus('raw-status-token')).toBeResolvedTo(confirmed);

    invoke.and.resolveTo({
      data: {
        ...confirmed,
        publicWorkshopPath: '/workshops/garden-workshop/2026-08-15?token=secret',
      },
      error: null,
    });
    await expectAsync(service.getStatus('raw-status-token'))
      .toBeRejectedWith(jasmine.any(WorkshopBookingApiError));
  });

  it('maps a Stripe checkout session to the standalone status command body', async () => {
    invoke.and.resolveTo({
      data: {
        state: 'confirmed',
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
      },
      error: null,
    });

    await service.getStatusByCheckoutSession('cs_test_verified');

    expect(invoke).toHaveBeenCalledWith('manage-workshop-booking-access', {
      body: {
        command: 'stripe_checkout_status',
        checkoutSessionId: 'cs_test_verified',
      },
    });
  });

  it('returns the same non-enumerating recovery result and maps the endpoint command', async () => {
    invoke.and.resolveTo({
      data: { matched: true, bookingState: 'confirmed' },
      error: null,
    });
    const result = await service.requestStatusAccess({
      email: ' CUSTOMER@EXAMPLE.TEST ',
      supportReference: ' bbw-2026-test ',
    });

    expect(result).toEqual({
      state: 'accepted',
      message: 'If the details match an eligible booking, a new access link will be sent.',
    });
    expect(invoke).toHaveBeenCalledWith('manage-workshop-booking-access', {
      body: {
        command: 'request_status_access',
        email: 'customer@example.test',
        supportReference: 'BBW-2026-TEST',
      },
    });
    expect(JSON.stringify(result)).not.toContain('confirmed');
  });

  it('maps token-scoped customer actions to the booking-access endpoint', async () => {
    invoke.and.resolveTo({ data: { state: 'cancel_pending' }, error: null });

    await expectAsync(service.performCustomerAction(
      'cancel_booking',
      'raw-status-token',
      { quantity: 1 },
      'command-cancel',
    )).toBeResolvedTo({ state: 'cancel_pending' });
    expect(invoke).toHaveBeenCalledWith('manage-workshop-booking-access', {
      body: {
        command: 'cancel_booking',
        bookingToken: 'raw-status-token',
        quantity: 1,
        commandKey: 'command-cancel',
      },
    });
  });

  it('maps accepted waitlist responses without placing the offer token in a URL', async () => {
    invoke.and.resolveTo({
      data: {
        state: 'accepted',
        quantity: 2,
        effectiveExpiresAt: '2026-10-01T16:30:00Z',
        bookingToken: 'new-booking-token',
      },
      error: null,
    });

    await expectAsync(service.performCustomerAction(
      'respond_to_waitlist',
      'raw-offer-token',
      { response: 'accept', termsVersion: 3 },
      'command-waitlist',
    )).toBeResolvedTo({
      state: 'accepted',
      quantity: 2,
      effectiveExpiresAt: '2026-10-01T16:30:00Z',
      bookingToken: 'new-booking-token',
    });
    expect(invoke).toHaveBeenCalledWith('manage-workshop-booking-access', {
      body: {
        command: 'respond_to_waitlist',
        bookingToken: 'raw-offer-token',
        response: 'accept',
        termsVersion: 3,
        commandKey: 'command-waitlist',
      },
    });
    expect(JSON.stringify(invoke.calls.mostRecent().args[0]))
      .not.toContain('?token=');
  });

  it('maps a single-purpose reschedule response without treating it as booking access', async () => {
    invoke.and.resolveTo({
      data: { state: 'accepted', replayed: false, responseId: 'response-1' },
      error: null,
    });

    await expectAsync(service.performCustomerAction(
      'respond_to_reschedule',
      'raw-reschedule-response-token',
      { response: 'accept' },
      'command-reschedule',
    )).toBeResolvedTo({
      state: 'accepted',
      replayed: false,
      responseId: 'response-1',
    });
    expect(invoke).toHaveBeenCalledWith('manage-workshop-booking-access', {
      body: {
        command: 'respond_to_reschedule',
        bookingToken: 'raw-reschedule-response-token',
        response: 'accept',
        commandKey: 'command-reschedule',
      },
    });
    expect(JSON.stringify(invoke.calls.mostRecent().args))
      .not.toContain('responseTokenDigest');
  });

  it('redacts provider, SQL, and stack details from public errors', async () => {
    const consoleError = spyOn(console, 'error');
    invoke.and.resolveTo({
      data: null,
      error: {
        message: 'duplicate key violates workshop_bookings_status_token_digest_key',
        stack: 'sensitive provider stack',
        context: {
          json: async () => ({
            code: 'registration_closed',
            detail: 'select * from workshop_bookings',
          }),
        },
      },
    });

    try {
      await service.createHold({
        occurrenceSlug: 'garden-workshop',
        quantity: 2,
        contactName: 'Customer',
        contactEmail: 'customer@example.test',
        contactPhone: '(555) 555-0100',
        acceptedTermsVersion: 3,
        commandKey: 'command-hold',
      });
      fail('Expected a safe repository error.');
    } catch (error) {
      expect(error).toEqual(jasmine.any(WorkshopBookingApiError));
      expect((error as WorkshopBookingApiError).code).toBe('registration_closed');
      expect((error as Error).message).toBe(
        'We could not reserve those workshop seats.',
      );
      expect(JSON.stringify(error)).not.toContain('duplicate key');
      expect(JSON.stringify(error)).not.toContain('select *');
    }
    expect(consoleError).not.toHaveBeenCalled();
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
    methods: ['stripe'],
  };
}
