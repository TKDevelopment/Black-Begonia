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

  it('loads active direct-Venmo attempts and records receipt facts through the authoritative command', async () => {
    const attempts = [{
      workshop_payment_attempt_id: 'attempt-1',
      workshop_booking_id: 'booking-1',
      provider: 'direct_venmo',
      reconciliation_reference: 'BBW-ATTEMPT-1',
      state: 'active',
      amount_minor: 10000,
      currency: 'USD',
      effective_expires_at: '2026-08-16T17:00:00Z',
      created_at: '2026-08-04T17:00:00Z',
    }];
    const order = jasmine.createSpy('order').and.resolveTo({ data: attempts, error: null });
    const stateFilter = jasmine.createSpy('stateFilter').and.returnValue({ order });
    const providerFilter = jasmine.createSpy('providerFilter').and.returnValue({ in: stateFilter });
    const bookingFilter = jasmine.createSpy('bookingFilter').and.returnValue({ eq: providerFilter });
    const select = jasmine.createSpy('select').and.returnValue({ in: bookingFilter });
    from.and.returnValue({ select });
    rpc.and.resolveTo({
      data: { replayed: false, state: 'confirmed', bookingId: 'booking-1' },
      error: null,
    });

    await expectAsync(service.listPendingVenmoAttempts(['booking-1']))
      .toBeResolvedTo(attempts as never);
    await service.recordVenmoReceipt(
      'BBW-ATTEMPT-1', 'VENMO-TRANSACTION-123', 10000,
      '2026-08-04T18:30:00Z', 'command-venmo',
    );

    expect(from).toHaveBeenCalledOnceWith('workshop_payment_attempts');
    expect(bookingFilter).toHaveBeenCalledWith('workshop_booking_id', ['booking-1']);
    expect(providerFilter).toHaveBeenCalledWith('provider', 'direct_venmo');
    expect(stateFilter).toHaveBeenCalledWith('state', ['active', 'processing']);
    expect(rpc).toHaveBeenCalledWith('record_workshop_venmo_receipt', {
      p_reference: 'BBW-ATTEMPT-1',
      p_provider_payment_id: 'VENMO-TRANSACTION-123',
      p_amount_minor: 10000,
      p_currency: 'USD',
      p_occurred_at: '2026-08-04T18:30:00Z',
      p_command_key: 'command-venmo',
    });
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
    const transactionFilter = jasmine.createSpy('transactionFilter')
      .and.returnValue({ in: stateFilter });
    const bookingFilter = jasmine.createSpy('bookingFilter')
      .and.returnValue({ eq: transactionFilter });
    const select = jasmine.createSpy('select').and.returnValue({ in: bookingFilter });
    from.and.returnValue({ select });

    await expectAsync(service.listRefundableCharges(['booking-1']))
      .toBeResolvedTo(charges as never);

    expect(from).toHaveBeenCalledWith('workshop_payment_transactions');
    expect(bookingFilter).toHaveBeenCalledWith('workshop_booking_id', ['booking-1']);
    expect(transactionFilter).toHaveBeenCalledWith('transaction_type', 'charge');
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

  it('maps external refunds and exception resolution without a capacity command', async () => {
    await service.recordExternalRefund(
      'transaction-1', 1000, 'VENMO-REFUND-1', 'customer_requested',
      '2026-08-01T12:00:00Z', 'command-external',
    );
    await service.resolveException(
      'exception-1', 'provider_resolved', 'CRM-1', 'command-resolve',
    );

    expect(rpc.calls.argsFor(0)[1]).toEqual({
      p_action: 'record_external_refund',
      p_payload: {
        transactionId: 'transaction-1',
        amountMinor: 1000,
        currency: 'USD',
        reference: 'VENMO-REFUND-1',
        reason: 'customer_requested',
        occurredAt: '2026-08-01T12:00:00Z',
      },
      p_command_key: 'command-external',
    });
    expect(rpc.calls.argsFor(1)[1]).toEqual({
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

  it('records a manually completed Venmo refund with its selected seat quantity', async () => {
    await service.recordExternalRefund(
      'transaction-1', 5000, 'VENMO-REFUND-2', 'customer_requested',
      '2026-08-04T12:00:00Z', 'command-refund-order', 1,
    );

    expect(rpc).toHaveBeenCalledWith('manage_workshop_refund_order', {
      p_action: 'record_venmo',
      p_payload: jasmine.objectContaining({
        transactionId: 'transaction-1',
        amountMinor: 5000,
        seatQuantity: 1,
        reference: 'VENMO-REFUND-2',
      }),
      p_command_key: 'command-refund-order',
    });
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
