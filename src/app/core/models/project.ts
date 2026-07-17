export type ProjectStatus =
  | 'awaiting_deposit'
  | 'booked'
  | 'awaiting_final_payment'
  | 'final_prep'
  | 'completed'
  | 'canceled';

export const PROJECT_STATUSES: ProjectStatus[] = [
  'awaiting_deposit',
  'booked',
  'awaiting_final_payment',
  'final_prep',
  'completed',
  'canceled',
];

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
  ceremony_venue_zipcode?: string | null;
  reception_venue_name?: string | null;
  reception_venue_city?: string | null;
  reception_venue_state?: string | null;
  reception_venue_address?: string | null;
  reception_venue_zipcode?: string | null;
  budget_range?: string | null;
  guest_count?: number | null;
  style_notes?: string | null;
  internal_notes?: string | null;
  status: ProjectStatus;
  source_lead_id?: string | null;
  primary_contact_id?: string | null;
  assigned_user_id?: string | null;
  active_proposal_invoice_snapshot_id?: string | null;
  active_proposal_document_version_id?: string | null;
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
  ceremony_venue_zipcode?: string | null;
  reception_venue_name?: string | null;
  reception_venue_city?: string | null;
  reception_venue_state?: string | null;
  reception_venue_address?: string | null;
  reception_venue_zipcode?: string | null;
  budget_range?: string | null;
  guest_count?: number | null;
  style_notes?: string | null;
  internal_notes?: string | null;
  status?: ProjectStatus;
  source_lead_id?: string | null;
  primary_contact_id?: string | null;
  assigned_user_id?: string | null;
  active_proposal_invoice_snapshot_id?: string | null;
  active_proposal_document_version_id?: string | null;
}

export type UpdateProjectInput = Partial<
  Pick<
    Project,
    | 'project_name'
    | 'service_type'
    | 'event_type'
    | 'event_date'
    | 'ceremony_venue_name'
    | 'ceremony_venue_city'
    | 'ceremony_venue_state'
    | 'ceremony_venue_address'
    | 'ceremony_venue_zipcode'
    | 'reception_venue_name'
    | 'reception_venue_city'
    | 'reception_venue_state'
    | 'reception_venue_address'
    | 'reception_venue_zipcode'
    | 'budget_range'
    | 'guest_count'
    | 'style_notes'
    | 'internal_notes'
    | 'status'
    | 'active_proposal_invoice_snapshot_id'
    | 'active_proposal_document_version_id'
    | 'booked_at'
    | 'completed_at'
    | 'canceled_at'
  >
>;
