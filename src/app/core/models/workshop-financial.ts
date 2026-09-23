import { WorkshopCurrency } from './workshop';

export type WorkshopTransactionType =
  | 'charge'
  | 'refund'
  | 'external_refund'
  | 'fee'
  | 'discount'
  | 'dispute'
  | 'reversal'
  | 'adjustment'
  | 'correction';
export type WorkshopPaymentExceptionState =
  | 'open'
  | 'acknowledged'
  | 'resolved';
export type WorkshopExpenseCategory =
  | 'materials'
  | 'venue'
  | 'labor'
  | 'marketing'
  | 'travel'
  | 'equipment'
  | 'fees'
  | 'other';

export interface WorkshopPaymentTransaction {
  workshop_payment_transaction_id: string;
  workshop_booking_id: string;
  workshop_occurrence_id: string;
  workshop_payment_attempt_id: string | null;
  transaction_type: WorkshopTransactionType;
  provider: 'stripe' | 'manual';
  provider_transaction_id: string | null;
  payment_reference: string;
  amount_minor: number;
  currency: WorkshopCurrency;
  occurred_at: string;
  state: string;
  actor_type: 'provider' | 'internal' | 'system';
  note: string | null;
  created_at: string;
}

export interface WorkshopPaymentException {
  workshop_payment_exception_id: string;
  workshop_booking_id: string | null;
  workshop_occurrence_id: string | null;
  workshop_payment_transaction_id: string | null;
  exception_type: string;
  urgency: 'normal' | 'urgent';
  state: WorkshopPaymentExceptionState;
  amount_minor: number | null;
  currency: WorkshopCurrency | null;
  summary: string;
  safe_detail: string | null;
  resolution: string | null;
  resolution_reference: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkshopExpense {
  workshop_expense_id: string;
  workshop_occurrence_id: string | null;
  workshop_series_id: string | null;
  expense_category: WorkshopExpenseCategory;
  description: string;
  vendor_or_payee: string | null;
  note: string | null;
  amount_minor: number;
  currency: WorkshopCurrency;
  incurred_on: string;
  receipt_storage_path: string | null;
  correction_of_expense_id: string | null;
  is_reversal: boolean;
  command_key: string;
  created_by: string | null;
  created_at: string;
}

export interface WorkshopFinancialEntry {
  source_type: 'transaction' | 'expense';
  source_id: string;
  workshop_series_id: string | null;
  workshop_occurrence_id: string | null;
  entry_date: string;
  entry_category: string;
  signed_amount_minor: number;
  currency: WorkshopCurrency;
  method: string;
  transaction_state: string;
  traceable_reference: string;
}

export interface WorkshopFinancialSummary {
  scopeType: 'occurrence' | 'series';
  scopeId: string;
  currency: WorkshopCurrency;
  grossRevenueMinor: number;
  discountsMinor: number;
  refundsMinor: number;
  providerFeesMinor: number;
  disputesAndReversalsMinor: number;
  expensesMinor: number;
  netIncomeMinor: number;
  transactionCount: number;
  openExceptionCount: number;
}

export interface WorkshopRefundEligibility {
  eligible: boolean;
  transactionId: string;
  currency: WorkshopCurrency;
  remainingRefundableMinor: number;
  providerChargeId: string;
  provider: 'stripe';
  bookingId: string;
  occurrenceId: string;
}

export interface WorkshopRefundRequestResult {
  state: 'provider_accepted' | 'reconciled' | 'provider_failed' | 'ineligible';
  replayed?: boolean;
  requestId?: string;
  amountMinor?: number;
  currency?: WorkshopCurrency;
  remainingRefundableMinor?: number;
}

export interface WorkshopExpenseInput {
  occurrenceId?: string;
  seriesId?: string;
  category: WorkshopExpenseCategory;
  description: string;
  vendorOrPayee?: string;
  note?: string;
  amountMinor: number;
  expenseDate: string;
  receiptStoragePath?: string;
}
