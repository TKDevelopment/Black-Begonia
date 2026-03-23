import { LeadStatus } from './lead-status';

export interface LeadCreateRequest {
  service_type: string;
  event_type?: string | null;
  first_name: string;
  last_name: string;
  partner_first_name?: string | null;
  partner_last_name?: string | null;
  email: string;
  phone?: string | null;
  preferred_contact_method?: string | null;
  event_date?: string | null;
  venue_name?: string | null;
  venue_city?: string | null;
  venue_state?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  guest_count?: number | null;
  inquiry_message?: string | null;
  source: string;
  status?: LeadStatus;
  assigned_user_id?: string | null;
}