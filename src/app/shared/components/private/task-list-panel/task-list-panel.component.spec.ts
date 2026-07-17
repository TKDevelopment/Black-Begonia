import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { TaskListItem, TaskListPanelComponent } from './task-list-panel.component';

describe('TaskListPanelComponent', () => {
  let component: TaskListPanelComponent;
  let fixture: ComponentFixture<TaskListPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskListPanelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaskListPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render loading and empty states', () => {
    component.loading = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Loading tasks...');

    component.loading = false;
    component.tasks = [];
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No tasks have been created for this lead yet.',
    );
  });

  it('should render tasks and emit the selected task', () => {
    const task: TaskListItem = {
      task_id: 'task-1',
      title: 'Confirm proposal details',
      status: 'in_progress',
      due_at: '2026-06-15T12:00:00.000Z',
      assignee_name: 'Avery Florist',
    };
    const opened: TaskListItem[] = [];
    component.tasks = [task];
    component.openTask.subscribe((value) => opened.push(value));
    fixture.detectChanges();

    const taskButton = fixture.debugElement.queryAll(By.css('button'))[1];
    taskButton.triggerEventHandler('click');

    expect(fixture.nativeElement.textContent).toContain('Confirm proposal details');
    expect(fixture.nativeElement.textContent).toContain('In Progress');
    expect(fixture.nativeElement.textContent).toContain('Avery Florist');
    expect(opened).toEqual([task]);
  });

  it('should emit create task unless the button is disabled', () => {
    const emitted: void[] = [];
    component.createDisabled = true;
    component.createTask.subscribe(() => emitted.push(undefined));
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.disabled).toBeTrue();

    component.createDisabled = false;
    fixture.detectChanges();
    fixture.debugElement.query(By.css('button')).triggerEventHandler('click');

    expect(emitted.length).toBe(1);
  });

  it('should format statuses, dates, and missing due dates', () => {
    expect(component.formatStatus('in_progress')).toBe('In Progress');
    expect(component.formatDate(null)).toBe('No due date');
    expect(component.formatDate('2026-06-15T12:00:00.000Z')).toContain('2026');
    expect(component.getStatusClasses('complete')).toContain('bg-emerald-100');
    expect(component.getStatusClasses('open')).toContain('bg-blue-100');
  });
});
