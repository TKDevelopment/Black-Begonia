import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeadNoteModalComponent } from './lead-note-modal.component';

describe('LeadNoteModalComponent', () => {
  let component: LeadNoteModalComponent;
  let fixture: ComponentFixture<LeadNoteModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeadNoteModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LeadNoteModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders only when open', () => {
    expect(fixture.nativeElement.textContent).not.toContain('Add Note');

    component.open = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Add Note');
    expect(fixture.nativeElement.textContent).toContain('Internal Note');
  });

  it('requires a note before confirming', () => {
    const emitted: string[] = [];
    component.confirm.subscribe((note) => emitted.push(note));

    component.onConfirm();

    expect(component.validationError()).toBe('Please enter a note before saving.');
    expect(emitted).toEqual([]);
  });

  it('emits a trimmed note and clears validation', () => {
    const emitted: string[] = [];
    component.confirm.subscribe((note) => emitted.push(note));
    component.validationError.set('Previous error');
    component.note.set('  Follow up after tasting. ');

    component.onConfirm();

    expect(component.validationError()).toBeNull();
    expect(emitted).toEqual(['Follow up after tasting.']);
  });

  it('clears state on close and blocks close while saving', () => {
    const emitted: void[] = [];
    component.close.subscribe((value) => emitted.push(value));
    component.note.set('Draft');
    component.validationError.set('Required');

    component.onClose();

    expect(component.note()).toBe('');
    expect(component.validationError()).toBeNull();
    expect(emitted.length).toBe(1);

    component.note.set('Saving draft');
    component.saving = true;
    component.onClose();

    expect(component.note()).toBe('Saving draft');
    expect(emitted.length).toBe(1);
  });
});
