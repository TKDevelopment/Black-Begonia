import { Injectable } from '@angular/core';
import { SupabaseService } from '../clients/supabase.service';
import { LeadActivity, LeadActivityType } from '../../models/lead-activity';
import { ActivityLogEntry, ActivityLogType } from '../../models/activity-log';

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

  async getProposalResponseActivities(): Promise<LeadActivity[]> {
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
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ActivityRepositoryService] getProposalResponseActivities error:', error);
      return [];
    }

    return (data ?? []) as LeadActivity[];
  }

  async createLeadActivity(payload: {
    lead_id: string;
    activity_type: LeadActivityType;
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

  async getProjectActivity(projectId: string): Promise<ActivityLogEntry[]> {
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
      .eq('entity_type', 'project')
      .eq('entity_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ActivityRepositoryService] getProjectActivity error:', error);
      return [];
    }

    return (data ?? []) as ActivityLogEntry[];
  }

  async createProjectActivity(payload: {
    project_id: string;
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
        entity_type: 'project',
        entity_id: payload.project_id,
        activity_type: payload.activity_type,
        activity_label: payload.activity_label,
        description: payload.description ?? null,
        performed_by: payload.performed_by ?? null,
        metadata: payload.metadata ?? {},
      });

    if (error) {
      console.error('[ActivityRepositoryService] createProjectActivity error:', error);
      throw error;
    }
  }

  async updateLeadActivity(
    leadActivityId: string,
    updates: {
      activity_label?: string;
      activity_description?: string | null;
      metadata?: Record<string, unknown> | null;
    }
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('lead_activity')
      .update({
        ...updates,
        metadata: updates.metadata ?? {},
      })
      .eq('lead_activity_id', leadActivityId);

    if (error) {
      console.error('[ActivityRepositoryService] updateLeadActivity error:', error);
      throw error;
    }
  }

  async deleteLeadActivity(leadActivityId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('lead_activity')
      .delete()
      .eq('lead_activity_id', leadActivityId);

    if (error) {
      console.error('[ActivityRepositoryService] deleteLeadActivity error:', error);
      throw error;
    }
  }
}
