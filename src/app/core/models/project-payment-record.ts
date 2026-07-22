import { InstallmentReceiptProjection } from './payment-transaction';

export type ProjectPaymentKind = 'deposit' | 'final_payment';

export type ProjectPaymentStatus =
  | 'not_due'
  | 'due'
  | 'partially_paid'
  | 'paid'
  | 'overpaid'
  | 'waived'
  | 'canceled'
  | 'review_required';

export type ProjectPaymentMethod =
  | 'stripe'
  | 'venmo'
  | 'check'
  | 'cash'
  | 'other';

export type ProjectPaymentSource = 'manual' | 'stripe' | 'imported';

export type ProjectPaymentDisplayStatus = ProjectPaymentStatus | 'not_required';
export type ProjectPaymentMethodSummaryState = 'none' | 'planned' | 'received' | 'multiple';

export interface ProjectPaymentMethodSummary {
  state: ProjectPaymentMethodSummaryState;
  label: string;
}

export interface ProjectPaymentAttentionItem {
  paymentExceptionId: string;
  type: string;
  urgency: 'normal' | 'urgent';
  amount?: number | null;
  summary: string;
  state: 'open' | 'acknowledged';
  createdAt: string;
}

export interface ProjectPaymentRecord {
  project_payment_record_id: string;
  project_id: string;
  payment_kind: ProjectPaymentKind;
  status: ProjectPaymentStatus;
  amount_due: number;
  amount_paid: number;
  due_date?: string | null;
  paid_date?: string | null;
  payment_method?: ProjectPaymentMethod | null;
  payment_source: ProjectPaymentSource;
  external_payment_id?: string | null;
  notes?: string | null;
  recorded_by?: string | null;
  created_at: string;
  updated_at: string;
  basis_snapshot_id?: string | null;
  basis_version?: number | null;
  basis_total?: number | null;
  target_amount?: number;
  credited_principal?: number;
  outstanding_amount?: number;
  fulfillment_state?: ProjectPaymentStatus;
  deposit_target_frozen_at?: string | null;
  reminder_enabled?: boolean;
  reminder_paused_until?: string | null;
  reminder_pause_reason?: string | null;
  migration_state?: 'native' | 'classified' | 'ambiguous';
  fulfilled_at?: string | null;
  retention_eligible_at?: string | null;
  last_method?: string | null;
  last_intention_method?: string | null;
  displayStatus?: ProjectPaymentDisplayStatus;
  methodSummary?: ProjectPaymentMethodSummary;
  plannedMethod?: 'cash' | 'check' | 'venmo_business_profile' | null;
  receipts?: InstallmentReceiptProjection[];
}

export interface ManualPaymentInput {
  project_id: string;
  obligation_id: string;
  payment_kind: ProjectPaymentKind;
  amount: number;
  received_at: string;
  payment_method: ProjectPaymentMethod;
  notes?: string | null;
  suspected_reference?: string | null;
  duplicate_override_reason?: string | null;
  command_key: string;
  confirm_overpayment?: boolean;
  confirm_spillover?: boolean;
}

export interface ProjectFinancialSummary {
  available: boolean;
  proposalTotal: number | null;
  depositTarget: number;
  finalTarget: number;
  creditedPrincipal: number;
  outstanding: number;
  customerFees: number;
  merchantFees: number | null;
  overpayment: number;
  obligations: ProjectPaymentRecord[];
  needsAttention: ProjectPaymentAttentionItem[];
}
