import { Injectable } from '@angular/core';
import type { ProjectData } from '@grapesjs/studio-sdk';
import type { Editor } from 'grapesjs';

import {
  DocumentTemplate,
  GrapesJsStoredTemplateConfig,
} from '../models/floral-proposal';
import { resolveTemplateRendererKey } from './proposal-renderer-registry';
import {
  getProposalTemplateStudioPreset,
  ProposalTemplateStudioPreset,
} from './proposal-template-presets';

export interface ProposalTemplateStudioSlotDefinition {
  id: string;
  label: string;
  description: string;
}

export interface ProposalTemplateStudioStarterDefinition {
  id: string;
  name: string;
  templateKey: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  headingFontFamily: string;
  bodyFontFamily: string;
}

@Injectable({ providedIn: 'root' })
export class GrapeJsTemplateStudioService {
  readonly slots: ProposalTemplateStudioSlotDefinition[] = [
    { id: 'proposal-header', label: 'Proposal Header', description: 'Proposal opening and client summary.' },
    { id: 'proposal-intro', label: 'Proposal Intro', description: 'Short floral story or welcome note.' },
    { id: 'proposal-line-items', label: 'Proposal Line Items', description: 'Dynamic floral items from the builder.' },
    { id: 'proposal-totals', label: 'Proposal Totals', description: 'Pricing, tax, total, and deposit details.' },
    { id: 'proposal-footer', label: 'Proposal Footer', description: 'Closing footer and proposal meta.' },
    { id: 'proposal-terms', label: 'Terms & Contract', description: 'Service-specific contract sections and payment terms.' },
    { id: 'proposal-privacy', label: 'Privacy Section', description: 'Proposal privacy language and client information handling.' },
    { id: 'proposal-signature', label: 'Signature Section', description: 'Acceptance and signature blocks for florist and client.' },
  ];

  readonly starterTemplates: ProposalTemplateStudioStarterDefinition[] = [
    { id: 'romantic-editorial', name: 'Romantic Editorial', templateKey: 'romantic-editorial', description: 'Soft editorial paper with sage contract banners.', primaryColor: '#2c241f', accentColor: '#7c9453', headingFontFamily: 'Cormorant Garamond', bodyFontFamily: 'Source Sans 3' },
    { id: 'garden-manor', name: 'Garden Manor', templateKey: 'garden-manor', description: 'Estate-inspired proposal with airy botanical framing.', primaryColor: '#30251d', accentColor: '#8b9d6d', headingFontFamily: 'Cormorant Garamond', bodyFontFamily: 'Source Sans 3' },
    { id: 'modern-botanical', name: 'Modern Botanical', templateKey: 'modern-botanical', description: 'Clean contemporary proposal with structured rhythm.', primaryColor: '#1d1d1b', accentColor: '#6f8b63', headingFontFamily: 'Cormorant Garamond', bodyFontFamily: 'Source Sans 3' },
    { id: 'heirloom-parlor', name: 'Heirloom Parlor', templateKey: 'heirloom-parlor', description: 'Formal parchment look with old-world framing.', primaryColor: '#33261f', accentColor: '#a1806b', headingFontFamily: 'Cormorant Garamond', bodyFontFamily: 'Source Sans 3' },
    { id: 'atelier-noir', name: 'Atelier Noir', templateKey: 'atelier-noir', description: 'Moody luxury with dark proposal styling and refined contrast.', primaryColor: '#141312', accentColor: '#93a07d', headingFontFamily: 'Cormorant Garamond', bodyFontFamily: 'Source Sans 3' },
  ];

  getStoredConfig(template: DocumentTemplate | null | undefined): GrapesJsStoredTemplateConfig | null {
    return (template?.template_config as { grapejs_sdk?: GrapesJsStoredTemplateConfig } | null)?.grapejs_sdk ?? null;
  }

  buildTemplateConfig(template: DocumentTemplate, config: GrapesJsStoredTemplateConfig): Record<string, unknown> {
    const existingTemplateConfig = { ...(template.template_config ?? {}) };
    delete existingTemplateConfig['grapejs'];
    return { ...existingTemplateConfig, grapejs_sdk: config };
  }

  buildDefaultProject(template: DocumentTemplate): ProjectData {
    const studioPreset = this.resolveStudioPreset(template);
    const starter = this.resolveStarterTemplate(template, studioPreset);
    return this.buildProject(template, starter, studioPreset);
  }

  buildDraftConfig(projectData: ProjectData, previous: GrapesJsStoredTemplateConfig | null): GrapesJsStoredTemplateConfig {
    const { settings: _settings, ...previousWithoutSettings } = (previous ?? {}) as
      GrapesJsStoredTemplateConfig & {
        settings?: unknown;
      };

    return {
      ...previousWithoutSettings,
      schema_version: '1.0',
      project_data: projectData as Record<string, unknown>,
      published_html: previous?.published_html ?? null,
      published_css: previous?.published_css ?? null,
      published_at: previous?.published_at ?? null,
    };
  }

  buildPublishedConfig(editor: Editor, previous: GrapesJsStoredTemplateConfig | null): GrapesJsStoredTemplateConfig {
    return {
      ...this.buildDraftConfig(editor.getProjectData(), previous),
      published_html: editor.getHtml(),
      published_css: editor.getCss(),
      published_at: new Date().toISOString(),
    };
  }

  registerEditor(editor: Editor): void {
    this.registerSlotComponent(editor);
    this.registerFieldComponent(editor);

    this.slots.forEach((slot) => {
      editor.BlockManager.add(`bb-slot-${slot.id}`, {
        label: slot.label,
        category: 'Proposal Runtime Slots',
        media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M7 9h10M7 13h6"></path></svg>',
        content: { type: 'bb-proposal-slot', attributes: { 'data-bb-slot': slot.id, 'data-gjs-name': slot.label }, components: slot.label },
      });
    });

    editor.BlockManager.add('bb-contract-header', { label: 'Contract Header', category: 'Contract', media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h16M4 12h10M4 17h16"></path></svg>', content: this.buildContractHeader() });
    editor.BlockManager.add('bb-contract-section', { label: 'Contract Section', category: 'Contract', media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 4h9l3 3v13H6z"></path><path d="M9 11h6M9 15h6"></path></svg>', content: this.section('Contract Section Title', ['Write your service-specific legal language here.']) });
    editor.BlockManager.add('bb-contract-event-details', { label: 'Event Details Table', category: 'Contract', media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="5" width="16" height="14" rx="2"></rect><path d="M4 10h16M10 5v14"></path></svg>', content: this.eventDetailsTable() });
    editor.BlockManager.add('bb-contract-payment-terms', { label: 'Payment Terms', category: 'Contract', media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="5" width="16" height="14" rx="2"></rect><path d="M4 10h16M4 14h16"></path></svg>', content: this.paymentTermsTable() });
    editor.BlockManager.add('bb-contract-signature', { label: 'Signature Section', category: 'Contract', media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 17c2-3 4-5 6-5 2 0 3 2 5 2 1 0 2-.5 3-2"></path><path d="M4 20h16"></path></svg>', content: this.signatureSection() });
  }

  private buildProject(
    template: DocumentTemplate,
    starter: ProposalTemplateStudioStarterDefinition,
    studioPreset: ProposalTemplateStudioPreset | null
  ): ProjectData {
    return {
      pages: [{
        id: 'proposal-template',
        name: 'Proposal Template',
        component: this.buildProjectMarkup(template, starter, studioPreset),
      }],
      styles: this.buildProjectCss(starter),
    };
  }

  private resolveStudioPreset(template: DocumentTemplate): ProposalTemplateStudioPreset | null {
    return getProposalTemplateStudioPreset(resolveTemplateRendererKey(template));
  }

  private resolveStarterTemplate(
    template: DocumentTemplate,
    studioPreset: ProposalTemplateStudioPreset | null
  ): ProposalTemplateStudioStarterDefinition {
    if (studioPreset?.starterTemplateId) {
      const matchedStarter = this.starterTemplates.find(
        (starter) => starter.id === studioPreset.starterTemplateId
      );

      if (matchedStarter) {
        return matchedStarter;
      }
    }

    return this.starterTemplates.find((starter) => starter.templateKey === template.template_key) ??
      this.starterTemplates.find((starter) => template.template_key.includes(starter.templateKey)) ??
      this.starterTemplates[0];
  }

  private buildProjectMarkup(
    template: DocumentTemplate,
    starter: ProposalTemplateStudioStarterDefinition,
    studioPreset: ProposalTemplateStudioPreset | null
  ): string {
    return `
      <div class="bb-doc bb-${starter.id}">
        ${this.frontPage(template, starter, studioPreset)}
        ${this.agreementPage(studioPreset)}
      </div>
    `;
  }

  private frontPage(
    template: DocumentTemplate,
    starter: ProposalTemplateStudioStarterDefinition,
    studioPreset: ProposalTemplateStudioPreset | null
  ): string {
    if (studioPreset?.layoutVariant === 'agreement-focused') {
      return this.agreementFocusedFrontPage(template, starter, studioPreset);
    }

    return this.standardFrontPage(template, starter, studioPreset);
  }

  private standardFrontPage(
    template: DocumentTemplate,
    starter: ProposalTemplateStudioStarterDefinition,
    studioPreset: ProposalTemplateStudioPreset | null
  ): string {
    const galleryCaptions = this.getGalleryCaptions(studioPreset);

    return `
      <section class="bb-front${studioPreset?.layoutVariant === 'highlights' ? ' bb-front-highlights' : ''}">
        <div class="bb-top">
          <div class="bb-brand">Black Begonia<br />Floral Design</div>
          <div class="bb-date"><span data-bb-field="event_date">October 24, 2026</span></div>
          <div class="bb-created">Created: <span data-bb-field="proposal_created_date">3/30/2026</span></div>
        </div>
        ${this.renderBanner(studioPreset)}
        ${this.renderSummaryStrip()}
        ${this.renderHighlights(studioPreset)}
        <div class="bb-grid">
          <div class="bb-main">
            ${this.frontPageNoteCard(template, starter, studioPreset)}
            <div class="bb-card">${this.runtimeSlotMarkup('proposal-header', 'Proposal Header')}</div>
            <div class="bb-card">${this.runtimeSlotMarkup('proposal-intro', 'Proposal Intro')}</div>
            <div class="bb-card">${this.runtimeSlotMarkup('proposal-line-items', 'Proposal Line Items')}</div>
            <div class="bb-card">${this.runtimeSlotMarkup('proposal-totals', 'Proposal Totals')}</div>
          </div>
          <aside class="bb-side">
            ${this.galleryCard(galleryCaptions[0], true)}
            <div class="bb-gallery-grid">
              ${this.galleryCard(galleryCaptions[1])}
              ${this.galleryCard(galleryCaptions[2])}
              ${this.galleryCard(galleryCaptions[3])}
              ${this.galleryCard(galleryCaptions[4])}
            </div>
          </aside>
        </div>
        <div class="bb-card bb-footer-card">${this.runtimeSlotMarkup('proposal-footer', 'Proposal Footer')}</div>
      </section>
    `;
  }

  private agreementFocusedFrontPage(
    template: DocumentTemplate,
    starter: ProposalTemplateStudioStarterDefinition,
    studioPreset: ProposalTemplateStudioPreset
  ): string {
    return `
      <section class="bb-front bb-front-agreement">
        <div class="bb-top">
          <div class="bb-brand">Black Begonia<br />Floral Design</div>
          <div class="bb-date"><span data-bb-field="event_date">October 24, 2026</span></div>
          <div class="bb-created">Created: <span data-bb-field="proposal_created_date">3/30/2026</span></div>
        </div>
        ${this.renderBanner(studioPreset)}
        ${this.renderSummaryStrip()}
        ${this.renderHighlights(studioPreset)}
        <div class="bb-main bb-main-stack">
          ${this.frontPageNoteCard(template, starter, studioPreset)}
          <div class="bb-card">${this.runtimeSlotMarkup('proposal-header', 'Proposal Header')}</div>
          <div class="bb-card">${this.runtimeSlotMarkup('proposal-intro', 'Proposal Intro')}</div>
          <div class="bb-card">${this.runtimeSlotMarkup('proposal-line-items', 'Proposal Line Items')}</div>
          <div class="bb-card">${this.runtimeSlotMarkup('proposal-totals', 'Proposal Totals')}</div>
          <div class="bb-card bb-footer-card">${this.runtimeSlotMarkup('proposal-footer', 'Proposal Footer')}</div>
        </div>
      </section>
    `;
  }

  private renderBanner(studioPreset: ProposalTemplateStudioPreset | null): string {
    const bannerContent =
      studioPreset?.bannerMode === 'document-title'
        ? `<div class="bb-script"><span data-bb-field="document_title">Floral Proposal</span></div>`
        : `<div class="bb-script"><span data-bb-field="customer_name">Customer Name</span>'s <span data-bb-field="service_type">Event Floral Services</span></div>`;

    return `
      <div class="bb-banner">
        ${bannerContent}
        ${
          studioPreset?.bannerSubtitle
            ? `<p class="bb-banner-subtitle">${this.escapeHtml(studioPreset.bannerSubtitle)}</p>`
            : ''
        }
      </div>
    `;
  }

  private renderSummaryStrip(): string {
    return `
      <div class="bb-summary">
        <div><div class="bb-kicker">Document</div><div class="bb-value"><span data-bb-field="document_title">Floral Proposal</span></div></div>
        <div><div class="bb-kicker"><span data-bb-field="service_type_label">Service Type</span></div><div class="bb-value"><span data-bb-field="service_type">Event Floral Services</span></div></div>
        <div><div class="bb-kicker"><span data-bb-field="service_date_label">Event Date</span></div><div class="bb-value"><span data-bb-field="event_date">October 24, 2026</span></div></div>
        <div><div class="bb-kicker"><span data-bb-field="delivery_location_label">Delivery & Setup Location</span></div><div class="bb-value"><span data-bb-field="delivery_setup_location">Event location</span></div></div>
      </div>
    `;
  }

  private frontPageNoteCard(
    template: DocumentTemplate,
    starter: ProposalTemplateStudioStarterDefinition,
    studioPreset: ProposalTemplateStudioPreset | null
  ): string {
    const note =
      studioPreset?.frontPageNote ??
      `${starter.name} starter for ${template.name}. Keep the structure flexible here, then let the renderer strategy inject service-specific pricing, contract language, and signatures at runtime.`;

    return `<div class="bb-note">${this.escapeHtml(note)}</div>`;
  }

  private renderHighlights(studioPreset: ProposalTemplateStudioPreset | null): string {
    const highlights = studioPreset?.highlights ?? [];

    if (!highlights.length) {
      return '';
    }

    return `
      <div class="bb-highlights">
        ${highlights
          .map(
            (highlight) => `
              <div class="bb-highlight-card">
                <div class="bb-highlight-title">${this.escapeHtml(highlight.title)}</div>
                <p class="bb-highlight-copy">${this.escapeHtml(highlight.copy)}</p>
              </div>
            `
          )
          .join('')}
      </div>
    `;
  }

  private getGalleryCaptions(studioPreset: ProposalTemplateStudioPreset | null): string[] {
    const defaultCaptions = [
      'Replace with a featured installation or event vignette',
      'Tablescape or centerpiece reference',
      'Personal flowers or accent details',
      'Statement arrangement or floral moment',
      'Event styling vignette',
    ];
    const presetCaptions = studioPreset?.galleryCaptions ?? [];

    return defaultCaptions.map((caption, index) => presetCaptions[index] ?? caption);
  }

  private galleryCard(caption: string, hero = false): string {
    return `<div class="bb-gallery-card${hero ? ' bb-gallery-card-hero' : ''}"><div class="bb-gallery-image"></div><div class="bb-gallery-caption">${this.escapeHtml(caption)}</div></div>`;
  }

  private agreementPage(studioPreset: ProposalTemplateStudioPreset | null): string {
    return `
      <section class="bb-contract">
        ${this.buildContractHeader()}
        <div class="bb-copy">
          <p>${this.escapeHtml(
            studioPreset?.agreementIntro ??
              'This agreement space is designed to stay service-neutral inside Studio. Use the runtime slots below so each renderer strategy can inject the right contract language, privacy copy, and acceptance blocks for weddings, elopements, showers, engagements, or general event work.'
          )}</p>
        </div>
        <div class="bb-card">
          ${this.runtimeSlotMarkup('proposal-terms', 'Terms & Contract')}
        </div>
        <div class="bb-card">
          ${this.runtimeSlotMarkup('proposal-privacy', 'Privacy Section')}
        </div>
        <div class="bb-card">
          ${this.runtimeSlotMarkup('proposal-signature', 'Signature Section')}
        </div>
      </section>
    `;
  }

  private buildContractHeader(): string {
    return `
      <div class="bb-contract-head">
        <div class="bb-top">
          <div class="bb-brand">Black Begonia<br />Floral Design</div>
          <div class="bb-date"><span data-bb-field="event_date">October 24, 2026</span></div>
          <div class="bb-created">Created: <span data-bb-field="proposal_created_date">3/30/2026</span></div>
        </div>
        <div class="bb-banner"><h1><span data-bb-field="agreement_title">Event Floral Services Agreement</span></h1></div>
        <p class="bb-ref"><span data-bb-field="customer_name">Customer Name</span> | <span data-bb-field="event_location_city_state">South Kingstown, Rhode Island</span> | <span data-bb-field="service_type">Event Floral Services</span></p>
        <div class="bb-divider"></div>
      </div>
    `;
  }

  private eventDetailsTable(): string {
    return `
      <section class="bb-section">
        <div class="bb-section-title"><h2><span data-bb-field="details_section_title">1. Event Details</span></h2></div>
        <table class="bb-table">
          <thead><tr><th><span data-bb-field="service_type_label">Service Type</span></th><th><span data-bb-field="service_date_label">Event Date</span></th><th><span data-bb-field="delivery_location_label">Delivery & Setup Location</span></th></tr></thead>
          <tbody><tr><td><span class="bb-field" data-bb-field="service_type">Event Floral Services</span></td><td><span class="bb-field" data-bb-field="event_date">October 24, 2026</span></td><td><span class="bb-field" data-bb-field="delivery_setup_location">Event location</span></td></tr></tbody>
        </table>
      </section>
    `;
  }

  private paymentTermsTable(): string {
    return `
      <section class="bb-section">
        <div class="bb-section-title"><h2><span data-bb-field="payment_terms_title">4. Payment Terms</span></h2></div>
        <div class="bb-copy">
          <p><span data-bb-field="retainer_copy">A signed agreement and retainer are required before floral production, sourcing, and event scheduling are confirmed.</span></p>
          <p>The remaining balance is due by <span class="bb-field" data-bb-field="final_balance_due_date">September 24, 2026</span>, unless your service agreement states otherwise.</p>
        </div>
        <table class="bb-table">
          <thead><tr><th><span data-bb-field="retainer_label">Deposit Due</span></th><th><span data-bb-field="final_balance_label">Final Balance Due</span></th><th>Payment Methods</th></tr></thead>
          <tbody><tr><td><span data-bb-field="retainer_label">Retainer</span><br />per contract terms</td><td><span class="bb-field" data-bb-field="final_balance_due_date">September 24, 2026</span><br />standard due date</td><td>Credit/Debit Card (3% processing fee)<br />Other approved methods</td></tr></tbody>
        </table>
        <p class="bb-note"><span data-bb-field="late_payment_copy">Important: No services, materials, or scheduling are guaranteed until the retainer is received. Late payments may affect sourcing, scheduling, or event execution.</span></p>
      </section>
    `;
  }

  private signatureSection(): string {
    return `
      <section class="bb-section bb-signatures">
        <p class="bb-note bb-note-italic">Signature areas are intentionally oversized for DocuSign signature, name, and date fields.</p>
        <div class="bb-sign-card"><div class="bb-sign-head">Florist</div><div class="bb-sign-body"><p class="bb-sign-party">Black Begonia Floral Design, LLC</p>${this.signFields()}</div></div>
        <div class="bb-sign-card"><div class="bb-sign-head">Client</div><div class="bb-sign-body"><p class="bb-sign-party"><span class="bb-field" data-bb-field="customer_name">Customer Name</span></p>${this.signFields()}</div></div>
      </section>
    `;
  }

  private signFields(): string {
    return `
      <div class="bb-sign-grid">
        <div class="bb-sign-line"><span>Signature</span><div class="bb-sign-fill bb-sign-fill-lg"></div></div>
        <div class="bb-sign-meta">
          <div class="bb-sign-line"><span>Name</span><div class="bb-sign-fill"></div></div>
          <div class="bb-sign-line"><span>Date</span><div class="bb-sign-fill"></div></div>
        </div>
      </div>
    `;
  }

  private section(title: string, paragraphs: string[]): string {
    return `<section class="bb-section"><div class="bb-section-title"><h2>${title}</h2></div><div class="bb-copy">${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('')}</div></section>`;
  }

  private runtimeSlotMarkup(slotId: string, label: string): string {
    return `<section data-bb-slot="${slotId}" class="bb-slot" data-gjs-name="${label}">${label} Slot</section>`;
  }

  private buildProjectCss(starter: ProposalTemplateStudioStarterDefinition): string {
    const dark = starter.id === 'atelier-noir';
    const soft = starter.id === 'heirloom-parlor';
    return `
      :root{--bb-primary:${starter.primaryColor};--bb-accent:${starter.accentColor};--bb-head:${starter.headingFontFamily},Georgia,serif;--bb-body:${starter.bodyFontFamily},Arial,sans-serif;--bb-paper:${dark ? '#181614' : '#fffdfa'};--bb-surface:${dark ? '#1e1b19' : soft ? '#f9f2ea' : '#faf5ef'};--bb-ink:${dark ? '#f2e9df' : starter.primaryColor};--bb-muted:${dark ? '#d6cdc3' : '#6f635a'};--bb-border:${dark ? 'rgba(235,227,219,.14)' : '#e8ddd2'};--bb-banner:${dark ? '#24211d' : '#dfe5d5'};--bb-banner-text:${dark ? '#dbe2cc' : '#6b8350'};--bb-image:${dark ? 'linear-gradient(135deg,rgba(147,160,125,.28),rgba(67,61,56,.72))' : soft ? 'linear-gradient(135deg,rgba(161,128,107,.18),rgba(223,229,213,.48))' : 'linear-gradient(135deg,rgba(124,148,83,.18),rgba(234,147,140,.22))'};}
      *{box-sizing:border-box}html,body{margin:0;padding:0;min-height:100%}body{background:var(--bb-surface);color:var(--bb-ink);font-family:var(--bb-body)}
      .bb-doc{width:100%;max-width:none;margin:0;display:grid;gap:0}.bb-front,.bb-contract{width:100%;background:var(--bb-surface);border:0;border-radius:0;overflow:hidden;box-shadow:none}
      .bb-front{padding:28px 36px}.bb-top{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:center;justify-items:center}.bb-brand{font-size:14px;font-weight:700;letter-spacing:.02em;line-height:1.2;text-transform:uppercase;text-align:center}.bb-date{color:var(--bb-accent);font-family:var(--bb-head);font-size:26px;line-height:1;text-align:center}.bb-created{font-size:13px;font-weight:700;text-align:center;white-space:nowrap}
      .bb-banner{margin:18px -28px;padding:16px 28px;background:var(--bb-banner);color:var(--bb-banner-text);text-align:center}.bb-banner h1{margin:0;color:var(--bb-banner-text);font-family:var(--bb-head);font-size:36px;font-weight:500;line-height:1.08}.bb-script{font-family:var(--bb-head);font-size:${starter.id === 'modern-botanical' ? '30px' : '34px'};line-height:1.08}.bb-banner-subtitle{max-width:42rem;margin:10px auto 0;color:var(--bb-banner-text);font-size:12px;line-height:1.6;letter-spacing:.04em;text-transform:none;opacity:.92}
      .bb-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:18px 0 22px;border-bottom:1px solid var(--bb-border);text-align:center;align-items:start}.bb-kicker{margin-bottom:6px;color:var(--bb-muted);font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.bb-value{font-size:14px;line-height:1.45}
      .bb-highlights{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-top:18px}.bb-highlight-card{border:1px solid var(--bb-border);border-radius:${soft ? '12px' : '18px'};background:${dark ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.88)'};padding:14px 16px}.bb-highlight-title{margin-bottom:8px;color:var(--bb-primary);font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.bb-highlight-copy{margin:0;color:var(--bb-muted);font-size:13px;line-height:1.65}
      .bb-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(320px,.8fr);gap:22px;margin-top:20px}.bb-main,.bb-side{display:grid;gap:16px;align-content:start}.bb-main-stack{margin-top:20px}.bb-gallery-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.bb-front-agreement .bb-footer-card{margin-top:0}
      .bb-card,.bb-gallery-card,.bb-note{border:1px solid var(--bb-border);border-radius:${soft ? '14px' : '22px'};background:${dark ? 'rgba(255,255,255,.025)' : 'rgba(255,255,255,.82)'};overflow:hidden}.bb-card{padding:14px}.bb-note{padding:14px 18px;color:var(--bb-muted);font-size:13px;line-height:1.65}.bb-gallery-card{padding:12px}.bb-gallery-card-hero{padding:14px}.bb-gallery-image{min-height:180px;border-radius:${soft ? '12px' : '18px'};background:var(--bb-image);border:1px solid ${dark ? 'rgba(255,255,255,.06)' : '#e4d5c7'}}.bb-gallery-card-hero .bb-gallery-image{min-height:260px}.bb-gallery-caption{padding:10px 6px 2px;color:var(--bb-muted);font-size:12px;line-height:1.5}
      .bb-slot{min-height:88px;padding:18px 20px;border:1px dashed ${dark ? 'rgba(219,208,195,.38)' : '#d9b8a4'};border-radius:${soft ? '12px' : '18px'};background:${dark ? 'rgba(255,255,255,.02)' : 'rgba(255,248,242,.92)'};color:var(--bb-muted);font-size:14px;line-height:1.6}.bb-footer-card{margin-top:18px}
      .bb-contract{padding:28px 36px 34px;page-break-before:always}.bb-ref{margin:0 0 14px;color:var(--bb-muted);font-size:13px;line-height:1.6;text-align:center}.bb-divider{height:2px;margin:0 0 18px;background:${dark ? 'rgba(235,227,219,.14)' : '#ead7cf'}}.bb-contract .bb-copy p,.bb-contract .bb-copy li{margin:0 0 10px;color:var(--bb-ink);font-size:14px !important;line-height:1.75;font-weight:400}.bb-contract .bb-copy ul{margin:10px 0 0 1.1rem;padding:0}.bb-contract .bb-copy li{margin-bottom:6px}.bb-contract .bb-card,.bb-contract .bb-section{margin-top:18px}.bb-contract .bb-section-title{margin-bottom:10px}.bb-contract .bb-section-title h2{margin:0;color:var(--bb-primary);font-family:var(--bb-head);font-size:23px !important;line-height:1.15;font-weight:600}
      .bb-table{width:100%;border-collapse:collapse;table-layout:fixed}.bb-table th,.bb-table td{width:33.333%;padding:12px 14px;border:1px solid var(--bb-border);font-size:13px;text-align:left;vertical-align:top}.bb-table thead th{background:${dark ? '#25221f' : '#dfe5d5'};color:var(--bb-banner-text);font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.bb-field{display:inline-block;min-width:0;padding-bottom:2px;border-bottom:1px dashed ${dark ? 'rgba(219,208,195,.45)' : 'rgba(124,148,83,.45)'};color:var(--bb-ink);font-weight:600}
      .bb-note{margin:0}.bb-note-italic{font-style:italic}.bb-signatures{display:grid;gap:18px}.bb-sign-card{border:1px solid var(--bb-border);background:${dark ? 'rgba(255,255,255,.03)' : '#fffdfa'}}.bb-sign-head{padding:8px 12px;background:${dark ? '#25221f' : '#dfe5d5'};color:var(--bb-banner-text);font-size:15px;font-weight:700}.bb-sign-body{padding:0 0 12px}.bb-sign-party{margin:0;padding:8px 12px;border-bottom:1px solid var(--bb-border);font-size:15px;font-weight:500}.bb-sign-grid{display:grid;gap:14px}.bb-sign-line{display:grid;gap:0;padding:0 12px}.bb-sign-line span{color:var(--bb-muted);font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.bb-sign-fill{min-height:56px;border:1px solid var(--bb-border);border-top:0}.bb-sign-fill-lg{min-height:118px}.bb-sign-meta{display:grid;grid-template-columns:minmax(0,1fr) 140px}
      @media (max-width:720px){.bb-front,.bb-contract{padding:18px}.bb-banner{margin-left:-18px;margin-right:-18px;padding-left:18px;padding-right:18px}.bb-top,.bb-summary,.bb-grid,.bb-gallery-grid,.bb-sign-meta,.bb-highlights{grid-template-columns:1fr}.bb-created,.bb-date,.bb-brand{text-align:left;justify-self:start}.bb-table th,.bb-table td{display:block;width:100%}}
    `;
  }

  private registerSlotComponent(editor: Editor): void {
    if (editor.DomComponents.getType('bb-proposal-slot')) return;
    editor.DomComponents.addType('bb-proposal-slot', {
      isComponent: (element) => element instanceof HTMLElement && element.hasAttribute('data-bb-slot') ? { type: 'bb-proposal-slot' } : false,
      model: {
        defaults: {
          copyable: true,
          draggable: true,
          droppable: false,
          editable: false,
          highlightable: true,
          layerable: true,
          selectable: true,
          stylable: ['background-color', 'border', 'border-radius', 'color', 'font-family', 'font-size', 'font-weight', 'line-height', 'margin', 'padding', 'text-align', 'width', 'min-height'],
        },
        init() {
          this['syncProposalSlotTraits']();
          this.on('change:attributes:data-bb-slot', this['syncProposalSlotTraits']);
        },
        syncProposalSlotTraits() {
          const slotId = this.getAttributes()?.['data-bb-slot'];

          if (slotId === 'proposal-line-items') {
            (this as any).set('traits', [
              {
                type: 'select',
                name: 'data-bb-line-items-style',
                label: 'Line Items Style',
                options: [
                  { id: 'compact', label: 'Compact Editorial' },
                  { id: 'alternating', label: 'Alternating Image Story' },
                ],
              },
            ]);

            if (!this.getAttributes()?.['data-bb-line-items-style']) {
              this.addAttributes({ 'data-bb-line-items-style': 'compact' });
            }

            return;
          }

          (this as any).set('traits', []);
          if (this.getAttributes()?.['data-bb-line-items-style']) {
            this.removeAttributes('data-bb-line-items-style');
          }
        },
      },
    });
  }

  private registerFieldComponent(editor: Editor): void {
    if (editor.DomComponents.getType('bb-proposal-field')) return;
    editor.DomComponents.addType('bb-proposal-field', {
      isComponent: (element) => element instanceof HTMLElement && element.hasAttribute('data-bb-field') ? { type: 'bb-proposal-field' } : false,
      model: { defaults: { copyable: true, draggable: false, droppable: false, editable: false, highlightable: true, layerable: true, selectable: true, stylable: ['color', 'font-family', 'font-size', 'font-weight', 'letter-spacing', 'text-transform', 'padding', 'margin', 'border-bottom'] } },
    });
  }

  private escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}
