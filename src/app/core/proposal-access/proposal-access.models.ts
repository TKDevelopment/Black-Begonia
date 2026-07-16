export interface ProposalAccessSession {
  floral_proposal_id: string;
  lead_id: string;
  customer_email: string;
  client_name?: string | null;
  service_type?: string | null;
  event_type?: string | null;
  event_date?: string | null;
  proposal_version?: number;
  version: number;
  file_name?: string | null;
  pdf_url: string | null;
  combined_pdf_url?: string | null;
  combined_file_name?: string | null;
  signing_provider?: string | null;
  signing_status?: string | null;
  signing_session_reference?: string | null;
  embedded_signing_url?: string | null;
  access_token: string;
  authenticated_at?: string | null;
  expires_at: string;
  response_action: 'accept' | 'decline' | null;
  response_feedback: string | null;
  responded_at: string | null;
}

export interface VerifyProposalAccessResponse {
  success: boolean;
  session: ProposalAccessSession;
  error?: string;
}
