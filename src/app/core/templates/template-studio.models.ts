import {
  DocumentTemplate,
  FloralProposalRenderContract,
} from '../models/floral-proposal';

export type TemplateStudioSchemaVersion = '1.0';
export type TemplateStudioStatus = 'draft' | 'published' | 'archived';
export type TemplatePreviewDeviceMode = 'page' | 'desktop' | 'mobile';

export type TemplateBlockType =
  | 'cover'
  | 'intro-note'
  | 'event-summary'
  | 'mood-gallery'
  | 'proposal-items'
  | 'investment-summary'
  | 'included-services'
  | 'terms-and-next-steps'
  | 'signature-closing';

export type TemplateAssetType = 'logo' | 'background' | 'texture' | 'image';

export type ProposalRenderModel = {
  schema_version: TemplateStudioSchemaVersion;
  proposal: {
    id: string;
    number: string;
    title: string;
    status:
      | 'draft'
      | 'previewed'
      | 'approved'
      | 'sent'
      | 'accepted'
      | 'declined';
    created_at: string;
    updated_at: string;
    valid_until?: string | null;
    currency: 'USD';
  };
  branding: {
    business_name: string;
    logo_url?: string | null;
    website?: string | null;
    email?: string | null;
    phone?: string | null;
    instagram?: string | null;
    address_lines?: string[];
  };
  client: {
    primary_contact: {
      first_name: string;
      last_name: string;
      full_name: string;
      email?: string | null;
      phone?: string | null;
    };
    partner_contact?: {
      first_name?: string | null;
      last_name?: string | null;
      full_name?: string | null;
    } | null;
  };
  event: {
    type: string;
    date?: string | null;
    venue_name?: string | null;
    venue_city?: string | null;
    venue_state?: string | null;
    guest_count?: number | null;
    planner_name?: string | null;
    planner_email?: string | null;
    planner_phone?: string | null;
  };
  intro: {
    greeting?: string | null;
    welcome_message?: string | null;
    closing_message?: string | null;
    signature_name?: string | null;
    signature_title?: string | null;
  };
  gallery: {
    hero_image_url?: string | null;
    mood_images: Array<{
      id: string;
      url: string;
      alt?: string | null;
      caption?: string | null;
    }>;
  };
  line_items: Array<{
    id: string;
    name: string;
    category?: string | null;
    description?: string | null;
    quantity?: number | null;
    unit_label?: string | null;
    image_url?: string | null;
    notes?: string | null;
    pricing: {
      unit_price?: number | null;
      line_total: number;
      price_visible: boolean;
    };
  }>;
  inclusions: Array<{
    id: string;
    label: string;
    description?: string | null;
  }>;
  investment: {
    subtotal: number;
    discount_total?: number;
    tax_total?: number;
    service_fee_total?: number;
    grand_total: number;
    deposit_amount?: number | null;
    payment_schedule?: Array<{
      label: string;
      amount: number;
      due_date?: string | null;
    }>;
  };
  terms: {
    payment_terms?: string | null;
    cancellation_policy?: string | null;
    revision_policy?: string | null;
    notes?: string | null;
  };
  cta: {
    acceptance_label?: string | null;
    acceptance_instructions?: string | null;
    proposal_access_url?: string | null;
  };
  meta: {
    generated_at: string;
    sample_data: boolean;
    source_contract?: FloralProposalRenderContract;
  };
};

export type TemplateSettings = {
  page: {
    size: 'letter';
    orientation: 'portrait';
    margins: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
    bleed?: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    } | null;
  };
  header_footer: {
    show_page_numbers: boolean;
    show_business_name: boolean;
    footer_text?: string | null;
  };
  defaults: {
    show_prices: boolean;
    show_images: boolean;
    show_line_item_notes: boolean;
    show_gallery_captions: boolean;
  };
};

export type TemplateTokens = {
  colors: {
    canvas: string;
    surface: string;
    text: string;
    muted_text: string;
    primary: string;
    accent: string;
    border: string;
    success?: string;
    warning?: string;
    danger?: string;
  };
  typography: {
    heading_font_family: string;
    body_font_family: string;
    accent_font_family?: string | null;
    sizes: {
      h1: number;
      h2: number;
      h3: number;
      body: number;
      small: number;
      caption: number;
    };
    weights: {
      heading: number;
      body: number;
      strong: number;
    };
    line_heights: {
      heading: number;
      body: number;
      compact: number;
    };
    letter_spacing: {
      caps: number;
      heading: number;
    };
  };
  spacing: {
    page_section_gap: number;
    block_padding: number;
    card_gap: number;
    grid_gap: number;
    line_item_gap: number;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  borders: {
    width: number;
    style: 'solid' | 'dashed' | 'none';
  };
  shadows: {
    card: 'none' | 'soft' | 'medium';
    image: 'none' | 'soft';
  };
};

export type TemplateAssetRef = {
  id: string;
  type: TemplateAssetType;
  url: string;
  storage_path?: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
};

export type TemplateBlockBase = {
  id: string;
  type: TemplateBlockType;
  enabled: boolean;
  order: number;
  layout_variant: string;
  visibility?: {
    event_types?: string[];
    requires_data_paths?: string[];
  };
  styles?: {
    background_color?: string;
    background_asset_id?: string | null;
    background_overlay_opacity?: number | null;
    text_color?: string;
    accent_color?: string;
    heading_font_family?: string | null;
    body_font_family?: string | null;
    heading_size?: number | null;
    body_size?: number | null;
    font_weight?: number | null;
    padding?: number;
    margin_top?: number;
    margin_bottom?: number;
    border_radius?: number;
    border_style?: 'none' | 'solid' | 'dashed';
    image_aspect_ratio?: 'square' | 'portrait' | 'landscape';
    image_position?: 'top' | 'center' | 'bottom';
    image_crop_preset?: 'balanced' | 'cinematic' | 'portrait-focus' | 'detail';
    hero_height?: number | null;
    alignment?: 'left' | 'center' | 'right';
  };
};

export type CoverBlock = TemplateBlockBase & {
  type: 'cover';
  layout_variant: 'editorial' | 'minimal' | 'romantic';
  content: {
    title_mode: 'proposal_title' | 'custom';
    custom_title?: string | null;
    subtitle_mode: 'event_summary' | 'custom' | 'none';
    custom_subtitle?: string | null;
    show_logo: boolean;
    show_hero_image: boolean;
    hero_image_source: 'gallery.hero' | 'asset' | 'none';
    hero_asset_id?: string | null;
  };
};

export type IntroNoteBlock = TemplateBlockBase & {
  type: 'intro-note';
  layout_variant: 'simple' | 'editorial';
  content: {
    section_title: string;
    message_mode: 'intro.welcome_message' | 'custom';
    custom_message?: string | null;
  };
};

export type EventSummaryBlock = TemplateBlockBase & {
  type: 'event-summary';
  layout_variant: 'two-column' | 'stacked' | 'minimal';
  content: {
    section_title: string;
    show_event_type: boolean;
    show_event_date: boolean;
    show_venue: boolean;
    show_guest_count: boolean;
    show_planner: boolean;
  };
};

export type MoodGalleryBlock = TemplateBlockBase & {
  type: 'mood-gallery';
  layout_variant: 'grid' | 'editorial-strip' | 'hero-grid';
  content: {
    section_title: string;
    show_captions: boolean;
    max_images: number;
  };
};

export type ProposalItemsBlock = TemplateBlockBase & {
  type: 'proposal-items';
  layout_variant: 'stacked' | 'cards' | 'editorial-list';
  content: {
    section_title: string;
    section_intro?: string | null;
    show_item_images: boolean;
    show_item_descriptions: boolean;
    show_item_notes: boolean;
    show_quantity: boolean;
    show_category: boolean;
    show_prices: boolean;
    empty_state_text?: string | null;
  };
  bindings: {
    source: 'line_items';
  };
};

export type InvestmentSummaryBlock = TemplateBlockBase & {
  type: 'investment-summary';
  layout_variant: 'classic' | 'boxed' | 'minimal';
  content: {
    title: string;
    show_subtotal: boolean;
    show_discount: boolean;
    show_tax: boolean;
    show_service_fee: boolean;
    show_grand_total: boolean;
    show_payment_schedule: boolean;
    highlight_grand_total: boolean;
  };
  bindings: {
    source: 'investment';
  };
};

export type IncludedServicesBlock = TemplateBlockBase & {
  type: 'included-services';
  layout_variant: 'bulleted' | 'cards';
  content: {
    section_title: string;
    empty_state_text?: string | null;
  };
  bindings: {
    source: 'inclusions';
  };
};

export type TermsNextStepsBlock = TemplateBlockBase & {
  type: 'terms-and-next-steps';
  layout_variant: 'stacked' | 'split';
  content: {
    title: string;
    show_payment_terms: boolean;
    show_cancellation_policy: boolean;
    show_revision_policy: boolean;
    show_acceptance_instructions: boolean;
  };
};

export type SignatureClosingBlock = TemplateBlockBase & {
  type: 'signature-closing';
  layout_variant: 'simple' | 'editorial';
  content: {
    title?: string | null;
    message_mode: 'intro.closing_message' | 'custom';
    custom_message?: string | null;
    show_signature_name: boolean;
    show_signature_title: boolean;
  };
};

export type TemplateBlock =
  | CoverBlock
  | IntroNoteBlock
  | EventSummaryBlock
  | MoodGalleryBlock
  | ProposalItemsBlock
  | InvestmentSummaryBlock
  | IncludedServicesBlock
  | TermsNextStepsBlock
  | SignatureClosingBlock;

export type TemplateDefinition = {
  schema_version: TemplateStudioSchemaVersion;
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  status: TemplateStudioStatus;
  version: number;
  settings: TemplateSettings;
  tokens: TemplateTokens;
  blocks: TemplateBlock[];
  assets: TemplateAssetRef[];
  advanced?: {
    custom_css?: string | null;
    partial_overrides?: Record<string, string>;
  };
  metadata: {
    created_by: string;
    updated_by: string;
    created_at: string;
    updated_at: string;
    published_at?: string | null;
    based_on_template_id?: string | null;
    based_on_version?: number | null;
  };
};

export type ValidationIssue = {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  path: string;
  block_id?: string;
  source: 'schema' | 'registry' | 'render';
};

export type TemplateValidationResult = {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

export type TemplatePreviewProfile = {
  id: string;
  label: string;
  proposal_render_model: ProposalRenderModel;
};

export type TemplateStudioState = {
  template_id: string | null;
  mode: 'create' | 'edit';
  status: 'idle' | 'loading' | 'ready' | 'saving' | 'publishing' | 'error';
  persisted_draft: TemplateDefinition | null;
  working_draft: TemplateDefinition | null;
  selected_block_id: string | null;
  expanded_panel: 'structure' | 'block' | 'theme' | 'assets' | 'advanced';
  preview: {
    device_mode: TemplatePreviewDeviceMode;
    zoom: number;
    sample_data_profile_id: string | null;
    render_status: 'idle' | 'rendering' | 'ready' | 'error';
    last_rendered_html?: string | null;
    warnings: string[];
  };
  history: {
    can_undo: boolean;
    can_redo: boolean;
  };
  dirty: boolean;
  validation: TemplateValidationResult;
  publish: {
    last_published_version?: number | null;
    publish_notes?: string | null;
  };
  ui: {
    left_panel_open: boolean;
    right_panel_open: boolean;
    preview_fullscreen: boolean;
  };
};

export type TemplateStudioAction =
  | { type: 'LOAD_TEMPLATE'; payload: TemplateDefinition }
  | { type: 'SELECT_BLOCK'; block_id: string | null }
  | { type: 'ADD_BLOCK'; block_type: TemplateBlockType; index?: number }
  | { type: 'REMOVE_BLOCK'; block_id: string }
  | { type: 'DUPLICATE_BLOCK'; block_id: string }
  | { type: 'MOVE_BLOCK'; block_id: string; to_index: number }
  | { type: 'UPDATE_BLOCK_CONTENT'; block_id: string; path: string; value: unknown }
  | { type: 'UPDATE_BLOCK_STYLE'; block_id: string; path: string; value: unknown }
  | { type: 'CHANGE_BLOCK_VARIANT'; block_id: string; variant: string }
  | { type: 'UPDATE_TOKEN'; path: string; value: unknown }
  | { type: 'UPDATE_SETTINGS'; path: string; value: unknown }
  | { type: 'SET_SAMPLE_PROFILE'; profile_id: string }
  | { type: 'SAVE_DRAFT_SUCCESS'; payload: TemplateDefinition }
  | { type: 'PUBLISH_SUCCESS'; version: number }
  | { type: 'UNDO' }
  | { type: 'REDO' };

export type RenderTemplateInput = {
  template: TemplateDefinition;
  proposal: ProposalRenderModel;
  mode: 'preview' | 'pdf';
};

export type RenderTemplateOutput = {
  html: string;
  css: string;
  warnings: string[];
};

export type StoredTemplateStudioConfig = {
  definition: TemplateDefinition;
  source: 'template_studio';
  last_published_version?: number | null;
  published_versions?: StoredTemplateStudioPublishedVersion[];
};

export type StoredTemplateStudioPublishedVersion = {
  version: number;
  published_at: string;
  notes?: string | null;
  definition: TemplateDefinition;
};

export type LegacyOrStudioTemplate = DocumentTemplate & {
  template_config: Record<string, unknown> & {
    template_studio?: StoredTemplateStudioConfig;
  };
};
