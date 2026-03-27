export type OrganizationType =
  | 'venue'
  | 'planner'
  | 'vendor'
  | 'corporate_client'
  | 'rental_company'
  | 'hospitality'
  | 'other';

export interface Organization {
  organization_id: string;
  name: string;
  organization_type: OrganizationType;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  notes?: string | null;
  created_from_lead_id?: string | null;
  is_archived: boolean;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOrganizationInput {
  name: string;
  organization_type: OrganizationType;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  notes?: string | null;
  created_from_lead_id?: string | null;
}
