import { Injectable } from '@angular/core';

import { Lead } from '../../models/lead';
import {
  DocumentTemplate,
  FloralProposal,
  FloralProposalRenderContract,
  FloralProposalRenderLineItem,
  FloralProposalShoppingListItem,
} from '../../models/floral-proposal';
import { TaxRegion } from '../../models/tax-region';
import { SupabaseService } from '../clients/supabase.service';
import { FloralProposalRepositoryService } from '../repositories/floral-proposal-repository.service';
import { FloralProposalRenderPayload } from './floral-proposal-builder.service';
import { FloralProposalRendererService } from './floral-proposal-renderer.service';

export interface SubmitFloralProposalPayload {
  floral_proposal_id?: string | null;
  lead_id: string;
  template_id?: string | null;
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
  render_contract?: FloralProposalRenderContract;
  render_html?: string | null;
  pdf_base64?: string | null;
  pdf_file_name?: string | null;
}

export interface PreviewFloralProposalPdfResponse {
  success: boolean;
  pdf_base64?: string;
  error?: string;
}

export interface PreviewFloralProposalPdfResult {
  objectUrl: string;
  pdfBase64: string;
}

export interface FloralProposalRenderContractInput {
  lead: Lead;
  proposal?: FloralProposal | null;
  template?: DocumentTemplate | null;
  taxRegion?: TaxRegion | null;
  renderPayload: FloralProposalRenderPayload;
}

@Injectable({
  providedIn: 'root',
})
export class FloralProposalWorkflowService {
  private readonly floralProposalBucket = 'floral-proposals';
  private readonly lineItemImageBucket = 'floral-proposal-line-items';
  private readonly templateAssetBucket = 'proposal-template-assets';
  private readonly signedUrlExpirySeconds = 60 * 60;
  private readonly proposalAccessPath = '/proposal/auth';

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly floralProposalRepository: FloralProposalRepositoryService,
    private readonly floralProposalRenderer: FloralProposalRendererService
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

  async previewProposalPdf(
    payload: SubmitFloralProposalPayload
  ): Promise<PreviewFloralProposalPdfResult> {
    const { data, error } = await this.supabaseService
      .getClient()
      .functions.invoke('preview-floral-proposal-pdf', {
        body: payload,
      });

    if (error) {
      console.error(
        '[FloralProposalWorkflowService] previewProposalPdf invoke error:',
        error
      );
      throw new Error(
        'We could not generate the Floral Proposal PDF preview right now.'
      );
    }

    const response = (data ?? null) as PreviewFloralProposalPdfResponse | null;
    if (!response?.success || !response.pdf_base64) {
      throw new Error(
        response?.error ||
          'We could not generate the Floral Proposal PDF preview right now.'
      );
    }

    const bytes = Uint8Array.from(atob(response.pdf_base64), (char) =>
      char.charCodeAt(0)
    );
    const blob = new Blob([bytes], { type: 'application/pdf' });
    return {
      objectUrl: URL.createObjectURL(blob),
      pdfBase64: response.pdf_base64,
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

  async createRenderContract(
    input: FloralProposalRenderContractInput
  ): Promise<FloralProposalRenderContract> {
    const templateLogoUrl = await this.resolveTemplateLogoUrl(input.template);
    const lineItems = await Promise.all(
      input.renderPayload.line_items.map((line) =>
        this.resolveRenderLineItemAssets(line)
      )
    );

    return {
      proposal_id: input.proposal?.floral_proposal_id ?? null,
      proposal_version: input.proposal?.version ?? null,
      generated_at: new Date().toISOString(),
      lead: {
        lead_id: input.lead.lead_id,
        first_name: input.lead.first_name,
        last_name: input.lead.last_name,
        email: input.lead.email,
        service_type: input.lead.service_type,
        event_type: input.lead.event_type ?? null,
        event_date: input.lead.event_date ?? null,
        status: input.lead.status,
      },
      template: {
        template_id: input.template?.template_id ?? input.renderPayload.template_id ?? null,
        name: input.template?.name ?? input.renderPayload.template_name ?? null,
        template_key: input.template?.template_key ?? null,
        header_layout: input.template?.header_layout ?? null,
        line_item_layout: input.template?.line_item_layout ?? null,
        footer_layout: input.template?.footer_layout ?? null,
        logo_url: templateLogoUrl,
        primary_color: input.template?.primary_color ?? null,
        accent_color: input.template?.accent_color ?? null,
        heading_font_family: input.template?.heading_font_family ?? null,
        body_font_family: input.template?.body_font_family ?? null,
        show_cover_page: input.template?.show_cover_page ?? false,
        show_intro_message: input.template?.show_intro_message ?? false,
        intro_title: input.template?.intro_title ?? null,
        intro_body: input.template?.intro_body ?? null,
        show_terms_section: input.template?.show_terms_section ?? true,
        show_privacy_section: input.template?.show_privacy_section ?? true,
        show_signature_section: input.template?.show_signature_section ?? true,
        agreement_clauses: input.template?.agreement_clauses ?? [],
        header_content: input.template?.header_content ?? {},
        footer_content: input.template?.footer_content ?? {},
        body_config: input.template?.body_config ?? {},
        template_config: input.template?.template_config ?? {},
      },
      tax_region: {
        tax_region_id: input.taxRegion?.tax_region_id ?? input.renderPayload.tax_region_id ?? null,
        name: input.taxRegion?.name ?? input.renderPayload.tax_region_name ?? null,
        tax_rate: input.renderPayload.tax_rate,
      },
      pricing: {
        default_markup_percent: input.renderPayload.default_markup_percent,
        labor_percent: input.renderPayload.labor_percent,
      },
      line_items: lineItems,
      shopping_list: input.renderPayload.shopping_list,
      totals: {
        products_total: input.renderPayload.breakdown.productsTotal,
        labor_total: input.renderPayload.breakdown.laborTotal,
        fees_total: input.renderPayload.breakdown.feesTotal,
        discounts_total: input.renderPayload.breakdown.discountsTotal,
        subtotal: input.renderPayload.breakdown.subtotal,
        tax_amount: input.renderPayload.totals.taxAmount,
        total_amount: input.renderPayload.totals.totalAmount,
      },
      renderer_assets: {
        line_item_images: lineItems
          .filter((line) => line.image_storage_path || line.image_signed_url)
          .map((line) => ({
            display_order: line.display_order,
            item_name: line.item_name,
            storage_path: line.image_storage_path ?? null,
            signed_url: line.image_signed_url ?? null,
            alt_text: line.image_alt_text ?? null,
            caption: line.image_caption ?? null,
          })),
      },
    };
  }

  buildSubmissionPayload(args: {
    lead: Lead;
    renderContract: FloralProposalRenderContract;
    termsVersion?: string;
    privacyPolicyVersion?: string;
  }): SubmitFloralProposalPayload {
    return {
      floral_proposal_id: args.renderContract.proposal_id ?? null,
      lead_id: args.lead.lead_id,
      template_id: args.renderContract.template.template_id ?? null,
      tax_region_id: args.renderContract.tax_region.tax_region_id ?? null,
      line_items: args.renderContract.line_items.map((line) => ({
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
      shopping_list_items: args.renderContract.shopping_list,
      subtotal: args.renderContract.totals.subtotal,
      tax_rate: args.renderContract.tax_region.tax_rate,
      tax_amount: args.renderContract.totals.tax_amount,
      total_amount: args.renderContract.totals.total_amount,
      terms_version: args.termsVersion ?? 'v1',
      privacy_policy_version: args.privacyPolicyVersion ?? 'v1',
      render_contract: args.renderContract,
      render_html: this.floralProposalRenderer.renderHtml(args.renderContract),
      snapshot: {
        render_contract: args.renderContract,
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

  private async resolveTemplateLogoUrl(
    template?: DocumentTemplate | null
  ): Promise<string | null> {
    if (!template) return null;
    if (template.logo_url) return template.logo_url;
    if (!template.logo_storage_path) return null;

    try {
      return await this.createSignedStorageUrl(
        this.templateAssetBucket,
        template.logo_storage_path
      );
    } catch (error) {
      console.error(
        '[FloralProposalWorkflowService] resolveTemplateLogoUrl error:',
        error
      );
      return null;
    }
  }

  private async resolveRenderLineItemAssets(
    line: FloralProposalRenderPayload['line_items'][number]
  ): Promise<FloralProposalRenderLineItem> {
    if (line.image_signed_url || !line.image_storage_path) {
      return {
        ...line,
      };
    }

    try {
      const signedUrl = await this.getSignedLineItemImageUrl(line.image_storage_path);
      return {
        ...line,
        image_signed_url: signedUrl,
      };
    } catch (error) {
      console.error(
        '[FloralProposalWorkflowService] resolveRenderLineItemAssets error:',
        error
      );
      return {
        ...line,
        image_signed_url: null,
      };
    }
  }
}



