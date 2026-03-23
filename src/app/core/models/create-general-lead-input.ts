export interface CreateGeneralLeadInput {
  service_type: string;
  event_type?: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  preferred_contact_method?: string | null;
  event_date?: string | null;
  inquiry_message?: string | null;
  source?: string | null;
};