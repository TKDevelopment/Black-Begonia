export type EstimateStatus = 'draft' | 'submitted' | 'declined' | 'accepted' | 'expired';
export type EstimateLineItemType = 'arrangement' | 'custom' | 'delivery' | 'install' | 'teardown' | 'rental' | 'fee' | 'discount';

export interface Estimate {
  estimate_id: string;
  lead_id: string;
  version: number;
  is_active: boolean;
  status: EstimateStatus;
  tax_region_id?: string | null;
  subtotal: number;
  discount_total: number;
  fee_total: number;
  tax_total: number;
  grand_total: number;
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
  estimate_pdf_storage_path?: string | null;
  created_at: string;
  updated_at: string;
  tax_region?: {
    tax_region_id: string;
    name: string;
    authority_name?: string | null;
    tax_rate: number;
    applies_to_products: boolean;
    applies_to_services: boolean;
    applies_to_delivery: boolean;
    is_active: boolean;
  } | null;
}

export interface EstimateLineItem {
  estimate_line_item_id: string;
  estimate_id: string;
  arrangement_id?: string | null;
  line_type: EstimateLineItemType;
  name: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  line_subtotal: number;
  pricing_snapshot: Record<string, unknown>;
  display_order: number;
  created_at: string;
  updated_at: string;
  arrangement?: {
    arrangement_id: string;
    name: string;
    category?: string | null;
    suggested_sell_price: number;
    manual_override_sell_price?: number | null;
  } | null;
}

export interface EstimateLineItemComponentSnapshot {
  estimate_line_item_component_id?: string;
  estimate_line_item_id?: string;
  item_id?: string | null;
  item_name: string;
  item_type: string;
  unit_type: string;
  color?: string | null;
  variety?: string | null;
  quantity_per_arrangement: number;
  arrangement_quantity: number;
  extended_quantity: number;
  waste_percent: number;
  extended_quantity_with_waste: number;
  unit_cost: number;
  extended_cost: number;
}

export interface ShoppingList {
  shopping_list_id: string;
  estimate_id: string;
  status: 'draft' | 'generated' | 'finalized' | 'exported';
  generated_at: string;
  exported_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShoppingListItem {
  shopping_list_item_id?: string;
  shopping_list_id?: string;
  vendor_id?: string | null;
  vendor_item_pack_id?: string | null;
  item_id?: string | null;
  item_name: string;
  item_type: string;
  unit_type: string;
  required_units: number;
  waste_percent: number;
  reserve_units?: number | null;
  required_units_with_waste: number;
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
