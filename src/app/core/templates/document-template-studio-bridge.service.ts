import { Injectable } from '@angular/core';

import {
  DocumentTemplate,
  DocumentTemplateUpsertInput,
} from '../models/floral-proposal';
import {
  CoverBlock,
  EventSummaryBlock,
  IntroNoteBlock,
  InvestmentSummaryBlock,
  LegacyOrStudioTemplate,
  MoodGalleryBlock,
  ProposalItemsBlock,
  ProposalRenderModel,
  SignatureClosingBlock,
  StoredTemplateStudioConfig,
  StoredTemplateStudioPublishedVersion,
  TemplateDefinition,
  TemplateSettings,
  TemplateTokens,
  TermsNextStepsBlock,
} from './template-studio.models';
import { TemplateValidationService } from './template-validation.service';

@Injectable({
  providedIn: 'root',
})
export class DocumentTemplateStudioBridgeService {
  constructor(
    private readonly templateValidationService: TemplateValidationService
  ) {}

  getTemplateDefinition(template: LegacyOrStudioTemplate | DocumentTemplate): TemplateDefinition {
    const stored = this.getStoredTemplateStudioConfig(template);
    if (stored) {
      return stored.definition;
    }

    return this.buildDefinitionFromLegacy(template);
  }

  getStoredPublishedVersions(
    template: LegacyOrStudioTemplate | DocumentTemplate
  ): StoredTemplateStudioPublishedVersion[] {
    return this.getStoredTemplateStudioConfig(template)?.published_versions ?? [];
  }

  buildUpsertInput(
    templateDefinition: TemplateDefinition,
    currentTemplate?: DocumentTemplate | null,
    storedConfigOverrides: Partial<StoredTemplateStudioConfig> = {}
  ): Partial<DocumentTemplateUpsertInput> {
    const coverBlock = templateDefinition.blocks.find(
      (block): block is CoverBlock => block.type === 'cover'
    );
    const introBlock = templateDefinition.blocks.find(
      (block): block is IntroNoteBlock => block.type === 'intro-note'
    );
    const proposalItemsBlock = templateDefinition.blocks.find(
      (block): block is ProposalItemsBlock => block.type === 'proposal-items'
    );
    const termsBlock = templateDefinition.blocks.find(
      (block): block is TermsNextStepsBlock => block.type === 'terms-and-next-steps'
    );
    const closingBlock = templateDefinition.blocks.find(
      (block): block is SignatureClosingBlock => block.type === 'signature-closing'
    );

    const currentStudioConfig = currentTemplate
      ? this.getStoredTemplateStudioConfig(currentTemplate)
      : null;

    return {
      name: templateDefinition.name,
      template_key: currentTemplate?.template_key ?? templateDefinition.slug,
      is_active: currentTemplate?.is_active ?? true,
      is_default: currentTemplate?.is_default ?? false,
      primary_color: templateDefinition.tokens.colors.primary,
      accent_color: templateDefinition.tokens.colors.accent,
      heading_font_family: templateDefinition.tokens.typography.heading_font_family,
      body_font_family: templateDefinition.tokens.typography.body_font_family,
      header_layout: this.mapCoverVariantToLegacyHeader(coverBlock?.layout_variant),
      line_item_layout: this.mapProposalItemsVariantToLegacyLayout(
        proposalItemsBlock?.layout_variant
      ),
      footer_layout: closingBlock?.layout_variant === 'editorial' ? 'formal' : 'signature_focused',
      show_cover_page: coverBlock?.enabled ?? false,
      show_intro_message: introBlock?.enabled ?? false,
      intro_title: introBlock?.content.section_title ?? currentTemplate?.intro_title ?? null,
      intro_body:
        (introBlock?.content.message_mode === 'custom'
          ? introBlock.content.custom_message
          : null) ??
        currentTemplate?.intro_body ??
        null,
      show_terms_section: termsBlock?.enabled ?? currentTemplate?.show_terms_section ?? true,
      show_privacy_section: currentTemplate?.show_privacy_section ?? true,
      show_signature_section:
        closingBlock?.enabled ?? currentTemplate?.show_signature_section ?? true,
      agreement_clauses: currentTemplate?.agreement_clauses ?? [],
      header_content: currentTemplate?.header_content ?? {},
      footer_content: currentTemplate?.footer_content ?? {},
      body_config: {
        ...(currentTemplate?.body_config ?? {}),
        template_studio_blocks: templateDefinition.blocks.map((block) => ({
          id: block.id,
          type: block.type,
          variant: block.layout_variant,
          enabled: block.enabled,
        })),
      },
      template_config: {
        ...(currentTemplate?.template_config ?? {}),
        template_studio: {
          definition: templateDefinition,
          source: 'template_studio',
          last_published_version:
            storedConfigOverrides.last_published_version ??
            currentStudioConfig?.last_published_version ??
            null,
          published_versions:
            storedConfigOverrides.published_versions ??
            currentStudioConfig?.published_versions ??
            [],
        } satisfies StoredTemplateStudioConfig,
      },
    };
  }

  validateTemplateDefinition(
    template: TemplateDefinition,
    previewProfile?: ProposalRenderModel,
    forPublish = false
  ) {
    return forPublish
      ? this.templateValidationService.validateForPublish(template, previewProfile)
      : this.templateValidationService.validateTemplate(template, previewProfile);
  }

  getStoredTemplateStudioConfig(
    template: LegacyOrStudioTemplate | DocumentTemplate
  ): StoredTemplateStudioConfig | null {
    const studioValue = (template.template_config as LegacyOrStudioTemplate['template_config'])
      ?.template_studio;

    if (!studioValue || typeof studioValue !== 'object') {
      return null;
    }

    const definition = studioValue.definition;
    if (!definition || definition.schema_version !== '1.0') {
      return null;
    }

    return studioValue;
  }

  private buildDefinitionFromLegacy(template: DocumentTemplate): TemplateDefinition {
    const now = new Date().toISOString();
    const settings: TemplateSettings = {
      page: {
        size: 'letter',
        orientation: 'portrait',
        margins: {
          top: 40,
          right: 40,
          bottom: 40,
          left: 40,
        },
      },
      header_footer: {
        show_page_numbers: false,
        show_business_name: true,
        footer_text: template.name,
      },
      defaults: {
        show_prices: true,
        show_images: true,
        show_line_item_notes: false,
        show_gallery_captions: true,
      },
    };

    const tokens: TemplateTokens = {
      colors: {
        canvas: '#fbf8f5',
        surface: '#ffffff',
        text: '#1f1b19',
        muted_text: '#6b625c',
        primary: template.primary_color ?? '#111111',
        accent: template.accent_color ?? '#ea938c',
        border: '#e6ddd6',
      },
      typography: {
        heading_font_family:
          template.heading_font_family ?? 'Cormorant Garamond, Georgia, serif',
        body_font_family:
          template.body_font_family ?? 'Source Sans 3, Arial, sans-serif',
        sizes: {
          h1: 42,
          h2: 28,
          h3: 20,
          body: 14,
          small: 12,
          caption: 11,
        },
        weights: {
          heading: 600,
          body: 400,
          strong: 600,
        },
        line_heights: {
          heading: 1.1,
          body: 1.75,
          compact: 1.3,
        },
        letter_spacing: {
          caps: 0.26,
          heading: 0,
        },
      },
      spacing: {
        page_section_gap: 28,
        block_padding: 24,
        card_gap: 20,
        grid_gap: 24,
        line_item_gap: 22,
      },
      radius: {
        sm: 12,
        md: 18,
        lg: 22,
        xl: 28,
      },
      borders: {
        width: 1,
        style: 'solid',
      },
      shadows: {
        card: 'soft',
        image: 'soft',
      },
    };

    const blocks = [
      {
        id: 'cover',
        type: 'cover',
        enabled: template.show_cover_page,
        order: 1,
        layout_variant: this.mapLegacyHeaderToCoverVariant(template.header_layout),
        content: {
          title_mode: 'proposal_title',
          subtitle_mode: 'event_summary',
          show_logo: true,
          show_hero_image: true,
          hero_image_source: 'gallery.hero',
        },
        styles: {
          alignment: template.header_layout === 'classic' ? 'center' : 'left',
          padding: 32,
        },
      } satisfies CoverBlock,
      {
        id: 'intro-note',
        type: 'intro-note',
        enabled: template.show_intro_message,
        order: 2,
        layout_variant: 'simple',
        content: {
          section_title: template.intro_title ?? 'Welcome',
          message_mode: template.intro_body ? 'custom' : 'intro.welcome_message',
          custom_message: template.intro_body ?? null,
        },
        styles: {
          alignment: 'left',
          padding: 24,
        },
      } satisfies IntroNoteBlock,
      {
        id: 'event-summary',
        type: 'event-summary',
        enabled: true,
        order: 3,
        layout_variant: 'two-column',
        content: {
          section_title: 'Event Summary',
          show_event_type: true,
          show_event_date: true,
          show_venue: true,
          show_guest_count: true,
          show_planner: true,
        },
      } satisfies EventSummaryBlock,
      {
        id: 'mood-gallery',
        type: 'mood-gallery',
        enabled: false,
        order: 4,
        layout_variant: 'grid',
        content: {
          section_title: 'Inspiration',
          show_captions: true,
          max_images: 6,
        },
      } satisfies MoodGalleryBlock,
      {
        id: 'proposal-items',
        type: 'proposal-items',
        enabled: true,
        order: 5,
        layout_variant: this.mapLegacyLineItemsToProposalVariant(template.line_item_layout),
        content: {
          section_title: 'Floral Proposal',
          section_intro: null,
          show_item_images: true,
          show_item_descriptions: true,
          show_item_notes: false,
          show_quantity: false,
          show_category: true,
          show_prices: true,
        },
        bindings: {
          source: 'line_items',
        },
        styles: {
          image_aspect_ratio: 'portrait',
          padding: 24,
        },
      } satisfies ProposalItemsBlock,
      {
        id: 'investment-summary',
        type: 'investment-summary',
        enabled: true,
        order: 6,
        layout_variant: 'classic',
        content: {
          title: 'Investment',
          show_subtotal: true,
          show_discount: true,
          show_tax: true,
          show_service_fee: true,
          show_grand_total: true,
          show_payment_schedule: true,
          highlight_grand_total: true,
        },
        bindings: {
          source: 'investment',
        },
      } satisfies InvestmentSummaryBlock,
      {
        id: 'terms-and-next-steps',
        type: 'terms-and-next-steps',
        enabled: template.show_terms_section || template.show_privacy_section,
        order: 7,
        layout_variant: 'stacked',
        content: {
          title: 'Terms & Next Steps',
          show_payment_terms: template.show_terms_section,
          show_cancellation_policy: template.show_terms_section,
          show_revision_policy: template.show_privacy_section,
          show_acceptance_instructions: template.show_signature_section,
        },
      } satisfies TermsNextStepsBlock,
      {
        id: 'signature-closing',
        type: 'signature-closing',
        enabled: template.show_signature_section,
        order: 8,
        layout_variant: template.footer_layout === 'formal' ? 'editorial' : 'simple',
        content: {
          title: 'With Appreciation',
          message_mode: 'intro.closing_message',
          custom_message: null,
          show_signature_name: true,
          show_signature_title: true,
        },
        styles: {
          alignment: template.footer_layout === 'formal' ? 'center' : 'left',
        },
      } satisfies SignatureClosingBlock,
    ];

    return {
      schema_version: '1.0',
      id: template.template_id,
      name: template.name,
      slug: template.template_key,
      description: 'Migrated from legacy Floral Proposal template settings.',
      status: template.is_active ? 'draft' : 'archived',
      version: 1,
      settings,
      tokens,
      blocks,
      assets: template.logo_url
        ? [
            {
              id: 'logo',
              type: 'logo',
              url: template.logo_url,
              alt: `${template.name} logo`,
            },
          ]
        : [],
      advanced: {
        custom_css: null,
        partial_overrides: {},
      },
      metadata: {
        created_by: 'system',
        updated_by: 'system',
        created_at: template.created_at ?? now,
        updated_at: template.updated_at ?? now,
        published_at: null,
      },
    };
  }

  private mapLegacyHeaderToCoverVariant(
    layout: DocumentTemplate['header_layout']
  ): CoverBlock['layout_variant'] {
    switch (layout) {
      case 'minimal':
        return 'minimal';
      case 'classic':
        return 'romantic';
      default:
        return 'editorial';
    }
  }

  private mapLegacyLineItemsToProposalVariant(
    layout: DocumentTemplate['line_item_layout']
  ): ProposalItemsBlock['layout_variant'] {
    switch (layout) {
      case 'stacked':
        return 'editorial-list';
      case 'image_right':
        return 'cards';
      default:
        return 'stacked';
    }
  }

  private mapCoverVariantToLegacyHeader(
    variant: CoverBlock['layout_variant'] | undefined
  ): DocumentTemplate['header_layout'] {
    switch (variant) {
      case 'minimal':
        return 'minimal';
      case 'romantic':
        return 'classic';
      default:
        return 'editorial';
    }
  }

  private mapProposalItemsVariantToLegacyLayout(
    variant: ProposalItemsBlock['layout_variant'] | undefined
  ): DocumentTemplate['line_item_layout'] {
    switch (variant) {
      case 'cards':
        return 'image_right';
      case 'editorial-list':
        return 'stacked';
      default:
        return 'image_left';
    }
  }
}
