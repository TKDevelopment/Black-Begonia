import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { CrmCalendarRepositoryService } from '../../../core/supabase/repositories/crm-calendar-repository.service';
import { CrmM365CalendarAdminError, CrmM365CalendarAdminService } from '../../../core/supabase/services/crm-m365-calendar-admin.service';
import { CrmThemeService } from '../../../core/services/crm-theme.service';
import { formatLocalDate } from '../../../core/utils/crm-calendar-date';

import { CalendarComponent } from './calendar.component';

describe('CalendarComponent', () => {
  let component: CalendarComponent;
  let fixture: ComponentFixture<CalendarComponent>;
  let repository: jasmine.SpyObj<CrmCalendarRepositoryService>;
  let admin: jasmine.SpyObj<CrmM365CalendarAdminService>;

  beforeEach(async () => {
    repository = jasmine.createSpyObj<CrmCalendarRepositoryService>('CrmCalendarRepositoryService', ['list', 'details', 'status']);
    repository.list.and.resolveTo([]);
    repository.status.and.resolveTo({
      connectionStatus: 'disconnected', calendarDisplayName: null, lastSuccessfulSyncAt: null,
      lastRunStatus: null, lastErrorCode: null, openConflictCount: 0,
      staleMirrorWarning: false, requestedMonth: null,
      monthImportStatus: 'not_loaded', monthLastSuccessfulScanAt: null,
    });
    admin = jasmine.createSpyObj<CrmM365CalendarAdminService>('CrmM365CalendarAdminService', ['requestMonth']);
    admin.requestMonth.and.resolveTo({ status: 'queued' });
    await TestBed.configureTestingModule({
      imports: [CalendarComponent],
      providers: [provideRouter([]),
        { provide: CrmCalendarRepositoryService, useValue: repository },
        { provide: CrmM365CalendarAdminService, useValue: admin },
        { provide: AuthService, useValue: { snapshot: { roles: [] } } },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(CalendarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('switches Month and List without losing the active month', () => {
    const month = component.month().getMonth();
    component.setView('listMonth');
    expect(component.view()).toBe('listMonth');
    expect(component.month().getMonth()).toBe(month);
    component.setView('dayGridMonth');
    expect(component.view()).toBe('dayGridMonth');
  });

  it('disables Today in the current month and crosses a year boundary', () => {
    component['calendar'] = { getApi: () => ({
      next: () => component.onDatesSet(new Date(2027, 0, 1)),
      today: () => component.onDatesSet(new Date()),
    }) } as never;
    component.next();
    expect(component.month().getFullYear()).toBe(2027);
    expect(component.month().getMonth()).toBe(0);
    component.today();
    expect(component.isCurrentMonth()).toBeTrue();
  });

  it('shows a safe retry message when a month read fails', async () => {
    repository.list.and.rejectWith(new Error('secret provider details'));
    await component.load();
    fixture.detectChanges();
    expect(component.error()).toContain('could not be loaded');
    expect(fixture.nativeElement.textContent).not.toContain('secret provider details');
  });

  it('ignores a late response after the user changes months', async () => {
    let resolveOld!: (value: never[]) => void;
    repository.list.and.returnValues(new Promise(resolve => resolveOld = resolve), Promise.resolve([]));
    const old = component.load();
    component.onDatesSet(new Date(2027, 0, 1));
    await Promise.resolve();
    resolveOld([]);
    await old;
    expect(component.month().getFullYear()).toBe(2027);
    expect(component.loading()).toBeFalse();
  });

  it('reloads items when a scheduled scan updates the same month', async () => {
    const health = {
      connectionStatus: 'connected' as const, calendarDisplayName: 'Business',
      lastSuccessfulSyncAt: '2026-09-27T12:00:00Z', lastRunStatus: 'succeeded',
      lastErrorCode: null, openConflictCount: 0, staleMirrorWarning: false,
      requestedMonth: null, monthImportStatus: 'current' as const,
      monthLastSuccessfulScanAt: '2026-09-27T12:00:00Z',
    };
    repository.status.and.resolveTo(health);
    await component.refreshSyncForMonth();
    const reads = repository.list.calls.count();
    repository.status.and.resolveTo({ ...health, monthLastSuccessfulScanAt: '2026-09-27T12:05:00Z' });
    await component['pollStatus'](component['syncVersion']);
    expect(repository.list.calls.count()).toBe(reads + 1);
  });

  it('opens details in a dialog pane with the active CRM theme', async () => {
    const theme = TestBed.inject(CrmThemeService);
    const original = theme.mode();
    theme.setMode('dark');
    const open = spyOn(TestBed.inject(Dialog), 'open');
    const item = {
      id: 'lead_event:1', sourceType: 'lead_event' as const, sourceId: '1',
      title: 'Ada & Bea - Wedding', start: '2026-10-17', end: '2026-10-18',
      allDay: true, localDate: '2026-10-17', status: 'new', isInactive: false,
      colorType: 'lead' as const, destination: '/admin/leads/1',
    };
    repository.details.and.resolveTo(item);
    try {
      await component.openItem({ event: { extendedProps: { item } } } as never);
      expect(open).toHaveBeenCalled();
      expect(open.calls.mostRecent().args[1]?.panelClass)
        .toEqual(['crm-calendar-dialog-panel', 'crm-theme-dark']);
    } finally {
      theme.setMode(original);
    }
  });

  it('orders list items by date and offers a crowded-day overflow link', async () => {
    const month = formatLocalDate(component.month()).slice(0, 7);
    const makeItem = (day: number, index: number) => ({
      id: `lead_event:${index}`, sourceType: 'lead_event' as const, sourceId: `${index}`,
      title: `Event ${index}`, start: `${month}-${String(day).padStart(2, '0')}`,
      end: `${month}-${String(day + 1).padStart(2, '0')}`,
      allDay: true, localDate: `${month}-${String(day).padStart(2, '0')}`,
      status: 'new', isInactive: false, colorType: 'lead' as const,
      destination: '/admin/leads/1',
    });
    repository.list.and.resolveTo([makeItem(18, 1), makeItem(8, 2),
      makeItem(8, 3), makeItem(8, 4), makeItem(8, 5), makeItem(8, 6)]);
    await component.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.fc-daygrid-more-link')).toBeTruthy();
    component.setView('listMonth');
    fixture.detectChanges();
    const titles = [...fixture.nativeElement.querySelectorAll('.fc-list-event-title')]
      .map((node: Element) => node.textContent?.trim() ?? '');
    expect(titles[0]).toContain('Event 2');
    expect(titles[titles.length - 1]).toContain('Event 1');
  });

  it('requests an untracked Microsoft month and keeps CRM items during import', async () => {
    const pending = {
      connectionStatus: 'connected' as const, calendarDisplayName: 'Business',
      lastSuccessfulSyncAt: null, lastRunStatus: 'queued', lastErrorCode: null,
      openConflictCount: 0, staleMirrorWarning: false, requestedMonth: component.monthKey,
      monthImportStatus: 'loading' as const, monthLastSuccessfulScanAt: null,
    };
    repository.status.and.resolveTo(pending);
    await component.refreshSyncForMonth();
    expect(admin.requestMonth).toHaveBeenCalledWith(component.monthKey);
    expect(component.syncHealth()?.monthImportStatus).toBe('loading');
    expect(repository.list).toHaveBeenCalled();
  });

  it('shows the server retry time when a month request is rate limited', async () => {
    repository.status.and.resolveTo({
      connectionStatus: 'connected', calendarDisplayName: 'Business',
      lastSuccessfulSyncAt: null, lastRunStatus: null, lastErrorCode: null,
      openConflictCount: 0, staleMirrorWarning: false, requestedMonth: null,
      monthImportStatus: 'not_loaded', monthLastSuccessfulScanAt: null,
    });
    admin.requestMonth.and.rejectWith(new CrmM365CalendarAdminError(
      'month_rate_limited', 429, '2026-10-01T13:00:00Z'));
    await component.refreshSyncForMonth();
    fixture.detectChanges();
    expect(component.retryAt()).toBe('2026-10-01T13:00:00Z');
    expect(component.retryWaiting).toBeTrue();
    const attempts = admin.requestMonth.calls.count();
    await component.retryMonth();
    expect(admin.requestMonth.calls.count()).toBe(attempts);
    expect(fixture.nativeElement.textContent).toContain('Too many month requests');
    expect(fixture.nativeElement.textContent).toContain('Retry');
    expect((fixture.nativeElement.querySelector('.calendar-sync-status button[disabled]') as HTMLButtonElement)).toBeTruthy();
  });

  it('keeps polling after dispatch failure and clears the error on completed import', async () => {
    const health = {
      connectionStatus: 'connected' as const, calendarDisplayName: 'Business',
      lastSuccessfulSyncAt: null, lastRunStatus: 'queued', lastErrorCode: null,
      openConflictCount: 0, staleMirrorWarning: false, requestedMonth: component.monthKey,
      monthImportStatus: 'loading' as const, monthLastSuccessfulScanAt: null,
    };
    repository.status.and.resolveTo(health);
    admin.requestMonth.and.rejectWith(new Error('dispatch unavailable'));
    await component.refreshSyncForMonth();
    expect(component.syncError()).toContain('could not be refreshed');
    repository.status.and.resolveTo({ ...health, monthImportStatus: 'current',
      monthLastSuccessfulScanAt: '2026-09-27T12:00:00Z' });
    await component['pollStatus'](component['syncVersion']);
    expect(component.syncError()).toBeNull();
    expect(repository.list).toHaveBeenCalled();
  });

  it('shows delayed and failed month states with Retry while preserving CRM items', async () => {
    const base = {
      connectionStatus: 'connected' as const, calendarDisplayName: 'Business',
      lastSuccessfulSyncAt: '2026-09-27T12:00:00Z', lastRunStatus: 'failed',
      lastErrorCode: 'graph_unavailable', openConflictCount: 0, staleMirrorWarning: false,
      requestedMonth: component.monthKey, monthLastSuccessfulScanAt: null,
    };
    repository.status.and.resolveTo({ ...base, monthImportStatus: 'delayed' });
    await component['pollStatus'](component['syncVersion']);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Microsoft items are delayed');
    expect(fixture.nativeElement.querySelectorAll('.calendar-sync-status button').length).toBeGreaterThan(0);
    repository.status.and.resolveTo({ ...base, monthImportStatus: 'failed' });
    await component['pollStatus'](component['syncVersion']);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Microsoft items are failed');
    await component.retryMonth();
    expect(admin.requestMonth).toHaveBeenCalledWith(component.monthKey);
    expect(repository.list).toHaveBeenCalled();
  });

  it('shows last success and conflict status without exposing provider failure details', async () => {
    repository.status.and.resolveTo({
      connectionStatus: 'action_required', calendarDisplayName: 'Business',
      lastSuccessfulSyncAt: '2026-09-27T12:00:00Z', lastRunStatus: 'failed',
      lastErrorCode: 'provider_secret_response', openConflictCount: 2,
      staleMirrorWarning: false, requestedMonth: null,
      monthImportStatus: 'failed', monthLastSuccessfulScanAt: null,
    });
    await component.refreshSyncForMonth();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Last synced');
    expect(fixture.nativeElement.textContent).toContain('2 conflicts');
    expect(fixture.nativeElement.textContent).toContain('administrator attention');
    expect(fixture.nativeElement.textContent).not.toContain('provider_secret_response');
  });

  it('shows one linked CRM item alongside a separate Microsoft-only event', async () => {
    const month = formatLocalDate(component.month()).slice(0, 7);
    repository.list.and.resolveTo([{
      id: 'project_event:1', sourceType: 'project_event', sourceId: '1',
      title: 'Ada & Bea - Wedding', start: `${month}-12`, end: `${month}-13`,
      allDay: true, localDate: `${month}-12`, status: 'booked', isInactive: false,
      colorType: 'project', destination: '/admin/projects/1',
    }, {
      id: 'microsoft:conn:other', sourceType: 'microsoft', sourceId: null,
      title: 'Supplier meeting', start: `${month}-13`, end: `${month}-14`,
      allDay: true, localDate: `${month}-13`, status: null, isInactive: false,
      colorType: 'microsoft', destination: null,
    }]);
    await component.load();
    fixture.detectChanges();
    expect(component.items().length).toBe(2);
    expect(fixture.nativeElement.querySelector('.crm-calendar-project .calendar-event-title')?.textContent)
      .toBe('Ada & Bea');
    expect(component.items()[0].title).toBe('Ada & Bea - Wedding');
    expect(fixture.nativeElement.textContent).toContain('Supplier meeting');
  });

  it('marks cached Microsoft events stale until the month scan completes', async () => {
    const month = formatLocalDate(component.month()).slice(0, 7);
    repository.list.and.resolveTo([{
      id: 'microsoft:conn:other', sourceType: 'microsoft', sourceId: null,
      title: 'Supplier meeting', start: `${month}-13`, end: `${month}-14`,
      allDay: true, localDate: `${month}-13`, status: null, isInactive: false,
      colorType: 'microsoft', destination: null,
    }]);
    const health = {
      connectionStatus: 'connected' as const, calendarDisplayName: 'Business',
      lastSuccessfulSyncAt: null, lastRunStatus: 'queued', lastErrorCode: null,
      openConflictCount: 0, staleMirrorWarning: false, requestedMonth: component.monthKey,
      monthImportStatus: 'loading' as const, monthLastSuccessfulScanAt: null,
    };
    repository.status.and.resolveTo(health);
    await component.load();
    await component.refreshSyncForMonth();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.crm-calendar-stale')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Microsoft · Stale');
    repository.status.and.resolveTo({ ...health, monthImportStatus: 'current',
      monthLastSuccessfulScanAt: '2026-09-27T12:00:00Z' });
    await component['pollStatus'](component['syncVersion']);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.crm-calendar-stale')).toBeNull();
  });

  it('removes cached Microsoft items when another administrator disconnects', async () => {
    const month = formatLocalDate(component.month()).slice(0, 7);
    repository.list.and.resolveTo([{
      id: 'microsoft:conn:other', sourceType: 'microsoft', sourceId: null,
      title: 'Supplier meeting', start: `${month}-13`, end: `${month}-14`,
      allDay: true, localDate: `${month}-13`, status: null, isInactive: false,
      colorType: 'microsoft', destination: null,
    }]);
    repository.status.and.resolveTo({
      connectionStatus: 'connected', calendarDisplayName: 'Business',
      lastSuccessfulSyncAt: '2026-09-27T12:00:00Z', lastRunStatus: 'succeeded',
      lastErrorCode: null, openConflictCount: 0, staleMirrorWarning: false,
      requestedMonth: component.monthKey, monthImportStatus: 'current',
      monthLastSuccessfulScanAt: '2026-09-27T12:00:00Z',
    });
    await component.load();
    await component.refreshSyncForMonth();
    repository.list.and.resolveTo([]);
    repository.status.and.resolveTo({
      connectionStatus: 'disconnected', calendarDisplayName: 'Business',
      lastSuccessfulSyncAt: '2026-09-27T12:00:00Z', lastRunStatus: 'succeeded',
      lastErrorCode: null, openConflictCount: 0, staleMirrorWarning: true,
      requestedMonth: component.monthKey, monthImportStatus: 'stale',
      monthLastSuccessfulScanAt: '2026-09-27T12:00:00Z',
    });
    await component['pollStatus'](component['syncVersion']);
    expect(component.items()).toEqual([]);
  });

  it('keeps month controls and the calendar scrollable at narrow widths', () => {
    fixture.detectChanges();
    const header = fixture.nativeElement.querySelector('.crm-calendar-header') as HTMLElement;
    const calendar = fixture.nativeElement.querySelector('full-calendar') as HTMLElement;
    expect(getComputedStyle(header).flexWrap).toBe('wrap');
    expect(getComputedStyle(calendar).overflowX).toBe('auto');
    for (const label of ['Previous month', 'Next month']) {
      const button = fixture.nativeElement.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
      expect(button.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
      expect(button.textContent?.trim()).toBe('');
      expect(button.getBoundingClientRect().width).toBeCloseTo(button.getBoundingClientRect().height, 0);
      expect(getComputedStyle(button).placeItems).toBe('center');
    }
  });

  it('uses distinct pastel colors for every calendar item type in light mode', async () => {
    const theme = TestBed.inject(CrmThemeService);
    const original = theme.mode();
    const month = formatLocalDate(component.month()).slice(0, 7);
    const kinds = [
      ['lead_event', 'lead', 'rgb(253, 230, 138)'],
      ['project_event', 'project', 'rgb(147, 197, 253)'],
      ['consultation', 'consultation', 'rgb(216, 180, 254)'],
      ['installment', 'installment', 'rgb(134, 239, 172)'],
      ['workshop', 'workshop', 'rgb(253, 164, 175)'],
      ['microsoft', 'microsoft', 'rgb(203, 213, 225)'],
    ] as const;
    repository.list.and.resolveTo(kinds.map(([sourceType, colorType], index) => ({
      id: `${sourceType}:${index}`, sourceType, sourceId: `${index}`,
      title: `Event ${index}`, start: `${month}-${String(index + 10).padStart(2, '0')}`,
      end: `${month}-${String(index + 11).padStart(2, '0')}`,
      allDay: true, localDate: `${month}-${String(index + 10).padStart(2, '0')}`,
      status: 'new', isInactive: false, colorType, destination: null,
    })));
    try {
      theme.setMode('light');
      await component.load();
      fixture.detectChanges();
      for (const [, kind, color] of kinds) {
        const event = fixture.nativeElement.querySelector(`.crm-calendar-${kind}`) as HTMLElement;
        expect(event).withContext(kind).toBeTruthy();
        expect(getComputedStyle(event).backgroundColor).withContext(kind).toBe(color);
        expect(getComputedStyle(event.querySelector('.fc-event-main') as Element).color)
          .withContext(kind).toBe('rgb(36, 50, 74)');
      }
    } finally {
      theme.setMode(original);
    }
  });

  it('fills the available screen height and keeps long labels inside event boxes', async () => {
    const month = formatLocalDate(component.month()).slice(0, 7);
    repository.list.and.resolveTo([{
      id: 'lead_event:long', sourceType: 'lead_event', sourceId: 'long',
      title: 'Alexandria & Christopher - Wedding', start: `${month}-12`, end: `${month}-13`,
      allDay: true, localDate: `${month}-12`, status: 'new', isInactive: false,
      colorType: 'lead', destination: '/admin/leads/long',
    }]);
    await component.load();
    fixture.detectChanges();
    const page = fixture.nativeElement.querySelector('.crm-calendar-page') as HTMLElement;
    const calendar = fixture.nativeElement.querySelector('full-calendar') as HTMLElement;
    const grid = calendar.querySelector('.fc-view-harness') as HTMLElement;
    const event = fixture.nativeElement.querySelector('.crm-calendar-lead') as HTMLElement;
    const legendLead = fixture.nativeElement.querySelector('.calendar-legend span:first-child i') as HTMLElement;
    const title = event.querySelector('.calendar-event-title') as HTMLElement;
    expect(component.calendarOptions.height).toBe('100%');
    const reservedHeader = window.matchMedia('(max-width: 1023px)').matches ? 64 : 0;
    expect(page.getBoundingClientRect().height).toBeGreaterThanOrEqual(window.innerHeight - reservedHeader - 1);
    expect(page.getBoundingClientRect().bottom - calendar.getBoundingClientRect().bottom)
      .toBeLessThanOrEqual(parseFloat(getComputedStyle(page).paddingBottom) + 2);
    expect(calendar.getBoundingClientRect().bottom - grid.getBoundingClientRect().bottom)
      .toBeLessThanOrEqual(parseFloat(getComputedStyle(calendar).paddingBottom) + 2);
    expect(title.textContent).toBe('Alexandria & Christopher - Wedding');
    expect(getComputedStyle(title).textOverflow).toBe('ellipsis');
    expect(title.getBoundingClientRect().right).toBeLessThanOrEqual(event.getBoundingClientRect().right + 1);
    expect(getComputedStyle(event).backgroundColor).toBe('rgb(253, 230, 138)');
    expect(getComputedStyle(legendLead).backgroundColor).toBe('rgb(253, 230, 138)');
    expect(getComputedStyle(event.querySelector('.fc-event-main') as Element).color).toBe('rgb(36, 50, 74)');
    const theme = TestBed.inject(CrmThemeService);
    const original = theme.mode();
    try {
      theme.setMode('dark');
      fixture.detectChanges();
      expect(getComputedStyle(event).backgroundColor).toBe('rgb(157, 101, 0)');
      expect(getComputedStyle(legendLead).backgroundColor).toBe('rgb(157, 101, 0)');
    } finally {
      theme.setMode(original);
    }
  });
});
