export interface ProposalAccessSession {
  proposal_id: string;
  lead_id: string;
  customer_email: string;
  client_name: string;
  service_type: string;
  event_type: string | null;
  event_date: string | null;
  proposal_version: number;
  file_name: string | null;
  signed_url: string;
  access_token: string;
  authenticated_at: string;
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
