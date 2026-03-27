export interface LaborSettings {
  labor_settings_id: string;
  name: string;
  design_hourly_rate: number;
  installation_hourly_rate: number;
  teardown_hourly_rate: number;
  delivery_hourly_rate: number;
  consultation_hourly_rate: number;
  default_markup_percent: number;
  minimum_billable_hours: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
