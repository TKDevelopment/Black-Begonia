import { EventInput } from '@fullcalendar/core';
import { CrmCalendarColorType, CrmCalendarItem } from './crm-calendar';
import { localWallTimeOfInstant } from '../utils/crm-calendar-date';

export const CRM_CALENDAR_KIND_LABELS: Record<CrmCalendarColorType, string> = {
  lead: 'Lead',
  project: 'Project',
  consultation: 'Consultation',
  installment: 'Installment',
  workshop: 'Workshop',
  microsoft: 'Microsoft',
};

export const CRM_CALENDAR_KIND_COLORS: Record<CrmCalendarColorType, string> = {
  lead: '#9d6500',
  project: '#215ca8',
  consultation: '#7640a6',
  installment: '#277047',
  workshop: '#ae3f42',
  microsoft: '#64748b',
};

export const CRM_CALENDAR_KIND_THEME_COLORS: Record<CrmCalendarColorType, string> = {
  lead: 'var(--crm-calendar-lead)',
  project: 'var(--crm-calendar-project)',
  consultation: 'var(--crm-calendar-consultation)',
  installment: 'var(--crm-calendar-installment)',
  workshop: 'var(--crm-calendar-workshop)',
  microsoft: 'var(--crm-calendar-microsoft)',
};

export function calendarBoxTitle(item: CrmCalendarItem): string {
  if (item.sourceType === 'microsoft' || item.sourceType === 'lead_event') return item.title;
  if (item.sourceType === 'workshop') return item.title.replace(/ - Workshop$/, '');
  const separator = item.title.indexOf(' - ');
  return separator < 0 ? item.title : item.title.slice(0, separator);
}

export function toFullCalendarEvent(item: CrmCalendarItem): EventInput {
  const zone = item.timezone || 'America/New_York';
  return {
    id: item.id,
    title: calendarBoxTitle(item),
    start: item.allDay ? item.start : localWallTimeOfInstant(item.start, zone),
    end: item.allDay ? item.end : localWallTimeOfInstant(item.end, zone),
    allDay: item.allDay,
    backgroundColor: CRM_CALENDAR_KIND_THEME_COLORS[item.colorType],
    borderColor: CRM_CALENDAR_KIND_THEME_COLORS[item.colorType],
    textColor: 'var(--crm-calendar-item-ink)',
    classNames: [
      `crm-calendar-${item.colorType}`,
      ...(item.isInactive ? ['crm-calendar-inactive'] : []),
      ...(item.isPrivate ? ['crm-calendar-private'] : []),
      ...(item.isStale ? ['crm-calendar-stale'] : []),
    ],
    extendedProps: { item, kindLabel: item.isPrivate ? null :
      item.sourceType === 'microsoft' && item.isStale ? 'Microsoft · Stale' :
        CRM_CALENDAR_KIND_LABELS[item.colorType] },
  };
}
