import { Injectable } from '@angular/core';
import { SupabaseService } from '../clients/supabase.service';
import {
  ActivityEntityType,
  ActivityLogEntry,
  ActivityLogType,
} from '../../models/activity-log';

@Injectable({
  providedIn: 'root',
})
export class ActivityLogRepositoryService {
  constructor(private supabaseService: SupabaseService) {}

  async getEntityActivity(
    entityType: ActivityEntityType,
    entityId: string
  ): Promise<ActivityLogEntry[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('activity_log')
      .select(`
        activity_log_id,
        entity_type,
        entity_id,
        activity_type,
        activity_label,
        description,
        performed_by,
        metadata,
        created_at
      `)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ActivityLogRepositoryService] getEntityActivity error:', error);
      return [];
    }

    return (data ?? []) as ActivityLogEntry[];
  }

  async createActivityLog(payload: {
    entity_type: ActivityEntityType;
    entity_id: string;
    activity_type: ActivityLogType;
    activity_label: string;
    description?: string | null;
    performed_by?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('activity_log')
      .insert({
        entity_type: payload.entity_type,
        entity_id: payload.entity_id,
        activity_type: payload.activity_type,
        activity_label: payload.activity_label,
        description: payload.description ?? null,
        performed_by: payload.performed_by ?? null,
        metadata: payload.metadata ?? {},
      });

    if (error) {
      console.error('[ActivityLogRepositoryService] createActivityLog error:', error);
      throw error;
    }
  }
}
