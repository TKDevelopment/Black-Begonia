import { Injectable } from '@angular/core';
import { SupabaseService } from '../clients/supabase.service';
import { LeadActivity } from '../../models/lead-activity';

@Injectable({
  providedIn: 'root',
})
export class ActivityRepositoryService {
  constructor(private supabaseService: SupabaseService) {}

  async getLeadActivity(leadId: string): Promise<LeadActivity[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('lead_activity')
      .select(`
        lead_activity_id,
        lead_id,
        activity_type,
        activity_label,
        activity_description,
        performed_by,
        metadata,
        created_at
      `)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ActivityRepositoryService] getLeadActivity error:', error);
      return [];
    }

    return (data ?? []) as LeadActivity[];
  }

  async createLeadActivity(payload: {
    lead_id: string;
    activity_type: string;
    activity_label: string;
    activity_description?: string | null;
    performed_by?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('lead_activity')
      .insert({
        lead_id: payload.lead_id,
        activity_type: payload.activity_type,
        activity_label: payload.activity_label,
        activity_description: payload.activity_description ?? null,
        performed_by: payload.performed_by ?? null,
        metadata: payload.metadata ?? {},
      });

    if (error) {
      console.error('[ActivityRepositoryService] createLeadActivity error:', error);
      throw error;
    }
  }
}