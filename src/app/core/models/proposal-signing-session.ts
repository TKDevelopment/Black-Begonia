import { FloralProposalSigningStatus } from './floral-proposal';

export interface ProposalSigningSession {
  proposal_signing_session_id: string;
  floral_proposal_id: string;
  provider: string;
  provider_document_id?: string | null;
  idempotency_key?: string | null;
  send_state?: 'not_started' | 'draft_created' | 'sending' | 'sent' | 'failed' | 'unknown';
  provider_embedded_session_id?: string | null;
  provider_signer_reference?: string | null;
  status: FloralProposalSigningStatus;
  last_synced_at?: string | null;
  last_error_message?: string | null;
  webhook_payload_snapshot?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
