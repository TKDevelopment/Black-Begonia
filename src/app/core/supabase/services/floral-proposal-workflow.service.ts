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

export interface FinalizeFloralProposalRequest {
  mode?: 'initial_booking' | 'project_revision';
  leadId?: string | null;
  projectId?: string | null;
  floralProposalId?: string | null;
  revisionWorkspaceId?: string | null;
  baselineSnapshotId?: string | null;
  pdfStoragePath: string;
  pdfFileName: string;
  idempotencyKey: string;
  sendDepositRequest?: boolean;
}

export interface FinalizeFloralProposalResult {
  project_id: string;
  lead_id: string | null;
  floral_proposal_id: string | null;
  proposal_document_version_id: string;
  active_invoice_snapshot_id: string;
  signed_pdf_storage_path: string;
  submitted_at: string;
  project_status?: string;
  deposit_obligation_id?: string | null;
  deposit_principal_cents?: number | null;
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
  private readonly maxProposalPdfBytes = 50 * 1024 * 1024;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly floralProposalRepository: FloralProposalRepositoryService
  ) {}

  async getLeadProposals(leadId: string): Promise<FloralProposal[]> {
    return this.floralProposalRepository.getLeadFloralProposals(leadId);
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

  async uploadProposalPdf(args: {
    leadId: string;
    proposalId: string;
    idempotencyKey: string;
    file: File;
    projectId?: string | null;
    storagePath?: string | null;
  }): Promise<{ storagePath: string }> {
    this.assertValidProposalPdfFile(args.file);

    const fileName = args.file.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-');
    const ownerSegment = args.projectId
      ? `projects/${args.projectId}`
      : `pending-leads/${args.leadId}`;
    const storagePath = args.storagePath
      ?? `${ownerSegment}/proposal-documents/${args.proposalId}/${args.idempotencyKey}-${fileName}`;
    const { error } = await this.supabaseService
      .getClient()
      .storage.from(this.floralProposalBucket)
      .upload(storagePath, args.file, {
        cacheControl: '3600',
        contentType: 'application/pdf',
        upsert: false,
      });

    if (error) {
      const message = String((error as { message?: unknown }).message ?? '').toLowerCase();
      if (message.includes('duplicate') || message.includes('already exists')) {
        return { storagePath };
      }
      console.error('[FloralProposalWorkflowService] uploadProposalPdf error:', error);
      throw new Error('We could not securely upload the proposal PDF.');
    }

    return { storagePath };
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

  async submitProposal(payload: FinalizeFloralProposalRequest): Promise<FinalizeFloralProposalResult> {
    const body: Record<string, unknown> = {
      mode: payload.mode ?? 'initial_booking',
      lead_id: payload.leadId ?? null,
      project_id: payload.projectId ?? null,
      floral_proposal_id: payload.floralProposalId,
      pdf_storage_path: payload.pdfStoragePath,
      pdf_file_name: payload.pdfFileName,
      idempotency_key: payload.idempotencyKey,
      send_deposit_request: payload.sendDepositRequest ?? false,
    };
    if (payload.mode === 'project_revision') {
      body['revision_workspace_id'] = payload.revisionWorkspaceId ?? null;
      body['baseline_snapshot_id'] = payload.baselineSnapshotId ?? null;
    }
    const { data, error } = await this.supabaseService
      .getClient()
      .functions.invoke('submit-floral-proposal', {
        body,
      });

    if (error) {
      console.error(
        '[FloralProposalWorkflowService] submitProposal invoke error:',
        error
      );
      throw new Error(
        await this.resolveFunctionError(
          error,
          'We could not submit the Floral Proposal right now.'
        )
      );
    }

    if (data?.success === false || !data?.project_id) {
      throw new Error(
        data?.error ||
          'We could not complete the booked project submission workflow.'
      );
    }

    return {
      project_id: String(data.project_id),
      lead_id: data.lead_id ? String(data.lead_id) : null,
      floral_proposal_id: data.floral_proposal_id ? String(data.floral_proposal_id) : null,
      proposal_document_version_id: String(data.proposal_document_version_id),
      active_invoice_snapshot_id: String(data.active_invoice_snapshot_id),
      signed_pdf_storage_path: String(data.signed_pdf_storage_path ?? payload.pdfStoragePath),
      submitted_at: String(data.submitted_at ?? new Date().toISOString()),
      project_status: data.project_status ? String(data.project_status) : undefined,
      deposit_obligation_id: data.deposit_obligation_id
        ? String(data.deposit_obligation_id)
        : null,
      deposit_principal_cents:
        typeof data.deposit_principal_cents === 'number'
          ? data.deposit_principal_cents
          : null,
    };
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

  private async resolveFunctionError(
    error: unknown,
    fallbackMessage: string
  ): Promise<string> {
    const context = (error as { context?: unknown } | null)?.context;
    if (!(context instanceof Response)) {
      return fallbackMessage;
    }

    if (context.status === 546) {
      return 'The proposal service exceeded its processing limit. Deploy the latest submission function, then retry Finalize Proposal.';
    }

    try {
      const payload = (await context.clone().json()) as {
        error?: unknown;
        message?: unknown;
      };
      const message =
        typeof payload.error === 'string'
          ? payload.error
          : typeof payload.message === 'string'
            ? payload.message
            : '';
      return message.trim() || fallbackMessage;
    } catch {
      return fallbackMessage;
    }
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

  private assertValidProposalPdfFile(file: File): void {
    const fileName = file.name.trim().toLowerCase();
    if (!fileName.endsWith('.pdf') || file.type !== 'application/pdf') {
      throw new Error('Upload a PDF document before submitting.');
    }

    if (file.size === 0) {
      throw new Error('The selected PDF is empty.');
    }

    if (file.size > this.maxProposalPdfBytes) {
      throw new Error('The selected PDF must be 50 MB or smaller.');
    }
  }
}



