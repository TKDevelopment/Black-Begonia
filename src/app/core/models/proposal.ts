export interface Proposal {
  proposal_id: string;
  lead_id: string;
  proposal_url: string;
  storage_path: string;
  is_active: boolean;
  version: number;
  file_name?: string | null;
  customer_email: string;
  created_at: string;
  updated_at: string;
  signed_url?: string | null;
}

export interface CreateProposalInput {
  lead_id: string;
  proposal_url: string;
  storage_path: string;
  is_active: boolean;
  version: number;
  passcode_hash: string;
  file_name?: string | null;
  customer_email: string;
}

export interface ProposalResponseSummary {
  proposal_id: string;
  action: 'accept' | 'decline';
  feedback: string | null;
  created_at: string;
}
