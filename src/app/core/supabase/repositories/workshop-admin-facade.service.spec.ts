import { TestBed } from '@angular/core/testing';

import { workshopOccurrenceFixture } from '../../testing/workshop-testing';
import { WorkshopAdminFacadeService } from './workshop-admin-facade.service';
import { WorkshopCatalogRepositoryService } from './workshop-catalog-repository.service';
import { WorkshopFinancialRepositoryService } from './workshop-financial-repository.service';
import { WorkshopOperationsRepositoryService } from './workshop-operations-repository.service';
import { WorkshopPrivacyRepositoryService } from './workshop-privacy-repository.service';

describe('WorkshopAdminFacadeService', () => {
  it('composes display reads while leaving mutations with capability repositories', async () => {
    const occurrence = workshopOccurrenceFixture();
    const catalog = jasmine.createSpyObj<WorkshopCatalogRepositoryService>(
      'catalog', ['listDefinitions', 'listOccurrences'],
    );
    catalog.listDefinitions.and.resolveTo([]);
    catalog.listOccurrences.and.resolveTo([occurrence]);
    const operations = jasmine.createSpyObj<WorkshopOperationsRepositoryService>(
      'operations', ['listMinimizedRoster', 'listWaitlist'],
    );
    operations.listMinimizedRoster.and.resolveTo([]);
    operations.listWaitlist.and.resolveTo([]);

    TestBed.configureTestingModule({
      providers: [
        WorkshopAdminFacadeService,
        { provide: WorkshopCatalogRepositoryService, useValue: catalog },
        { provide: WorkshopOperationsRepositoryService, useValue: operations },
        { provide: WorkshopFinancialRepositoryService, useValue: {} },
        { provide: WorkshopPrivacyRepositoryService, useValue: {} },
      ],
    });

    const facade = TestBed.inject(WorkshopAdminFacadeService);
    await expectAsync(facade.loadCatalogOverview()).toBeResolvedTo({
      definitions: [],
      occurrences: [occurrence],
    });
    expect(facade.catalog).toBe(catalog);
    await expectAsync(facade.loadOccurrenceOperations(occurrence.workshop_occurrence_id))
      .toBeResolvedTo({ roster: [], waitlist: [] });
    expect(operations.listMinimizedRoster)
      .toHaveBeenCalledWith(occurrence.workshop_occurrence_id);
    expect(operations.listWaitlist)
      .toHaveBeenCalledWith(occurrence.workshop_occurrence_id);
  });

  it('composes financial display reads without absorbing financial commands', async () => {
    const occurrence = workshopOccurrenceFixture();
    const catalog = jasmine.createSpyObj<WorkshopCatalogRepositoryService>(
      'catalog', ['getOccurrence'],
    );
    catalog.getOccurrence.and.resolveTo(occurrence);
    const financials = jasmine.createSpyObj<WorkshopFinancialRepositoryService>(
      'financials',
      ['getSummary', 'listEntries', 'listExpenses', 'listExceptions'],
    );
    const summary = {
      scopeType: 'occurrence' as const,
      scopeId: occurrence.workshop_occurrence_id,
      currency: 'USD' as const,
      grossRevenueMinor: 0,
      discountsMinor: 0,
      refundsMinor: 0,
      providerFeesMinor: 0,
      disputesAndReversalsMinor: 0,
      expensesMinor: 0,
      netIncomeMinor: 0,
      transactionCount: 0,
      openExceptionCount: 0,
    };
    financials.getSummary.and.resolveTo(summary);
    financials.listEntries.and.resolveTo([]);
    financials.listExpenses.and.resolveTo([]);
    financials.listExceptions.and.resolveTo([]);
    TestBed.configureTestingModule({
      providers: [
        WorkshopAdminFacadeService,
        { provide: WorkshopCatalogRepositoryService, useValue: catalog },
        { provide: WorkshopOperationsRepositoryService, useValue: {} },
        { provide: WorkshopFinancialRepositoryService, useValue: financials },
        { provide: WorkshopPrivacyRepositoryService, useValue: {} },
      ],
    });

    const result = await TestBed.inject(WorkshopAdminFacadeService)
      .loadFinancialOverview(occurrence.workshop_occurrence_id);

    expect(result).toEqual({
      occurrence, summary, entries: [], expenses: [], exceptions: [],
    });
    expect(financials.getSummary).toHaveBeenCalledWith({
      occurrenceId: occurrence.workshop_occurrence_id,
    });
  });
});
