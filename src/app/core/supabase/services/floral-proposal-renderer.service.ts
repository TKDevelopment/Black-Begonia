import { Injectable } from '@angular/core';

import {
  FloralProposalRenderContract,
  FloralProposalRenderLineItem,
} from '../../models/floral-proposal';

@Injectable({
  providedIn: 'root',
})
export class FloralProposalRendererService {
  renderHtml(contract: FloralProposalRenderContract): string {
    const primaryColor = contract.template.primary_color || '#111111';
    const accentColor = contract.template.accent_color || '#ea938c';
    const headingFont =
      contract.template.heading_font_family || 'Cormorant Garamond, Georgia, serif';
    const bodyFont =
      contract.template.body_font_family || 'Source Sans 3, Arial, sans-serif';

    const layoutClass = this.getDocumentLayoutClass(contract);
    const headerHtml = this.renderHeader(contract);
    const introHtml = this.renderIntro(contract);
    const lineItemsHtml = contract.line_items
      .map((line) => this.renderLineItem(contract, line))
      .join('');
    const totalsHtml = this.renderTotals(contract);
    const agreementHtml = this.renderAgreementSections(contract);

    return `
      <html>
        <head>
          <title>Floral Proposal ${contract.proposal_version ? `v${contract.proposal_version}` : ''}</title>
          <style>
            :root {
              --proposal-primary: ${primaryColor};
              --proposal-accent: ${accentColor};
              --proposal-paper: #fbf8f5;
              --proposal-ink: #1f1b19;
              --proposal-muted: #6b625c;
              --proposal-border: #e6ddd6;
            }

            * { box-sizing: border-box; }
            body {
              margin: 0;
              background: #f3eee8;
              color: var(--proposal-ink);
              font-family: ${bodyFont};
              padding: 36px;
            }
            .proposal-shell {
              max-width: 980px;
              margin: 0 auto;
              background: white;
              border: 1px solid var(--proposal-border);
              border-radius: 28px;
              overflow: hidden;
              box-shadow: 0 18px 50px rgba(31, 27, 25, 0.08);
            }
            .proposal-body { padding: 36px 38px 42px; }
            .proposal-eyebrow {
              text-transform: uppercase;
              letter-spacing: 0.26em;
              font-size: 11px;
              color: var(--proposal-accent);
              margin: 0 0 10px;
            }
            .proposal-title, .line-item-title, .section-title {
              font-family: ${headingFont};
            }
            .proposal-title {
              margin: 0;
              font-size: 42px;
              line-height: 1;
              color: var(--proposal-primary);
            }
            .proposal-meta, .proposal-copy, .line-item-description, .agreement-copy {
              color: var(--proposal-muted);
              line-height: 1.75;
            }
            .proposal-header {
              border-bottom: 1px solid var(--proposal-border);
            }
            .proposal-header.editorial {
              display: grid;
              grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
              gap: 24px;
              padding: 38px;
              background: linear-gradient(135deg, #fff 0%, var(--proposal-paper) 100%);
            }
            .proposal-header.minimal {
              padding: 34px 38px 28px;
              background: white;
            }
            .proposal-header.classic {
              padding: 44px 38px 36px;
              background: linear-gradient(180deg, #fff 0%, #f8f2ec 100%);
              text-align: center;
            }
            .proposal-logo {
              max-width: 150px;
              max-height: 72px;
              object-fit: contain;
              margin-bottom: 18px;
            }
            .proposal-header.classic .proposal-logo {
              margin: 0 auto 18px;
            }
            .proposal-client-meta {
              display: grid;
              gap: 6px;
              font-size: 13px;
            }
            .proposal-summary-block {
              background: rgba(255,255,255,0.78);
              border: 1px solid var(--proposal-border);
              border-radius: 22px;
              padding: 18px 20px;
            }
            .section-title {
              margin: 0 0 14px;
              font-size: 28px;
              color: var(--proposal-primary);
            }
            .proposal-intro {
              padding: 24px 0 8px;
            }
            .line-items {
              display: grid;
              gap: 22px;
              margin-top: 18px;
            }
            .line-item {
              border: 1px solid var(--proposal-border);
              border-radius: 24px;
              overflow: hidden;
              background: var(--proposal-paper);
            }
            .line-item.grid-left {
              display: grid;
              grid-template-columns: minmax(0, 230px) minmax(0, 1fr);
            }
            .line-item.grid-right {
              display: grid;
              grid-template-columns: minmax(0, 1fr) minmax(0, 230px);
            }
            .line-item.stacked {
              display: block;
            }
            .line-item-media {
              min-height: 210px;
              background: #efe6df;
            }
            .line-item-media img {
              width: 100%;
              height: 100%;
              display: block;
              object-fit: cover;
            }
            .line-item-copy {
              padding: 22px 24px;
            }
            .line-item-top {
              display: flex;
              justify-content: space-between;
              gap: 20px;
              align-items: start;
            }
            .line-item-title {
              margin: 0 0 8px;
              font-size: 28px;
              color: var(--proposal-primary);
            }
            .line-item-type {
              display: inline-flex;
              margin-bottom: 10px;
              padding: 4px 10px;
              border-radius: 999px;
              background: rgba(234,147,140,0.16);
              color: var(--proposal-primary);
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.15em;
            }
            .line-item-price {
              text-align: right;
              min-width: 120px;
              font-size: 13px;
              color: var(--proposal-muted);
            }
            .line-item-price strong {
              display: block;
              margin-top: 6px;
              font-size: 22px;
              color: var(--proposal-ink);
            }
            .line-item-caption {
              margin-top: 14px;
              font-size: 12px;
              color: var(--proposal-muted);
              font-style: italic;
            }
            .totals-card {
              margin-top: 28px;
              margin-left: auto;
              width: min(100%, 360px);
              border: 1px solid var(--proposal-border);
              border-radius: 22px;
              padding: 20px 22px;
              background: white;
            }
            .totals-row {
              display: flex;
              justify-content: space-between;
              gap: 18px;
              padding: 8px 0;
              font-size: 14px;
            }
            .totals-row.total {
              margin-top: 10px;
              padding-top: 14px;
              border-top: 1px solid var(--proposal-border);
              font-size: 17px;
              font-weight: 700;
            }
            .agreement-section {
              margin-top: 34px;
              padding-top: 22px;
              border-top: 1px solid var(--proposal-border);
            }
            .agreement-copy p {
              margin: 0 0 12px;
            }
            .signature-box {
              margin-top: 18px;
              padding: 18px;
              border: 1px dashed var(--proposal-border);
              border-radius: 18px;
              background: var(--proposal-paper);
            }
            .proposal-footer {
              padding: 18px 38px 26px;
              border-top: 1px solid var(--proposal-border);
              background: #fff;
              font-size: 12px;
              color: var(--proposal-muted);
            }
            .proposal-footer.minimal {
              text-align: center;
            }
            .proposal-footer.formal {
              display: flex;
              justify-content: space-between;
              gap: 16px;
            }
            .proposal-footer.signature_focused {
              display: grid;
              gap: 6px;
            }
            @media print {
              body { padding: 0; background: white; }
              .proposal-shell { box-shadow: none; border-radius: 0; }
            }
          </style>
        </head>
        <body>
          <div class="proposal-shell ${layoutClass}">
            ${headerHtml}
            <div class="proposal-body">
              ${introHtml}
              <div class="line-items">
                ${lineItemsHtml}
              </div>
              ${totalsHtml}
              ${agreementHtml}
            </div>
            ${this.renderFooter(contract)}
          </div>
        </body>
      </html>
    `;
  }

  private renderHeader(contract: FloralProposalRenderContract): string {
    const headerLayout = contract.template.header_layout || 'editorial';
    const logo = contract.template.logo_url
      ? `<img class="proposal-logo" src="${contract.template.logo_url}" alt="${this.escapeHtml(
          contract.template.name || 'Proposal Template Logo'
        )}" />`
      : '';

    if (headerLayout === 'minimal') {
      return `
        <div class="proposal-header minimal">
          ${logo}
          <p class="proposal-eyebrow">${this.escapeHtml(contract.template.name || 'Floral Proposal')}</p>
          <h1 class="proposal-title">Floral Proposal</h1>
          <div class="proposal-client-meta proposal-meta" style="margin-top:16px;">
            <div>Prepared for ${this.escapeHtml(contract.lead.first_name)} ${this.escapeHtml(contract.lead.last_name)}</div>
            <div>${this.escapeHtml(contract.lead.email)}</div>
            <div>${this.escapeHtml(this.formatDisplay(contract.lead.event_date, 'Not set'))}</div>
          </div>
        </div>
      `;
    }

    if (headerLayout === 'classic') {
      return `
        <div class="proposal-header classic">
          ${logo}
          <p class="proposal-eyebrow">${this.escapeHtml(contract.template.name || 'Floral Proposal')}</p>
          <h1 class="proposal-title">Floral Proposal</h1>
          <p class="proposal-copy" style="max-width:620px;margin:16px auto 0;">
            Prepared for ${this.escapeHtml(contract.lead.first_name)} ${this.escapeHtml(contract.lead.last_name)} for ${this.escapeHtml(
              this.formatDisplay(contract.lead.event_date, 'their event')
            )}.
          </p>
        </div>
      `;
    }

    return `
      <div class="proposal-header editorial">
        <div>
          ${logo}
          <p class="proposal-eyebrow">${this.escapeHtml(contract.template.name || 'Floral Proposal')}</p>
          <h1 class="proposal-title">Floral Proposal</h1>
          <p class="proposal-copy" style="margin-top:16px;">
            A curated proposal designed around your event floral needs, with styling notes, visual references, and pricing summarized below.
          </p>
        </div>
        <div class="proposal-summary-block proposal-meta">
          <div><strong>Client:</strong> ${this.escapeHtml(contract.lead.first_name)} ${this.escapeHtml(contract.lead.last_name)}</div>
          <div><strong>Email:</strong> ${this.escapeHtml(contract.lead.email)}</div>
          <div><strong>Service:</strong> ${this.escapeHtml(this.formatDisplay(contract.lead.service_type, 'Not set'))}</div>
          <div><strong>Event Date:</strong> ${this.escapeHtml(this.formatDisplay(contract.lead.event_date, 'Not set'))}</div>
          <div><strong>Generated:</strong> ${this.escapeHtml(this.formatDateTime(contract.generated_at))}</div>
        </div>
      </div>
    `;
  }

  private renderIntro(contract: FloralProposalRenderContract): string {
    if (!contract.template.show_intro_message) {
      return '';
    }

    return `
      <section class="proposal-intro">
        <p class="proposal-eyebrow">Overview</p>
        <h2 class="section-title">${this.escapeHtml(
          contract.template.intro_title || 'Your Floral Proposal'
        )}</h2>
        <p class="proposal-copy">${this.escapeHtml(
          contract.template.intro_body ||
            'We are honored to prepare floral designs for your event. Below is your curated floral proposal.'
        )}</p>
      </section>
    `;
  }

  private renderLineItem(
    contract: FloralProposalRenderContract,
    line: FloralProposalRenderLineItem
  ): string {
    const lineLayout = contract.template.line_item_layout || 'image_left';
    const imageHtml = line.image_signed_url
      ? `
        <div class="line-item-media">
          <img src="${line.image_signed_url}" alt="${this.escapeHtml(
            line.image_alt_text || line.item_name
          )}" />
        </div>
      `
      : '';

    const copyHtml = `
      <div class="line-item-copy">
        <span class="line-item-type">${this.escapeHtml(line.line_type_label)}</span>
        <div class="line-item-top">
          <div>
            <h3 class="line-item-title">${this.escapeHtml(line.item_name)}</h3>
          </div>
          <div class="line-item-price">
            <span>Qty ${line.quantity}</span>
            <strong>${this.formatCurrency(line.subtotal)}</strong>
          </div>
        </div>
        ${
          line.image_caption
            ? `<p class="line-item-caption">${this.escapeHtml(line.image_caption)}</p>`
            : ''
        }
      </div>
    `;

    if (lineLayout === 'stacked') {
      return `
        <article class="line-item stacked">
          ${imageHtml}
          ${copyHtml}
        </article>
      `;
    }

    if (lineLayout === 'image_right') {
      return `
        <article class="line-item grid-right">
          ${copyHtml}
          ${imageHtml}
        </article>
      `;
    }

    return `
      <article class="line-item grid-left">
        ${imageHtml}
        ${copyHtml}
      </article>
    `;
  }

  private renderTotals(contract: FloralProposalRenderContract): string {
    return `
      <section class="totals-card">
        <p class="proposal-eyebrow">Pricing</p>
        <h2 class="section-title" style="font-size:30px;">Investment</h2>
        <div class="totals-row"><span>Products</span><span>${this.formatCurrency(contract.totals.products_total)}</span></div>
        <div class="totals-row"><span>Fees</span><span>${this.formatCurrency(contract.totals.fees_total)}</span></div>
        <div class="totals-row"><span>Discounts</span><span>${this.formatCurrency(contract.totals.discounts_total)}</span></div>
        <div class="totals-row"><span>Subtotal</span><span>${this.formatCurrency(contract.totals.subtotal)}</span></div>
        <div class="totals-row"><span>Tax</span><span>${this.formatCurrency(contract.totals.tax_amount)}</span></div>
        <div class="totals-row total"><span>Total</span><span>${this.formatCurrency(contract.totals.total_amount)}</span></div>
      </section>
    `;
  }

  private renderAgreementSections(contract: FloralProposalRenderContract): string {
    const sections: string[] = [];

    if (contract.template.show_terms_section) {
      sections.push(`
        <section class="agreement-section">
          <p class="proposal-eyebrow">Terms</p>
          <h2 class="section-title">Terms & Conditions</h2>
          <div class="agreement-copy">
            <p>This floral proposal is subject to availability, seasonal substitutions when necessary, and final scheduling coordination.</p>
          </div>
        </section>
      `);
    }

    if (contract.template.show_privacy_section) {
      sections.push(`
        <section class="agreement-section">
          <p class="proposal-eyebrow">Privacy</p>
          <h2 class="section-title">Privacy Policy</h2>
          <div class="agreement-copy">
            <p>Your contact information and event details are used solely for proposal preparation, booking communication, and service fulfillment.</p>
          </div>
        </section>
      `);
    }

    if (contract.template.show_signature_section) {
      sections.push(`
        <section class="agreement-section">
          <p class="proposal-eyebrow">Acceptance</p>
          <h2 class="section-title">Agreement & Signature</h2>
          <div class="agreement-copy">
            <p>Acceptance of this Floral Proposal confirms agreement to pricing, proposal terms, privacy acknowledgements, and the scope presented above.</p>
          </div>
          <div class="signature-box">
            Signature will be captured through the client portal during proposal acceptance.
          </div>
        </section>
      `);
    }

    return sections.join('');
  }

  private renderFooter(contract: FloralProposalRenderContract): string {
    const footerLayout = contract.template.footer_layout || 'signature_focused';

    if (footerLayout === 'formal') {
      return `
        <div class="proposal-footer formal">
          <span>${this.escapeHtml(contract.template.name || 'Floral Proposal')}</span>
          <span>${this.escapeHtml(this.formatDateTime(contract.generated_at))}</span>
        </div>
      `;
    }

    if (footerLayout === 'minimal') {
      return `
        <div class="proposal-footer minimal">
          ${this.escapeHtml(contract.template.name || 'Floral Proposal')}
        </div>
      `;
    }

    return `
      <div class="proposal-footer signature_focused">
        <span>${this.escapeHtml(contract.template.name || 'Floral Proposal')}</span>
        <span>Prepared for ${this.escapeHtml(contract.lead.first_name)} ${this.escapeHtml(contract.lead.last_name)}</span>
      </div>
    `;
  }

  private getDocumentLayoutClass(contract: FloralProposalRenderContract): string {
    return contract.template.header_layout || 'editorial';
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value ?? 0);
  }

  private formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  private formatDisplay(value: string | null | undefined, fallback: string): string {
    if (!value) return fallback;
    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
