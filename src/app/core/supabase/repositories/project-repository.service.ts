import { Injectable } from '@angular/core';
import { CreateProjectInput, Project } from '../../models/project';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class ProjectRepositoryService {
  constructor(private supabaseService: SupabaseService) {}

  private readonly projectSelect = `
    project_id,
    project_name,
    service_type,
    event_type,
    event_date,
    ceremony_venue_name,
    ceremony_venue_city,
    ceremony_venue_state,
    ceremony_venue_address,
    reception_venue_name,
    reception_venue_city,
    reception_venue_state,
    reception_venue_address,
    budget_range,
    guest_count,
    style_notes,
    internal_notes,
    status,
    source_lead_id,
    primary_contact_id,
    assigned_user_id,
    booked_at,
    completed_at,
    canceled_at,
    created_at,
    updated_at
  `;

  async getProjects(): Promise<Project[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('projects')
      .select(this.projectSelect)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ProjectRepositoryService] getProjects error:', error);
      return [];
    }

    return (data ?? []) as Project[];
  }

  async createProject(payload: CreateProjectInput): Promise<Project> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('projects')
      .insert({
        project_name: payload.project_name.trim(),
        service_type: payload.service_type,
        event_type: payload.event_type ?? null,
        event_date: payload.event_date ?? null,
        ceremony_venue_name: payload.ceremony_venue_name?.trim() || null,
        ceremony_venue_city: payload.ceremony_venue_city?.trim() || null,
        ceremony_venue_state: payload.ceremony_venue_state?.trim() || null,
        ceremony_venue_address: payload.ceremony_venue_address?.trim() || null,
        reception_venue_name: payload.reception_venue_name?.trim() || null,
        reception_venue_city: payload.reception_venue_city?.trim() || null,
        reception_venue_state: payload.reception_venue_state?.trim() || null,
        reception_venue_address: payload.reception_venue_address?.trim() || null,
        budget_range: payload.budget_range?.trim() || null,
        guest_count: payload.guest_count ?? null,
        style_notes: payload.style_notes?.trim() || null,
        internal_notes: payload.internal_notes?.trim() || null,
        status: payload.status ?? 'inquiry_converted',
        source_lead_id: payload.source_lead_id ?? null,
        primary_contact_id: payload.primary_contact_id ?? null,
        assigned_user_id: payload.assigned_user_id ?? null,
      })
      .select(this.projectSelect)
      .single();

    if (error) {
      console.error('[ProjectRepositoryService] createProject error:', error);
      throw error;
    }

    return data as Project;
  }
}
