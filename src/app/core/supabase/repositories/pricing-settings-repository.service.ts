import { Injectable } from '@angular/core';

import { PricingSettings } from '../../models/floral-proposal';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class PricingSettingsRepositoryService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getActivePricingSettings(): Promise<PricingSettings | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('pricing_settings')
      .select(
        `
          pricing_settings_id,
          default_markup_percent,
          default_reserve_percent,
          is_active,
          created_at,
          updated_at
        `
      )
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        '[PricingSettingsRepositoryService] getActivePricingSettings error:',
        error
      );
      return null;
    }

    return (data as PricingSettings | null) ?? null;
  }
}
