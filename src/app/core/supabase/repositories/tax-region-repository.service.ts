import { Injectable } from '@angular/core';
import { CreateTaxRegionInput, TaxRegion } from '../../models/tax-region';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class TaxRegionRepositoryService {
  constructor(private supabaseService: SupabaseService) {}

  private readonly selectClause = `
    tax_region_id,
    name,
    authority_name,
    tax_rate,
    applies_to_products,
    applies_to_services,
    applies_to_delivery,
    is_active,
    created_at,
    updated_at
  `;

  async getTaxRegions(): Promise<TaxRegion[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('tax_regions')
      .select(this.selectClause)
      .order('name', { ascending: true });

    if (error) {
      console.error('[TaxRegionRepositoryService] getTaxRegions error:', error);
      return [];
    }

    return (data ?? []) as TaxRegion[];
  }

  async getTaxRegionById(taxRegionId: string): Promise<TaxRegion | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('tax_regions')
      .select(this.selectClause)
      .eq('tax_region_id', taxRegionId)
      .single();

    if (error) {
      console.error('[TaxRegionRepositoryService] getTaxRegionById error:', error);
      return null;
    }

    return data as TaxRegion;
  }

  async createTaxRegion(payload: CreateTaxRegionInput): Promise<TaxRegion> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('tax_regions')
      .insert({
        name: payload.name.trim(),
        authority_name: payload.authority_name?.trim() || null,
        tax_rate: payload.tax_rate,
        applies_to_products: payload.applies_to_products ?? true,
        applies_to_services: payload.applies_to_services ?? true,
        applies_to_delivery: payload.applies_to_delivery ?? true,
        is_active: payload.is_active ?? true,
      })
      .select(this.selectClause)
      .single();

    if (error) {
      console.error('[TaxRegionRepositoryService] createTaxRegion error:', error);
      throw error;
    }

    return data as TaxRegion;
  }

  async updateTaxRegion(taxRegionId: string, updates: Partial<TaxRegion>): Promise<TaxRegion> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('tax_regions')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('tax_region_id', taxRegionId)
      .select(this.selectClause)
      .single();

    if (error) {
      console.error('[TaxRegionRepositoryService] updateTaxRegion error:', error);
      throw error;
    }

    return data as TaxRegion;
  }
}
