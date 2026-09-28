import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { CrmCalendarItem, CrmCalendarSyncHealth } from '../../../core/models/crm-calendar';
import { CrmCalendarRepositoryService } from '../../../core/supabase/repositories/crm-calendar-repository.service';
import { formatLocalDate, visibleMonthBounds } from '../../../core/utils/crm-calendar-date';
import { CalendarMiniComponent } from './calendar-mini/calendar-mini.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CalendarMiniComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private readonly calendarRepository = inject(CrmCalendarRepositoryService);
  readonly month = new Date();
  readonly items = signal<CrmCalendarItem[]>([]);
  readonly calendarError = signal(false);
  readonly syncHealth = signal<CrmCalendarSyncHealth | null>(null);
  readonly syncError = signal(false);
  readonly loading = signal(true);

  ngOnInit(): void { void this.loadCalendar(); }

  async loadCalendar(): Promise<void> {
    this.loading.set(true);
    try {
      this.items.set(await this.calendarRepository.list(visibleMonthBounds(this.month)));
      this.calendarError.set(false);
    } catch {
      this.calendarError.set(true);
    } finally { this.loading.set(false); }
    try {
      this.syncHealth.set(await this.calendarRepository.status(formatLocalDate(this.month).slice(0, 7)));
      this.syncError.set(false);
    } catch { this.syncError.set(true); }
  }
}
