import {
  publicWorkshopOccurrenceFixture,
  publicWorkshopSummaryFixture,
  supabaseFailure,
  supabaseSuccess,
  workshopBookingFixture,
  workshopOccurrenceFixture,
} from './workshop-testing';
import { createWorkshopScaleFixture } from './workshop-scale-fixtures';

describe('Workshop cross-story fixtures', () => {
  it('represents empty, recoverable error, and replay-safe result boundaries', async () => {
    await expectAsync(supabaseSuccess([])).toBeResolvedTo({
      data: [],
      error: null,
    });
    await expectAsync(supabaseFailure('temporarily unavailable', 'unavailable'))
      .toBeResolvedTo({
        data: null,
        error: { code: 'unavailable', message: 'temporarily unavailable' },
      });

    const original = workshopBookingFixture();
    const replayRead = workshopBookingFixture({ ...original });
    expect(replayRead).toEqual(original);
    expect(replayRead).not.toBe(original);
  });

  it('builds independent public lifecycle states without leaking operational fields', () => {
    const states = [
      publicWorkshopOccurrenceFixture({ lifecycleStatus: 'published_open', availability: 'available' }),
      publicWorkshopOccurrenceFixture({ lifecycleStatus: 'published_open', availability: 'sold_out' }),
      publicWorkshopOccurrenceFixture({ lifecycleStatus: 'completed', availability: 'closed' }),
      publicWorkshopOccurrenceFixture({ lifecycleStatus: 'cancelled', seoStatus: 'noindex' }),
      publicWorkshopOccurrenceFixture({
        lifecycleStatus: 'rescheduled',
        seoStatus: 'noindex',
        replacementUrl: '/workshops/replacement',
      }),
    ];

    expect(states.map((state) => state.lifecycleStatus)).toEqual([
      'published_open', 'published_open', 'completed', 'cancelled', 'rescheduled',
    ]);
    expect(JSON.stringify(states)).not.toContain('status_token');
    expect(JSON.stringify(states)).not.toContain('contact_email');
  });

  it('honors fixture overrides while preserving safe defaults', () => {
    expect(workshopOccurrenceFixture({ status: 'draft' }).status).toBe('draft');
    expect(publicWorkshopSummaryFixture({ isFeatured: false }).isFeatured).toBeFalse();
    expect(workshopBookingFixture({ active_quantity: 0 }).active_quantity).toBe(0);
  });

  it('creates the representative 500-occurrence and 5,000-booking dataset', () => {
    const fixture = createWorkshopScaleFixture();

    expect(fixture.occurrences.length).toBe(500);
    expect(fixture.bookings.length).toBe(5000);
    expect(fixture.rosterPage.length).toBe(100);
    expect(new Set(fixture.occurrences.map((item) => item.workshop_occurrence_id)).size)
      .toBe(500);
    expect(new Set(fixture.bookings.map((item) => item.workshop_booking_id)).size)
      .toBe(5000);
  });
});
