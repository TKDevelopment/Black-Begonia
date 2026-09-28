import {
  businessMonthBounds, consultationDisplayEnd, localDateOfInstant,
  nextDateOnly, visibleMonthBounds,
} from './crm-calendar-date';

describe('CRM calendar date rules', () => {
  it('crosses the year boundary for a business month', () => {
    expect(businessMonthBounds(new Date(2026, 11, 15))).toEqual({ start: '2026-12-01', end: '2027-01-01' });
  });

  it('includes calendar grid spillover without shifting SQL dates', () => {
    expect(visibleMonthBounds(new Date(2026, 8, 1))).toEqual({ start: '2026-08-30', end: '2026-10-04' });
    expect(nextDateOnly('2026-12-31')).toBe('2027-01-01');
  });

  it('adds only a display hour to consultation start', () => {
    expect(consultationDisplayEnd('2026-09-27T14:30:00Z')).toBe('2026-09-27T15:30:00.000Z');
  });

  it('formats instants in the business zone on both sides of DST', () => {
    expect(localDateOfInstant('2026-03-08T04:30:00Z', 'America/New_York')).toBe('2026-03-07');
    expect(localDateOfInstant('2026-11-01T05:30:00Z', 'America/New_York')).toBe('2026-11-01');
  });
});
