export type ActivityEntityType = 'lead' | 'contact' | 'organization' | 'project' | 'task';

export type ActivityLogType =
  | 'created'
  | 'updated'
  | 'proposal_viewed'
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

export interface ActivityLogEntry {
  activity_log_id: string;
  entity_type: ActivityEntityType;
  entity_id: string;
  activity_type: ActivityLogType;
  activity_label: string;
  description?: string | null;
  performed_by?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}
