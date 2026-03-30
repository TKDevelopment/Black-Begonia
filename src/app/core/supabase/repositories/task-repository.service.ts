import { Injectable } from '@angular/core';

import { Task, TaskStatus, TaskUpsertInput } from '../../models/task';
import { SupabaseService } from '../clients/supabase.service';

type TaskRow = {
  task_id: string;
  title: string;
  description?: string | null;
  related_entity_type?: Task['related_entity_type'];
  related_entity_id?: string | null;
  lead_id?: string | null;
  project_id?: string | null;
  assigned_user_id?: string | null;
  created_by?: string | null;
  priority: Task['priority'];
  status: TaskStatus;
  due_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  assigned_user?: Task['assigned_user'] | Task['assigned_user'][];
  created_by_user?: Task['created_by_user'] | Task['created_by_user'][];
  lead?: {
    lead_id: string;
    first_name?: string | null;
    last_name?: string | null;
  } | {
    lead_id: string;
    first_name?: string | null;
    last_name?: string | null;
  }[] | null;
};

@Injectable({
  providedIn: 'root',
})
export class TaskRepositoryService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private readonly taskSelect = `
    task_id,
    title,
    description,
    related_entity_type,
    related_entity_id,
    lead_id,
    project_id,
    assigned_user_id,
    created_by,
    priority,
    status,
    due_at,
    completed_at,
    created_at,
    updated_at,
    assigned_user:profiles!tasks_assigned_user_id_fkey (
      id,
      first_name,
      last_name,
      email
    ),
    created_by_user:profiles!tasks_created_by_fkey (
      id,
      first_name,
      last_name,
      email
    ),
    lead:leads (
      lead_id,
      first_name,
      last_name
    )
  `;

  async getTasks(): Promise<Task[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('tasks')
      .select(this.taskSelect)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[TaskRepositoryService] getTasks error:', error);
      return [];
    }

    return (data ?? []).map((row) => this.mapTask(row as unknown as TaskRow));
  }

  async getTasksByLeadId(leadId: string): Promise<Task[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('tasks')
      .select(this.taskSelect)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[TaskRepositoryService] getTasksByLeadId error:', error);
      return [];
    }

    return (data ?? []).map((row) => this.mapTask(row as unknown as TaskRow));
  }

  async getTaskById(taskId: string): Promise<Task | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('tasks')
      .select(this.taskSelect)
      .eq('task_id', taskId)
      .maybeSingle();

    if (error) {
      console.error('[TaskRepositoryService] getTaskById error:', error);
      return null;
    }

    return data ? this.mapTask(data as unknown as TaskRow) : null;
  }

  async createTask(payload: TaskUpsertInput): Promise<Task> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('tasks')
      .insert(this.toPersistencePayload(payload))
      .select(this.taskSelect)
      .single();

    if (error) {
      console.error('[TaskRepositoryService] createTask error:', error);
      throw error;
    }

    return this.mapTask(data as unknown as TaskRow);
  }

  async updateTask(taskId: string, updates: Partial<TaskUpsertInput>): Promise<Task> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('tasks')
      .update(this.toPersistencePayload(updates))
      .eq('task_id', taskId)
      .select(this.taskSelect)
      .single();

    if (error) {
      console.error('[TaskRepositoryService] updateTask error:', error);
      throw error;
    }

    return this.mapTask(data as unknown as TaskRow);
  }

  private toPersistencePayload(payload: Partial<TaskUpsertInput>): Record<string, unknown> {
    const normalizedDueAt = payload.due_at?.trim()
      ? new Date(payload.due_at).toISOString()
      : payload.due_at === null
        ? null
        : undefined;
    const isComplete = payload.status === 'complete';

    return {
      ...(payload.title !== undefined ? { title: payload.title.trim() } : {}),
      ...(payload.description !== undefined
        ? { description: payload.description?.trim() || null }
        : {}),
      ...(payload.related_entity_type !== undefined
        ? { related_entity_type: payload.related_entity_type ?? null }
        : {}),
      ...(payload.related_entity_id !== undefined
        ? { related_entity_id: payload.related_entity_id ?? null }
        : {}),
      ...(payload.lead_id !== undefined ? { lead_id: payload.lead_id ?? null } : {}),
      ...(payload.project_id !== undefined ? { project_id: payload.project_id ?? null } : {}),
      ...(payload.assigned_user_id !== undefined
        ? { assigned_user_id: payload.assigned_user_id ?? null }
        : {}),
      ...(payload.created_by !== undefined ? { created_by: payload.created_by ?? null } : {}),
      ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(normalizedDueAt !== undefined ? { due_at: normalizedDueAt } : {}),
      ...(payload.status !== undefined
        ? { completed_at: isComplete ? new Date().toISOString() : null }
        : {}),
    };
  }

  private mapTask(row: TaskRow): Task {
    const assignedUser = Array.isArray(row.assigned_user)
      ? row.assigned_user[0] ?? null
      : row.assigned_user ?? null;
    const createdByUser = Array.isArray(row.created_by_user)
      ? row.created_by_user[0] ?? null
      : row.created_by_user ?? null;
    const lead = Array.isArray(row.lead) ? row.lead[0] ?? null : row.lead ?? null;
    const leadName = lead
      ? `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || lead.lead_id
      : null;

    return {
      task_id: row.task_id,
      title: row.title,
      description: row.description ?? null,
      related_entity_type: row.related_entity_type ?? null,
      related_entity_id: row.related_entity_id ?? null,
      lead_id: row.lead_id ?? null,
      project_id: row.project_id ?? null,
      assigned_user_id: row.assigned_user_id ?? null,
      created_by: row.created_by ?? null,
      priority: row.priority,
      status: row.status,
      due_at: row.due_at ?? null,
      completed_at: row.completed_at ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      assigned_user: assignedUser,
      created_by_user: createdByUser,
      lead_name: leadName,
    };
  }
}
