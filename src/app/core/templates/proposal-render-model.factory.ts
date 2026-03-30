import { Injectable } from '@angular/core';

import {
  FloralProposalRenderContract,
  FloralProposalRenderLineItem,
} from '../models/floral-proposal';
import { ProposalRenderModel } from './template-studio.models';

@Injectable({
  providedIn: 'root',
})
export class ProposalRenderModelFactory {
  fromLegacyRenderContract(
    contract: FloralProposalRenderContract,
    options?: {
      proposalTitle?: string | null;
      sampleData?: boolean;
      businessName?: string | null;
      signatureName?: string | null;
      signatureTitle?: string | null;
      proposalAccessUrl?: string | null;
    }
  ): ProposalRenderModel {
    const primaryContactName = `${contract.lead.first_name} ${contract.lead.last_name}`.trim();
    const heroImage = this.firstLineItemImage(contract.line_items);

    return {
      schema_version: '1.0',
      proposal: {
        id: contract.proposal_id ?? '',
        number: contract.proposal_version ? `FP-${contract.proposal_version}` : 'FP-DRAFT',
        title: options?.proposalTitle?.trim() || contract.template.name || 'Floral Proposal',
        status: this.mapProposalStatus(contract),
        created_at: contract.generated_at,
        updated_at: contract.generated_at,
        currency: 'USD',
      },
      branding: {
        business_name: options?.businessName?.trim() || 'Black Begonia',
        logo_url: contract.template.logo_url ?? null,
      },
      client: {
        primary_contact: {
          first_name: contract.lead.first_name,
          last_name: contract.lead.last_name,
          full_name: primaryContactName,
          email: contract.lead.email,
        },
      },
      event: {
        type: contract.lead.event_type || contract.lead.service_type,
        date: contract.lead.event_date ?? null,
      },
      intro: {
        welcome_message: contract.template.intro_body ?? null,
        closing_message: null,
        signature_name: options?.signatureName ?? null,
        signature_title: options?.signatureTitle ?? null,
      },
      gallery: {
        hero_image_url: heroImage?.image_signed_url ?? null,
        mood_images: contract.line_items
          .filter((line) => !!line.image_signed_url)
          .map((line) => ({
            id: `${line.display_order}`,
            url: line.image_signed_url!,
            alt: line.image_alt_text ?? line.item_name,
            caption: line.image_caption ?? null,
          })),
      },
      line_items: contract.line_items.map((line) => this.mapLineItem(line)),
      inclusions: [],
      investment: {
        subtotal: contract.totals.subtotal,
        discount_total: Math.abs(contract.totals.discounts_total || 0),
        tax_total: contract.totals.tax_amount,
        grand_total: contract.totals.total_amount,
      },
      terms: {
        payment_terms: contract.template.show_terms_section
          ? 'A signed proposal and deposit are required to reserve your date.'
          : null,
        notes: Array.isArray(contract.template.agreement_clauses)
          ? contract.template.agreement_clauses
              .map((clause) => String(clause['label'] ?? clause['title'] ?? '').trim())
              .filter(Boolean)
              .join('\n')
          : null,
      },
      cta: {
        acceptance_label: 'Approve Proposal',
        acceptance_instructions: contract.template.show_signature_section
          ? 'Review the proposal carefully, then approve it through the client access portal.'
          : null,
        proposal_access_url: options?.proposalAccessUrl ?? null,
      },
      meta: {
        generated_at: contract.generated_at,
        sample_data: options?.sampleData ?? false,
        source_contract: contract,
      },
    };
  }

  private mapLineItem(line: FloralProposalRenderLineItem): ProposalRenderModel['line_items'][number] {
    return {
      id: `${line.display_order}`,
      name: line.item_name,
      category: line.line_type_label,
      description: line.components.length
        ? line.components
            .slice(0, 4)
            .map((component) => component.catalog_item_name)
            .join(', ')
        : null,
      quantity: line.quantity,
      unit_label: 'item',
      image_url: line.image_signed_url ?? null,
      notes: line.image_caption ?? null,
      pricing: {
        unit_price: line.unit_price,
        line_total: line.subtotal,
        price_visible: true,
      },
    };
  }

  private firstLineItemImage(
    lineItems: FloralProposalRenderLineItem[]
  ): FloralProposalRenderLineItem | null {
    return lineItems.find((line) => !!line.image_signed_url) ?? null;
  }

  private mapProposalStatus(
    contract: FloralProposalRenderContract
  ): ProposalRenderModel['proposal']['status'] {
    if (contract.proposal_id) {
      return 'approved';
    }

    return 'draft';
  }
}
