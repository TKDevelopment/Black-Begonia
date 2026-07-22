export type PaymentTransactionKind = 'receipt' | 'refund' | 'reversal' | 'dispute' | 'void' | 'correction' | 'credit_allocation' | 'external_refund';
export interface PaymentAllocation { payment_transaction_allocation_id: string; obligation_id: string; allocated_principal: number; sequence: number; created_at: string; }
export interface PaymentTransaction {
  payment_transaction_id: string; payment_reference: string; project_id: string;
  kind: PaymentTransactionKind; status: 'pending' | 'confirmed' | 'failed' | 'resolved';
  principal_amount: number; customer_fee: number; merchant_fee?: number | null;
  method: string; source: 'manual' | 'stripe' | 'paypal' | 'imported' | 'system';
  occurred_at: string; actor_type: 'florist' | 'customer' | 'provider' | 'schedule' | 'system';
  provider_reference?: string | null; note?: string | null; allocations?: PaymentAllocation[];
}

export interface PaymentAdjustmentProjection {
  paymentTransactionId: string;
  paymentReference: string;
  kind: Exclude<PaymentTransactionKind, 'receipt'>;
  status: PaymentTransaction['status'];
  amount: number;
  occurredAt: string;
  description?: string | null;
}

export interface InstallmentReceiptProjection {
  paymentTransactionId: string;
  paymentReference: string;
  receiptPrincipal: number;
  allocatedPrincipal: number;
  method: string;
  source: PaymentTransaction['source'];
  occurredAt: string;
  status: PaymentTransaction['status'];
  note?: string | null;
  adjustments: PaymentAdjustmentProjection[];
}

export interface PaymentAllocationProposal {
  obligationId: string;
  paymentKind: 'deposit' | 'final_payment';
  amount: number;
}

export type ManualPaymentResult =
  | { state: 'duplicate_warning'; suspectedReference: string }
  | { state: 'spillover_warning'; spilloverAmount: number; proposedAllocations: PaymentAllocationProposal[] }
  | { state: 'overpayment_warning'; overpaymentAmount: number; proposedAllocations: PaymentAllocationProposal[] }
  | {
      state: 'recorded'; replayed: boolean; transactionId: string; paymentReference: string;
      allocations: PaymentAllocationProposal[]; affectedObligationIds: string[]; overpaymentAmount: number;
    };
export interface PaymentCheckoutAttempt {
  payment_checkout_attempt_id: string; payment_request_id: string; project_id: string;
  method: 'stripe_card' | 'paypal_venmo'; status: 'creating' | 'active' | 'processing' | 'paid' | 'failed' | 'expired' | 'canceled';
  principal_amount: number; customer_fee: 0; charge_amount: number; fee_policy_decision: 'disabled';
  expires_at: string; created_at: string;
}
