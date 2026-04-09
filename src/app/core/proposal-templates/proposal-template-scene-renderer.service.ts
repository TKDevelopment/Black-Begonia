import { Injectable } from '@angular/core';

import {
  DocumentTemplate,
  FloralProposalRenderContract,
} from '../models/floral-proposal';
import {
  ProposalTemplateDocument,
  ProposalTemplateTableCell,
  ProposalTemplateTableNode,
  ProposalTemplateNode,
  ProposalTemplatePage,
  ProposalTemplatePreviewData,
  ProposalTemplatePreviewLineItem,
  ProposalTemplateRepeaterChildNode,
  ProposalTemplateRepeaterNode,
  ProposalTemplateTheme,
  ProposalTemplateTotalsNode,
} from './proposal-template-document.models';
import { ProposalTemplateDocumentService } from './proposal-template-document.service';

interface MaterializedDynamicPage {
  page: ProposalTemplatePage;
  repeater: ProposalTemplateRepeaterNode;
  items: ProposalTemplatePreviewLineItem[];
  showTotals: boolean;
  totalsNode: ProposalTemplateTotalsNode | null;
}

@Injectable({ providedIn: 'root' })
export class ProposalTemplateSceneRendererService {
  constructor(
    private readonly documentService: ProposalTemplateDocumentService
  ) {}

  render(contract: FloralProposalRenderContract): string {
    const templateAdapter: DocumentTemplate = {
      template_id: contract.template.template_id ?? 'scene-renderer',
      name: contract.template.name ?? 'Proposal Template',
      template_key: contract.template.template_key ?? 'proposal-template',
      template_kind: 'floral_proposal',
      is_active: true,
      is_default: false,
      logo_storage_path: null,
      logo_url: contract.template.logo_url ?? null,
      template_config: contract.template.template_config ?? {},
      created_at: contract.generated_at,
      updated_at: contract.generated_at,
    };
    const document = this.documentService.getPublishedDocument(templateAdapter);
    const previewData = this.buildPreviewDataFromContract(contract, document);
    const renderedPages = this.renderDocumentPages(document, previewData);

    return `
      <html>
        <head>
          <title>${this.escapeHtml(contract.template.name || document.name)}</title>
          <style>
            @page {
              size: 8.5in 11in;
              margin: 0;
            }

            * {
              box-sizing: border-box;
            }

            html, body {
              margin: 0;
              padding: 0;
              background: ${document.theme.canvasColor};
              font-family: ${document.theme.bodyFontFamily};
            }

            body {
              padding: 18px 0;
            }

            .bb-scene-document {
              display: grid;
              gap: 18px;
              justify-content: center;
            }

            .bb-scene-page {
              position: relative;
              overflow: hidden;
              break-after: page;
              page-break-after: always;
              box-shadow: 0 18px 50px rgba(17, 11, 8, 0.08);
            }

            .bb-scene-page:last-child {
              break-after: auto;
              page-break-after: auto;
            }

            .bb-node-text {
              white-space: pre-wrap;
            }

            .bb-node-image img {
              width: 100%;
              height: 100%;
              display: block;
            }

            .bb-repeater-row {
              position: absolute;
              left: 0;
              right: 0;
            }

            .bb-repeater-header {
              position: absolute;
              left: 0;
              right: 0;
              display: flex;
              align-items: center;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              font-size: 11px;
              font-weight: 700;
            }

            .bb-totals-card {
              display: grid;
            }

            .bb-totals-row {
              display: flex;
              justify-content: space-between;
              gap: 16px;
            }
          </style>
        </head>
        <body>
          <div class="bb-scene-document">
            ${renderedPages.join('')}
          </div>
        </body>
      </html>
    `;
  }

  private buildPreviewDataFromContract(
    contract: FloralProposalRenderContract,
    document: ProposalTemplateDocument
  ): ProposalTemplatePreviewData {
    const total = Number(contract.totals.total_amount ?? 0);
    const subtotal = Number(contract.totals.subtotal ?? 0);
    const tax = Number(contract.totals.tax_amount ?? 0);
    const deposit = total > 0 ? total * 0.5 : 0;
    const balance = total - deposit;
    const venueName =
      contract.lead.reception_venue_name ??
      contract.lead.ceremony_venue_name ??
      'Venue to be confirmed';
    const venueAddress = [
      contract.lead.reception_venue_city ?? contract.lead.ceremony_venue_city,
      contract.lead.reception_venue_state ?? contract.lead.ceremony_venue_state,
    ]
      .filter((value): value is string => Boolean(value))
      .join(', ');

    return {
      values: {
        'client.full_name': this.formatFullName(
          contract.lead.first_name,
          contract.lead.last_name
        ),
        'client.email': contract.lead.email ?? '',
        'client.phone': this.formatPhone(contract.lead.phone),
        'event.date': this.formatDate(contract.lead.event_date),
        'event.venue_name': venueName,
        'event.venue_address': venueAddress || 'Venue to be confirmed',
        'event.type': contract.lead.event_type || contract.lead.service_type,
        'proposal.number':
          contract.proposal_version != null
            ? `BB-${String(contract.proposal_version).padStart(4, '0')}`
            : 'BB-0001',
        'proposal.created_date': this.formatDate(contract.generated_at),
        'pricing.subtotal': this.formatCurrency(subtotal),
        'pricing.tax_amount': this.formatCurrency(tax),
        'pricing.total': this.formatCurrency(total),
        'pricing.deposit_amount': this.formatCurrency(deposit),
        'pricing.balance_due': this.formatCurrency(balance),
        'brand.business_name': 'Black Begonia Floral Design',
        'brand.email': 'hello@blackbegonia.com',
        'brand.phone': '(401) 555-0199',
        'brand.website': 'blackbegonia.com',
        'brand.logo_url': contract.template.logo_url ?? '',
        'item.name': document.name,
        'item.description': '',
        'item.quantity': '1',
        'item.unit_price': this.formatCurrency(total),
        'item.total': this.formatCurrency(total),
      },
      lineItems: contract.line_items.map((line) => ({
        name: line.item_name,
        description: line.description ?? '',
        quantity: this.formatQuantity(line.quantity),
        unit_price: this.formatCurrency(line.unit_price),
        total: this.formatCurrency(line.subtotal),
        line_type: line.line_type_label,
        image_url: line.image_signed_url ?? null,
      })),
      totals: {
        subtotal: this.formatCurrency(subtotal),
        tax: this.formatCurrency(tax),
        total: this.formatCurrency(total),
        deposit: this.formatCurrency(deposit),
        balance: this.formatCurrency(balance),
      },
    };
  }

  private renderDocumentPages(
    document: ProposalTemplateDocument,
    previewData: ProposalTemplatePreviewData
  ): string[] {
    const pages: string[] = [];

    document.pages.forEach((page) => {
      if (page.kind === 'continuation-template') {
        return;
      }

      if (page.kind === 'dynamic-repeatable') {
        const continuationTemplate =
          document.pages.find(
            (candidate) =>
              candidate.kind === 'continuation-template' &&
              candidate.continuationSourcePageId === page.id
          ) ?? page;
        const totalsNode =
          page.nodes.find((node) => node.type === 'totals') as ProposalTemplateTotalsNode | undefined;
        const repeater =
          page.nodes.find((node) => node.type === 'repeater') as ProposalTemplateRepeaterNode | undefined;

        if (!repeater) {
          pages.push(this.renderStaticPage(page, document.theme, previewData));
          return;
        }

        pages.push(
          ...this.renderDynamicPages(
            page,
            continuationTemplate,
            repeater,
            totalsNode ?? null,
            document.theme,
            previewData
          )
        );
        return;
      }

      pages.push(this.renderStaticPage(page, document.theme, previewData));
    });

    return pages;
  }

  private renderDynamicPages(
    sourcePage: ProposalTemplatePage,
    continuationTemplate: ProposalTemplatePage,
    sourceRepeater: ProposalTemplateRepeaterNode,
    sourceTotalsNode: ProposalTemplateTotalsNode | null,
    theme: ProposalTemplateTheme,
    previewData: ProposalTemplatePreviewData
  ): string[] {
    const pages: string[] = [];
    const remainingItems = [...previewData.lineItems];
    let renderedAnyItems = false;

    while (remainingItems.length > 0 || !renderedAnyItems) {
      const currentPage = renderedAnyItems ? continuationTemplate : sourcePage;
      const currentRepeater =
        (currentPage.nodes.find(
          (node) => node.type === 'repeater'
        ) as ProposalTemplateRepeaterNode | undefined) ?? sourceRepeater;
      const maxRows = Math.max(1, this.getRepeaterCapacity(currentRepeater));
      let rowCount = Math.min(maxRows, remainingItems.length || maxRows);
      const wouldFinish = rowCount >= remainingItems.length;

      if (wouldFinish && sourceTotalsNode) {
        while (rowCount > 0 && !this.totalsFit(currentPage, currentRepeater, sourceTotalsNode, rowCount)) {
          rowCount -= 1;
        }
      }

      if (rowCount === 0 && remainingItems.length > 0) {
        rowCount = Math.min(maxRows, remainingItems.length);
      }

      const pageItems = remainingItems.splice(0, rowCount);
      const showTotals = remainingItems.length === 0;

      pages.push(
        this.renderDynamicPageHtml(
          {
            page: currentPage,
            repeater: currentRepeater,
            items: pageItems,
            showTotals,
            totalsNode: showTotals ? sourceTotalsNode : null,
          },
          theme,
          previewData
        )
      );

      renderedAnyItems = true;

      if (!remainingItems.length) {
        break;
      }
    }

    if (!renderedAnyItems) {
      pages.push(this.renderStaticPage(sourcePage, theme, previewData));
    }

    return pages;
  }

  private renderDynamicPageHtml(
    materializedPage: MaterializedDynamicPage,
    theme: ProposalTemplateTheme,
    previewData: ProposalTemplatePreviewData
  ): string {
    const { page, repeater, items, showTotals, totalsNode } = materializedPage;
    const staticNodes = page.nodes.filter(
      (node) => node.type !== 'repeater' && node.type !== 'totals'
    );
    const repeaterHtml = this.renderRepeater(repeater, items, previewData, theme);
    const totalsHtml =
      showTotals && totalsNode
        ? this.renderTotalsNode(
            totalsNode,
            previewData,
            repeater.y + this.getRepeaterContentHeight(repeater, items.length) + 28,
            theme
          )
        : '';

    return this.wrapPage(
      page,
      theme,
      [
        ...staticNodes.map((node) => this.renderNode(node, previewData, theme)),
        repeaterHtml,
        totalsHtml,
      ].join('')
    );
  }

  private renderStaticPage(
    page: ProposalTemplatePage,
    theme: ProposalTemplateTheme,
    previewData: ProposalTemplatePreviewData
  ): string {
    return this.wrapPage(
      page,
      theme,
      page.nodes.map((node) => this.renderNode(node, previewData, theme)).join('')
    );
  }

  private wrapPage(
    page: ProposalTemplatePage,
    theme: ProposalTemplateTheme,
    content: string
  ): string {
    return `
      <section
        class="bb-scene-page"
        style="
          width:${page.width}px;
          height:${page.height}px;
          background:${page.background?.fill ?? theme.pageColor};
          color:${theme.primaryColor};
        "
      >
        ${content}
      </section>
    `;
  }

  private renderNode(
    node: ProposalTemplateNode,
    previewData: ProposalTemplatePreviewData,
    theme: ProposalTemplateTheme
  ): string {
    const baseStyle = `
      position:absolute;
      left:${node.x}px;
      top:${node.y}px;
      width:${node.width}px;
      height:${node.height}px;
      opacity:${node.opacity};
      transform:rotate(${node.rotation}deg);
      z-index:${node.zIndex};
      ${node.visible ? '' : 'display:none;'}
    `;

    switch (node.type) {
      case 'shape':
        return `<div style="${baseStyle}background:${node.fill};border:${node.strokeWidth}px ${node.strokeStyle ?? 'solid'} ${node.stroke};border-radius:${node.shapeKind === 'ellipse' ? '999px' : `${node.cornerRadius}px`};"></div>`;
      case 'divider':
        return `<div style="${baseStyle}border-top:${node.strokeWidth}px ${node.dashed ? 'dashed' : 'solid'} ${node.stroke};"></div>`;
      case 'table':
        return this.renderTableNode(node, previewData, baseStyle);
      case 'image': {
        const source = node.source === 'binding'
          ? previewData.values[node.bindingKey ?? ''] ?? ''
          : node.url ?? '';
        if (!source) {
          return `<div class="bb-node-image" style="${baseStyle}border:1px dashed ${theme.borderColor};border-radius:${node.cornerRadius}px;background:${theme.primaryColor}05;"></div>`;
        }
        return `<div class="bb-node-image" style="${baseStyle}overflow:hidden;border-radius:${node.cornerRadius}px;"><img src="${this.escapeHtml(source)}" alt="${this.escapeHtml(node.alt)}" style="object-fit:${node.fit};" /></div>`;
      }
      case 'rich-text':
        return `
          <div
            class="bb-node-text"
            style="${baseStyle}font-family:${node.fontFamily};font-size:${node.fontSize}px;font-weight:${node.fontWeight};font-style:${node.fontStyle ?? 'normal'};line-height:${node.lineHeight};letter-spacing:${node.letterSpacing}px;color:${node.color};text-align:${node.align};text-transform:${node.textTransform ?? 'none'};text-decoration:${this.getTextDecoration(node)};"
          >${this.escapeHtml(this.documentService.formatTextForDisplay(this.documentService.renderSegments(node.content, previewData, 'sample'), node.listStyle ?? 'none'))}</div>
        `;
      case 'totals':
        return this.renderTotalsNode(node, previewData, node.y, theme);
      case 'repeater':
        return '';
      case 'group':
      default:
        return '';
    }
  }

  private renderTableNode(
    node: ProposalTemplateTableNode,
    previewData: ProposalTemplatePreviewData,
    baseStyle: string
  ): string {
    const cellsHtml = node.cells
      .map((cell) => this.renderTableCell(cell, previewData))
      .join('');

    return `
      <section
        class="bb-table-node"
        style="${baseStyle}display:grid;grid-template-columns:repeat(${node.columns}, minmax(0, 1fr));grid-template-rows:repeat(${node.rows}, minmax(0, 1fr));overflow:hidden;"
      >
        ${cellsHtml}
      </section>
    `;
  }

  private renderTableCell(
    cell: ProposalTemplateTableCell,
    previewData: ProposalTemplatePreviewData
  ): string {
    const contentHtml =
      cell.content.kind === 'text'
        ? `
          <div
            style="
              width:100%;
              white-space:pre-wrap;
              overflow-wrap:anywhere;
              color:${cell.content.color};
              font-family:${cell.content.fontFamily};
              font-size:${cell.content.fontSize}px;
              font-weight:${cell.content.fontWeight};
              font-style:${cell.content.fontStyle ?? 'normal'};
              line-height:${cell.content.lineHeight};
              letter-spacing:${cell.content.letterSpacing}px;
              text-align:${cell.content.align};
              text-transform:${cell.content.textTransform ?? 'none'};
              text-decoration:${this.getTextDecoration(cell.content)};
            "
          >${this.escapeHtml(this.documentService.formatTextForDisplay(this.documentService.renderSegments(cell.content.content, previewData, 'sample'), cell.content.listStyle ?? 'none'))}</div>
        `
        : `<div style="width:100%;min-height:1em;"></div>`;

    return `
      <div
        style="
          grid-column:${cell.column + 1};
          grid-row:${cell.row + 1};
          display:flex;
          align-items:stretch;
          justify-content:stretch;
          min-width:0;
          min-height:0;
          overflow:hidden;
          padding:${cell.padding}px;
          background:${cell.background};
          border:${cell.strokeWidth}px solid ${cell.stroke};
        "
      >
        ${contentHtml}
      </div>
    `;
  }

  private renderRepeater(
    repeater: ProposalTemplateRepeaterNode,
    items: ProposalTemplatePreviewLineItem[],
    previewData: ProposalTemplatePreviewData,
    theme: ProposalTemplateTheme
  ): string {
    const headerHtml = repeater.showHeader
      ? `
        <div
          class="bb-repeater-header"
          style="
            top:0;
            height:${repeater.headerHeight}px;
            background:${repeater.headerBackground};
            color:${repeater.headerTextColor};
            border-bottom:${repeater.borderWidth}px solid ${repeater.borderColor};
            padding:0 18px;
          "
        >
          ${repeater.headerColumns
            .map(
              (column) => `
                <div style="width:${column.width}px;text-align:${column.align};">
                  ${this.escapeHtml(column.label)}
                </div>
              `
            )
            .join('')}
        </div>
      `
      : '';

    const rowHeight = repeater.rowTemplate.minHeight;
    const rowsHtml = items
      .map((item, index) => {
        const rowTop =
          (repeater.showHeader ? repeater.headerHeight : 0) +
          index * (rowHeight + repeater.rowGap);
        return `
          <div
            class="bb-repeater-row"
            style="
              top:${rowTop}px;
              height:${rowHeight}px;
              background:${repeater.rowBackground};
              border-bottom:${repeater.borderWidth}px solid ${repeater.borderColor};
            "
          >
            ${repeater.rowTemplate.nodes
              .map((childNode) =>
                this.renderRepeaterChildNode(childNode, item, previewData, theme)
              )
              .join('')}
          </div>
        `;
      })
      .join('');

    return `
      <section
        style="
          position:absolute;
          left:${repeater.x}px;
          top:${repeater.y}px;
          width:${repeater.width}px;
          height:${repeater.height}px;
          border:${repeater.borderWidth}px solid ${repeater.borderColor};
          background:${repeater.background};
          overflow:hidden;
          border-radius:24px;
          z-index:${repeater.zIndex};
        "
      >
        ${headerHtml}
        ${rowsHtml}
      </section>
    `;
  }

  private renderRepeaterChildNode(
    childNode: ProposalTemplateRepeaterChildNode,
    item: ProposalTemplatePreviewLineItem,
    previewData: ProposalTemplatePreviewData,
    theme: ProposalTemplateTheme
  ): string {
    const scopedPreviewData: ProposalTemplatePreviewData = {
      ...previewData,
      values: {
        ...previewData.values,
        'item.name': item.name,
        'item.description': item.description,
        'item.quantity': item.quantity,
        'item.unit_price': item.unit_price,
        'item.total': item.total,
      },
    };
    const baseStyle = `
      position:absolute;
      left:${childNode.x}px;
      top:${childNode.y}px;
      width:${childNode.width}px;
      height:${childNode.height}px;
      z-index:${childNode.zIndex};
    `;

    switch (childNode.type) {
      case 'shape':
        return `<div style="${baseStyle}background:${childNode.fill};border:${childNode.strokeWidth}px ${childNode.strokeStyle ?? 'solid'} ${childNode.stroke};border-radius:${childNode.shapeKind === 'ellipse' ? '999px' : `${childNode.cornerRadius}px`};"></div>`;
      case 'divider':
        return `<div style="${baseStyle}border-top:${childNode.strokeWidth}px ${childNode.dashed ? 'dashed' : 'solid'} ${childNode.stroke};"></div>`;
      case 'rich-text':
      default:
        return `
          <div
            style="${baseStyle}white-space:pre-wrap;font-family:${childNode.fontFamily};font-size:${childNode.fontSize}px;font-weight:${childNode.fontWeight};font-style:${childNode.fontStyle ?? 'normal'};line-height:${childNode.lineHeight};letter-spacing:${childNode.letterSpacing}px;color:${childNode.color};text-align:${childNode.align};text-transform:${childNode.textTransform ?? 'none'};text-decoration:${this.getTextDecoration(childNode)};"
          >${this.escapeHtml(this.documentService.renderSegments(childNode.content, scopedPreviewData, 'sample'))}</div>
        `;
    }
  }

  private getTextDecoration(
    node: { underline?: boolean; strikethrough?: boolean }
  ): string {
    const lines = [
      node.underline ? 'underline' : '',
      node.strikethrough ? 'line-through' : '',
    ].filter(Boolean);

    return lines.length ? lines.join(' ') : 'none';
  }

  private renderTotalsNode(
    node: ProposalTemplateTotalsNode,
    previewData: ProposalTemplatePreviewData,
    computedTop: number,
    _theme: ProposalTemplateTheme
  ): string {
    const valueMap: Record<string, string> = {
      subtotal: previewData.totals.subtotal,
      tax: previewData.totals.tax,
      total: previewData.totals.total,
      deposit: previewData.totals.deposit,
      balance: previewData.totals.balance,
    };

    return `
      <section
        class="bb-totals-card"
        style="
          position:absolute;
          left:${node.x}px;
          top:${node.anchor === 'after-repeater' ? computedTop : node.y}px;
          width:${node.width}px;
          min-height:${node.height}px;
          padding:${node.padding}px;
          border:${node.borderWidth}px solid ${node.borderColor};
          border-radius:${node.radius}px;
          background:${node.background};
          color:${node.textColor};
          z-index:${node.zIndex};
          gap:${node.rowGap}px;
        "
      >
        <div style="font-family:inherit;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${node.accentColor};">
          ${this.escapeHtml(node.title)}
        </div>
        ${node.fields
          .map(
            (field) => `
              <div class="bb-totals-row" style="font-size:${field.emphasis ? 18 : 14}px;font-weight:${field.emphasis ? 700 : 500};padding-top:${field.emphasis ? 12 : 0}px;border-top:${field.emphasis ? `${node.borderWidth}px solid ${node.borderColor}` : '0'};">
                <span>${this.escapeHtml(field.label)}</span>
                <span>${this.escapeHtml(valueMap[field.key])}</span>
              </div>
            `
          )
          .join('')}
      </section>
    `;
  }

  private getRepeaterCapacity(repeater: ProposalTemplateRepeaterNode): number {
    const usableHeight =
      repeater.height - (repeater.showHeader ? repeater.headerHeight : 0);
    const rowHeight = repeater.rowTemplate.minHeight + repeater.rowGap;
    return Math.max(1, Math.floor((usableHeight + repeater.rowGap) / rowHeight));
  }

  private getRepeaterContentHeight(
    repeater: ProposalTemplateRepeaterNode,
    rowCount: number
  ): number {
    if (!rowCount) {
      return repeater.showHeader ? repeater.headerHeight : 0;
    }

    return (
      (repeater.showHeader ? repeater.headerHeight : 0) +
      rowCount * repeater.rowTemplate.minHeight +
      Math.max(0, rowCount - 1) * repeater.rowGap
    );
  }

  private totalsFit(
    page: ProposalTemplatePage,
    repeater: ProposalTemplateRepeaterNode,
    totalsNode: ProposalTemplateTotalsNode,
    rowCount: number
  ): boolean {
    const totalsTop =
      totalsNode.anchor === 'after-repeater'
        ? repeater.y + this.getRepeaterContentHeight(repeater, rowCount) + 28
        : totalsNode.y;

    return totalsTop + totalsNode.height <= page.height - 40;
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

  private formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'Date to be confirmed';
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  }

  private formatFullName(firstName?: string | null, lastName?: string | null): string {
    return `${firstName ?? ''} ${lastName ?? ''}`.trim() || 'Client Name';
  }

  private formatPhone(value: string | null | undefined): string {
    return value?.trim() ?? '';
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
