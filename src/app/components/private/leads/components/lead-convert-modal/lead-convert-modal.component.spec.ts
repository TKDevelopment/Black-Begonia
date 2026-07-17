import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';

import { testLead } from '../../../../../core/testing/workflow-fixtures';
import { LeadConversionService } from '../../../../../core/supabase/services/lead-conversion.service';
import { LeadConvertModalComponent } from './lead-convert-modal.component';

describe('LeadConvertModalComponent', () => {
  let component: LeadConvertModalComponent;
  let fixture: ComponentFixture<LeadConvertModalComponent>;
  let leadConversionService: jasmine.SpyObj<LeadConversionService>;

  beforeEach(async () => {
    leadConversionService = jasmine.createSpyObj<LeadConversionService>(
      'LeadConversionService',
      ['buildDefaultProjectName']
    );
    leadConversionService.buildDefaultProjectName.and.returnValue(
      'Avery Bloom Wedding'
    );

    await TestBed.configureTestingModule({
      imports: [LeadConvertModalComponent],
      providers: [
        { provide: LeadConversionService, useValue: leadConversionService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LeadConvertModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('hydrates the project name when opened with a lead', () => {
    component.lead = testLead;
    component.open = true;

    component.ngOnChanges({
      open: new SimpleChange(false, true, false),
    });
    fixture.detectChanges();

    expect(component.projectName()).toBe('Avery Bloom Wedding');
    expect(component.internalNotes()).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Convert Lead To Project');
    expect(fixture.nativeElement.textContent).toContain('Avery Bloom');
  });

  it('shows partner and planner contact summaries when lead data has them', () => {
    component.open = true;
    component.lead = {
      ...testLead,
      partner_first_name: 'Jordan',
      partner_last_name: 'Reed',
      planner_name: 'Casey Planner',
    };
    fixture.detectChanges();

    expect(component.hasPartnerContact).toBeTrue();
    expect(component.hasPlannerContact).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Partner contact');
    expect(fixture.nativeElement.textContent).toContain('Planner contact');
  });

  it('emits trimmed conversion payloads', () => {
    const emitted: unknown[] = [];
    component.confirm.subscribe((payload) => emitted.push(payload));
    component.projectName.set('  Avery Bloom Wedding ');
    component.internalNotes.set('  Handoff note ');

    component.onConfirm();

    expect(emitted).toEqual([
      {
        project_name: 'Avery Bloom Wedding',
        internal_notes: 'Handoff note',
      },
    ]);
  });

  it('clears form state on close and blocks close while saving', () => {
    const emitted: void[] = [];
    component.close.subscribe((value) => emitted.push(value));
    component.projectName.set('Project');
    component.internalNotes.set('Note');

    component.onClose();

    expect(component.projectName()).toBe('');
    expect(component.internalNotes()).toBe('');
    expect(emitted.length).toBe(1);

    component.projectName.set('Blocked');
    component.saving = true;
    component.onClose();

    expect(component.projectName()).toBe('Blocked');
    expect(emitted.length).toBe(1);
  });
});
