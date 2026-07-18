import { ProjectStatus } from './project';
import { ProjectProposalDocumentVersion } from './project-proposal-document-version';
import { ProjectProposalInvoiceSnapshot } from './project-proposal-invoice-snapshot';

export const PROJECT_PROPOSAL_REVISION_SCHEMA_VERSION = 2 as const;

export type ProposalRevisionSaveState = 'idle' | 'saving' | 'saved' | 'error';

export type ProposalRevisionEligibleProjectStatus = Extract<
  ProjectStatus,
  'awaiting_deposit' | 'booked' | 'awaiting_final_payment' | 'final_prep'
>;

export interface EditableProposalComponentSnapshot {
  display_order: number;
  catalog_item_id?: string | null;
  catalog_item_name: string;
  quantity_per_unit: number;
  extended_quantity: number;
  base_unit_cost: number;
  applied_markup_percent: number;
  sell_unit_price: number;
  subtotal: number;
  reserve_percent: number;
  pack_quantity?: number | null;
  purchase_unit_cost: number;
  item_type?: string | null;
  unit_type?: string | null;
  color?: string | null;
  variety?: string | null;
  snapshot?: Record<string, unknown>;
}

export interface EditableProposalLineSnapshot {
  local_id: string;
  display_order: number;
  line_item_type: 'product' | 'fee' | 'discount' | 'labor';
  item_name: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  image_storage_path?: string | null;
  image_alt_text?: string | null;
  image_caption?: string | null;
  components: EditableProposalComponentSnapshot[];
  snapshot?: Record<string, unknown>;
}

export interface EditableProposalSnapshotV2 extends Record<string, unknown> {
  schema_version: typeof PROJECT_PROPOSAL_REVISION_SCHEMA_VERSION;
  proposal_status: 'draft';
  tax_region: {
    tax_region_id?: string | null;
    name?: string | null;
    tax_rate: number;
    was_active?: boolean;
  };
  default_markup_percent: number;
  labor_percent: number;
  financial_terms: {
    retainer_amount: number;
    final_balance_amount: number;
    retainer_due_date?: string | null;
    final_balance_due_date?: string | null;
  };
  line_items: EditableProposalLineSnapshot[];
  shopping_list: Record<string, unknown>[];
  totals: {
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
  };
  breakdown: Record<string, number>;
}

export interface ProjectProposalRevisionWorkspace {
  project_proposal_revision_workspace_id: string;
  project_id: string;
  baseline_invoice_snapshot_id: string;
  source_lead_id?: string | null;
  schema_version: number;
  draft_snapshot: EditableProposalSnapshotV2;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  retainer_amount: number;
  final_balance_amount: number;
  retainer_due_date?: string | null;
  final_balance_due_date?: string | null;
  pending_submission_key?: string | null;
  pending_pdf_storage_path?: string | null;
  pending_pdf_file_name?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export type SaveProjectProposalRevisionWorkspaceInput = Omit<
  ProjectProposalRevisionWorkspace,
  'project_proposal_revision_workspace_id' | 'created_at' | 'updated_at'
>;

export type ActiveProposalSnapshotState =
  | { state: 'valid'; snapshot: ProjectProposalInvoiceSnapshot }
  | {
      state:
        | 'ineligible_project_status'
        | 'missing_snapshot'
        | 'conflicting_snapshots'
        | 'broken_snapshot_reference'
        | 'invalid_snapshot_data'
        | 'load_error';
      repairMessage: string;
    };

export type ActiveProposalDocumentState =
  | { state: 'valid'; document: ProjectProposalDocumentVersion }
  | {
      state:
        | 'missing_document'
        | 'broken_document_reference'
        | 'inactive_document_reference'
        | 'mismatched_snapshot_document_pair'
        | 'load_error';
      repairMessage: string;
    };

export interface ProjectProposalRevisionContext {
  snapshotState: ActiveProposalSnapshotState;
  documentState: ActiveProposalDocumentState;
  workspace: ProjectProposalRevisionWorkspace | null;
  compatibilityWarning?: string | null;
}
