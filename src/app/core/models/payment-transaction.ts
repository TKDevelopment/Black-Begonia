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
export interface PaymentCheckoutAttempt {
  payment_checkout_attempt_id: string; payment_request_id: string; project_id: string;
  method: 'stripe_card' | 'paypal_venmo'; status: 'creating' | 'active' | 'processing' | 'paid' | 'failed' | 'expired' | 'canceled';
  principal_amount: number; customer_fee: 0; charge_amount: number; fee_policy_decision: 'disabled';
  expires_at: string; created_at: string;
}
