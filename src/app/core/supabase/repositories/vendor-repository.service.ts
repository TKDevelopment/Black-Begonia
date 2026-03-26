import { Injectable } from '@angular/core';
import { CreateVendorInput, Vendor } from '../../models/vendor';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class VendorRepositoryService {
  constructor(private supabaseService: SupabaseService) {}

  private readonly selectClause = `
    vendor_id,
    name,
    email,
    phone,
    website,
    notes,
    is_active,
    created_at,
    updated_at
  `;

  async getVendors(): Promise<Vendor[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('vendors')
      .select(this.selectClause)
      .order('name', { ascending: true });

    if (error) {
      console.error('[VendorRepositoryService] getVendors error:', error);
      return [];
    }

    return (data ?? []) as Vendor[];
  }

  async getVendorById(vendorId: string): Promise<Vendor | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('vendors')
      .select(this.selectClause)
      .eq('vendor_id', vendorId)
      .single();

    if (error) {
      console.error('[VendorRepositoryService] getVendorById error:', error);
      return null;
    }

    return data as Vendor;
  }

  async createVendor(payload: CreateVendorInput): Promise<Vendor> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('vendors')
      .insert({
        name: payload.name.trim(),
        email: payload.email?.trim().toLowerCase() || null,
        phone: payload.phone?.trim() || null,
        website: payload.website?.trim() || null,
        notes: payload.notes?.trim() || null,
        is_active: payload.is_active ?? true,
      })
      .select(this.selectClause)
      .single();

    if (error) {
      console.error('[VendorRepositoryService] createVendor error:', error);
      throw error;
    }

    return data as Vendor;
  }

  async updateVendor(vendorId: string, updates: Partial<Vendor>): Promise<Vendor> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('vendors')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('vendor_id', vendorId)
      .select(this.selectClause)
      .single();

    if (error) {
      console.error('[VendorRepositoryService] updateVendor error:', error);
      throw error;
    }

    return data as Vendor;
  }
}
