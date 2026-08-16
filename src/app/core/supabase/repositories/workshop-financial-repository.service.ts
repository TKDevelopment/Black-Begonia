import { Injectable } from '@angular/core';
import {
  WorkshopExpense,
  WorkshopExpenseInput,
  WorkshopFinancialEntry,
  WorkshopFinancialSummary,
  WorkshopPaymentTransaction,
  WorkshopPaymentException,
  WorkshopRefundEligibility,
  WorkshopRefundRequestResult,
  WorkshopVenmoPaymentAttempt,
  WorkshopVenmoReceiptResult,
} from '../../models/workshop-financial';
import { SupabaseService } from '../clients/supabase.service';

export type WorkshopFinancialScope =
  | { occurrenceId: string; seriesId?: never }
  | { occurrenceId?: never; seriesId: string };

@Injectable({ providedIn: 'root' })
export class WorkshopFinancialRepositoryService {
  constructor(private readonly supabase: SupabaseService) {}

  async listPendingVenmoAttempts(
    bookingIds: string[],
  ): Promise<WorkshopVenmoPaymentAttempt[]> {
    if (!bookingIds.length) return [];
    const { data, error } = await this.supabase.getClient()
      .from('workshop_payment_attempts')
      .select(
        'workshop_payment_attempt_id,workshop_booking_id,provider,' +
        'reconciliation_reference,state,amount_minor,currency,' +
        'effective_expires_at,created_at',
      )
      .in('workshop_booking_id', bookingIds)
      .eq('provider', 'direct_venmo')
      .in('state', ['active', 'processing'])
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as WorkshopVenmoPaymentAttempt[];
  }

  async listRefundableCharges(
    bookingIds: string[],
  ): Promise<WorkshopPaymentTransaction[]> {
    if (!bookingIds.length) return [];
    const { data, error } = await this.supabase.getClient()
      .from('workshop_payment_transactions')
      .select('*')
      .in('workshop_booking_id', bookingIds)
      .eq('transaction_type', 'charge')
      .in('state', ['paid', 'partially_refunded'])
      .order('occurred_at', { ascending: false });
    if (error) throw error;
    const seen = new Set<string>();
    return ((data ?? []) as unknown as WorkshopPaymentTransaction[])
      .filter((charge) => {
        if (seen.has(charge.workshop_booking_id)) return false;
        seen.add(charge.workshop_booking_id);
        return true;
      });
  }

  async recordVenmoReceipt(
    reference: string,
    providerPaymentId: string,
    amountMinor: number,
    occurredAt: string,
    commandKey: string,
  ): Promise<WorkshopVenmoReceiptResult> {
    const { data, error } = await this.supabase.getClient().rpc(
      'record_workshop_venmo_receipt',
      {
        p_reference: reference,
        p_provider_payment_id: providerPaymentId.trim(),
        p_amount_minor: amountMinor,
        p_currency: 'USD',
        p_occurred_at: occurredAt,
        p_command_key: commandKey,
      },
    );
    if (error) throw error;
    return data as WorkshopVenmoReceiptResult;
  }

  async listEntries(scope: WorkshopFinancialScope): Promise<WorkshopFinancialEntry[]> {
    let query = this.supabase.getClient()
      .from('workshop_financial_entries').select('*');
    query = scope.occurrenceId
      ? query.eq('workshop_occurrence_id', scope.occurrenceId)
      : query.eq('workshop_series_id', scope.seriesId);
    const { data, error } = await query.order('entry_date', { ascending: false });
    if (error) throw error;
    return (data ?? []) as WorkshopFinancialEntry[];
  }

  async getSummary(scope: WorkshopFinancialScope): Promise<WorkshopFinancialSummary> {
    const { data, error } = await this.supabase.getClient().rpc(
      'get_workshop_financial_summary',
      {
        p_workshop_occurrence_id: scope.occurrenceId ?? null,
        p_workshop_series_id: scope.seriesId ?? null,
      },
    );
    if (error) throw error;
    return data as WorkshopFinancialSummary;
  }

  async listExpenses(scope: WorkshopFinancialScope): Promise<WorkshopExpense[]> {
    let query = this.supabase.getClient().from('workshop_expenses').select('*');
    query = scope.occurrenceId
      ? query.eq('workshop_occurrence_id', scope.occurrenceId)
      : query.eq('workshop_series_id', scope.seriesId);
    const { data, error } = await query.order('incurred_on', { ascending: false });
    if (error) throw error;
    return (data ?? []) as WorkshopExpense[];
  }

  async listExceptions(occurrenceId: string): Promise<WorkshopPaymentException[]> {
    const { data, error } = await this.supabase.getClient()
      .from('workshop_payment_exceptions').select('*')
      .eq('workshop_occurrence_id', occurrenceId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as WorkshopPaymentException[];
  }

  async getRefundEligibility(transactionId: string): Promise<WorkshopRefundEligibility> {
    const { data, error } = await this.runRefundOrderCommand(
      'eligibility', { transactionId }, crypto.randomUUID(),
    );
    if (error) throw error;
    return data as WorkshopRefundEligibility;
  }

  async requestStripeRefund(
    transactionId: string,
    amountMinor: number,
    reason: string,
    commandKey: string,
    seatQuantity?: number,
  ): Promise<WorkshopRefundRequestResult> {
    const { data, error } = await this.supabase.getClient().functions.invoke(
      'refund-workshop-payment',
      {
        body: {
          workshopPaymentTransactionId: transactionId,
          amountMinor,
          ...(seatQuantity === undefined ? {} : { seatQuantity }),
          reason,
          commandKey,
        },
      },
    );
    if (error) throw error;
    return data as WorkshopRefundRequestResult;
  }

  async recordExpense(
    input: WorkshopExpenseInput,
    commandKey: string,
  ): Promise<{ replayed: boolean; expenseId: string }> {
    const { data, error } = await this.supabase.getClient().rpc(
      'manage_workshop_expenses',
      { p_action: 'create', p_payload: this.expensePayload(input), p_command_key: commandKey },
    );
    if (error) throw error;
    return data as { replayed: boolean; expenseId: string };
  }

  async correctExpense(
    originalExpenseId: string,
    input: WorkshopExpenseInput,
    commandKey: string,
  ): Promise<{ replayed: boolean; expenseId: string; reversalExpenseId: string }> {
    const { data, error } = await this.supabase.getClient().rpc(
      'manage_workshop_expenses',
      {
        p_action: 'correct',
        p_payload: { ...this.expensePayload(input), originalExpenseId },
        p_command_key: commandKey,
      },
    );
    if (error) throw error;
    return data as never;
  }

  async uploadReceipt(occurrenceId: string, file: File): Promise<string> {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const path = `workshop-receipts/${occurrenceId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await this.supabase.getClient().storage
      .from('workshop-receipts').upload(
        `${occurrenceId}/${path.split('/').pop()}`, file,
        { contentType: file.type, upsert: false },
      );
    if (error) throw error;
    return path;
  }

  async recordExternalRefund(
    transactionId: string,
    amountMinor: number,
    reference: string,
    reason: string,
    occurredAt: string,
    commandKey: string,
    seatQuantity?: number,
  ): Promise<unknown> {
    const { data, error } = seatQuantity === undefined
      ? await this.runFinancialCommand(
        'record_external_refund',
        {
          transactionId, amountMinor, currency: 'USD', reference, reason, occurredAt,
        },
        commandKey,
      )
      : await this.runRefundOrderCommand(
        'record_venmo',
      {
        transactionId, amountMinor, currency: 'USD', reference, reason, occurredAt,
        seatQuantity,
      },
      commandKey,
      );
    if (error) throw error;
    return data;
  }

  async resolveException(
    exceptionId: string,
    resolution: string,
    reference: string,
    commandKey: string,
  ): Promise<unknown> {
    const { data, error } = await this.runFinancialCommand(
      'resolve_exception', { exceptionId, resolution, reference }, commandKey,
    );
    if (error) throw error;
    return data;
  }

  exportEntries(entries: WorkshopFinancialEntry[]): string {
    const header = [
      'date', 'scope_series_id', 'scope_occurrence_id', 'source', 'category',
      'signed_amount_minor', 'currency', 'method', 'state', 'reference',
    ];
    const rows = entries.map(entry => [
      entry.entry_date,
      entry.workshop_series_id ?? '',
      entry.workshop_occurrence_id ?? '',
      entry.source_type,
      entry.entry_category,
      String(entry.signed_amount_minor),
      entry.currency,
      entry.method,
      entry.transaction_state,
      entry.traceable_reference,
    ]);
    return [header, ...rows]
      .map(row => row.map(value => this.csvValue(value)).join(',')).join('\n');
  }

  private runFinancialCommand(
    action: string,
    payload: Record<string, unknown>,
    commandKey: string,
  ) {
    return this.supabase.getClient().rpc('manage_workshop_financials', {
      p_action: action,
      p_payload: payload,
      p_command_key: commandKey,
    });
  }

  private runRefundOrderCommand(
    action: string,
    payload: Record<string, unknown>,
    commandKey: string,
  ) {
    return this.supabase.getClient().rpc('manage_workshop_refund_order', {
      p_action: action,
      p_payload: payload,
      p_command_key: commandKey,
    });
  }

  private expensePayload(input: WorkshopExpenseInput): Record<string, unknown> {
    return {
      occurrenceId: input.occurrenceId ?? null,
      seriesId: input.seriesId ?? null,
      category: input.category,
      description: input.description.trim(),
      vendorOrPayee: input.vendorOrPayee?.trim() || null,
      note: input.note?.trim() || null,
      amountMinor: input.amountMinor,
      currency: 'USD',
      expenseDate: input.expenseDate,
      receiptStoragePath: input.receiptStoragePath ?? null,
    };
  }

  private csvValue(value: string): string {
    return `"${value.replaceAll('"', '""')}"`;
  }
}
