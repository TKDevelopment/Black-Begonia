import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface TaskListItem {
  task_id: string;
  title: string;
  status: 'open' | 'in_progress' | 'complete';
  due_at?: string | null;
  assignee_name?: string | null;
}

@Component({
  selector: 'app-task-list-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './task-list-panel.component.html',
  styleUrl: './task-list-panel.component.scss',
})
export class TaskListPanelComponent {
  @Input() tasks: TaskListItem[] = [];
  @Input() loading = false;

  @Output() createTask = new EventEmitter<void>();
  @Output() openTask = new EventEmitter<TaskListItem>();

  getStatusClasses(status: TaskListItem['status']): string {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-700';
      case 'in_progress':
        return 'bg-amber-100 text-amber-700';
      case 'complete':
        return 'bg-emerald-100 text-emerald-700';
      default:
        return 'bg-stone-100 text-stone-700';
    }
  }

  formatStatus(status: TaskListItem['status']): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (char: string) => char.toUpperCase());
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return 'No due date';

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  }
}