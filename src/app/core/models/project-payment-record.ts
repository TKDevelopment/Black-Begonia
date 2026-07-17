export type ProjectPaymentKind = 'deposit' | 'final_payment';

export type ProjectPaymentStatus =
  | 'not_due'
  | 'due'
  | 'paid'
  | 'waived'
  | 'canceled';

export type ProjectPaymentMethod =
  | 'stripe'
  | 'venmo'
  | 'check'
  | 'cash'
  | 'other';

export type ProjectPaymentSource = 'manual' | 'stripe' | 'imported';

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
}

export interface UpsertProjectPaymentRecordInput {
  project_payment_record_id?: string;
  project_id: string;
  payment_kind: ProjectPaymentKind;
  status: ProjectPaymentStatus;
  amount_due: number;
  amount_paid?: number | null;
  due_date?: string | null;
  paid_date?: string | null;
  payment_method?: ProjectPaymentMethod | null;
  payment_source?: ProjectPaymentSource;
  external_payment_id?: string | null;
  notes?: string | null;
  recorded_by?: string | null;
}
