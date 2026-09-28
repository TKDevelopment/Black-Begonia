import { TestBed } from '@angular/core/testing';
import { CrmM365CalendarAdminService } from '../../../../core/supabase/services/crm-m365-calendar-admin.service';
import { CalendarConnectionPanelComponent } from './calendar-connection-panel.component';

describe('CalendarConnectionPanelComponent', () => {
  let admin: jasmine.SpyObj<CrmM365CalendarAdminService>;
  beforeEach(async () => {
    admin = jasmine.createSpyObj<CrmM365CalendarAdminService>('CalendarAdmin', [
      'listCalendars', 'connect', 'refresh', 'disconnect', 'listConflicts', 'restoreConflict',
    ]);
    await TestBed.configureTestingModule({
      imports: [CalendarConnectionPanelComponent],
      providers: [{ provide: CrmM365CalendarAdminService, useValue: admin }],
    }).compileComponents();
  });

  it('shows staff-safe status without administrator controls', () => {
    const fixture = TestBed.createComponent(CalendarConnectionPanelComponent);
    fixture.componentInstance.isAdmin = false;
    fixture.componentInstance.health = {
      connectionStatus: 'connected', calendarDisplayName: 'Business',
      lastSuccessfulSyncAt: '2026-10-01T12:00:00Z', lastRunStatus: 'succeeded',
      lastErrorCode: null, openConflictCount: 1, staleMirrorWarning: false,
      requestedMonth: null, monthImportStatus: 'current', monthLastSuccessfulScanAt: null,
    };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Business');
    expect(fixture.nativeElement.textContent).toContain('Only an administrator');
    expect(fixture.nativeElement.textContent).not.toContain('Disconnect');
  });

  it('lets an administrator review and queue restoration through the application service', async () => {
    const fixture = TestBed.createComponent(CalendarConnectionPanelComponent);
    fixture.componentInstance.isAdmin = true;
    admin.listConflicts.and.resolveTo([{ conflictId: 'conflict-1', sourceType: 'project_event',
      sourceId: '1', sourceTitle: 'Ada & Bea - Wedding', changedFields: ['time'],
      remoteTitle: null, remoteStartAt: null, remoteEndAt: null, isRemotePrivate: true,
      detectedAt: '2026-10-01T12:00:00Z', status: 'open' }]);
    admin.restoreConflict.and.resolveTo({ status: 'queued', conflictId: 'conflict-1' });
    await fixture.componentInstance.loadConflicts();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ada & Bea - Wedding');
    expect(fixture.nativeElement.textContent).not.toContain('Remote title:');
    await fixture.componentInstance.restore('conflict-1');
    expect(admin.restoreConflict).toHaveBeenCalledWith('conflict-1');
  });

  it('shows a stale mirror warning after disconnect', () => {
    const fixture = TestBed.createComponent(CalendarConnectionPanelComponent);
    fixture.componentInstance.health = {
      connectionStatus: 'disconnected', calendarDisplayName: 'Business',
      lastSuccessfulSyncAt: '2026-10-01T12:00:00Z', lastRunStatus: 'failed',
      lastErrorCode: null, openConflictCount: 0, staleMirrorWarning: true,
      requestedMonth: null, monthImportStatus: 'stale', monthLastSuccessfulScanAt: null,
    };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Business');
    expect(fixture.nativeElement.textContent).toContain('Last successful sync');
    expect(fixture.nativeElement.textContent).toContain('Existing Outlook copies may be out of date');
  });

  it('selects a business calendar and reports connect, refresh, and disconnect actions', async () => {
    const fixture = TestBed.createComponent(CalendarConnectionPanelComponent);
    const component = fixture.componentInstance;
    component.isAdmin = true;
    component.health = {
      connectionStatus: 'connected', calendarDisplayName: 'Business',
      lastSuccessfulSyncAt: null, lastRunStatus: null, lastErrorCode: null,
      openConflictCount: 0, staleMirrorWarning: false, requestedMonth: null,
      monthImportStatus: 'current', monthLastSuccessfulScanAt: null,
    };
    const changed = jasmine.createSpy('changed');
    component.changed.subscribe(changed);
    admin.listCalendars.and.resolveTo([
      { id: 'primary', name: 'Business', isDefaultCalendar: true },
      { id: 'secondary', name: 'Workshops', isDefaultCalendar: false },
    ]);
    admin.connect.and.resolveTo({ status: 'queued', calendarDisplayName: 'Workshops', runId: 'run-1' });
    admin.refresh.and.resolveTo({ status: 'queued', runId: 'run-2' });
    admin.disconnect.and.resolveTo({ status: 'disconnected', staleMirrorWarning: true });

    await component.loadCalendars();
    fixture.detectChanges();
    expect(component.selectedCalendarId).toBe('primary');
    expect(fixture.nativeElement.textContent).toContain('Workshops');
    component.selectedCalendarId = 'secondary';
    await component.connect();
    expect(admin.connect).toHaveBeenCalledWith('secondary');
    expect(component.message()).toContain('Initial synchronization is queued');
    await component.refresh();
    expect(admin.refresh).toHaveBeenCalled();
    await component.disconnect();
    expect(admin.disconnect).toHaveBeenCalled();
    expect(component.message()).toContain('Existing Microsoft mirrors remain');
    expect(changed).toHaveBeenCalledTimes(3);
    expect(component.busy()).toBeFalse();
  });

  it('keeps a failed administrator action safe and clears its busy state', async () => {
    const fixture = TestBed.createComponent(CalendarConnectionPanelComponent);
    fixture.componentInstance.isAdmin = true;
    admin.listCalendars.and.rejectWith(new Error('provider secret response'));
    await fixture.componentInstance.loadCalendars();
    fixture.detectChanges();
    expect(fixture.componentInstance.busy()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('action could not be completed');
    expect(fixture.nativeElement.textContent).not.toContain('provider secret response');
  });
});
