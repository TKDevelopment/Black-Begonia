import { CatalogItemType, CatalogUnitType } from './catalog-item';

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
  email: string;
  service_type: string;
  event_type?: string | null;
  event_date?: string | null;
  status: string;
}

export interface FloralProposalRenderTemplateContext {
  template_id?: string | null;
  name?: string | null;
  template_key?: string | null;
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
  show_terms_section?: boolean;
  show_privacy_section?: boolean;
  show_signature_section?: boolean;
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
  base_unit_cost: number;
  applied_markup_percent: number;
  sell_unit_price: number;
  subtotal: number;
  reserve_percent?: number;
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

export interface PricingSettings {
  pricing_settings_id: string;
  default_markup_percent: number;
  default_reserve_percent: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentTemplate {
  template_id: string;
  name: string;
  template_key: string;
  template_kind: DocumentTemplateKind;
  is_active: boolean;
  is_default: boolean;
  logo_storage_path?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  heading_font_family?: string | null;
  body_font_family?: string | null;
  header_layout: DocumentTemplateHeaderLayout;
  line_item_layout: DocumentTemplateLineItemLayout;
  footer_layout: DocumentTemplateFooterLayout;
  show_cover_page: boolean;
  show_intro_message: boolean;
  intro_title?: string | null;
  intro_body?: string | null;
  show_terms_section: boolean;
  show_privacy_section: boolean;
  show_signature_section: boolean;
  agreement_clauses: Record<string, unknown>[];
  header_content: Record<string, unknown>;
  footer_content: Record<string, unknown>;
  body_config: Record<string, unknown>;
  template_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FloralProposal {
  floral_proposal_id: string;
  lead_id: string;
  template_id?: string | null;
  tax_region_id?: string | null;
  version: number;
  is_active: boolean;
  status: FloralProposalStatus;
  customer_email: string;
  pdf_storage_path?: string | null;
  pdf_url?: string | null;
  signed_url?: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  terms_version: string;
  privacy_policy_version: string;
  accepted_terms: boolean;
  accepted_privacy_policy: boolean;
  accepted_at?: string | null;
  declined_at?: string | null;
  signed_at?: string | null;
  signature_name?: string | null;
  signature_ip?: string | null;
  signature_user_agent?: string | null;
  decline_feedback?: string | null;
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
  vendor_id?: string | null;
  vendor_item_pack_id?: string | null;
  catalog_item_id?: string | null;
  item_name: string;
  item_type: CatalogItemType;
  unit_type: CatalogUnitType;
  required_units: number;
  reserve_percent: number;
  reserve_units: number;
  total_units_to_buy: number;
  units_per_pack?: number | null;
  required_pack_count?: number | null;
  estimated_pack_cost?: number | null;
  total_estimated_cost?: number | null;
  notes?: string | null;
  vendor?: {
    vendor_id: string;
    name: string;
  } | null;
}

export interface CreateFloralProposalInput {
  lead_id: string;
  template_id?: string | null;
  tax_region_id?: string | null;
  version: number;
  is_active?: boolean;
  status?: FloralProposalStatus;
  customer_email: string;
  passcode_hash: string;
  pdf_storage_path?: string | null;
  pdf_url?: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  terms_version?: string;
  privacy_policy_version?: string;
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
  primary_color?: string | null;
  accent_color?: string | null;
  heading_font_family?: string | null;
  body_font_family?: string | null;
  header_layout?: DocumentTemplateHeaderLayout;
  line_item_layout?: DocumentTemplateLineItemLayout;
  footer_layout?: DocumentTemplateFooterLayout;
  show_cover_page?: boolean;
  show_intro_message?: boolean;
  intro_title?: string | null;
  intro_body?: string | null;
  show_terms_section?: boolean;
  show_privacy_section?: boolean;
  show_signature_section?: boolean;
  agreement_clauses?: Record<string, unknown>[];
  header_content?: Record<string, unknown>;
  footer_content?: Record<string, unknown>;
  body_config?: Record<string, unknown>;
  template_config?: Record<string, unknown>;
}

export interface DocumentTemplateLogoUploadResult {
  storagePath: string;
  signedUrl: string;
}

