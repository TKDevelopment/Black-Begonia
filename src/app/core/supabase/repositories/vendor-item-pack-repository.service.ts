import { Injectable } from '@angular/core';
import { CreateVendorItemPackInput, VendorItemPack } from '../../models/vendor-item-pack';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class VendorItemPackRepositoryService {
  constructor(private supabaseService: SupabaseService) {}

  private readonly selectClause = `
    vendor_item_pack_id,
    vendor_id,
    item_id,
    purchase_unit_name,
    units_per_pack,
    pack_price,
    minimum_order_packs,
    is_default,
    created_at,
    updated_at,
    item:catalog_items (
      item_id,
      name,
      sku,
      item_type,
      unit_type,
      is_active
    )
  `;

  private normalizePack(row: any): VendorItemPack {
    return {
      ...row,
      item: Array.isArray(row?.item) ? (row.item[0] ?? null) : (row?.item ?? null),
    } as VendorItemPack;
  }

  async getVendorItemPacks(vendorId: string): Promise<VendorItemPack[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('vendor_item_packs')
      .select(this.selectClause)
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[VendorItemPackRepositoryService] getVendorItemPacks error:', error);
      return [];
    }

    return (data ?? []).map((row) => this.normalizePack(row));
  }

  async getDefaultPacksForItems(itemIds: string[]): Promise<VendorItemPack[]> {
    if (!itemIds.length) return [];

    const { data, error } = await this.supabaseService
      .getClient()
      .from('vendor_item_packs')
      .select(`
        vendor_item_pack_id,
        vendor_id,
        item_id,
        purchase_unit_name,
        units_per_pack,
        pack_price,
        minimum_order_packs,
        is_default,
        created_at,
        updated_at,
        item:catalog_items (
          item_id,
          name,
          sku,
          item_type,
          unit_type,
          is_active
        ),
        vendor:vendors (
          vendor_id,
          name
        )
      `)
      .in('item_id', itemIds)
      .eq('is_default', true);

    if (error) {
      console.error('[VendorItemPackRepositoryService] getDefaultPacksForItems error:', error);
      return [];
    }

    return (data ?? []).map((row: any) => ({
      ...this.normalizePack(row),
      vendor: Array.isArray(row?.vendor) ? (row.vendor[0] ?? null) : (row?.vendor ?? null),
    })) as VendorItemPack[];
  }

  async createVendorItemPack(payload: CreateVendorItemPackInput): Promise<VendorItemPack> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('vendor_item_packs')
      .insert({
        vendor_id: payload.vendor_id,
        item_id: payload.item_id,
        purchase_unit_name: payload.purchase_unit_name.trim(),
        units_per_pack: payload.units_per_pack,
        pack_price: payload.pack_price,
        minimum_order_packs: payload.minimum_order_packs ?? 1,
        is_default: payload.is_default ?? false,
      })
      .select(this.selectClause)
      .single();

    if (error) {
      console.error('[VendorItemPackRepositoryService] createVendorItemPack error:', error);
      throw error;
    }

    return this.normalizePack(data);
  }

  async updateVendorItemPack(packId: string, updates: Partial<VendorItemPack>): Promise<VendorItemPack> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('vendor_item_packs')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('vendor_item_pack_id', packId)
      .select(this.selectClause)
      .single();

    if (error) {
      console.error('[VendorItemPackRepositoryService] updateVendorItemPack error:', error);
      throw error;
    }

    return this.normalizePack(data);
  }

  async deleteVendorItemPack(packId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('vendor_item_packs')
      .delete()
      .eq('vendor_item_pack_id', packId);

    if (error) {
      console.error('[VendorItemPackRepositoryService] deleteVendorItemPack error:', error);
      throw error;
    }
  }
}
