export type ContactType =
  | 'client'
  | 'partner'
  | 'planner'
  | 'venue_contact'
  | 'vendor_contact'
  | 'other';

export interface Contact {
  contact_id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  secondary_phone?: string | null;
  preferred_contact_method?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  contact_type?: ContactType | null;
  notes?: string | null;
  created_from_lead_id?: string | null;
  is_archived: boolean;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateContactInput {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  secondary_phone?: string | null;
  preferred_contact_method?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  contact_type?: ContactType | null;
  notes?: string | null;
  created_from_lead_id?: string | null;
}
