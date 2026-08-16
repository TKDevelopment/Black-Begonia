import { WorkshopOccurrence } from '../models/workshop';
import { WorkshopBooking, WorkshopRosterRow } from '../models/workshop-booking';
import {
  workshopBookingFixture,
  workshopOccurrenceFixture,
} from './workshop-testing';

export interface WorkshopScaleFixture {
  occurrences: WorkshopOccurrence[];
  bookings: WorkshopBooking[];
  rosterPage: WorkshopRosterRow[];
}

function scaleUuid(prefix: '5' | '6', value: number): string {
  return `${prefix}0000000-0000-4000-8000-${value.toString().padStart(12, '0')}`;
}

export function createWorkshopScaleFixture(
  occurrenceCount = 500,
  bookingCount = 5000,
): WorkshopScaleFixture {
  if (occurrenceCount < 1 || bookingCount < 0) {
    throw new RangeError('Scale fixture counts must be non-negative with at least one occurrence.');
  }

  const occurrences = Array.from({ length: occurrenceCount }, (_, index) => {
    const start = new Date(Date.UTC(2026, 7, 1, 16 + index));
    return workshopOccurrenceFixture({
      workshop_occurrence_id: scaleUuid('5', index + 1),
      slug: `scale-workshop-${String(index + 1).padStart(4, '0')}`,
      start_at: start.toISOString(),
      end_at: new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      created_at: '2026-07-30T12:00:00.000Z',
      updated_at: '2026-07-30T12:00:00.000Z',
    });
  });

  const bookings = Array.from({ length: bookingCount }, (_, index) => {
    const occurrence = occurrences[index % occurrences.length];
    return workshopBookingFixture({
      workshop_booking_id: scaleUuid('6', index + 1),
      workshop_occurrence_id: occurrence.workshop_occurrence_id,
      booking_reference: `BBW-SCALE-${String(index + 1).padStart(6, '0')}`,
      contact_name: `Scale Guest ${index + 1}`,
      contact_email: `scale-guest-${index + 1}@example.test`,
      purchased_quantity: 1,
      active_quantity: 1,
      subtotal_minor_snapshot: 8500,
      total_minor_snapshot: 8500,
    });
  });

  const rosterPage: WorkshopRosterRow[] = bookings.slice(0, 100).map((booking, index) => ({
    booking_reference: booking.booking_reference,
    contact_name: booking.contact_name,
    active_quantity: booking.active_quantity,
    booking_status: booking.status,
    seat_number: index + 1,
    attendee_name: null,
    attendance_state: 'expected',
  }));

  return { occurrences, bookings, rosterPage };
}
