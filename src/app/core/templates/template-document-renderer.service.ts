import { Injectable } from '@angular/core';

import {
  CoverBlock,
  EventSummaryBlock,
  IntroNoteBlock,
  InvestmentSummaryBlock,
  MoodGalleryBlock,
  ProposalItemsBlock,
  RenderTemplateInput,
  RenderTemplateOutput,
  SignatureClosingBlock,
  TemplateBlock,
  TermsNextStepsBlock,
} from './template-studio.models';
import { TemplatePartialRegistry } from './template-partial-registry';
import { TemplateRenderHelpersService } from './template-render-helpers.service';

@Injectable({
  providedIn: 'root',
})
export class TemplateDocumentRendererService {
  constructor(
    private readonly helpers: TemplateRenderHelpersService,
    private readonly partialRegistry: TemplatePartialRegistry
  ) {}

  render(input: RenderTemplateInput): RenderTemplateOutput {
    const enabledBlocks = input.template.blocks
      .filter(
        (block) =>
          block.enabled &&
          this.matchesEventType(block, input.proposal.event.type) &&
          this.matchesRequiredDataPaths(block, input.proposal)
      )
      .slice()
      .sort((a, b) => a.order - b.order);

    const warnings: string[] = [];
    const html = enabledBlocks
      .map((block) => this.renderBlock(block, input, warnings))
      .join('\n');

    return {
      html: this.wrapDocument(input, html),
      css: this.buildCss(input),
      warnings,
    };
  }

  private wrapDocument(input: RenderTemplateInput, blocksHtml: string): string {
    return `
      <div class="template-document" data-render-mode="${input.mode}">
        ${blocksHtml}
      </div>
    `.trim();
  }

  private buildCss(input: RenderTemplateInput): string {
    const { colors, typography, spacing, radius, borders } = input.template.tokens;
    const customCss = input.template.advanced?.custom_css?.trim();

    return `
      :root {
        --template-canvas: ${colors.canvas};
        --template-surface: ${colors.surface};
        --template-text: ${colors.text};
        --template-muted-text: ${colors.muted_text};
        --template-primary: ${colors.primary};
        --template-accent: ${colors.accent};
        --template-border: ${colors.border};
        --template-heading-font: ${typography.heading_font_family};
        --template-body-font: ${typography.body_font_family};
        --template-space-section: ${spacing.page_section_gap}px;
        --template-space-block: ${spacing.block_padding}px;
        --template-radius-sm: ${radius.sm}px;
        --template-radius-lg: ${radius.lg}px;
        --template-radius-xl: ${radius.xl}px;
        --template-border-width: ${borders.width}px;
      }

      * {
        box-sizing: border-box;
      }

      .template-document {
        background: var(--template-canvas);
        color: var(--template-text);
        font-family: var(--template-body-font);
        padding: ${input.template.settings.page.margins.top}px ${input.template.settings.page.margins.right}px ${input.template.settings.page.margins.bottom}px ${input.template.settings.page.margins.left}px;
      }

      .template-block {
        position: relative;
        overflow: hidden;
        isolation: isolate;
        background: var(--template-surface);
        border: var(--template-border-width) solid var(--template-border);
        border-radius: var(--template-radius-lg);
        padding: var(--template-space-block);
      }

      .template-block + .template-block {
        margin-top: var(--template-space-section);
      }

      .template-block__overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 0;
      }

      .template-block > * {
        position: relative;
        z-index: 1;
      }

      .template-heading {
        margin: 0 0 12px;
        color: var(--template-primary);
        font-family: var(--template-heading-font);
        line-height: 1.08;
      }

      .template-eyebrow {
        margin: 0 0 10px;
        color: var(--template-accent);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.24em;
        text-transform: uppercase;
      }

      .template-muted {
        color: var(--template-muted-text);
        line-height: 1.7;
        margin: 0;
      }

      .template-grid {
        display: grid;
        gap: 18px;
      }

      .template-grid.two-column {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .template-pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        background: color-mix(in srgb, var(--template-accent) 14%, white);
        color: var(--template-primary);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.14em;
        padding: 5px 10px;
        text-transform: uppercase;
      }

      .template-kicker-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 14px;
      }

      .template-cover--editorial {
        min-height: 520px;
        display: grid;
        align-items: end;
        background: linear-gradient(160deg, color-mix(in srgb, var(--template-accent) 10%, white), white 62%);
      }

      .template-cover--minimal {
        text-align: center;
        background: white;
      }

      .template-cover--romantic {
        min-height: 560px;
        background: linear-gradient(135deg, color-mix(in srgb, var(--template-accent) 16%, white), white 55%);
        padding-top: calc(var(--template-space-block) * 1.5);
        padding-bottom: calc(var(--template-space-block) * 1.5);
      }

      .template-cover__hero-frame {
        margin-top: 24px;
        border-radius: var(--template-radius-xl);
        overflow: hidden;
        border: 1px solid var(--template-border);
        background: color-mix(in srgb, var(--template-canvas) 55%, white);
      }

      .template-cover__hero-frame img {
        display: block;
        width: 100%;
        height: 320px;
        object-fit: cover;
      }

      .template-cover--editorial .template-cover__hero-frame img,
      .template-cover--romantic .template-cover__hero-frame img {
        height: 380px;
      }

      .template-intro--simple {
        display: grid;
        gap: 16px;
      }

      .template-intro--editorial {
        display: grid;
        grid-template-columns: minmax(0, 0.7fr) minmax(0, 1.3fr);
        gap: 28px;
        align-items: start;
      }

      .template-event--two-column .template-event-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .template-event--stacked .template-event-grid,
      .template-event--minimal .template-event-grid {
        grid-template-columns: minmax(0, 1fr);
      }

      .template-event-card {
        border: 1px solid var(--template-border);
        border-radius: calc(var(--template-radius-lg) - 4px);
        padding: 16px;
        background: color-mix(in srgb, var(--template-canvas) 50%, white);
      }

      .template-event--minimal .template-event-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .template-gallery--grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .template-gallery--editorial-strip {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .template-gallery--hero-grid {
        grid-template-columns: 1.2fr 0.8fr;
      }

      .template-gallery--hero-grid .template-gallery-card:first-child {
        grid-row: span 2;
      }

      .template-gallery-card {
        border: 1px solid var(--template-border);
        border-radius: calc(var(--template-radius-lg) - 4px);
        padding: 14px;
        background: color-mix(in srgb, var(--template-canvas) 55%, white);
      }

      .template-gallery-card img {
        display: block;
        width: 100%;
        object-fit: cover;
        border-radius: 14px;
      }

      .template-gallery--grid .template-gallery-card img {
        height: 220px;
      }

      .template-gallery--editorial-strip .template-gallery-card img {
        height: 180px;
      }

      .template-gallery--hero-grid .template-gallery-card img {
        height: 220px;
      }

      .template-gallery--hero-grid .template-gallery-card:first-child img {
        height: 462px;
      }

      .template-items--stacked,
      .template-items--cards,
      .template-items--editorial-list,
      .template-services--cards {
        display: grid;
        gap: 18px;
      }

      .template-items--cards {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .template-item-card,
      .template-service-card {
        border: 1px solid var(--template-border);
        border-radius: calc(var(--template-radius-lg) - 6px);
        padding: 18px;
        background: color-mix(in srgb, var(--template-canvas) 55%, white);
      }

      .template-items--stacked .template-item-card {
        display: grid;
        grid-template-columns: minmax(0, 220px) minmax(0, 1fr);
        gap: 20px;
        align-items: start;
      }

      .template-items--editorial-list .template-item-card {
        border: none;
        border-bottom: 1px solid var(--template-border);
        border-radius: 0;
        padding: 18px 0;
        background: transparent;
      }

      .template-items--editorial-list .template-item-card:last-child {
        border-bottom: none;
      }

      .template-item-card img {
        display: block;
        width: 100%;
        border-radius: 14px;
        object-fit: cover;
      }

      .template-investment--classic,
      .template-investment--boxed,
      .template-investment--minimal {
        display: grid;
        gap: 12px;
      }

      .template-investment-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
      }

      .template-investment--boxed .template-investment-row {
        border: 1px solid var(--template-border);
        border-radius: 16px;
        padding: 12px 14px;
        background: color-mix(in srgb, var(--template-canvas) 50%, white);
      }

      .template-investment--minimal .template-investment-row {
        border-bottom: 1px solid var(--template-border);
        padding-bottom: 10px;
      }

      .template-investment--minimal .template-investment-row:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }

      .template-terms--stacked {
        display: grid;
        gap: 14px;
      }

      .template-terms--split {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
      }

      .template-terms-card {
        border: 1px solid var(--template-border);
        border-radius: 16px;
        padding: 16px;
        background: color-mix(in srgb, var(--template-canvas) 55%, white);
      }

      .template-signature--simple {
        display: grid;
        gap: 12px;
      }

      .template-signature--editorial {
        text-align: center;
        padding-top: calc(var(--template-space-block) * 1.4);
      }

      .template-services--bulleted {
        display: grid;
        gap: 10px;
      }

      .template-services--cards {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      @media (max-width: 900px) {
        .template-grid.two-column,
        .template-intro--editorial,
        .template-items--cards,
        .template-items--stacked,
        .template-gallery--grid,
        .template-gallery--editorial-strip,
        .template-gallery--hero-grid,
        .template-terms--split,
        .template-services--cards {
          grid-template-columns: minmax(0, 1fr);
        }

        .template-gallery--hero-grid .template-gallery-card:first-child {
          grid-row: auto;
        }

        .template-gallery--hero-grid .template-gallery-card:first-child img {
          height: 260px;
        }
      }

      ${customCss ? `\n${customCss}\n` : ''}
    `.trim();
  }

  private renderBlock(
    block: TemplateBlock,
    input: RenderTemplateInput,
    warnings: string[]
  ): string {
    const partialKey = this.partialRegistry.getPartialKey(block.type, block.layout_variant);
    if (!this.partialRegistry.isSupportedPartialKey(partialKey)) {
      warnings.push(`Unsupported partial key "${partialKey}" resolved for block "${block.id}".`);
    }

    switch (block.type) {
      case 'cover':
        return this.renderCover(block, input);
      case 'intro-note':
        return this.renderIntroNote(block, input);
      case 'event-summary':
        return this.renderEventSummary(block, input);
      case 'mood-gallery':
        return this.renderMoodGallery(block, input, warnings);
      case 'proposal-items':
        return this.renderProposalItems(block, input, warnings);
      case 'investment-summary':
        return this.renderInvestmentSummary(block, input);
      case 'terms-and-next-steps':
        return this.renderTerms(block, input);
      case 'signature-closing':
        return this.renderClosing(block, input);
      case 'included-services':
        return this.renderIncludedServices(block, input);
      default:
        warnings.push(`No renderer is registered for block type "${(block as TemplateBlock).type}".`);
        return '';
    }
  }

  private renderCover(block: CoverBlock, input: RenderTemplateInput): string {
    const title =
      block.content.title_mode === 'custom'
        ? block.content.custom_title || input.proposal.proposal.title
        : input.proposal.proposal.title;
    const subtitle =
      block.content.subtitle_mode === 'custom'
        ? block.content.custom_subtitle
        : `${input.proposal.event.type}${input.proposal.event.date ? ` | ${this.helpers.formatDate(input.proposal.event.date)}` : ''}`;
    const heroAsset =
      block.content.hero_image_source === 'asset'
        ? input.template.assets.find((asset) => asset.id === block.content.hero_asset_id)
        : null;
    const heroImageUrl =
      block.content.hero_image_source === 'gallery.hero'
        ? input.proposal.gallery.hero_image_url
        : heroAsset?.url ?? null;
    const logoImageUrl =
      input.template.assets.find((asset) => asset.type === 'logo')?.url ??
      input.proposal.branding.logo_url ??
      null;

    const editorialKickers = [
      input.proposal.event.venue_name,
      input.proposal.event.venue_city,
      input.proposal.client?.primary_contact?.full_name,
    ].filter((value): value is string => !!value);

    return `
      <section ${this.buildBlockAttributes(block, input, `template-block template-cover template-cover--${block.layout_variant}`)}>
        ${this.buildBlockOverlay(block, input)}
        ${
          block.content.show_logo && logoImageUrl
            ? `<img src="${this.escapeHtml(logoImageUrl)}" alt="${this.escapeHtml(input.proposal.branding.business_name)}" style="max-height:72px;max-width:180px;object-fit:contain;margin-bottom:18px;" />`
            : ''
        }
        <p class="template-eyebrow">${this.escapeHtml(input.proposal.branding.business_name)}</p>
        ${
          block.layout_variant === 'editorial' && editorialKickers.length
            ? `<div class="template-kicker-row">${editorialKickers
                .map((value) => `<span class="template-pill">${this.escapeHtml(value)}</span>`)
                .join('')}</div>`
            : ''
        }
        <h1 class="template-heading" style="${this.composeStyle(this.getHeadingStyle(block, input, block.layout_variant === 'minimal' ? 46 : 58), `max-width:${block.layout_variant === 'minimal' ? '760px' : '680px'}`)}">${this.escapeHtml(title)}</h1>
        ${subtitle ? `<p class="template-muted" style="${this.composeStyle(this.getBodyStyle(block, input, 15), 'max-width:620px')}">${this.escapeHtml(subtitle)}</p>` : ''}
        ${
          block.content.show_hero_image && heroImageUrl
            ? `<div class="template-cover__hero-frame"><img src="${this.escapeHtml(heroImageUrl)}" alt="${this.escapeHtml(title)}" style="${this.getImageStyle(block, this.getHeroHeight(block, block.layout_variant === 'minimal' ? 320 : 380))}" /></div>`
            : ''
        }
      </section>
    `.trim();
  }

  private renderIntroNote(block: IntroNoteBlock, input: RenderTemplateInput): string {
    const message =
      block.content.message_mode === 'custom'
        ? block.content.custom_message
        : input.proposal.intro.welcome_message;

    return `
      <section ${this.buildBlockAttributes(block, input, `template-block template-intro--${block.layout_variant}`)}>
        ${this.buildBlockOverlay(block, input)}
        <div>
          <p class="template-eyebrow">Introduction</p>
          <h2 class="template-heading" style="${this.getHeadingStyle(block, input, 34)}">${this.escapeHtml(block.content.section_title)}</h2>
        </div>
        <div>
          <p class="template-muted" style="${this.getBodyStyle(block, input, 15)}">${this.escapeHtml(message || '')}</p>
        </div>
      </section>
    `.trim();
  }

  private renderEventSummary(block: EventSummaryBlock, input: RenderTemplateInput): string {
    const details = [
      block.content.show_event_type ? ['Event Type', input.proposal.event.type] : null,
      block.content.show_event_date && input.proposal.event.date
        ? ['Event Date', this.helpers.formatDate(input.proposal.event.date)]
        : null,
      block.content.show_venue && input.proposal.event.venue_name
        ? ['Venue', input.proposal.event.venue_name]
        : null,
      block.content.show_guest_count && input.proposal.event.guest_count
        ? ['Guest Count', `${input.proposal.event.guest_count}`]
        : null,
      block.content.show_planner && input.proposal.event.planner_name
        ? ['Planner', input.proposal.event.planner_name]
        : null,
    ].filter((detail): detail is [string, string] => !!detail);

    return `
      <section ${this.buildBlockAttributes(block, input, `template-block template-event--${block.layout_variant}`)}>
        ${this.buildBlockOverlay(block, input)}
        <p class="template-eyebrow">Event Summary</p>
        <h2 class="template-heading" style="${this.getHeadingStyle(block, input, 30)}">${this.escapeHtml(block.content.section_title)}</h2>
        <div class="template-grid template-event-grid">
          ${details
            .map(
              ([label, value]) => `
                <div class="template-event-card">
                  <p class="template-pill">${this.escapeHtml(label)}</p>
                  <p class="template-muted" style="${this.composeStyle(this.getBodyStyle(block, input, 14), 'margin-top:12px')}">${this.escapeHtml(value)}</p>
                </div>
              `
            )
            .join('')}
        </div>
      </section>
    `.trim();
  }

  private renderMoodGallery(
    block: MoodGalleryBlock,
    input: RenderTemplateInput,
    warnings: string[]
  ): string {
    const images = this.helpers.limit(
      input.proposal.gallery.mood_images,
      block.content.max_images || 6
    );

    if (!images.length) {
      warnings.push('Mood gallery block is enabled but no mood images are available.');
      return '';
    }

    return `
      <section ${this.buildBlockAttributes(block, input, 'template-block')}>
        ${this.buildBlockOverlay(block, input)}
        <p class="template-eyebrow">Mood Board</p>
        <h2 class="template-heading" style="${this.getHeadingStyle(block, input, 30)}">${this.escapeHtml(block.content.section_title)}</h2>
        <div class="template-grid template-gallery--${block.layout_variant}">
          ${images
            .map(
              (image: { url: string; caption?: string | null }) => `
                <div class="template-gallery-card">
                  <img src="${this.escapeHtml(image.url)}" alt="${this.escapeHtml(image.caption || 'Inspiration image')}" style="${this.getImageStyle(block, this.getHeroHeight(block, this.getGalleryHeight(block)))}" />
                  ${
                    block.content.show_captions
                      ? `<div class="template-muted" style="${this.composeStyle(this.getBodyStyle(block, input, 13), 'margin-top:10px')}">${this.escapeHtml(image.caption || 'Inspiration image')}</div>`
                      : ''
                  }
                </div>
              `
            )
            .join('')}
        </div>
      </section>
    `.trim();
  }

  private renderProposalItems(
    block: ProposalItemsBlock,
    input: RenderTemplateInput,
    warnings: string[]
  ): string {
    if (!input.proposal.line_items.length) {
      warnings.push('Proposal items block is enabled but the proposal has no line items.');
      return '';
    }

    return `
      <section ${this.buildBlockAttributes(block, input, 'template-block')}>
        ${this.buildBlockOverlay(block, input)}
        <p class="template-eyebrow">Proposal Items</p>
        <h2 class="template-heading" style="${this.getHeadingStyle(block, input, 30)}">${this.escapeHtml(block.content.section_title)}</h2>
        ${
          block.content.section_intro
            ? `<p class="template-muted" style="${this.composeStyle(this.getBodyStyle(block, input, 14), 'margin-bottom:18px')}">${this.escapeHtml(block.content.section_intro)}</p>`
            : ''
        }
        <div class="template-items--${block.layout_variant}">
          ${input.proposal.line_items
            .map(
              (item) => `
                <article class="template-item-card">
                  ${
                    block.content.show_item_images && item.image_url
                      ? `<img src="${this.escapeHtml(item.image_url)}" alt="${this.escapeHtml(item.name)}" style="${this.getImageStyle(block, this.getHeroHeight(block, this.getImageHeight(block)))}" />`
                      : ''
                  }
                  <div>
                    <h3 class="template-heading" style="${this.getHeadingStyle(block, input, 24)}">${this.escapeHtml(item.name)}</h3>
                    ${
                      block.content.show_category && item.category
                        ? `<p class="template-pill">${this.escapeHtml(item.category)}</p>`
                        : ''
                    }
                    ${
                      block.content.show_quantity && item.quantity
                        ? `<p class="template-muted" style="${this.composeStyle(this.getBodyStyle(block, input, 14), 'margin-top:12px')}">Quantity: ${this.escapeHtml(String(item.quantity))}${item.unit_label ? ` ${this.escapeHtml(item.unit_label)}` : ''}</p>`
                        : ''
                    }
                    ${
                      block.content.show_item_descriptions && item.description
                        ? `<p class="template-muted" style="${this.composeStyle(this.getBodyStyle(block, input, 14), 'margin-top:12px')}">${this.escapeHtml(item.description)}</p>`
                        : ''
                    }
                    ${
                      block.content.show_item_notes && item.notes
                        ? `<p class="template-muted" style="${this.composeStyle(this.getBodyStyle(block, input, 14), 'margin-top:12px;font-style:italic')}">${this.escapeHtml(item.notes)}</p>`
                        : ''
                    }
                    ${
                      block.content.show_prices && item.pricing.price_visible
                        ? `<p class="template-muted" style="${this.composeStyle(this.getBodyStyle(block, input, 14), 'margin-top:14px;font-weight:600')}">${this.helpers.formatCurrency(
                            item.pricing.line_total,
                            input.proposal.proposal.currency
                          )}</p>`
                        : ''
                    }
                  </div>
                </article>
              `
            )
            .join('')}
        </div>
      </section>
    `.trim();
  }

  private renderInvestmentSummary(
    block: InvestmentSummaryBlock,
    input: RenderTemplateInput
  ): string {
    const rows = [
      block.content.show_subtotal
        ? ['Subtotal', this.helpers.formatCurrency(input.proposal.investment.subtotal, input.proposal.proposal.currency)]
        : null,
      block.content.show_tax && this.helpers.hasValue(input.proposal.investment.tax_total)
        ? ['Tax', this.helpers.formatCurrency(input.proposal.investment.tax_total || 0, input.proposal.proposal.currency)]
        : null,
      block.content.show_service_fee && this.helpers.hasValue(input.proposal.investment.service_fee_total)
        ? ['Service Fee', this.helpers.formatCurrency(input.proposal.investment.service_fee_total || 0, input.proposal.proposal.currency)]
        : null,
      block.content.show_grand_total
        ? ['Grand Total', this.helpers.formatCurrency(input.proposal.investment.grand_total, input.proposal.proposal.currency)]
        : null,
    ].filter((row): row is [string, string] => !!row);

    return `
      <section ${this.buildBlockAttributes(block, input, 'template-block')}>
        ${this.buildBlockOverlay(block, input)}
        <p class="template-eyebrow">Investment</p>
        <h2 class="template-heading" style="${this.getHeadingStyle(block, input, 30)}">${this.escapeHtml(block.content.title)}</h2>
        <div class="template-investment--${block.layout_variant}">
          ${rows
            .map(
              ([label, value]) => `
                <div class="template-investment-row">
                  <span class="template-muted" style="${this.getBodyStyle(block, input, 14)}">${this.escapeHtml(label)}</span>
                  <strong>${this.escapeHtml(value)}</strong>
                </div>
              `
            )
            .join('')}
        </div>
      </section>
    `.trim();
  }

  private renderTerms(block: TermsNextStepsBlock, input: RenderTemplateInput): string {
    const rows = [
      block.content.show_payment_terms ? ['Payment Terms', input.proposal.terms.payment_terms] : null,
      block.content.show_cancellation_policy ? ['Cancellation Policy', input.proposal.terms.cancellation_policy] : null,
      block.content.show_revision_policy ? ['Revision Policy', input.proposal.terms.revision_policy] : null,
      block.content.show_acceptance_instructions ? ['Next Steps', input.proposal.cta.acceptance_instructions] : null,
    ].filter((value): value is [string, string] => !!value?.[1]);

    return `
      <section ${this.buildBlockAttributes(block, input, 'template-block')}>
        ${this.buildBlockOverlay(block, input)}
        <p class="template-eyebrow">Terms & Next Steps</p>
        <h2 class="template-heading" style="${this.getHeadingStyle(block, input, 30)}">${this.escapeHtml(block.content.title)}</h2>
        <div class="template-terms--${block.layout_variant}">
          ${rows
            .map(
              ([label, row]) => `
                <div class="template-terms-card">
                  <p class="template-pill">${this.escapeHtml(label)}</p>
                  <p class="template-muted" style="${this.composeStyle(this.getBodyStyle(block, input, 14), 'margin-top:12px')}">${this.escapeHtml(row)}</p>
                </div>
              `
            )
            .join('')}
        </div>
      </section>
    `.trim();
  }

  private renderClosing(block: SignatureClosingBlock, input: RenderTemplateInput): string {
    const message =
      block.content.message_mode === 'custom'
        ? block.content.custom_message
        : input.proposal.intro.closing_message;

    return `
      <section ${this.buildBlockAttributes(block, input, `template-block template-signature--${block.layout_variant}`)}>
        ${this.buildBlockOverlay(block, input)}
        ${block.content.title ? `<p class="template-eyebrow">${this.escapeHtml(block.content.title)}</p>` : ''}
        <p class="template-muted" style="${this.getBodyStyle(block, input, 15)}">${this.escapeHtml(message || '')}</p>
        ${
          block.content.show_signature_name && input.proposal.intro.signature_name
            ? `<p class="template-heading" style="${this.composeStyle(this.getHeadingStyle(block, input, 22), 'margin-top:18px')}">${this.escapeHtml(input.proposal.intro.signature_name)}</p>`
            : ''
        }
        ${
          block.content.show_signature_title && input.proposal.intro.signature_title
            ? `<p class="template-muted" style="${this.getBodyStyle(block, input, 14)}">${this.escapeHtml(input.proposal.intro.signature_title)}</p>`
            : ''
        }
      </section>
    `.trim();
  }

  private renderIncludedServices(block: TemplateBlock, input: RenderTemplateInput): string {
    if (!input.proposal.inclusions.length) {
      return '';
    }

    const variant = block.layout_variant === 'cards' ? 'cards' : 'bulleted';

    return `
      <section ${this.buildBlockAttributes(block, input, 'template-block')}>
        ${this.buildBlockOverlay(block, input)}
        <p class="template-eyebrow">Included Services</p>
        <h2 class="template-heading" style="${this.getHeadingStyle(block, input, 30)}">What's Included</h2>
        <div class="template-services--${variant}">
          ${input.proposal.inclusions
            .map((item) =>
              variant === 'cards'
                ? `<div class="template-service-card"><p class="template-muted" style="${this.getBodyStyle(block, input, 14)}">${this.escapeHtml(item.label)}</p></div>`
                : `<p class="template-muted" style="${this.getBodyStyle(block, input, 14)}">${this.escapeHtml(item.label)}</p>`
            )
            .join('')}
        </div>
      </section>
    `.trim();
  }

  private buildBlockAttributes(
    block: TemplateBlock,
    input: RenderTemplateInput,
    className: string
  ): string {
    const styles = block.styles ?? {};
    const inlineStyles: string[] = [];

    if (styles.background_color) inlineStyles.push(`background:${styles.background_color}`);
    if (styles.text_color) inlineStyles.push(`color:${styles.text_color}`);
    if (typeof styles.padding === 'number') inlineStyles.push(`padding:${styles.padding}px`);
    if (typeof styles.margin_top === 'number') inlineStyles.push(`margin-top:${styles.margin_top}px`);
    if (typeof styles.margin_bottom === 'number') inlineStyles.push(`margin-bottom:${styles.margin_bottom}px`);
    if (typeof styles.border_radius === 'number') inlineStyles.push(`border-radius:${styles.border_radius}px`);

    const backgroundAsset = styles.background_asset_id
      ? input.template.assets.find((asset) => asset.id === styles.background_asset_id)
      : null;
    if (backgroundAsset?.url) {
      inlineStyles.push(`background-image:url('${this.escapeAttribute(backgroundAsset.url)}')`);
      inlineStyles.push('background-size:cover');
      inlineStyles.push('background-position:center');
    }

    const styleAttribute = inlineStyles.length ? ` style="${inlineStyles.join(';')}"` : '';
    return `class="${className}"${styleAttribute}`;
  }

  private buildBlockOverlay(block: TemplateBlock, input: RenderTemplateInput): string {
    const backgroundAsset = block.styles?.background_asset_id
      ? input.template.assets.find((asset) => asset.id === block.styles?.background_asset_id)
      : null;
    if (!backgroundAsset?.url) {
      return '';
    }

    const overlayOpacity = Math.max(
      0,
      Math.min(100, Number(block.styles?.background_overlay_opacity ?? 0))
    );
    const overlayColor = this.hexToRgb(input.template.tokens.colors.canvas, overlayOpacity / 100);
    return `<div class="template-block__overlay" style="background:${overlayColor};"></div>`;
  }

  private matchesEventType(block: TemplateBlock, eventType: string | null | undefined): boolean {
    const allowedEventTypes =
      block.visibility?.event_types?.filter((value) => value.trim().length > 0) ?? [];
    if (!allowedEventTypes.length || !eventType) {
      return true;
    }

    const normalizedEventType = eventType.trim().toLowerCase();
    return allowedEventTypes.some((value) => value.trim().toLowerCase() === normalizedEventType);
  }

  private matchesRequiredDataPaths(block: TemplateBlock, proposal: RenderTemplateInput['proposal']): boolean {
    const requiredPaths =
      block.visibility?.requires_data_paths?.filter((value) => value.trim().length > 0) ?? [];
    if (!requiredPaths.length) {
      return true;
    }

    return requiredPaths.every((path) => this.helpers.hasValue(this.readPath(proposal, path)));
  }

  private readPath(target: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((value, segment) => {
      if (value == null || typeof value !== 'object') return undefined;
      return (value as Record<string, unknown>)[segment];
    }, target);
  }

  private getImageHeight(block: ProposalItemsBlock): number {
    switch (block.styles?.image_aspect_ratio) {
      case 'square':
        return 240;
      case 'landscape':
        return 180;
      default:
        return 280;
    }
  }

  private getGalleryHeight(block: MoodGalleryBlock): number {
    switch (block.layout_variant) {
      case 'editorial-strip':
        return 180;
      case 'hero-grid':
        return 220;
      default:
        return 220;
    }
  }

  private getHeroHeight(
    block: TemplateBlock,
    fallbackHeight: number
  ): number {
    return typeof block.styles?.hero_height === 'number' ? block.styles.hero_height : fallbackHeight;
  }

  private getImageStyle(block: TemplateBlock, height: number): string {
    const objectPosition = block.styles?.image_position ?? 'center';
    const cropPreset = block.styles?.image_crop_preset ?? 'balanced';
    const transformScale =
      cropPreset === 'detail'
        ? 1.18
        : cropPreset === 'portrait-focus'
          ? 1.12
          : cropPreset === 'cinematic'
            ? 1.08
            : 1;
    const fitMode = cropPreset === 'cinematic' ? 'cover' : 'cover';

    return this.composeStyle(
      'display:block',
      'width:100%',
      `height:${height}px`,
      `object-fit:${fitMode}`,
      `object-position:${objectPosition}`,
      transformScale !== 1 ? `transform:scale(${transformScale})` : '',
      transformScale !== 1 ? 'transform-origin:center center' : ''
    );
  }

  private getHeadingStyle(
    block: TemplateBlock,
    input: RenderTemplateInput,
    fallbackSize: number
  ): string {
    const themeSize =
      fallbackSize >= 48
        ? input.template.tokens.typography.sizes.h1
        : fallbackSize <= 24
          ? input.template.tokens.typography.sizes.h3
          : input.template.tokens.typography.sizes.h2;

    return this.composeStyle(
      block.styles?.heading_font_family ? `font-family:${block.styles.heading_font_family}` : '',
      typeof block.styles?.heading_size === 'number'
        ? `font-size:${block.styles.heading_size}px`
        : `font-size:${themeSize || fallbackSize}px`,
      typeof block.styles?.font_weight === 'number'
        ? `font-weight:${block.styles.font_weight}`
        : `font-weight:${input.template.tokens.typography.weights.heading}`
    );
  }

  private getBodyStyle(
    block: TemplateBlock,
    input: RenderTemplateInput,
    fallbackSize: number
  ): string {
    const themeSize =
      fallbackSize <= 13
        ? input.template.tokens.typography.sizes.caption
        : fallbackSize <= 14
          ? input.template.tokens.typography.sizes.small
          : input.template.tokens.typography.sizes.body;

    return this.composeStyle(
      block.styles?.body_font_family ? `font-family:${block.styles.body_font_family}` : '',
      typeof block.styles?.body_size === 'number'
        ? `font-size:${block.styles.body_size}px`
        : `font-size:${themeSize || fallbackSize}px`,
      `font-weight:${input.template.tokens.typography.weights.body}`
    );
  }

  private composeStyle(...parts: string[]): string {
    return parts.filter((part) => part && part.trim().length > 0).join(';');
  }

  private hexToRgb(color: string, opacity: number): string {
    const sanitized = color.replace('#', '').trim();
    if (!/^[0-9a-fA-F]{3,6}$/.test(sanitized)) {
      return `rgba(247,244,241,${opacity})`;
    }

    const full =
      sanitized.length === 3
        ? sanitized
            .split('')
            .map((value) => `${value}${value}`)
            .join('')
        : sanitized;

    const red = Number.parseInt(full.slice(0, 2), 16);
    const green = Number.parseInt(full.slice(2, 4), 16);
    const blue = Number.parseInt(full.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private escapeAttribute(value: string): string {
    return value.replace(/'/g, '%27').replace(/"/g, '%22');
  }
}
