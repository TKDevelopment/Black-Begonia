export interface ProjectProposalInvoiceSnapshot {
  project_proposal_invoice_snapshot_id: string;
  project_id: string;
  source_lead_id?: string | null;
  source_floral_proposal_id?: string | null;
  version: number;
  snapshot: Record<string, unknown>;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  retainer_amount: number;
  final_balance_amount: number;
  retainer_due_date?: string | null;
  final_balance_due_date?: string | null;
  created_by?: string | null;
  created_at: string;
  is_active: boolean;
  submission_idempotency_key?: string | null;
}

export interface CreateProjectProposalInvoiceSnapshotInput {
  project_id: string;
  source_lead_id?: string | null;
  source_floral_proposal_id?: string | null;
  version: number;
  snapshot?: Record<string, unknown>;
  subtotal?: number;
  tax_rate?: number;
  tax_amount?: number;
  total_amount?: number;
  retainer_amount?: number;
  final_balance_amount?: number;
  retainer_due_date?: string | null;
  final_balance_due_date?: string | null;
  created_by?: string | null;
  is_active?: boolean;
  submission_idempotency_key?: string | null;
}
