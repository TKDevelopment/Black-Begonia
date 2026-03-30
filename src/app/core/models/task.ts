import { ActivityEntityType } from './activity-log';
import { InternalUser } from './internal-user';

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'open' | 'in_progress' | 'complete';

export interface Task {
  task_id: string;
  title: string;
  description?: string | null;
  related_entity_type?: ActivityEntityType | null;
  related_entity_id?: string | null;
  lead_id?: string | null;
  project_id?: string | null;
  assigned_user_id?: string | null;
  created_by?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  assigned_user?: InternalUser | null;
  created_by_user?: InternalUser | null;
  lead_name?: string | null;
}

export interface TaskUpsertInput {
  title: string;
  description?: string | null;
  related_entity_type?: ActivityEntityType | null;
  related_entity_id?: string | null;
  lead_id?: string | null;
  project_id?: string | null;
  assigned_user_id?: string | null;
  created_by?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_at?: string | null;
}
