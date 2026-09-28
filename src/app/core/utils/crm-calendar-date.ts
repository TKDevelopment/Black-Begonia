import { parseDateOnlyForDisplay } from './date-only';
import { CrmCalendarRange } from '../models/crm-calendar';

const pad = (value: number): string => String(value).padStart(2, '0');

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function businessMonthBounds(month: Date): CrmCalendarRange {
  return {
    start: formatLocalDate(new Date(month.getFullYear(), month.getMonth(), 1)),
    end: formatLocalDate(new Date(month.getFullYear(), month.getMonth() + 1, 1)),
  };
}

export function visibleMonthBounds(month: Date): CrmCalendarRange {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  first.setDate(first.getDate() - first.getDay());
  last.setDate(last.getDate() + (6 - last.getDay()) + 1);
  return { start: formatLocalDate(first), end: formatLocalDate(last) };
}

export function nextDateOnly(value: string): string {
  const parsed = parseDateOnlyForDisplay(value);
  if (!parsed) throw new Error('Invalid calendar date');
  parsed.setDate(parsed.getDate() + 1);
  return formatLocalDate(parsed);
}

export function consultationDisplayEnd(start: string): string {
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid consultation time');
  return new Date(date.getTime() + 60 * 60 * 1000).toISOString();
}

export function localDateOfInstant(instant: string, timezone: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid calendar time');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (kind: string): string => parts.find(item => item.type === kind)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function localWallTimeOfInstant(instant: string, timezone: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid calendar time');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (kind: string): string => parts.find(item => item.type === kind)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
}
