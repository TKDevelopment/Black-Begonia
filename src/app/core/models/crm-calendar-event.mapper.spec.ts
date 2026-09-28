import { CrmCalendarItem } from './crm-calendar';
import { CRM_CALENDAR_KIND_COLORS, CRM_CALENDAR_KIND_LABELS, CRM_CALENDAR_KIND_THEME_COLORS, toFullCalendarEvent } from './crm-calendar-event.mapper';

describe('CRM calendar event mapper', () => {
  const item: CrmCalendarItem = {
    id: 'lead_event:1', sourceType: 'lead_event', sourceId: '1',
    title: 'Ava & Sam - Wedding', start: '2026-10-17', end: '2026-10-18',
    allDay: true, localDate: '2026-10-17', status: 'new', isInactive: false,
    colorType: 'lead', destination: '/admin/leads/1',
  };

  it('keeps the lead service type in its calendar label and details', () => {
    const mapped = toFullCalendarEvent(item);
    expect(mapped.id).toBe(item.id);
    expect(mapped.title).toBe('Ava & Sam - Wedding');
    expect((mapped.extendedProps?.['item'] as CrmCalendarItem).title).toBe(item.title);
    expect(mapped.start).toBe(item.start);
    expect(mapped.end).toBe(item.end);
    expect(mapped.allDay).toBeTrue();
    expect(mapped.extendedProps?.['kindLabel']).toBe('Lead');
  });

  it('gives each requested type its own color and a text cue', () => {
    expect(new Set(Object.values(CRM_CALENDAR_KIND_COLORS)).size).toBe(6);
    for (const kind of ['lead', 'project', 'consultation', 'installment', 'workshop'] as const) {
      const mapped = toFullCalendarEvent({ ...item, colorType: kind });
      expect(mapped.backgroundColor).toBe(CRM_CALENDAR_KIND_THEME_COLORS[kind]);
      expect(mapped.borderColor).toBe(CRM_CALENDAR_KIND_THEME_COLORS[kind]);
      expect(mapped.textColor).toBe('var(--crm-calendar-item-ink)');
      expect(mapped.extendedProps?.['kindLabel']).toBe(CRM_CALENDAR_KIND_LABELS[kind]);
    }
  });

  it('keeps white item text readable on every type color', () => {
    const luminance = (hex: string): number => {
      const channels = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
        .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    for (const color of Object.values(CRM_CALENDAR_KIND_COLORS)) {
      expect(1.05 / (luminance(color) + 0.05)).withContext(color).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('shows inactive workshop status in its saved local timezone', () => {
    const mapped = toFullCalendarEvent({
      ...item, sourceType: 'workshop', colorType: 'workshop',
      start: '2026-10-17T14:00:00Z', end: '2026-10-17T16:00:00Z',
      allDay: false, isInactive: true, timezone: 'America/Chicago',
    });
    expect(mapped.classNames).toContain('crm-calendar-inactive');
    expect(mapped.start).toBe('2026-10-17T09:00:00');
    expect(mapped.end).toBe('2026-10-17T11:00:00');
  });

  it('keeps the service suffix only for leads while shortening other CRM labels', () => {
    expect(toFullCalendarEvent({ ...item, title: 'Ada - Wedding - Luxury' }).title)
      .toBe('Ada - Wedding - Luxury');
    expect(toFullCalendarEvent({ ...item, sourceType: 'project_event',
      title: 'Ada & Bea - Wedding' }).title).toBe('Ada & Bea');
    expect(toFullCalendarEvent({ ...item, sourceType: 'consultation',
      title: 'Ada & Bea - Consultation' }).title).toBe('Ada & Bea');
    expect(toFullCalendarEvent({ ...item, sourceType: 'installment',
      title: 'Ada & Bea - Final Payment' }).title).toBe('Ada & Bea');
    expect(toFullCalendarEvent({ ...item, sourceType: 'workshop',
      title: 'Flowers - Autumn - Workshop' }).title).toBe('Flowers - Autumn');
    expect(toFullCalendarEvent({ ...item, sourceType: 'microsoft',
      title: 'Supplier - planning meeting' }).title).toBe('Supplier - planning meeting');
  });

  it('preserves the consultation planning hour and its purple type cue', () => {
    const mapped = toFullCalendarEvent({ ...item,
      sourceType: 'consultation', colorType: 'consultation',
      title: 'Ada & Bea - Consultation', start: '2026-10-05T14:00:00Z',
      end: '2026-10-05T15:00:00Z', allDay: false,
    });
    expect(mapped.start).toBe('2026-10-05T10:00:00');
    expect(mapped.end).toBe('2026-10-05T11:00:00');
    expect(mapped.backgroundColor).toBe(CRM_CALENDAR_KIND_THEME_COLORS.consultation);
    expect(mapped.extendedProps?.['kindLabel']).toBe('Consultation');
  });

  it('marks a cached Microsoft item stale without adding a private type label', () => {
    const stale = toFullCalendarEvent({ ...item, sourceType: 'microsoft',
      colorType: 'microsoft', isStale: true });
    expect(stale.classNames).toContain('crm-calendar-stale');
    expect(stale.extendedProps?.['kindLabel']).toBe('Microsoft · Stale');
    const privateItem = toFullCalendarEvent({ ...item, sourceType: 'microsoft',
      colorType: 'microsoft', isStale: true, isPrivate: true, title: 'Private event' });
    expect(privateItem.extendedProps?.['kindLabel']).toBeNull();
  });
});
