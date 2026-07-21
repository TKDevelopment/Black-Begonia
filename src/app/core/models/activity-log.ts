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
  | 'status_change'
  | 'payment_recorded'
  | 'payment_request_created'
  | 'payment_request_superseded'
  | 'payment_intention_recorded'
  | 'payment_delivery_updated'
  | 'payment_adjusted'
  | 'payment_exception_updated'
  | 'payment_fulfilled'
  | 'payment_legal_hold_changed'
  | 'proposal_revision_submitted'
  | 'proposal_document_submitted'
  | 'active_invoice_snapshot_changed';

export interface ActivityLogEntry {
  activity_log_id: string;
  entity_type: ActivityEntityType;
  entity_id: string;
  activity_type: ActivityLogType;
  activity_label: string;
  description?: string | null;
  performed_by?: string | null;
  performed_by_display_name?: string | null;
  performed_by_email?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  actor_type?: 'florist' | 'customer' | 'provider' | 'schedule' | 'system';
  payment_reference?: string | null;
}
