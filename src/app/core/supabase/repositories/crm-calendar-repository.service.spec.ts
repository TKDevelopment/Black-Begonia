import { TestBed } from '@angular/core/testing';
import { SupabaseService } from '../clients/supabase.service';
import { CrmCalendarReadError, CrmCalendarRepositoryService } from './crm-calendar-repository.service';
import { CrmCalendarItem } from '../../models/crm-calendar';

describe('CrmCalendarRepositoryService', () => {
  let repository: CrmCalendarRepositoryService;
  let rpc: jasmine.Spy;
  const item: CrmCalendarItem = {
    id: 'lead_event:1', sourceType: 'lead_event', sourceId: '1',
    title: 'Ava & Sam - Wedding', start: '2026-10-17', end: '2026-10-18',
    allDay: true, localDate: '2026-10-17', status: 'new', isInactive: false,
    colorType: 'lead', destination: '/admin/leads/1',
  };

  beforeEach(() => {
    rpc = jasmine.createSpy('rpc');
    const supabase = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['getClient']);
    supabase.getClient.and.returnValue({ rpc } as never);
    TestBed.configureTestingModule({ providers: [
      CrmCalendarRepositoryService, { provide: SupabaseService, useValue: supabase },
    ] });
    repository = TestBed.inject(CrmCalendarRepositoryService);
  });

  it('passes the half-open visible range to the server and returns typed items', async () => {
    rpc.and.resolveTo({ data: [item], error: null });
    await expectAsync(repository.list({ start: '2026-09-27', end: '2026-11-08' }))
      .toBeResolvedTo([item]);
    expect(rpc).toHaveBeenCalledWith('list_crm_calendar_items', {
      p_start_date: '2026-09-27', p_end_date: '2026-11-08',
    });
  });

  it('reads current details only when requested and maps a missing source', async () => {
    rpc.and.resolveTo({ data: { ...item, guestCount: 100 }, error: null });
    expect((await repository.details(item)).guestCount).toBe(100);
    expect(rpc).toHaveBeenCalledWith('get_crm_calendar_item_details', {
      p_source_type: 'lead_event', p_source_id: '1',
    });
    rpc.and.resolveTo({ data: null, error: { code: 'P0002' } });
    await expectAsync(repository.details(item)).toBeRejectedWith(jasmine.any(CrmCalendarReadError));
  });

  it('maps authorization and provider failures to safe messages', async () => {
    rpc.and.resolveTo({ data: null, error: { code: '42501', message: 'internal detail' } });
    await expectAsync(repository.list({ start: '2026-10-01', end: '2026-11-01' }))
      .toBeRejectedWithError('Your account cannot view the CRM calendar.');
    rpc.and.resolveTo({ data: null, error: { code: 'XX000', message: 'provider secret' } });
    await expectAsync(repository.list({ start: '2026-10-01', end: '2026-11-01' }))
      .toBeRejectedWithError('The calendar could not be loaded. Please try again.');
  });

  it('reads month-specific sync health without exposing raw association data', async () => {
    const status = { connectionStatus: 'connected', calendarDisplayName: 'Business',
      lastSuccessfulSyncAt: null, lastRunStatus: 'queued', lastErrorCode: null,
      openConflictCount: 0, staleMirrorWarning: false, requestedMonth: '2026-10-01',
      monthImportStatus: 'loading', monthLastSuccessfulScanAt: null };
    rpc.and.resolveTo({ data: status, error: null });
    expect((await repository.status('2026-10')).monthImportStatus).toBe('loading');
    expect(rpc).toHaveBeenCalledWith('get_crm_calendar_status', { p_month: '2026-10-01' });
  });
});
