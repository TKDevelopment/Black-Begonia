export type ProjectOrganizationRelationship =
  | 'venue'
  | 'planner_company'
  | 'vendor'
  | 'corporate_client'
  | 'other';

export interface ProjectOrganization {
  project_organization_id: string;
  project_id: string;
  organization_id: string;
  relationship_type: ProjectOrganizationRelationship;
  created_at: string;
}

export interface CreateProjectOrganizationInput {
  project_id: string;
  organization_id: string;
  relationship_type: ProjectOrganizationRelationship;
}
