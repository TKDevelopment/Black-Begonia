export type CatalogItemType =
  | 'flower'
  | 'greenery'
  | 'hardgood'
  | 'packaging'
  | 'labor'
  | 'fee'
  | 'other';

export type CatalogUnitType =
  | 'stem'
  | 'bunch'
  | 'box'
  | 'block'
  | 'piece'
  | 'hour'
  | 'foot'
  | 'bundle'
  | 'other';

export interface CatalogItem {
  item_id: string;
  name: string;
  item_type: CatalogItemType;
  unit_type: CatalogUnitType;
  pack_quantity?: number | null;
  color?: string | null;
  variety?: string | null;
  sku?: string | null;
  base_unit_cost: number;
  default_waste_percent: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCatalogItemInput {
  name: string;
  item_type: CatalogItemType;
  unit_type: CatalogUnitType;
  pack_quantity?: number | null;
  color?: string | null;
  variety?: string | null;
  sku?: string | null;
  base_unit_cost: number;
  default_waste_percent?: number;
  is_active?: boolean;
}
