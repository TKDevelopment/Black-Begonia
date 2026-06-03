import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatusBadgeComponent } from './status-badge.component';

describe('StatusBadgeComponent', () => {
  let component: StatusBadgeComponent;
  let fixture: ComponentFixture<StatusBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusBadgeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StatusBadgeComponent);
    component = fixture.componentInstance;
    component.label = 'new_inquiry';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should format underscored labels for display', () => {
    component.label = 'proposal_sent';

    expect(component.formattedLabel).toBe('Proposal Sent');
  });

  it('should return an empty label when no label is provided', () => {
    component.label = '';

    expect(component.formattedLabel).toBe('');
  });

  it('should include tone, size, and radius classes', () => {
    component.tone = 'success';
    component.size = 'md';
    component.pill = false;

    expect(component.classes).toContain('bg-emerald-100');
    expect(component.classes).toContain('px-3 py-1.5 text-sm');
    expect(component.classes).toContain('rounded-lg');
  });
});
