import { Injectable } from '@angular/core';
import type { ProjectData } from '@grapesjs/studio-sdk';
import type { Editor } from 'grapesjs';

import {
  DocumentTemplate,
  GrapesJsStoredTemplateConfig,
} from '../models/floral-proposal';

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
  readonly storageKey = 'grapejs_sdk';

  readonly slots: ProposalTemplateStudioSlotDefinition[] = [
    { id: 'proposal-header', label: 'Proposal Header', description: 'Proposal opening and client summary.' },
    { id: 'proposal-intro', label: 'Proposal Intro', description: 'Short floral story or welcome note.' },
    { id: 'proposal-line-items', label: 'Proposal Line Items', description: 'Dynamic floral items from the builder.' },
    { id: 'proposal-totals', label: 'Proposal Totals', description: 'Pricing, tax, total, and deposit details.' },
    { id: 'proposal-footer', label: 'Proposal Footer', description: 'Closing footer and proposal meta.' },
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
    const starter = this.resolveStarterTemplate(template);
    return this.buildProject(template, starter);
  }

  buildStarterConfig(template: DocumentTemplate, starterId: string): GrapesJsStoredTemplateConfig {
    const starter = this.getStarterTemplate(starterId) ?? this.starterTemplates[0];
    const project = this.buildProject(template, starter);
    return {
      schema_version: '1.0',
      project_data: project as Record<string, unknown>,
      published_html: this.buildProjectMarkup(template, starter),
      published_css: this.buildProjectCss(starter),
      published_at: new Date().toISOString(),
      theme: {
        primary_color: starter.primaryColor,
        accent_color: starter.accentColor,
        heading_font_family: starter.headingFontFamily,
        body_font_family: starter.bodyFontFamily,
      },
      settings: {
        show_terms_section: true,
        show_privacy_section: true,
        show_signature_section: true,
      },
    };
  }

  buildDraftConfig(projectData: ProjectData, previous: GrapesJsStoredTemplateConfig | null): GrapesJsStoredTemplateConfig {
    return {
      ...previous,
      schema_version: '1.0',
      project_data: projectData as Record<string, unknown>,
      published_html: previous?.published_html ?? null,
      published_css: previous?.published_css ?? null,
      published_at: previous?.published_at ?? null,
      settings: {
        show_terms_section: previous?.settings?.show_terms_section ?? true,
        show_privacy_section: previous?.settings?.show_privacy_section ?? true,
        show_signature_section: previous?.settings?.show_signature_section ?? true,
      },
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

  getStarterTemplate(starterId: string): ProposalTemplateStudioStarterDefinition | null {
    return this.starterTemplates.find((starter) => starter.id === starterId) ?? null;
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

  private buildProject(template: DocumentTemplate, starter: ProposalTemplateStudioStarterDefinition): ProjectData {
    return {
      pages: [{ id: 'proposal-template', name: 'Proposal Template', component: this.buildProjectMarkup(template, starter) }],
      styles: this.buildProjectCss(starter),
    };
  }

  private resolveStarterTemplate(template: DocumentTemplate): ProposalTemplateStudioStarterDefinition {
    return this.starterTemplates.find((starter) => starter.templateKey === template.template_key) ??
      this.starterTemplates.find((starter) => template.template_key.includes(starter.templateKey)) ??
      this.starterTemplates[0];
  }

  private buildProjectMarkup(template: DocumentTemplate, starter: ProposalTemplateStudioStarterDefinition): string {
    return `
      <div class="bb-doc bb-${starter.id}">
        ${this.frontPage(template, starter)}
        ${this.contractPageOne()}
        ${this.contractPageTwo()}
        ${this.contractPageThree()}
      </div>
    `;
  }

  private frontPage(template: DocumentTemplate, starter: ProposalTemplateStudioStarterDefinition): string {
    return `
      <section class="bb-front">
        <div class="bb-top">
          <div class="bb-brand">Black Begonia<br />Floral Design</div>
          <div class="bb-date"><span data-bb-field="event_date">October 24, 2026</span></div>
          <div class="bb-created">Created: <span data-bb-field="proposal_created_date">3/30/2026</span></div>
        </div>
        <div class="bb-banner"><div class="bb-script"><span data-bb-field="customer_name">Customer Name</span>'s <span data-bb-field="service_type">Wedding Floral Services</span></div></div>
        <div class="bb-summary">
          <div><div class="bb-kicker">Event Type</div><div class="bb-value"><span data-bb-field="event_type">Wedding</span></div></div>
          <div><div class="bb-kicker">Service Type</div><div class="bb-value"><span data-bb-field="service_type">Wedding Floral Services</span></div></div>
          <div><div class="bb-kicker">Delivery & Setup</div><div class="bb-value"><span data-bb-field="delivery_setup_location">Venue location</span></div></div>
        </div>
        <div class="bb-grid">
          <div class="bb-main">
            <div class="bb-note">${this.escapeHtml(starter.name)} starter for ${this.escapeHtml(template.name)}. Continue refining this in Studio with your own imagery and floral copy.</div>
            <div class="bb-card"><section data-bb-slot="proposal-header" class="bb-slot" data-gjs-name="Proposal Header">Proposal Header Slot</section></div>
            <div class="bb-card"><section data-bb-slot="proposal-intro" class="bb-slot" data-gjs-name="Proposal Intro">Proposal Intro Slot</section></div>
            <div class="bb-card"><section data-bb-slot="proposal-line-items" class="bb-slot" data-gjs-name="Proposal Line Items">Proposal Line Items Slot</section></div>
            <div class="bb-card"><section data-bb-slot="proposal-totals" class="bb-slot" data-gjs-name="Proposal Totals">Proposal Totals Slot</section></div>
          </div>
          <aside class="bb-side">
            ${this.galleryCard('Replace with hero floral installation image', true)}
            <div class="bb-gallery-grid">
              ${this.galleryCard('Centerpiece reference')}
              ${this.galleryCard('Ceremony floral detail')}
              ${this.galleryCard('Bouquet or accent stem study')}
              ${this.galleryCard('Reception vignette')}
            </div>
          </aside>
        </div>
        <div class="bb-card bb-footer-card"><section data-bb-slot="proposal-footer" class="bb-slot" data-gjs-name="Proposal Footer">Proposal Footer Slot</section></div>
      </section>
    `;
  }

  private galleryCard(caption: string, hero = false): string {
    return `<div class="bb-gallery-card${hero ? ' bb-gallery-card-hero' : ''}"><div class="bb-gallery-image"></div><div class="bb-gallery-caption">${caption}</div></div>`;
  }

  private contractPageOne(): string {
    return `
      <section class="bb-contract">
        ${this.buildContractHeader()}
        <div class="bb-copy"><p>This Wedding Floral Services Agreement ("Agreement") is entered into as of <span data-bb-field="proposal_created_date">3/30/2026</span>, by and between Black Begonia Floral Design, LLC (hereinafter referred to as "Florist") and <span data-bb-field="customer_name">Customer Name</span> (hereinafter referred to as "Client").</p></div>
        ${this.eventDetailsTable()}
        ${this.section('2. Scope of Services', ['Florist agrees to provide floral design, preparation, delivery, and setup services as outlined in the associated proposal (the "Proposal"), which is incorporated into this Agreement by reference.', 'The Proposal defines the floral items, estimated quantities, and overall design vision.'])}
        ${this.bullets('3. Design & Substitution Policy', 'Client acknowledges and agrees that:', ['Floral designs are custom, artistic works and may vary slightly from inspiration photos.', 'Images and descriptions provided in the Proposal represent style, composition, and general aesthetic, not exact replication.', 'Due to seasonality, supply chain issues, or quality concerns, Florist reserves the right to substitute flowers and materials with items of equal or greater value and similar style.'], 'Florist will always make substitutions in good faith to preserve the overall design vision.')}
        ${this.paymentTermsTable()}
        ${this.section('5. Cancellation Policy', ['Client Cancellation. All deposits are non-refundable. If Client cancels within 30 days of the event date, Client is responsible for 100% of the total Proposal amount, as materials and flowers will have already been ordered and/or prepared.', 'Florist Cancellation. Florist reserves the right to cancel this Agreement at any time. In such cases, all payments, including deposits, will be fully refunded to Client. Florist shall not be liable for any additional damages beyond the refund.'])}
      </section>
    `;
  }

  private contractPageTwo(): string {
    return `
      <section class="bb-contract">
        ${this.compactContractHeader()}
        ${this.bullets('6. Delivery & Setup', 'Florist will deliver and set up floral arrangements at the specified location and agreed-upon time. Client is responsible for:', ['Ensuring access to the venue at the agreed time', 'Providing accurate delivery details', 'Coordinating with venue staff as needed'], 'Florist is not responsible for delays caused by venue restrictions, weather, or third-party vendors.')}
        ${this.bullets('7. Client Responsibilities', 'Client agrees to:', ['Provide accurate event details and updates', 'Review Proposal and confirm all selections', 'Notify Florist of any changes at least 30 days prior to event'], 'Changes requested within 30 days are not guaranteed and may incur additional costs.')}
        ${this.bullets('8. Liability & Limitation of Damages', 'Florist shall not be liable for:', ['Damage to floral arrangements after delivery and setup', 'Weather-related impacts', 'Venue conditions (heat, wind, rain, etc.)', 'Actions of guests or third parties'], 'Florist\'s maximum liability under this Agreement shall not exceed the total amount paid by Client.')}
        ${this.bullets('9. Force Majeure', 'Florist shall not be held liable for failure to perform services due to events beyond reasonable control, including but not limited to:', ['Acts of God', 'Severe weather', 'Natural disasters', 'Pandemics', 'Supply chain disruptions', 'Government restrictions', 'Labor shortages', 'Transportation failures'], 'In such cases, Florist will make reasonable efforts to fulfill services or provide alternatives. If performance is impossible, Florist will refund amounts paid, excluding costs already incurred.')}
      </section>
    `;
  }

  private contractPageThree(): string {
    return `
      <section class="bb-contract">
        ${this.compactContractHeader()}
        ${this.section('10. Non-Transferability', ['This Agreement is non-transferable and applies only to the Client and event specified.'])}
        ${this.section('11. Entire Agreement', ['This Agreement, along with the Proposal, constitutes the entire agreement between the parties and supersedes all prior discussions or understandings.'])}
        ${this.section('12. Governing Law', ['This Agreement shall be governed by and construed in accordance with the laws of the State of Rhode Island.'])}
        ${this.section('13. Acceptance & Signatures', ['By signing below, both parties acknowledge that they have read, understood, and agree to the terms of this Agreement.'])}
        ${this.signatureSection()}
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
        <div class="bb-banner"><h1>Wedding Floral Services Agreement</h1></div>
        <p class="bb-ref"><span data-bb-field="customer_name">Customer Name</span> | <span data-bb-field="event_location_city_state">South Kingstown, Rhode Island</span> | <span data-bb-field="service_type">Wedding Floral Services</span> proposal incorporated by reference</p>
        <div class="bb-divider"></div>
      </div>
    `;
  }

  private compactContractHeader(): string {
    return `
      <div class="bb-brand">Black Begonia Floral Design</div>
      <p class="bb-ref"><span data-bb-field="customer_name">Customer Name</span> | <span data-bb-field="service_type">Wedding Floral Services</span> | <span data-bb-field="event_date">October 24, 2026</span></p>
      <div class="bb-divider"></div>
    `;
  }

  private eventDetailsTable(): string {
    return `
      <section class="bb-section">
        <div class="bb-section-title"><h2>1. Event Details</h2></div>
        <table class="bb-table">
          <thead><tr><th>Event Type</th><th>Event Date</th><th>Delivery & Setup Location</th></tr></thead>
          <tbody><tr><td><span class="bb-field" data-bb-field="event_type">Wedding</span></td><td><span class="bb-field" data-bb-field="event_date">October 24, 2026</span></td><td><span class="bb-field" data-bb-field="delivery_setup_location">Venue location</span></td></tr></tbody>
        </table>
      </section>
    `;
  }

  private paymentTermsTable(): string {
    return `
      <section class="bb-section">
        <div class="bb-section-title"><h2>4. Payment Terms</h2></div>
        <div class="bb-copy">
          <p>A non-refundable deposit of 50% of the total Proposal amount is required to secure the event date.</p>
          <p>The remaining 50% balance is due by 30 days prior to the event.</p>
        </div>
        <table class="bb-table">
          <thead><tr><th>Deposit Due</th><th>Final Balance Due</th><th>Payment Methods</th></tr></thead>
          <tbody><tr><td>50%<br />non-refundable deposit</td><td><span class="bb-field" data-bb-field="final_balance_due_date">September 24, 2026</span><br />30 days prior to event</td><td>Credit/Debit Card (3% processing fee)<br />Other approved methods</td></tr></tbody>
        </table>
        <p class="bb-note">Important: No services, materials, or scheduling are guaranteed until the deposit is received. Late payments may result in cancellation or additional fees at Florist's discretion.</p>
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

  private bullets(title: string, intro: string, items: string[], outro?: string): string {
    return `<section class="bb-section"><div class="bb-section-title"><h2>${title}</h2></div><div class="bb-copy"><p>${intro}</p><ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>${outro ? `<p>${outro}</p>` : ''}</div></section>`;
  }

  private buildProjectCss(starter: ProposalTemplateStudioStarterDefinition): string {
    const dark = starter.id === 'atelier-noir';
    const soft = starter.id === 'heirloom-parlor';
    return `
      :root{--bb-primary:${starter.primaryColor};--bb-accent:${starter.accentColor};--bb-head:${starter.headingFontFamily},Georgia,serif;--bb-body:${starter.bodyFontFamily},Arial,sans-serif;--bb-paper:${dark ? '#181614' : '#fffdfa'};--bb-surface:${dark ? '#1e1b19' : soft ? '#f9f2ea' : '#faf5ef'};--bb-ink:${dark ? '#f2e9df' : starter.primaryColor};--bb-muted:${dark ? '#d6cdc3' : '#6f635a'};--bb-border:${dark ? 'rgba(235,227,219,.14)' : '#e8ddd2'};--bb-banner:${dark ? '#24211d' : '#dfe5d5'};--bb-banner-text:${dark ? '#dbe2cc' : '#6b8350'};--bb-image:${dark ? 'linear-gradient(135deg,rgba(147,160,125,.28),rgba(67,61,56,.72))' : soft ? 'linear-gradient(135deg,rgba(161,128,107,.18),rgba(223,229,213,.48))' : 'linear-gradient(135deg,rgba(124,148,83,.18),rgba(234,147,140,.22))'};}
      *{box-sizing:border-box}html,body{margin:0;padding:0;min-height:100%}body{background:var(--bb-surface);color:var(--bb-ink);font-family:var(--bb-body)}
      .bb-doc{width:100%;max-width:none;margin:0;display:grid;gap:0}.bb-front,.bb-contract{width:100%;background:var(--bb-surface);border:0;border-radius:0;overflow:hidden;box-shadow:none}
      .bb-front{padding:28px 36px}.bb-top{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:center;justify-items:center}.bb-brand{font-size:14px;font-weight:700;letter-spacing:.02em;line-height:1.2;text-transform:uppercase;text-align:center}.bb-date{color:var(--bb-accent);font-family:var(--bb-head);font-size:26px;line-height:1;text-align:center}.bb-created{font-size:13px;font-weight:700;text-align:center;white-space:nowrap}
      .bb-banner{margin:18px -28px;padding:16px 28px;background:var(--bb-banner);color:var(--bb-banner-text);text-align:center}.bb-banner h1{margin:0;color:var(--bb-banner-text);font-family:var(--bb-head);font-size:36px;font-weight:500;line-height:1.08}.bb-script{font-family:var(--bb-head);font-size:${starter.id === 'modern-botanical' ? '30px' : '34px'};line-height:1.08}
      .bb-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:18px 0 22px;border-bottom:1px solid var(--bb-border);text-align:center;align-items:start}.bb-kicker{margin-bottom:6px;color:var(--bb-muted);font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.bb-value{font-size:14px;line-height:1.45}
      .bb-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(320px,.8fr);gap:22px;margin-top:20px}.bb-main,.bb-side{display:grid;gap:16px;align-content:start}.bb-gallery-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      .bb-card,.bb-gallery-card,.bb-note{border:1px solid var(--bb-border);border-radius:${soft ? '14px' : '22px'};background:${dark ? 'rgba(255,255,255,.025)' : 'rgba(255,255,255,.82)'};overflow:hidden}.bb-card{padding:14px}.bb-note{padding:14px 18px;color:var(--bb-muted);font-size:13px;line-height:1.65}.bb-gallery-card{padding:12px}.bb-gallery-card-hero{padding:14px}.bb-gallery-image{min-height:180px;border-radius:${soft ? '12px' : '18px'};background:var(--bb-image);border:1px solid ${dark ? 'rgba(255,255,255,.06)' : '#e4d5c7'}}.bb-gallery-card-hero .bb-gallery-image{min-height:260px}.bb-gallery-caption{padding:10px 6px 2px;color:var(--bb-muted);font-size:12px;line-height:1.5}
      .bb-slot{min-height:88px;padding:18px 20px;border:1px dashed ${dark ? 'rgba(219,208,195,.38)' : '#d9b8a4'};border-radius:${soft ? '12px' : '18px'};background:${dark ? 'rgba(255,255,255,.02)' : 'rgba(255,248,242,.92)'};color:var(--bb-muted);font-size:14px;line-height:1.6}.bb-footer-card{margin-top:18px}
      .bb-contract{padding:28px 36px 34px;page-break-before:always}.bb-ref{margin:0 0 14px;color:var(--bb-muted);font-size:13px;line-height:1.6;text-align:center}.bb-divider{height:2px;margin:0 0 18px;background:${dark ? 'rgba(235,227,219,.14)' : '#ead7cf'}}.bb-contract .bb-copy p,.bb-contract .bb-copy li{margin:0 0 10px;color:var(--bb-ink);font-size:14px !important;line-height:1.75;font-weight:400}.bb-contract .bb-copy ul{margin:10px 0 0 1.1rem;padding:0}.bb-contract .bb-copy li{margin-bottom:6px}.bb-contract .bb-section{margin-top:18px}.bb-contract .bb-section-title{margin-bottom:10px}.bb-contract .bb-section-title h2{margin:0;color:var(--bb-primary);font-family:var(--bb-head);font-size:23px !important;line-height:1.15;font-weight:600}
      .bb-table{width:100%;border-collapse:collapse;table-layout:fixed}.bb-table th,.bb-table td{width:33.333%;padding:12px 14px;border:1px solid var(--bb-border);font-size:13px;text-align:left;vertical-align:top}.bb-table thead th{background:${dark ? '#25221f' : '#dfe5d5'};color:var(--bb-banner-text);font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.bb-field{display:inline-block;min-width:0;padding-bottom:2px;border-bottom:1px dashed ${dark ? 'rgba(219,208,195,.45)' : 'rgba(124,148,83,.45)'};color:var(--bb-ink);font-weight:600}
      .bb-note{margin:0}.bb-note-italic{font-style:italic}.bb-signatures{display:grid;gap:18px}.bb-sign-card{border:1px solid var(--bb-border);background:${dark ? 'rgba(255,255,255,.03)' : '#fffdfa'}}.bb-sign-head{padding:8px 12px;background:${dark ? '#25221f' : '#dfe5d5'};color:var(--bb-banner-text);font-size:15px;font-weight:700}.bb-sign-body{padding:0 0 12px}.bb-sign-party{margin:0;padding:8px 12px;border-bottom:1px solid var(--bb-border);font-size:15px;font-weight:500}.bb-sign-grid{display:grid;gap:14px}.bb-sign-line{display:grid;gap:0;padding:0 12px}.bb-sign-line span{color:var(--bb-muted);font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.bb-sign-fill{min-height:56px;border:1px solid var(--bb-border);border-top:0}.bb-sign-fill-lg{min-height:118px}.bb-sign-meta{display:grid;grid-template-columns:minmax(0,1fr) 140px}
      @media (max-width:720px){.bb-front,.bb-contract{padding:18px}.bb-banner{margin-left:-18px;margin-right:-18px;padding-left:18px;padding-right:18px}.bb-top,.bb-summary,.bb-grid,.bb-gallery-grid,.bb-sign-meta{grid-template-columns:1fr}.bb-created,.bb-date,.bb-brand{text-align:left;justify-self:start}.bb-table th,.bb-table td{display:block;width:100%}}
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
