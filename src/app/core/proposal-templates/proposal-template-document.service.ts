import { Injectable } from '@angular/core';

import { DocumentTemplate } from '../models/floral-proposal';
import { resolveTemplateRendererKey } from './proposal-renderer-registry';
import { getProposalRendererStrategy } from './proposal-renderer-strategies';
import {
  applyTemplateServiceProfile,
  getTemplateServiceProfile,
} from './proposal-template-service-profile';
import {
  ProposalTemplateDocument,
  ProposalTemplateEditorAsset,
  ProposalTemplateEditorStoredConfig,
  ProposalTemplateCanvaImportSummary,
  ProposalTemplateEditorVersionEntry,
  ProposalTemplatePage,
  ProposalTemplatePlaceholderDefinition,
  ProposalTemplatePreviewData,
  ProposalTemplatePreviewTotals,
  ProposalTemplateRichTextSegment,
  ProposalTemplateTableCell,
  ProposalTemplateTableCellTextContent,
  ProposalTemplateTextListStyle,
  ProposalTemplateTheme,
} from './proposal-template-document.models';

const LETTER_WIDTH = 816;
const LETTER_HEIGHT = 1056;
const STORAGE_KEY = 'proposal_template_editor';
const VERSION_HISTORY_LIMIT = 24;

const STARTER_THEMES: Record<string, ProposalTemplateTheme> = {
  'romantic-editorial': {
    primaryColor: '#2c241f',
    accentColor: '#7c9453',
    canvasColor: '#efe6da',
    pageColor: '#fffdfa',
    borderColor: '#e8ddd2',
    mutedColor: '#6f635a',
    headingFontFamily: 'Cormorant Garamond, Georgia, serif',
    bodyFontFamily: 'Source Sans 3, Arial, sans-serif',
  },
  'garden-manor': {
    primaryColor: '#30251d',
    accentColor: '#8b9d6d',
    canvasColor: '#efe6da',
    pageColor: '#fffdfa',
    borderColor: '#e6ddd2',
    mutedColor: '#6f635a',
    headingFontFamily: 'Cormorant Garamond, Georgia, serif',
    bodyFontFamily: 'Source Sans 3, Arial, sans-serif',
  },
  'modern-botanical': {
    primaryColor: '#1d1d1b',
    accentColor: '#6f8b63',
    canvasColor: '#ece4d8',
    pageColor: '#fffdfa',
    borderColor: '#ddd4ca',
    mutedColor: '#635e57',
    headingFontFamily: 'Cormorant Garamond, Georgia, serif',
    bodyFontFamily: 'Source Sans 3, Arial, sans-serif',
  },
  'heirloom-parlor': {
    primaryColor: '#33261f',
    accentColor: '#a1806b',
    canvasColor: '#eee5da',
    pageColor: '#fffaf5',
    borderColor: '#e2d4c7',
    mutedColor: '#6f635a',
    headingFontFamily: 'Cormorant Garamond, Georgia, serif',
    bodyFontFamily: 'Source Sans 3, Arial, sans-serif',
  },
  'atelier-noir': {
    primaryColor: '#f2e9df',
    accentColor: '#93a07d',
    canvasColor: '#141312',
    pageColor: '#1c1917',
    borderColor: '#413731',
    mutedColor: '#d2c7bb',
    headingFontFamily: 'Cormorant Garamond, Georgia, serif',
    bodyFontFamily: 'Source Sans 3, Arial, sans-serif',
  },
};

interface DefaultDocumentOptions {
  agreementTitle: string;
  detailsSectionTitle: string;
  paymentTermsTitle: string;
  privacyTitle: string;
  signatureTitle: string;
  retainerCopy: string;
  latePaymentCopy: string;
  privacyCopy: string;
  lineItemsTitle: string;
  investmentTitle: string;
  documentTitle: string;
}

@Injectable({ providedIn: 'root' })
export class ProposalTemplateDocumentService {
  readonly storageKey = STORAGE_KEY;

  readonly placeholderDefinitions: ProposalTemplatePlaceholderDefinition[] = [
    { key: 'client.full_name', label: 'Client Full Name', category: 'client', bindingKind: 'text', sampleValue: 'Jordan Carter' },
    { key: 'client.email', label: 'Client Email', category: 'client', bindingKind: 'text', sampleValue: 'jordan@example.com' },
    { key: 'client.phone', label: 'Client Phone', category: 'client', bindingKind: 'text', sampleValue: '(401) 555-0142' },
    { key: 'event.date', label: 'Event Date', category: 'event', bindingKind: 'date', sampleValue: 'October 24, 2026' },
    { key: 'event.venue_name', label: 'Venue Name', category: 'event', bindingKind: 'text', sampleValue: 'Garden Manor Estate' },
    { key: 'event.venue_address', label: 'Venue Address', category: 'event', bindingKind: 'text', sampleValue: 'South Kingstown, Rhode Island' },
    { key: 'event.type', label: 'Event Type', category: 'event', bindingKind: 'text', sampleValue: 'Wedding' },
    { key: 'proposal.number', label: 'Proposal Number', category: 'proposal', bindingKind: 'text', sampleValue: 'BB-2407' },
    { key: 'proposal.created_date', label: 'Proposal Created Date', category: 'proposal', bindingKind: 'date', sampleValue: 'April 7, 2026' },
    { key: 'pricing.subtotal', label: 'Subtotal', category: 'pricing', bindingKind: 'currency', sampleValue: '$5,240.00' },
    { key: 'pricing.tax_amount', label: 'Tax', category: 'pricing', bindingKind: 'currency', sampleValue: '$367.80' },
    { key: 'pricing.total', label: 'Total', category: 'pricing', bindingKind: 'currency', sampleValue: '$5,607.80' },
    { key: 'pricing.deposit_amount', label: 'Deposit Due', category: 'pricing', bindingKind: 'currency', sampleValue: '$1,500.00' },
    { key: 'pricing.balance_due', label: 'Balance Due', category: 'pricing', bindingKind: 'currency', sampleValue: '$4,107.80' },
    { key: 'brand.business_name', label: 'Business Name', category: 'branding', bindingKind: 'text', sampleValue: 'Black Begonia Floral Design' },
    { key: 'brand.email', label: 'Brand Email', category: 'branding', bindingKind: 'text', sampleValue: 'hello@blackbegonia.com' },
    { key: 'brand.phone', label: 'Brand Phone', category: 'branding', bindingKind: 'text', sampleValue: '(401) 555-0199' },
    { key: 'brand.website', label: 'Brand Website', category: 'branding', bindingKind: 'text', sampleValue: 'blackbegonia.com' },
    { key: 'brand.logo_url', label: 'Brand Logo', category: 'branding', bindingKind: 'image', sampleValue: '' },
    { key: 'item.name', label: 'Line Item Name', category: 'line-item', bindingKind: 'text', sampleValue: 'Ceremony Meadow Pieces' },
    { key: 'item.description', label: 'Line Item Description', category: 'line-item', bindingKind: 'text', sampleValue: 'Garden-inspired florals with soft neutrals and textural movement.' },
    { key: 'item.quantity', label: 'Line Item Quantity', category: 'line-item', bindingKind: 'text', sampleValue: '2' },
    { key: 'item.unit_price', label: 'Line Item Unit Price', category: 'line-item', bindingKind: 'currency', sampleValue: '$425.00' },
    { key: 'item.total', label: 'Line Item Total', category: 'line-item', bindingKind: 'currency', sampleValue: '$850.00' },
  ];

  getStoredConfig(
    template: DocumentTemplate | null | undefined
  ): ProposalTemplateEditorStoredConfig | null {
    const stored = template?.template_config?.[this.storageKey];

    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
      return null;
    }

    const candidate = stored as ProposalTemplateEditorStoredConfig;
    if (candidate.schema_version !== '2.0' || !candidate.draft_document) {
      return null;
    }

    return this.clone(candidate);
  }

  getDraftDocument(template: DocumentTemplate | null | undefined): ProposalTemplateDocument {
    const stored = this.getStoredConfig(template);
    const document = stored?.draft_document
      ? this.clone(stored.draft_document)
      : this.buildDefaultDocument(template);
    return this.normalizeDocument(document);
  }

  getPublishedDocument(
    template: DocumentTemplate | null | undefined
  ): ProposalTemplateDocument {
    const stored = this.getStoredConfig(template);
    const document = stored?.published_document
      ? this.clone(stored.published_document)
      : this.getDraftDocument(template);
    return this.normalizeDocument(document);
  }

  getVersionHistory(
    template: DocumentTemplate | null | undefined
  ): ProposalTemplateEditorVersionEntry[] {
    return this.clone(this.getStoredConfig(template)?.version_history ?? []);
  }

  isTemplateTrashed(template: DocumentTemplate | null | undefined): boolean {
    return Boolean(this.getStoredConfig(template)?.trashed_at);
  }

  buildDraftConfig(
    document: ProposalTemplateDocument,
    previous: ProposalTemplateEditorStoredConfig | null,
    assets: ProposalTemplateEditorAsset[] = previous?.assets ?? [],
    canvaImports: ProposalTemplateCanvaImportSummary[] = previous?.canva_imports ?? []
  ): ProposalTemplateEditorStoredConfig {
    const savedAt = new Date().toISOString();
    const draftDocument = this.stampDocument(document, 'draft', savedAt);
    return {
      schema_version: '2.0',
      draft_document: draftDocument,
      published_document: previous?.published_document
        ? this.clone(previous.published_document)
        : null,
      published_at: previous?.published_at ?? null,
      assets: this.clone(assets),
      canva_imports: this.clone(canvaImports),
      version_history: this.buildVersionHistory(
        previous?.version_history,
        draftDocument,
        'draft',
        savedAt
      ),
      trashed_at: previous?.trashed_at ?? null,
    };
  }

  buildPublishedConfig(
    document: ProposalTemplateDocument,
    previous: ProposalTemplateEditorStoredConfig | null,
    assets: ProposalTemplateEditorAsset[] = previous?.assets ?? [],
    canvaImports: ProposalTemplateCanvaImportSummary[] = previous?.canva_imports ?? []
  ): ProposalTemplateEditorStoredConfig {
    const savedAt = new Date().toISOString();
    const publishedDocument = this.stampDocument(document, 'published', savedAt);
    return {
      schema_version: '2.0',
      draft_document: this.clone(publishedDocument),
      published_document: publishedDocument,
      published_at: savedAt,
      assets: this.clone(assets),
      canva_imports: this.clone(canvaImports),
      version_history: this.buildVersionHistory(
        previous?.version_history,
        publishedDocument,
        'published',
        savedAt
      ),
      trashed_at: previous?.trashed_at ?? null,
    };
  }

  buildTemplateConfig(
    template: DocumentTemplate,
    config: ProposalTemplateEditorStoredConfig
  ): Record<string, unknown> {
    const nextConfig = {
      ...(template.template_config ?? {}),
    };

    delete nextConfig['grapejs'];
    delete nextConfig['grapejs_sdk'];

    nextConfig[this.storageKey] = this.clone(config);
    return nextConfig;
  }

  applyResolvedAssetUrls(
    document: ProposalTemplateDocument,
    assets: ProposalTemplateEditorAsset[]
  ): ProposalTemplateDocument {
    const normalizedDocument = this.normalizeDocument(document);
    const assetById = new Map(assets.map((asset) => [asset.id, asset]));
    const assetByStoragePath = new Map(
      assets.map((asset) => [asset.storage_path, asset])
    );

    return {
      ...this.clone(normalizedDocument),
      pages: normalizedDocument.pages.map((page) => ({
        ...page,
        nodes: page.nodes.map((node) => {
          if (node.type === 'image' && node.source === 'url') {
            const asset =
              (node.asset_id ? assetById.get(node.asset_id) : null) ??
              (node.storage_path ? assetByStoragePath.get(node.storage_path) : null);

            if (!asset) {
              return this.clone(node);
            }

            return {
              ...this.clone(node),
              asset_id: asset.id,
              storage_path: asset.storage_path,
              url: asset.url,
              alt: node.alt || asset.alt,
            };
          }

          if (node.type === 'table') {
            return this.clone(node);
          }

          return this.clone(node);
        }),
      })),
    };
  }

  applyResolvedAssetUrlsToConfig(
    config: ProposalTemplateEditorStoredConfig,
    assets: ProposalTemplateEditorAsset[]
  ): ProposalTemplateEditorStoredConfig {
    const next = this.clone(config);
    next.assets = this.clone(assets);
    next.draft_document = this.applyResolvedAssetUrls(next.draft_document, assets);
    next.published_document = next.published_document
      ? this.applyResolvedAssetUrls(next.published_document, assets)
      : null;
    return next;
  }

  validateDocument(document: ProposalTemplateDocument): string[] {
    const issues: string[] = [];

    if (!document.pages.length) {
      issues.push('At least one page is required.');
    }

    document.pages.forEach((page) => {
      if (page.width <= 0 || page.height <= 0) {
        issues.push(`Page "${page.name}" must have a valid size.`);
      }

      page.nodes.forEach((node) => {
        if (node.width <= 0 || node.height <= 0) {
          issues.push(`Node "${node.name}" on "${page.name}" must have positive dimensions.`);
        }

        if (node.type === 'table') {
          if (node.rows <= 0 || node.columns <= 0) {
            issues.push(`Table "${node.name}" on "${page.name}" must have at least one row and one column.`);
          }

          if (node.cells.length !== node.rows * node.columns) {
            issues.push(`Table "${node.name}" on "${page.name}" has an invalid cell layout.`);
          }
        }
      });
    });

    return issues;
  }

  private normalizeDocument(document: ProposalTemplateDocument): ProposalTemplateDocument {
    const next = this.clone(document);

    return {
      ...next,
      pages: next.pages.map((page) => ({
        ...page,
        nodes: page.nodes.map((node) =>
          node.type === 'table'
            ? {
                ...node,
                cells: node.cells.map((cell) => ({
                  ...cell,
                  content: this.normalizeTableCellContent(next, cell),
                })),
              }
            : node
        ),
      })),
    };
  }

  private normalizeTableCellContent(
    document: ProposalTemplateDocument,
    cell: ProposalTemplateTableCell
  ): ProposalTemplateTableCellTextContent {
    if (cell.content.kind === 'text') {
      return this.clone(cell.content);
    }

    return {
      kind: 'text',
      content: this.parseSegments(cell.content.alt?.trim() || ''),
      align: 'left',
      color: document.theme.primaryColor,
      fontFamily: document.theme.bodyFontFamily,
      fontSize: 14,
      fontWeight: '500',
      fontStyle: 'normal',
      underline: false,
      strikethrough: false,
      textTransform: 'none',
      lineHeight: 1.35,
      letterSpacing: 0,
      listStyle: 'none',
    };
  }

  getPlaceholderDefinition(key: string): ProposalTemplatePlaceholderDefinition | null {
    return this.placeholderDefinitions.find((definition) => definition.key === key) ?? null;
  }

  renderSegments(
    segments: ProposalTemplateRichTextSegment[],
    previewData: ProposalTemplatePreviewData,
    mode: 'design' | 'sample'
  ): string {
    return segments
      .map((segment) => {
        if (segment.kind === 'lineBreak') {
          return '\n';
        }

        if (segment.kind === 'text') {
          return segment.text;
        }

        if (mode === 'design') {
          return `[${segment.label}]`;
        }

        return previewData.values[segment.key] ?? segment.fallback ?? segment.label;
      })
      .join('');
  }

  formatTextForDisplay(
    value: string,
    listStyle: ProposalTemplateTextListStyle = 'none'
  ): string {
    const normalizedValue = value.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ');

    if (listStyle === 'none') {
      return normalizedValue;
    }

    let formattedListIndex = 0;

    return normalizedValue
      .split('\n')
      .map((line) => {
        const normalizedLine = line.trim();
        if (!normalizedLine) {
          return '';
        }

        formattedListIndex += 1;
        return listStyle === 'ordered'
          ? `${formattedListIndex}. ${normalizedLine}`
          : `\u2022 ${normalizedLine}`;
      })
      .join('\n');
  }

  serializeSegments(segments: ProposalTemplateRichTextSegment[]): string {
    return segments
      .map((segment) => {
        switch (segment.kind) {
          case 'lineBreak':
            return '\n';
          case 'placeholder':
            return `{{${segment.key}}}`;
          case 'text':
          default:
            return segment.text;
        }
      })
      .join('');
  }

  parseSegments(value: string): ProposalTemplateRichTextSegment[] {
    const normalized = value.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');
    const tokenRegex = /\{\{\s*([a-z0-9._-]+)\s*\}\}/gi;
    const segments: ProposalTemplateRichTextSegment[] = [];

    lines.forEach((line, lineIndex) => {
      let cursor = 0;
      let match: RegExpExecArray | null = null;
      tokenRegex.lastIndex = 0;

      while ((match = tokenRegex.exec(line))) {
        const index = match.index;

        if (index > cursor) {
          segments.push({
            kind: 'text',
            text: line.slice(cursor, index),
          });
        }

        const key = match[1];
        const placeholder = this.getPlaceholderDefinition(key);
        segments.push({
          kind: 'placeholder',
          key,
          label: placeholder?.label ?? key,
        });
        cursor = index + match[0].length;
      }

      if (cursor < line.length) {
        segments.push({
          kind: 'text',
          text: line.slice(cursor),
        });
      }

      if (lineIndex < lines.length - 1) {
        segments.push({ kind: 'lineBreak' });
      }
    });

    return segments.length ? segments : [{ kind: 'text', text: '' }];
  }

  buildSamplePreviewData(_document: ProposalTemplateDocument): ProposalTemplatePreviewData {
    const subtotal = '$5,240.00';
    const tax = '$367.80';
    const total = '$5,607.80';
    const deposit = '$1,500.00';
    const balance = '$4,107.80';

    return {
      values: {
        'client.full_name': 'Jordan Carter',
        'client.email': 'jordan@example.com',
        'client.phone': '(401) 555-0142',
        'event.date': 'October 24, 2026',
        'event.venue_name': 'Garden Manor Estate',
        'event.venue_address': 'South Kingstown, Rhode Island',
        'event.type': 'Wedding',
        'proposal.number': 'BB-2407',
        'proposal.created_date': 'April 7, 2026',
        'pricing.subtotal': subtotal,
        'pricing.tax_amount': tax,
        'pricing.total': total,
        'pricing.deposit_amount': deposit,
        'pricing.balance_due': balance,
        'brand.business_name': 'Black Begonia Floral Design',
        'brand.email': 'hello@blackbegonia.com',
        'brand.phone': '(401) 555-0199',
        'brand.website': 'blackbegonia.com',
        'brand.logo_url': '',
        'item.name': 'Ceremony Meadow Pieces',
        'item.description':
          'Garden-inspired florals with soft neutrals and textural movement.',
        'item.quantity': '2',
        'item.unit_price': '$425.00',
        'item.total': '$850.00',
      },
      lineItems: [
        {
          name: 'Ceremony Meadow Pieces',
          description: 'Textural altar florals with layered greens and garden blooms.',
          quantity: '2',
          unit_price: '$425.00',
          total: '$850.00',
          line_type: 'Product',
          image_url: null,
        },
        {
          name: 'Reception Centerpieces',
          description: 'Low compote centerpieces with candle-friendly silhouettes.',
          quantity: '12',
          unit_price: '$175.00',
          total: '$2,100.00',
          line_type: 'Product',
          image_url: null,
        },
        {
          name: 'On-site Installation',
          description: 'Delivery, placement, and styling support for the event day.',
          quantity: '1',
          unit_price: '$650.00',
          total: '$650.00',
          line_type: 'Fee',
          image_url: null,
        },
      ],
      totals: this.buildTotals(subtotal, tax, total, deposit, balance),
    };
  }

  cloneDocument(document: ProposalTemplateDocument): ProposalTemplateDocument {
    return this.clone(document);
  }

  buildDefaultDocument(template: DocumentTemplate | null | undefined): ProposalTemplateDocument {
    const rendererKey = resolveTemplateRendererKey(template);
    const strategy = applyTemplateServiceProfile(
      getProposalRendererStrategy(rendererKey),
      getTemplateServiceProfile(template)
    );
    const theme = this.resolveTheme(template);
    const proposalPageId = this.createId('page');
    const continuationPageId = this.createId('page');
    const agreementPageId = this.createId('page');
    const repeaterId = this.createId('node');
    const options: DefaultDocumentOptions = {
      agreementTitle: strategy.agreementTitle,
      detailsSectionTitle: strategy.detailsSectionTitle,
      paymentTermsTitle: strategy.paymentTermsTitle,
      privacyTitle: strategy.privacyTitle,
      signatureTitle: strategy.signatureTitle,
      retainerCopy: strategy.retainerCopy,
      latePaymentCopy: strategy.latePaymentCopy,
      privacyCopy: strategy.privacyCopy,
      lineItemsTitle: strategy.lineItemsTitle,
      investmentTitle: strategy.investmentTitle,
      documentTitle: strategy.documentTitle,
    };

    return {
      id: template?.template_id ?? this.createId('document'),
      name: template?.name ?? 'Proposal Template',
      serviceType: rendererKey,
      status: 'draft',
      pagePreset: 'letter',
      theme,
      metadata: {
        createdWith: 'proposal-scene-editor',
        version: 1,
        updatedAt: new Date().toISOString(),
      },
      pages: [
        this.buildProposalPage(proposalPageId, repeaterId, theme, options),
        this.buildContinuationPage(
          continuationPageId,
          proposalPageId,
          repeaterId,
          theme,
          options
        ),
        this.buildAgreementPage(agreementPageId, theme, options),
      ],
    };
  }

  private buildProposalPage(
    pageId: string,
    repeaterId: string,
    theme: ProposalTemplateTheme,
    options: DefaultDocumentOptions
  ): ProposalTemplatePage {
    return {
      id: pageId,
      name: 'Proposal',
      width: LETTER_WIDTH,
      height: LETTER_HEIGHT,
      kind: 'dynamic-repeatable',
      background: { fill: theme.pageColor },
      nodes: [
        {
          id: this.createId('node'),
          type: 'shape',
          name: 'Top Wash',
          pageId,
          x: 0,
          y: 0,
          width: LETTER_WIDTH,
          height: 180,
          rotation: 0,
          zIndex: 0,
          opacity: 1,
          visible: true,
          locked: true,
          shapeKind: 'rectangle',
          fill: `${theme.accentColor}22`,
          stroke: 'transparent',
          strokeWidth: 0,
          cornerRadius: 0,
        },
        {
          id: this.createId('node'),
          type: 'image',
          name: 'Brand Logo',
          pageId,
          x: 620,
          y: 52,
          width: 120,
          height: 56,
          rotation: 0,
          zIndex: 1,
          opacity: 1,
          visible: true,
          locked: false,
          source: 'binding',
          bindingKey: 'brand.logo_url',
          url: null,
          fit: 'contain',
          cornerRadius: 0,
          alt: 'Brand logo',
        },
        {
          id: this.createId('node'),
          type: 'rich-text',
          name: 'Brand Name',
          pageId,
          x: 64,
          y: 54,
          width: 300,
          height: 30,
          rotation: 0,
          zIndex: 2,
          opacity: 1,
          visible: true,
          locked: false,
          content: this.parseSegments('{{brand.business_name}}'),
          align: 'left',
          color: theme.primaryColor,
          fontFamily: theme.bodyFontFamily,
          fontSize: 16,
          fontWeight: '700',
          lineHeight: 1.2,
          letterSpacing: 0.4,
        },
        {
          id: this.createId('node'),
          type: 'rich-text',
          name: 'Document Title',
          pageId,
          x: 64,
          y: 126,
          width: 520,
          height: 110,
          rotation: 0,
          zIndex: 2,
          opacity: 1,
          visible: true,
          locked: false,
          content: this.parseSegments('{{client.full_name}}\n' + options.documentTitle),
          align: 'left',
          color: theme.primaryColor,
          fontFamily: theme.headingFontFamily,
          fontSize: 40,
          fontWeight: '600',
          lineHeight: 1.02,
          letterSpacing: 0.2,
        },
        {
          id: this.createId('node'),
          type: 'rich-text',
          name: 'Event Summary',
          pageId,
          x: 64,
          y: 236,
          width: 686,
          height: 48,
          rotation: 0,
          zIndex: 2,
          opacity: 1,
          visible: true,
          locked: false,
          content: this.parseSegments(
            '{{event.type}}  |  {{event.date}}  |  {{event.venue_name}}'
          ),
          align: 'left',
          color: theme.mutedColor,
          fontFamily: theme.bodyFontFamily,
          fontSize: 15,
          fontWeight: '500',
          lineHeight: 1.45,
          letterSpacing: 0.2,
        },
        {
          id: this.createId('node'),
          type: 'divider',
          name: 'Header Divider',
          pageId,
          x: 64,
          y: 286,
          width: 688,
          height: 1,
          rotation: 0,
          zIndex: 2,
          opacity: 1,
          visible: true,
          locked: false,
          stroke: `${theme.primaryColor}22`,
          strokeWidth: 1,
          dashed: false,
        },
        {
          id: repeaterId,
          type: 'repeater',
          name: options.lineItemsTitle,
          pageId,
          x: 64,
          y: 324,
          width: 688,
          height: 410,
          rotation: 0,
          zIndex: 3,
          opacity: 1,
          visible: true,
          locked: false,
          sourceKey: 'proposal.line_items',
          direction: 'vertical',
          rowGap: 14,
          showHeader: true,
          headerHeight: 44,
          headerColumns: [
            { key: 'item', label: options.lineItemsTitle, width: 386, align: 'left' },
            { key: 'qty', label: 'Qty', width: 70, align: 'right' },
            { key: 'unit', label: 'Unit', width: 96, align: 'right' },
            { key: 'total', label: 'Total', width: 110, align: 'right' },
          ],
          rowTemplate: {
            heightMode: 'fixed',
            minHeight: 86,
            nodes: [
              {
                id: this.createId('row-node'),
                type: 'rich-text',
                name: 'Item Name',
                x: 0,
                y: 0,
                width: 386,
                height: 28,
                zIndex: 1,
                content: this.parseSegments('{{item.name}}'),
                align: 'left',
                color: theme.primaryColor,
                fontFamily: theme.headingFontFamily,
                fontSize: 22,
                fontWeight: '600',
                lineHeight: 1.1,
                letterSpacing: 0.2,
              },
              {
                id: this.createId('row-node'),
                type: 'rich-text',
                name: 'Item Description',
                x: 0,
                y: 34,
                width: 386,
                height: 42,
                zIndex: 1,
                content: this.parseSegments('{{item.description}}'),
                align: 'left',
                color: theme.mutedColor,
                fontFamily: theme.bodyFontFamily,
                fontSize: 12,
                fontWeight: '400',
                lineHeight: 1.4,
                letterSpacing: 0,
              },
              {
                id: this.createId('row-node'),
                type: 'rich-text',
                name: 'Item Quantity',
                x: 404,
                y: 12,
                width: 52,
                height: 24,
                zIndex: 1,
                content: this.parseSegments('{{item.quantity}}'),
                align: 'right',
                color: theme.mutedColor,
                fontFamily: theme.bodyFontFamily,
                fontSize: 14,
                fontWeight: '600',
                lineHeight: 1.3,
                letterSpacing: 0,
              },
              {
                id: this.createId('row-node'),
                type: 'rich-text',
                name: 'Item Unit Price',
                x: 482,
                y: 12,
                width: 82,
                height: 24,
                zIndex: 1,
                content: this.parseSegments('{{item.unit_price}}'),
                align: 'right',
                color: theme.mutedColor,
                fontFamily: theme.bodyFontFamily,
                fontSize: 14,
                fontWeight: '600',
                lineHeight: 1.3,
                letterSpacing: 0,
              },
              {
                id: this.createId('row-node'),
                type: 'rich-text',
                name: 'Item Total',
                x: 574,
                y: 8,
                width: 114,
                height: 30,
                zIndex: 1,
                content: this.parseSegments('{{item.total}}'),
                align: 'right',
                color: theme.primaryColor,
                fontFamily: theme.bodyFontFamily,
                fontSize: 16,
                fontWeight: '700',
                lineHeight: 1.3,
                letterSpacing: 0,
              },
            ],
          },
          pagination: {
            repeatHeaderOnContinuation: true,
            keepTotalsWithLastRows: true,
          },
          background: `${theme.primaryColor}04`,
          borderColor: `${theme.primaryColor}10`,
          borderWidth: 1,
          headerBackground: `${theme.accentColor}15`,
          rowBackground: '#ffffff',
          headerTextColor: theme.primaryColor,
        },
        {
          id: this.createId('node'),
          type: 'totals',
          name: options.investmentTitle,
          pageId,
          x: 432,
          y: 760,
          width: 320,
          height: 192,
          rotation: 0,
          zIndex: 4,
          opacity: 1,
          visible: true,
          locked: false,
          title: options.investmentTitle,
          fields: [
            { key: 'subtotal', label: 'Subtotal' },
            { key: 'tax', label: 'Tax' },
            { key: 'deposit', label: 'Deposit Due' },
            { key: 'balance', label: 'Balance Due' },
            { key: 'total', label: 'Total', emphasis: true },
          ],
          anchor: 'after-repeater',
          followNodeId: repeaterId,
          padding: 20,
          rowGap: 10,
          background: '#ffffff',
          borderColor: `${theme.primaryColor}18`,
          borderWidth: 1,
          textColor: theme.primaryColor,
          accentColor: theme.accentColor,
          radius: 24,
        },
        {
          id: this.createId('node'),
          type: 'rich-text',
          name: 'Footer Meta',
          pageId,
          x: 64,
          y: 980,
          width: 688,
          height: 32,
          rotation: 0,
          zIndex: 2,
          opacity: 1,
          visible: true,
          locked: false,
          content: this.parseSegments(
            '{{brand.email}}  |  {{brand.phone}}  |  {{brand.website}}'
          ),
          align: 'center',
          color: theme.mutedColor,
          fontFamily: theme.bodyFontFamily,
          fontSize: 12,
          fontWeight: '500',
          lineHeight: 1.3,
          letterSpacing: 0.1,
        },
      ],
    };
  }

  private buildContinuationPage(
    pageId: string,
    continuationSourcePageId: string,
    _repeaterId: string,
    theme: ProposalTemplateTheme,
    options: DefaultDocumentOptions
  ): ProposalTemplatePage {
    return {
      id: pageId,
      name: 'Line Items Continuation',
      width: LETTER_WIDTH,
      height: LETTER_HEIGHT,
      kind: 'continuation-template',
      continuationSourcePageId,
      background: { fill: theme.pageColor },
      nodes: [
        {
          id: this.createId('node'),
          type: 'rich-text',
          name: 'Continuation Title',
          pageId,
          x: 64,
          y: 72,
          width: 560,
          height: 42,
          rotation: 0,
          zIndex: 2,
          opacity: 1,
          visible: true,
          locked: false,
          content: this.parseSegments(options.lineItemsTitle + '\n' + '{{client.full_name}}'),
          align: 'left',
          color: theme.primaryColor,
          fontFamily: theme.headingFontFamily,
          fontSize: 28,
          fontWeight: '600',
          lineHeight: 1.1,
          letterSpacing: 0.2,
        },
        {
          id: this.createId('node'),
          type: 'repeater',
          name: 'Line Items Repeater',
          pageId,
          x: 64,
          y: 166,
          width: 688,
          height: 746,
          rotation: 0,
          zIndex: 3,
          opacity: 1,
          visible: true,
          locked: false,
          sourceKey: 'proposal.line_items',
          direction: 'vertical',
          rowGap: 14,
          showHeader: true,
          headerHeight: 44,
          headerColumns: [
            { key: 'item', label: options.lineItemsTitle, width: 386, align: 'left' },
            { key: 'qty', label: 'Qty', width: 70, align: 'right' },
            { key: 'unit', label: 'Unit', width: 96, align: 'right' },
            { key: 'total', label: 'Total', width: 110, align: 'right' },
          ],
          rowTemplate: {
            heightMode: 'fixed',
            minHeight: 86,
            nodes: [
              {
                id: this.createId('row-node'),
                type: 'rich-text',
                name: 'Item Name',
                x: 0,
                y: 0,
                width: 386,
                height: 28,
                zIndex: 1,
                content: this.parseSegments('{{item.name}}'),
                align: 'left',
                color: theme.primaryColor,
                fontFamily: theme.headingFontFamily,
                fontSize: 22,
                fontWeight: '600',
                lineHeight: 1.1,
                letterSpacing: 0.2,
              },
              {
                id: this.createId('row-node'),
                type: 'rich-text',
                name: 'Item Description',
                x: 0,
                y: 34,
                width: 386,
                height: 42,
                zIndex: 1,
                content: this.parseSegments('{{item.description}}'),
                align: 'left',
                color: theme.mutedColor,
                fontFamily: theme.bodyFontFamily,
                fontSize: 12,
                fontWeight: '400',
                lineHeight: 1.4,
                letterSpacing: 0,
              },
              {
                id: this.createId('row-node'),
                type: 'rich-text',
                name: 'Item Quantity',
                x: 404,
                y: 12,
                width: 52,
                height: 24,
                zIndex: 1,
                content: this.parseSegments('{{item.quantity}}'),
                align: 'right',
                color: theme.mutedColor,
                fontFamily: theme.bodyFontFamily,
                fontSize: 14,
                fontWeight: '600',
                lineHeight: 1.3,
                letterSpacing: 0,
              },
              {
                id: this.createId('row-node'),
                type: 'rich-text',
                name: 'Item Unit Price',
                x: 482,
                y: 12,
                width: 82,
                height: 24,
                zIndex: 1,
                content: this.parseSegments('{{item.unit_price}}'),
                align: 'right',
                color: theme.mutedColor,
                fontFamily: theme.bodyFontFamily,
                fontSize: 14,
                fontWeight: '600',
                lineHeight: 1.3,
                letterSpacing: 0,
              },
              {
                id: this.createId('row-node'),
                type: 'rich-text',
                name: 'Item Total',
                x: 574,
                y: 8,
                width: 114,
                height: 30,
                zIndex: 1,
                content: this.parseSegments('{{item.total}}'),
                align: 'right',
                color: theme.primaryColor,
                fontFamily: theme.bodyFontFamily,
                fontSize: 16,
                fontWeight: '700',
                lineHeight: 1.3,
                letterSpacing: 0,
              },
            ],
          },
          pagination: {
            repeatHeaderOnContinuation: true,
            keepTotalsWithLastRows: true,
          },
          background: `${theme.primaryColor}04`,
          borderColor: `${theme.primaryColor}10`,
          borderWidth: 1,
          headerBackground: `${theme.accentColor}15`,
          rowBackground: '#ffffff',
          headerTextColor: theme.primaryColor,
        },
      ],
    };
  }

  private buildAgreementPage(
    pageId: string,
    theme: ProposalTemplateTheme,
    options: DefaultDocumentOptions
  ): ProposalTemplatePage {
    return {
      id: pageId,
      name: 'Agreement',
      width: LETTER_WIDTH,
      height: LETTER_HEIGHT,
      kind: 'static',
      background: { fill: theme.pageColor },
      nodes: [
        {
          id: this.createId('node'),
          type: 'rich-text',
          name: 'Agreement Title',
          pageId,
          x: 64,
          y: 72,
          width: 688,
          height: 78,
          rotation: 0,
          zIndex: 2,
          opacity: 1,
          visible: true,
          locked: false,
          content: this.parseSegments(options.agreementTitle),
          align: 'left',
          color: theme.primaryColor,
          fontFamily: theme.headingFontFamily,
          fontSize: 34,
          fontWeight: '600',
          lineHeight: 1.08,
          letterSpacing: 0.2,
        },
        {
          id: this.createId('node'),
          type: 'rich-text',
          name: 'Agreement Detail Summary',
          pageId,
          x: 64,
          y: 164,
          width: 688,
          height: 96,
          rotation: 0,
          zIndex: 2,
          opacity: 1,
          visible: true,
          locked: false,
          content: this.parseSegments(
            `${options.detailsSectionTitle}\nService: {{event.type}}\nDate: {{event.date}}\nLocation: {{event.venue_address}}`
          ),
          align: 'left',
          color: theme.primaryColor,
          fontFamily: theme.bodyFontFamily,
          fontSize: 15,
          fontWeight: '500',
          lineHeight: 1.6,
          letterSpacing: 0,
        },
        {
          id: this.createId('node'),
          type: 'rich-text',
          name: 'Retainer Copy',
          pageId,
          x: 64,
          y: 310,
          width: 688,
          height: 176,
          rotation: 0,
          zIndex: 2,
          opacity: 1,
          visible: true,
          locked: false,
          content: this.parseSegments(`${options.paymentTermsTitle}\n${options.retainerCopy}`),
          align: 'left',
          color: theme.primaryColor,
          fontFamily: theme.bodyFontFamily,
          fontSize: 15,
          fontWeight: '500',
          lineHeight: 1.65,
          letterSpacing: 0,
        },
        {
          id: this.createId('node'),
          type: 'rich-text',
          name: 'Late Payment Copy',
          pageId,
          x: 64,
          y: 500,
          width: 688,
          height: 112,
          rotation: 0,
          zIndex: 2,
          opacity: 1,
          visible: true,
          locked: false,
          content: this.parseSegments(options.latePaymentCopy),
          align: 'left',
          color: theme.mutedColor,
          fontFamily: theme.bodyFontFamily,
          fontSize: 14,
          fontWeight: '400',
          lineHeight: 1.6,
          letterSpacing: 0,
        },
        {
          id: this.createId('node'),
          type: 'rich-text',
          name: 'Privacy Copy',
          pageId,
          x: 64,
          y: 640,
          width: 688,
          height: 132,
          rotation: 0,
          zIndex: 2,
          opacity: 1,
          visible: true,
          locked: false,
          content: this.parseSegments(`${options.privacyTitle}\n${options.privacyCopy}`),
          align: 'left',
          color: theme.primaryColor,
          fontFamily: theme.bodyFontFamily,
          fontSize: 14,
          fontWeight: '400',
          lineHeight: 1.65,
          letterSpacing: 0,
        },
        {
          id: this.createId('node'),
          type: 'rich-text',
          name: 'Signature Heading',
          pageId,
          x: 64,
          y: 822,
          width: 688,
          height: 36,
          rotation: 0,
          zIndex: 2,
          opacity: 1,
          visible: true,
          locked: false,
          content: this.parseSegments(options.signatureTitle),
          align: 'left',
          color: theme.primaryColor,
          fontFamily: theme.headingFontFamily,
          fontSize: 24,
          fontWeight: '600',
          lineHeight: 1.1,
          letterSpacing: 0.2,
        },
        {
          id: this.createId('node'),
          type: 'divider',
          name: 'Signature Line Left',
          pageId,
          x: 64,
          y: 918,
          width: 300,
          height: 1,
          rotation: 0,
          zIndex: 2,
          opacity: 1,
          visible: true,
          locked: false,
          stroke: `${theme.primaryColor}44`,
          strokeWidth: 1,
          dashed: false,
        },
        {
          id: this.createId('node'),
          type: 'divider',
          name: 'Signature Line Right',
          pageId,
          x: 452,
          y: 918,
          width: 300,
          height: 1,
          rotation: 0,
          zIndex: 2,
          opacity: 1,
          visible: true,
          locked: false,
          stroke: `${theme.primaryColor}44`,
          strokeWidth: 1,
          dashed: false,
        },
        {
          id: this.createId('node'),
          type: 'rich-text',
          name: 'Signature Labels',
          pageId,
          x: 64,
          y: 928,
          width: 688,
          height: 42,
          rotation: 0,
          zIndex: 2,
          opacity: 1,
          visible: true,
          locked: false,
          content: this.parseSegments(
            'Florist Signature                                               Client Signature'
          ),
          align: 'left',
          color: theme.mutedColor,
          fontFamily: theme.bodyFontFamily,
          fontSize: 12,
          fontWeight: '500',
          lineHeight: 1.3,
          letterSpacing: 0.2,
        },
      ],
    };
  }

  private resolveTheme(template: DocumentTemplate | null | undefined): ProposalTemplateTheme {
    const templateKey = (template?.template_key ?? '').toLowerCase();

    if (templateKey.includes('noir')) {
      return this.clone(STARTER_THEMES['atelier-noir']);
    }

    if (templateKey.includes('manor')) {
      return this.clone(STARTER_THEMES['garden-manor']);
    }

    if (templateKey.includes('modern')) {
      return this.clone(STARTER_THEMES['modern-botanical']);
    }

    if (templateKey.includes('heirloom') || templateKey.includes('memorial')) {
      return this.clone(STARTER_THEMES['heirloom-parlor']);
    }

    return this.clone(STARTER_THEMES['romantic-editorial']);
  }

  private stampDocument(
    document: ProposalTemplateDocument,
    status: ProposalTemplateDocument['status'],
    updatedAt = new Date().toISOString()
  ): ProposalTemplateDocument {
    const nextDocument = this.clone(document);
    nextDocument.status = status;
    nextDocument.metadata = {
      createdWith: 'proposal-scene-editor',
      version: (nextDocument.metadata?.version ?? 0) + 1,
      updatedAt,
    };
    return nextDocument;
  }

  private buildVersionHistory(
    previousEntries: ProposalTemplateEditorVersionEntry[] | null | undefined,
    document: ProposalTemplateDocument,
    kind: ProposalTemplateEditorVersionEntry['kind'],
    savedAt: string
  ): ProposalTemplateEditorVersionEntry[] {
    const nextEntry: ProposalTemplateEditorVersionEntry = {
      id: `version-${savedAt}-${Math.random().toString(36).slice(2, 8)}`,
      kind,
      label:
        kind === 'published'
          ? `Published v${document.metadata.version}`
          : `Draft save v${document.metadata.version}`,
      saved_at: savedAt,
      document: this.clone(document),
    };

    return [nextEntry, ...(previousEntries ? this.clone(previousEntries) : [])].slice(
      0,
      VERSION_HISTORY_LIMIT
    );
  }

  private buildTotals(
    subtotal: string,
    tax: string,
    total: string,
    deposit: string,
    balance: string
  ): ProposalTemplatePreviewTotals {
    return {
      subtotal,
      tax,
      total,
      deposit,
      balance,
    };
  }

  private createId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

