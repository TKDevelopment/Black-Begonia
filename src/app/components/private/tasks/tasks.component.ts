import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { TaskUpsertModalComponent, TaskUpsertPayload } from './components/task-upsert-modal/task-upsert-modal.component';
import { InternalUser } from '../../../core/models/internal-user';
import { Task, TaskPriority, TaskStatus } from '../../../core/models/task';
import { ToastService } from '../../../core/services/toast.service';
import { InternalUserRepositoryService } from '../../../core/supabase/repositories/internal-user-repository.service';
import { TaskWorkflowService } from '../../../core/supabase/services/task-workflow.service';
import { CrmPageHeaderComponent } from '../../../shared/components/private/crm-page-header/crm-page-header.component';
import { EntityTableCellDirective } from '../../../shared/components/private/entity-table-shell/entity-table-cell.directive';
import {
  AdminTableColumn,
  EntityTableShellComponent,
} from '../../../shared/components/private/entity-table-shell/entity-table-shell.component';
import {
  SearchFilterBarComponent,
  SearchFilterGroup,
} from '../../../shared/components/private/search-filter-bar/search-filter-bar.component';
import { StatusBadgeComponent } from '../../../shared/components/private/status-badge/status-badge.component';

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'purple';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CrmPageHeaderComponent,
    SearchFilterBarComponent,
    EntityTableShellComponent,
    EntityTableCellDirective,
    StatusBadgeComponent,
    TaskUpsertModalComponent,
  ],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss',
})
export class TasksComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly taskWorkflow = inject(TaskWorkflowService);
  private readonly internalUserRepository = inject(InternalUserRepositoryService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly tasks = signal<Task[]>([]);
  readonly internalUsers = signal<InternalUser[]>([]);

  readonly searchTerm = signal('');
  readonly statusFilter = signal<'all' | TaskStatus>('all');
  readonly priorityFilter = signal<'all' | TaskPriority>('all');
  readonly assigneeFilter = signal('all');

  readonly modalOpen = signal(false);
  readonly modalMode = signal<'create' | 'edit'>('create');
  readonly selectedTask = signal<Task | null>(null);

  readonly columns: AdminTableColumn[] = [
    { key: 'title', label: 'Task' },
    { key: 'related', label: 'Related To' },
    { key: 'assignee', label: 'Assignee' },
    { key: 'due_at', label: 'Due' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
  ];

  readonly filteredTasks = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const priority = this.priorityFilter();
    const assignee = this.assigneeFilter();

    return this.tasks().filter((task) => {
      const assigneeName = this.getTaskAssigneeName(task).toLowerCase();
      const relatedLabel = this.getTaskRelatedLabel(task).toLowerCase();
      const description = (task.description ?? '').toLowerCase();

      const matchesSearch =
        !term ||
        task.title.toLowerCase().includes(term) ||
        description.includes(term) ||
        relatedLabel.includes(term) ||
        assigneeName.includes(term);

      const matchesStatus = status === 'all' || task.status === status;
      const matchesPriority = priority === 'all' || task.priority === priority;
      const matchesAssignee =
        assignee === 'all' ||
        (assignee === 'unassigned'
          ? !task.assigned_user_id
          : task.assigned_user_id === assignee);

      return matchesSearch && matchesStatus && matchesPriority && matchesAssignee;
    });
  });

  readonly filters = computed<SearchFilterGroup[]>(() => [
    {
      key: 'status',
      label: 'Status',
      value: this.statusFilter(),
      options: [
        { label: 'All Statuses', value: 'all' },
        { label: 'Open', value: 'open' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Complete', value: 'complete' },
      ],
    },
    {
      key: 'priority',
      label: 'Priority',
      value: this.priorityFilter(),
      options: [
        { label: 'All Priorities', value: 'all' },
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' },
      ],
    },
    {
      key: 'assignee',
      label: 'Assignee',
      value: this.assigneeFilter(),
      options: [
        { label: 'All Assignees', value: 'all' },
        { label: 'Unassigned', value: 'unassigned' },
        ...this.internalUsers().map((user) => ({
          label: this.formatUserName(user),
          value: user.id,
        })),
      ],
    },
  ]);

  ngOnInit(): void {
    void this.initializePage();
  }

  async initializePage(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [tasks, internalUsers] = await Promise.all([
        this.taskWorkflow.getTasks(),
        this.internalUserRepository.getInternalUsers(),
      ]);

      this.tasks.set(tasks);
      this.internalUsers.set(internalUsers);
    } catch (error) {
      console.error('[TasksComponent] initializePage error:', error);
      this.tasks.set([]);
      this.internalUsers.set([]);
      this.error.set('We were unable to load the task list right now.');
    } finally {
      this.loading.set(false);
    }
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
  }

  onFilterChange(event: { key: string; value: string }): void {
    if (event.key === 'status') {
      this.statusFilter.set(event.value as 'all' | TaskStatus);
    }

    if (event.key === 'priority') {
      this.priorityFilter.set(event.value as 'all' | TaskPriority);
    }

    if (event.key === 'assignee') {
      this.assigneeFilter.set(event.value);
    }
  }

  resetFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('all');
    this.priorityFilter.set('all');
    this.assigneeFilter.set('all');
  }

  openCreateTaskModal(): void {
    this.selectedTask.set(null);
    this.modalMode.set('create');
    this.modalOpen.set(true);
  }

  openTask(task: Task): void {
    this.selectedTask.set(task);
    this.modalMode.set('edit');
    this.modalOpen.set(true);
  }

  closeTaskModal(force = false): void {
    if (this.saving() && !force) return;
    this.modalOpen.set(false);
    this.selectedTask.set(null);
    this.modalMode.set('create');
  }

  async saveTask(payload: TaskUpsertPayload): Promise<void> {
    if (this.saving()) return;

    try {
      this.saving.set(true);

      if (this.modalMode() === 'create') {
        await this.taskWorkflow.createTask({
          ...payload,
          related_entity_type: null,
          related_entity_id: null,
          lead_id: null,
          project_id: null,
        });
        this.toast.showToast('Task created.', 'success');
      } else {
        const currentTask = this.selectedTask();
        if (!currentTask) return;

        await this.taskWorkflow.updateTask(currentTask, payload);
        this.toast.showToast('Task updated.', 'success');
      }

      this.closeTaskModal(true);
      await this.initializePage();
    } catch (error) {
      console.error('[TasksComponent] saveTask error:', error);
      this.error.set('We were unable to save the task right now.');
    } finally {
      this.saving.set(false);
    }
  }

  retryLoad(): void {
    void this.initializePage();
  }

  openRelatedLead(task: Task, event: Event): void {
    event.stopPropagation();
    if (!task.lead_id) return;
    void this.router.navigate(['/admin/leads', task.lead_id]);
  }

  getTaskStatusTone(status: TaskStatus): BadgeTone {
    switch (status) {
      case 'open':
        return 'info';
      case 'in_progress':
        return 'warning';
      case 'complete':
        return 'success';
      default:
        return 'neutral';
    }
  }

  getTaskPriorityTone(priority: TaskPriority): BadgeTone {
    switch (priority) {
      case 'high':
        return 'danger';
      case 'medium':
        return 'warning';
      case 'low':
        return 'neutral';
      default:
        return 'neutral';
    }
  }

  getTaskAssigneeName(task: Task): string {
    return task.assigned_user ? this.formatUserName(task.assigned_user) : 'Unassigned';
  }

  getTaskRelatedLabel(task: Task): string {
    if (task.lead_name) return task.lead_name;
    if (task.project_id) return 'Project task';
    if (task.related_entity_type) {
      return `${this.formatDisplayValue(task.related_entity_type)} task`;
    }
    return 'General task';
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return 'No due date';

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  formatDisplayValue(value: string | null | undefined): string {
    if (!value) return 'Not set';

    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private formatUserName(user: InternalUser): string {
    const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
    return fullName || user.email;
  }
}
