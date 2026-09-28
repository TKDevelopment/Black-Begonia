import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../auth/auth.service';
import {
  CRM_M365_CALENDAR_TRANSPORT, CrmM365CalendarAdminError, CrmM365CalendarAdminService,
  CrmM365CalendarTransport,
} from './crm-m365-calendar-admin.service';

describe('CrmM365CalendarAdminService', () => {
  let service: CrmM365CalendarAdminService;
  let transport: jasmine.SpyObj<CrmM365CalendarTransport>;
  const auth = { snapshot: { roles: ['admin'] as string[] } };
  beforeEach(() => {
    auth.snapshot.roles = ['admin'];
    transport = jasmine.createSpyObj<CrmM365CalendarTransport>('CalendarTransport', ['send']);
    TestBed.configureTestingModule({ providers: [
      CrmM365CalendarAdminService,
      { provide: CRM_M365_CALENDAR_TRANSPORT, useValue: transport },
      { provide: AuthService, useValue: auth },
    ] });
    service = TestBed.inject(CrmM365CalendarAdminService);
  });

  it('passes a month request through the application transport', async () => {
    transport.send.and.resolveTo({ status: 'queued', runId: 'run-1' });
    expect((await service.requestMonth('2026-10')).status).toBe('queued');
    expect(transport.send).toHaveBeenCalledWith('requestMonth', { month: '2026-10' });
  });

  it('exposes only calendar choices returned for the administrator', async () => {
    transport.send.and.resolveTo({ calendars: [{ id: 'one', name: 'Business', isDefaultCalendar: true }] });
    expect(await service.listCalendars()).toEqual([
      { id: 'one', name: 'Business', isDefaultCalendar: true },
    ]);
  });

  it('keeps refresh, disconnect, and conflict restoration as explicit actions', async () => {
    transport.send.and.resolveTo({ status: 'queued', runId: 'run-1' });
    await service.refresh('2026-10');
    await service.disconnect();
    await service.restoreConflict('conflict-1');
    expect(transport.send).toHaveBeenCalledWith('refresh', { month: '2026-10' });
    expect(transport.send).toHaveBeenCalledWith('disconnect');
    expect(transport.send).toHaveBeenCalledWith('restoreConflict', { conflictId: 'conflict-1' });
  });

  it('reconnects to the selected calendar and propagates refresh failure', async () => {
    transport.send.and.resolveTo({ status: 'queued', calendarDisplayName: 'Business', runId: 'run-2' });
    expect((await service.connect('calendar-1')).calendarDisplayName).toBe('Business');
    expect(transport.send).toHaveBeenCalledWith('connect', { calendarId: 'calendar-1' });
    transport.send.and.rejectWith(new Error('provider secret response'));
    await expectAsync(service.refresh()).toBeRejected();
  });

  it('rejects staff management calls before the transport boundary', async () => {
    auth.snapshot.roles = ['staff'];
    await expectAsync(service.listCalendars()).toBeRejected();
    expect(() => service.connect('calendar-1')).toThrow();
    expect(() => service.refresh()).toThrow();
    expect(() => service.disconnect()).toThrow();
    await expectAsync(service.listConflicts()).toBeRejected();
    expect(() => service.restoreConflict('conflict-1')).toThrow();
    expect(transport.send).not.toHaveBeenCalled();
  });

  it('provides safe action errors and keeps the month retry time', () => {
    const retryAt = '2026-10-01T13:00:00Z';
    const limited = new CrmM365CalendarAdminError('month_rate_limited', 429, retryAt);
    expect(limited.message).toContain('Too many month requests');
    expect(limited.retryAt).toBe(retryAt);
    expect(new CrmM365CalendarAdminError('provider_secret_response', 503).message)
      .toBe('The Microsoft calendar action could not be completed.');
  });
});
