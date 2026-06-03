import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { testTask } from '../../../core/testing/workflow-fixtures';
import { createRouterSpy, createToastSpy, expectToast } from '../../../core/testing/crm-testing';
import { InternalUserRepositoryService } from '../../../core/supabase/repositories/internal-user-repository.service';
import { TaskWorkflowService } from '../../../core/supabase/services/task-workflow.service';
import { ToastService } from '../../../core/services/toast.service';
import { TasksComponent } from './tasks.component';

describe('TasksComponent', () => {
  let component: TasksComponent;
  let fixture: ComponentFixture<TasksComponent>;
  let router: jasmine.SpyObj<Router>;
  let taskWorkflow: jasmine.SpyObj<TaskWorkflowService>;
  let internalUserRepository: jasmine.SpyObj<InternalUserRepositoryService>;
  let toast: jasmine.SpyObj<ToastService>;

  const otherTask = {
    ...testTask,
    task_id: 'task-test-002',
    title: 'Order candles',
    description: 'Hardgoods task',
    priority: 'low' as const,
    status: 'complete' as const,
    assigned_user_id: null,
    assigned_user: null,
    lead_id: null,
    lead_name: null,
    project_id: 'project-test-001',
    related_entity_type: 'project' as const,
    related_entity_id: 'project-test-001',
  };

  beforeEach(async () => {
    router = createRouterSpy();
    router.navigate.and.resolveTo(true);
    taskWorkflow = jasmine.createSpyObj<TaskWorkflowService>('TaskWorkflowService', [
      'getTasks',
      'createTask',
      'updateTask',
    ]);
    internalUserRepository = jasmine.createSpyObj<InternalUserRepositoryService>(
      'InternalUserRepositoryService',
      ['getInternalUsers']
    );
    toast = createToastSpy();

    taskWorkflow.getTasks.and.resolveTo([testTask, otherTask]);
    internalUserRepository.getInternalUsers.and.resolveTo([testTask.assigned_user!]);

    await TestBed.configureTestingModule({
      imports: [TasksComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: TaskWorkflowService, useValue: taskWorkflow },
        { provide: InternalUserRepositoryService, useValue: internalUserRepository },
        { provide: ToastService, useValue: toast },
      ],
    })
      .overrideComponent(TasksComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(TasksComponent);
    component = fixture.componentInstance;
  });

  it('loads tasks and internal users for the table', async () => {
    await component.initializePage();

    expect(component.loading()).toBeFalse();
    expect(component.tasks()).toEqual([testTask, otherTask]);
    expect(component.internalUsers()).toEqual([testTask.assigned_user!]);
    expect(component.filters().find((filter) => filter.key === 'assignee')?.options).toContain(
      jasmine.objectContaining({ value: 'user-test-001', label: 'Test Admin' })
    );
  });

  it('sets an error and empty table state when initialization fails', async () => {
    spyOn(console, 'error');
    taskWorkflow.getTasks.and.rejectWith(new Error('tasks unavailable'));

    await component.initializePage();

    expect(component.loading()).toBeFalse();
    expect(component.tasks()).toEqual([]);
    expect(component.internalUsers()).toEqual([]);
    expect(component.error()).toBe('We were unable to load the task list right now.');
  });

  it('filters by search, status, priority, and assignee', () => {
    component.tasks.set([testTask, otherTask]);

    component.onSearchChange('proposal');
    component.onFilterChange({ key: 'status', value: 'open' });
    component.onFilterChange({ key: 'priority', value: 'high' });
    component.onFilterChange({ key: 'assignee', value: 'user-test-001' });

    expect(component.filteredTasks()).toEqual([testTask]);

    component.resetFilters();
    expect(component.searchTerm()).toBe('');
    expect(component.statusFilter()).toBe('all');
    expect(component.priorityFilter()).toBe('all');
    expect(component.assigneeFilter()).toBe('all');
  });

  it('opens create and edit modals and respects the saving close guard', () => {
    component.openCreateTaskModal();
    expect(component.modalMode()).toBe('create');
    expect(component.modalOpen()).toBeTrue();

    component.openTask(testTask);
    expect(component.modalMode()).toBe('edit');
    expect(component.selectedTask()).toEqual(testTask);

    component.saving.set(true);
    component.closeTaskModal();
    expect(component.modalOpen()).toBeTrue();

    component.closeTaskModal(true);
    expect(component.modalOpen()).toBeFalse();
    expect(component.selectedTask()).toBeNull();
  });

  it('creates tasks with normalized unrelated entity links and reloads the table', async () => {
    taskWorkflow.createTask.and.resolveTo(testTask);
    component.modalMode.set('create');
    component.modalOpen.set(true);

    await component.saveTask({
      title: 'Follow up',
      priority: 'high',
      status: 'open',
    });

    expect(taskWorkflow.createTask).toHaveBeenCalledWith({
      title: 'Follow up',
      priority: 'high',
      status: 'open',
      related_entity_type: null,
      related_entity_id: null,
      lead_id: null,
      project_id: null,
    });
    expectToast(toast, 'Task created.');
    expect(component.modalOpen()).toBeFalse();
    expect(taskWorkflow.getTasks).toHaveBeenCalledTimes(1);
  });

  it('updates selected tasks and shows failure state when saving fails', async () => {
    taskWorkflow.updateTask.and.resolveTo(testTask);
    component.modalMode.set('edit');
    component.selectedTask.set(testTask);

    await component.saveTask({
      title: 'Updated',
      priority: 'medium',
      status: 'in_progress',
    });

    expect(taskWorkflow.updateTask).toHaveBeenCalledWith(testTask, jasmine.any(Object));
    expectToast(toast, 'Task updated.');

    taskWorkflow.updateTask.and.rejectWith(new Error('save failed'));
    component.modalMode.set('edit');
    component.selectedTask.set(testTask);
    await component.saveTask({ title: 'Updated', priority: 'medium', status: 'open' });
    expect(component.error()).toBe('We were unable to save the task right now.');
  });

  it('navigates to linked leads and ignores unlinked lead clicks', () => {
    const event = jasmine.createSpyObj<Event>('Event', ['stopPropagation']);

    component.openRelatedLead(testTask, event);
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/admin/leads', testTask.lead_id]);

    router.navigate.calls.reset();
    component.openRelatedLead(otherTask, event);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('formats task display helpers for linked and empty values', () => {
    expect(component.getTaskStatusTone('open')).toBe('info');
    expect(component.getTaskStatusTone('complete')).toBe('success');
    expect(component.getTaskPriorityTone('high')).toBe('danger');
    expect(component.getTaskPriorityTone('low')).toBe('neutral');
    expect(component.getTaskAssigneeName(otherTask)).toBe('Unassigned');
    expect(component.getTaskRelatedLabel(testTask)).toBe('Avery Bloom');
    expect(component.getTaskRelatedLabel(otherTask)).toBe('Project task');
    expect(component.formatDate(null)).toBe('No due date');
    expect(component.formatDisplayValue('in_progress')).toBe('In Progress');
  });
});
