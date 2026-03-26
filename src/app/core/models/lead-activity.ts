export type LeadActivityType =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'assigned'
  | 'contact_attempted'
  | 'consultation_scheduled'
  | 'declined'
  | 'accepted'
  | 'converted'
  | 'note_added'
  | 'task_created'
  | 'task_completed'
  | 'status_change';

export interface LeadActivity {
  lead_activity_id: string;
  lead_id: string;
  activity_type: LeadActivityType;
  activity_label: string;
  activity_description?: string | null;
  performed_by?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}
