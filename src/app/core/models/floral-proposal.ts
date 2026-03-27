import { CatalogItemType, CatalogUnitType } from './catalog-item';

export type FloralProposalStatus =
  | 'draft'
  | 'submitted'
  | 'declined'
  | 'accepted'
  | 'expired';

export type FloralProposalLineItemType = 'product' | 'fee' | 'discount';
export type FloralProposalShoppingListStatus = 'generated' | 'exported';
export type DocumentTemplateKind = 'floral_proposal';

export interface FloralProposalResponseSummary {
  proposal_id: string;
  action: 'accept' | 'decline';
  feedback: string | null;
  created_at: string;
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
  header_content: Record<string, unknown>;
  footer_content: Record<string, unknown>;
  body_config: Record<string, unknown>;
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
  notes?: string | null;
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
