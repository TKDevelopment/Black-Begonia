import { Injectable } from '@angular/core';

import { ProposalSigningSession } from '../../models/proposal-signing-session';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class ProposalSigningSessionRepositoryService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private readonly selectClause = `
    proposal_signing_session_id,
    floral_proposal_id,
    provider,
    provider_document_id,
    provider_embedded_session_id,
    provider_signer_reference,
    status,
    last_synced_at,
    last_error_message,
    webhook_payload_snapshot,
    created_at,
    updated_at
  `;

  async getActiveByProposalId(
    floralProposalId: string
  ): Promise<ProposalSigningSession | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('proposal_signing_sessions')
      .select(this.selectClause)
      .eq('floral_proposal_id', floralProposalId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        '[ProposalSigningSessionRepositoryService] getActiveByProposalId error:',
        error
      );
      return null;
    }

    return (data as ProposalSigningSession | null) ?? null;
  }

  async upsertSession(
    payload: Partial<ProposalSigningSession> &
      Pick<ProposalSigningSession, 'floral_proposal_id' | 'provider' | 'status'>
  ): Promise<ProposalSigningSession> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('proposal_signing_sessions')
      .upsert({
        proposal_signing_session_id: payload.proposal_signing_session_id,
        floral_proposal_id: payload.floral_proposal_id,
        provider: payload.provider,
        provider_document_id: payload.provider_document_id ?? null,
        provider_embedded_session_id:
          payload.provider_embedded_session_id ?? null,
        provider_signer_reference: payload.provider_signer_reference ?? null,
        status: payload.status,
        last_synced_at: payload.last_synced_at ?? null,
        last_error_message: payload.last_error_message ?? null,
        webhook_payload_snapshot: payload.webhook_payload_snapshot ?? null,
        updated_at: new Date().toISOString(),
      })
      .select(this.selectClause)
      .single();

    if (error) {
      console.error(
        '[ProposalSigningSessionRepositoryService] upsertSession error:',
        error
      );
      throw error;
    }

    return data as ProposalSigningSession;
  }
}
