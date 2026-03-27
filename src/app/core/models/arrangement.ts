export interface Arrangement {
  arrangement_id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  design_notes?: string | null;
  labor_settings_id?: string | null;
  design_labor_hours: number;
  markup_percent: number;
  calculated_cost: number;
  suggested_sell_price: number;
  manual_override_sell_price?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  labor_settings?: {
    labor_settings_id: string;
    name: string;
    design_hourly_rate: number;
  } | null;
}

export interface CreateArrangementInput {
  name: string;
  category?: string | null;
  description?: string | null;
  design_notes?: string | null;
  labor_settings_id?: string | null;
  design_labor_hours?: number;
  markup_percent?: number;
  calculated_cost?: number;
  suggested_sell_price?: number;
  manual_override_sell_price?: number | null;
  is_active?: boolean;
}
