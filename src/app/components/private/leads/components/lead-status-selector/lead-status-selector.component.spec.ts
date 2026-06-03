import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeadStatusSelectorComponent } from './lead-status-selector.component';

describe('LeadStatusSelectorComponent', () => {
  let component: LeadStatusSelectorComponent;
  let fixture: ComponentFixture<LeadStatusSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeadStatusSelectorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LeadStatusSelectorComponent);
    component = fixture.componentInstance;
    component.value = 'new';
    fixture.detectChanges();
  });

  it('renders allowed statuses as formatted options', () => {
    component.allowedStatuses = ['new', 'consultation_scheduled'];
    fixture.detectChanges();

    const options = Array.from(
      fixture.nativeElement.querySelectorAll('option')
    ) as HTMLOptionElement[];

    expect(options.map((option) => option.value)).toEqual([
      'new',
      'consultation_scheduled',
    ]);
    expect(options.map((option) => option.textContent?.trim())).toEqual([
      'New',
      'Consultation Scheduled',
    ]);
  });

  it('emits selected status changes', () => {
    const emitted: string[] = [];
    component.statusChange.subscribe((status) => emitted.push(status));

    component.onSelectionChange('contacted');

    expect(emitted).toEqual(['contacted']);
  });

  it('accepts disabled state from the parent workflow', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    expect(component.disabled).toBeTrue();
  });

  it('formats status labels', () => {
    expect(component.formatLabel('proposal_accepted')).toBe('Proposal Accepted');
  });
});
