import { Injectable } from '@angular/core';

import { Lead } from '../../models/lead';
import {
  FloralProposal,
  FloralProposalShoppingListItem,
} from '../../models/floral-proposal';
import { SupabaseService } from '../clients/supabase.service';
import { FloralProposalRepositoryService } from '../repositories/floral-proposal-repository.service';
import { FloralProposalRenderPayload } from './floral-proposal-builder.service';

export interface SubmitFloralProposalPayload {
  floral_proposal_id?: string | null;
  lead_id: string;
  tax_region_id?: string | null;
  line_items: {
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

export interface ProposalSnapshotLifecycle {
  finalizedAt?: string | null;
  editReopenedAt?: string | null;
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

    if (!signedUrl) {
      throw new Error('We could not generate a secure file preview right now.');
    }

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
    return this.createSignedStorageUrl(this.lineItemImageBucket, storagePath, {
      allowMissing: true,
    });
  }

  async clearMissingLineItemImage(lineItemId: string): Promise<void> {
    await this.floralProposalRepository.clearLineItemImage(lineItemId);
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

  resolveStoredProposalStatus(
    proposalStatus: 'draft' | 'finalized'
  ): FloralProposal['status'] {
    return proposalStatus === 'finalized' ? 'draft' : proposalStatus;
  }

  buildProposalSnapshot(args: {
    renderPayload: FloralProposalRenderPayload;
    proposalStatus?: FloralProposal['status'] | 'finalized';
    existingSnapshot?: Record<string, unknown>;
    lifecycle?: ProposalSnapshotLifecycle;
  }): Record<string, unknown> {
    const {
      renderPayload,
      proposalStatus = 'draft',
      existingSnapshot = {},
      lifecycle,
    } = args;

    return {
      ...existingSnapshot,
      proposal_status: proposalStatus,
      finalized_at:
        lifecycle?.finalizedAt ??
        (proposalStatus === 'finalized'
          ? (existingSnapshot['finalized_at'] as string | null | undefined) ??
            new Date().toISOString()
          : (existingSnapshot['finalized_at'] as string | null | undefined) ?? null),
      edit_reopened_at:
        lifecycle?.editReopenedAt ??
        (existingSnapshot['edit_reopened_at'] as string | null | undefined) ??
        null,
      tax_region_id: renderPayload.tax_region_id,
      tax_region_name: renderPayload.tax_region_name,
      default_markup_percent: renderPayload.default_markup_percent,
      labor_percent: renderPayload.labor_percent,
      tax_rate: renderPayload.tax_rate,
      line_items: renderPayload.line_items.map((line) => ({
        display_order: line.display_order,
        line_item_type: line.line_item_type,
        item_name: line.item_name,
        description: line.description ?? null,
        quantity: line.quantity,
        unit_price: line.unit_price,
        subtotal: line.subtotal,
        image_storage_path: line.image_storage_path ?? null,
        image_alt_text: line.image_alt_text ?? null,
        image_caption: line.image_caption ?? null,
        components: line.components.map((component) => ({
          catalog_item_id: component.catalog_item_id ?? null,
          catalog_item_name: component.catalog_item_name,
          quantity_per_unit: component.quantity_per_unit,
          extended_quantity: component.extended_quantity,
          base_unit_cost: component.base_unit_cost,
          applied_markup_percent: component.applied_markup_percent,
          sell_unit_price: component.sell_unit_price,
          subtotal: component.subtotal,
        })),
      })),
      shopping_list: renderPayload.shopping_list,
      totals: renderPayload.totals,
      breakdown: renderPayload.breakdown,
    };
  }

  buildEditableProposalSnapshot(
    existingSnapshot: Record<string, unknown>,
    editReopenedAt = new Date().toISOString()
  ): Record<string, unknown> {
    return {
      ...existingSnapshot,
      proposal_status: 'draft',
      edit_reopened_at: editReopenedAt,
    };
  }

  buildManualSubmissionPayload(args: {
    lead: Lead;
    proposal: FloralProposal;
    renderPayload: FloralProposalRenderPayload;
    pdfBase64: string;
    pdfFileName: string;
    termsVersion?: string;
    privacyPolicyVersion?: string;
  }): SubmitFloralProposalPayload {
    const submissionTimestamp = new Date().toISOString();

    return {
      floral_proposal_id: args.proposal.floral_proposal_id,
      lead_id: args.lead.lead_id,
      tax_region_id: args.renderPayload.tax_region_id ?? null,
      line_items: args.renderPayload.line_items.map((line) => ({
        display_order: line.display_order,
        line_item_type: line.line_item_type,
        item_name: line.item_name,
        description: line.description ?? null,
        quantity: line.quantity,
        unit_price: line.unit_price,
        subtotal: line.subtotal,
        image_storage_path: line.image_storage_path ?? null,
        image_alt_text: line.image_alt_text ?? null,
        image_caption: line.image_caption ?? null,
        snapshot: {
          line_type_label: line.line_type_label,
          description: line.description ?? null,
        },
        components:
          line.line_item_type === 'product'
            ? line.components.map((component) => ({
                display_order: component.display_order,
                catalog_item_id: component.catalog_item_id ?? null,
                catalog_item_name: component.catalog_item_name,
                quantity_per_unit: component.quantity_per_unit,
                extended_quantity: component.extended_quantity,
                base_unit_cost: component.base_unit_cost,
                applied_markup_percent: component.applied_markup_percent,
                sell_unit_price: component.sell_unit_price,
                subtotal: component.subtotal,
                reserve_percent: component.reserve_percent ?? 0,
                snapshot: component.snapshot ?? {},
              }))
            : [],
      })),
      shopping_list_items: args.renderPayload.shopping_list,
      subtotal: args.renderPayload.totals.subtotal,
      tax_rate: args.renderPayload.tax_rate,
      tax_amount: args.renderPayload.totals.taxAmount,
      total_amount: args.renderPayload.totals.totalAmount,
      terms_version: args.termsVersion ?? 'v1',
      privacy_policy_version: args.privacyPolicyVersion ?? 'v1',
      pdf_base64: args.pdfBase64,
      pdf_file_name: args.pdfFileName,
      snapshot: {
        ...this.buildProposalSnapshot({
          renderPayload: args.renderPayload,
          proposalStatus: 'finalized',
          existingSnapshot: (args.proposal.snapshot ?? {}) as Record<string, unknown>,
          lifecycle: {
            finalizedAt:
              (args.proposal.snapshot?.['finalized_at'] as string | null | undefined) ?? null,
            editReopenedAt:
              (args.proposal.snapshot?.['edit_reopened_at'] as string | null | undefined) ?? null,
          },
        }),
        proposal_version: args.proposal.version,
        submitted_at: submissionTimestamp,
        submitted_pdf_file_name: args.pdfFileName,
      },
    };
  }

  private async createSignedStorageUrl(
    bucket: string,
    storagePath: string,
    options?: {
      allowMissing?: boolean;
    }
  ): Promise<string | null> {
    const normalizedStoragePath = this.normalizeStoragePath(bucket, storagePath);

    if (!normalizedStoragePath) {
      if (options?.allowMissing) {
        return null;
      }

      throw new Error('We could not determine the file path for this storage asset.');
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .storage
      .from(bucket)
      .createSignedUrl(normalizedStoragePath, this.signedUrlExpirySeconds);

    if (error || !data?.signedUrl) {
      const message = (error as { message?: string } | null)?.message?.toLowerCase() ?? '';
      const isMissingObject = message.includes('object not found');

      if (options?.allowMissing && isMissingObject) {
        return null;
      }

      console.error(
        '[FloralProposalWorkflowService] createSignedStorageUrl error:',
        error
      );
      throw new Error('We could not generate a secure file preview right now.');
    }

    return data.signedUrl;
  }

  private normalizeStoragePath(bucket: string, storagePath: string): string | null {
    const trimmedPath = storagePath.trim();

    if (!trimmedPath) {
      return null;
    }

    let normalizedPath = trimmedPath;

    if (/^https?:\/\//i.test(normalizedPath)) {
      try {
        normalizedPath = new URL(normalizedPath).pathname;
      } catch {
        return null;
      }
    }

    normalizedPath = normalizedPath
      .replace(/^\/+/, '')
      .replace(/^storage\/v1\/object\/(?:sign|public)\/[^/]+\//, '')
      .replace(/^storage\/v1\/object\/(?:sign|public)\/?/, '')
      .replace(new RegExp(`^${bucket}/`), '');

    return normalizedPath || null;
  }
}



