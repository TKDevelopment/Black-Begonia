import {
  TemplateAssetType,
  TemplateBlockType,
} from './template-studio.models';

export type BlockControl =
  | {
      type: 'text' | 'textarea' | 'color';
      key: string;
      label: string;
      placeholder?: string;
      max_length?: number;
    }
  | {
      type: 'toggle' | 'number' | 'range';
      key: string;
      label: string;
      min?: number;
      max?: number;
      step?: number;
    }
  | {
      type: 'select';
      key: string;
      label: string;
      options: Array<{ label: string; value: string }>;
    }
  | {
      type: 'asset-picker';
      key: string;
      label: string;
      asset_types: TemplateAssetType[];
    };

export type BlockControlGroup = {
  id: string;
  label: string;
  controls: BlockControl[];
};

export type BlockRegistryItem = {
  type: TemplateBlockType;
  label: string;
  description: string;
  icon: string;
  supports: {
    repeatable: boolean;
    removable: boolean;
    reorderable: boolean;
    advanced_partial_override: boolean;
  };
  variants: Array<{
    id: string;
    label: string;
    description?: string;
    thumbnail?: string;
  }>;
  data_requirements: {
    required_paths: string[];
    optional_paths: string[];
  };
  defaults: {
    content: Record<string, unknown>;
    styles: Record<string, unknown>;
    layout_variant: string;
  };
  controls: BlockControlGroup[];
  validation: {
    min_instances?: number;
    max_instances?: number;
    required_content_fields?: string[];
  };
  renderer: {
    partial_key: string;
    renderer_id: string;
  };
};

const BASE_SURFACE_STYLE_CONTROLS: BlockControl[] = [
  { type: 'color', key: 'styles.background_color', label: 'Background' },
  { type: 'color', key: 'styles.text_color', label: 'Text Color' },
  { type: 'range', key: 'styles.padding', label: 'Padding', min: 0, max: 72, step: 2 },
  { type: 'range', key: 'styles.margin_top', label: 'Top Margin', min: 0, max: 96, step: 2 },
  { type: 'range', key: 'styles.margin_bottom', label: 'Bottom Margin', min: 0, max: 96, step: 2 },
  { type: 'range', key: 'styles.border_radius', label: 'Border Radius', min: 0, max: 48, step: 2 },
  {
    type: 'asset-picker',
    key: 'styles.background_asset_id',
    label: 'Background Asset',
    asset_types: ['background', 'image', 'texture'],
  },
  {
    type: 'range',
    key: 'styles.background_overlay_opacity',
    label: 'Overlay Strength',
    min: 0,
    max: 100,
    step: 5,
  },
];

const BASE_TYPOGRAPHY_STYLE_CONTROLS: BlockControl[] = [
  {
    type: 'select',
    key: 'styles.heading_font_family',
    label: 'Heading Font',
    options: [
      { label: 'Theme Default', value: '' },
      { label: 'Cormorant Garamond', value: 'Cormorant Garamond, Georgia, serif' },
      { label: 'Playfair Display', value: 'Playfair Display, Georgia, serif' },
      { label: 'Bodoni Moda', value: 'Bodoni Moda, Georgia, serif' },
      { label: 'Libre Baskerville', value: 'Libre Baskerville, Georgia, serif' },
    ],
  },
  {
    type: 'select',
    key: 'styles.body_font_family',
    label: 'Body Font',
    options: [
      { label: 'Theme Default', value: '' },
      { label: 'Source Sans 3', value: 'Source Sans 3, Arial, sans-serif' },
      { label: 'Lora', value: 'Lora, Georgia, serif' },
      { label: 'Libre Franklin', value: 'Libre Franklin, Arial, sans-serif' },
      { label: 'DM Sans', value: 'DM Sans, Arial, sans-serif' },
    ],
  },
  { type: 'range', key: 'styles.heading_size', label: 'Heading Size', min: 24, max: 72, step: 2 },
  { type: 'range', key: 'styles.body_size', label: 'Body Size', min: 12, max: 24, step: 1 },
  { type: 'range', key: 'styles.font_weight', label: 'Weight', min: 300, max: 800, step: 100 },
];

const IMAGE_CROP_PRESET_CONTROL: BlockControl = {
  type: 'select',
  key: 'styles.image_crop_preset',
  label: 'Crop Preset',
  options: [
    { label: 'Balanced', value: 'balanced' },
    { label: 'Cinematic', value: 'cinematic' },
    { label: 'Portrait Focus', value: 'portrait-focus' },
    { label: 'Detail', value: 'detail' },
  ],
};

export const TEMPLATE_BLOCK_REGISTRY: Record<TemplateBlockType, BlockRegistryItem> = {
  cover: {
    type: 'cover',
    label: 'Cover',
    description: 'Intro page with title, brand, and hero image.',
    icon: 'cover',
    supports: {
      repeatable: false,
      removable: true,
      reorderable: true,
      advanced_partial_override: true,
    },
    variants: [
      { id: 'editorial', label: 'Editorial' },
      { id: 'minimal', label: 'Minimal' },
      { id: 'romantic', label: 'Romantic' },
    ],
    data_requirements: {
      required_paths: ['proposal.title'],
      optional_paths: ['event.date', 'gallery.hero_image_url', 'branding.logo_url'],
    },
    defaults: {
      layout_variant: 'editorial',
      content: {
        title_mode: 'proposal_title',
        subtitle_mode: 'event_summary',
        show_logo: true,
        show_hero_image: true,
        hero_image_source: 'gallery.hero',
      },
      styles: {
        alignment: 'left',
        padding: 32,
        border_radius: 24,
        image_crop_preset: 'balanced',
      },
    },
    controls: [
      {
        id: 'content',
        label: 'Content',
        controls: [
          {
            type: 'select',
            key: 'content.title_mode',
            label: 'Title Source',
            options: [
              { label: 'Proposal Title', value: 'proposal_title' },
              { label: 'Custom', value: 'custom' },
            ],
          },
          { type: 'text', key: 'content.custom_title', label: 'Custom Title' },
          { type: 'toggle', key: 'content.show_logo', label: 'Show Logo' },
          { type: 'toggle', key: 'content.show_hero_image', label: 'Show Hero Image' },
        ],
      },
      {
        id: 'media',
        label: 'Media',
        controls: [
          {
            type: 'select',
            key: 'content.hero_image_source',
            label: 'Hero Image Source',
            options: [
              { label: 'Proposal Hero Image', value: 'gallery.hero' },
              { label: 'Template Asset', value: 'asset' },
              { label: 'None', value: 'none' },
            ],
          },
          {
            type: 'asset-picker',
            key: 'content.hero_asset_id',
            label: 'Hero Asset',
            asset_types: ['image', 'background'],
          },
        ],
      },
      {
        id: 'style',
        label: 'Style',
        controls: [
          {
            type: 'select',
            key: 'styles.alignment',
            label: 'Alignment',
            options: [
              { label: 'Left', value: 'left' },
              { label: 'Center', value: 'center' },
              { label: 'Right', value: 'right' },
            ],
          },
          ...BASE_SURFACE_STYLE_CONTROLS,
        ],
      },
      {
        id: 'typography',
        label: 'Typography',
        controls: [...BASE_TYPOGRAPHY_STYLE_CONTROLS],
      },
      {
        id: 'image',
        label: 'Image Treatment',
        controls: [
          {
            type: 'select',
            key: 'styles.image_position',
            label: 'Image Position',
            options: [
              { label: 'Top', value: 'top' },
              { label: 'Center', value: 'center' },
              { label: 'Bottom', value: 'bottom' },
            ],
          },
          IMAGE_CROP_PRESET_CONTROL,
          { type: 'range', key: 'styles.hero_height', label: 'Hero Height', min: 220, max: 520, step: 10 },
        ],
      },
    ],
    validation: {
      max_instances: 1,
      required_content_fields: ['content.title_mode'],
    },
    renderer: {
      partial_key: 'blocks/cover',
      renderer_id: 'cover-block-renderer',
    },
  },
  'intro-note': {
    type: 'intro-note',
    label: 'Welcome Note',
    description: 'Short editorial note after the cover.',
    icon: 'note',
    supports: {
      repeatable: false,
      removable: true,
      reorderable: true,
      advanced_partial_override: true,
    },
    variants: [
      { id: 'simple', label: 'Simple' },
      { id: 'editorial', label: 'Editorial' },
    ],
    data_requirements: {
      required_paths: [],
      optional_paths: ['intro.welcome_message'],
    },
    defaults: {
      layout_variant: 'simple',
      content: {
        section_title: 'Welcome',
        message_mode: 'intro.welcome_message',
      },
      styles: {
        alignment: 'left',
        padding: 24,
      },
    },
    controls: [
      {
        id: 'content',
        label: 'Content',
        controls: [
          { type: 'text', key: 'content.section_title', label: 'Section Title' },
          {
            type: 'select',
            key: 'content.message_mode',
            label: 'Message Source',
            options: [
              { label: 'Proposal Intro Message', value: 'intro.welcome_message' },
              { label: 'Custom Message', value: 'custom' },
            ],
          },
          { type: 'textarea', key: 'content.custom_message', label: 'Custom Message' },
        ],
      },
      {
        id: 'style',
        label: 'Style',
        controls: [...BASE_SURFACE_STYLE_CONTROLS],
      },
      {
        id: 'typography',
        label: 'Typography',
        controls: [...BASE_TYPOGRAPHY_STYLE_CONTROLS],
      },
    ],
    validation: {
      max_instances: 1,
    },
    renderer: {
      partial_key: 'blocks/intro-note',
      renderer_id: 'intro-note-renderer',
    },
  },
  'event-summary': {
    type: 'event-summary',
    label: 'Event Summary',
    description: 'Quick facts about the event and client.',
    icon: 'event',
    supports: {
      repeatable: false,
      removable: true,
      reorderable: true,
      advanced_partial_override: true,
    },
    variants: [
      { id: 'two-column', label: 'Two Column' },
      { id: 'stacked', label: 'Stacked' },
      { id: 'minimal', label: 'Minimal' },
    ],
    data_requirements: {
      required_paths: ['event.type'],
      optional_paths: ['event.date', 'event.venue_name', 'event.guest_count'],
    },
    defaults: {
      layout_variant: 'two-column',
      content: {
        section_title: 'Event Summary',
        show_event_type: true,
        show_event_date: true,
        show_venue: true,
        show_guest_count: true,
        show_planner: true,
      },
      styles: {
        padding: 24,
      },
    },
    controls: [
      {
        id: 'content',
        label: 'Visible Fields',
        controls: [
          { type: 'toggle', key: 'content.show_event_type', label: 'Event Type' },
          { type: 'toggle', key: 'content.show_event_date', label: 'Event Date' },
          { type: 'toggle', key: 'content.show_venue', label: 'Venue' },
          { type: 'toggle', key: 'content.show_guest_count', label: 'Guest Count' },
          { type: 'toggle', key: 'content.show_planner', label: 'Planner' },
        ],
      },
      {
        id: 'style',
        label: 'Style',
        controls: [...BASE_SURFACE_STYLE_CONTROLS],
      },
      {
        id: 'typography',
        label: 'Typography',
        controls: [...BASE_TYPOGRAPHY_STYLE_CONTROLS],
      },
    ],
    validation: {
      max_instances: 1,
    },
    renderer: {
      partial_key: 'blocks/event-summary',
      renderer_id: 'event-summary-renderer',
    },
  },
  'mood-gallery': {
    type: 'mood-gallery',
    label: 'Mood Gallery',
    description: 'Image gallery for mood and inspiration.',
    icon: 'gallery',
    supports: {
      repeatable: false,
      removable: true,
      reorderable: true,
      advanced_partial_override: true,
    },
    variants: [
      { id: 'grid', label: 'Grid' },
      { id: 'editorial-strip', label: 'Editorial Strip' },
      { id: 'hero-grid', label: 'Hero Grid' },
    ],
    data_requirements: {
      required_paths: ['gallery.mood_images'],
      optional_paths: ['gallery.hero_image_url'],
    },
    defaults: {
      layout_variant: 'grid',
      content: {
        section_title: 'Inspiration',
        show_captions: true,
        max_images: 6,
      },
      styles: {
        padding: 24,
        image_aspect_ratio: 'portrait',
        image_crop_preset: 'balanced',
      },
    },
    controls: [
      {
        id: 'gallery',
        label: 'Gallery',
        controls: [
          { type: 'text', key: 'content.section_title', label: 'Section Title' },
          { type: 'toggle', key: 'content.show_captions', label: 'Show Captions' },
          { type: 'number', key: 'content.max_images', label: 'Max Images' },
        ],
      },
      {
        id: 'style',
        label: 'Style',
        controls: [...BASE_SURFACE_STYLE_CONTROLS],
      },
      {
        id: 'typography',
        label: 'Typography',
        controls: [...BASE_TYPOGRAPHY_STYLE_CONTROLS],
      },
      {
        id: 'image',
        label: 'Image Treatment',
        controls: [
          {
            type: 'select',
            key: 'styles.image_position',
            label: 'Image Position',
            options: [
              { label: 'Top', value: 'top' },
              { label: 'Center', value: 'center' },
              { label: 'Bottom', value: 'bottom' },
            ],
          },
          IMAGE_CROP_PRESET_CONTROL,
          { type: 'range', key: 'styles.hero_height', label: 'Image Height', min: 140, max: 420, step: 10 },
        ],
      },
    ],
    validation: {
      max_instances: 1,
    },
    renderer: {
      partial_key: 'blocks/mood-gallery',
      renderer_id: 'mood-gallery-renderer',
    },
  },
  'proposal-items': {
    type: 'proposal-items',
    label: 'Floral Line Items',
    description: 'Displays proposal products and arrangements.',
    icon: 'list',
    supports: {
      repeatable: false,
      removable: true,
      reorderable: true,
      advanced_partial_override: true,
    },
    variants: [
      { id: 'stacked', label: 'Stacked' },
      { id: 'cards', label: 'Cards' },
      { id: 'editorial-list', label: 'Editorial List' },
    ],
    data_requirements: {
      required_paths: ['line_items'],
      optional_paths: ['line_items[*].image_url', 'line_items[*].description'],
    },
    defaults: {
      layout_variant: 'stacked',
      content: {
        section_title: 'Floral Proposal',
        section_intro: null,
        show_item_images: true,
        show_item_descriptions: true,
        show_item_notes: false,
        show_quantity: false,
        show_category: true,
        show_prices: true,
      },
      styles: {
        image_aspect_ratio: 'portrait',
        padding: 24,
        image_crop_preset: 'balanced',
      },
    },
    controls: [
      {
        id: 'content',
        label: 'Content',
        controls: [
          { type: 'text', key: 'content.section_title', label: 'Section Title' },
          { type: 'textarea', key: 'content.section_intro', label: 'Section Intro' },
          { type: 'toggle', key: 'content.show_item_images', label: 'Show Images' },
          { type: 'toggle', key: 'content.show_item_descriptions', label: 'Show Descriptions' },
          { type: 'toggle', key: 'content.show_item_notes', label: 'Show Item Notes' },
          { type: 'toggle', key: 'content.show_quantity', label: 'Show Quantity' },
          { type: 'toggle', key: 'content.show_category', label: 'Show Category' },
          { type: 'toggle', key: 'content.show_prices', label: 'Show Prices' },
        ],
      },
      {
        id: 'style',
        label: 'Style',
        controls: [
          ...BASE_SURFACE_STYLE_CONTROLS,
          {
            type: 'select',
            key: 'styles.image_aspect_ratio',
            label: 'Image Ratio',
            options: [
              { label: 'Portrait', value: 'portrait' },
              { label: 'Square', value: 'square' },
              { label: 'Landscape', value: 'landscape' },
            ],
          },
        ],
      },
      {
        id: 'typography',
        label: 'Typography',
        controls: [...BASE_TYPOGRAPHY_STYLE_CONTROLS],
      },
      {
        id: 'image',
        label: 'Image Treatment',
        controls: [
          {
            type: 'select',
            key: 'styles.image_position',
            label: 'Image Position',
            options: [
              { label: 'Top', value: 'top' },
              { label: 'Center', value: 'center' },
              { label: 'Bottom', value: 'bottom' },
            ],
          },
          { type: 'range', key: 'styles.hero_height', label: 'Image Height', min: 160, max: 420, step: 10 },
        ],
      },
    ],
    validation: {
      max_instances: 1,
      required_content_fields: ['content.section_title'],
    },
    renderer: {
      partial_key: 'blocks/proposal-items',
      renderer_id: 'proposal-items-renderer',
    },
  },
  'investment-summary': {
    type: 'investment-summary',
    label: 'Investment Summary',
    description: 'Pricing summary and payment schedule.',
    icon: 'totals',
    supports: {
      repeatable: false,
      removable: true,
      reorderable: true,
      advanced_partial_override: true,
    },
    variants: [
      { id: 'classic', label: 'Classic' },
      { id: 'boxed', label: 'Boxed' },
      { id: 'minimal', label: 'Minimal' },
    ],
    data_requirements: {
      required_paths: ['investment.grand_total'],
      optional_paths: ['investment.payment_schedule'],
    },
    defaults: {
      layout_variant: 'classic',
      content: {
        title: 'Investment',
        show_subtotal: true,
        show_discount: true,
        show_tax: true,
        show_service_fee: true,
        show_grand_total: true,
        show_payment_schedule: true,
        highlight_grand_total: true,
      },
      styles: {
        padding: 24,
      },
    },
    controls: [
      {
        id: 'investment',
        label: 'Investment',
        controls: [
          { type: 'text', key: 'content.title', label: 'Section Title' },
          { type: 'toggle', key: 'content.show_subtotal', label: 'Show Subtotal' },
          { type: 'toggle', key: 'content.show_discount', label: 'Show Discounts' },
          { type: 'toggle', key: 'content.show_tax', label: 'Show Tax' },
          { type: 'toggle', key: 'content.show_service_fee', label: 'Show Service Fee' },
          { type: 'toggle', key: 'content.show_grand_total', label: 'Show Grand Total' },
          { type: 'toggle', key: 'content.show_payment_schedule', label: 'Show Payment Schedule' },
        ],
      },
      {
        id: 'style',
        label: 'Style',
        controls: [...BASE_SURFACE_STYLE_CONTROLS],
      },
      {
        id: 'typography',
        label: 'Typography',
        controls: [...BASE_TYPOGRAPHY_STYLE_CONTROLS],
      },
    ],
    validation: {
      max_instances: 1,
      required_content_fields: ['content.title'],
    },
    renderer: {
      partial_key: 'blocks/investment-summary',
      renderer_id: 'investment-summary-renderer',
    },
  },
  'included-services': {
    type: 'included-services',
    label: 'Included Services',
    description: 'Bulleted or card list of inclusions.',
    icon: 'checklist',
    supports: {
      repeatable: false,
      removable: true,
      reorderable: true,
      advanced_partial_override: true,
    },
    variants: [
      { id: 'bulleted', label: 'Bulleted' },
      { id: 'cards', label: 'Cards' },
    ],
    data_requirements: {
      required_paths: [],
      optional_paths: ['inclusions'],
    },
    defaults: {
      layout_variant: 'bulleted',
      content: {
        section_title: 'Included Services',
        empty_state_text: 'No inclusions have been configured yet.',
      },
      styles: {
        padding: 24,
      },
    },
    controls: [
      {
        id: 'services',
        label: 'Services',
        controls: [
          { type: 'text', key: 'content.section_title', label: 'Section Title' },
          { type: 'textarea', key: 'content.empty_state_text', label: 'Empty State Text' },
        ],
      },
      {
        id: 'style',
        label: 'Style',
        controls: [...BASE_SURFACE_STYLE_CONTROLS],
      },
      {
        id: 'typography',
        label: 'Typography',
        controls: [...BASE_TYPOGRAPHY_STYLE_CONTROLS],
      },
    ],
    validation: {
      max_instances: 1,
    },
    renderer: {
      partial_key: 'blocks/included-services',
      renderer_id: 'included-services-renderer',
    },
  },
  'terms-and-next-steps': {
    type: 'terms-and-next-steps',
    label: 'Terms & Next Steps',
    description: 'Terms, policy copy, and acceptance instructions.',
    icon: 'terms',
    supports: {
      repeatable: false,
      removable: true,
      reorderable: true,
      advanced_partial_override: true,
    },
    variants: [
      { id: 'stacked', label: 'Stacked' },
      { id: 'split', label: 'Split' },
    ],
    data_requirements: {
      required_paths: [],
      optional_paths: ['terms.payment_terms', 'cta.acceptance_instructions'],
    },
    defaults: {
      layout_variant: 'stacked',
      content: {
        title: 'Terms & Next Steps',
        show_payment_terms: true,
        show_cancellation_policy: true,
        show_revision_policy: true,
        show_acceptance_instructions: true,
      },
      styles: {
        padding: 24,
      },
    },
    controls: [
      {
        id: 'terms',
        label: 'Sections',
        controls: [
          { type: 'text', key: 'content.title', label: 'Section Title' },
          { type: 'toggle', key: 'content.show_payment_terms', label: 'Show Payment Terms' },
          { type: 'toggle', key: 'content.show_cancellation_policy', label: 'Show Cancellation Policy' },
          { type: 'toggle', key: 'content.show_revision_policy', label: 'Show Revision Policy' },
          { type: 'toggle', key: 'content.show_acceptance_instructions', label: 'Show Acceptance Instructions' },
        ],
      },
      {
        id: 'style',
        label: 'Style',
        controls: [...BASE_SURFACE_STYLE_CONTROLS],
      },
      {
        id: 'typography',
        label: 'Typography',
        controls: [...BASE_TYPOGRAPHY_STYLE_CONTROLS],
      },
    ],
    validation: {
      max_instances: 1,
      required_content_fields: ['content.title'],
    },
    renderer: {
      partial_key: 'blocks/terms-and-next-steps',
      renderer_id: 'terms-next-steps-renderer',
    },
  },
  'signature-closing': {
    type: 'signature-closing',
    label: 'Signature & Closing',
    description: 'Closing note and signature treatment.',
    icon: 'signature',
    supports: {
      repeatable: false,
      removable: true,
      reorderable: true,
      advanced_partial_override: true,
    },
    variants: [
      { id: 'simple', label: 'Simple' },
      { id: 'editorial', label: 'Editorial' },
    ],
    data_requirements: {
      required_paths: [],
      optional_paths: ['intro.closing_message', 'intro.signature_name'],
    },
    defaults: {
      layout_variant: 'simple',
      content: {
        title: 'With Appreciation',
        message_mode: 'intro.closing_message',
        show_signature_name: true,
        show_signature_title: true,
      },
      styles: {
        alignment: 'left',
        padding: 24,
      },
    },
    controls: [
      {
        id: 'closing',
        label: 'Closing',
        controls: [
          { type: 'text', key: 'content.title', label: 'Section Title' },
          {
            type: 'select',
            key: 'content.message_mode',
            label: 'Message Source',
            options: [
              { label: 'Proposal Closing Message', value: 'intro.closing_message' },
              { label: 'Custom Message', value: 'custom' },
            ],
          },
          { type: 'textarea', key: 'content.custom_message', label: 'Custom Message' },
          { type: 'toggle', key: 'content.show_signature_name', label: 'Show Signature Name' },
          { type: 'toggle', key: 'content.show_signature_title', label: 'Show Signature Title' },
        ],
      },
      {
        id: 'style',
        label: 'Style',
        controls: [...BASE_SURFACE_STYLE_CONTROLS],
      },
      {
        id: 'typography',
        label: 'Typography',
        controls: [...BASE_TYPOGRAPHY_STYLE_CONTROLS],
      },
    ],
    validation: {
      max_instances: 1,
    },
    renderer: {
      partial_key: 'blocks/signature-closing',
      renderer_id: 'signature-closing-renderer',
    },
  },
};
