export type ProposalTemplatePageKind =
  | 'static'
  | 'dynamic-repeatable'
  | 'continuation-template';

export type ProposalTemplateNodeType =
  | 'rich-text'
  | 'image'
  | 'shape'
  | 'divider'
  | 'group'
  | 'repeater'
  | 'totals';

export type ProposalTemplateBindingCategory =
  | 'client'
  | 'event'
  | 'proposal'
  | 'pricing'
  | 'branding'
  | 'system'
  | 'line-item';

export type ProposalTemplateBindingKind =
  | 'text'
  | 'image'
  | 'array'
  | 'currency'
  | 'date'
  | 'boolean';

export type ProposalTemplatePagePreset = 'letter';
export type ProposalTemplateNodeAlignment = 'left' | 'center' | 'right';
export type ProposalTemplateNodeWeight = '400' | '500' | '600' | '700';
export type ProposalTemplateShapeKind = 'rectangle' | 'ellipse';
export type ProposalTemplateShapeStrokeStyle = 'solid' | 'dashed' | 'dotted';
export type ProposalTemplateImageFit = 'cover' | 'contain' | 'stretch';
export type ProposalTemplateTotalsFieldKey =
  | 'subtotal'
  | 'tax'
  | 'total'
  | 'deposit'
  | 'balance';

export interface ProposalTemplateTheme {
  primaryColor: string;
  accentColor: string;
  canvasColor: string;
  pageColor: string;
  borderColor: string;
  mutedColor: string;
  headingFontFamily: string;
  bodyFontFamily: string;
}

export interface ProposalTemplateDocumentMetadata {
  createdWith: 'proposal-scene-editor';
  version: number;
  updatedAt: string;
}

export interface ProposalTemplatePageBackground {
  fill: string;
}

export interface ProposalTemplateDocument {
  id: string;
  name: string;
  serviceType: string;
  status: 'draft' | 'published' | 'archived';
  pagePreset: ProposalTemplatePagePreset;
  pages: ProposalTemplatePage[];
  theme: ProposalTemplateTheme;
  metadata: ProposalTemplateDocumentMetadata;
}

export interface ProposalTemplatePage {
  id: string;
  name: string;
  width: number;
  height: number;
  kind: ProposalTemplatePageKind;
  continuationSourcePageId?: string | null;
  background?: ProposalTemplatePageBackground;
  nodes: ProposalTemplateNode[];
}

export interface ProposalTemplateNodeBase {
  id: string;
  type: ProposalTemplateNodeType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  pageId: string;
}

export type ProposalTemplateRichTextSegment =
  | {
      kind: 'text';
      text: string;
    }
  | {
      kind: 'placeholder';
      key: string;
      label: string;
      fallback?: string;
    }
  | {
      kind: 'lineBreak';
    };

export interface ProposalTemplateRichTextNode extends ProposalTemplateNodeBase {
  type: 'rich-text';
  content: ProposalTemplateRichTextSegment[];
  align: ProposalTemplateNodeAlignment;
  color: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: ProposalTemplateNodeWeight;
  fontStyle?: 'normal' | 'italic';
  underline?: boolean;
  strikethrough?: boolean;
  textTransform?: 'none' | 'uppercase';
  lineHeight: number;
  letterSpacing: number;
}

export interface ProposalTemplateImageNode extends ProposalTemplateNodeBase {
  type: 'image';
  source: 'binding' | 'url';
  bindingKey?: string | null;
  url?: string | null;
  asset_id?: string | null;
  storage_path?: string | null;
  fit: ProposalTemplateImageFit;
  cornerRadius: number;
  alt: string;
}

export interface ProposalTemplateShapeNode extends ProposalTemplateNodeBase {
  type: 'shape';
  shapeKind: ProposalTemplateShapeKind;
  fill: string;
  stroke: string;
  strokeStyle?: ProposalTemplateShapeStrokeStyle;
  strokeWidth: number;
  cornerRadius: number;
}

export interface ProposalTemplateDividerNode extends ProposalTemplateNodeBase {
  type: 'divider';
  stroke: string;
  strokeWidth: number;
  dashed: boolean;
}

export interface ProposalTemplateGroupNode extends ProposalTemplateNodeBase {
  type: 'group';
  childIds: string[];
}

export interface ProposalTemplateRepeaterPaginationConfig {
  repeatHeaderOnContinuation: boolean;
  keepTotalsWithLastRows: boolean;
}

export interface ProposalTemplateRepeaterChildNodeBase {
  id: string;
  type: 'rich-text' | 'shape' | 'divider';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface ProposalTemplateRepeaterRichTextNode
  extends ProposalTemplateRepeaterChildNodeBase {
  type: 'rich-text';
  content: ProposalTemplateRichTextSegment[];
  align: ProposalTemplateNodeAlignment;
  color: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: ProposalTemplateNodeWeight;
  fontStyle?: 'normal' | 'italic';
  underline?: boolean;
  strikethrough?: boolean;
  textTransform?: 'none' | 'uppercase';
  lineHeight: number;
  letterSpacing: number;
}

export interface ProposalTemplateRepeaterShapeNode
  extends ProposalTemplateRepeaterChildNodeBase {
  type: 'shape';
  shapeKind: ProposalTemplateShapeKind;
  fill: string;
  stroke: string;
  strokeStyle?: ProposalTemplateShapeStrokeStyle;
  strokeWidth: number;
  cornerRadius: number;
}

export interface ProposalTemplateRepeaterDividerNode
  extends ProposalTemplateRepeaterChildNodeBase {
  type: 'divider';
  stroke: string;
  strokeWidth: number;
  dashed: boolean;
}

export type ProposalTemplateRepeaterChildNode =
  | ProposalTemplateRepeaterRichTextNode
  | ProposalTemplateRepeaterShapeNode
  | ProposalTemplateRepeaterDividerNode;

export interface ProposalTemplateRepeaterHeaderColumn {
  key: string;
  label: string;
  width: number;
  align: ProposalTemplateNodeAlignment;
}

export interface ProposalTemplateRepeaterRowTemplate {
  heightMode: 'fixed';
  minHeight: number;
  nodes: ProposalTemplateRepeaterChildNode[];
}

export interface ProposalTemplateRepeaterNode extends ProposalTemplateNodeBase {
  type: 'repeater';
  sourceKey: 'proposal.line_items';
  direction: 'vertical';
  rowGap: number;
  showHeader: boolean;
  headerHeight: number;
  headerColumns: ProposalTemplateRepeaterHeaderColumn[];
  rowTemplate: ProposalTemplateRepeaterRowTemplate;
  pagination: ProposalTemplateRepeaterPaginationConfig;
  background: string;
  borderColor: string;
  borderWidth: number;
  headerBackground: string;
  rowBackground: string;
  headerTextColor: string;
}

export interface ProposalTemplateTotalsField {
  key: ProposalTemplateTotalsFieldKey;
  label: string;
  emphasis?: boolean;
}

export interface ProposalTemplateTotalsNode extends ProposalTemplateNodeBase {
  type: 'totals';
  title: string;
  fields: ProposalTemplateTotalsField[];
  anchor: 'absolute' | 'after-repeater';
  followNodeId?: string | null;
  padding: number;
  rowGap: number;
  background: string;
  borderColor: string;
  borderWidth: number;
  textColor: string;
  accentColor: string;
  radius: number;
}

export type ProposalTemplateNode =
  | ProposalTemplateRichTextNode
  | ProposalTemplateImageNode
  | ProposalTemplateShapeNode
  | ProposalTemplateDividerNode
  | ProposalTemplateGroupNode
  | ProposalTemplateRepeaterNode
  | ProposalTemplateTotalsNode;

export interface ProposalTemplatePlaceholderDefinition {
  key: string;
  label: string;
  category: ProposalTemplateBindingCategory;
  bindingKind: ProposalTemplateBindingKind;
  description?: string;
  sampleValue?: unknown;
}

export interface ProposalTemplateEditorStoredConfig {
  schema_version: '2.0';
  draft_document: ProposalTemplateDocument;
  published_document?: ProposalTemplateDocument | null;
  published_at?: string | null;
  assets?: ProposalTemplateEditorAsset[];
  canva_imports?: ProposalTemplateCanvaImportSummary[];
  version_history?: ProposalTemplateEditorVersionEntry[];
  trashed_at?: string | null;
}

export interface ProposalTemplateEditorAsset {
  id: string;
  type: 'logo' | 'background' | 'texture' | 'image';
  url: string;
  storage_path: string;
  alt: string;
}

export interface ProposalTemplateCanvaImportSummary {
  id: string;
  design_id: string;
  title: string;
  page_count: number;
  imported_at: string;
  thumbnail_url?: string | null;
}

export interface ProposalTemplateEditorVersionEntry {
  id: string;
  kind: 'draft' | 'published';
  label: string;
  saved_at: string;
  document: ProposalTemplateDocument;
}

export interface ProposalTemplatePreviewLineItem {
  name: string;
  description: string;
  quantity: string;
  unit_price: string;
  total: string;
  line_type: string;
  image_url?: string | null;
}

export interface ProposalTemplatePreviewTotals {
  subtotal: string;
  tax: string;
  total: string;
  deposit: string;
  balance: string;
}

export interface ProposalTemplatePreviewData {
  values: Record<string, string>;
  lineItems: ProposalTemplatePreviewLineItem[];
  totals: ProposalTemplatePreviewTotals;
}
