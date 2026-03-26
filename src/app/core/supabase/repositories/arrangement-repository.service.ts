import { Injectable } from '@angular/core';
import { Arrangement, CreateArrangementInput } from '../../models/arrangement';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class ArrangementRepositoryService {
  constructor(private supabaseService: SupabaseService) {}

  private readonly selectClause = `
    arrangement_id,
    name,
    category,
    description,
    design_notes,
    labor_settings_id,
    design_labor_hours,
    markup_percent,
    calculated_cost,
    suggested_sell_price,
    manual_override_sell_price,
    is_active,
    created_at,
    updated_at,
    labor_settings:labor_settings (
      labor_settings_id,
      name,
      design_hourly_rate
    )
  `;

  private normalizeArrangement(row: any): Arrangement {
    return {
      ...row,
      labor_settings: Array.isArray(row?.labor_settings)
        ? (row.labor_settings[0] ?? null)
        : (row?.labor_settings ?? null),
    } as Arrangement;
  }

  async getArrangements(): Promise<Arrangement[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('arrangements')
      .select(this.selectClause)
      .order('name', { ascending: true });

    if (error) {
      console.error('[ArrangementRepositoryService] getArrangements error:', error);
      return [];
    }

    return (data ?? []).map((row) => this.normalizeArrangement(row));
  }

  async getArrangementById(arrangementId: string): Promise<Arrangement | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('arrangements')
      .select(this.selectClause)
      .eq('arrangement_id', arrangementId)
      .single();

    if (error) {
      console.error('[ArrangementRepositoryService] getArrangementById error:', error);
      return null;
    }

    return this.normalizeArrangement(data);
  }

  async createArrangement(payload: CreateArrangementInput): Promise<Arrangement> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('arrangements')
      .insert({
        name: payload.name.trim(),
        category: payload.category?.trim() || null,
        description: payload.description?.trim() || null,
        design_notes: payload.design_notes?.trim() || null,
        labor_settings_id: payload.labor_settings_id ?? null,
        design_labor_hours: payload.design_labor_hours ?? 0,
        markup_percent: payload.markup_percent ?? 30,
        calculated_cost: payload.calculated_cost ?? 0,
        suggested_sell_price: payload.suggested_sell_price ?? 0,
        manual_override_sell_price: payload.manual_override_sell_price ?? null,
        is_active: payload.is_active ?? true,
      })
      .select(this.selectClause)
      .single();

    if (error) {
      console.error('[ArrangementRepositoryService] createArrangement error:', error);
      throw error;
    }

    return this.normalizeArrangement(data);
  }

  async updateArrangement(arrangementId: string, updates: Partial<Arrangement>): Promise<Arrangement> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('arrangements')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('arrangement_id', arrangementId)
      .select(this.selectClause)
      .single();

    if (error) {
      console.error('[ArrangementRepositoryService] updateArrangement error:', error);
      throw error;
    }

    return this.normalizeArrangement(data);
  }
}
