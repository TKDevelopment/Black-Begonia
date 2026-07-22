import { CatalogItemType, CatalogUnitType } from './catalog-item';
import { ProposalRendererKey } from '../proposal-templates/proposal-renderer.types';

export type FloralProposalStatus =
  | 'draft'
  | 'submitted'
  | 'declined'
  | 'accepted'
  | 'expired';

export type FloralProposalLineItemType = 'product' | 'fee' | 'discount' | 'labor';
export type FloralProposalShoppingListStatus = 'generated' | 'exported';
export type DocumentTemplateKind = 'floral_proposal';
export type DocumentTemplateHeaderLayout = 'editorial' | 'minimal' | 'classic';
export type DocumentTemplateLineItemLayout = 'image_left' | 'image_right' | 'stacked';
export type DocumentTemplateFooterLayout = 'signature_focused' | 'minimal' | 'formal';

export interface FloralProposalResponseSummary {
  proposal_id: string;
  action: 'accept' | 'decline';
  feedback: string | null;
  created_at: string;
}

export interface FloralProposalRenderLeadContext {
  lead_id: string;
  first_name: string;
  last_name: string;
  partner_first_name?: string | null;
  partner_last_name?: string | null;
  email: string;
  phone?: string | null;
  service_type: string;
  event_type?: string | null;
  event_date?: string | null;
  ceremony_venue_name?: string | null;
  ceremony_venue_city?: string | null;
  ceremony_venue_state?: string | null;
  ceremony_start_time?: string | null;
  reception_venue_name?: string | null;
  reception_venue_city?: string | null;
  reception_venue_state?: string | null;
  reception_start_time?: string | null;
  event_start_time?: string | null;
  status: string;
}

export interface FloralProposalRenderTemplateContext {
  // Export-rendering metadata only. The florist no longer selects a proposal template in the CRM.
  template_id?: string | null;
  name?: string | null;
  template_key?: string | null;
  renderer_key?: ProposalRendererKey | null;
  header_layout?: DocumentTemplateHeaderLayout | null;
  line_item_layout?: DocumentTemplateLineItemLayout | null;
  footer_layout?: DocumentTemplateFooterLayout | null;
  logo_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  heading_font_family?: string | null;
  body_font_family?: string | null;
  show_cover_page?: boolean;
  show_intro_message?: boolean;
  intro_title?: string | null;
  intro_body?: string | null;
  agreement_clauses?: Record<string, unknown>[];
  header_content?: Record<string, unknown>;
  footer_content?: Record<string, unknown>;
  body_config?: Record<string, unknown>;
  template_config?: Record<string, unknown>;
}

export interface FloralProposalRenderLineComponent {
  display_order: number;
  catalog_item_id?: string | null;
  catalog_item_name: string;
  quantity_per_unit: number;
  extended_quantity: number;
  /** Proposal-owned pre-markup cost per stem/unit, retained to four decimals. */
  base_unit_cost: number;
  applied_markup_percent: number;
  sell_unit_price: number;
  subtotal: number;
  reserve_percent?: number;
  pack_quantity?: number | null;
  /** Derived cent-valued cost for the row's snapshotted pack quantity. */
  effective_pack_cost?: number | null;
  snapshot?: Record<string, unknown>;
}

export interface FloralProposalRenderLineItem {
  display_order: number;
  line_item_type: FloralProposalLineItemType;
  line_type_label: string;
  item_name: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  image_storage_path?: string | null;
  image_signed_url?: string | null;
  image_alt_text?: string | null;
  image_caption?: string | null;
  components: FloralProposalRenderLineComponent[];
}

export interface FloralProposalRenderContract {
  proposal_id?: string | null;
  proposal_version?: number | null;
  generated_at: string;
  lead: FloralProposalRenderLeadContext;
  template: FloralProposalRenderTemplateContext;
  tax_region: {
    tax_region_id?: string | null;
    name?: string | null;
    tax_rate: number;
  };
  pricing: {
    default_markup_percent: number;
    labor_percent: number;
  };
  line_items: FloralProposalRenderLineItem[];
  shopping_list: FloralProposalShoppingListItem[];
  totals: {
    products_total: number;
    labor_total: number;
    fees_total: number;
    discounts_total: number;
    subtotal: number;
    tax_amount: number;
    total_amount: number;
  };
  renderer_assets: {
    line_item_images: Array<{
      display_order: number;
      item_name: string;
      storage_path?: string | null;
      signed_url?: string | null;
      alt_text?: string | null;
      caption?: string | null;
    }>;
  };
}

export interface DocumentTemplate {
  // Retained for internal export rendering and historical records, not active proposal authoring.
  template_id: string;
  name: string;
  template_key: string;
  template_kind: DocumentTemplateKind;
  is_active: boolean;
  is_default: boolean;
  logo_storage_path?: string | null;
  logo_url?: string | null;
  template_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GrapesJsStoredTemplateConfig {
  schema_version: '1.0';
  project_data?: Record<string, unknown>;
  published_html?: string | null;
  published_css?: string | null;
  published_at?: string | null;
  theme?: {
    primary_color?: string | null;
    accent_color?: string | null;
    heading_font_family?: string | null;
    body_font_family?: string | null;
  };
}

export interface FloralProposal {
  floral_proposal_id: string;
  lead_id: string;
  // Legacy linkage retained for historical proposal records only.
  template_id?: string | null;
  tax_region_id?: string | null;
  version: number;
  is_active: boolean;
  status: FloralProposalStatus;
  customer_email: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  final_balance_amount?: number;
  retainer_amount?: number;
  final_balance_due_date?: string | null;
  retainer_due_date?: string | null;
  terms_version: string;
  privacy_policy_version: string;
  finalized_at?: string | null;
  edit_reopened_at?: string | null;
  submitted_at?: string | null;
  snapshot: Record<string, unknown>;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  template?: DocumentTemplate | null;
}

export interface FloralProposalLineItem {
  floral_proposal_line_item_id: string;
  floral_proposal_id: string;
  display_order: number;
  line_item_type: FloralProposalLineItemType;
  item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  image_storage_path?: string | null;
  image_alt_text?: string | null;
  image_caption?: string | null;
  snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FloralProposalComponent {
  floral_proposal_component_id: string;
  floral_proposal_line_item_id: string;
  display_order: number;
  catalog_item_id?: string | null;
  catalog_item_name: string;
  quantity_per_unit: number;
  extended_quantity: number;
  /** Proposal-owned pre-markup cost per stem/unit, retained to four decimals. */
  base_unit_cost: number;
  applied_markup_percent: number;
  sell_unit_price: number;
  subtotal: number;
  reserve_percent: number;
  snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FloralProposalShoppingList {
  floral_proposal_shopping_list_id: string;
  floral_proposal_id: string;
  status: FloralProposalShoppingListStatus;
  generated_at: string;
  exported_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FloralProposalShoppingListItem {
  floral_proposal_shopping_list_item_id?: string;
  floral_proposal_shopping_list_id?: string;
  catalog_item_id?: string | null;
  item_name: string;
  item_type: CatalogItemType;
  unit_type: CatalogUnitType;
  required_units: number;
  reserve_percent: number;
  total_plus_reserve?: number;
  reserve_units: number;
  total_units_to_buy: number;
  units_per_pack?: number | null;
  required_pack_count?: number | null;
  /** Highest contributing proposal-row unit cost used for conservative purchasing. */
  pricing_unit_cost?: number | null;
  estimated_pack_cost?: number | null;
  total_estimated_cost?: number | null;
  notes?: string | null;
}

export interface CreateFloralProposalInput {
  lead_id: string;
  tax_region_id?: string | null;
  version: number;
  is_active?: boolean;
  status?: FloralProposalStatus;
  customer_email: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  final_balance_amount?: number;
  retainer_amount?: number;
  final_balance_due_date?: string | null;
  retainer_due_date?: string | null;
  terms_version?: string;
  privacy_policy_version?: string;
  finalized_at?: string | null;
  edit_reopened_at?: string | null;
  submitted_at?: string | null;
  snapshot?: Record<string, unknown>;
  created_by?: string | null;
}

export interface DocumentTemplateUpsertInput {
  name: string;
  template_key: string;
  template_kind?: DocumentTemplateKind;
  is_active?: boolean;
  is_default?: boolean;
  logo_storage_path?: string | null;
  logo_url?: string | null;
  template_config?: Record<string, unknown>;
}

export interface DocumentTemplateLogoUploadResult {
  storagePath: string;
  signedUrl: string;
}

