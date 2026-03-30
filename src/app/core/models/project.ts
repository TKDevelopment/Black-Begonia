export type ProjectStatus =
  | 'inquiry_converted'
  | 'proposal'
  | 'estimate_sent'
  | 'booked'
  | 'completed'
  | 'canceled';

export interface Project {
  project_id: string;
  project_name: string;
  service_type: string;
  event_type?: string | null;
  event_date?: string | null;
  ceremony_venue_name?: string | null;
  ceremony_venue_city?: string | null;
  ceremony_venue_state?: string | null;
  ceremony_venue_address?: string | null;
  reception_venue_name?: string | null;
  reception_venue_city?: string | null;
  reception_venue_state?: string | null;
  reception_venue_address?: string | null;
  budget_range?: string | null;
  guest_count?: number | null;
  style_notes?: string | null;
  internal_notes?: string | null;
  status: ProjectStatus;
  source_lead_id?: string | null;
  primary_contact_id?: string | null;
  assigned_user_id?: string | null;
  booked_at?: string | null;
  completed_at?: string | null;
  canceled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  project_name: string;
  service_type: string;
  event_type?: string | null;
  event_date?: string | null;
  ceremony_venue_name?: string | null;
  ceremony_venue_city?: string | null;
  ceremony_venue_state?: string | null;
  ceremony_venue_address?: string | null;
  reception_venue_name?: string | null;
  reception_venue_city?: string | null;
  reception_venue_state?: string | null;
  reception_venue_address?: string | null;
  budget_range?: string | null;
  guest_count?: number | null;
  style_notes?: string | null;
  internal_notes?: string | null;
  status?: ProjectStatus;
  source_lead_id?: string | null;
  primary_contact_id?: string | null;
  assigned_user_id?: string | null;
}
