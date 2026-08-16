import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { WorkshopsComponent } from '../../components/private/workshops/workshops.component';
import { WorkshopRosterComponent } from '../../components/private/workshops/workshop-roster/workshop-roster.component';
import { ToastService } from '../services/toast.service';
import { WorkshopCatalogRepositoryService } from '../supabase/repositories/workshop-catalog-repository.service';
import { WorkshopFinancialRepositoryService } from '../supabase/repositories/workshop-financial-repository.service';
import { WorkshopOperationsRepositoryService } from '../supabase/repositories/workshop-operations-repository.service';
import { createWorkshopScaleFixture } from './workshop-scale-fixtures';

const RUN_COUNT = 20;
const P95_LIMIT_MS = 2_000;

function percentile95(durations: number[]): number {
  const ordered = [...durations].sort((left, right) => left - right);
  return ordered[Math.ceil(ordered.length * 0.95) - 1];
}

describe('Workshop CRM representative scale performance', () => {
  const scale = createWorkshopScaleFixture();

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('retrieves and renders the 500-occurrence CRM list within two seconds at p95', async () => {
    const catalog = jasmine.createSpyObj<WorkshopCatalogRepositoryService>(
      'WorkshopCatalogRepositoryService',
      ['listOccurrences', 'listSeries'],
    );
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const toast = jasmine.createSpyObj<ToastService>('ToastService', ['showToast']);
    catalog.listOccurrences.and.callFake(async () => scale.occurrences);
    catalog.listSeries.and.resolveTo([]);

    await TestBed.configureTestingModule({
      imports: [WorkshopsComponent],
      providers: [
        { provide: WorkshopCatalogRepositoryService, useValue: catalog },
        { provide: Router, useValue: router },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkshopsComponent);
    const component = fixture.componentInstance;
    await measureLoadAndRender(fixture, component.load.bind(component), 1);
    const durations = await measureLoadAndRender(
      fixture, component.load.bind(component), RUN_COUNT,
    );
    const p95 = percentile95(durations);

    console.info(
      `[workshop-scale] CRM occurrence list: 500 rows, ${RUN_COUNT} runs, p95=${p95.toFixed(1)}ms`,
    );
    expect(fixture.nativeElement.querySelectorAll('article.workshop-row').length).toBe(500);
    expect(p95).toBeLessThan(P95_LIMIT_MS);
  });

  it('retrieves and renders a 100-row roster within two seconds at p95', async () => {
    const operations = jasmine.createSpyObj<WorkshopOperationsRepositoryService>(
      'WorkshopOperationsRepositoryService',
      [
        'listMinimizedRoster', 'listBookings', 'listAttendeesForBookings',
        'listWaitlist', 'getOperationalState',
      ],
    );
    operations.listMinimizedRoster.and.callFake(async () => scale.rosterPage);
    operations.listBookings.and.callFake(async () => scale.bookings.slice(0, 100));
    operations.listAttendeesForBookings.and.resolveTo([]);
    operations.listWaitlist.and.resolveTo([]);
    operations.getOperationalState.and.resolveTo({
      occurrenceId: 'occurrence-scale',
      lifecycle: 'published_open',
      availability: 'sold_out',
      capacity: 100,
      reservedQuantity: 100,
      remainingQuantity: 0,
      hasWaitingCustomers: false,
      completionReviewRequired: false,
    });
    const financials = jasmine.createSpyObj<WorkshopFinancialRepositoryService>(
      'WorkshopFinancialRepositoryService',
      ['listPendingVenmoAttempts', 'listRefundableCharges'],
    );
    financials.listPendingVenmoAttempts.and.resolveTo([]);
    financials.listRefundableCharges.and.resolveTo([]);

    await TestBed.configureTestingModule({
      imports: [WorkshopRosterComponent],
      providers: [
        provideRouter([]),
        { provide: WorkshopOperationsRepositoryService, useValue: operations },
        { provide: WorkshopFinancialRepositoryService, useValue: financials },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkshopRosterComponent);
    const component = fixture.componentInstance;
    await measureLoadAndRender(fixture, component.load.bind(component), 1);
    const durations = await measureLoadAndRender(
      fixture, component.load.bind(component), RUN_COUNT,
    );
    const p95 = percentile95(durations);

    console.info(
      `[workshop-scale] CRM roster: 100 rows, ${RUN_COUNT} runs, p95=${p95.toFixed(1)}ms`,
    );
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(100);
    expect(p95).toBeLessThan(P95_LIMIT_MS);
  });
});

async function measureLoadAndRender<T>(
  fixture: ComponentFixture<T>,
  load: () => Promise<void>,
  runCount: number,
): Promise<number[]> {
  const durations: number[] = [];
  for (let run = 0; run < runCount; run += 1) {
    const startedAt = performance.now();
    await load();
    fixture.detectChanges();
    await fixture.whenStable();
    durations.push(performance.now() - startedAt);
  }
  return durations;
}
