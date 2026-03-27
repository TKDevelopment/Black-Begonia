import { Injectable } from '@angular/core';
import { LaborSettings } from '../../models/labor-settings';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class LaborSettingsRepositoryService {
  constructor(private supabaseService: SupabaseService) {}

  private readonly selectClause = `
    labor_settings_id,
    name,
    design_hourly_rate,
    installation_hourly_rate,
    teardown_hourly_rate,
    delivery_hourly_rate,
    consultation_hourly_rate,
    default_markup_percent,
    minimum_billable_hours,
    is_default,
    is_active,
    created_at,
    updated_at
  `;

  async getLaborSettings(): Promise<LaborSettings[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('labor_settings')
      .select(this.selectClause)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      console.error('[LaborSettingsRepositoryService] getLaborSettings error:', error);
      return [];
    }

    return (data ?? []) as LaborSettings[];
  }

  async getDefaultLaborSettings(): Promise<LaborSettings | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('labor_settings')
      .select(this.selectClause)
      .eq('is_default', true)
      .maybeSingle();

    if (error) {
      console.error('[LaborSettingsRepositoryService] getDefaultLaborSettings error:', error);
      return null;
    }

    return (data ?? null) as LaborSettings | null;
  }
}
