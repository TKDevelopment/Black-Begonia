import { Injectable } from '@angular/core';

import { Lead } from '../../models/lead';
import {
  FloralProposal,
  FloralProposalShoppingListItem,
} from '../../models/floral-proposal';
import { SupabaseService } from '../clients/supabase.service';
import { FloralProposalRepositoryService } from '../repositories/floral-proposal-repository.service';

export interface SubmitFloralProposalPayload {
  lead_id: string;
  template_id?: string | null;
  tax_region_id?: string | null;
  line_items: {
    display_order: number;
    line_item_type: 'product' | 'fee' | 'discount';
    item_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    description?: string | null;
    image_storage_path?: string | null;
    image_alt_text?: string | null;
    image_caption?: string | null;
    notes?: string | null;
    snapshot?: Record<string, unknown>;
    components?: {
      display_order: number;
      catalog_item_id?: string | null;
      catalog_item_name: string;
      quantity_per_unit: number;
      extended_quantity: number;
      base_unit_cost: number;
      applied_markup_percent: number;
      sell_unit_price: number;
      subtotal: number;
      reserve_percent?: number;
      snapshot?: Record<string, unknown>;
    }[];
  }[];
  shopping_list_items?: FloralProposalShoppingListItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  terms_version?: string;
  privacy_policy_version?: string;
  snapshot?: Record<string, unknown>;
  pdf_base64?: string | null;
  pdf_file_name?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class FloralProposalWorkflowService {
  private readonly floralProposalBucket = 'floral-proposals';
  private readonly lineItemImageBucket = 'floral-proposal-line-items';
  private readonly signedUrlExpirySeconds = 60 * 60;
  private readonly proposalAccessPath = '/proposal/auth';

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly floralProposalRepository: FloralProposalRepositoryService
  ) {}

  async getLeadProposals(leadId: string): Promise<FloralProposal[]> {
    const proposals = await this.floralProposalRepository.getLeadFloralProposals(
      leadId
    );
    const client = this.supabaseService.getClient();

    return Promise.all(
      proposals.map(async (proposal) => {
        if (!proposal.pdf_storage_path) {
          return {
            ...proposal,
            signed_url: proposal.pdf_url ?? null,
          };
        }

        const { data, error } = await client.storage
          .from(this.floralProposalBucket)
          .createSignedUrl(
            proposal.pdf_storage_path,
            this.signedUrlExpirySeconds
          );

        if (error) {
          console.error(
            '[FloralProposalWorkflowService] createSignedUrl error:',
            error
          );
          return {
            ...proposal,
            signed_url: proposal.pdf_url ?? null,
          };
        }

        return {
          ...proposal,
          signed_url: data.signedUrl,
        };
      })
    );
  }

  canSubmitProposal(status: Lead['status']): boolean {
    return status === 'nurturing' || status === 'proposal_declined';
  }

  async uploadLineItemImage(
    leadId: string,
    lineId: string,
    file: File
  ): Promise<{ storagePath: string; signedUrl: string }> {
    const sanitizedFileName = file.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9.\-_]+/g, '-')
      .replace(/-+/g, '-');
    const storagePath = `${leadId}/${lineId}/${Date.now()}-${sanitizedFileName}`;
    const client = this.supabaseService.getClient();

    const { error: uploadError } = await client.storage
      .from(this.lineItemImageBucket)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error(
        '[FloralProposalWorkflowService] uploadLineItemImage upload error:',
        uploadError
      );
      throw new Error('We could not upload the line item image right now.');
    }

    const signedUrl = await this.createSignedStorageUrl(
      this.lineItemImageBucket,
      storagePath
    );

    return { storagePath, signedUrl };
  }

  async removeLineItemImage(storagePath: string): Promise<void> {
    if (!storagePath) return;

    const { error } = await this.supabaseService
      .getClient()
      .storage
      .from(this.lineItemImageBucket)
      .remove([storagePath]);

    if (error) {
      console.error(
        '[FloralProposalWorkflowService] removeLineItemImage error:',
        error
      );
      throw new Error('We could not remove the line item image right now.');
    }
  }

  async getSignedLineItemImageUrl(storagePath: string): Promise<string | null> {
    if (!storagePath) return null;
    return this.createSignedStorageUrl(this.lineItemImageBucket, storagePath);
  }

  async submitProposal(payload: SubmitFloralProposalPayload): Promise<{
    floral_proposal_id: string;
    version: number;
  }> {
    const portalUrl = `${window.location.origin}${this.proposalAccessPath}`;
    const { data, error } = await this.supabaseService
      .getClient()
      .functions.invoke('submit-floral-proposal', {
        body: {
          ...payload,
          portal_url: portalUrl,
        },
      });

    if (error) {
      console.error(
        '[FloralProposalWorkflowService] submitProposal invoke error:',
        error
      );
      throw new Error('We could not submit the Floral Proposal right now.');
    }

    if (data?.success === false || !data?.floral_proposal_id) {
      throw new Error(
        data?.error ||
          'We could not complete the Floral Proposal submission workflow.'
      );
    }

    return {
      floral_proposal_id: data.floral_proposal_id as string,
      version: Number(data.version ?? 1),
    };
  }

  async resendProposalAccessEmail(floralProposalId: string): Promise<void> {
    if (!floralProposalId) {
      throw new Error('A Floral Proposal is required to resend access.');
    }

    const portalUrl = `${window.location.origin}${this.proposalAccessPath}`;
    const { data, error } = await this.supabaseService
      .getClient()
      .functions.invoke('resend-floral-proposal-email', {
        body: {
          floral_proposal_id: floralProposalId,
          portal_url: portalUrl,
        },
      });

    if (error) {
      console.error(
        '[FloralProposalWorkflowService] resendProposalAccessEmail invoke error:',
        error
      );
      throw new Error(
        'We could not resend Floral Proposal access right now.'
      );
    }

    if (data?.success === false) {
      throw new Error(
        data?.error ||
          'We could not resend Floral Proposal access right now.'
      );
    }
  }

  private async createSignedStorageUrl(
    bucket: string,
    storagePath: string
  ): Promise<string> {
    const { data, error } = await this.supabaseService
      .getClient()
      .storage
      .from(bucket)
      .createSignedUrl(storagePath, this.signedUrlExpirySeconds);

    if (error || !data?.signedUrl) {
      console.error(
        '[FloralProposalWorkflowService] createSignedStorageUrl error:',
        error
      );
      throw new Error('We could not generate a secure file preview right now.');
    }

    return data.signedUrl;
  }
}


