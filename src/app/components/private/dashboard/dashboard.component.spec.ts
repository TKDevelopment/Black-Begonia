import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CrmCalendarRepositoryService } from '../../../core/supabase/repositories/crm-calendar-repository.service';
import { formatLocalDate } from '../../../core/utils/crm-calendar-date';

import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  const calendarRepository = jasmine.createSpyObj<CrmCalendarRepositoryService>('CrmCalendarRepositoryService', ['list', 'status']);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideRouter([]), { provide: CrmCalendarRepositoryService, useValue: calendarRepository }],
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    calendarRepository.list.and.resolveTo([]);
    calendarRepository.status.and.resolveTo({
      connectionStatus: 'disconnected', calendarDisplayName: null, lastSuccessfulSyncAt: null,
      lastRunStatus: null, lastErrorCode: null, openConflictCount: 0,
      staleMirrorWarning: false, requestedMonth: null,
      monthImportStatus: 'not_loaded', monthLastSuccessfulScanAt: null,
    });
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders one full-width CRM page shell', () => {
    const shells = fixture.nativeElement.querySelectorAll('[data-crm-page-shell]');
    expect(shells.length).toBe(1);
    expect(shells[0].classList).toContain('crm-page-frame');
  });

  it('loads only the visible current month into a widget-ready layout', async () => {
    await fixture.whenStable();
    expect(calendarRepository.list).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('app-calendar-mini')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.dashboard-widgets')).toBeTruthy();
    expect(calendarRepository.status).toHaveBeenCalled();
  });

  it('keeps the CRM mini widget available during a Microsoft status outage', async () => {
    calendarRepository.status.and.rejectWith(new Error('provider outage'));
    await component.loadCalendar();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-calendar-mini')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('sync status is temporarily unavailable');
  });

  it('loads and renders 200 mixed calendar items within three seconds', async () => {
    const kinds = ['lead', 'project', 'consultation', 'installment', 'workshop'] as const;
    const month = formatLocalDate(component.month).slice(0, 7);
    const items = Array.from({ length: 200 }, (_, index) => {
      const day = String(1 + index % 28).padStart(2, '0');
      return {
        id: `item:${index}`, sourceType: 'lead_event' as const, sourceId: `${index}`,
        title: `Item ${index}`, start: `${month}-${day}`,
        end: `${month}-${String(2 + index % 28).padStart(2, '0')}`,
        allDay: true, localDate: `${month}-${day}`, status: 'new',
        isInactive: false, colorType: kinds[index % kinds.length], destination: null,
      };
    });
    calendarRepository.list.and.resolveTo(items);
    const started = performance.now();
    await component.loadCalendar();
    fixture.detectChanges();
    expect(component.items().length).toBe(200);
    expect(performance.now() - started).toBeLessThan(3000);
  });
});
