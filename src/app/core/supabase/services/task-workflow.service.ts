import { Injectable, inject } from '@angular/core';

import { AuthService } from '../../auth/auth.service';
import { Task, TaskUpsertInput } from '../../models/task';
import { ActivityRepositoryService } from '../repositories/activity-repository.service';
import { TaskRepositoryService } from '../repositories/task-repository.service';

@Injectable({
  providedIn: 'root',
})
export class TaskWorkflowService {
  private readonly taskRepository = inject(TaskRepositoryService);
  private readonly activityRepository = inject(ActivityRepositoryService);
  private readonly authService = inject(AuthService);

  async getTasks(): Promise<Task[]> {
    return this.taskRepository.getTasks();
  }

  async getTaskById(taskId: string): Promise<Task | null> {
    return this.taskRepository.getTaskById(taskId);
  }

  async getTasksByLeadId(leadId: string): Promise<Task[]> {
    return this.taskRepository.getTasksByLeadId(leadId);
  }

  async createTask(payload: TaskUpsertInput): Promise<Task> {
    const createdBy = this.authService.user?.id ?? null;
    const task = await this.taskRepository.createTask({
      ...payload,
      created_by: payload.created_by ?? createdBy,
    });

    if (task.lead_id) {
      await this.activityRepository.createLeadActivity({
        lead_id: task.lead_id,
        activity_type: 'task_created',
        activity_label: `Task created: ${task.title}`,
        activity_description: task.description ?? null,
        metadata: {
          task_id: task.task_id,
          task_status: task.status,
          task_priority: task.priority,
          due_at: task.due_at,
          assigned_user_id: task.assigned_user_id,
        },
      });
    }

    return task;
  }

  async updateTask(currentTask: Task, updates: Partial<TaskUpsertInput>): Promise<Task> {
    const nextTask = await this.taskRepository.updateTask(currentTask.task_id, updates);

    if (nextTask.lead_id && currentTask.status !== 'complete' && nextTask.status === 'complete') {
      await this.activityRepository.createLeadActivity({
        lead_id: nextTask.lead_id,
        activity_type: 'task_completed',
        activity_label: `Task completed: ${nextTask.title}`,
        activity_description: nextTask.description ?? null,
        metadata: {
          task_id: nextTask.task_id,
          completed_at: nextTask.completed_at,
        },
      });
    }

    return nextTask;
  }
}
