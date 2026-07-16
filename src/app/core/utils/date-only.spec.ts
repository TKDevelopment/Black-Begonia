import {
  formatDateOnlyForDisplay,
  normalizeDateOnly,
  parseDateOnlyForDisplay,
} from './date-only';

describe('date-only utilities', () => {
  it('preserves date input values as date-only strings', () => {
    expect(normalizeDateOnly('2026-11-28')).toBe('2026-11-28');
    expect(normalizeDateOnly(' 2026-10-13T05:00:00.000Z ')).toBe('2026-10-13');
    expect(normalizeDateOnly('')).toBeNull();
  });

  it('formats date-only strings as the selected calendar day', () => {
    expect(
      formatDateOnlyForDisplay('2026-11-28', 'Not set', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    ).toBe('November 28, 2026');
  });

  it('parses date-only strings as local calendar dates rather than UTC instants', () => {
    const parsed = parseDateOnlyForDisplay('2026-05-03');

    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(4);
    expect(parsed?.getDate()).toBe(3);
  });
});
