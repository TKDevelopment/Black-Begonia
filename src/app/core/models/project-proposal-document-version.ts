export interface ProjectProposalDocumentVersion {
  project_proposal_document_version_id: string;
  project_id: string;
  source_lead_id?: string | null;
  source_floral_proposal_id?: string | null;
  invoice_snapshot_id?: string | null;
  version: number;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  content_type: string;
  file_size_bytes?: number | null;
  uploaded_by?: string | null;
  submitted_at: string;
  is_active: boolean;
  created_at: string;
}

export interface CreateProjectProposalDocumentVersionInput {
  project_id: string;
  source_lead_id?: string | null;
  source_floral_proposal_id?: string | null;
  invoice_snapshot_id?: string | null;
  version: number;
  file_name: string;
  storage_bucket?: string;
  storage_path: string;
  content_type?: string;
  file_size_bytes?: number | null;
  uploaded_by?: string | null;
  submitted_at?: string;
  is_active?: boolean;
}
