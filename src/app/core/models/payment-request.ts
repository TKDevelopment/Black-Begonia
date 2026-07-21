export type PaymentRequestKind = 'deposit' | 'final_payment' | 'consolidated';
export type PaymentRequestState = 'draft' | 'active' | 'fulfilled' | 'superseded' | 'revoked' | 'canceled';
export type PaymentMethodChoice = 'stripe_card' | 'venmo' | 'cash' | 'check';

export interface PaymentRequest {
  payment_request_id: string;
  project_id: string;
  request_kind: PaymentRequestKind;
  status: PaymentRequestState;
  principal_amount: number;
  deposit_amount: number;
  final_amount: number;
  original_recipient_email?: string | null;
  recipient_fallback_used: boolean;
  cash_instructions: string;
  check_instructions: string;
  issued_at: string;
  activated_at?: string | null;
  invalidated_at?: string | null;
}

export type CustomerPaymentState = 'active' | 'processing' | 'confirmed' | 'still_outstanding' | 'unavailable';
export interface CustomerPaymentProjection {
  state: CustomerPaymentState;
  brand?: string;
  purpose?: PaymentRequestKind;
  projectLabel?: string;
  eventDate?: string | null;
  currency?: 'USD';
  principalCents?: number;
  depositCents?: number;
  finalCents?: number;
  methods?: PaymentMethodChoice[];
  activeAttempt?: string | null;
  intention?: { method: 'cash' | 'check' | 'venmo_business_profile'; pauseEndsAt: string } | null;
  instructionSnapshots?: { cash?: string; check?: string };
}

export type CheckoutHandoff =
  | { kind: 'redirect'; url: string; attempt: string }
  | { kind: 'paypal_order'; orderId: string; attempt: string; clientId: string }
  | { kind: 'manual_venmo'; approvedTarget: string; reference: string; amountCents: number }
  | { kind: 'intention'; method: 'cash' | 'check'; instructions: string; pauseEndsAt: string };
