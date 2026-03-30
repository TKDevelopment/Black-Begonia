import { Injectable } from '@angular/core';
import { CatalogItem, CreateCatalogItemInput } from '../../models/catalog-item';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class CatalogItemRepositoryService {
  constructor(private supabaseService: SupabaseService) {}

  private readonly selectClause = `
    item_id,
    name,
    item_type,
    unit_type,
    pack_quantity,
    color,
    variety,
    sku,
    base_unit_cost,
    default_waste_percent,
    is_active,
    created_at,
    updated_at
  `;

  async getCatalogItems(): Promise<CatalogItem[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('catalog_items')
      .select(this.selectClause)
      .order('name', { ascending: true });

    if (error) {
      console.error('[CatalogItemRepositoryService] getCatalogItems error:', error);
      return [];
    }

    return (data ?? []) as CatalogItem[];
  }

  async getCatalogItemById(itemId: string): Promise<CatalogItem | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('catalog_items')
      .select(this.selectClause)
      .eq('item_id', itemId)
      .single();

    if (error) {
      console.error('[CatalogItemRepositoryService] getCatalogItemById error:', error);
      return null;
    }

    return data as CatalogItem;
  }

  async createCatalogItem(payload: CreateCatalogItemInput): Promise<CatalogItem> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('catalog_items')
      .insert({
        name: payload.name.trim(),
        item_type: payload.item_type,
        unit_type: payload.unit_type,
        pack_quantity: payload.pack_quantity ?? null,
        color: payload.color?.trim() || null,
        variety: payload.variety?.trim() || null,
        sku: payload.sku?.trim() || null,
        base_unit_cost: payload.base_unit_cost,
        default_waste_percent: payload.default_waste_percent ?? 0,
        is_active: payload.is_active ?? true,
      })
      .select(this.selectClause)
      .single();

    if (error) {
      console.error('[CatalogItemRepositoryService] createCatalogItem error:', error);
      throw error;
    }

    return data as CatalogItem;
  }

  async updateCatalogItem(itemId: string, updates: Partial<CatalogItem>): Promise<CatalogItem> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('catalog_items')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('item_id', itemId)
      .select(this.selectClause)
      .single();

    if (error) {
      console.error('[CatalogItemRepositoryService] updateCatalogItem error:', error);
      throw error;
    }

    return data as CatalogItem;
  }
}
