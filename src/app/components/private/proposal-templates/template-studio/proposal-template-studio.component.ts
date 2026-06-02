import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Blend,
  Bold,
  ChevronDown,
  BringToFront,
  CaseSensitive,
  Copy,
  Download,
  FilePlus2,
  History,
  Italic,
  Layers2,
  List,
  ListOrdered,
  LucideAngularModule,
  Minus,
  Move3d,
  PanelLeftOpen,
  PanelRightOpen,
  Plus,
  Save,
  SendToBack,
  SlidersHorizontal,
  SquarePen,
  SquareRoundCorner,
  Strikethrough,
  Trash2,
  Underline,
  Upload,
  X,
} from 'lucide-angular';

import { DocumentTemplate } from '../../../../core/models/floral-proposal';
import {
  ProposalTemplateDocument,
  ProposalTemplateCanvaImportSummary,
  ProposalTemplateDividerNode,
  ProposalTemplateEditorAsset,
  ProposalTemplateEditorVersionEntry,
  ProposalTemplateNode,
  ProposalTemplatePage,
  ProposalTemplatePreviewLineItem,
  ProposalTemplateRepeaterNode,
  ProposalTemplateRepeaterRichTextNode,
  ProposalTemplateRichTextNode,
  ProposalTemplateTableCell,
  ProposalTemplateTableCellTextContent,
  ProposalTemplateTableNode,
  ProposalTemplateShapeNode,
  ProposalTemplateShapeStrokeStyle,
  ProposalTemplateTextListStyle,
  ProposalTemplateTotalsNode,
} from '../../../../core/proposal-templates/proposal-template-document.models';
import {
  CanvaConnectionStatus,
  CanvaDesignSummary,
  CanvaImportResult,
  ProposalTemplateCanvaService,
} from '../../../../core/proposal-templates/proposal-template-canva.service';
import { ProposalTemplateDocumentService } from '../../../../core/proposal-templates/proposal-template-document.service';
import {
  getProposalRendererOption,
  resolveTemplateRendererKey,
  withTemplateRendererKey,
} from '../../../../core/proposal-templates/proposal-renderer-registry';
import {
  getTemplateServiceProfile,
  withTemplateServiceProfile,
} from '../../../../core/proposal-templates/proposal-template-service-profile';
import { ToastService } from '../../../../core/services/toast.service';
import { DocumentTemplateRepositoryService } from '../../../../core/supabase/repositories/document-template-repository.service';
import { DocumentTemplateService } from '../../../../core/supabase/services/document-template.service';
import { ErrorStateBlockComponent } from '../../../../shared/components/private/error-state-block/error-state-block.component';
import { LoadingStateBlockComponent } from '../../../../shared/components/private/loading-state-block/loading-state-block.component';

type InsertableNodeType = Exclude<ProposalTemplateNode['type'], 'group'>;
type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type ToolbarPopover =
  | 'text-letter-spacing'
  | 'shape-opacity'
  | 'shape-stroke'
  | 'shape-radius'
  | 'table-cell-stroke'
  | 'divider-opacity'
  | 'divider-stroke'
  | 'node-opacity';
type FileActionKey = 'create' | 'upload' | 'save' | 'copy' | 'download' | 'trash';

interface DragState {
  mode: 'move' | 'resize' | 'rotate';
  pageId: string;
  nodeId: string;
  startX: number;
  startY: number;
  nodeX: number;
  nodeY: number;
  width: number;
  height: number;
  rotation: number;
  handle?: ResizeHandle;
  centerX?: number;
  centerY?: number;
}

interface TextEditorState {
  mode: 'node' | 'table-cell';
  pageId: string;
  nodeId: string;
  cellId?: string;
  value: string;
}

interface RenderedTextListItem {
  marker: string;
  content: string;
}

interface RenderedTextModel {
  kind: 'plain' | 'list';
  text: string;
  items: RenderedTextListItem[];
  markerWidth: string;
}

interface SnapGuideState {
  vertical: number[];
  horizontal: number[];
}

interface EditorHistorySnapshot {
  document: ProposalTemplateDocument;
  selectedPageId: string | null;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
}

interface DocumentMutationOptions {
  trackHistory?: boolean;
}

interface NodePlacementOptions {
  pageId?: string;
  x?: number;
  y?: number;
  openEditor?: boolean;
  overrides?: Partial<ProposalTemplateNode>;
}

type StudioSidebarTab =
  | 'templates'
  | 'text'
  | 'images'
  | 'videos'
  | 'shapes'
  | 'vectors'
  | 'uploads'
  | 'more';

interface StudioSidebarSection {
  id: StudioSidebarTab;
  label: string;
  shortLabel: string;
  description: string;
}

interface TextPreset {
  id: string;
  label: string;
  description: string;
  content: string;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: ProposalTemplateRichTextNode['fontWeight'];
  lineHeight: number;
  letterSpacing: number;
  align: ProposalTemplateRichTextNode['align'];
  family: 'heading' | 'body';
}

interface ShapePreset {
  id: string;
  label: string;
  description: string;
  kind: 'shape' | 'divider';
  width: number;
  height: number;
  shapeKind?: 'rectangle' | 'ellipse';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  dashed?: boolean;
  previewClass: string;
}

interface MediaPreset {
  id: string;
  label: string;
  description: string;
  width: number;
  height: number;
  source: 'binding' | 'url';
  bindingKey?: string | null;
  url?: string | null;
  fit: 'cover' | 'contain' | 'stretch';
  cornerRadius: number;
  alt: string;
}

interface BlockPreset {
  id: string;
  label: string;
  description: string;
  type: InsertableNodeType;
}

interface ToolbarFontOption {
  label: string;
  value: string;
}

type TextToolbarTarget = Pick<
  ProposalTemplateRichTextNode,
  | 'align'
  | 'color'
  | 'fontFamily'
  | 'fontSize'
  | 'fontWeight'
  | 'fontStyle'
  | 'underline'
  | 'strikethrough'
  | 'textTransform'
  | 'lineHeight'
  | 'letterSpacing'
  | 'listStyle'
>;

interface MarqueeSelectionState {
  pageId: string;
  pageLeft: number;
  pageTop: number;
  pageWidth: number;
  pageHeight: number;
  zoom: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  additive: boolean;
  baseSelectionIds: string[];
}

interface TableCellSelection {
  nodeId: string;
  cellId: string;
}

type ColorDrawerTarget =
  | 'text-color'
  | 'shape-fill'
  | 'shape-stroke'
  | 'divider-stroke'
  | 'table-cell-background'
  | 'table-cell-stroke'
  | 'table-cell-text';

interface ColorDrawerState {
  target: ColorDrawerTarget;
  title: string;
  previousTab: StudioSidebarTab;
  allowGradients: boolean;
}

interface MarqueeSelectionState {
  pageId: string;
  pageLeft: number;
  pageTop: number;
  pageWidth: number;
  pageHeight: number;
  zoom: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  additive: boolean;
  baseSelectionIds: string[];
}

@Component({
  selector: 'app-proposal-template-studio',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    LoadingStateBlockComponent,
    ErrorStateBlockComponent,
  ],
  templateUrl: './proposal-template-studio.component.html',
  styleUrl: './proposal-template-studio.component.scss',
})
export class ProposalTemplateStudioComponent implements OnInit, OnDestroy {
  private static readonly HISTORY_LIMIT = 150;
  private static readonly SNAP_TOLERANCE = 8;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly templateRepository = inject(DocumentTemplateRepositoryService);
  private readonly templateService = inject(DocumentTemplateService);
  private readonly canvaService = inject(ProposalTemplateCanvaService);
  readonly proposalTemplateDocumentService = inject(ProposalTemplateDocumentService);
  private readonly toast = inject(ToastService);

  private dragState: DragState | null = null;
  private dragHistorySnapshot: EditorHistorySnapshot | null = null;
  private dragDidMutate = false;
  private historyPast: EditorHistorySnapshot[] = [];
  private historyFuture: EditorHistorySnapshot[] = [];
  private canvaPopup: Window | null = null;
  private canvaMessageOrigin: string | null = null;
  private canvaPopupPollTimer: number | null = null;
  private canvaPopupFlowResolved = false;
  private canvaPopupStatusCheckInFlight = false;
  private clipboardNodes: ProposalTemplateNode[] = [];
  private clipboardPasteCount = 0;
  readonly iconChevronDown = ChevronDown;
  readonly iconFilePlus2 = FilePlus2;
  readonly iconUpload = Upload;
  readonly iconSave = Save;
  readonly iconSquarePen = SquarePen;
  readonly iconMinus = Minus;
  readonly iconPlus = Plus;
  readonly iconBold = Bold;
  readonly iconItalic = Italic;
  readonly iconLayers2 = Layers2;
  readonly iconList = List;
  readonly iconListOrdered = ListOrdered;
  readonly iconUnderline = Underline;
  readonly iconStrikethrough = Strikethrough;
  readonly iconCaseSensitive = CaseSensitive;
  readonly iconMove3d = Move3d;
  readonly iconPanelLeftOpen = PanelLeftOpen;
  readonly iconPanelRightOpen = PanelRightOpen;
  readonly iconAlignLeft = AlignLeft;
  readonly iconAlignCenter = AlignCenter;
  readonly iconAlignRight = AlignRight;
  readonly iconBlend = Blend;
  readonly iconSlidersHorizontal = SlidersHorizontal;
  readonly iconSquareRoundCorner = SquareRoundCorner;
  readonly iconBringToFront = BringToFront;
  readonly iconSendToBack = SendToBack;
  readonly iconCopy = Copy;
  readonly iconDownload = Download;
  readonly iconHistory = History;
  readonly iconTrash2 = Trash2;
  readonly iconX = X;

  @ViewChild('uploadInput')
  private uploadInput?: ElementRef<HTMLInputElement>;
  @ViewChild('richTextEditor')
  private richTextEditor?: ElementRef<HTMLDivElement>;

  readonly sidebarSections: StudioSidebarSection[] = [
    { id: 'templates', label: 'Templates', shortLabel: 'Tpl', description: 'Pages, layout presets, and import tools.' },
    { id: 'text', label: 'Text', shortLabel: 'T', description: 'Headings, paragraphs, and callout copy.' },
    { id: 'images', label: 'Images', shortLabel: 'Img', description: 'Photo, logo, and image placeholders.' },
    { id: 'videos', label: 'Videos', shortLabel: 'Vid', description: 'Poster-frame media placeholders for PDF output.' },
    { id: 'shapes', label: 'Shapes', shortLabel: 'Shp', description: 'Basic geometric forms and dividers.' },
    { id: 'vectors', label: 'Vectors', shortLabel: 'Vec', description: 'Decorative accents and soft organic forms.' },
    { id: 'uploads', label: 'Uploads', shortLabel: 'Up', description: 'Template-bound uploaded assets.' },
    { id: 'more', label: 'More', shortLabel: '...', description: 'Proposal-specific blocks and dynamic fields.' },
  ];
  readonly transformHandles: Array<{ id: ResizeHandle; cursor: string }> = [
    { id: 'nw', cursor: 'nwse-resize' },
    { id: 'n', cursor: 'ns-resize' },
    { id: 'ne', cursor: 'nesw-resize' },
    { id: 'e', cursor: 'ew-resize' },
    { id: 'se', cursor: 'nwse-resize' },
    { id: 's', cursor: 'ns-resize' },
    { id: 'sw', cursor: 'nesw-resize' },
    { id: 'w', cursor: 'ew-resize' },
  ];
  readonly textPresets: TextPreset[] = [
    {
      id: 'heading',
      label: 'Heading',
      description: 'Large editorial headline.',
      content: 'Add a heading',
      width: 360,
      height: 72,
      fontSize: 38,
      fontWeight: '600',
      lineHeight: 1.05,
      letterSpacing: 0.2,
      align: 'left',
      family: 'heading',
    },
    {
      id: 'subheading',
      label: 'Subheading',
      description: 'Elegant section opener.',
      content: 'Add a subheading',
      width: 320,
      height: 58,
      fontSize: 24,
      fontWeight: '600',
      lineHeight: 1.15,
      letterSpacing: 0.1,
      align: 'left',
      family: 'heading',
    },
    {
      id: 'eyebrow',
      label: 'Eyebrow',
      description: 'Small uppercase label.',
      content: 'Section label',
      width: 220,
      height: 30,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 1.2,
      letterSpacing: 1.4,
      align: 'left',
      family: 'body',
    },
    {
      id: 'paragraph',
      label: 'Paragraph',
      description: 'Body copy block.',
      content: 'Add body text that explains the proposal, the event details, or your design approach.',
      width: 420,
      height: 108,
      fontSize: 16,
      fontWeight: '500',
      lineHeight: 1.6,
      letterSpacing: 0,
      align: 'left',
      family: 'body',
    },
    {
      id: 'caption',
      label: 'Caption',
      description: 'Small supporting note.',
      content: 'Add a supporting note',
      width: 260,
      height: 40,
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 1.45,
      letterSpacing: 0,
      align: 'left',
      family: 'body',
    },
  ];
  readonly imagePresets: MediaPreset[] = [
    {
      id: 'logo',
      label: 'Brand Logo',
      description: 'Bound to the template logo or business mark.',
      width: 160,
      height: 84,
      source: 'binding',
      bindingKey: 'brand.logo_url',
      fit: 'contain',
      cornerRadius: 0,
      alt: 'Brand logo',
    },
    {
      id: 'portrait',
      label: 'Portrait Frame',
      description: 'Tall photo placeholder for editorial pages.',
      width: 220,
      height: 320,
      source: 'url',
      url: null,
      fit: 'cover',
      cornerRadius: 24,
      alt: 'Portrait image',
    },
    {
      id: 'landscape',
      label: 'Landscape Frame',
      description: 'Wide image placeholder for hero moments.',
      width: 360,
      height: 220,
      source: 'url',
      url: null,
      fit: 'cover',
      cornerRadius: 28,
      alt: 'Landscape image',
    },
    {
      id: 'gallery',
      label: 'Gallery Tile',
      description: 'Compact supporting image tile.',
      width: 180,
      height: 180,
      source: 'url',
      url: null,
      fit: 'cover',
      cornerRadius: 20,
      alt: 'Gallery image',
    },
  ];
  readonly videoPresets: MediaPreset[] = [
    {
      id: 'video-poster',
      label: 'Video Poster',
      description: 'Poster-style media block flattened into the final PDF.',
      width: 320,
      height: 180,
      source: 'url',
      url: null,
      fit: 'cover',
      cornerRadius: 24,
      alt: 'Video poster frame',
    },
    {
      id: 'cinema-frame',
      label: 'Cinema Frame',
      description: 'Wider cinematic poster block.',
      width: 420,
      height: 220,
      source: 'url',
      url: null,
      fit: 'cover',
      cornerRadius: 30,
      alt: 'Cinema poster frame',
    },
  ];
  readonly shapePresets: ShapePreset[] = [
    { id: 'square', label: 'Square', description: 'Filled square block.', kind: 'shape', width: 140, height: 140, shapeKind: 'rectangle', fill: '#ffffff', stroke: '#2b3337', strokeWidth: 0, cornerRadius: 0, previewClass: 'is-square' },
    { id: 'rounded', label: 'Rounded', description: 'Soft rounded rectangle.', kind: 'shape', width: 220, height: 140, shapeKind: 'rectangle', fill: '#ffffff', stroke: '#2b3337', strokeWidth: 0, cornerRadius: 32, previewClass: 'is-rounded' },
    { id: 'circle', label: 'Circle', description: 'Filled ellipse.', kind: 'shape', width: 150, height: 150, shapeKind: 'ellipse', fill: '#ffffff', stroke: '#2b3337', strokeWidth: 0, cornerRadius: 999, previewClass: 'is-circle' },
    { id: 'outline-square', label: 'Outline', description: 'Square outline.', kind: 'shape', width: 180, height: 120, shapeKind: 'rectangle', fill: 'transparent', stroke: '#f6f7f8', strokeWidth: 3, cornerRadius: 8, previewClass: 'is-outline-square' },
    { id: 'outline-circle', label: 'Ring', description: 'Circle outline.', kind: 'shape', width: 160, height: 160, shapeKind: 'ellipse', fill: 'transparent', stroke: '#f6f7f8', strokeWidth: 3, cornerRadius: 999, previewClass: 'is-outline-circle' },
    { id: 'pill', label: 'Pill', description: 'Capsule badge form.', kind: 'shape', width: 240, height: 88, shapeKind: 'rectangle', fill: '#ffffff', stroke: '#2b3337', strokeWidth: 0, cornerRadius: 999, previewClass: 'is-pill' },
    { id: 'divider', label: 'Line', description: 'Simple horizontal rule.', kind: 'divider', width: 260, height: 1, stroke: '#f6f7f8', strokeWidth: 2, dashed: false, previewClass: 'is-line' },
    { id: 'dashed-divider', label: 'Dashed', description: 'Light dashed divider.', kind: 'divider', width: 260, height: 1, stroke: '#f6f7f8', strokeWidth: 2, dashed: true, previewClass: 'is-dashed-line' },
  ];
  readonly vectorPresets: ShapePreset[] = [
    { id: 'wash', label: 'Wash', description: 'Soft highlight wash.', kind: 'shape', width: 280, height: 120, shapeKind: 'rectangle', fill: '#c46f6733', stroke: 'transparent', strokeWidth: 0, cornerRadius: 48, previewClass: 'is-soft-wash' },
    { id: 'bubble', label: 'Bubble', description: 'Circular accent bubble.', kind: 'shape', width: 140, height: 140, shapeKind: 'ellipse', fill: '#8ca46f55', stroke: 'transparent', strokeWidth: 0, cornerRadius: 999, previewClass: 'is-bubble' },
    { id: 'panel', label: 'Panel', description: 'Muted framing block.', kind: 'shape', width: 320, height: 180, shapeKind: 'rectangle', fill: '#ffffff14', stroke: '#f6f7f830', strokeWidth: 1, cornerRadius: 28, previewClass: 'is-panel' },
    { id: 'badge', label: 'Badge', description: 'Rounded accent badge.', kind: 'shape', width: 180, height: 90, shapeKind: 'rectangle', fill: '#ffffff', stroke: '#2b3337', strokeWidth: 0, cornerRadius: 999, previewClass: 'is-badge' },
  ];
  readonly morePresets: BlockPreset[] = [
    { id: 'repeater', label: 'Line Items', description: 'Dynamic repeating line-item region.', type: 'repeater' },
    { id: 'totals', label: 'Totals', description: 'Investment card with subtotal, tax, and total.', type: 'totals' },
    { id: 'divider', label: 'Divider', description: 'Quick decorative divider line.', type: 'divider' },
    { id: 'image', label: 'Image Placeholder', description: 'Generic image frame for imported media.', type: 'image' },
  ];
  readonly defaultSolidColors: string[] = [
    '#000000',
    '#6b6b6b',
    '#8f8f8f',
    '#b2b2b2',
    '#c6c6c6',
    '#d9d9d9',
    '#ffffff',
    '#ff4c4c',
    '#ff6464',
    '#f05bb3',
    '#d69ae8',
    '#b86adf',
    '#8b5cf6',
    '#5b21d8',
    '#1ba6c8',
    '#28b8da',
    '#59d4e1',
    '#44b0f1',
    '#4f75f4',
    '#175fc9',
    '#2614bb',
    '#17bf6b',
    '#7ed957',
    '#bbf95b',
    '#f8d75b',
    '#ffc15b',
    '#ff9b52',
    '#ff7a1f',
  ];
  readonly defaultGradientColors: string[] = [
    'linear-gradient(135deg, #111111, #5d5d5d)',
    'linear-gradient(135deg, #5e5e5e, #f1f1f1)',
    'linear-gradient(135deg, #f7f7f7, #c9c9c9)',
    'linear-gradient(135deg, #baf368, #6ccf4c)',
    'linear-gradient(135deg, #2d1a00, #c7a300)',
    'linear-gradient(135deg, #7741a8, #ffcf59)',
    'linear-gradient(135deg, #191933, #3a1ccf)',
    'linear-gradient(135deg, #d8fff5, #a1c5ff)',
    'linear-gradient(135deg, #ff8d52, #ff443d)',
    'linear-gradient(135deg, #ff5abf, #7b62ff)',
    'linear-gradient(135deg, #4b40ff, #d26eff)',
    'linear-gradient(135deg, #4c50ff, #4ac4ff)',
    'linear-gradient(135deg, #7950f2, #18c79c)',
    'linear-gradient(135deg, #34d399, #bdf75e)',
    'linear-gradient(135deg, #17c4f5, #f7d04f)',
    'linear-gradient(135deg, #ffaf52, #ff80bf)',
    'linear-gradient(135deg, #ffe7c7, #ff9ed6)',
    'linear-gradient(135deg, #7d4bff, #ff9e5c)',
  ];

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly uploadingAssets = signal(false);
  readonly canvaLoading = signal(false);
  readonly canvaConnecting = signal(false);
  readonly canvaLoadingDesigns = signal(false);
  readonly error = signal<string | null>(null);
  readonly template = signal<DocumentTemplate | null>(null);
  readonly templateName = signal('');
  readonly document = signal<ProposalTemplateDocument | null>(null);
  readonly assets = signal<ProposalTemplateEditorAsset[]>([]);
  readonly canvaImports = signal<ProposalTemplateCanvaImportSummary[]>([]);
  readonly canvaStatus = signal<CanvaConnectionStatus>({ connected: false, scopes: [] });
  readonly canvaQuery = signal('');
  readonly canvaDesigns = signal<CanvaDesignSummary[]>([]);
  readonly canvaContinuation = signal<string | null>(null);
  readonly canvaImportingDesignId = signal<string | null>(null);
  readonly selectedPageId = signal<string | null>(null);
  readonly selectedNodeId = signal<string | null>(null);
  readonly selectedNodeIds = signal<string[]>([]);
  readonly previewMode = signal<'design' | 'sample'>('sample');
  readonly dirty = signal(false);
  readonly lastDraftSavedAt = signal<string | null>(null);
  readonly publishedAt = signal<string | null>(null);
  readonly textEditor = signal<TextEditorState | null>(null);
  readonly selectedTableCell = signal<TableCellSelection | null>(null);
  readonly toolbarPopover = signal<ToolbarPopover | null>(null);
  readonly colorDrawer = signal<ColorDrawerState | null>(null);
  readonly colorDrawerSearch = signal('');
  readonly snapGuides = signal<SnapGuideState>({ vertical: [], horizontal: [] });
  readonly marqueeSelection = signal<MarqueeSelectionState | null>(null);
  readonly canvasZoom = signal(1);
  readonly placeholderSearch = signal('');
  readonly inspectorOpen = signal(false);
  readonly layersPanelOpen = signal(true);
  readonly activeSidebarTab = signal<StudioSidebarTab>('templates');
  readonly drawerOpen = signal(true);
  readonly tableInsertRows = signal(3);
  readonly tableInsertColumns = signal(3);
  readonly fileMenuOpen = signal(false);
  readonly versionHistoryOpen = signal(false);
  readonly fileActionBusy = signal<FileActionKey | null>(null);
  readonly dragInsertType = signal<string | null>(null);
  readonly canUndo = signal(false);
  readonly canRedo = signal(false);

  readonly pages = computed(() => this.document()?.pages ?? []);
  readonly currentPage = computed(() => {
    const pageId = this.selectedPageId();
    return this.pages().find((page) => page.id === pageId) ?? this.pages()[0] ?? null;
  });
  readonly orderedNodes = computed(() =>
    [...(this.currentPage()?.nodes ?? [])].sort((left, right) => left.zIndex - right.zIndex)
  );
  readonly selectedNode = computed(() => {
    const nodeId = this.selectedNodeId();
    return (this.currentPage()?.nodes ?? []).find((node) => node.id === nodeId) ?? null;
  });
  readonly selectedNodes = computed(() => {
    const page = this.currentPage();
    const selectedIds = this.selectedNodeIds();
    if (!page || !selectedIds.length) {
      return [] as ProposalTemplateNode[];
    }

    const nodeMap = new Map(page.nodes.map((node) => [node.id, node]));
    return selectedIds
      .map((nodeId) => nodeMap.get(nodeId) ?? null)
      .filter((node): node is ProposalTemplateNode => Boolean(node));
  });
  readonly singleSelectedNode = computed(() =>
    this.selectedNodeIds().length === 1 ? this.selectedNode() : null
  );
  readonly layerNodes = computed(() => [...this.orderedNodes()].reverse());
  readonly currentSidebarSection = computed(() => {
    const colorDrawer = this.colorDrawer();
    if (colorDrawer) {
      return {
        id: colorDrawer.previousTab,
        label: colorDrawer.title,
        shortLabel: 'Clr',
        description: 'Pick from document, brand, solid, or gradient swatches.',
      } satisfies StudioSidebarSection;
    }

    return this.sidebarSections.find((item) => item.id === this.activeSidebarTab()) ?? this.sidebarSections[0];
  });
  readonly canvaActionLabel = computed(() =>
    this.canvaStatus().connected ? 'Canva Library' : 'Connect Canva'
  );
  readonly versionHistory = computed(() =>
    this.proposalTemplateDocumentService.getVersionHistory(this.template())
  );
  readonly canvasZoomPercent = computed(() => Math.round(this.canvasZoom() * 100));
  readonly toolbarFontOptions = computed<ToolbarFontOption[]>(() => {
    const document = this.document();
    const options: ToolbarFontOption[] = [
      {
        label: 'Brand Heading',
        value: document?.theme.headingFontFamily ?? 'Cormorant Garamond, Georgia, serif',
      },
      {
        label: 'Brand Body',
        value: document?.theme.bodyFontFamily ?? 'Source Sans 3, Arial, sans-serif',
      },
      { label: 'Noto Sans', value: 'Noto Sans, Arial, sans-serif' },
      { label: 'Cormorant Garamond', value: 'Cormorant Garamond, Georgia, serif' },
      { label: 'Source Sans 3', value: 'Source Sans 3, Arial, sans-serif' },
      { label: 'Playfair Display', value: 'Playfair Display, Georgia, serif' },
      { label: 'Libre Baskerville', value: 'Libre Baskerville, Georgia, serif' },
      { label: 'Montserrat', value: 'Montserrat, Arial, sans-serif' },
    ];

    return options.filter(
      (option, index, collection) =>
        collection.findIndex((candidate) => candidate.value === option.value) === index
    );
  });
  readonly pageSizeLabel = computed(() => {
    const page = this.currentPage();
    return page ? `${page.width} x ${page.height} px` : '816 x 1056 px';
  });
  readonly workspaceSurfaceStyle = computed<Record<string, string>>(() => ({
    '--bb-right-reserve': this.layersPanelOpen() ? '344px' : '0px',
  }));
  readonly tableInsertToken = computed(
    () => `table:${this.tableInsertRows()}x${this.tableInsertColumns()}`
  );
  readonly canvasPageStageStyle = computed<Record<string, string>>(() => {
    const page = this.currentPage();
    const zoom = this.canvasZoom();
    if (!page) {
      return {} as Record<string, string>;
    }

    return {
      width: `${page.width * zoom}px`,
      height: `${page.height * zoom}px`,
    };
  });
  readonly canvasPageStyle = computed<Record<string, string>>(() => {
    const page = this.currentPage();
    const document = this.document();
    if (!page) {
      return {} as Record<string, string>;
    }

    return {
      width: `${page.width}px`,
      height: `${page.height}px`,
      background: document?.theme?.pageColor ?? '#ffffff',
      transform: `scale(${this.canvasZoom()})`,
    };
  });
  readonly selectedTextNode = computed(() =>
    this.singleSelectedNode()?.type === 'rich-text'
      ? (this.singleSelectedNode() as ProposalTemplateRichTextNode)
      : null
  );
  readonly selectedTableNode = computed(() =>
    this.singleSelectedNode()?.type === 'table'
      ? (this.singleSelectedNode() as ProposalTemplateTableNode)
      : null
  );
  readonly selectedTableCellData = computed(() => {
    const tableNode = this.selectedTableNode();
    const selection = this.selectedTableCell();
    if (!tableNode || !selection || selection.nodeId !== tableNode.id) {
      return null;
    }

    return tableNode.cells.find((cell) => cell.id === selection.cellId) ?? null;
  });
  readonly selectedTableCellTextContent = computed(() => {
    const cell = this.selectedTableCellData();
    return cell?.content.kind === 'text'
      ? (cell.content as ProposalTemplateTableCellTextContent)
      : null;
  });
  readonly selectedTextToolbarTarget = computed<TextToolbarTarget | null>(() =>
    this.selectedTextNode() ?? this.selectedTableCellTextContent()
  );
  readonly selectedShapeNode = computed(() =>
    this.singleSelectedNode()?.type === 'shape'
      ? (this.singleSelectedNode() as ProposalTemplateShapeNode)
      : null
  );
  readonly selectedDividerNode = computed(() =>
    this.singleSelectedNode()?.type === 'divider'
      ? (this.singleSelectedNode() as ProposalTemplateDividerNode)
      : null
  );
  readonly selectedRepeaterNode = computed(() =>
    this.singleSelectedNode()?.type === 'repeater'
      ? (this.singleSelectedNode() as ProposalTemplateRepeaterNode)
      : null
  );
  readonly selectedTotalsNode = computed(() =>
    this.singleSelectedNode()?.type === 'totals'
      ? (this.singleSelectedNode() as ProposalTemplateTotalsNode)
      : null
  );
  readonly documentColorSwatches = computed(() => {
    const document = this.document();
    const colorDrawer = this.colorDrawer();
    if (!document || !colorDrawer) {
      return [] as string[];
    }

    return this.collectDocumentColorSwatches(document, colorDrawer.allowGradients);
  });
  readonly brandKitColorSwatches = computed(() => {
    const document = this.document();
    if (!document) {
      return [] as string[];
    }

    return [
      document.theme.primaryColor,
      document.theme.accentColor,
      document.theme.borderColor,
      document.theme.pageColor,
      document.theme.canvasColor,
      document.theme.mutedColor,
    ].filter((value, index, collection) => collection.indexOf(value) === index);
  });
  readonly colorDrawerAllowsGradients = computed(() => this.colorDrawer()?.allowGradients ?? false);
  readonly activeColorDrawerValue = computed(() => this.getActiveColorDrawerValue());
  readonly previewData = computed(() => {
    const document = this.document();
    return document
      ? this.proposalTemplateDocumentService.buildSamplePreviewData(document)
      : null;
  });
  readonly rendererLabel = computed(() => {
    const template = this.template();
    return getProposalRendererOption(resolveTemplateRendererKey(template))?.label ?? 'Event Standard';
  });
  readonly placeholderGroups = computed(() => {
    const search = this.placeholderSearch().trim().toLowerCase();
    const grouped = new Map<string, typeof this.proposalTemplateDocumentService.placeholderDefinitions>();

    this.proposalTemplateDocumentService.placeholderDefinitions.forEach((definition) => {
      if (
        search &&
        !definition.label.toLowerCase().includes(search) &&
        !definition.key.toLowerCase().includes(search)
      ) {
        return;
      }

      const group = grouped.get(definition.category) ?? [];
      group.push(definition);
      grouped.set(definition.category, group);
    });

    return Array.from(grouped.entries()).map(([category, items]) => ({ category, items }));
  });
  readonly transformBoxStyle = computed<Record<string, string> | null>(() => {
    const node = this.singleSelectedNode();
    if (!node || this.textEditor()?.nodeId === node.id) return null;

    return {
      left: `${node.x}px`,
      top: `${node.y}px`,
      width: `${node.width}px`,
      height: `${node.height}px`,
      transform: `rotate(${node.rotation}deg)`,
      zIndex: String(node.zIndex + 5),
    };
  });
  readonly marqueeSelectionStyle = computed<Record<string, string> | null>(() => {
    const marquee = this.marqueeSelection();
    if (!marquee) {
      return null;
    }

    return {
      left: `${Math.min(marquee.startX, marquee.currentX)}px`,
      top: `${Math.min(marquee.startY, marquee.currentY)}px`,
      width: `${Math.abs(marquee.currentX - marquee.startX)}px`,
      height: `${Math.abs(marquee.currentY - marquee.startY)}px`,
    };
  });

  ngOnInit(): void {
    void this.loadTemplate();
  }

  ngOnDestroy(): void {
    this.stopCanvaPopupWatch();
    this.canvaPopup?.close();
    this.canvaPopup = null;
  }

  async loadTemplate(): Promise<void> {
    const templateId = this.route.snapshot.paramMap.get('templateId');
    if (!templateId) {
      this.error.set('We could not find a proposal template to open.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const template = await this.templateRepository.getDocumentTemplateById(templateId);
      if (!template) {
        this.error.set('We could not find this proposal template.');
        return;
      }

      const storedConfig = this.proposalTemplateDocumentService.getStoredConfig(template);
      const refreshedAssets = storedConfig?.assets?.length
        ? await this.templateService.refreshTemplateAssets(storedConfig.assets)
        : [];
      const document = this.proposalTemplateDocumentService.applyResolvedAssetUrls(
        this.proposalTemplateDocumentService.getDraftDocument(template),
        refreshedAssets
      );
      this.template.set(template);
      this.templateName.set(template.name);
      this.document.set(document);
      this.assets.set(refreshedAssets);
      this.canvaImports.set(storedConfig?.canva_imports ?? []);
      this.setSelection(
        document.pages[0]?.id ?? null,
        document.pages[0]?.nodes[0]?.id ? [document.pages[0].nodes[0].id] : [],
        document.pages[0]?.nodes[0]?.id ?? null
      );
      this.lastDraftSavedAt.set(storedConfig?.draft_document?.metadata?.updatedAt ?? null);
      this.publishedAt.set(storedConfig?.published_at ?? null);
      this.dirty.set(false);
      this.fileMenuOpen.set(false);
      this.versionHistoryOpen.set(false);
      this.resetHistory();
    } catch (error) {
      console.error('[ProposalTemplateStudioComponent] loadTemplate error:', error);
      this.error.set('We were unable to load the proposal template editor right now.');
    } finally {
      this.loading.set(false);
      await this.loadCanvaStatus();
    }
  }

  async saveDraft(): Promise<void> {
    await this.persist(false);
  }

  async publishTemplate(): Promise<void> {
    await this.persist(true);
  }

  async openTemplateList(): Promise<void> {
    await this.router.navigate(['/admin/proposal-templates']);
  }

  async reload(): Promise<void> {
    await this.loadTemplate();
  }

  toggleFileMenu(event?: MouseEvent): void {
    event?.stopPropagation();
    this.fileMenuOpen.update((open) => !open);
  }

  closeFileMenu(): void {
    this.fileMenuOpen.set(false);
  }

  openVersionHistory(): void {
    this.fileMenuOpen.set(false);
    this.versionHistoryOpen.set(true);
  }

  closeVersionHistory(): void {
    this.versionHistoryOpen.set(false);
  }

  isFileActionBusy(action?: FileActionKey): boolean {
    const busy = this.fileActionBusy();
    return action ? busy === action : busy !== null;
  }

  async createNewDesign(): Promise<void> {
    const template = this.template();
    if (!template || this.isFileActionBusy()) {
      return;
    }

    if (
      this.dirty() &&
      !window.confirm(
        'This design has unsaved edits. Create a new design without saving this one first?'
      )
    ) {
      return;
    }

    const baseName = this.templateName().trim() || template.name || 'Untitled Design';
    const nextName = `${baseName} New Design`;

    try {
      this.fileActionBusy.set('create');
      this.fileMenuOpen.set(false);

      const created = await this.templateService.createDocumentTemplate({
        name: nextName,
        template_key: this.buildTemplateKey(nextName),
        template_kind: template.template_kind,
        is_active: true,
        is_default: false,
        logo_storage_path: template.logo_storage_path ?? null,
        logo_url: template.logo_url ?? null,
        template_config: this.buildBaseTemplateConfig(template),
      });

      this.toast.showToast('New design created.', 'success');
      await this.router.navigate(['/admin/proposal-templates', created.template_id, 'studio']);
    } catch (error) {
      console.error('[ProposalTemplateStudioComponent] createNewDesign error:', error);
      this.toast.showToast('We were unable to create a new design right now.', 'error');
    } finally {
      this.fileActionBusy.set(null);
    }
  }

  openUploadFiles(): void {
    if (this.isFileActionBusy() || this.uploadingAssets()) {
      return;
    }

    this.fileMenuOpen.set(false);
    this.activeSidebarTab.set('uploads');
    this.drawerOpen.set(true);
    this.triggerUploadPicker();
  }

  async saveFromFileMenu(): Promise<void> {
    this.fileMenuOpen.set(false);
    await this.saveDraft();
  }

  async makeFileCopy(): Promise<void> {
    const template = this.template();
    const document = this.document();
    if (!template || !document || this.isFileActionBusy()) {
      return;
    }

    const baseName = this.templateName().trim() || template.name || 'Untitled Design';
    const copyName = `${baseName} Copy`;
    const documentForCopy: ProposalTemplateDocument = {
      ...document,
      name: copyName,
      status: 'draft',
    };
    const storedConfig = this.proposalTemplateDocumentService.buildDraftConfig(
      documentForCopy,
      null,
      this.assets(),
      this.canvaImports()
    );

    try {
      this.fileActionBusy.set('copy');
      this.fileMenuOpen.set(false);

      const created = await this.templateService.createDocumentTemplate({
        name: copyName,
        template_key: this.buildTemplateKey(copyName),
        template_kind: template.template_kind,
        is_active: true,
        is_default: false,
        logo_storage_path: template.logo_storage_path ?? null,
        logo_url: template.logo_url ?? null,
        template_config: this.proposalTemplateDocumentService.buildTemplateConfig(
          {
            ...template,
            template_config: this.buildBaseTemplateConfig(template),
          },
          storedConfig
        ),
      });

      this.toast.showToast('Design copy created.', 'success');
      await this.router.navigate(['/admin/proposal-templates', created.template_id, 'studio']);
    } catch (error) {
      console.error('[ProposalTemplateStudioComponent] makeFileCopy error:', error);
      this.toast.showToast('We were unable to copy this design right now.', 'error');
    } finally {
      this.fileActionBusy.set(null);
    }
  }

  downloadCurrentDesign(): void {
    const template = this.template();
    const document = this.document();
    if (!template || !document || this.isFileActionBusy()) {
      return;
    }

    this.fileMenuOpen.set(false);

    const exportName = this.templateName().trim() || template.name;
    const payload = {
      schema_version: 'proposal-template-editor-export-1.0',
      exported_at: new Date().toISOString(),
      template: {
        template_id: template.template_id,
        name: exportName,
        template_key: template.template_key,
        template_kind: template.template_kind,
        renderer_key: resolveTemplateRendererKey(template),
      },
      document: this.cloneDocument({
        ...document,
        name: exportName,
      }),
      assets: this.cloneValue(this.assets()),
      canva_imports: this.cloneValue(this.canvaImports()),
    };

    this.downloadJsonFile(
      payload,
      `${this.slugifyName(exportName)}.bb-design.json`
    );
    this.toast.showToast('Design package downloaded.', 'success');
  }

  restoreVersion(version: ProposalTemplateEditorVersionEntry): void {
    const restoredDocument = this.proposalTemplateDocumentService.applyResolvedAssetUrls(
      this.cloneDocument(version.document),
      this.assets()
    );

    this.versionHistoryOpen.set(false);
    this.templateName.set(restoredDocument.name);
    this.setSelection(
      restoredDocument.pages[0]?.id ?? null,
      restoredDocument.pages[0]?.nodes[0]?.id ? [restoredDocument.pages[0].nodes[0].id] : [],
      restoredDocument.pages[0]?.nodes[0]?.id ?? null
    );
    this.textEditor.set(null);
    this.toolbarPopover.set(null);
    this.updateDocument(restoredDocument);
    this.toast.showToast(
      version.kind === 'published'
        ? 'Published version restored into the editor.'
        : 'Saved draft version restored into the editor.',
      'success'
    );
  }

  downloadVersion(version: ProposalTemplateEditorVersionEntry): void {
    const template = this.template();
    if (!template) {
      return;
    }

    this.downloadJsonFile(
      {
        schema_version: 'proposal-template-editor-version-export-1.0',
        exported_at: new Date().toISOString(),
        template: {
          template_id: template.template_id,
          name: template.name,
          template_key: template.template_key,
          version_id: version.id,
        },
        version: this.cloneValue(version),
      },
      `${this.slugifyName(`${template.name}-${version.kind}-v${version.document.metadata.version}`)}.json`
    );
  }

  async moveToTrash(): Promise<void> {
    const template = this.template();
    const document = this.document();
    if (!template || !document || this.isFileActionBusy()) {
      return;
    }

    const nextName = this.templateName().trim() || template.name;
    if (
      !window.confirm(
        `Move "${nextName}" to trash? It will be hidden from the templates list until restored from storage.`
      )
    ) {
      return;
    }

    try {
      this.fileActionBusy.set('trash');
      this.fileMenuOpen.set(false);

      const previous = this.proposalTemplateDocumentService.getStoredConfig(template);
      const storedConfig = this.proposalTemplateDocumentService.buildDraftConfig(
        {
          ...document,
          name: nextName,
        },
        previous,
        this.assets(),
        this.canvaImports()
      );
      storedConfig.draft_document.status = 'archived';
      storedConfig.trashed_at = new Date().toISOString();

      await this.templateService.updateDocumentTemplate(template.template_id, {
        name: nextName,
        is_active: false,
        template_config: this.proposalTemplateDocumentService.buildTemplateConfig(
          template,
          storedConfig
        ),
      });

      this.toast.showToast('Design moved to trash.', 'success');
      await this.router.navigate(['/admin/proposal-templates']);
    } catch (error) {
      console.error('[ProposalTemplateStudioComponent] moveToTrash error:', error);
      this.toast.showToast('We were unable to move this design to trash right now.', 'error');
    } finally {
      this.fileActionBusy.set(null);
    }
  }

  renameTemplate(value: string): void {
    this.templateName.set(value);
    this.dirty.set(true);
  }

  selectSidebarTab(tab: StudioSidebarTab): void {
    this.colorDrawer.set(null);
    this.colorDrawerSearch.set('');

    if (this.activeSidebarTab() === tab && this.drawerOpen()) {
      this.drawerOpen.set(false);
      return;
    }

    this.activeSidebarTab.set(tab);
    this.drawerOpen.set(true);

    if (tab === 'templates' && this.canvaStatus().connected && !this.canvaDesigns().length) {
      void this.loadCanvaDesigns(true);
    }
  }

  toggleSidebarDrawer(): void {
    this.drawerOpen.update((open) => !open);
  }

  openColorDrawer(target: ColorDrawerTarget, event?: MouseEvent): void {
    event?.stopPropagation();

    const titleMap: Record<ColorDrawerTarget, string> = {
      'text-color': 'Text color',
      'shape-fill': 'Fill color',
      'shape-stroke': 'Border color',
      'divider-stroke': 'Stroke color',
      'table-cell-background': 'Cell background',
      'table-cell-stroke': 'Cell border',
      'table-cell-text': 'Cell text color',
    };
    const allowGradients =
      target === 'shape-fill' || target === 'table-cell-background';

    this.toolbarPopover.set(null);
    this.colorDrawerSearch.set('');
    this.colorDrawer.set({
      target,
      title: titleMap[target],
      previousTab: this.activeSidebarTab(),
      allowGradients,
    });
    this.drawerOpen.set(true);
  }

  closeColorDrawer(): void {
    this.colorDrawer.set(null);
    this.colorDrawerSearch.set('');
  }

  applyColorDrawerColor(color: string): void {
    const drawer = this.colorDrawer();
    if (!drawer || !color) {
      return;
    }

    switch (drawer.target) {
      case 'text-color':
        this.setSelectedTextColor(color);
        break;
      case 'shape-fill':
        this.setSelectedShapeFill(color);
        break;
      case 'shape-stroke':
      case 'divider-stroke':
        this.setSelectedStrokeColor(color);
        break;
      case 'table-cell-background':
        this.setSelectedTableCellBackground(color);
        break;
      case 'table-cell-stroke':
        this.setSelectedTableCellStrokeColor(color);
        break;
      case 'table-cell-text':
        this.setSelectedTableCellTextColor(color);
        break;
      default:
        break;
    }
  }

  applyCustomColorDrawerColor(): void {
    const drawer = this.colorDrawer();
    const value = this.colorDrawerSearch().trim();
    if (!drawer || !value) {
      return;
    }

    const isValid = drawer.allowGradients
      ? this.isValidCssBackground(value)
      : this.isValidCssColor(value);
    if (!isValid) {
      this.toast.showToast('That does not look like a valid color value.', 'error');
      return;
    }

    this.applyColorDrawerColor(value);
  }

  isColorSwatchActive(color: string): boolean {
    return this.normalizeColorValue(color) === this.normalizeColorValue(this.activeColorDrawerValue());
  }

  selectPage(pageId: string): void {
    const page = this.pages().find((candidate) => candidate.id === pageId);
    this.setSelection(pageId, page?.nodes[0]?.id ? [page.nodes[0].id] : [], page?.nodes[0]?.id ?? null);
    this.textEditor.set(null);
  }

  selectNode(pageId: string, nodeId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.textEditor() && this.textEditor()?.nodeId !== nodeId) {
      this.commitTextEditor();
    }
    this.toolbarPopover.set(null);

    if (event && (event.ctrlKey || event.metaKey || event.shiftKey)) {
      this.toggleNodeSelection(pageId, nodeId);
      return;
    }

    this.setSelection(pageId, [nodeId], nodeId);
  }

  clearSelection(): void {
    if (this.textEditor()) {
      this.commitTextEditor();
    }
    this.toolbarPopover.set(null);
    this.setSelection(this.selectedPageId(), [], null);
  }

  toggleInspector(): void {
    this.inspectorOpen.update((open) => !open);
  }

  toggleLayersPanel(): void {
    this.layersPanelOpen.update((open) => !open);
  }

  isNodeSelected(nodeId: string): boolean {
    return this.selectedNodeIds().includes(nodeId);
  }

  selectTableCell(pageId: string, nodeId: string, cellId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (
      this.textEditor() &&
      (this.textEditor()?.nodeId !== nodeId || this.textEditor()?.cellId !== cellId)
    ) {
      this.commitTextEditor();
    }

    this.toolbarPopover.set(null);
    this.setSelection(pageId, [nodeId], nodeId);
    this.selectedTableCell.set({ nodeId, cellId });
  }

  startCanvasMarquee(
    event: MouseEvent,
    page: ProposalTemplatePage,
    pageElement: HTMLElement
  ): void {
    if (event.button !== 0 || event.target !== pageElement) {
      return;
    }

    if (this.textEditor()) {
      this.commitTextEditor();
    }

    const rect = pageElement.getBoundingClientRect();
    const zoom = this.canvasZoom();
    const startX = this.clamp((event.clientX - rect.left) / zoom, 0, page.width);
    const startY = this.clamp((event.clientY - rect.top) / zoom, 0, page.height);
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    const baseSelectionIds =
      additive && this.selectedPageId() === page.id ? [...this.selectedNodeIds()] : [];

    event.preventDefault();
    this.toolbarPopover.set(null);
    this.selectedPageId.set(page.id);
    this.marqueeSelection.set({
      pageId: page.id,
      pageLeft: rect.left,
      pageTop: rect.top,
      pageWidth: page.width,
      pageHeight: page.height,
      zoom,
      startX,
      startY,
      currentX: startX,
      currentY: startY,
      additive,
      baseSelectionIds,
    });
  }

  addPage(kind: ProposalTemplatePage['kind'] = 'static'): void {
    const document = this.document();
    if (!document) return;

    const pageId = this.createId('page');
    const page: ProposalTemplatePage = {
      id: pageId,
      name: kind === 'continuation-template' ? 'Continuation Page' : `Page ${document.pages.length + 1}`,
      width: 816,
      height: 1056,
      kind,
      continuationSourcePageId:
        kind === 'continuation-template' ? document.pages[0]?.id ?? null : null,
      background: { fill: document.theme.pageColor },
      nodes: [],
    };

    this.updateDocument({
      ...document,
      pages: [...document.pages, page],
    });
    this.setSelection(pageId, [], null);
  }

  addNode(type: ProposalTemplateNode['type'], placement?: NodePlacementOptions): void {
    const document = this.document();
    const pageId = placement?.pageId ?? this.currentPage()?.id;
    const page = document?.pages.find((candidate) => candidate.id === pageId);
    if (!page || !document) return;

    const frame = this.getDefaultNodeFrame(type);
    const x = this.clamp(
      Math.round(placement?.x ?? 92),
      0,
      Math.max(0, page.width - frame.width)
    );
    const y = this.clamp(
      Math.round(placement?.y ?? 110),
      0,
      Math.max(0, page.height - frame.height)
    );

    const baseNode = {
      id: this.createId('node'),
      name: this.getDefaultNodeName(type),
      pageId: page.id,
      x,
      y,
      width: frame.width,
      height: frame.height,
      rotation: 0,
      zIndex: page.nodes.length + 1,
      opacity: 1,
      visible: true,
      locked: false,
    };

    let node: ProposalTemplateNode;

    switch (type) {
      case 'shape':
        node = {
          ...baseNode,
          type: 'shape',
          shapeKind: 'rectangle',
          fill: `${document.theme.accentColor}22`,
          stroke: `${document.theme.primaryColor}18`,
          strokeStyle: 'solid',
          strokeWidth: 1,
          cornerRadius: 24,
        };
        break;
      case 'divider':
        node = {
          ...baseNode,
          type: 'divider',
          height: 1,
          stroke: `${document.theme.primaryColor}28`,
          strokeWidth: 1,
          dashed: false,
        };
        break;
      case 'table':
        node = {
          ...baseNode,
          type: 'table',
          rows: 3,
          columns: 3,
          cells: this.buildTableCells(3, 3, document),
        };
        break;
      case 'image':
        node = {
          ...baseNode,
          type: 'image',
          source: 'binding',
          bindingKey: 'brand.logo_url',
          url: null,
          asset_id: null,
          storage_path: null,
          fit: 'contain',
          cornerRadius: 18,
          alt: 'Image',
        };
        break;
      case 'repeater':
        node = {
          ...baseNode,
          type: 'repeater',
          sourceKey: 'proposal.line_items',
          direction: 'vertical',
          rowGap: 12,
          showHeader: true,
          headerHeight: 40,
          headerColumns: [
            { key: 'item', label: 'Line Items', width: 330, align: 'left' },
            { key: 'qty', label: 'Qty', width: 70, align: 'right' },
            { key: 'unit', label: 'Unit', width: 90, align: 'right' },
            { key: 'total', label: 'Total', width: 100, align: 'right' },
          ],
          rowTemplate: {
            heightMode: 'fixed',
            minHeight: 84,
            nodes: [
              {
                id: this.createId('row-node'),
                type: 'rich-text',
                name: 'Item Name',
                x: 0,
                y: 0,
                width: 320,
                height: 28,
                zIndex: 1,
                content: this.proposalTemplateDocumentService.parseSegments('{{item.name}}'),
                align: 'left',
                color: document.theme.primaryColor,
                fontFamily: document.theme.headingFontFamily,
                fontSize: 20,
                fontWeight: '600',
                fontStyle: 'normal',
                underline: false,
                strikethrough: false,
                textTransform: 'none',
                lineHeight: 1.1,
                letterSpacing: 0.2,
              },
            ],
          },
          pagination: {
            repeatHeaderOnContinuation: true,
            keepTotalsWithLastRows: true,
          },
          background: `${document.theme.primaryColor}04`,
          borderColor: `${document.theme.primaryColor}12`,
          borderWidth: 1,
          headerBackground: `${document.theme.accentColor}15`,
          rowBackground: '#ffffff',
          headerTextColor: document.theme.primaryColor,
        };
        break;
      case 'totals':
        node = {
          ...baseNode,
          type: 'totals',
          title: 'Investment',
          fields: [
            { key: 'subtotal', label: 'Subtotal' },
            { key: 'tax', label: 'Tax' },
            { key: 'total', label: 'Total', emphasis: true },
          ],
          anchor: 'absolute',
          followNodeId: null,
          padding: 20,
          rowGap: 10,
          background: '#ffffff',
          borderColor: `${document.theme.primaryColor}18`,
          borderWidth: 1,
          textColor: document.theme.primaryColor,
          accentColor: document.theme.accentColor,
          radius: 24,
        };
        break;
      case 'group':
        node = {
          ...baseNode,
          type: 'group',
          childIds: [],
        };
        break;
      case 'rich-text':
      default:
        node = {
          ...baseNode,
          type: 'rich-text',
          content: this.proposalTemplateDocumentService.parseSegments('New text block'),
          align: 'left',
          color: document.theme.primaryColor,
          fontFamily: document.theme.bodyFontFamily,
          fontSize: 18,
          fontWeight: '500',
          fontStyle: 'normal',
          underline: false,
          strikethrough: false,
          textTransform: 'none',
          lineHeight: 1.45,
          letterSpacing: 0,
          listStyle: 'none',
        };
        break;
    }

    if (placement?.overrides) {
      node = {
        ...node,
        ...placement.overrides,
        id: node.id,
        pageId: page.id,
        type: node.type,
      } as ProposalTemplateNode;
    }

    const nextPage = {
      ...page,
      nodes: [...page.nodes, node],
    };
    this.patchPage(nextPage);
    this.setSelection(page.id, [node.id], node.id);

    if (type === 'rich-text' || placement?.openEditor) {
      this.openTextEditor(node);
    }
  }

  insertTextPreset(preset: TextPreset, placement?: NodePlacementOptions): void {
    const document = this.document();
    if (!document) return;

    this.addNode('rich-text', {
      ...placement,
      openEditor: true,
      overrides: {
        name: preset.label,
        width: preset.width,
        height: preset.height,
        content: this.proposalTemplateDocumentService.parseSegments(preset.content),
        fontSize: preset.fontSize,
        fontWeight: preset.fontWeight,
        lineHeight: preset.lineHeight,
        letterSpacing: preset.letterSpacing,
        align: preset.align,
        fontFamily:
          preset.family === 'heading'
            ? document.theme.headingFontFamily
            : document.theme.bodyFontFamily,
        color: document.theme.primaryColor,
        fontStyle: 'normal',
        underline: false,
        strikethrough: false,
        textTransform: 'none',
        listStyle: 'none',
      },
    });
  }

  insertMediaPreset(preset: MediaPreset, placement?: NodePlacementOptions): void {
    this.addNode('image', {
      ...placement,
      overrides: {
        name: preset.label,
        width: preset.width,
        height: preset.height,
        source: preset.source,
        bindingKey: preset.bindingKey ?? null,
        url: preset.url ?? null,
        asset_id: null,
        storage_path: null,
        fit: preset.fit,
        cornerRadius: preset.cornerRadius,
        alt: preset.alt,
      },
    });
  }

  insertShapePreset(preset: ShapePreset, placement?: NodePlacementOptions): void {
    if (preset.kind === 'divider') {
      this.addNode('divider', {
        ...placement,
        overrides: {
          name: preset.label,
          width: preset.width,
          height: preset.height,
          stroke: preset.stroke ?? '#d7dfe5',
          strokeWidth: preset.strokeWidth ?? 1,
          dashed: preset.dashed ?? false,
        },
      });
      return;
    }

    this.addNode('shape', {
      ...placement,
      overrides: {
        name: preset.label,
        width: preset.width,
        height: preset.height,
        shapeKind: preset.shapeKind ?? 'rectangle',
        fill: preset.fill ?? '#ffffff',
        stroke: preset.stroke ?? 'transparent',
        strokeStyle: 'solid',
        strokeWidth: preset.strokeWidth ?? 0,
        cornerRadius: preset.cornerRadius ?? 0,
      },
    });
  }

  insertConfiguredTable(placement?: NodePlacementOptions): void {
    const document = this.document();
    if (!document) {
      return;
    }

    const rows = this.clamp(Math.round(this.tableInsertRows()), 1, 12);
    const columns = this.clamp(Math.round(this.tableInsertColumns()), 1, 8);
    const defaultFrame = this.getDefaultNodeFrame('table');
    const width = Math.max(defaultFrame.width, columns * 140);
    const height = Math.max(defaultFrame.height, rows * 64);

    this.addNode('table', {
      ...placement,
      overrides: {
        name: `${rows} x ${columns} Table`,
        width,
        height,
        rows,
        columns,
        cells: this.buildTableCells(rows, columns, document),
      } as Partial<ProposalTemplateTableNode>,
    });
  }

  insertBlockPreset(preset: BlockPreset, placement?: NodePlacementOptions): void {
    this.addNode(preset.type, {
      ...placement,
      overrides: {
        name: preset.label,
      },
    });
  }

  insertUploadedAsset(asset: ProposalTemplateEditorAsset, placement?: NodePlacementOptions): void {
    this.addNode('image', {
      ...placement,
      overrides: {
        name: asset.alt || 'Uploaded Asset',
        width: 260,
        height: 180,
        source: 'url',
        url: asset.url,
        asset_id: asset.id,
        storage_path: asset.storage_path,
        fit: 'cover',
        cornerRadius: 24,
        alt: asset.alt || 'Uploaded asset',
      },
    });
  }

  setTableInsertRows(value: number | string): void {
    this.tableInsertRows.set(this.clamp(Math.round(this.coerceNumber(value, this.tableInsertRows())), 1, 12));
  }

  setTableInsertColumns(value: number | string): void {
    this.tableInsertColumns.set(this.clamp(Math.round(this.coerceNumber(value, this.tableInsertColumns())), 1, 8));
  }

  deleteSelectedNode(): void {
    const page = this.currentPage();
    const selectedIds = this.selectedNodeIds();
    if (!page || !selectedIds.length) return;

    this.patchPage({
      ...page,
      nodes: page.nodes.filter((candidate) => !selectedIds.includes(candidate.id)),
    });
    if (this.textEditor() && selectedIds.includes(this.textEditor()!.nodeId)) {
      this.textEditor.set(null);
    }
    this.toolbarPopover.set(null);
    this.setSelection(page.id, [], null);
  }

  duplicateSelectedNode(): void {
    const page = this.currentPage();
    const selectedNodes = this.selectedNodes();
    if (!page || !selectedNodes.length) return;

    const clones = selectedNodes.map((node, index) => ({
      ...JSON.parse(JSON.stringify(node)),
      id: this.createId('node'),
      pageId: page.id,
      name: `${node.name} Copy`,
      x: this.clamp(node.x + 20, 0, Math.max(0, page.width - node.width)),
      y: this.clamp(node.y + 20, 0, Math.max(0, page.height - node.height)),
      zIndex: page.nodes.length + index + 1,
    })) as ProposalTemplateNode[];

    this.patchPage({
      ...page,
      nodes: [...page.nodes, ...clones],
    });
    this.setSelection(
      page.id,
      clones.map((clone) => clone.id),
      clones[clones.length - 1]?.id ?? null
    );
  }

  bringForward(): void {
    this.bumpSelectedNodeZIndex(1);
  }

  sendBackward(): void {
    this.bumpSelectedNodeZIndex(-1);
  }

  startNodeDrag(event: MouseEvent, node: ProposalTemplateNode): void {
    event.stopPropagation();
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (node.locked) return;
    if (this.textEditor()) {
      this.commitTextEditor();
    }

    this.beginDragHistoryCapture();

    this.dragState = {
      mode: 'move',
      pageId: node.pageId,
      nodeId: node.id,
      startX: event.clientX,
      startY: event.clientY,
      nodeX: node.x,
      nodeY: node.y,
      width: node.width,
      height: node.height,
      rotation: node.rotation,
    };
    this.setSelection(node.pageId, [node.id], node.id);
  }

  startNodeResize(event: MouseEvent, node: ProposalTemplateNode, handle: ResizeHandle = 'se'): void {
    event.stopPropagation();
    if (node.locked) return;
    if (this.textEditor()) {
      this.commitTextEditor();
    }

    this.beginDragHistoryCapture();

    this.dragState = {
      mode: 'resize',
      pageId: node.pageId,
      nodeId: node.id,
      startX: event.clientX,
      startY: event.clientY,
      nodeX: node.x,
      nodeY: node.y,
      width: node.width,
      height: node.height,
      rotation: node.rotation,
      handle,
    };
  }

  startNodeRotate(event: MouseEvent, node: ProposalTemplateNode): void {
    event.stopPropagation();
    if (node.locked) return;
    if (this.textEditor()) {
      this.commitTextEditor();
    }

    const pageElement = (event.currentTarget as HTMLElement)?.closest('.bb-canvas-page');
    const pageRect = pageElement?.getBoundingClientRect();
    if (!pageRect) {
      return;
    }

    this.beginDragHistoryCapture();

    this.dragState = {
      mode: 'rotate',
      pageId: node.pageId,
      nodeId: node.id,
      startX: event.clientX,
      startY: event.clientY,
      nodeX: node.x,
      nodeY: node.y,
      width: node.width,
      height: node.height,
      rotation: node.rotation,
      centerX: pageRect.left + node.x + node.width / 2,
      centerY: pageRect.top + node.y + node.height / 2,
    };
    this.setSelection(node.pageId, [node.id], node.id);
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(event: MouseEvent): void {
    const marquee = this.marqueeSelection();
    if (!this.dragState && marquee) {
      const nextMarquee: MarqueeSelectionState = {
        ...marquee,
        currentX: this.clamp(
          (event.clientX - marquee.pageLeft) / marquee.zoom,
          0,
          marquee.pageWidth
        ),
        currentY: this.clamp(
          (event.clientY - marquee.pageTop) / marquee.zoom,
          0,
          marquee.pageHeight
        ),
      };
      this.marqueeSelection.set(nextMarquee);
      const selectionIds = this.getMarqueeSelectionIds(nextMarquee);
      this.setSelection(
        nextMarquee.pageId,
        selectionIds,
        selectionIds[selectionIds.length - 1] ?? null
      );
      return;
    }

    if (!this.dragState) return;

    const screenDeltaX = event.clientX - this.dragState.startX;
    const screenDeltaY = event.clientY - this.dragState.startY;
    const zoom = this.canvasZoom();
    const deltaX = screenDeltaX / zoom;
    const deltaY = screenDeltaY / zoom;
    const node = this.selectedNode();
    const page = this.currentPage();

    if (!node || !page || node.id !== this.dragState.nodeId) {
      return;
    }

    if (this.dragState.mode === 'move') {
      const rawX = this.clamp(
        Math.round(this.dragState.nodeX + deltaX),
        0,
        Math.max(0, page.width - node.width)
      );
      const rawY = this.clamp(
        Math.round(this.dragState.nodeY + deltaY),
        0,
        Math.max(0, page.height - node.height)
      );
      const snapped = this.snapMovePosition(page, node.id, rawX, rawY, node.width, node.height);
      const nextX = snapped.x;
      const nextY = snapped.y;
      if (node.x === nextX && node.y === nextY) {
        return;
      }

      this.dragDidMutate = true;
      this.snapGuides.set(snapped.guides);
      this.patchSelectedNode(
        {
          x: nextX,
          y: nextY,
        },
        { trackHistory: false }
      );
      return;
    }

    if (this.dragState.mode === 'rotate') {
      const centerX = this.dragState.centerX ?? event.clientX;
      const centerY = this.dragState.centerY ?? event.clientY;
      let nextRotation = Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI) + 90;
      if (nextRotation < 0) {
        nextRotation += 360;
      }

      const snappedRotation = Math.round(nextRotation / 15) * 15;
      if (!event.altKey && Math.abs(snappedRotation - nextRotation) <= 4) {
        nextRotation = snappedRotation;
      }

      if (node.rotation === nextRotation) {
        return;
      }

      this.dragDidMutate = true;
      this.snapGuides.set({ vertical: [], horizontal: [] });
      this.patchSelectedNode({ rotation: nextRotation }, { trackHistory: false });
      return;
    }

    const handle = this.dragState.handle ?? 'se';
    const minWidth = 48;
    const minHeight = node.type === 'divider' ? 1 : 32;
    let nextX = this.dragState.nodeX;
    let nextY = this.dragState.nodeY;
    let nextWidth = this.dragState.width;
    let nextHeight = this.dragState.height;

    if (handle.includes('e')) {
      nextWidth = Math.max(minWidth, Math.round(this.dragState.width + deltaX));
    }

    if (handle.includes('s')) {
      nextHeight = Math.max(minHeight, Math.round(this.dragState.height + deltaY));
    }

    if (handle.includes('w')) {
      const proposedX = Math.round(this.dragState.nodeX + deltaX);
      const right = this.dragState.nodeX + this.dragState.width;
      nextX = this.clamp(proposedX, 0, right - minWidth);
      nextWidth = Math.max(minWidth, Math.round(right - nextX));
    }

    if (handle.includes('n')) {
      const proposedY = Math.round(this.dragState.nodeY + deltaY);
      const bottom = this.dragState.nodeY + this.dragState.height;
      nextY = this.clamp(proposedY, 0, bottom - minHeight);
      nextHeight = Math.max(minHeight, Math.round(bottom - nextY));
    }

    const snappedRect = this.snapResizeRect(page, node.id, {
      x: nextX,
      y: nextY,
      width: nextWidth,
      height: nextHeight,
    }, handle, minWidth, minHeight);
    nextX = snappedRect.x;
    nextY = snappedRect.y;
    nextWidth = snappedRect.width;
    nextHeight = snappedRect.height;

    if (
      node.x === nextX &&
      node.y === nextY &&
      node.width === nextWidth &&
      node.height === nextHeight
    ) {
      return;
    }

    this.dragDidMutate = true;
    this.snapGuides.set(snappedRect.guides);
    this.patchSelectedNode(
      {
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
      },
      { trackHistory: false }
    );
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    const marquee = this.marqueeSelection();
    if (marquee) {
      const distance =
        Math.abs(marquee.currentX - marquee.startX) +
        Math.abs(marquee.currentY - marquee.startY);
      if (distance < 4) {
        if (marquee.additive) {
          this.setSelection(
            marquee.pageId,
            marquee.baseSelectionIds,
            marquee.baseSelectionIds[marquee.baseSelectionIds.length - 1] ?? null
          );
        } else {
          this.setSelection(marquee.pageId, [], null);
        }
      } else {
        const selectionIds = this.getMarqueeSelectionIds(marquee);
        this.setSelection(
          marquee.pageId,
          selectionIds,
          selectionIds[selectionIds.length - 1] ?? null
        );
      }
      this.marqueeSelection.set(null);
    }

    if (this.dragState && this.dragDidMutate) {
      this.pushHistorySnapshot(this.dragHistorySnapshot);
    }

    this.dragState = null;
    this.dragHistorySnapshot = null;
    this.dragDidMutate = false;
    this.snapGuides.set({ vertical: [], horizontal: [] });
  }

  @HostListener('window:mousedown', ['$event'])
  onWindowMouseDown(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('.bb-context-toolbar')) {
      this.toolbarPopover.set(null);
    }
    if (!target?.closest('.bb-file-menu')) {
      this.fileMenuOpen.set(false);
    }
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeyDown(event: KeyboardEvent): void {
    if (this.isTypingTarget(event.target)) {
      if (event.key === 'Escape' && this.textEditor()) {
        event.preventDefault();
        this.cancelTextEditor();
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && this.textEditor()) {
        event.preventDefault();
        this.commitTextEditor();
      }

      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        this.redo();
      } else {
        this.undo();
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      this.redo();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && this.selectedNodes().length) {
      event.preventDefault();
      this.copySelectedNodesToClipboard();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'x' && this.selectedNodes().length) {
      event.preventDefault();
      this.copySelectedNodesToClipboard();
      this.deleteSelectedNode();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v' && this.clipboardNodes.length) {
      event.preventDefault();
      this.pasteClipboardNodes();
      return;
    }

    if (event.key === 'Escape') {
      if (this.versionHistoryOpen()) {
        this.versionHistoryOpen.set(false);
        return;
      }
      if (this.fileMenuOpen()) {
        this.fileMenuOpen.set(false);
        return;
      }
      if (this.toolbarPopover()) {
        this.toolbarPopover.set(null);
        return;
      }
      if (this.colorDrawer()) {
        this.closeColorDrawer();
        return;
      }
      this.dragInsertType.set(null);
      this.marqueeSelection.set(null);
      this.clearSelection();
      this.inspectorOpen.set(false);
      return;
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && this.selectedNodes().length) {
      event.preventDefault();
      this.deleteSelectedNode();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && this.selectedNodes().length) {
      event.preventDefault();
      this.duplicateSelectedNode();
      return;
    }

    if (event.key === 'Enter' && this.selectedTextNode()) {
      event.preventDefault();
      this.openTextEditor(this.selectedTextNode()!);
      return;
    }

    if (event.key === 'Enter' && this.selectedTableNode() && this.selectedTableCellTextContent()) {
      event.preventDefault();
      this.focusSelectedTableCellEditor();
      return;
    }

    const distance = event.shiftKey ? 10 : 1;
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.nudgeSelectedNode(-distance, 0);
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.nudgeSelectedNode(distance, 0);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.nudgeSelectedNode(0, -distance);
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.nudgeSelectedNode(0, distance);
        break;
      default:
        break;
    }
  }

  openTextEditor(node: ProposalTemplateNode, event?: MouseEvent): void {
    event?.stopPropagation();
    if (node.type !== 'rich-text') return;

    this.setSelection(node.pageId, [node.id], node.id);
    this.textEditor.set({
      mode: 'node',
      pageId: node.pageId,
      nodeId: node.id,
      value: this.proposalTemplateDocumentService.serializeSegments(node.content),
    });
    this.focusTextEditor();
  }

  openTableCellEditor(
    tableNode: ProposalTemplateTableNode,
    cell: ProposalTemplateTableCell,
    event?: MouseEvent
  ): void {
    event?.stopPropagation();
    if (cell.content.kind !== 'text') {
      return;
    }

    this.setSelection(tableNode.pageId, [tableNode.id], tableNode.id);
    this.selectedTableCell.set({ nodeId: tableNode.id, cellId: cell.id });
    this.textEditor.set({
      mode: 'table-cell',
      pageId: tableNode.pageId,
      nodeId: tableNode.id,
      cellId: cell.id,
      value: this.proposalTemplateDocumentService.serializeSegments(cell.content.content),
    });
    this.focusTextEditor();
  }

  commitTextEditor(): void {
    const editor = this.textEditor();
    const node = this.findNode(editor?.pageId, editor?.nodeId);
    if (!editor || !node) {
      this.textEditor.set(null);
      return;
    }

    const value = this.readTextEditorValue();
    if (editor.mode === 'table-cell' && node.type === 'table') {
      const cell = node.cells.find((candidate) => candidate.id === editor.cellId);
      if (cell?.content.kind === 'text') {
        this.patchTableCell(
          node.pageId,
          node.id,
          cell.id,
          {
            content: {
              ...cell.content,
              content: this.proposalTemplateDocumentService.parseSegments(value),
            },
          }
        );
      }
      this.textEditor.set(null);
      return;
    }

    if (node.type !== 'rich-text') {
      this.textEditor.set(null);
      return;
    }

    const height = Math.max(node.height, this.measureTextEditorHeight(value, node));
    this.patchNode(editor.pageId, editor.nodeId, {
      content: this.proposalTemplateDocumentService.parseSegments(value),
      height,
    });
    this.textEditor.set(null);
  }

  cancelTextEditor(): void {
    this.textEditor.set(null);
  }

  insertPlaceholder(key: string): void {
    const editor = this.textEditor();
    if (!editor) {
      const textNode = this.selectedTextNode();
      if (textNode) {
        this.openTextEditor(textNode);
        queueMicrotask(() => this.insertPlaceholder(key));
        return;
      }

      const tableNode = this.selectedTableNode();
      const cell = this.selectedTableCellData();
      if (!tableNode || !cell || cell.content.kind !== 'text') {
        return;
      }

      this.openTableCellEditor(tableNode, cell);
      queueMicrotask(() => this.insertPlaceholder(key));
      return;
    }

    const token = `{{${key}}}`;
    const element = this.richTextEditor?.nativeElement;
    if (!element) {
      return;
    }

    this.insertTextAtCursor(element, token);
    this.syncTextEditorValueFromDom();
  }

  onTextEditorInput(): void {
    this.syncTextEditorValueFromDom();
  }

  onTextEditorKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelTextEditor();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.commitTextEditor();
    }
  }

  startInsertDrag(token: string, event: DragEvent): void {
    this.dragInsertType.set(token);
    event.dataTransfer?.setData('text/plain', token);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
    }
  }

  endInsertDrag(): void {
    this.dragInsertType.set(null);
  }

  allowInsertDrop(event: DragEvent): void {
    if (!this.dragInsertType()) return;

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  dropInsertOnPage(event: DragEvent, page: ProposalTemplatePage): void {
    const token = this.dragInsertType();
    const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    if (!token || !target) return;

    event.preventDefault();
    const rect = target.getBoundingClientRect();
    const zoom = this.canvasZoom();
    this.resolveInsertToken(token, {
      pageId: page.id,
      x: (event.clientX - rect.left) / zoom - 24,
      y: (event.clientY - rect.top) / zoom - 24,
    });
    this.dragInsertType.set(null);
  }

  onCanvasWheel(event: WheelEvent): void {
    if (!(event.ctrlKey || event.metaKey)) {
      return;
    }

    const scroller = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    const rect = scroller?.getBoundingClientRect();
    const previousZoom = this.canvasZoom();
    const direction = event.deltaY < 0 ? 1 : -1;
    const nextZoom = this.clamp(
      Number((previousZoom + direction * 0.1).toFixed(2)),
      0.4,
      2.5
    );

    if (nextZoom === previousZoom) {
      event.preventDefault();
      return;
    }

    event.preventDefault();

    const pointerOffsetX = rect ? event.clientX - rect.left : 0;
    const pointerOffsetY = rect ? event.clientY - rect.top : 0;
    const scrollAnchorX = (scroller?.scrollLeft ?? 0) + pointerOffsetX;
    const scrollAnchorY = (scroller?.scrollTop ?? 0) + pointerOffsetY;
    const scaleRatio = nextZoom / previousZoom;

    this.canvasZoom.set(nextZoom);

    if (scroller) {
      requestAnimationFrame(() => {
        scroller.scrollLeft = Math.max(0, scrollAnchorX * scaleRatio - pointerOffsetX);
        scroller.scrollTop = Math.max(0, scrollAnchorY * scaleRatio - pointerOffsetY);
      });
    }
  }

  focusSelectedTextEditor(): void {
    const textNode = this.selectedTextNode();
    if (textNode) {
      this.openTextEditor(textNode);
      return;
    }

    const tableNode = this.selectedTableNode();
    const cell = this.selectedTableCellData();
    if (!tableNode || !cell || cell.content.kind !== 'text') {
      return;
    }

    this.openTableCellEditor(tableNode, cell);
  }

  adjustSelectedTextFontSize(delta: number): void {
    const target = this.selectedTextToolbarTarget();
    if (!target) return;

    this.patchSelectedTextTarget({
      fontSize: Math.max(10, target.fontSize + delta),
    });
  }

  setSelectedTextAlign(align: ProposalTemplateRichTextNode['align']): void {
    if (!this.selectedTextToolbarTarget()) return;

    this.patchSelectedTextTarget({ align });
  }

  cycleSelectedTextAlign(): void {
    const target = this.selectedTextToolbarTarget();
    if (!target) {
      return;
    }

    const order: ProposalTemplateRichTextNode['align'][] = ['left', 'center', 'right'];
    const currentIndex = order.indexOf(target.align ?? 'left');
    const nextAlign = order[(currentIndex + 1) % order.length];
    this.patchSelectedTextTarget({ align: nextAlign });
  }

  getSelectedTextAlignIcon() {
    const align = this.selectedTextToolbarTarget()?.align ?? 'left';
    switch (align) {
      case 'center':
        return this.iconAlignCenter;
      case 'right':
        return this.iconAlignRight;
      case 'left':
      default:
        return this.iconAlignLeft;
    }
  }

  getSelectedTextAlignTooltip(): string {
    const align = this.selectedTextToolbarTarget()?.align ?? 'left';
    switch (align) {
      case 'center':
        return 'Alignment: center';
      case 'right':
        return 'Alignment: right';
      case 'left':
      default:
        return 'Alignment: left';
    }
  }

  setSelectedTextFontFamily(fontFamily: string): void {
    if (!this.selectedTextToolbarTarget() || !fontFamily) return;

    this.patchSelectedTextTarget({ fontFamily });
  }

  setSelectedTextFontSize(value: number | string): void {
    const target = this.selectedTextToolbarTarget();
    if (!target) return;

    const fontSize = this.coerceNumber(value, target.fontSize);
    this.patchSelectedTextTarget({
      fontSize: this.clamp(Math.round(fontSize), 10, 240),
    });
  }

  toggleSelectedTextBold(): void {
    const target = this.selectedTextToolbarTarget();
    if (!target) return;

    this.patchSelectedTextTarget({
      fontWeight: Number(target.fontWeight) >= 600 ? '400' : '700',
    });
  }

  toggleSelectedTextItalic(): void {
    const target = this.selectedTextToolbarTarget();
    if (!target) return;

    this.patchSelectedTextTarget({
      fontStyle: (target.fontStyle ?? 'normal') === 'italic' ? 'normal' : 'italic',
    });
  }

  toggleSelectedTextUnderline(): void {
    const target = this.selectedTextToolbarTarget();
    if (!target) return;

    this.patchSelectedTextTarget({ underline: !target.underline });
  }

  toggleSelectedTextStrikethrough(): void {
    const target = this.selectedTextToolbarTarget();
    if (!target) return;

    this.patchSelectedTextTarget({ strikethrough: !target.strikethrough });
  }

  toggleSelectedTextUppercase(): void {
    const target = this.selectedTextToolbarTarget();
    if (!target) return;

    this.patchSelectedTextTarget({
      textTransform: (target.textTransform ?? 'none') === 'uppercase' ? 'none' : 'uppercase',
    });
  }

  setSelectedTextColor(color: string): void {
    if (!this.selectedTextToolbarTarget() || !color) return;

    this.patchSelectedTextTarget({ color });
  }

  setSelectedTextLetterSpacing(value: number | string): void {
    const target = this.selectedTextToolbarTarget();
    if (!target) return;

    const letterSpacing = this.coerceNumber(value, target.letterSpacing);
    this.patchSelectedTextTarget({
      letterSpacing: this.clamp(Math.round(letterSpacing * 10) / 10, -2, 24),
    });
  }

  toggleSelectedTextListStyle(
    listStyle: Exclude<ProposalTemplateTextListStyle, 'none'>
  ): void {
    if (!this.selectedTextToolbarTarget()) {
      return;
    }

    this.patchSelectedTextTarget({
      listStyle: this.getSelectedTextListStyle() === listStyle ? 'none' : listStyle,
    });
  }

  getSelectedTextListStyle(): ProposalTemplateTextListStyle {
    return this.selectedTextToolbarTarget()?.listStyle ?? 'none';
  }

  openSelectedTextColorDrawer(event?: MouseEvent): void {
    if (this.selectedTextNode()) {
      this.openColorDrawer('text-color', event);
      return;
    }

    if (this.selectedTableCellTextContent()) {
      this.openColorDrawer('table-cell-text', event);
    }
  }

  toggleToolbarPopover(popover: ToolbarPopover, event?: MouseEvent): void {
    event?.stopPropagation();
    this.toolbarPopover.update((current) => (current === popover ? null : popover));
  }

  closeToolbarPopover(): void {
    this.toolbarPopover.set(null);
  }

  isToolbarPopoverOpen(popover: ToolbarPopover): boolean {
    return this.toolbarPopover() === popover;
  }

  setSelectedNodeOpacity(value: number | string): void {
    const node = this.selectedNode();
    if (!node) return;

    const percent = this.coerceNumber(value, Math.round(node.opacity * 100));
    this.patchSelectedNode({
      opacity: this.clamp(percent, 0, 100) / 100,
    });
  }

  setSelectedShapeFill(color: string): void {
    const node = this.selectedShapeNode();
    if (!node || !color) return;

    this.patchSelectedNode({ fill: color });
  }

  setSelectedShapeStrokeStyle(style: ProposalTemplateShapeStrokeStyle): void {
    const node = this.selectedShapeNode();
    if (!node) return;

    this.patchSelectedNode({ strokeStyle: style });
  }

  getSelectedShapeStrokeStyle(): ProposalTemplateShapeStrokeStyle {
    return this.selectedShapeNode()?.strokeStyle ?? 'solid';
  }

  setSelectedStrokeColor(color: string): void {
    const node = this.selectedShapeNode() ?? this.selectedDividerNode();
    if (!node || !color) return;

    this.patchSelectedNode({ stroke: color });
  }

  setSelectedStrokeWidth(value: number | string): void {
    const node = this.selectedShapeNode() ?? this.selectedDividerNode();
    if (!node) return;

    const strokeWidth = this.coerceNumber(value, node.strokeWidth);
    this.patchSelectedNode({
      strokeWidth: this.clamp(Math.round(strokeWidth), 0, 24),
    });
  }

  setSelectedShapeCornerRadius(value: number | string): void {
    const node = this.selectedShapeNode();
    if (!node) return;

    const cornerRadius = this.coerceNumber(value, node.cornerRadius);
    this.patchSelectedNode({
      cornerRadius: this.clamp(Math.round(cornerRadius), 0, 240),
    });
  }

  setSelectedDividerStrokeStyle(style: 'solid' | 'dashed'): void {
    const node = this.selectedDividerNode();
    if (!node) return;

    this.patchSelectedNode({ dashed: style === 'dashed' });
  }

  getSelectedDividerStrokeStyle(): 'solid' | 'dashed' {
    return this.selectedDividerNode()?.dashed ? 'dashed' : 'solid';
  }

  focusSelectedTableCellEditor(): void {
    const tableNode = this.selectedTableNode();
    const cell = this.selectedTableCellData();
    if (!tableNode || !cell || cell.content.kind !== 'text') {
      return;
    }

    this.openTableCellEditor(tableNode, cell);
  }

  setSelectedTableCellBackground(color: string): void {
    const cell = this.selectedTableCellData();
    if (!cell || !color) return;

    this.patchSelectedTableCell({ background: color });
  }

  setSelectedTableCellStrokeColor(color: string): void {
    const cell = this.selectedTableCellData();
    if (!cell || !color) return;

    this.patchSelectedTableCell({ stroke: color });
  }

  setSelectedTableCellStrokeWidth(value: number | string): void {
    const cell = this.selectedTableCellData();
    if (!cell) return;

    const strokeWidth = this.coerceNumber(value, cell.strokeWidth);
    this.patchSelectedTableCell({
      strokeWidth: this.clamp(Math.round(strokeWidth), 0, 24),
    });
  }

  setSelectedTableCellTextColor(color: string): void {
    if (!this.selectedTableCellTextContent() || !color) {
      return;
    }

    this.patchSelectedTextTarget({ color });
  }

  getNodeOpacityPercent(node: ProposalTemplateNode | null): number {
    return Math.round((node?.opacity ?? 1) * 100);
  }

  isSelectedTextBold(): boolean {
    const target = this.selectedTextToolbarTarget();
    return Number(target?.fontWeight ?? 0) >= 600;
  }

  triggerUploadPicker(): void {
    this.uploadInput?.nativeElement.click();
  }

  async onUploadFilesSelected(event: Event): Promise<void> {
    const template = this.template();
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const files = input?.files ? Array.from(input.files) : [];
    if (!template || !files.length) {
      return;
    }

    try {
      this.uploadingAssets.set(true);
      const uploadedAssets: ProposalTemplateEditorAsset[] = [];

      for (const file of files) {
        const asset = await this.templateService.uploadTemplateAsset(
          template.template_id,
          file,
          'image'
        );
        uploadedAssets.push(asset);
      }

      this.assets.update((assets) => [...uploadedAssets, ...assets]);
      this.dirty.set(true);
      this.toast.showToast(
        uploadedAssets.length === 1 ? 'Asset uploaded to the template library.' : 'Assets uploaded to the template library.',
        'success'
      );
    } catch (error) {
      console.error('[ProposalTemplateStudioComponent] upload asset error:', error);
      this.toast.showToast('We were unable to upload those assets right now.', 'error');
    } finally {
      this.uploadingAssets.set(false);
      if (input) {
        input.value = '';
      }
    }
  }

  async removeUploadedAsset(asset: ProposalTemplateEditorAsset, event?: MouseEvent): Promise<void> {
    event?.stopPropagation();

    try {
      await this.templateService.removeTemplateAsset(asset.storage_path);
      this.assets.update((assets) => assets.filter((candidate) => candidate.id !== asset.id));
      this.dirty.set(true);
      this.toast.showToast('Asset removed from the template library.', 'success');
    } catch (error) {
      console.error('[ProposalTemplateStudioComponent] remove asset error:', error);
      this.toast.showToast('We were unable to remove that asset right now.', 'error');
    }
  }

  toggleNodeVisibility(node: ProposalTemplateNode, event?: MouseEvent): void {
    event?.stopPropagation();
    this.patchNode(node.pageId, node.id, { visible: !node.visible });
  }

  toggleNodeLocked(node: ProposalTemplateNode, event?: MouseEvent): void {
    event?.stopPropagation();
    this.patchNode(node.pageId, node.id, { locked: !node.locked });
  }

  async showCanvaImportSetup(): Promise<void> {
    this.activeSidebarTab.set('templates');
    this.drawerOpen.set(true);
    if (this.canvaStatus().connected) {
      await this.loadCanvaDesigns(true);
      return;
    }

    await this.startCanvaConnection();
  }

  async startCanvaConnection(): Promise<void> {
    if (this.canvaConnecting()) {
      return;
    }

    try {
      this.canvaConnecting.set(true);
      this.canvaPopupFlowResolved = false;
      const result = await this.canvaService.startConnection(window.location.origin);
      this.canvaMessageOrigin = result.callback_origin;
      this.canvaPopup = window.open(
        result.authorization_url,
        'bb-canva-oauth',
        'popup=yes,width=640,height=860,resizable=yes,scrollbars=yes'
      );

      if (!this.canvaPopup) {
        throw new Error('The Canva popup was blocked by your browser.');
      }

      this.beginCanvaPopupWatch();
    } catch (error) {
      console.error('[ProposalTemplateStudioComponent] start Canva connection error:', error);
      this.stopCanvaPopupWatch();
      this.toast.showToast(
        error instanceof Error ? error.message : 'We could not start Canva sign-in right now.',
        'error'
      );
    } finally {
      this.canvaConnecting.set(false);
    }
  }

  async disconnectCanva(): Promise<void> {
    try {
      this.canvaLoading.set(true);
      await this.canvaService.disconnect();
      this.canvaStatus.set({ connected: false, scopes: [] });
      this.canvaDesigns.set([]);
      this.canvaContinuation.set(null);
      this.toast.showToast('Canva was disconnected from the proposal studio.', 'success');
    } catch (error) {
      console.error('[ProposalTemplateStudioComponent] disconnect Canva error:', error);
      this.toast.showToast(
        error instanceof Error ? error.message : 'We could not disconnect Canva right now.',
        'error'
      );
    } finally {
      this.canvaLoading.set(false);
    }
  }

  async loadCanvaDesigns(reset = true): Promise<void> {
    if (!this.canvaStatus().connected || this.canvaLoadingDesigns()) {
      return;
    }

    try {
      this.canvaLoadingDesigns.set(true);
      const response = await this.canvaService.listDesigns(
        this.canvaQuery(),
        reset ? null : this.canvaContinuation()
      );
      this.canvaDesigns.set(
        reset ? response.items : [...this.canvaDesigns(), ...response.items]
      );
      this.canvaContinuation.set(response.continuation);
    } catch (error) {
      console.error('[ProposalTemplateStudioComponent] load Canva designs error:', error);
      this.toast.showToast(
        error instanceof Error ? error.message : 'We could not load Canva designs right now.',
        'error'
      );
    } finally {
      this.canvaLoadingDesigns.set(false);
    }
  }

  async importCanvaDesign(design: CanvaDesignSummary): Promise<void> {
    const template = this.template();
    if (!template || this.canvaImportingDesignId()) {
      return;
    }

    try {
      this.canvaImportingDesignId.set(design.id);
      const result = await this.canvaService.importDesign(template.template_id, design.id);
      this.applyCanvaImportResult(result);
      this.toast.showToast(`Imported "${design.title}" from Canva into new pages.`, 'success');
    } catch (error) {
      console.error('[ProposalTemplateStudioComponent] import Canva design error:', error);
      this.toast.showToast(
        error instanceof Error ? error.message : 'We could not import that Canva design right now.',
        'error'
      );
    } finally {
      this.canvaImportingDesignId.set(null);
    }
  }

  @HostListener('window:message', ['$event'])
  async onWindowMessage(event: MessageEvent): Promise<void> {
    const payload =
      event.data && typeof event.data === 'object'
        ? (event.data as { type?: string; status?: string; message?: string })
        : null;

    if (!payload || payload.type !== 'bb-canva-oauth') {
      return;
    }

    if (this.canvaMessageOrigin && event.origin !== this.canvaMessageOrigin) {
      return;
    }

    this.canvaPopup?.close();
    this.canvaPopup = null;

    if (payload.status === 'connected') {
      await this.handleCanvaConnectionSuccess(true);
      return;
    }

    if (payload.status === 'error') {
      this.canvaPopupFlowResolved = true;
      this.stopCanvaPopupWatch();
      this.toast.showToast(payload.message || 'Canva sign-in was not completed.', 'error');
    }
  }

  resolveInsertToken(token: string, placement?: NodePlacementOptions): void {
    if (token.startsWith('table:')) {
      const [, dimensions] = token.split(':');
      const [rowsToken, columnsToken] = dimensions?.split('x') ?? [];
      if (rowsToken && columnsToken) {
        this.setTableInsertRows(+rowsToken);
        this.setTableInsertColumns(+columnsToken);
      }
      this.insertConfiguredTable(placement);
      return;
    }

    if (token.startsWith('text:')) {
      const preset = this.textPresets.find((candidate) => candidate.id === token.slice(5));
      if (preset) {
        this.insertTextPreset(preset, placement);
      }
      return;
    }

    if (token.startsWith('image:')) {
      const preset = this.imagePresets.find((candidate) => candidate.id === token.slice(6));
      if (preset) {
        this.insertMediaPreset(preset, placement);
      }
      return;
    }

    if (token.startsWith('video:')) {
      const preset = this.videoPresets.find((candidate) => candidate.id === token.slice(6));
      if (preset) {
        this.insertMediaPreset(preset, placement);
      }
      return;
    }

    if (token.startsWith('shape:')) {
      const preset = this.shapePresets.find((candidate) => candidate.id === token.slice(6));
      if (preset) {
        this.insertShapePreset(preset, placement);
      }
      return;
    }

    if (token.startsWith('vector:')) {
      const preset = this.vectorPresets.find((candidate) => candidate.id === token.slice(7));
      if (preset) {
        this.insertShapePreset(preset, placement);
      }
      return;
    }

    if (token.startsWith('upload:')) {
      const asset = this.assets().find((candidate) => candidate.id === token.slice(7));
      if (asset) {
        this.insertUploadedAsset(asset, placement);
      }
      return;
    }

    if (token.startsWith('block:')) {
      const preset = this.morePresets.find((candidate) => candidate.id === token.slice(6));
      if (preset) {
        this.insertBlockPreset(preset, placement);
      }
      return;
    }

    if (token.startsWith('node:')) {
      const nodeType = token.slice(5) as InsertableNodeType;
      this.addNode(nodeType, {
        ...placement,
        openEditor: nodeType === 'rich-text',
      });
    }
  }

  patchSelectedNode(
    patch: Partial<ProposalTemplateNode>,
    options: DocumentMutationOptions = {}
  ): void {
    const page = this.currentPage();
    const node = this.selectedNode();
    if (!page || !node) return;

    this.patchPage(
      {
        ...page,
        nodes: page.nodes.map((candidate) =>
          candidate.id === node.id ? ({ ...candidate, ...patch } as ProposalTemplateNode) : candidate
        ),
      },
      options
    );
  }

  patchPage(page: ProposalTemplatePage, options: DocumentMutationOptions = {}): void {
    const document = this.document();
    if (!document) return;

    this.updateDocument(
      {
        ...document,
        pages: document.pages.map((candidate) => (candidate.id === page.id ? page : candidate)),
      },
      options
    );
  }

  updateDocument(
    document: ProposalTemplateDocument,
    options: DocumentMutationOptions = {}
  ): void {
    const current = this.document();
    if (current && this.documentsEqual(current, document)) {
      return;
    }

    if (options.trackHistory !== false && current) {
      this.pushHistorySnapshot(this.createHistorySnapshot(current));
    }

    this.document.set(document);
    this.dirty.set(true);
  }

  undo(): void {
    if (this.textEditor()) {
      this.commitTextEditor();
    }

    const previous = this.historyPast.pop();
    const current = this.createHistorySnapshot();
    if (!previous || !current) {
      if (previous) {
        this.historyPast.push(previous);
      }
      this.syncHistoryAvailability();
      return;
    }

    this.historyFuture.push(current);
    this.applyHistorySnapshot(previous);
    this.syncHistoryAvailability();
  }

  redo(): void {
    if (this.textEditor()) {
      this.commitTextEditor();
    }

    const next = this.historyFuture.pop();
    const current = this.createHistorySnapshot();
    if (!next || !current) {
      if (next) {
        this.historyFuture.push(next);
      }
      this.syncHistoryAvailability();
      return;
    }

    this.historyPast.push(current);
    this.applyHistorySnapshot(next);
    this.syncHistoryAvailability();
  }

  getNodeStyle(node: ProposalTemplateNode): Record<string, string | number> {
    return {
      left: `${node.x}px`,
      top: `${node.y}px`,
      width: `${node.width}px`,
      height: `${node.height}px`,
      opacity: node.opacity,
      transform: `rotate(${node.rotation}deg)`,
      zIndex: node.zIndex,
    };
  }

  getTextNodeStyle(node: ProposalTemplateNode): Record<string, string | number> {
    if (node.type !== 'rich-text') {
      return this.getNodeStyle(node);
    }

    return {
      ...this.getNodeStyle(node),
      color: node.color,
      fontFamily: node.fontFamily,
      fontSize: `${node.fontSize}px`,
      fontWeight: node.fontWeight,
      fontStyle: node.fontStyle ?? 'normal',
      lineHeight: node.lineHeight,
      letterSpacing: `${node.letterSpacing}px`,
      textAlign: node.align,
      textTransform: node.textTransform ?? 'none',
      textDecoration: this.getTextDecoration(node),
      whiteSpace: 'pre-wrap',
    };
  }

  getShapeStyle(node: ProposalTemplateNode): Record<string, string | number> {
    if (node.type !== 'shape') {
      return this.getNodeStyle(node);
    }

    return {
      ...this.getNodeStyle(node),
      background: node.fill,
      border: `${node.strokeWidth}px ${node.strokeStyle ?? 'solid'} ${node.stroke}`,
      borderRadius: node.shapeKind === 'ellipse' ? '999px' : `${node.cornerRadius}px`,
    };
  }

  getDividerStyle(node: ProposalTemplateNode): Record<string, string | number> {
    if (node.type !== 'divider') {
      return this.getNodeStyle(node);
    }

    return {
      ...this.getNodeStyle(node),
      borderTop: `${node.strokeWidth}px ${node.dashed ? 'dashed' : 'solid'} ${node.stroke}`,
      background: 'transparent',
    };
  }

  getImageNodeStyle(node: ProposalTemplateNode): Record<string, string | number> {
    if (node.type !== 'image') {
      return this.getNodeStyle(node);
    }

    return {
      ...this.getNodeStyle(node),
      borderRadius: `${node.cornerRadius}px`,
      backgroundImage: node.url ? `url(${node.url})` : 'none',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundSize:
        node.fit === 'contain' ? 'contain' : node.fit === 'stretch' ? '100% 100%' : 'cover',
    };
  }

  getTableStyle(node: ProposalTemplateNode): Record<string, string | number> {
    if (node.type !== 'table') {
      return this.getNodeStyle(node);
    }

    return {
      ...this.getNodeStyle(node),
      display: 'grid',
      gridTemplateColumns: `repeat(${node.columns}, minmax(0, 1fr))`,
      gridTemplateRows: `repeat(${node.rows}, minmax(0, 1fr))`,
      overflow: 'hidden',
    };
  }

  getTableCellStyle(cell: ProposalTemplateTableCell): Record<string, string | number> {
    return {
      gridColumn: String(cell.column + 1),
      gridRow: String(cell.row + 1),
      padding: `${cell.padding}px`,
      background: cell.background,
      border: `${cell.strokeWidth}px solid ${cell.stroke}`,
    };
  }

  getTableCellTextStyle(cell: ProposalTemplateTableCell): Record<string, string | number> {
    if (cell.content.kind !== 'text') {
      return {};
    }

    return {
      color: cell.content.color,
      fontFamily: cell.content.fontFamily,
      fontSize: `${cell.content.fontSize}px`,
      fontWeight: cell.content.fontWeight,
      fontStyle: cell.content.fontStyle ?? 'normal',
      lineHeight: cell.content.lineHeight,
      letterSpacing: `${cell.content.letterSpacing}px`,
      textAlign: cell.content.align,
      textTransform: cell.content.textTransform ?? 'none',
      textDecoration: this.getTextDecoration(cell.content),
    };
  }

  isSelectedTableCell(cellId: string): boolean {
    return this.selectedTableCellData()?.id === cellId;
  }

  getRepeaterStyle(node: ProposalTemplateNode): Record<string, string | number> {
    if (node.type !== 'repeater') {
      return this.getNodeStyle(node);
    }

    return {
      ...this.getNodeStyle(node),
      border: `${node.borderWidth}px solid ${node.borderColor}`,
      background: node.background,
    };
  }

  getTotalsStyle(node: ProposalTemplateNode): Record<string, string | number> {
    if (node.type !== 'totals') {
      return this.getNodeStyle(node);
    }

    return {
      ...this.getNodeStyle(node),
      background: node.background,
      border: `${node.borderWidth}px solid ${node.borderColor}`,
      borderRadius: `${node.radius}px`,
      color: node.textColor,
    };
  }

  getTextNodeRenderModel(node: ProposalTemplateNode): RenderedTextModel {
    if (node.type !== 'rich-text' || !this.previewData()) {
      return {
        kind: 'plain',
        text: '',
        items: [],
        markerWidth: '1.2em',
      };
    }

    return this.buildRenderedTextModel(
      this.proposalTemplateDocumentService.renderSegments(
        node.content,
        this.previewData()!,
        this.previewMode()
      ),
      node.listStyle ?? 'none'
    );
  }

  getTableCellTextRenderModel(cell: ProposalTemplateTableCell): RenderedTextModel {
    if (cell.content.kind !== 'text' || !this.previewData()) {
      return {
        kind: 'plain',
        text: '',
        items: [],
        markerWidth: '1.2em',
      };
    }

    return this.buildRenderedTextModel(
      this.proposalTemplateDocumentService.renderSegments(
        cell.content.content,
        this.previewData()!,
        this.previewMode()
      ),
      cell.content.listStyle ?? 'none'
    );
  }

  getTextNodeContent(node: ProposalTemplateNode): string {
    if (node.type !== 'rich-text' || !this.previewData()) {
      return '';
    }

    return this.proposalTemplateDocumentService.formatTextForDisplay(
      this.proposalTemplateDocumentService.renderSegments(
        node.content,
        this.previewData()!,
        this.previewMode()
      ),
      node.listStyle ?? 'none'
    );
  }

  getTableCellTextContent(cell: ProposalTemplateTableCell): string {
    if (cell.content.kind !== 'text' || !this.previewData()) {
      return '';
    }

    return this.proposalTemplateDocumentService.formatTextForDisplay(
      this.proposalTemplateDocumentService.renderSegments(
        cell.content.content,
        this.previewData()!,
        this.previewMode()
      ),
      cell.content.listStyle ?? 'none'
    );
  }

  getRepeaterPreviewItems(node: ProposalTemplateRepeaterNode): ProposalTemplatePreviewLineItem[] {
    const previewData = this.previewData();
    if (!previewData) return [];

    const rowHeight = node.rowTemplate.minHeight + node.rowGap;
    const usableHeight = node.height - (node.showHeader ? node.headerHeight : 0);
    const capacity = Math.max(1, Math.floor((usableHeight + node.rowGap) / rowHeight));
    return previewData.lineItems.slice(0, Math.min(capacity, 4));
  }

  getRepeaterRowTop(node: ProposalTemplateRepeaterNode, index: number): number {
    return (node.showHeader ? node.headerHeight : 0) + index * (node.rowTemplate.minHeight + node.rowGap);
  }

  getRepeaterChildText(
    childNode: ProposalTemplateRepeaterNode['rowTemplate']['nodes'][number],
    item: ProposalTemplatePreviewLineItem
  ): string {
    if (childNode.type !== 'rich-text' || !this.previewData()) {
      return '';
    }

    const scopedPreview = {
      ...this.previewData()!,
      values: {
        ...this.previewData()!.values,
        'item.name': item.name,
        'item.description': item.description,
        'item.quantity': item.quantity,
        'item.unit_price': item.unit_price,
        'item.total': item.total,
      },
    };

    return this.proposalTemplateDocumentService.renderSegments(
      childNode.content,
      scopedPreview,
      this.previewMode()
    );
  }

  getTotalsValue(key: ProposalTemplateTotalsNode['fields'][number]['key']): string {
    const totals = this.previewData()?.totals;
    if (!totals) return '';

    switch (key) {
      case 'subtotal':
        return totals.subtotal;
      case 'tax':
        return totals.tax;
      case 'deposit':
        return totals.deposit;
      case 'balance':
        return totals.balance;
      case 'total':
      default:
        return totals.total;
    }
  }

  updateRepeaterRowHeight(value: number): void {
    const repeater = this.selectedRepeaterNode();
    if (!repeater) return;

    this.patchSelectedNode({
      rowTemplate: {
        ...repeater.rowTemplate,
        minHeight: value,
      },
    });
  }

  getTextEditorStyle(): Record<string, string | number> {
    const editor = this.textEditor();
    const node = this.findNode(editor?.pageId, editor?.nodeId);
    if (!editor || !node) {
      return {};
    }

    if (editor.mode === 'table-cell' && node.type === 'table') {
      const cell = node.cells.find((candidate) => candidate.id === editor.cellId);
      if (!cell || cell.content.kind !== 'text') {
        return {};
      }

      const cellWidth = node.width / Math.max(1, node.columns);
      const cellHeight = node.height / Math.max(1, node.rows);

      return {
        left: `${node.x + cell.column * cellWidth}px`,
        top: `${node.y + cell.row * cellHeight}px`,
        width: `${Math.max(40, cellWidth)}px`,
        height: `${Math.max(40, cellHeight)}px`,
        fontFamily: cell.content.fontFamily,
        fontSize: `${cell.content.fontSize}px`,
        fontWeight: cell.content.fontWeight,
        fontStyle: cell.content.fontStyle ?? 'normal',
        lineHeight: String(cell.content.lineHeight),
        letterSpacing: `${cell.content.letterSpacing}px`,
        color: cell.content.color,
        textAlign: cell.content.align,
        textTransform: cell.content.textTransform ?? 'none',
        textDecoration: this.getTextDecoration(cell.content),
        padding: `${cell.padding}px`,
        border: `${cell.strokeWidth}px solid transparent`,
        minHeight: 'unset',
      };
    }

    if (node.type !== 'rich-text') {
      return {};
    }

    const liveHeight = this.measureTextEditorHeight(editor.value, node);

    return {
      left: `${node.x}px`,
      top: `${node.y}px`,
      width: `${node.width}px`,
      height: `${Math.max(node.height, liveHeight)}px`,
      fontFamily: node.fontFamily,
      fontSize: `${node.fontSize}px`,
      fontWeight: node.fontWeight,
      fontStyle: node.fontStyle ?? 'normal',
      lineHeight: String(node.lineHeight),
      letterSpacing: `${node.letterSpacing}px`,
      color: node.color,
      textAlign: node.align,
      textTransform: node.textTransform ?? 'none',
      textDecoration: this.getTextDecoration(node),
      padding: '0.3rem',
      border: '1px solid transparent',
    };
  }

  getTextDecoration(
    node:
      | Pick<ProposalTemplateRichTextNode, 'underline' | 'strikethrough'>
      | Pick<ProposalTemplateRepeaterRichTextNode, 'underline' | 'strikethrough'>
  ): string {
    const lines = [
      node.underline ? 'underline' : '',
      node.strikethrough ? 'line-through' : '',
    ].filter(Boolean);

    return lines.length ? lines.join(' ') : 'none';
  }

  getImageNodeLabel(node: ProposalTemplateNode): string {
    if (node.type !== 'image') {
      return '';
    }

    if (node.source === 'binding') {
      return node.bindingKey || 'Image binding';
    }

    return node.alt || 'Imported image';
  }

  private async persist(publish: boolean): Promise<void> {
    const template = this.template();
    const document = this.document();
    if (!template || !document) return;

    const nextName = this.templateName().trim() || template.name;
    const documentToPersist = {
      ...document,
      name: nextName,
    };
    const validationErrors = this.proposalTemplateDocumentService.validateDocument(documentToPersist);
    if (validationErrors.length) {
      this.toast.showToast(validationErrors[0], 'error');
      return;
    }

    try {
      this.saving.set(true);
      const previous = this.proposalTemplateDocumentService.getStoredConfig(template);
      const assets = this.assets();
      const canvaImports = this.canvaImports();
      const storedConfig = publish
        ? this.proposalTemplateDocumentService.buildPublishedConfig(
            documentToPersist,
            previous,
            assets,
            canvaImports
          )
        : this.proposalTemplateDocumentService.buildDraftConfig(
            documentToPersist,
            previous,
            assets,
            canvaImports
          );
      const updated = await this.templateService.updateDocumentTemplate(template.template_id, {
        name: nextName,
        template_config: this.proposalTemplateDocumentService.buildTemplateConfig(
          template,
          storedConfig
        ),
      });

      this.template.set(updated);
      this.templateName.set(updated.name);
      const refreshedStoredConfig = this.proposalTemplateDocumentService.getStoredConfig(updated);
      const refreshedAssets = refreshedStoredConfig?.assets?.length
        ? await this.templateService.refreshTemplateAssets(refreshedStoredConfig.assets)
        : [];
      this.document.set(
        this.proposalTemplateDocumentService.applyResolvedAssetUrls(
          this.proposalTemplateDocumentService.getDraftDocument(updated),
          refreshedAssets
        )
      );
      this.assets.set(refreshedAssets);
      this.canvaImports.set(refreshedStoredConfig?.canva_imports ?? []);
      this.lastDraftSavedAt.set(new Date().toISOString());
      this.publishedAt.set(refreshedStoredConfig?.published_at ?? null);
      this.dirty.set(false);
      this.dragState = null;
      this.dragHistorySnapshot = null;
      this.dragDidMutate = false;
      this.snapGuides.set({ vertical: [], horizontal: [] });
      this.toast.showToast(
        publish ? 'Template published to proposal rendering.' : 'Draft layout saved.',
        'success'
      );
    } catch (error) {
      console.error('[ProposalTemplateStudioComponent] persist error:', error);
      this.toast.showToast('We were unable to save this template right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  private bumpSelectedNodeZIndex(direction: number): void {
    const page = this.currentPage();
    const selectedIds = new Set(this.selectedNodeIds());
    if (!page || !selectedIds.size) return;

    this.patchPage({
      ...page,
      nodes: page.nodes.map((node) =>
        selectedIds.has(node.id)
          ? ({
              ...node,
              zIndex: Math.max(0, node.zIndex + direction),
            } as ProposalTemplateNode)
          : node
      ),
    });
  }

  private getDefaultNodeName(type: ProposalTemplateNode['type']): string {
    switch (type) {
      case 'shape':
        return 'Shape';
      case 'divider':
        return 'Divider';
      case 'table':
        return 'Table';
      case 'image':
        return 'Image';
      case 'repeater':
        return 'Line Items Repeater';
      case 'totals':
        return 'Totals';
      case 'group':
        return 'Group';
      case 'rich-text':
      default:
        return 'Text';
    }
  }

  private patchNode(
    pageId: string,
    nodeId: string,
    patch: Partial<ProposalTemplateNode>,
    options: DocumentMutationOptions = {}
  ): void {
    const page = this.document()?.pages.find((candidate) => candidate.id === pageId);
    if (!page) return;

    this.patchPage(
      {
        ...page,
        nodes: page.nodes.map((candidate) =>
          candidate.id === nodeId ? ({ ...candidate, ...patch } as ProposalTemplateNode) : candidate
        ),
      },
      options
    );
  }

  private patchSelectedTableCell(
    patch: Partial<ProposalTemplateTableCell>,
    options: DocumentMutationOptions = {}
  ): void {
    const tableNode = this.selectedTableNode();
    const cell = this.selectedTableCellData();
    if (!tableNode || !cell) {
      return;
    }

    this.patchTableCell(tableNode.pageId, tableNode.id, cell.id, patch, options);
  }

  private patchSelectedTextTarget(
    patch: Partial<TextToolbarTarget>,
    options: DocumentMutationOptions = {}
  ): void {
    const textNode = this.selectedTextNode();
    if (textNode) {
      this.patchSelectedNode(patch as Partial<ProposalTemplateRichTextNode>, options);
      return;
    }

    const cellContent = this.selectedTableCellTextContent();
    if (!cellContent) {
      return;
    }

    this.patchSelectedTableCell(
      {
        content: {
          ...cellContent,
          ...patch,
        },
      },
      options
    );
  }

  private patchTableCell(
    pageId: string,
    nodeId: string,
    cellId: string,
    patch: Partial<ProposalTemplateTableCell>,
    options: DocumentMutationOptions = {}
  ): void {
    const page = this.document()?.pages.find((candidate) => candidate.id === pageId);
    const tableNode = page?.nodes.find(
      (candidate): candidate is ProposalTemplateTableNode =>
        candidate.id === nodeId && candidate.type === 'table'
    );
    if (!page || !tableNode) {
      return;
    }

    this.patchPage(
      {
        ...page,
        nodes: page.nodes.map((candidate) =>
          candidate.id === tableNode.id
            ? ({
                ...tableNode,
                cells: tableNode.cells.map((cell) =>
                  cell.id === cellId ? ({ ...cell, ...patch } as ProposalTemplateTableCell) : cell
                ),
              } as ProposalTemplateNode)
            : candidate
        ),
      },
      options
    );
  }

  private buildTableCells(
    rows: number,
    columns: number,
    document: ProposalTemplateDocument
  ): ProposalTemplateTableCell[] {
    const cells: ProposalTemplateTableCell[] = [];

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        cells.push({
          id: this.createId('cell'),
          row,
          column,
          background: '#ffffff',
          stroke: `${document.theme.borderColor}`,
          strokeWidth: 1,
          padding: 12,
          content: this.buildDefaultTableCellTextContent(
            document,
            row === 0 ? `Header ${column + 1}` : `Cell ${row + 1}-${column + 1}`
          ),
        });
      }
    }

    return cells;
  }

  private buildDefaultTableCellTextContent(
    document: ProposalTemplateDocument,
    text = 'Cell'
  ): ProposalTemplateTableCellTextContent {
    return {
      kind: 'text',
      content: this.proposalTemplateDocumentService.parseSegments(text),
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

  private getDefaultSelectedTableCell(
    node: ProposalTemplateTableNode | null
  ): TableCellSelection | null {
    const firstCell = node?.cells[0];
    return firstCell ? { nodeId: node!.id, cellId: firstCell.id } : null;
  }

  private findNode(pageId?: string | null, nodeId?: string | null): ProposalTemplateNode | null {
    if (!pageId || !nodeId) {
      return null;
    }

    const page = this.document()?.pages.find((candidate) => candidate.id === pageId);
    return page?.nodes.find((candidate) => candidate.id === nodeId) ?? null;
  }

  private nudgeSelectedNode(deltaX: number, deltaY: number): void {
    const page = this.currentPage();
    const selectedIds = new Set(
      this.selectedNodes()
        .filter((node) => !node.locked)
        .map((node) => node.id)
    );
    if (!page || !selectedIds.size) {
      return;
    }

    this.patchPage({
      ...page,
      nodes: page.nodes.map((node) =>
        selectedIds.has(node.id)
          ? ({
              ...node,
              x: this.clamp(node.x + deltaX, 0, Math.max(0, page.width - node.width)),
              y: this.clamp(node.y + deltaY, 0, Math.max(0, page.height - node.height)),
            } as ProposalTemplateNode)
          : node
      ),
    });
  }

  private getDefaultNodeFrame(type: ProposalTemplateNode['type']): { width: number; height: number } {
    switch (type) {
      case 'image':
        return { width: 160, height: 100 };
      case 'table':
        return { width: 420, height: 240 };
      case 'repeater':
        return { width: 620, height: 360 };
      case 'totals':
        return { width: 280, height: 188 };
      case 'divider':
        return { width: 280, height: 1 };
      case 'shape':
      case 'group':
      case 'rich-text':
      default:
        return { width: 280, height: 72 };
    }
  }

  private focusTextEditor(cursorPosition?: number): void {
    setTimeout(() => {
      const element = this.richTextEditor?.nativeElement;
      const editor = this.textEditor();
      if (!element || !editor) {
        return;
      }

      if (element.innerText !== editor.value) {
        element.innerText = editor.value;
      }

      element.focus();
      this.placeCaretAtOffset(element, cursorPosition ?? editor.value.length);
    });
  }

  private readTextEditorValue(): string {
    const element = this.richTextEditor?.nativeElement;
    if (!element) {
      return this.textEditor()?.value ?? '';
    }

    return element.innerText.replace(/\r\n/g, '\n');
  }

  private syncTextEditorValueFromDom(): void {
    const editor = this.textEditor();
    if (!editor) {
      return;
    }

    this.textEditor.set({
      ...editor,
      value: this.readTextEditorValue(),
    });
  }

  private insertTextAtCursor(element: HTMLElement, value: string): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      element.focus();
      this.placeCaretAtOffset(element, element.innerText.length);
    }

    const activeSelection = window.getSelection();
    const range = activeSelection?.rangeCount ? activeSelection.getRangeAt(0) : null;
    if (!activeSelection || !range) {
      element.innerText += value;
      return;
    }

    range.deleteContents();
    range.insertNode(document.createTextNode(value));
    range.collapse(false);
    activeSelection.removeAllRanges();
    activeSelection.addRange(range);
  }

  private placeCaretAtOffset(element: HTMLElement, offset: number): void {
    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    const range = document.createRange();
    let remaining = offset;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let currentNode = walker.nextNode();

    while (currentNode) {
      const length = currentNode.textContent?.length ?? 0;
      if (remaining <= length) {
        range.setStart(currentNode, remaining);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }

      remaining -= length;
      currentNode = walker.nextNode();
    }

    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  private measureTextEditorHeight(
    value: string,
    node: ProposalTemplateRichTextNode
  ): number {
    const measurement = document.createElement('div');
    measurement.style.position = 'fixed';
    measurement.style.left = '-9999px';
    measurement.style.top = '0';
    measurement.style.width = `${node.width}px`;
    measurement.style.padding = '0.3rem';
    measurement.style.whiteSpace = 'pre-wrap';
    measurement.style.fontFamily = node.fontFamily;
    measurement.style.fontSize = `${node.fontSize}px`;
    measurement.style.fontWeight = String(node.fontWeight);
    measurement.style.fontStyle = node.fontStyle ?? 'normal';
    measurement.style.lineHeight = String(node.lineHeight);
    measurement.style.letterSpacing = `${node.letterSpacing}px`;
    measurement.style.textTransform = node.textTransform ?? 'none';
    measurement.style.boxSizing = 'border-box';
    measurement.textContent = value || ' ';

    document.body.appendChild(measurement);
    const height = Math.max(48, Math.ceil(measurement.getBoundingClientRect().height + 12));
    document.body.removeChild(measurement);
    return height;
  }

  private buildRenderedTextModel(
    value: string,
    listStyle: ProposalTemplateTextListStyle = 'none'
  ): RenderedTextModel {
    const normalizedValue = value.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ');

    if (listStyle !== 'none') {
      const items = normalizedValue
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((content, index) => ({
          marker: listStyle === 'ordered' ? `${index + 1}.` : '\u2022',
          content,
        }));

      return items.length
        ? {
            kind: 'list',
            text: '',
            items,
            markerWidth:
              listStyle === 'ordered'
                ? `${Math.max(2.2, `${items.length}.`.length + 0.6)}ch`
                : '1.2em',
          }
        : {
            kind: 'plain',
            text: '',
            items: [],
            markerWidth: '1.2em',
          };
    }

    const manualListMatch = this.parseManualListModel(normalizedValue);
    if (manualListMatch) {
      return manualListMatch;
    }

    return {
      kind: 'plain',
      text: normalizedValue,
      items: [],
      markerWidth: '1.2em',
    };
  }

  private parseManualListModel(value: string): RenderedTextModel | null {
    const lines = value.split('\n');
    const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
    if (!nonEmptyLines.length) {
      return null;
    }

    const parsedLines = nonEmptyLines.map((line) => this.parseManualListLine(line));
    if (parsedLines.some((line) => line == null)) {
      return null;
    }

    const firstKind = parsedLines[0]!.kind;
    if (!parsedLines.every((line) => line?.kind === firstKind)) {
      return null;
    }

    const items = parsedLines.map((line) => ({
      marker: line!.marker,
      content: line!.content,
    }));

    return {
      kind: 'list',
      text: '',
      items,
      markerWidth:
        firstKind === 'ordered'
          ? `${Math.max(...items.map((item) => item.marker.length), 2) + 0.6}ch`
          : '1.2em',
    };
  }

  private parseManualListLine(
    line: string
  ): { kind: 'ordered' | 'unordered'; marker: string; content: string } | null {
    const orderedMatch = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (orderedMatch) {
      const content = orderedMatch[2].trim();
      if (!content) {
        return null;
      }

      return {
        kind: 'ordered',
        marker: `${orderedMatch[1]}.`,
        content,
      };
    }

    const bulletMatch = line.match(/^\s*([•◦▪‣∙\-*])\s+(.*)$/u);
    if (!bulletMatch) {
      return null;
    }

    const content = bulletMatch[2].trim();
    if (!content) {
      return null;
    }

    return {
      kind: 'unordered',
      marker: bulletMatch[1] === '-' || bulletMatch[1] === '*' ? '\u2022' : bulletMatch[1],
      content,
    };
  }

  private getActiveColorDrawerValue(): string {
    switch (this.colorDrawer()?.target) {
      case 'text-color':
        return this.selectedTextNode()?.color ?? '';
      case 'shape-fill':
        return this.selectedShapeNode()?.fill ?? '';
      case 'shape-stroke':
        return this.selectedShapeNode()?.stroke ?? '';
      case 'divider-stroke':
        return this.selectedDividerNode()?.stroke ?? '';
      case 'table-cell-background':
        return this.selectedTableCellData()?.background ?? '';
      case 'table-cell-stroke':
        return this.selectedTableCellData()?.stroke ?? '';
      case 'table-cell-text': {
        const content = this.selectedTableCellTextContent();
        return content?.color ?? '';
      }
      default:
        return '';
    }
  }

  private isColorDrawerTargetAvailable(target: ColorDrawerTarget | null): boolean {
    switch (target) {
      case 'text-color':
        return Boolean(this.selectedTextNode());
      case 'shape-fill':
      case 'shape-stroke':
        return Boolean(this.selectedShapeNode());
      case 'divider-stroke':
        return Boolean(this.selectedDividerNode());
      case 'table-cell-background':
      case 'table-cell-stroke':
        return Boolean(this.selectedTableCellData());
      case 'table-cell-text':
        return Boolean(this.selectedTableCellTextContent());
      default:
        return false;
    }
  }

  private collectDocumentColorSwatches(
    document: ProposalTemplateDocument,
    allowGradients: boolean
  ): string[] {
    const swatches: string[] = [];
    const push = (value?: string | null) =>
      this.appendDocumentSwatch(swatches, value, allowGradients);

    push(document.theme.primaryColor);
    push(document.theme.accentColor);
    push(document.theme.borderColor);
    push(document.theme.pageColor);
    push(document.theme.canvasColor);
    push(document.theme.mutedColor);

    document.pages.forEach((page) => {
      push(page.background?.fill);
      page.nodes.forEach((node) => {
        switch (node.type) {
          case 'rich-text':
            push(node.color);
            break;
          case 'shape':
            push(node.fill);
            push(node.stroke);
            break;
          case 'divider':
            push(node.stroke);
            break;
          case 'table':
            node.cells.forEach((cell) => {
              push(cell.background);
              push(cell.stroke);
              if (cell.content.kind === 'text') {
                push(cell.content.color);
              }
            });
            break;
          case 'repeater':
            push(node.background);
            push(node.borderColor);
            push(node.headerBackground);
            push(node.rowBackground);
            push(node.headerTextColor);
            node.rowTemplate.nodes.forEach((child) => {
              if (child.type === 'rich-text') {
                push(child.color);
              } else {
                push(child.stroke);
                if (child.type === 'shape') {
                  push(child.fill);
                }
              }
            });
            break;
          case 'totals':
            push(node.background);
            push(node.borderColor);
            push(node.textColor);
            push(node.accentColor);
            break;
          default:
            break;
        }
      });
    });

    return swatches.slice(0, 16);
  }

  private appendDocumentSwatch(
    swatches: string[],
    value: string | null | undefined,
    allowGradients: boolean
  ): void {
    const normalized = this.normalizeColorValue(value);
    if (!normalized) {
      return;
    }

    const isGradient = normalized.includes('gradient(');
    if (isGradient && !allowGradients) {
      return;
    }

    if (!allowGradients && !this.isValidCssColor(normalized)) {
      return;
    }

    if (allowGradients && !this.isValidCssBackground(normalized)) {
      return;
    }

    if (!swatches.some((candidate) => this.normalizeColorValue(candidate) === normalized)) {
      swatches.push(value!.trim());
    }
  }

  private normalizeColorValue(value: string | null | undefined): string {
    return String(value ?? '')
      .trim()
      .toLowerCase();
  }

  private isValidCssColor(value: string): boolean {
    const option = new Option();
    option.style.color = '';
    option.style.color = value;
    return option.style.color !== '';
  }

  private isValidCssBackground(value: string): boolean {
    const element = document.createElement('div');
    element.style.background = '';
    element.style.background = value;
    return element.style.background !== '';
  }

  private buildBaseTemplateConfig(template: DocumentTemplate): Record<string, unknown> {
    const baseConfig = {
      ...(template.template_config ?? {}),
    };
    delete baseConfig[this.proposalTemplateDocumentService.storageKey];

    return withTemplateServiceProfile(
      withTemplateRendererKey(baseConfig, resolveTemplateRendererKey(template)),
      getTemplateServiceProfile(template)
    );
  }

  private buildTemplateKey(name: string): string {
    return `${this.slugifyName(name)}-${Date.now().toString(36).slice(-6)}`;
  }

  private slugifyName(name: string): string {
    return (
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'proposal-template'
    );
  }

  private downloadJsonFile(payload: unknown, fileName: string): void {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  private cloneValue<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private beginCanvaPopupWatch(): void {
    this.stopCanvaPopupWatch();

    this.canvaPopupPollTimer = window.setInterval(() => {
      void this.syncCanvaConnectionFromPopup();
    }, 1200);

    void this.syncCanvaConnectionFromPopup();
  }

  private stopCanvaPopupWatch(): void {
    if (this.canvaPopupPollTimer != null) {
      window.clearInterval(this.canvaPopupPollTimer);
      this.canvaPopupPollTimer = null;
    }
  }

  private async syncCanvaConnectionFromPopup(): Promise<void> {
    if (this.canvaPopupStatusCheckInFlight || this.canvaPopupFlowResolved) {
      return;
    }

    this.canvaPopupStatusCheckInFlight = true;

    try {
      const status = await this.loadCanvaStatus();
      if (status.connected) {
        await this.handleCanvaConnectionSuccess(false);
        return;
      }

      if (this.canvaPopup?.closed) {
        this.canvaPopup = null;
        this.canvaPopupFlowResolved = true;
        this.stopCanvaPopupWatch();
        this.toast.showToast('Canva sign-in closed before the studio detected a completed connection.', 'error');
      }
    } finally {
      this.canvaPopupStatusCheckInFlight = false;
    }
  }

  private async handleCanvaConnectionSuccess(fromMessage: boolean): Promise<void> {
    if (this.canvaPopupFlowResolved) {
      return;
    }

    this.canvaPopupFlowResolved = true;
    this.stopCanvaPopupWatch();
    this.canvaPopup?.close();
    this.canvaPopup = null;

    const status = await this.loadCanvaStatus();
    if (!status.connected) {
      if (fromMessage) {
        this.toast.showToast('Canva finished authorizing, but the studio could not verify the saved connection yet.', 'error');
      }
      return;
    }

    this.activeSidebarTab.set('templates');
    this.drawerOpen.set(true);
    await this.loadCanvaDesigns(true);
    this.toast.showToast('Canva is now connected to the proposal studio.', 'success');
  }

  private async loadCanvaStatus(): Promise<CanvaConnectionStatus> {
    try {
      this.canvaLoading.set(true);
      const status = await this.canvaService.getConnectionStatus();
      this.canvaStatus.set(status);
      return status;
    } catch (error) {
      console.error('[ProposalTemplateStudioComponent] load Canva status error:', error);
      const fallbackStatus = { connected: false, scopes: [] } as CanvaConnectionStatus;
      this.canvaStatus.set(fallbackStatus);
      return fallbackStatus;
    } finally {
      this.canvaLoading.set(false);
    }
  }

  private applyCanvaImportResult(result: CanvaImportResult): void {
    const document = this.document();
    if (!document) {
      return;
    }

    const mergedAssets = this.mergeAssets([...result.assets, ...this.assets()]);
    const nextPages = [
      ...document.pages,
      ...result.imported_pages.map((page, index) =>
        this.buildCanvaImportedPage(document, page, document.pages.length + index + 1)
      ),
    ];

    this.assets.set(mergedAssets);
    this.canvaImports.set([result.summary, ...this.canvaImports()]);
    this.updateDocument(
      this.proposalTemplateDocumentService.applyResolvedAssetUrls(
        {
          ...document,
          pages: nextPages,
        },
        mergedAssets
      )
    );

    const firstImportedPage = nextPages[document.pages.length];
    this.setSelection(
      firstImportedPage?.id ?? this.selectedPageId(),
      firstImportedPage?.nodes[0]?.id ? [firstImportedPage.nodes[0].id] : [],
      firstImportedPage?.nodes[0]?.id ?? null
    );
  }

  private buildCanvaImportedPage(
    document: ProposalTemplateDocument,
    importedPage: CanvaImportResult['imported_pages'][number],
    pageNumber: number
  ): ProposalTemplatePage {
    const pageId = this.createId('page');
    return {
      id: pageId,
      name: importedPage.page_name || `Canva Page ${pageNumber}`,
      width: importedPage.width,
      height: importedPage.height,
      kind: 'static',
      background: { fill: document.theme.pageColor },
      nodes: [
        {
          id: this.createId('node'),
          type: 'image',
          name: importedPage.page_name || `Canva Page ${pageNumber}`,
          pageId,
          x: 0,
          y: 0,
          width: importedPage.width,
          height: importedPage.height,
          rotation: 0,
          zIndex: 1,
          opacity: 1,
          visible: true,
          locked: true,
          source: 'url',
          url: importedPage.asset.url,
          asset_id: importedPage.asset.id,
          storage_path: importedPage.asset.storage_path,
          fit: 'stretch',
          cornerRadius: 0,
          alt: importedPage.asset.alt,
        },
      ],
    };
  }

  private mergeAssets(assets: ProposalTemplateEditorAsset[]): ProposalTemplateEditorAsset[] {
    const seen = new Set<string>();
    return assets.filter((asset) => {
      const key = asset.storage_path || asset.id;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  private snapMovePosition(
    page: ProposalTemplatePage,
    nodeId: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): { x: number; y: number; guides: SnapGuideState } {
    const targets = this.getSnapTargets(page, nodeId);
    let nextX = x;
    let nextY = y;
    const guides: SnapGuideState = { vertical: [], horizontal: [] };

    const horizontalCandidates = [
      { position: x, apply: (target: number) => target },
      { position: x + width / 2, apply: (target: number) => target - width / 2 },
      { position: x + width, apply: (target: number) => target - width },
    ];
    const verticalCandidates = [
      { position: y, apply: (target: number) => target },
      { position: y + height / 2, apply: (target: number) => target - height / 2 },
      { position: y + height, apply: (target: number) => target - height },
    ];

    const snappedX = this.findNearestSnap(horizontalCandidates, targets.vertical);
    if (snappedX) {
      nextX = this.clamp(
        Math.round(snappedX.value),
        0,
        Math.max(0, page.width - width)
      );
      guides.vertical.push(snappedX.guide);
    }

    const snappedY = this.findNearestSnap(verticalCandidates, targets.horizontal);
    if (snappedY) {
      nextY = this.clamp(
        Math.round(snappedY.value),
        0,
        Math.max(0, page.height - height)
      );
      guides.horizontal.push(snappedY.guide);
    }

    return { x: nextX, y: nextY, guides };
  }

  private snapResizeRect(
    page: ProposalTemplatePage,
    nodeId: string,
    rect: { x: number; y: number; width: number; height: number },
    handle: ResizeHandle,
    minWidth: number,
    minHeight: number
  ): { x: number; y: number; width: number; height: number; guides: SnapGuideState } {
    const targets = this.getSnapTargets(page, nodeId);
    const guides: SnapGuideState = { vertical: [], horizontal: [] };
    let nextRect = { ...rect };

    if (handle.includes('e')) {
      const snapped = this.findNearestTarget(nextRect.x + nextRect.width, targets.vertical);
      if (snapped != null) {
        nextRect.width = Math.max(minWidth, snapped - nextRect.x);
        guides.vertical.push(snapped);
      }
    }

    if (handle.includes('w')) {
      const snapped = this.findNearestTarget(nextRect.x, targets.vertical);
      if (snapped != null) {
        const right = nextRect.x + nextRect.width;
        nextRect.x = this.clamp(snapped, 0, right - minWidth);
        nextRect.width = Math.max(minWidth, right - nextRect.x);
        guides.vertical.push(snapped);
      }
    }

    if (handle.includes('s')) {
      const snapped = this.findNearestTarget(nextRect.y + nextRect.height, targets.horizontal);
      if (snapped != null) {
        nextRect.height = Math.max(minHeight, snapped - nextRect.y);
        guides.horizontal.push(snapped);
      }
    }

    if (handle.includes('n')) {
      const snapped = this.findNearestTarget(nextRect.y, targets.horizontal);
      if (snapped != null) {
        const bottom = nextRect.y + nextRect.height;
        nextRect.y = this.clamp(snapped, 0, bottom - minHeight);
        nextRect.height = Math.max(minHeight, bottom - nextRect.y);
        guides.horizontal.push(snapped);
      }
    }

    nextRect.x = this.clamp(nextRect.x, 0, Math.max(0, page.width - minWidth));
    nextRect.y = this.clamp(nextRect.y, 0, Math.max(0, page.height - minHeight));
    nextRect.width = Math.max(minWidth, Math.min(nextRect.width, page.width - nextRect.x));
    nextRect.height = Math.max(minHeight, Math.min(nextRect.height, page.height - nextRect.y));

    return { ...nextRect, guides };
  }

  private findNearestSnap(
    candidates: Array<{ position: number; apply: (target: number) => number }>,
    targets: number[]
  ): { value: number; guide: number } | null {
    let bestValue: number | null = null;
    let bestGuide: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    candidates.forEach((candidate) => {
      const target = this.findNearestTarget(candidate.position, targets);
      if (target == null) {
        return;
      }

      const distance = Math.abs(candidate.position - target);
      if (distance < bestDistance) {
        bestValue = candidate.apply(target);
        bestGuide = target;
        bestDistance = distance;
      }
    });

    return bestValue != null && bestGuide != null
      ? { value: bestValue, guide: bestGuide }
      : null;
  }

  private findNearestTarget(position: number, targets: number[]): number | null {
    let best: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    targets.forEach((target) => {
      const distance = Math.abs(position - target);
      if (
        distance <= ProposalTemplateStudioComponent.SNAP_TOLERANCE &&
        distance < bestDistance
      ) {
        best = target;
        bestDistance = distance;
      }
    });

    return best;
  }

  private getSnapTargets(
    page: ProposalTemplatePage,
    nodeId: string
  ): SnapGuideState {
    const vertical = [0, page.width / 2, page.width];
    const horizontal = [0, page.height / 2, page.height];

    page.nodes
      .filter((node) => node.id !== nodeId && node.visible)
      .forEach((node) => {
        vertical.push(node.x, node.x + node.width / 2, node.x + node.width);
        horizontal.push(node.y, node.y + node.height / 2, node.y + node.height);
      });

    return { vertical, horizontal };
  }

  private setSelection(
    pageId: string | null | undefined,
    nodeIds: string[],
    activeNodeId?: string | null
  ): void {
    const normalizedPageId = pageId ?? null;
    const page =
      normalizedPageId != null
        ? this.pages().find((candidate) => candidate.id === normalizedPageId) ?? null
        : null;
    const normalizedNodeIds = page
      ? nodeIds.filter(
          (nodeId, index, collection) =>
            page.nodes.some((node) => node.id === nodeId) &&
            collection.indexOf(nodeId) === index
        )
      : [];
    const resolvedActiveNodeId =
      normalizedNodeIds.includes(activeNodeId ?? '')
        ? activeNodeId ?? null
        : normalizedNodeIds[normalizedNodeIds.length - 1] ?? null;

    this.selectedPageId.set(normalizedPageId);
    this.selectedNodeIds.set(normalizedNodeIds);
    this.selectedNodeId.set(resolvedActiveNodeId);

    const selectedTableNode =
      normalizedNodeIds.length === 1
        ? (page?.nodes.find(
            (candidate): candidate is ProposalTemplateTableNode =>
              candidate.id === resolvedActiveNodeId && candidate.type === 'table'
          ) ?? null)
        : null;
    const currentTableSelection = this.selectedTableCell();
    this.selectedTableCell.set(
      selectedTableNode
        ? currentTableSelection?.nodeId === selectedTableNode.id &&
          selectedTableNode.cells.some((cell) => cell.id === currentTableSelection.cellId)
          ? currentTableSelection
          : this.getDefaultSelectedTableCell(selectedTableNode)
        : null
    );

    if (normalizedNodeIds.length !== 1) {
      this.toolbarPopover.set(null);
    }

    if (!this.isColorDrawerTargetAvailable(this.colorDrawer()?.target ?? null)) {
      this.closeColorDrawer();
    }
  }

  private toggleNodeSelection(pageId: string, nodeId: string): void {
    const page = this.pages().find((candidate) => candidate.id === pageId);
    if (!page) {
      return;
    }

    const baseSelection =
      this.selectedPageId() === pageId ? [...this.selectedNodeIds()] : [];
    const alreadySelected = baseSelection.includes(nodeId);
    const nextSelection = alreadySelected
      ? baseSelection.filter((candidate) => candidate !== nodeId)
      : [...baseSelection, nodeId];
    const nextActiveId = alreadySelected
      ? nextSelection[nextSelection.length - 1] ?? null
      : nodeId;

    this.setSelection(pageId, nextSelection, nextActiveId);
  }

  private getMarqueeSelectionIds(marquee: MarqueeSelectionState): string[] {
    const page = this.pages().find((candidate) => candidate.id === marquee.pageId);
    if (!page) {
      return marquee.baseSelectionIds;
    }

    const left = Math.min(marquee.startX, marquee.currentX);
    const top = Math.min(marquee.startY, marquee.currentY);
    const right = Math.max(marquee.startX, marquee.currentX);
    const bottom = Math.max(marquee.startY, marquee.currentY);
    const intersects = page.nodes
      .filter((node) => node.visible)
      .filter((node) => {
        const nodeRight = node.x + node.width;
        const nodeBottom = node.y + node.height;
        return node.x < right && nodeRight > left && node.y < bottom && nodeBottom > top;
      })
      .map((node) => node.id);

    return marquee.additive
      ? [...new Set([...marquee.baseSelectionIds, ...intersects])]
      : intersects;
  }

  private copySelectedNodesToClipboard(): void {
    const selectedNodes = this.selectedNodes();
    if (!selectedNodes.length) {
      return;
    }

    this.clipboardNodes = this.cloneValue(selectedNodes);
    this.clipboardPasteCount = 0;
  }

  private pasteClipboardNodes(): void {
    const page = this.currentPage();
    if (!page || !this.clipboardNodes.length) {
      return;
    }

    const offset = 24 * (this.clipboardPasteCount + 1);
    const clones = this.clipboardNodes.map((node, index) => {
      const clone = this.cloneValue(node);
      clone.id = this.createId('node');
      clone.pageId = page.id;
      clone.x = this.clamp(clone.x + offset, 0, Math.max(0, page.width - clone.width));
      clone.y = this.clamp(clone.y + offset, 0, Math.max(0, page.height - clone.height));
      clone.zIndex = page.nodes.length + index + 1;
      return clone;
    });

    this.patchPage({
      ...page,
      nodes: [...page.nodes, ...clones],
    });
    this.clipboardPasteCount += 1;
    this.setSelection(
      page.id,
      clones.map((clone) => clone.id),
      clones[clones.length - 1]?.id ?? null
    );
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    const element = target instanceof HTMLElement ? target : null;
    if (!element) {
      return false;
    }

    return Boolean(element.closest('input, textarea, select, [contenteditable="true"]'));
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private coerceNumber(value: number | string, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    const parsed = Number.parseFloat(String(value ?? '').trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private beginDragHistoryCapture(): void {
    this.dragHistorySnapshot = this.createHistorySnapshot();
    this.dragDidMutate = false;
  }

  private createHistorySnapshot(
    document: ProposalTemplateDocument | null = this.document()
  ): EditorHistorySnapshot | null {
    if (!document) {
      return null;
    }

    return {
      document: this.cloneDocument(document),
      selectedPageId: this.selectedPageId(),
      selectedNodeId: this.selectedNodeId(),
      selectedNodeIds: this.cloneValue(this.selectedNodeIds()),
    };
  }

  private applyHistorySnapshot(snapshot: EditorHistorySnapshot): void {
    const document = this.cloneDocument(snapshot.document);
    const selectedPage =
      document.pages.find((page) => page.id === snapshot.selectedPageId) ?? document.pages[0] ?? null;
    const selectedNode =
      selectedPage?.nodes.find((node) => node.id === snapshot.selectedNodeId) ?? null;
    const selectedNodeIds =
      selectedPage?.nodes
        .filter((node) => snapshot.selectedNodeIds.includes(node.id))
        .map((node) => node.id) ?? [];

    this.document.set(document);
    this.setSelection(selectedPage?.id ?? null, selectedNodeIds, selectedNode?.id ?? null);
    this.textEditor.set(null);
    this.dragState = null;
    this.dragHistorySnapshot = null;
    this.dragDidMutate = false;
    this.snapGuides.set({ vertical: [], horizontal: [] });
    this.marqueeSelection.set(null);
    this.dirty.set(true);
  }

  private pushHistorySnapshot(snapshot: EditorHistorySnapshot | null): void {
    if (!snapshot) {
      return;
    }

    const previous = this.historyPast[this.historyPast.length - 1];
    if (previous && this.historySnapshotsEqual(previous, snapshot)) {
      this.historyFuture = [];
      this.syncHistoryAvailability();
      return;
    }

    this.historyPast.push(snapshot);
    if (this.historyPast.length > ProposalTemplateStudioComponent.HISTORY_LIMIT) {
      this.historyPast.shift();
    }

    this.historyFuture = [];
    this.syncHistoryAvailability();
  }

  private resetHistory(): void {
    this.historyPast = [];
    this.historyFuture = [];
    this.dragHistorySnapshot = null;
    this.dragDidMutate = false;
    this.snapGuides.set({ vertical: [], horizontal: [] });
    this.syncHistoryAvailability();
  }

  private syncHistoryAvailability(): void {
    this.canUndo.set(this.historyPast.length > 0);
    this.canRedo.set(this.historyFuture.length > 0);
  }

  private historySnapshotsEqual(
    left: EditorHistorySnapshot,
    right: EditorHistorySnapshot
  ): boolean {
    return (
      left.selectedPageId === right.selectedPageId &&
      left.selectedNodeId === right.selectedNodeId &&
      JSON.stringify(left.selectedNodeIds) === JSON.stringify(right.selectedNodeIds) &&
      this.documentsEqual(left.document, right.document)
    );
  }

  private documentsEqual(
    left: ProposalTemplateDocument,
    right: ProposalTemplateDocument
  ): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private cloneDocument(document: ProposalTemplateDocument): ProposalTemplateDocument {
    return JSON.parse(JSON.stringify(document)) as ProposalTemplateDocument;
  }

  private createId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
