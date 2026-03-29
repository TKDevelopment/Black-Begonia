import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { InternalUser } from '../../../../../core/models/internal-user';
import { Task, TaskPriority, TaskStatus } from '../../../../../core/models/task';

export interface TaskUpsertPayload {
  title: string;
  description?: string | null;
  assigned_user_id?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_at?: string | null;
}

@Component({
  selector: 'app-task-upsert-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-upsert-modal.component.html',
})
export class TaskUpsertModalComponent {
  readonly priorities: TaskPriority[] = ['low', 'medium', 'high'];
  readonly statuses: TaskStatus[] = ['open', 'in_progress', 'complete'];

  @Input() open = false;
  @Input() saving = false;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() task: Task | null = null;
  @Input() internalUsers: InternalUser[] = [];
  @Input() relatedLeadLabel: string | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<TaskUpsertPayload>();

  readonly title = signal('');
  readonly description = signal('');
  readonly assignedUserId = signal('');
  readonly priority = signal<TaskPriority>('medium');
  readonly status = signal<TaskStatus>('open');
  readonly dueAt = signal('');
  readonly validationError = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue || (changes['task'] && this.open)) {
      this.hydrateForm();
    }
  }

  get heading(): string {
    return this.mode === 'create' ? 'Create Task' : 'Edit Task';
  }

  get confirmLabel(): string {
    if (this.saving) {
      return this.mode === 'create' ? 'Creating...' : 'Saving...';
    }

    return this.mode === 'create' ? 'Create Task' : 'Save Task';
  }

  onClose(): void {
    if (this.saving) return;
    this.validationError.set(null);
    this.close.emit();
  }

  onConfirm(): void {
    const title = this.title().trim();

    if (!title) {
      this.validationError.set('Task title is required.');
      return;
    }

    this.validationError.set(null);
    this.confirm.emit({
      title,
      description: this.description().trim() || null,
      assigned_user_id: this.assignedUserId().trim() || null,
      priority: this.priority(),
      status: this.status(),
      due_at: this.dueAt().trim() || null,
    });
  }

  private hydrateForm(): void {
    const task = this.task;

    this.title.set(task?.title ?? '');
    this.description.set(task?.description ?? '');
    this.assignedUserId.set(task?.assigned_user_id ?? '');
    this.priority.set(task?.priority ?? 'medium');
    this.status.set(task?.status ?? 'open');
    this.dueAt.set(task?.due_at ? this.toDateTimeLocal(task.due_at) : '');
    this.validationError.set(null);
  }

  private toDateTimeLocal(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
}
