export interface ArrangementComponent {
  arrangement_component_id: string;
  arrangement_id: string;
  item_id: string;
  quantity_per_arrangement: number;
  waste_percent?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  item?: {
    item_id: string;
    name: string;
    sku?: string | null;
    item_type: string;
    unit_type: string;
    color?: string | null;
    variety?: string | null;
    base_unit_cost: number;
    default_waste_percent: number;
    is_active: boolean;
  } | null;
}

export interface CreateArrangementComponentInput {
  arrangement_id: string;
  item_id: string;
  quantity_per_arrangement: number;
  waste_percent?: number | null;
  notes?: string | null;
}
