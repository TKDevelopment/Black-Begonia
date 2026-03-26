export interface LeadUpsertPayload {
  event_type: 'general' | 'wedding';
  service_type: string;
  first_name: string;
  last_name: string;
  partner_first_name?: string | null;
  partner_last_name?: string | null;
  email: string;
  phone?: string | null;
  preferred_contact_method?: string | null;
  event_date?: string | null;
  ceremony_venue_name?: string | null;
  ceremony_venue_city?: string | null;
  ceremony_venue_state?: string | null;
  reception_venue_name?: string | null;
  reception_venue_city?: string | null;
  reception_venue_state?: string | null;
  budget_range?: string | null;
  guest_count?: number | null;
  inquiry_message?: string | null;
  source?: string | null;
}
