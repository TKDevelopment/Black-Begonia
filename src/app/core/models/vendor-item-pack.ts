export interface VendorItemPack {
  vendor_item_pack_id: string;
  vendor_id: string;
  item_id: string;
  purchase_unit_name: string;
  units_per_pack: number;
  pack_price: number;
  minimum_order_packs: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  item?: {
    item_id: string;
    name: string;
    sku?: string | null;
    item_type: string;
    unit_type: string;
    is_active: boolean;
  } | null;
  vendor?: {
    vendor_id: string;
    name: string;
  } | null;
}

export interface CreateVendorItemPackInput {
  vendor_id: string;
  item_id: string;
  purchase_unit_name: string;
  units_per_pack: number;
  pack_price: number;
  minimum_order_packs?: number;
  is_default?: boolean;
}
