import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeadDeclineModalComponent } from './lead-decline-modal.component';

describe('LeadDeclineModalComponent', () => {
  let component: LeadDeclineModalComponent;
  let fixture: ComponentFixture<LeadDeclineModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeadDeclineModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LeadDeclineModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders only when open', () => {
    expect(fixture.nativeElement.textContent).not.toContain('Decline Lead');

    component.open = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Decline Lead');
    expect(fixture.nativeElement.textContent).toContain('Decline Reason');
  });

  it('emits trimmed decline reasons', () => {
    const emitted: string[] = [];
    component.confirm.subscribe((reason) => emitted.push(reason));
    component.reason.set('  Outside budget ');

    component.onConfirm();

    expect(emitted).toEqual(['Outside budget']);
  });

  it('clears reason on close and blocks close while saving', () => {
    const emitted: void[] = [];
    component.close.subscribe((value) => emitted.push(value));
    component.reason.set('No response');

    component.onClose();

    expect(component.reason()).toBe('');
    expect(emitted.length).toBe(1);

    component.reason.set('Still saving');
    component.saving = true;
    component.onClose();

    expect(component.reason()).toBe('Still saving');
    expect(emitted.length).toBe(1);
  });
});
