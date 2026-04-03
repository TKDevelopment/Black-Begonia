import { Injectable } from '@angular/core';

import {
  GrapesJsStoredTemplateConfig,
  FloralProposalRenderContract,
  FloralProposalRenderLineItem,
} from '../../models/floral-proposal';

@Injectable({
  providedIn: 'root',
})
export class FloralProposalRendererService {
  renderHtml(contract: FloralProposalRenderContract): string {
    const grapesJsHtml = this.renderGrapesJsHtml(contract);
    if (grapesJsHtml) {
      return grapesJsHtml;
    }

    const primaryColor = contract.template.primary_color || '#111111';
    const accentColor = contract.template.accent_color || '#ea938c';
    const headingFont = contract.template.heading_font_family || 'Cormorant Garamond, Georgia, serif';
    const bodyFont = contract.template.body_font_family || 'Source Sans 3, Arial, sans-serif';

    const layoutClass = this.getDocumentLayoutClass(contract);
    const headerHtml = this.renderHeader(contract);
    const introHtml = this.renderIntro(contract);
    const lineItemsHtml = this.renderLineItemsSection(contract);
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
            .proposal-event-header {
              margin-top: 15px;
              margin-left: -38px;
              margin-right: -38px;
              padding: 18px 38px 16px;
              border-radius: 0;
              background:
                linear-gradient(180deg, rgba(154, 168, 117, 0.20), rgba(154, 168, 117, 0.14)),
                rgba(154, 168, 117, 0.18);
              border-top: 1px solid rgba(135, 151, 103, 0.22);
              border-bottom: 1px solid rgba(135, 151, 103, 0.22);
              border-left: 0;
              border-right: 0;
              box-shadow: none;
              position: relative;
              overflow: hidden;
              text-align: center;
            }
            .proposal-event-header-copy {
              position: relative;
              z-index: 1;
              max-width: 760px;
              margin: 0 auto;
            }
            .proposal-event-overline {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 10px;
              width: fit-content;
              margin: 0 auto 8px;
              padding: 6px 12px;
              border-radius: 999px;
              background: rgba(135, 151, 103, 0.12);
              color: #6f7d4f;
              font-size: 9px;
              font-weight: 700;
              letter-spacing: 0.18em;
              text-transform: uppercase;
            }
            .proposal-event-couple {
              margin: 0;
              color: #6f7d4f;
              font-family: 'Times New Roman', Times, serif;
              font-size: 28px;
              font-style: italic;
              letter-spacing: 4px;
              line-height: 0.98;
            }
            .proposal-event-service {
              margin: 6px auto 0;
              color: rgba(31, 27, 25, 0.72);
              font-size: 14px;
              line-height: 1.35;
              max-width: 38rem;
            }
            .proposal-event-meta {
              margin-top: 18px;
              display: flex;
              justify-content: center;
              flex-wrap: wrap;
              gap: 10px;
            }
            .proposal-event-meta-pill {
              padding: 8px 14px;
              border-radius: 999px;
              background: rgba(255,255,255,0.8);
              border: 1px solid rgba(135, 151, 103, 0.12);
              color: var(--proposal-primary);
              font-size: 12px;
              line-height: 1.2;
            }
            .proposal-event-contact {
              margin: 10px auto 0;
              display: flex;
              justify-content: center;
              align-items: center;
              flex-wrap: wrap;
              gap: 10px;
              color: #8b9b67;
              font-family: ${headingFont};
              font-size: 18px;
              line-height: 1.1;
            }
            .proposal-event-contact-divider {
              width: 1px;
              height: 16px;
              background: rgba(135, 151, 103, 0.42);
            }
            .proposal-event-details {
              margin-top: 8px;
              display: grid;
              gap: 3px;
            }
            .proposal-event-detail-row {
              margin: 0;
              color: var(--proposal-primary);
              font-size: 12px;
              line-height: 1.25;
            }
            .proposal-event-detail-label {
              font-weight: 700;
              margin-right: 6px;
            }
            .proposal-event-detail-value {
              color: rgba(31, 27, 25, 0.86);
            }
            .line-items {
              display: grid;
              gap: 18px;
              margin-top: 18px;
            }
            .compact-line-items {
              display: grid;
              gap: 0;
              border-radius: 24px;
              overflow: hidden;
              background: rgba(248, 245, 240, 0.92);
              border: 1px solid rgba(135, 151, 103, 0.22);
            }
            .compact-line-items-header {
              display: flex;
              justify-content: space-between;
              gap: 18px;
              align-items: end;
              padding: 16px 18px 14px;
              border-bottom: 1px solid rgba(135, 151, 103, 0.18);
              background: linear-gradient(180deg, rgba(255,255,255,0.82), rgba(236, 240, 228, 0.9));
            }
            .compact-line-items-kicker {
              color: #6f7d4f;
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 0.16em;
              text-transform: uppercase;
            }
            .compact-line-items-title {
              margin: 0 0 8px;
              font-size: 24px;
              color: var(--proposal-primary);
              font-family: ${headingFont};
            }
            .compact-line-items-count {
              color: var(--proposal-muted);
              font-size: 12px;
              white-space: nowrap;
            }
            .compact-line-items-table-head,
            .compact-line-item {
              display: grid;
              grid-template-columns: minmax(0, 1.6fr) 70px 90px 108px;
              gap: 14px;
              align-items: start;
            }
            .compact-line-items-table-head {
              padding: 10px 18px;
              background: rgba(135, 151, 103, 0.12);
              color: #6f7d4f;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
            }
            .compact-line-item {
              padding: 14px 18px;
              border-bottom: 1px solid rgba(135, 151, 103, 0.14);
            }
            .compact-line-item:last-child {
              border-bottom: 0;
            }
            .compact-line-item-heading-row {
              display: flex;
              flex-wrap: wrap;
              gap: 8px 12px;
              align-items: center;
              margin-bottom: 4px;
            }
            .compact-line-item-type {
              color: #6f7d4f;
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 0.12em;
              text-transform: uppercase;
            }
            .compact-line-item-florals {
              color: var(--proposal-muted);
              font-size: 11px;
              font-style: italic;
            }
            .compact-line-item-title {
              margin: 0;
              color: #6f7d4f;
              font-family: 'Times New Roman', Times, serif;
              font-size: 20px;
              font-style: italic;
              letter-spacing: 4px;
              line-height: 1;
            }
            .compact-line-item-description {
              margin: 4px 0 0;
              color: var(--proposal-muted);
              font-size: 12px;
              line-height: 1.45;
            }
            .compact-line-item-qty,
            .compact-line-item-unit,
            .compact-line-item-subtotal {
              color: var(--proposal-muted);
              font-size: 12px;
              text-align: right;
              padding-top: 2px;
            }
            .compact-line-item-subtotal {
              color: var(--proposal-primary);
              font-size: 16px;
              font-weight: 700;
            }
            .immersive-line-items {
              gap: 6px;
            }
            .immersive-line-items-header {
              margin-bottom: -2px;
            }
            .immersive-line-item-page-spacer {
              height: 100px;
            }
            .immersive-line-item {
              display: grid;
              grid-template-columns: minmax(0, 1fr) 200px;
              gap: 0;
              align-items: center;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .immersive-line-item:not(.no-media) + .immersive-line-item:not(.no-media) {
              margin-top: -22px;
            }
            .immersive-line-item.image-left {
              grid-template-columns: 200px minmax(0, 1fr);
            }
            .immersive-line-item.no-media,
            .immersive-line-item.no-media.image-left,
            .immersive-line-item.no-media.image-right {
              grid-template-columns: 1fr;
            }
            .immersive-line-item-copy {
              min-width: 0;
              height: 175px;
              min-height: 175px;
              padding: 20px 24px;
              background: rgba(124, 148, 83, 0.18);
              color: #1f2417;
              display: grid;
              align-content: center;
            }
            .immersive-line-item.image-left .immersive-line-item-copy,
            .immersive-line-item.image-right .immersive-line-item-copy {
              width: 100%;
            }
            .immersive-line-item.no-media .immersive-line-item-copy {
              height: 100px;
              min-height: 100px;
              padding-top: 14px;
              padding-bottom: 14px;
            }
            .immersive-line-item-heading {
              display: flex;
              justify-content: space-between;
              gap: 18px;
              align-items: start;
            }
            .immersive-line-item-type {
              color: rgba(31, 36, 23, 0.72);
              font-size: 12px;
              font-weight: 700;
              letter-spacing: 0.14em;
              text-transform: uppercase;
            }
            .immersive-line-item-title {
              margin: 6px 0 8px;
              color: #6f7d4f;
              font-family: 'Times New Roman', Times, serif;
              font-size: 34px;
              font-style: italic;
              letter-spacing: 4px;
              line-height: 0.95;
            }
            .immersive-line-item-florals,
            .immersive-line-item-description {
              margin: 0;
              color: rgba(31, 36, 23, 0.76);
              font-size: 16px;
              line-height: 1.5;
            }
            .immersive-line-item-pricing {
              min-width: 128px;
              text-align: right;
              color: rgba(31, 36, 23, 0.76);
              font-size: 14px;
              display: grid;
              gap: 6px;
            }
            .immersive-line-item-pricing strong {
              color: #1f2417;
              font-size: 26px;
            }
            .immersive-line-item-media {
              width: 200px;
              min-width: 200px;
              max-width: 200px;
              height: 250px;
              max-height: 250px;
              align-self: center;
              position: relative;
              z-index: 1;
              overflow: hidden;
            }
            .immersive-line-item.image-left .immersive-line-item-media,
            .immersive-line-item.image-right .immersive-line-item-media {
              width: 200px;
              min-width: 200px;
              max-width: 200px;
              height: 250px;
              max-height: 250px;
            }
            .immersive-line-item-media img {
              width: 100%;
              height: 250px;
              max-height: 250px;
              display: block;
              object-fit: cover;
              object-position: center;
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
      .bb-contract .bb-section-title h2,
      .bb-contract h2 {
        font-size: 23px !important;
        line-height: 1.15 !important;
        font-weight: 600 !important;
      }
      .bb-contract .bb-copy p,
      .bb-contract .bb-copy li,
      .bb-contract p,
      .bb-contract li {
        font-size: 14px !important;
        line-height: 1.75 !important;
        font-weight: 400 !important;
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
              .proposal-event-header {
                break-inside: avoid;
                page-break-inside: avoid;
              }
              .compact-line-items-table-head,
              .compact-line-item {
                grid-template-columns: minmax(0, 1.6fr) 70px 90px 108px;
              }
              .immersive-line-item {
                grid-template-columns: minmax(0, 1fr) 200px;
              }
              .immersive-line-item.image-left {
                grid-template-columns: 200px minmax(0, 1fr);
              }
              .immersive-line-item.no-media,
              .immersive-line-item.no-media.image-left,
              .immersive-line-item.no-media.image-right {
                grid-template-columns: 1fr;
              }
            }
          </style>
        </head>
        <body>
          <div class="proposal-shell ${layoutClass}">
            ${headerHtml}
            <div class="proposal-body">
              ${introHtml}
              ${lineItemsHtml}
              ${totalsHtml}
              ${agreementHtml}
            </div>
            ${this.renderFooter(contract)}
          </div>
        </body>
      </html>
    `;
  }

  private renderGrapesJsHtml(contract: FloralProposalRenderContract): string | null {
    const config = (
      contract.template.template_config as { grapejs_sdk?: GrapesJsStoredTemplateConfig } | null
    )?.grapejs_sdk;
    const publishedHtml = config?.published_html?.trim();

    if (!publishedHtml) {
      return null;
    }

    const useStarterTemplateRuntime = this.isStarterTemplateRuntime(publishedHtml);
    const publishedLineItemsStyle = this.readPublishedLineItemsStyle(publishedHtml);

    const slotContent: Record<string, string> = {
      'proposal-header': useStarterTemplateRuntime
        ? this.renderCompactStarterHeader(contract)
        : this.renderHeader(contract),
      'proposal-intro': useStarterTemplateRuntime
        ? this.renderCompactStarterIntro(contract)
        : this.renderIntro(contract),
      'proposal-line-items': useStarterTemplateRuntime
        ? this.renderCompactStarterLineItems(contract, publishedLineItemsStyle)
        : this.renderLineItemsSection(contract, publishedLineItemsStyle),
      'proposal-totals': this.renderTotals(contract, useStarterTemplateRuntime),
      'proposal-terms': contract.template.show_terms_section
        ? this.renderContractEventDetailsSection(contract) + this.renderPaymentTermsSection(contract)
        : '',
      'proposal-privacy': contract.template.show_privacy_section
        ? `
          <section class="agreement-section">
            <p class="proposal-eyebrow">Privacy</p>
            <h2 class="section-title">Privacy Policy</h2>
            <div class="agreement-copy">
              <p>Your contact information and event details are used solely for proposal preparation, booking communication, and service fulfillment.</p>
            </div>
          </section>
        `
        : '',
      'proposal-signature': contract.template.show_signature_section
        ? this.renderSignatureSection(contract)
        : '',
      'proposal-footer': this.renderFooter(contract),
    };

    const mergedHtml = this.mergePublishedTemplate(
      publishedHtml,
      contract,
      slotContent,
      useStarterTemplateRuntime
    );

    return `
      <html>
        <head>
          <title>${this.escapeHtml(contract.template.name || 'Floral Proposal')}</title>
          <style>
            ${config?.published_css ?? ''}
            ${this.buildBaseStyles(contract)}
            @page {
              margin: 0;
            }
          </style>
        </head>
        <body style="margin:0;background:transparent;">
          ${mergedHtml}
        </body>
      </html>
    `;
  }

  private replaceSlot(html: string, slot: string, replacement: string): string {
    const pairedTagPattern = new RegExp(
      `<([a-z0-9-]+)([^>]*?)data-bb-slot=["']${slot}["']([^>]*)>[\\s\\S]*?<\\/\\1>`,
      'gi'
    );

    return html.replace(pairedTagPattern, replacement);
  }

  private readPublishedLineItemsStyle(html: string): 'compact' | 'alternating' | null {
    const match = html.match(
      /data-bb-slot=["']proposal-line-items["'][^>]*data-bb-line-items-style=["'](compact|alternating)["']/i
    );

    return (match?.[1]?.toLowerCase() as 'compact' | 'alternating' | undefined) ?? null;
  }

  private mergePublishedTemplate(
    html: string,
    contract: FloralProposalRenderContract,
    slotContent: Record<string, string>,
    useStarterTemplateRuntime: boolean
  ): string {
    if (typeof DOMParser === 'undefined') {
      const mergedSlotsHtml = Object.entries(slotContent).reduce(
        (nextHtml, [slot, replacement]) => this.replaceSlot(nextHtml, slot, replacement),
        html
      );

      return this.replaceTemplateFields(mergedSlotsHtml, contract);
    }

    const parser = new DOMParser();
    const documentNode = parser.parseFromString(html, 'text/html');

    Object.entries(slotContent).forEach(([slot, replacement]) => {
      documentNode.querySelectorAll(`[data-bb-slot="${slot}"]`).forEach((element) => {
        const wrapper = documentNode.createElement('div');
        wrapper.innerHTML = replacement;
        const replacementNodes = Array.from(wrapper.childNodes);

        if (!replacementNodes.length) {
          element.remove();
          return;
        }

        replacementNodes.forEach((node) => {
          element.parentNode?.insertBefore(node, element);
        });
        element.remove();
      });
    });

    Object.entries(this.buildTemplateFieldValues(contract)).forEach(([field, value]) => {
      documentNode.querySelectorAll(`[data-bb-field="${field}"]`).forEach((element) => {
        element.textContent = value;
      });
    });

    if (useStarterTemplateRuntime) {
      this.populateStarterGallery(documentNode, contract);
    }

    return documentNode.body.innerHTML;
  }

  private populateStarterGallery(
    documentNode: Document,
    contract: FloralProposalRenderContract
  ): void {
    const cards = Array.from(documentNode.querySelectorAll('.bb-gallery-card'));
    const imageLines = contract.line_items.filter((line) => !!line.image_signed_url).slice(0, cards.length);

    cards.forEach((card, index) => {
      const line = imageLines[index];
      const imageFrame = card.querySelector('.bb-gallery-image');
      const caption = card.querySelector('.bb-gallery-caption');

      if (!line || !imageFrame || !caption) {
        return;
      }

      imageFrame.innerHTML = `<img src="${this.escapeHtml(line.image_signed_url ?? '')}" alt="${this.escapeHtml(
        line.image_alt_text || line.item_name
      )}" />`;

      const captionParts = [line.item_name, line.image_caption].filter((value) => !!value);
      caption.textContent = captionParts.join(' | ');
    });
  }

  private isStarterTemplateRuntime(html: string): boolean {
    return (
      html.includes('class="bb-doc') ||
      html.includes("class='bb-doc") ||
      html.includes('bb-gallery-card')
    );
  }

  private replaceTemplateFields(
    html: string,
    contract: FloralProposalRenderContract
  ): string {
    const fields = this.buildTemplateFieldValues(contract);

    return Object.entries(fields).reduce(
      (nextHtml, [field, value]) => this.replaceField(nextHtml, field, value),
      html
    );
  }

  private replaceField(html: string, field: string, value: string): string {
    const safeValue = this.escapeHtml(value);
    const pairedTagPattern = new RegExp(
      `(<([a-z0-9-]+)([^>]*?)data-bb-field=["']${field}["']([^>]*)>)([\\s\\S]*?)(<\\/\\2>)`,
      'gi'
    );

    return html.replace(pairedTagPattern, `$1${safeValue}$6`);
  }

  private buildTemplateFieldValues(
    contract: FloralProposalRenderContract
  ): Record<string, string> {
    return {
      client_name: this.formatCustomerName(contract),
      customer_name: this.formatCustomerName(contract),
      delivery_setup_location: this.formatDeliverySetupLocation(contract),
      event_date: this.formatContractDate(contract.lead.event_date),
      event_type: this.formatEventType(contract),
      event_location_city_state: this.formatEventLocationCityState(contract),
      final_balance_due_date: this.formatFinalBalanceDueDate(contract.lead.event_date),
      proposal_created_date: this.formatShortDate(contract.generated_at),
      reception_type: this.formatDisplay(contract.lead.service_type, 'Not set'),
      service_type: this.formatDisplay(contract.lead.service_type, 'Not set'),
    };
  }

  private buildBaseStyles(contract: FloralProposalRenderContract): string {
    const primaryColor = contract.template.primary_color || '#111111';
    const accentColor = contract.template.accent_color || '#ea938c';
    const headingFont =
      contract.template.heading_font_family || 'Cormorant Garamond, Georgia, serif';
    const bodyFont =
      contract.template.body_font_family || 'Source Sans 3, Arial, sans-serif';

    return `
      :root {
        --proposal-primary: ${primaryColor};
        --proposal-accent: ${accentColor};
        --proposal-paper: #fbf8f5;
        --proposal-ink: #1f1b19;
        --proposal-muted: #6b625c;
        --proposal-border: #e6ddd6;
      }

      * { box-sizing: border-box; }
      html,
      body {
        margin: 0;
        padding: 0;
        min-height: 100%;
      }
      body {
        background: #f3eee8;
        color: var(--proposal-ink);
        font-family: ${bodyFont};
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
      .proposal-event-header {
        margin-top: 15px;
        margin-left: -38px;
        margin-right: -38px;
        padding: 18px 38px 16px;
        border-radius: 0;
        background:
          linear-gradient(180deg, rgba(154, 168, 117, 0.20), rgba(154, 168, 117, 0.14)),
          rgba(154, 168, 117, 0.18);
        border-top: 1px solid rgba(135, 151, 103, 0.22);
        border-bottom: 1px solid rgba(135, 151, 103, 0.22);
        border-left: 0;
        border-right: 0;
        box-shadow: none;
        position: relative;
        overflow: hidden;
        text-align: center;
      }
      .proposal-event-header-copy {
        position: relative;
        z-index: 1;
        max-width: 760px;
        margin: 0 auto;
      }
      .proposal-event-overline {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: fit-content;
        margin: 0 auto 8px;
        padding: 6px 12px;
        border-radius: 999px;
        background: rgba(135, 151, 103, 0.12);
        color: #6f7d4f;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      .proposal-event-couple {
        margin: 0;
        color: #6f7d4f;
        font-family: 'Times New Roman', Times, serif;
        font-size: 28px;
        font-style: italic;
        letter-spacing: 4px;
        line-height: 0.98;
      }
      .proposal-event-service {
        margin: 6px auto 0;
        color: rgba(31, 27, 25, 0.72);
        font-size: 14px;
        line-height: 1.35;
        max-width: 38rem;
      }
      .proposal-event-meta {
        margin-top: 18px;
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 10px;
      }
      .proposal-event-meta-pill {
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(255,255,255,0.8);
        border: 1px solid rgba(135, 151, 103, 0.12);
        color: var(--proposal-primary);
        font-size: 12px;
        line-height: 1.2;
      }
      .proposal-event-contact {
        margin: 10px auto 0;
        display: flex;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        color: #8b9b67;
        font-family: ${headingFont};
        font-size: 18px;
        line-height: 1.1;
      }
      .proposal-event-contact-divider {
        width: 1px;
        height: 16px;
        background: rgba(135, 151, 103, 0.42);
      }
      .proposal-event-details {
        margin-top: 8px;
        display: grid;
        gap: 3px;
      }
      .proposal-event-detail-row {
        margin: 0;
        color: var(--proposal-primary);
        font-size: 12px;
        line-height: 1.25;
      }
      .proposal-event-detail-label {
        font-weight: 700;
        margin-right: 6px;
      }
      .proposal-event-detail-value {
        color: rgba(31, 27, 25, 0.86);
      }
      .compact-starter-header {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(200px, 0.9fr);
        gap: 12px;
        align-items: start;
        padding: 14px 16px;
        border: 1px solid var(--proposal-border);
        border-radius: 22px;
        background:
          radial-gradient(circle at top right, rgba(234,147,140,0.12), transparent 34%),
          linear-gradient(180deg, rgba(255,255,255,0.96), rgba(252,247,242,0.94));
        position: relative;
      }
      .compact-starter-header::after {
        content: '';
        position: absolute;
        inset: 8px;
        border: 1px solid rgba(214, 194, 176, 0.75);
        border-radius: 16px;
        pointer-events: none;
      }
      .compact-starter-header-copy {
        min-width: 0;
        position: relative;
        z-index: 1;
      }
      .compact-starter-kicker {
        margin: 0 0 4px;
        color: var(--proposal-accent);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      .compact-starter-title {
        margin: 0;
        color: var(--proposal-primary);
        font-family: ${headingFont};
        font-size: 24px;
        line-height: 0.98;
      }
      .compact-starter-copy {
        margin: 10px 0 0;
        color: var(--proposal-muted);
        font-size: 11px;
        line-height: 1.45;
        max-width: 28ch;
      }
      .compact-starter-ornament {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 10px;
        color: var(--proposal-accent);
        font-size: 10px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }
      .compact-starter-ornament::before,
      .compact-starter-ornament::after {
        content: '';
        display: block;
        width: 32px;
        height: 1px;
        background: rgba(188, 163, 143, 0.8);
      }
      .compact-starter-meta {
        display: grid;
        gap: 5px;
        padding: 10px 12px;
        border: 1px solid var(--proposal-border);
        border-radius: 18px;
        background: rgba(255,255,255,0.72);
        position: relative;
        z-index: 1;
      }
      .compact-starter-meta-row {
        display: grid;
        grid-template-columns: 58px minmax(0, 1fr);
        gap: 8px;
        align-items: baseline;
        color: var(--proposal-muted);
        font-size: 10px;
        line-height: 1.35;
      }
      .compact-starter-meta-row strong {
        color: var(--proposal-primary);
        font-size: 10px;
        letter-spacing: 0.04em;
      }
      .compact-starter-intro {
        padding: 0 2px;
      }
      .compact-starter-intro p {
        margin: 0;
        color: var(--proposal-muted);
        font-size: 10px;
        line-height: 1.35;
      }
      .compact-line-items {
        display: grid;
        gap: 0;
        margin-top: 8px;
        border-radius: 18px;
        overflow: hidden;
        background: rgba(248, 245, 240, 0.96);
        border: 1px solid rgba(135, 151, 103, 0.18);
      }
      .compact-line-items-header {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 14px;
        border-bottom: 1px solid rgba(135, 151, 103, 0.16);
        background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(236,240,228,0.92));
      }
      .compact-line-items-title {
        margin: 0;
        color: var(--proposal-primary);
        font-family: ${headingFont};
        font-size: 18px;
        line-height: 1;
      }
      .compact-line-items-kicker {
        color: #6f7d4f;
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }
      .compact-line-items-count {
        color: var(--proposal-muted);
        font-size: 10px;
        line-height: 1.3;
        text-align: right;
      }
      .compact-line-items-table-head,
      .compact-line-item {
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) 52px 74px 88px;
        gap: 10px;
        align-items: start;
      }
      .compact-line-items-table-head {
        padding: 8px 14px;
        background: rgba(135, 151, 103, 0.1);
        color: #6f7d4f;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .compact-line-item {
        padding: 10px 14px;
        border-bottom: 1px solid rgba(135, 151, 103, 0.12);
      }
      .compact-line-item:last-child {
        border-bottom: 0;
      }
      .compact-line-item-main {
        min-width: 0;
      }
      .compact-line-item-heading-row {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 8px;
        align-items: center;
        margin-bottom: 3px;
      }
      .compact-line-item-type {
        color: #6f7d4f;
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .compact-line-item-florals {
        color: var(--proposal-muted);
        font-size: 9px;
        font-style: italic;
      }
      .compact-line-item-title {
        margin: 0;
        color: #6f7d4f;
        font-family: 'Times New Roman', Times, serif;
        font-size: 16px;
        font-style: italic;
        letter-spacing: 4px;
        line-height: 1;
      }
      .compact-line-item-description {
        margin: 3px 0 0;
        color: var(--proposal-muted);
        font-size: 9px;
        line-height: 1.35;
      }
      .compact-line-item-qty,
      .compact-line-item-unit,
      .compact-line-item-subtotal {
        color: var(--proposal-muted);
        font-size: 10px;
        text-align: right;
      }
      .compact-line-item-subtotal {
        color: var(--proposal-primary);
        font-size: 13px;
        font-weight: 700;
      }
      .line-items {
        display: grid;
        gap: 18px;
        margin-top: 18px;
      }
      .immersive-line-items {
        gap: 6px;
      }
      .immersive-line-items-header {
        margin-bottom: -2px;
      }
      .immersive-line-item-page-spacer {
        height: 100px;
      }
      .immersive-line-item {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 200px;
        gap: 0;
        align-items: center;
      }
      .immersive-line-item.image-left {
        grid-template-columns: 200px minmax(0, 1fr);
      }
      .immersive-line-item:not(.no-media) + .immersive-line-item:not(.no-media) {
        margin-top: -22px;
      }
      .immersive-line-item.no-media,
      .immersive-line-item.no-media.image-left,
      .immersive-line-item.no-media.image-right {
        grid-template-columns: 1fr;
      }
      .immersive-line-item-copy {
        min-width: 0;
        height: 175px;
        min-height: 175px;
        padding: 18px 20px;
        background: rgba(124, 148, 83, 0.18);
        color: #1f2417;
        display: grid;
        align-content: center;
      }
      .immersive-line-item.image-left .immersive-line-item-copy,
      .immersive-line-item.image-right .immersive-line-item-copy {
        width: 100%;
      }
      .immersive-line-item.no-media .immersive-line-item-copy {
        height: 100px;
        min-height: 100px;
        padding-top: 12px;
        padding-bottom: 12px;
      }
      .immersive-line-item-heading {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        align-items: start;
      }
      .immersive-line-item-type {
        color: rgba(31, 36, 23, 0.72);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .immersive-line-item-title {
        margin: 4px 0 6px;
        color: #6f7d4f;
        font-family: 'Times New Roman', Times, serif;
        font-size: 24px;
        font-style: italic;
        letter-spacing: 4px;
        line-height: 0.95;
      }
      .immersive-line-item-florals,
      .immersive-line-item-description {
        margin: 0;
        color: rgba(31, 36, 23, 0.76);
        font-size: 12px;
        line-height: 1.45;
      }
      .immersive-line-item-pricing {
        min-width: 96px;
        text-align: right;
        color: rgba(31, 36, 23, 0.76);
        font-size: 12px;
        display: grid;
        gap: 4px;
      }
      .immersive-line-item-pricing strong {
        color: #1f2417;
        font-size: 20px;
      }
      .immersive-line-item-media {
        width: 200px;
        min-width: 200px;
        max-width: 200px;
        height: 250px;
        max-height: 250px;
        margin-top: 0;
        margin-bottom: 0;
        position: relative;
        z-index: 1;
        overflow: hidden;
      }
      .immersive-line-item.image-left .immersive-line-item-media,
      .immersive-line-item.image-right .immersive-line-item-media {
        width: 200px;
        min-width: 200px;
        max-width: 200px;
        height: 250px;
        max-height: 250px;
      }
      .immersive-line-item-media img {
        width: 100%;
        height: 250px;
        max-height: 250px;
        display: block;
        object-fit: cover;
        object-position: center;
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
      .totals-card.compact {
        margin-top: 14px;
        width: 100%;
        padding: 14px 16px;
        border-radius: 18px;
      }
      .totals-card.compact .proposal-eyebrow {
        margin-bottom: 6px;
        font-size: 9px;
      }
      .totals-card.compact .section-title {
        margin-bottom: 8px;
        font-size: 22px !important;
      }
      .totals-card.compact .totals-row {
        padding: 5px 0;
        font-size: 11px;
      }
      .totals-card.compact .totals-row.total {
        margin-top: 6px;
        padding-top: 8px;
        font-size: 14px;
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
      .contract-table {
        width: 100%;
        margin-top: 16px;
        border-collapse: collapse;
      }
      .contract-table th,
      .contract-table td {
        padding: 14px 16px;
        border: 1px solid var(--proposal-border);
        font-size: 14px;
        text-align: left;
        vertical-align: top;
      }
      .contract-table th {
        width: 34%;
        background: #f7efe8;
        color: var(--proposal-primary);
        font-weight: 700;
      }
      .contract-table td {
        color: var(--proposal-muted);
      }
      .contract-field {
        display: inline-block;
        min-width: 140px;
        padding-bottom: 2px;
        border-bottom: 1px dashed rgba(234, 147, 140, 0.55);
        color: var(--proposal-ink);
        font-weight: 600;
      }
      .agreement-copy p {
        margin: 0 0 12px;
      }
      .bb-gallery-image img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
        border-radius: inherit;
      }
      .bb-gallery-card-hero .bb-gallery-image {
        min-height: 220px !important;
      }
      .bb-gallery-card .bb-gallery-image {
        min-height: 108px !important;
      }
      .bb-copy p,
      .bb-copy li {
        font-size: 12px !important;
        line-height: 1.5 !important;
      }
      .bb-copy ul {
        margin-top: 6px !important;
      }
      .bb-section {
        margin-top: 12px !important;
      }
      .bb-section-title {
        margin-bottom: 6px !important;
      }
      .bb-section-title h2 {
        font-size: 18px !important;
        line-height: 1.05 !important;
      }
      .bb-table th,
      .bb-table td {
        padding: 8px 10px !important;
        font-size: 11px !important;
      }
      .bb-field {
        font-size: 11px !important;
        line-height: 1.25 !important;
      }
      .bb-note {
        font-size: 10px !important;
        line-height: 1.35 !important;
      }
      .bb-signatures {
        gap: 12px !important;
      }
      .bb-sign-head {
        padding: 6px 10px !important;
        font-size: 12px !important;
      }
      .bb-sign-party {
        padding: 6px 10px !important;
        font-size: 12px !important;
      }
      .bb-sign-line {
        padding: 0 10px !important;
      }
      .bb-sign-line span {
        font-size: 10px !important;
      }
      .bb-sign-fill {
        min-height: 38px !important;
      }
      .bb-sign-fill-lg {
        min-height: 72px !important;
      }
      .signature-section {
        display: grid;
        gap: 18px;
      }
      .signature-card {
        margin-top: 18px;
        padding: 22px 24px;
        border: 1px solid var(--proposal-border);
        border-radius: 20px;
        background: white;
      }
      .signature-party {
        margin: 0 0 18px;
        color: var(--proposal-primary);
        font-size: 18px;
        font-weight: 700;
      }
      .signature-grid {
        display: grid;
        gap: 14px;
      }
      .signature-line {
        display: grid;
        gap: 8px;
      }
      .signature-line span {
        color: var(--proposal-muted);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .signature-fill {
        min-height: 34px;
        border-bottom: 1.5px solid #bca89a;
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
        html,
        body {
          margin: 0;
          padding: 0;
          background: white;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .proposal-shell { box-shadow: none; border-radius: 0; }
        .bb-doc {
          gap: 0 !important;
        }
        .bb-front,
        .bb-contract {
          padding: 28px 36px 34px !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }
        .bb-top {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          align-items: center !important;
          justify-items: center !important;
        }
        .bb-brand,
        .bb-date,
        .bb-created {
          text-align: center !important;
          justify-self: center !important;
        }
        .bb-summary {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          text-align: center !important;
        }
        .bb-grid {
          grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr) !important;
        }
        .bb-gallery-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
        .bb-sign-meta {
          grid-template-columns: minmax(0, 1fr) 140px !important;
        }
        .bb-table {
          table-layout: fixed !important;
        }
        .bb-table th,
        .bb-table td {
          display: table-cell !important;
          width: 33.333% !important;
        }
        .compact-starter-header {
          grid-template-columns: minmax(0, 1.1fr) minmax(200px, 0.9fr) !important;
        }
        .compact-line-items-table-head,
        .compact-line-item {
          grid-template-columns: minmax(0, 1.6fr) 52px 74px 88px !important;
        }
        .immersive-line-item {
          grid-template-columns: minmax(0, 1fr) 200px !important;
        }
        .immersive-line-item.image-left {
          grid-template-columns: 200px minmax(0, 1fr) !important;
        }
        .immersive-line-item.no-media,
        .immersive-line-item.no-media.image-left,
        .immersive-line-item.no-media.image-right {
          grid-template-columns: 1fr !important;
        }
      }
    `;
  }

  private renderHeader(contract: FloralProposalRenderContract): string {
    return this.renderProposalEventHeader(
      contract,
      contract.template.name || 'Floral Proposal'
    );
  }

  private renderProposalEventHeader(
    contract: FloralProposalRenderContract,
    overline: string
  ): string {
    const detailRows = this.getProposalHeaderDetailRows(contract);
    const contactLine = this.renderProposalHeaderContactLine(contract);

    return `
      <section class="proposal-event-header">
        <p class="proposal-event-overline">${this.escapeHtml(overline)}</p>
        <h2 class="proposal-event-couple">${this.escapeHtml(this.formatProposalHeaderPrimaryNames(contract))}</h2>
        <p class="proposal-event-service">
          ${this.escapeHtml(this.formatDisplay(contract.lead.service_type, 'Event Floral Services'))}
        </p>
        ${contactLine}
        <div class="proposal-event-details">
          ${detailRows
            .map(
              (row) => `
                <p class="proposal-event-detail-row">
                  <span class="proposal-event-detail-label">${this.escapeHtml(row.label)}:</span>
                  <span class="proposal-event-detail-value">${this.escapeHtml(row.value)}</span>
                </p>
              `
            )
            .join('')}
        </div>
      </section>
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

  private renderLineItemsSection(
    contract: FloralProposalRenderContract,
    style?: 'compact' | 'alternating' | null
  ): string {
    const explicitStyle = style?.toLowerCase();
    if (explicitStyle === 'alternating') {
      return this.renderAlternatingLineItemsSection(contract);
    }

    if (explicitStyle === 'compact') {
      return this.renderCompactLineItemsSection(contract);
    }

    const lineLayout = contract.template.line_item_layout || 'stacked';
    return lineLayout === 'stacked'
      ? this.renderCompactLineItemsSection(contract)
      : this.renderAlternatingLineItemsSection(contract);
  }

  private renderCompactLineItemsSection(contract: FloralProposalRenderContract): string {
    return `
      <section class="line-items compact-line-items-shell">
        <div class="compact-line-items">
          <div class="compact-line-items-header">
            <div>
              <div class="compact-line-items-kicker">Selections</div>
              <h3 class="compact-line-items-title">Floral Line Items</h3>
            </div>
            <div class="compact-line-items-count">${contract.line_items.length} items</div>
          </div>
          <div class="compact-line-items-table">
            <div class="compact-line-items-table-head">
              <span>Arrangement</span>
              <span>Qty</span>
              <span>Unit</span>
              <span>Subtotal</span>
            </div>
            ${contract.line_items
              .map((line) => this.renderCompactLineItem(line))
              .join('')}
          </div>
        </div>
      </section>
    `;
  }

  private renderCompactLineItem(line: FloralProposalRenderLineItem): string {
    const floralDetails = this.renderLineItemFloralDetails(line);

    return `
      <article class="compact-line-item">
        <div class="compact-line-item-main">
          <div class="compact-line-item-heading-row">
            <span class="compact-line-item-type">${this.escapeHtml(line.line_type_label)}</span>
            ${floralDetails ? `<span class="compact-line-item-florals">${floralDetails}</span>` : ''}
          </div>
          <h3 class="compact-line-item-title">${this.escapeHtml(line.item_name)}</h3>
          ${
            line.description
              ? `<p class="compact-line-item-description">${this.escapeHtml(line.description)}</p>`
              : ''
          }
        </div>
        <div class="compact-line-item-qty">Qty ${this.formatQuantity(line.quantity)}</div>
        <div class="compact-line-item-unit">${this.formatCurrency(line.unit_price)}</div>
        <div class="compact-line-item-subtotal">${this.formatCurrency(line.subtotal)}</div>
      </article>
    `;
  }

  private renderAlternatingLineItemsSection(contract: FloralProposalRenderContract): string {
    const shouldInsertPageSpacer = contract.line_items.length > 3;
    const lineItemsMarkup = contract.line_items
      .map((line, index) => {
        const itemNumber = index + 1;
        const shouldRenderSpacer =
          shouldInsertPageSpacer &&
          itemNumber < contract.line_items.length &&
          (itemNumber === 3 || (itemNumber > 3 && (itemNumber - 3) % 4 === 0));
        const spacerHtml = shouldRenderSpacer
          ? '<div class="immersive-line-item-page-spacer" aria-hidden="true"></div>'
          : '';

        return `${this.renderAlternatingLineItem(line, index)}${spacerHtml}`;
      })
      .join('');

    return `
      <section class="line-items immersive-line-items">
        ${lineItemsMarkup}
      </section>
    `;
  }

  private renderAlternatingLineItem(
    line: FloralProposalRenderLineItem,
    index: number
  ): string {
    const imageOnRight = index % 2 === 0;
    const hasImage = !!line.image_signed_url;
    const mediaHtml = hasImage
      ? `
        <div class="immersive-line-item-media">
          <img src="${line.image_signed_url}" alt="${this.escapeHtml(
            line.image_alt_text || line.item_name
          )}" />
        </div>
      `
      : '';

    const copyHtml = `
      <div class="immersive-line-item-copy">
        <div class="immersive-line-item-heading">
          <div>
            <span class="immersive-line-item-type">${this.escapeHtml(line.line_type_label)}</span>
            <h3 class="immersive-line-item-title">${this.escapeHtml(line.item_name)}</h3>
            ${
              line.description
                ? `<p class="immersive-line-item-florals">${this.escapeHtml(line.description)}</p>`
                : ''
            }
          </div>
          <div class="immersive-line-item-pricing">
            <span>Qty ${this.formatQuantity(line.quantity)}</span>
            <span>Unit ${this.formatCurrency(line.unit_price)}</span>
            <strong>${this.formatCurrency(line.subtotal)}</strong>
          </div>
        </div>
      </div>
    `;

    return `
      <article class="immersive-line-item${imageOnRight ? ' image-right' : ' image-left'}${
        hasImage ? '' : ' no-media'
      }">
        ${
          hasImage
            ? imageOnRight
              ? `${copyHtml}${mediaHtml}`
              : `${mediaHtml}${copyHtml}`
            : copyHtml
        }
      </article>
    `;
  }

  private renderCompactStarterHeader(contract: FloralProposalRenderContract): string {
    return this.renderProposalEventHeader(contract, 'Black Begonia Floral Proposal');
  }

  private renderCompactStarterIntro(contract: FloralProposalRenderContract): string {
    return `
      <section class="compact-starter-intro">
        <p>
          Prepared for ${this.escapeHtml(this.formatCustomerName(contract))}. Proposal images display to the right while pricing and floral selections remain condensed below.
        </p>
      </section>
    `;
  }

  private renderCompactStarterLineItems(
    contract: FloralProposalRenderContract,
    style?: 'compact' | 'alternating' | null
  ): string {
    return this.renderLineItemsSection(contract, style);
  }

  private renderTotals(
    contract: FloralProposalRenderContract,
    compact = false
  ): string {
    return `
      <section class="totals-card${compact ? ' compact' : ''}">
        <p class="proposal-eyebrow">Pricing</p>
        <h2 class="section-title" style="font-size:30px;">Investment</h2>
        <div class="totals-row"><span>Products</span><span>${this.formatCurrency(contract.totals.products_total)}</span></div>
        <div class="totals-row"><span>Labor</span><span>${this.formatCurrency(contract.totals.labor_total)}</span></div>
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
      sections.push(this.renderContractEventDetailsSection(contract));
      sections.push(this.renderPaymentTermsSection(contract));
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
      sections.push(this.renderSignatureSection(contract));
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

  private renderContractEventDetailsSection(contract: FloralProposalRenderContract): string {
    return `
      <section class="agreement-section">
        <p class="proposal-eyebrow">Contract</p>
        <h2 class="section-title">1. Event Details</h2>
        <table class="contract-table">
          <tbody>
            <tr>
              <th>Reception Type</th>
              <td><span class="contract-field">${this.escapeHtml(this.formatDisplay(contract.lead.service_type, 'Not set'))}</span></td>
            </tr>
            <tr>
              <th>Event Date</th>
              <td><span class="contract-field">${this.escapeHtml(this.formatContractDate(contract.lead.event_date))}</span></td>
            </tr>
            <tr>
              <th>Delivery & Setup Location</th>
              <td><span class="contract-field">${this.escapeHtml(this.formatDeliverySetupLocation(contract))}</span></td>
            </tr>
          </tbody>
        </table>
      </section>
    `;
  }

  private renderPaymentTermsSection(contract: FloralProposalRenderContract): string {
    return `
      <section class="agreement-section">
        <p class="proposal-eyebrow">Contract</p>
        <h2 class="section-title">4. Payment Terms</h2>
        <table class="contract-table">
          <tbody>
            <tr>
              <th>Retainer</th>
              <td>A signed contract and non-refundable retainer are required to reserve the event date.</td>
            </tr>
            <tr>
              <th>Final Balance Due Date</th>
              <td><span class="contract-field">${this.escapeHtml(this.formatFinalBalanceDueDate(contract.lead.event_date))}</span></td>
            </tr>
            <tr>
              <th>Late Payments</th>
              <td>Any payment received after the due date may delay production, delivery scheduling, or event execution.</td>
            </tr>
          </tbody>
        </table>
      </section>
    `;
  }

  private renderSignatureSection(contract: FloralProposalRenderContract): string {
    return `
      <section class="agreement-section signature-section">
        <p class="proposal-eyebrow">Acceptance</p>
        <h2 class="section-title">Signature & Acceptance</h2>
        <div class="signature-card">
          <p class="signature-party">Black Begonia Floral Design, LLC</p>
          <div class="signature-grid">
            <div class="signature-line">
              <span>Signature</span>
              <div class="signature-fill"></div>
            </div>
            <div class="signature-line">
              <span>Printed Name</span>
              <div class="signature-fill"></div>
            </div>
            <div class="signature-line">
              <span>Date</span>
              <div class="signature-fill"></div>
            </div>
          </div>
        </div>
        <div class="signature-card">
          <p class="signature-party">${this.escapeHtml(this.formatCustomerName(contract))}</p>
          <div class="signature-grid">
            <div class="signature-line">
              <span>Signature</span>
              <div class="signature-fill"></div>
            </div>
            <div class="signature-line">
              <span>Printed Name</span>
              <div class="signature-fill"></div>
            </div>
            <div class="signature-line">
              <span>Date</span>
              <div class="signature-fill"></div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  private renderLineItemFloralDetails(line: FloralProposalRenderLineItem): string {
    const colors = Array.from(
      new Set(
        line.components
          .map((component) => component.snapshot?.['color'])
          .filter((value): value is string => typeof value === 'string' && !!value.trim())
          .map((value) => value.trim())
      )
    );
    const varieties = Array.from(
      new Set(
        line.components
          .map((component) => component.snapshot?.['variety'])
          .filter((value): value is string => typeof value === 'string' && !!value.trim())
          .map((value) => value.trim())
      )
    );

    const parts = [
      varieties.length ? varieties.join(', ') : '',
      colors.length ? colors.join(', ') : '',
    ].filter((value) => !!value);

    return this.escapeHtml(parts.join(' | '));
  }

  private formatProposalHeaderPrimaryNames(contract: FloralProposalRenderContract): string {
    const customerName = this.formatCustomerName(contract);
    const partnerName = this.formatPartnerName(contract);

    return partnerName ? `${customerName} & ${partnerName}` : customerName;
  }

  private formatPartnerName(contract: FloralProposalRenderContract): string {
    const name = `${contract.lead.partner_first_name ?? ''} ${contract.lead.partner_last_name ?? ''}`.trim();
    return name;
  }

  private getProposalHeaderDetailRows(
    contract: FloralProposalRenderContract
  ): Array<{ label: string; value: string }> {
    const serviceType = this.normalizeServiceType(contract.lead.service_type);

    if (this.isFullServiceWedding(serviceType)) {
      return [
        {
          label: 'Ceremony Venue',
          value: this.formatCeremonyLocation(contract),
        },
        {
          label: 'Ceremony Start',
          value: this.formatEventTime(contract.lead.ceremony_start_time),
        },
        {
          label: 'Reception Venue',
          value: this.formatReceptionLocation(contract),
        },
        {
          label: 'Reception Start',
          value: this.formatEventTime(contract.lead.reception_start_time),
        },
      ];
    }

    if (this.isCeremonyOnlyWedding(serviceType)) {
      return [
        {
          label: 'Venue',
          value: this.formatCeremonyLocation(contract),
        },
        {
          label: 'Ceremony Start',
          value: this.formatEventTime(contract.lead.ceremony_start_time),
        },
      ];
    }

    if (this.isReceptionOnlyWedding(serviceType)) {
      return [
        {
          label: 'Venue',
          value: this.formatReceptionLocation(contract),
        },
        {
          label: 'Reception Start',
          value: this.formatEventTime(contract.lead.reception_start_time),
        },
      ];
    }

    return [
      {
        label: 'Venue',
        value: this.formatPreferredEventLocation(contract),
      },
      {
        label: 'Start Time',
        value: this.formatEventTime(
          contract.lead.event_start_time ??
            contract.lead.ceremony_start_time ??
            contract.lead.reception_start_time
        ),
      },
    ];
  }

  private renderProposalHeaderContactLine(contract: FloralProposalRenderContract): string {
    const contactValues = [
      this.formatPhoneNumber(contract.lead.phone),
      contract.lead.email?.trim(),
    ].filter((value): value is string => !!value);

    if (!contactValues.length) {
      return '';
    }

    return `
      <div class="proposal-event-contact">
        ${contactValues
          .map((value, index) =>
            `${index > 0 ? '<span class="proposal-event-contact-divider"></span>' : ''}<span>${this.escapeHtml(value)}</span>`
          )
          .join('')}
      </div>
    `;
  }

  private formatPreferredEventLocation(contract: FloralProposalRenderContract): string {
    return this.formatCeremonyLocation(contract) !== 'Location to be confirmed'
      ? this.formatCeremonyLocation(contract)
      : this.formatReceptionLocation(contract);
  }

  private formatCeremonyLocation(contract: FloralProposalRenderContract): string {
    return this.formatVenueLocation(
      contract.lead.ceremony_venue_name,
      contract.lead.ceremony_venue_city,
      contract.lead.ceremony_venue_state
    );
  }

  private formatReceptionLocation(contract: FloralProposalRenderContract): string {
    return this.formatVenueLocation(
      contract.lead.reception_venue_name,
      contract.lead.reception_venue_city,
      contract.lead.reception_venue_state
    );
  }

  private formatVenueLocation(
    venueName?: string | null,
    venueCity?: string | null,
    venueState?: string | null
  ): string {
    const parts = [venueName, venueCity, venueState]
      .map((value) => value?.trim() ?? '')
      .filter((value) => !!value);

    return parts.join(', ') || 'Location to be confirmed';
  }

  private normalizeServiceType(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase().replace(/[_\s]+/g, ' ');
  }

  private isCeremonyOnlyWedding(serviceType: string): boolean {
    return serviceType.includes('ceremony-only') || serviceType.includes('ceremony only');
  }

  private isReceptionOnlyWedding(serviceType: string): boolean {
    return serviceType.includes('reception-only') || serviceType.includes('reception only');
  }

  private isFullServiceWedding(serviceType: string): boolean {
    return serviceType.includes('full service');
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value ?? 0);
  }

  private formatQuantity(value: number): string {
    if (Number.isInteger(value)) {
      return String(value);
    }

    return Number(value ?? 0).toFixed(2).replace(/\.?0+$/, '');
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

  private formatShortDate(value: string | null | undefined): string {
    if (!value) return 'Not set';

    return new Intl.DateTimeFormat('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  }

  private formatContractDate(value: string | null | undefined): string {
    if (!value) return 'To be confirmed';

    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  }

  private formatEventTime(value: string | null | undefined): string {
    if (!value) {
      return 'Time to be confirmed';
    }

    const [hoursString, minutesString = '00'] = value.split(':');
    const hours = Number(hoursString);
    const minutes = Number(minutesString);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return 'Time to be confirmed';
    }

    const normalizedHour = ((hours + 11) % 12) + 1;
    const meridiem = hours >= 12 ? 'PM' : 'AM';
    return `${normalizedHour}:${minutes.toString().padStart(2, '0')} ${meridiem}`;
  }

  private formatPhoneNumber(value: string | null | undefined): string {
    const trimmed = value?.trim() ?? '';

    if (!trimmed) {
      return '';
    }

    const digits = trimmed.replace(/\D/g, '');
    const normalizedDigits = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;

    if (normalizedDigits.length !== 10) {
      return trimmed;
    }

    const areaCode = normalizedDigits.slice(0, 3);
    const prefix = normalizedDigits.slice(3, 6);
    const lineNumber = normalizedDigits.slice(6);

    return `(${areaCode}) ${prefix}-${lineNumber}`;
  }

  private formatFinalBalanceDueDate(value: string | null | undefined): string {
    if (!value) return '30 days prior to event';

    const date = new Date(value);
    date.setDate(date.getDate() - 30);
    return this.formatContractDate(date.toISOString());
  }

  private formatDeliverySetupLocation(contract: FloralProposalRenderContract): string {
    const parts = [
      contract.lead.reception_venue_name,
      [contract.lead.reception_venue_city, contract.lead.reception_venue_state]
        .filter((part) => !!part)
        .join(', '),
    ].filter((part) => !!part);

    return parts.length ? parts.join(' - ') : 'To be confirmed';
  }

  private formatEventLocationCityState(contract: FloralProposalRenderContract): string {
    const location = [contract.lead.reception_venue_city, contract.lead.reception_venue_state]
      .filter((part) => !!part)
      .join(', ');

    return location || 'Location to be confirmed';
  }

  private formatEventType(contract: FloralProposalRenderContract): string {
    return this.formatDisplay(contract.lead.event_type || contract.lead.service_type, 'Not set');
  }

  private formatCustomerName(contract: FloralProposalRenderContract): string {
    const name = `${contract.lead.first_name ?? ''} ${contract.lead.last_name ?? ''}`.trim();
    return name || 'Customer Name';
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
