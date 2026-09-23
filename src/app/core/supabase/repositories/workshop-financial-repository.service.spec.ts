import { TestBed } from '@angular/core/testing';
import { SupabaseService } from '../clients/supabase.service';
import { WorkshopFinancialRepositoryService } from './workshop-financial-repository.service';

describe('WorkshopFinancialRepositoryService', () => {
  let service: WorkshopFinancialRepositoryService;
  let rpc: jasmine.Spy;
  let invoke: jasmine.Spy;
  let from: jasmine.Spy;

  beforeEach(() => {
    rpc = jasmine.createSpy('rpc').and.resolveTo({ data: {}, error: null });
    invoke = jasmine.createSpy('invoke').and.resolveTo({
      data: { state: 'provider_accepted', requestId: 'refund-1' },
      error: null,
    });
    from = jasmine.createSpy('from');
    const client = { rpc, from, functions: { invoke } };
    const supabase = jasmine.createSpyObj<SupabaseService>(
      'SupabaseService', ['getClient'],
    );
    supabase.getClient.and.returnValue(client as never);
    TestBed.configureTestingModule({
      providers: [
        WorkshopFinancialRepositoryService,
        { provide: SupabaseService, useValue: supabase },
      ],
    });
    service = TestBed.inject(WorkshopFinancialRepositoryService);
  });

  it('maps occurrence and series summaries without combining capability rules', async () => {
    rpc.and.resolveTo({
      data: {
        scopeType: 'occurrence',
        scopeId: 'occurrence-1',
        currency: 'USD',
        grossRevenueMinor: 15000,
        refundsMinor: 5000,
        expensesMinor: 2000,
        netIncomeMinor: 8000,
      },
      error: null,
    });

    const result = await service.getSummary({ occurrenceId: 'occurrence-1' });

    expect(result.grossRevenueMinor).toBe(15000);
    expect(rpc).toHaveBeenCalledWith('get_workshop_financial_summary', {
      p_workshop_occurrence_id: 'occurrence-1',
      p_workshop_series_id: null,
    });
  });

  it('validates refund eligibility at the database boundary and invokes only the refund endpoint', async () => {
    rpc.and.resolveTo({
      data: {
        eligible: true,
        transactionId: 'transaction-1',
        currency: 'USD',
        remainingRefundableMinor: 7500,
      },
      error: null,
    });

    const eligibility = await service.getRefundEligibility('transaction-1');
    const result = await service.requestStripeRefund(
      'transaction-1', 2500, 'customer_requested', 'command-1', 1,
    );

    expect(eligibility.remainingRefundableMinor).toBe(7500);
    expect(rpc).toHaveBeenCalledWith(
      'manage_workshop_refund_order',
      jasmine.objectContaining({
        p_action: 'eligibility',
        p_payload: { transactionId: 'transaction-1' },
      }),
    );
    expect(invoke).toHaveBeenCalledWith('refund-workshop-payment', {
      body: {
        workshopPaymentTransactionId: 'transaction-1',
        amountMinor: 2500,
        seatQuantity: 1,
        reason: 'customer_requested',
        commandKey: 'command-1',
      },
    });
    expect(result.state).toBe('provider_accepted');
  });

  it('loads one paid or partially refunded charge for each roster booking', async () => {
    const charges = [{
      workshop_payment_transaction_id: 'transaction-1',
      workshop_booking_id: 'booking-1',
      transaction_type: 'charge',
      provider: 'stripe',
      state: 'paid',
    }];
    const order = jasmine.createSpy('order').and.resolveTo({ data: charges, error: null });
    const stateFilter = jasmine.createSpy('stateFilter').and.returnValue({ order });
    const providerFilter = jasmine.createSpy('providerFilter')
      .and.returnValue({ in: stateFilter });
    const transactionFilter = jasmine.createSpy('transactionFilter')
      .and.returnValue({ eq: providerFilter });
    const bookingFilter = jasmine.createSpy('bookingFilter')
      .and.returnValue({ eq: transactionFilter });
    const select = jasmine.createSpy('select').and.returnValue({ in: bookingFilter });
    from.and.returnValue({ select });

    await expectAsync(service.listRefundableCharges(['booking-1']))
      .toBeResolvedTo(charges as never);

    expect(from).toHaveBeenCalledWith('workshop_payment_transactions');
    expect(bookingFilter).toHaveBeenCalledWith('workshop_booking_id', ['booking-1']);
    expect(transactionFilter).toHaveBeenCalledWith('transaction_type', 'charge');
    expect(providerFilter).toHaveBeenCalledWith('provider', 'stripe');
    expect(stateFilter).toHaveBeenCalledWith('state', ['paid', 'partially_refunded']);
  });

  it('normalizes expense input and keeps evidence in the private receipt namespace', async () => {
    rpc.and.resolveTo({
      data: { replayed: false, expenseId: 'expense-1' }, error: null,
    });

    await service.recordExpense({
      occurrenceId: 'occurrence-1',
      category: 'materials',
      description: ' Stems ',
      vendorOrPayee: ' Market ',
      amountMinor: 1250,
      expenseDate: '2026-08-01',
      receiptStoragePath: 'workshop-receipts/occurrence-1/receipt.pdf',
    }, 'command-expense');

    expect(rpc).toHaveBeenCalledWith('manage_workshop_expenses', {
      p_action: 'create',
      p_payload: jasmine.objectContaining({
        occurrenceId: 'occurrence-1',
        description: 'Stems',
        vendorOrPayee: 'Market',
        amountMinor: 1250,
        currency: 'USD',
        receiptStoragePath: 'workshop-receipts/occurrence-1/receipt.pdf',
      }),
      p_command_key: 'command-expense',
    });
  });

  it('maps exception resolution without a capacity command', async () => {
    await service.resolveException(
      'exception-1', 'provider_resolved', 'CRM-1', 'command-resolve',
    );

    expect(rpc.calls.argsFor(0)[1]).toEqual({
      p_action: 'resolve_exception',
      p_payload: {
        exceptionId: 'exception-1',
        resolution: 'provider_resolved',
        reference: 'CRM-1',
      },
      p_command_key: 'command-resolve',
    });
    expect(JSON.stringify(rpc.calls.allArgs())).not.toContain('cancel');
  });

  it('exports normalized reporting fields without attendee or receipt evidence', () => {
    const csv = service.exportEntries([{
      source_type: 'transaction',
      source_id: 'transaction-1',
      workshop_series_id: 'series-1',
      workshop_occurrence_id: 'occurrence-1',
      entry_date: '2026-08-01T12:00:00Z',
      entry_category: 'charge',
      signed_amount_minor: 7500,
      currency: 'USD',
      method: 'stripe',
      transaction_state: 'paid',
      traceable_reference: 'STRIPE-1',
    }]);

    expect(csv).toContain('"signed_amount_minor"');
    expect(csv).toContain('"STRIPE-1"');
    expect(csv).not.toContain('attendee');
    expect(csv).not.toContain('receipt_storage_path');
  });
});
