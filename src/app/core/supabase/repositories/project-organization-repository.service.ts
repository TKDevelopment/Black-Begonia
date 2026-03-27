import { Injectable } from '@angular/core';
import { CreateProjectOrganizationInput, ProjectOrganization } from '../../models/project-organization';
import { SupabaseService } from '../clients/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class ProjectOrganizationRepositoryService {
  constructor(private supabaseService: SupabaseService) {}

  private readonly projectOrganizationSelect = `
    project_organization_id,
    project_id,
    organization_id,
    relationship_type,
    created_at
  `;

  async createProjectOrganization(payload: CreateProjectOrganizationInput): Promise<ProjectOrganization> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('project_organizations')
      .insert({
        project_id: payload.project_id,
        organization_id: payload.organization_id,
        relationship_type: payload.relationship_type,
      })
      .select(this.projectOrganizationSelect)
      .single();

    if (error) {
      console.error('[ProjectOrganizationRepositoryService] createProjectOrganization error:', error);
      throw error;
    }

    return data as ProjectOrganization;
  }
}
