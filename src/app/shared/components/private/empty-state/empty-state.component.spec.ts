import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  let component: EmptyStateComponent;
  let fixture: ComponentFixture<EmptyStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmptyStateComponent);
    component = fixture.componentInstance;
    component.title = 'No tasks';
    component.description = 'Create a task to get started.';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the configured title and description', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('No tasks');
    expect(compiled.textContent).toContain('Create a task to get started.');
  });

  it('should hide the action button when no action label is provided', () => {
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('should emit the action when the action button is clicked', () => {
    const emitted: void[] = [];
    component.actionLabel = 'Create task';
    component.action.subscribe(() => emitted.push(undefined));
    fixture.detectChanges();

    fixture.debugElement.query(By.css('button')).triggerEventHandler('click');

    expect(emitted.length).toBe(1);
  });
});
