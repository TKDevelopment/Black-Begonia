import { Injectable } from '@angular/core';
import { ArrangementComponent, CreateArrangementComponentInput } from '../../models/arrangement-component';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class ArrangementComponentRepositoryService {
  constructor(private supabaseService: SupabaseService) {}

  private readonly selectClause = `
    arrangement_component_id,
    arrangement_id,
    item_id,
    quantity_per_arrangement,
    waste_percent,
    notes,
    created_at,
    updated_at,
    item:catalog_items (
      item_id,
      name,
      sku,
      item_type,
      unit_type,
      base_unit_cost,
      default_waste_percent,
      is_active
    )
  `;

  private normalizeComponent(row: any): ArrangementComponent {
    return {
      ...row,
      item: Array.isArray(row?.item) ? (row.item[0] ?? null) : (row?.item ?? null),
    } as ArrangementComponent;
  }

  async getArrangementComponents(arrangementId: string): Promise<ArrangementComponent[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('arrangement_components')
      .select(this.selectClause)
      .eq('arrangement_id', arrangementId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[ArrangementComponentRepositoryService] getArrangementComponents error:', error);
      return [];
    }

    return (data ?? []).map((row) => this.normalizeComponent(row));
  }

  async createArrangementComponent(payload: CreateArrangementComponentInput): Promise<ArrangementComponent> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('arrangement_components')
      .insert({
        arrangement_id: payload.arrangement_id,
        item_id: payload.item_id,
        quantity_per_arrangement: payload.quantity_per_arrangement,
        waste_percent: payload.waste_percent ?? null,
        notes: payload.notes?.trim() || null,
      })
      .select(this.selectClause)
      .single();

    if (error) {
      console.error('[ArrangementComponentRepositoryService] createArrangementComponent error:', error);
      throw error;
    }

    return this.normalizeComponent(data);
  }

  async updateArrangementComponent(componentId: string, updates: Partial<ArrangementComponent>): Promise<ArrangementComponent> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('arrangement_components')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('arrangement_component_id', componentId)
      .select(this.selectClause)
      .single();

    if (error) {
      console.error('[ArrangementComponentRepositoryService] updateArrangementComponent error:', error);
      throw error;
    }

    return this.normalizeComponent(data);
  }

  async deleteArrangementComponent(componentId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('arrangement_components')
      .delete()
      .eq('arrangement_component_id', componentId);

    if (error) {
      console.error('[ArrangementComponentRepositoryService] deleteArrangementComponent error:', error);
      throw error;
    }
  }
}
