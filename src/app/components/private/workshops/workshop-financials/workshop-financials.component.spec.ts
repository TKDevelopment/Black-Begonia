import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { workshopOccurrenceFixture } from '../../../../core/testing/workshop-testing';
import { WorkshopAdminFacadeService } from '../../../../core/supabase/repositories/workshop-admin-facade.service';
import { WorkshopFinancialRepositoryService } from '../../../../core/supabase/repositories/workshop-financial-repository.service';
import { WorkshopFinancialsComponent } from './workshop-financials.component';

describe('WorkshopFinancialsComponent', () => {
  let fixture: ComponentFixture<WorkshopFinancialsComponent>;
  let component: WorkshopFinancialsComponent;
  let financials: jasmine.SpyObj<WorkshopFinancialRepositoryService>;

  beforeEach(async () => {
    const facade = jasmine.createSpyObj<WorkshopAdminFacadeService>(
      'WorkshopAdminFacadeService', ['loadFinancialOverview'],
    );
    financials = jasmine.createSpyObj<WorkshopFinancialRepositoryService>(
      'WorkshopFinancialRepositoryService',
      [
        'uploadReceipt', 'recordExpense', 'getRefundEligibility',
        'requestStripeRefund', 'recordExternalRefund', 'resolveException',
        'exportEntries',
      ],
    );
    const entry = {
      source_type: 'transaction' as const,
      source_id: 'transaction-1',
      workshop_series_id: null,
      workshop_occurrence_id: 'occurrence-1',
      entry_date: '2026-08-01T12:00:00Z',
      entry_category: 'charge',
      signed_amount_minor: 15000,
      currency: 'USD' as const,
      method: 'stripe',
      transaction_state: 'paid',
      traceable_reference: 'STRIPE-1',
    };
    facade.loadFinancialOverview.and.resolveTo({
      occurrence: workshopOccurrenceFixture(),
      summary: {
        scopeType: 'occurrence',
        scopeId: 'occurrence-1',
        currency: 'USD',
        grossRevenueMinor: 15000,
        discountsMinor: 0,
        refundsMinor: 5000,
        providerFeesMinor: 450,
        disputesAndReversalsMinor: 0,
        expensesMinor: 2000,
        netIncomeMinor: 7550,
        transactionCount: 3,
        openExceptionCount: 1,
      },
      entries: [entry, {
        ...entry,
        source_id: 'dispute-1',
        entry_category: 'dispute',
        signed_amount_minor: -15000,
        transaction_state: 'disputed',
        traceable_reference: 'DISPUTE-1',
      }],
      expenses: [],
      exceptions: [{
        workshop_payment_exception_id: 'exception-1',
        workshop_booking_id: 'booking-1',
        workshop_occurrence_id: 'occurrence-1',
        workshop_payment_transaction_id: 'dispute-1',
        exception_type: 'dispute',
        urgency: 'urgent',
        state: 'open',
        amount_minor: 15000,
        currency: 'USD',
        summary: 'Dispute needs review.',
        safe_detail: 'Seats remain unchanged.',
        resolution: null,
        resolution_reference: null,
        resolved_at: null,
        created_at: '2026-08-01T12:00:00Z',
        updated_at: '2026-08-01T12:00:00Z',
      }],
    });
    financials.getRefundEligibility.and.resolveTo({
      eligible: true,
      transactionId: 'transaction-1',
      currency: 'USD',
      remainingRefundableMinor: 10000,
      providerChargeId: 'ch_1',
      provider: 'stripe',
      bookingId: 'booking-1',
      occurrenceId: 'occurrence-1',
    });
    financials.requestStripeRefund.and.resolveTo({
      state: 'provider_accepted', requestId: 'refund-1',
    });
    financials.recordExpense.and.resolveTo({
      replayed: false, expenseId: 'expense-1',
    });
    financials.resolveException.and.resolveTo({});
    financials.exportEntries.and.returnValue('"date","reference"');

    await TestBed.configureTestingModule({
      imports: [WorkshopFinancialsComponent],
      providers: [
        { provide: WorkshopAdminFacadeService, useValue: facade },
        { provide: WorkshopFinancialRepositoryService, useValue: financials },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'occurrence-1' } } },
        },
      ],
    }).compileComponents();
    spyOn(window, 'confirm').and.returnValue(true);
    fixture = TestBed.createComponent(WorkshopFinancialsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('presents distinguishable financial totals and dispute flags', () => {
    expect(fixture.nativeElement.textContent).toContain('Gross revenue');
    expect(fixture.nativeElement.textContent).toContain('$150.00');
    expect(fixture.nativeElement.textContent).toContain('Provider fees');
    expect(fixture.nativeElement.textContent).toContain('Disputes and reversals');
    expect(fixture.nativeElement.textContent).toContain('Seats remain unchanged');
  });

  it('rejects invalid expense amounts before repository mutation', async () => {
    component.expenseForm.patchValue({ description: 'Stems', amountMinor: 1.5 });
    await component.submitExpense();

    expect(financials.recordExpense).not.toHaveBeenCalled();
    expect(component.error()).toContain('whole-cent');
  });

  it('records valid expenses with occurrence scope', async () => {
    component.expenseForm.patchValue({
      description: 'Stems', amountMinor: 1200, category: 'materials',
      expenseDate: '2026-08-01',
    });
    await component.submitExpense();

    expect(financials.recordExpense).toHaveBeenCalledWith(
      jasmine.objectContaining({
        occurrenceId: 'occurrence-1',
        description: 'Stems',
        amountMinor: 1200,
      }),
      jasmine.any(String),
    );
  });

  it('confirms eligible refunds while explicitly preserving seat operations', async () => {
    await component.inspectRefund('transaction-1');
    component.refundForm.patchValue({ amountMinor: 2500 });
    await component.submitRefund();

    expect(window.confirm).toHaveBeenCalledWith(
      jasmine.stringMatching(/does not cancel seats.*capacity/i),
    );
    expect(financials.requestStripeRefund).toHaveBeenCalledWith(
      'transaction-1', 2500, 'customer_requested', jasmine.any(String),
    );
  });

  it('resolves exceptions without rewriting original history', async () => {
    await component.resolveException(component.exceptions()[0]);

    expect(window.confirm).toHaveBeenCalledWith(
      jasmine.stringMatching(/Original transactions remain immutable/),
    );
    expect(financials.resolveException).toHaveBeenCalledWith(
      'exception-1', 'provider_resolved', jasmine.any(String), jasmine.any(String),
    );
  });
});
