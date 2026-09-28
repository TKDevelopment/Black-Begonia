import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnDestroy, OnInit, PLATFORM_ID, ViewChild, inject, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { ActivatedRoute } from '@angular/router';
import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import { CrmCalendarItem, CrmCalendarSyncHealth } from '../../../core/models/crm-calendar';
import { CRM_CALENDAR_KIND_LABELS, CRM_CALENDAR_KIND_THEME_COLORS, toFullCalendarEvent } from '../../../core/models/crm-calendar-event.mapper';
import { AuthService } from '../../../core/auth/auth.service';
import { CrmThemeService } from '../../../core/services/crm-theme.service';
import { CrmCalendarRepositoryService } from '../../../core/supabase/repositories/crm-calendar-repository.service';
import { CrmM365CalendarAdminError, CrmM365CalendarAdminService } from '../../../core/supabase/services/crm-m365-calendar-admin.service';
import { formatLocalDate, visibleMonthBounds } from '../../../core/utils/crm-calendar-date';
import { CalendarItemDetailsDialogComponent } from './calendar-item-details-dialog/calendar-item-details-dialog.component';
import { CalendarConnectionPanelComponent } from './calendar-connection-panel/calendar-connection-panel.component';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FullCalendarModule, CalendarConnectionPanelComponent],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss',
})
export class CalendarComponent implements OnInit, OnDestroy {
  @ViewChild(FullCalendarComponent) private calendar?: FullCalendarComponent;
  private readonly repository = inject(CrmCalendarRepositoryService);
  private readonly dialog = inject(Dialog);
  private readonly route = inject(ActivatedRoute);
  private readonly admin = inject(CrmM365CalendarAdminService);
  private readonly auth = inject(AuthService);
  private readonly theme = inject(CrmThemeService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private requestVersion = 0;
  private syncVersion = 0;
  private renderedStale: boolean | null = null;
  private statusTimer?: ReturnType<typeof setTimeout>;
  readonly kinds = Object.entries(CRM_CALENDAR_KIND_LABELS).map(([kind, label]) => ({
    kind, label, color: CRM_CALENDAR_KIND_THEME_COLORS[kind as keyof typeof CRM_CALENDAR_KIND_THEME_COLORS],
  }));
  readonly month = signal(new Date());
  readonly view = signal<'dayGridMonth' | 'listMonth'>('dayGridMonth');
  readonly items = signal<CrmCalendarItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly isCurrentMonth = signal(true);
  readonly syncHealth = signal<CrmCalendarSyncHealth | null>(null);
  readonly syncError = signal<string | null>(null);
  readonly retryAt = signal<string | null>(null);
  readonly showConnectionPanel = signal(false);
  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, listPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: false,
    height: '100%',
    expandRows: true,
    fixedWeekCount: false,
    dayMaxEvents: 3,
    eventDisplay: 'block',
    eventContent: arg => {
      const escape = (value: string): string => value.replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      })[character] ?? character);
      const label = arg.event.extendedProps['kindLabel'] as string | null;
      return { html: `<span class="calendar-event-content">${label ? `<span class="calendar-kind-label">${escape(label)}</span>` : ''}<span class="calendar-event-title">${escape(arg.event.title)}</span></span>` };
    },
    eventClick: arg => void this.openItem(arg),
    datesSet: arg => this.onDatesSet(arg.view.calendar.getDate()),
    events: [],
  };

  ngOnInit(): void {
    const requested = this.route.snapshot.queryParamMap.get('month');
    if (requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested)) {
      const date = new Date(Number(requested.slice(0, 4)), Number(requested.slice(5)) - 1, 1);
      this.calendarOptions = { ...this.calendarOptions, initialDate: date };
    }
  }

  ngOnDestroy(): void {
    ++this.requestVersion;
    ++this.syncVersion;
    if (this.statusTimer) clearTimeout(this.statusTimer);
  }

  get isAdmin(): boolean { return this.auth.snapshot.roles.includes('admin'); }
  get isDarkMode(): boolean { return this.theme.isDarkMode; }
  get monthKey(): string { return formatLocalDate(this.month()).slice(0, 7); }
  get retryWaiting(): boolean {
    const retryAt = this.retryAt();
    return !!retryAt && Date.now() < Date.parse(retryAt);
  }

  get monthLabel(): string {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(this.month());
  }

  onDatesSet(date: Date): void {
    const month = new Date(date.getFullYear(), date.getMonth(), 1);
    const current = new Date();
    this.month.set(month);
    this.isCurrentMonth.set(month.getFullYear() === current.getFullYear() && month.getMonth() === current.getMonth());
    void this.load();
    void this.refreshSyncForMonth();
  }

  async refreshSyncForMonth(): Promise<void> {
    const version = ++this.syncVersion;
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.syncError.set(null); this.retryAt.set(null);
    try {
      const status = await this.repository.status(this.monthKey);
      if (version !== this.syncVersion) return;
      this.syncHealth.set(status);
      this.renderEvents();
      if (status.connectionStatus === 'connected' && status.monthImportStatus !== 'current') {
        await this.requestMonth(version);
      } else {
        this.scheduleStatusPoll(version);
      }
    } catch {
      if (version === this.syncVersion) {
        this.syncError.set('Microsoft sync status is unavailable. CRM dates remain visible.');
        this.scheduleStatusPoll(version);
      }
    }
  }

  async retryMonth(): Promise<void> {
    if (this.retryWaiting) return;
    const version = ++this.syncVersion;
    this.syncError.set(null); this.retryAt.set(null);
    await this.requestMonth(version);
  }

  private async requestMonth(version: number): Promise<void> {
    try {
      await this.admin.requestMonth(this.monthKey);
      if (version !== this.syncVersion) return;
      this.syncHealth.set(await this.repository.status(this.monthKey));
      this.renderEvents();
      this.scheduleStatusPoll(version);
    } catch (error) {
      if (version !== this.syncVersion) return;
      if (error instanceof CrmM365CalendarAdminError && error.status === 429) {
        this.retryAt.set(error.retryAt);
        this.syncError.set(error.retryAt ?
          'Too many month requests. Try again after the listed time.' :
          'Too many month requests. Try again shortly.');
      } else {
        this.syncError.set('Microsoft items could not be refreshed. CRM dates remain visible.');
      }
      this.scheduleStatusPoll(version);
    }
  }

  private scheduleStatusPoll(version: number): void {
    if (!this.browser) return;
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.statusTimer = setTimeout(() => void this.pollStatus(version), 10000);
  }

  private async pollStatus(version: number): Promise<void> {
    try {
      const prior = this.syncHealth();
      const status = await this.repository.status(this.monthKey);
      if (version !== this.syncVersion) return;
      this.syncHealth.set(status);
      this.renderEvents();
      if (status.monthImportStatus === 'current' || status.connectionStatus !== 'connected') {
        this.syncError.set(null);
        this.retryAt.set(null);
      }
      if (prior?.connectionStatus !== 'connected' && status.connectionStatus === 'connected' &&
        status.monthImportStatus !== 'current') {
        await this.requestMonth(version);
        return;
      }
      if (prior?.connectionStatus !== 'disconnected' && status.connectionStatus === 'disconnected') {
        await this.load();
      }
      if (status.monthImportStatus === 'current' &&
        (prior?.monthImportStatus !== 'current' ||
          prior.monthLastSuccessfulScanAt !== status.monthLastSuccessfulScanAt)) await this.load();
      this.scheduleStatusPoll(version);
    } catch {
      if (version === this.syncVersion) {
        this.syncError.set('Microsoft sync status is unavailable. CRM dates remain visible.');
        this.scheduleStatusPoll(version);
      }
    }
  }

  async load(): Promise<void> {
    const version = ++this.requestVersion;
    this.loading.set(true);
    this.error.set(null);
    try {
      const items = await this.repository.list(visibleMonthBounds(this.month()));
      if (version !== this.requestVersion) return;
      this.items.set(items);
      this.renderEvents(true);
    } catch {
      if (version !== this.requestVersion) return;
      this.items.set([]);
      this.renderEvents(true);
      this.error.set('The calendar could not be loaded. Please try again.');
    } finally {
      if (version === this.requestVersion) this.loading.set(false);
    }
  }

  private renderEvents(force = false): void {
    const health = this.syncHealth();
    const stale = health ? health.monthImportStatus !== 'current' : true;
    if (!force && this.renderedStale === stale) return;
    this.renderedStale = stale;
    this.calendarOptions = { ...this.calendarOptions, events: this.items().map(item =>
      toFullCalendarEvent(item.sourceType === 'microsoft' ? {
        ...item, isStale: stale,
      } : item)) };
  }

  previous(): void { this.calendar?.getApi()?.prev(); }
  next(): void { this.calendar?.getApi()?.next(); }
  today(): void { this.calendar?.getApi()?.today(); }
  setView(view: 'dayGridMonth' | 'listMonth'): void {
    this.view.set(view);
    this.calendar?.getApi()?.changeView(view);
  }

  async openItem(arg: EventClickArg): Promise<void> {
    const item = arg.event.extendedProps['item'] as CrmCalendarItem;
    try {
      const details = await this.repository.details(item);
      this.dialog.open(CalendarItemDetailsDialogComponent, {
        data: details, autoFocus: 'first-tabbable', restoreFocus: true,
        panelClass: this.theme.isDarkMode
          ? ['crm-calendar-dialog-panel', 'crm-theme-dark'] : 'crm-calendar-dialog-panel',
      });
    } catch {
      this.error.set('This item changed or is no longer available. Refresh the calendar and try again.');
    }
  }
}
