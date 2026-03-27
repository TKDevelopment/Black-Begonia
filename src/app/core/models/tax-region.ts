export interface TaxRegion {
  tax_region_id: string;
  name: string;
  authority_name?: string | null;
  tax_rate: number;
  applies_to_products: boolean;
  applies_to_services: boolean;
  applies_to_delivery: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTaxRegionInput {
  name: string;
  authority_name?: string | null;
  tax_rate: number;
  applies_to_products?: boolean;
  applies_to_services?: boolean;
  applies_to_delivery?: boolean;
  is_active?: boolean;
}
