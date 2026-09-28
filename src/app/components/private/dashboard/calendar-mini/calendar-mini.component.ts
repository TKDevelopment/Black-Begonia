import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CrmCalendarColorType, CrmCalendarItem } from '../../../../core/models/crm-calendar';
import { CRM_CALENDAR_KIND_THEME_COLORS } from '../../../../core/models/crm-calendar-event.mapper';
import { formatLocalDate, localDateOfInstant, nextDateOnly, visibleMonthBounds } from '../../../../core/utils/crm-calendar-date';

interface MiniDay {
  date: string; day: number; currentMonth: boolean;
  kinds: CrmCalendarColorType[]; count: number; hasPrivateOnly: boolean;
}

@Component({
  selector: 'app-calendar-mini', standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './calendar-mini.component.html', styleUrl: './calendar-mini.component.scss',
})
export class CalendarMiniComponent {
  @Input({ required: true }) month = new Date();
  @Input() items: CrmCalendarItem[] = [];
  readonly colors = CRM_CALENDAR_KIND_THEME_COLORS;
  readonly weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  get monthKey(): string { return formatLocalDate(this.month).slice(0, 7); }
  get monthLabel(): string {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(this.month);
  }
  get days(): MiniDay[] {
    const bounds = visibleMonthBounds(this.month);
    const start = new Date(Number(bounds.start.slice(0, 4)), Number(bounds.start.slice(5, 7)) - 1, Number(bounds.start.slice(8)));
    const end = new Date(Number(bounds.end.slice(0, 4)), Number(bounds.end.slice(5, 7)) - 1, Number(bounds.end.slice(8)));
    const byDay = new Map<string, CrmCalendarItem[]>();
    for (const item of this.items) {
      const lastIncluded = item.allDay ? null : localDateOfInstant(
        new Date(new Date(item.end).getTime() - 1).toISOString(), item.timezone || 'America/New_York');
      const endExclusive = item.allDay ? item.end.slice(0, 10) : nextDateOnly(lastIncluded!);
      for (let day = item.localDate < bounds.start ? bounds.start : item.localDate, span = 0;
        day < endExclusive && day < bounds.end && span < 42;
        day = nextDateOnly(day), span++) {
        const list = byDay.get(day) ?? [];
        list.push(item);
        byDay.set(day, list);
      }
    }
    const days: MiniDay[] = [];
    for (const date = start; date < end; date.setDate(date.getDate() + 1)) {
      const key = formatLocalDate(date);
      const items = byDay.get(key) ?? [];
      const visibleItems = items.filter(item => !item.isPrivate);
      days.push({ date: key, day: date.getDate(), currentMonth: date.getMonth() === this.month.getMonth(),
        kinds: [...new Set(visibleItems.map(item => item.colorType))].slice(0, 3),
        count: visibleItems.length, hasPrivateOnly: visibleItems.length === 0 && items.some(item => item.isPrivate) });
    }
    return days;
  }
}
