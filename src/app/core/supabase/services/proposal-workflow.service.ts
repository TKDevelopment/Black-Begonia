import { Injectable } from '@angular/core';

import { Lead } from '../../models/lead';
import { Proposal } from '../../models/proposal';
import { SupabaseService } from '../clients/supabase.service';
import { ProposalRepositoryService } from '../repositories/proposal-repository.service';

@Injectable({
  providedIn: 'root',
})
export class ProposalWorkflowService {
  private readonly proposalBucket = 'proposals';
  private readonly signedUrlExpirySeconds = 60 * 60;
  private readonly proposalAccessPath = '/proposal/auth';

  constructor(
    private supabaseService: SupabaseService,
    private proposalRepository: ProposalRepositoryService,
  ) {}

  async getLeadProposals(leadId: string): Promise<Proposal[]> {
    const proposals = await this.proposalRepository.getProposalsByLeadId(leadId);
    const client = this.supabaseService.getClient();

    const signedUrlResults = await Promise.all(
      proposals.map(async (proposal) => {
        const { data, error } = await client.storage
          .from(this.proposalBucket)
          .createSignedUrl(proposal.storage_path, this.signedUrlExpirySeconds);

        if (error) {
          console.error(
            '[ProposalWorkflowService] createSignedUrl error:',
            error
          );

          return {
            ...proposal,
            signed_url: null,
          };
        }

        return {
          ...proposal,
          signed_url: data.signedUrl,
        };
      })
    );

    return signedUrlResults;
  }

  canSubmitProposal(status: Lead['status']): boolean {
    return status === 'nurturing' || status === 'proposal_declined';
  }

  async submitProposal(lead: Lead, file: File): Promise<void> {
    if (!this.canSubmitProposal(lead.status)) {
      throw new Error(
        `Cannot submit a proposal from status "${lead.status}".`
      );
    }

    if (file.type !== 'application/pdf') {
      throw new Error('Only PDF proposal files can be uploaded.');
    }

    const portalUrl = `${window.location.origin}${this.proposalAccessPath}`;
    const formData = new FormData();
    formData.append('lead_id', lead.lead_id);
    formData.append('portal_url', portalUrl);
    formData.append('file', file, file.name);

    const { data, error } = await this.supabaseService.getClient().functions.invoke(
      'submit-proposal',
      {
        body: formData,
      }
    );

    if (error) {
      console.error('[ProposalWorkflowService] submitProposal invoke error:', error);
      throw new Error('We could not submit the proposal right now.');
    }

    if (data?.success === false) {
      throw new Error(
        data?.error || 'We could not complete the proposal submission workflow.'
      );
    }
  }

  async resendProposalAccessEmail(proposalId: string): Promise<void> {
    if (!proposalId) {
      throw new Error('A proposal is required to resend access.');
    }

    const portalUrl = `${window.location.origin}${this.proposalAccessPath}`;
    const { data, error } = await this.supabaseService.getClient().functions.invoke(
      'resend-proposal-email',
      {
        body: {
          proposal_id: proposalId,
          portal_url: portalUrl,
        },
      }
    );

    if (error) {
      console.error(
        '[ProposalWorkflowService] resendProposalAccessEmail invoke error:',
        error
      );
      throw new Error('We could not resend proposal access right now.');
    }

    if (data?.success === false) {
      throw new Error(
        data?.error || 'We could not resend proposal access right now.'
      );
    }
  }
}

