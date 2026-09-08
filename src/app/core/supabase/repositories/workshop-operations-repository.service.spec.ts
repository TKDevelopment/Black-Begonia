import { TestBed } from '@angular/core/testing';

import { SupabaseService } from '../clients/supabase.service';
import { WorkshopOperationsRepositoryService } from './workshop-operations-repository.service';

describe('WorkshopOperationsRepositoryService', () => {
  let service: WorkshopOperationsRepositoryService;
  let rpc: jasmine.Spy;
  let from: jasmine.Spy;

  beforeEach(() => {
    rpc = jasmine.createSpy('rpc');
    from = jasmine.createSpy('from');
    const supabase = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['getClient']);
    supabase.getClient.and.returnValue({ rpc, from } as never);
    TestBed.configureTestingModule({
      providers: [
        WorkshopOperationsRepositoryService,
        { provide: SupabaseService, useValue: supabase },
      ],
    });
    service = TestBed.inject(WorkshopOperationsRepositoryService);
  });

  it('maps manual reservations to the authoritative roster command', async () => {
    rpc.and.resolveTo({
      data: { replayed: false, bookingId: 'booking-1', activeQuantity: 2 },
      error: null,
    });

    await service.createReservation({
      occurrenceId: 'occurrence-1',
      quantity: 2,
      reservationType: 'manual',
      statusTokenDigest: 'digest',
      contactName: ' Guest ',
      contactEmail: ' GUEST@EXAMPLE.TEST ',
      contactPhone: ' 555-0100 ',
      reason: ' phone booking ',
    }, 'command-1');

    expect(rpc).toHaveBeenCalledWith('manage_workshop_roster', {
      p_action: 'create_reservation',
      p_payload: jasmine.objectContaining({
        contactName: 'Guest',
        contactEmail: 'guest@example.test',
        contactPhone: '555-0100',
        reason: 'phone booking',
      }),
      p_command_key: 'command-1',
    });
  });

  it('maps partial cancellation and check-in without changing financial state client-side', async () => {
    rpc.and.resolveTo({ data: { replayed: false, bookingId: 'booking-1' }, error: null });

    await service.cancelSeats('booking-1', 1, ' guest request ', 'command-2');
    await service.checkIn('attendee-1', 'command-3');

    expect(rpc.calls.argsFor(0)).toEqual([
      'manage_workshop_roster',
      {
        p_action: 'cancel_seats',
        p_payload: { bookingId: 'booking-1', quantity: 1, reason: 'guest request' },
        p_command_key: 'command-2',
      },
    ]);
    expect(rpc.calls.argsFor(1)[1]).toEqual({
      p_action: 'check_in',
      p_payload: { attendeeId: 'attendee-1' },
      p_command_key: 'command-3',
    });
  });

  it('maps permanent expired-booking deletion to its guarded database command', async () => {
    rpc.and.resolveTo({
      data: { replayed: false, bookingId: 'booking-expired', status: 'deleted' },
      error: null,
    });

    await service.deleteExpiredBooking('booking-expired', 'command-delete');

    expect(rpc).toHaveBeenCalledWith('delete_expired_workshop_booking', {
      p_booking_id: 'booking-expired',
      p_command_key: 'command-delete',
    });
  });

  it('loads only the minimized roster projection', async () => {
    const rows = [{
      booking_reference: 'BBW-2026-TEST',
      contact_name: 'Guest',
      active_quantity: 1,
      booking_status: 'confirmed',
      seat_number: 1,
      attendee_name: null,
      attendance_state: 'expected',
    }];
    rpc.and.resolveTo({ data: rows, error: null });

    await expectAsync(service.listMinimizedRoster('occurrence-1'))
      .toBeResolvedTo(rows as never);
    expect(rpc).toHaveBeenCalledWith('get_minimized_workshop_roster', {
      p_occurrence_id: 'occurrence-1',
    });
  });

  it('loads attendees for a roster in one bounded query instead of one request per booking', async () => {
    const order = jasmine.createSpy('order').and.resolveTo({
      data: [{ workshop_attendee_id: 'attendee-1' }],
      error: null,
    });
    const inFilter = jasmine.createSpy('in').and.returnValue({ order });
    const select = jasmine.createSpy('select').and.returnValue({ in: inFilter });
    from.and.returnValue({ select });

    const attendees = await service.listAttendeesForBookings(['booking-1', 'booking-2']);

    expect(from).toHaveBeenCalledOnceWith('workshop_attendees');
    expect(inFilter).toHaveBeenCalledOnceWith(
      'workshop_booking_id', ['booking-1', 'booking-2'],
    );
    expect(attendees.length).toBe(1);
  });

  it('surfaces command errors unchanged for the CRM to present safely', async () => {
    const error = { code: 'P0001', message: 'insufficient capacity' };
    rpc.and.resolveTo({ data: null, error });

    await expectAsync(service.cancelSeats('booking-1', 4, 'request', 'command-4'))
      .toBeRejectedWith(error);
  });

  it('maps bounded waitlist offers without creating a raw token in the CRM', async () => {
    rpc.and.resolveTo({
      data: {
        replayed: false,
        state: 'active',
        offerId: 'offer-1',
        quantity: 2,
      },
      error: null,
    });

    await service.offerWaitlistSeats('occurrence-1', 1440, 'command-offer');

    expect(rpc).toHaveBeenCalledWith('manage_workshop_waitlist', {
      p_action: 'offer_next',
      p_payload: {
        occurrenceId: 'occurrence-1',
        durationMinutes: 1440,
      },
      p_command_key: 'command-offer',
    });
    expect(JSON.stringify(rpc.calls.mostRecent().args)).not.toContain('Token');
  });

  it('reads redacted communication queue and terminal history projections', async () => {
    const query = (rows: object[]) => ({
      select: jasmine.createSpy('select').and.callFake(() => ({
        eq: jasmine.createSpy('eq').and.callFake(() => ({
          order: jasmine.createSpy('order').and.resolveTo({ data: rows, error: null }),
        })),
      })),
    });
    from.and.returnValues(
      query([{ workshop_message_queue_id: 'queue-1', state: 'failed' }]),
      query([{ workshop_communication_id: 'message-1', delivery_state: 'sent' }]),
    );

    const queue = await service.listCommunicationQueue('booking-1');
    const history = await service.listCommunicationHistory('booking-1');

    expect(queue[0].state).toBe('failed');
    expect(history[0].delivery_state).toBe('sent');
    expect(from.calls.allArgs()).toEqual([
      ['workshop_message_queue'],
      ['workshop_communications'],
    ]);
    expect(JSON.stringify(queue)).not.toContain('recipient_email');
  });

  it('maps lifecycle, cancellation, and reschedule commands to their boundaries', async () => {
    rpc.and.resolveTo({ data: { replayed: false }, error: null });

    await service.getOperationalState('occurrence-1');
    await service.transitionOccurrence(
      'occurrence-1', 'registration_closed', 'command-close',
    );
    await service.cancelOccurrence(
      'occurrence-1', 'weather', 'command-cancel',
    );
    await service.beginReschedule(
      'occurrence-1', 'occurrence-2',
      '2026-09-01T12:00:00Z', 'command-reschedule',
    );
    await service.resolveRescheduleNonresponse(
      'response-1', 'command-resolve',
    );

    expect(rpc.calls.argsFor(0)).toEqual([
      'get_workshop_occurrence_operational_state',
      { p_occurrence_id: 'occurrence-1' },
    ]);
    expect(rpc.calls.argsFor(1)).toEqual([
      'transition_workshop_occurrence',
      {
        p_occurrence_id: 'occurrence-1',
        p_target_status: 'registration_closed',
        p_command_key: 'command-close',
      },
    ]);
    expect(rpc.calls.argsFor(2)[0]).toBe('cancel_workshop_occurrence');
    expect(rpc.calls.argsFor(3)).toEqual([
      'manage_workshop_reschedule',
      {
        p_action: 'begin',
        p_payload: {
          sourceOccurrenceId: 'occurrence-1',
          replacementOccurrenceId: 'occurrence-2',
          responseDeadline: '2026-09-01T12:00:00Z',
        },
        p_command_key: 'command-reschedule',
      },
    ]);
    expect(rpc.calls.argsFor(4)[1]).toEqual({
      p_action: 'resolve_nonresponse',
      p_payload: { responseId: 'response-1', resolution: 'cancel' },
      p_command_key: 'command-resolve',
    });
  });
});
