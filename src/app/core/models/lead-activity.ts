export interface LeadActivity {
  lead_activity_id: string;
  lead_id: string;
  activity_type: string;
  activity_label: string;
  activity_description: string | null;
  performed_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}