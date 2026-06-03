import { SimpleChange } from '@angular/core';

import { testTask } from '../../../../../core/testing/workflow-fixtures';
import { TaskUpsertModalComponent } from './task-upsert-modal.component';

describe('TaskUpsertModalComponent', () => {
  let component: TaskUpsertModalComponent;

  beforeEach(() => {
    component = new TaskUpsertModalComponent();
  });

  it('hydrates defaults and edit task values when opened', () => {
    component.open = true;
    component.ngOnChanges({ open: new SimpleChange(false, true, false) });
    expect(component.priority()).toBe('medium');
    expect(component.status()).toBe('open');

    component.mode = 'edit';
    component.task = testTask;
    component.ngOnChanges({ task: new SimpleChange(null, testTask, false) });

    expect(component.heading).toBe('Edit Task');
    expect(component.confirmLabel).toBe('Save Task');
    expect(component.title()).toBe(testTask.title);
    expect(component.assignedUserId()).toBe(testTask.assigned_user_id ?? '');
    expect(component.dueAt()).toContain('2026-06-05T');
  });

  it('validates title before emitting', () => {
    const confirmSpy = spyOn(component.confirm, 'emit');

    component.title.set('');
    component.onConfirm();

    expect(component.validationError()).toBe('Task title is required.');
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('emits trimmed payload values and normalized nullable fields', () => {
    const confirmSpy = spyOn(component.confirm, 'emit');
    component.title.set(' Follow up ');
    component.description.set(' ');
    component.assignedUserId.set(' ');
    component.priority.set('high');
    component.status.set('complete');
    component.dueAt.set('2026-06-05T10:30');

    component.onConfirm();

    expect(confirmSpy).toHaveBeenCalledWith({
      title: 'Follow up',
      description: null,
      assigned_user_id: null,
      priority: 'high',
      status: 'complete',
      due_at: '2026-06-05T10:30',
    });
  });

  it('guards close while saving and emits close when idle', () => {
    const closeSpy = spyOn(component.close, 'emit');

    component.saving = true;
    component.onClose();
    expect(closeSpy).not.toHaveBeenCalled();

    component.saving = false;
    component.validationError.set('Error');
    component.onClose();
    expect(component.validationError()).toBeNull();
    expect(closeSpy).toHaveBeenCalled();
  });
});
