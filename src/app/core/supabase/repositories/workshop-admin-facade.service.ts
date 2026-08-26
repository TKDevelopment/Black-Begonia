import { Injectable } from '@angular/core';
import { WorkshopCatalogRepositoryService } from './workshop-catalog-repository.service';
import { WorkshopFinancialRepositoryService } from './workshop-financial-repository.service';
import { WorkshopOperationsRepositoryService } from './workshop-operations-repository.service';
import { WorkshopPrivacyRepositoryService } from './workshop-privacy-repository.service';
import {
  WorkshopCatalogOverview,
  WorkshopOccurrence,
} from '../../models/workshop';
import {
  WorkshopRosterRow,
  WorkshopWaitlistEntry,
} from '../../models/workshop-booking';
import {
  WorkshopExpense,
  WorkshopFinancialEntry,
  WorkshopFinancialSummary,
  WorkshopPaymentException,
} from '../../models/workshop-financial';

export interface WorkshopOccurrenceOperationsOverview {
  roster: WorkshopRosterRow[];
  waitlist: WorkshopWaitlistEntry[];
}

export interface WorkshopOccurrenceDetailOverview
  extends WorkshopOccurrenceOperationsOverview {
  occurrence: WorkshopOccurrence | null;
}

export interface WorkshopFinancialOverview {
  occurrence: WorkshopOccurrence | null;
  summary: WorkshopFinancialSummary;
  entries: WorkshopFinancialEntry[];
  expenses: WorkshopExpense[];
  exceptions: WorkshopPaymentException[];
}

@Injectable({ providedIn: 'root' })
export class WorkshopAdminFacadeService {
  constructor(
    readonly catalog: WorkshopCatalogRepositoryService,
    readonly operations: WorkshopOperationsRepositoryService,
    readonly financials: WorkshopFinancialRepositoryService,
    readonly privacy: WorkshopPrivacyRepositoryService,
  ) {}

  async loadCatalogOverview(): Promise<WorkshopCatalogOverview> {
    const [definitions, occurrences] = await Promise.all([
      this.catalog.listDefinitions(),
      this.catalog.listOccurrences(),
    ]);
    return { definitions, occurrences };
  }

  async loadOccurrenceOperations(
    occurrenceId: string,
  ): Promise<WorkshopOccurrenceOperationsOverview> {
    const [roster, waitlist] = await Promise.all([
      this.operations.listMinimizedRoster(occurrenceId),
      this.operations.listWaitlist(occurrenceId),
    ]);
    return { roster, waitlist };
  }

  async loadOccurrenceDetail(
    occurrenceId: string,
  ): Promise<WorkshopOccurrenceDetailOverview> {
    const [occurrence, operations] = await Promise.all([
      this.catalog.getOccurrence(occurrenceId),
      this.loadOccurrenceOperations(occurrenceId),
    ]);
    return { occurrence, ...operations };
  }

  async loadFinancialOverview(occurrenceId: string): Promise<WorkshopFinancialOverview> {
    const [occurrence, summary, entries, expenses, exceptions] = await Promise.all([
      this.catalog.getOccurrence(occurrenceId),
      this.financials.getSummary({ occurrenceId }),
      this.financials.listEntries({ occurrenceId }),
      this.financials.listExpenses({ occurrenceId }),
      this.financials.listExceptions(occurrenceId),
    ]);
    return { occurrence, summary, entries, expenses, exceptions };
  }
}
