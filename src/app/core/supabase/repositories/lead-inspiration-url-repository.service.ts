import { Injectable } from '@angular/core';

import { LeadInspirationUrl } from '../../models/lead-inspiration-url';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class LeadInspirationUrlRepositoryService {
  constructor(private supabaseService: SupabaseService) {}

  private readonly inspirationSelect = `
    lead_inspiration_url_id,
    lead_id,
    url,
    created_at
  `;

  async getInspirationUrlsByLeadId(leadId: string): Promise<LeadInspirationUrl[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('lead_inspiration_urls')
      .select(this.inspirationSelect)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[LeadInspirationUrlRepositoryService] getInspirationUrlsByLeadId error:', error);
      return [];
    }

    return (data ?? []) as LeadInspirationUrl[];
  }
}
