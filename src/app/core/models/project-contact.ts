export type ProjectContactRelationship =
  | 'client'
  | 'partner'
  | 'planner'
  | 'venue_contact'
  | 'billing_contact'
  | 'other';

export interface ProjectContact {
  project_contact_id: string;
  project_id: string;
  contact_id: string;
  relationship_type: ProjectContactRelationship;
  is_primary: boolean;
  created_at: string;
}

export interface CreateProjectContactInput {
  project_id: string;
  contact_id: string;
  relationship_type: ProjectContactRelationship;
  is_primary?: boolean;
}
