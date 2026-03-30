import { Injectable } from '@angular/core';
import { CreateProjectContactInput, ProjectContact } from '../../models/project-contact';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class ProjectContactRepositoryService {
  constructor(private supabaseService: SupabaseService) {}

  private readonly projectContactSelect = `
    project_contact_id,
    project_id,
    contact_id,
    relationship_type,
    is_primary,
    created_at
  `;

  async createProjectContact(payload: CreateProjectContactInput): Promise<ProjectContact> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('project_contacts')
      .insert({
        project_id: payload.project_id,
        contact_id: payload.contact_id,
        relationship_type: payload.relationship_type,
        is_primary: payload.is_primary ?? false,
      })
      .select(this.projectContactSelect)
      .single();

    if (error) {
      console.error('[ProjectContactRepositoryService] createProjectContact error:', error);
      throw error;
    }

    return data as ProjectContact;
  }
}
