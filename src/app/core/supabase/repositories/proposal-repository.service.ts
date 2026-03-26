import { Injectable } from '@angular/core';

import { CreateProposalInput, Proposal } from '../../models/proposal';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class ProposalRepositoryService {
  constructor(private supabaseService: SupabaseService) {}

  private readonly proposalSelect = `
    proposal_id,
    lead_id,
    proposal_url,
    storage_path,
    is_active,
    version,
    file_name,
    customer_email,
    created_at,
    updated_at
  `;

  async getAllProposals(): Promise<Proposal[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('proposals')
      .select(this.proposalSelect)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ProposalRepositoryService] getAllProposals error:', error);
      return [];
    }

    return (data ?? []) as Proposal[];
  }

  async getProposalsByLeadId(leadId: string): Promise<Proposal[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('proposals')
      .select(this.proposalSelect)
      .eq('lead_id', leadId)
      .order('version', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error(
        '[ProposalRepositoryService] getProposalsByLeadId error:',
        error
      );
      return [];
    }

    return (data ?? []) as Proposal[];
  }

  async deactivateActiveProposals(leadId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('proposals')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('lead_id', leadId)
      .eq('is_active', true);

    if (error) {
      console.error(
        '[ProposalRepositoryService] deactivateActiveProposals error:',
        error
      );
      throw error;
    }
  }

  async createProposal(payload: CreateProposalInput): Promise<Proposal> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('proposals')
      .insert({
        lead_id: payload.lead_id,
        proposal_url: payload.proposal_url,
        storage_path: payload.storage_path,
        is_active: payload.is_active,
        version: payload.version,
        passcode_hash: payload.passcode_hash,
        file_name: payload.file_name ?? null,
        customer_email: payload.customer_email,
      })
      .select(this.proposalSelect)
      .single();

    if (error) {
      console.error('[ProposalRepositoryService] createProposal error:', error);
      throw error;
    }

    return data as Proposal;
  }
}
