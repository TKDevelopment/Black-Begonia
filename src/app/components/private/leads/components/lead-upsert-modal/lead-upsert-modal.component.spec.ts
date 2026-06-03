import { SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { testLead } from '../../../../../core/testing/workflow-fixtures';
import { LeadUpsertModalComponent } from './lead-upsert-modal.component';

describe('LeadUpsertModalComponent', () => {
  let component: LeadUpsertModalComponent;
  let fixture: ComponentFixture<LeadUpsertModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeadUpsertModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LeadUpsertModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders create mode when opened', () => {
    component.open = true;
    component.mode = 'create';
    fixture.detectChanges();

    expect(component.title).toBe('Create Lead');
    expect(component.confirmLabel).toBe('Create Lead');
    expect(fixture.nativeElement.textContent).toContain('Create Lead');
    expect(fixture.nativeElement.textContent).toContain('New Record');
  });

  it('hydrates edit mode from the provided lead', () => {
    component.open = true;
    component.mode = 'edit';
    component.lead = {
      ...testLead,
      service_type: 'Full-Service Wedding',
      planner_name: 'Casey Planner',
      guest_count: 120,
    };

    component.ngOnChanges({
      open: new SimpleChange(false, true, false),
    });
    fixture.detectChanges();

    expect(component.title).toBe('Edit Lead');
    expect(component.eventType()).toBe('wedding');
    expect(component.serviceType()).toBe('Full-Service Wedding');
    expect(component.firstName()).toBe(testLead.first_name);
    expect(component.plannerName()).toBe('Casey Planner');
    expect(component.guestCount()).toBe('120');
    expect(fixture.nativeElement.textContent).toContain('Wedding Planning');
  });

  it('clears invalid service type when switching event type', () => {
    component.open = true;
    component.serviceType.set('Full-Service Wedding');

    component.onEventTypeChange('general');

    expect(component.eventType()).toBe('general');
    expect(component.serviceType()).toBe('');
  });

  it('validates required fields before confirming', () => {
    const emitted: unknown[] = [];
    component.confirm.subscribe((payload) => emitted.push(payload));

    component.onConfirm();

    expect(component.validationError()).toBe(
      'First name, last name, email, and service type are required.'
    );
    expect(emitted).toEqual([]);
  });

  it('validates service type against the selected event type', () => {
    component.firstName.set('Iris');
    component.lastName.set('Miller');
    component.email.set('iris@example.test');
    component.serviceType.set('Full-Service Wedding');
    component.eventType.set('general');

    component.onConfirm();

    expect(component.validationError()).toBe(
      'Please choose a valid service type for the selected event type.'
    );
  });

  it('validates guest count as a number', () => {
    component.eventType.set('wedding');
    component.serviceType.set('Full-Service Wedding');
    component.firstName.set('Iris');
    component.lastName.set('Miller');
    component.email.set('iris@example.test');
    component.guestCount.set('not-a-number');

    component.onConfirm();

    expect(component.validationError()).toBe('Guest count must be a valid number.');
  });

  it('emits a normalized wedding lead payload', () => {
    const emitted: unknown[] = [];
    component.confirm.subscribe((payload) => emitted.push(payload));
    component.eventType.set('wedding');
    component.serviceType.set('Full-Service Wedding');
    component.firstName.set(' Iris ');
    component.lastName.set(' Miller ');
    component.partnerFirstName.set(' Rowan ');
    component.partnerLastName.set(' Lee ');
    component.plannerName.set(' Casey Planner ');
    component.plannerEmail.set(' CASEY@EXAMPLE.TEST ');
    component.email.set(' IRIS@EXAMPLE.TEST ');
    component.phone.set(' 555-010-1000 ');
    component.preferredContactMethod.set(' email ');
    component.eventDate.set(' 2026-10-24 ');
    component.ceremonyVenueName.set(' Garden Hall ');
    component.ceremonyVenueCity.set(' Austin ');
    component.ceremonyVenueState.set(' TX ');
    component.ceremonyStartTime.set('16:00');
    component.receptionVenueName.set(' Reception Hall ');
    component.receptionVenueCity.set(' Austin ');
    component.receptionVenueState.set(' TX ');
    component.receptionStartTime.set('18:00');
    component.budgetRange.set(' $5,000-$7,500 ');
    component.guestCount.set('120');
    component.inquiryMessage.set(' Floral design notes ');
    component.source.set('');

    component.onConfirm();

    expect(component.validationError()).toBeNull();
    expect(emitted).toEqual([
      jasmine.objectContaining({
        event_type: 'wedding',
        service_type: 'Full-Service Wedding',
        first_name: 'Iris',
        last_name: 'Miller',
        partner_first_name: 'Rowan',
        partner_last_name: 'Lee',
        planner_name: 'Casey Planner',
        planner_email: 'casey@example.test',
        email: 'iris@example.test',
        phone: '555-010-1000',
        preferred_contact_method: 'email',
        event_date: '2026-10-24',
        ceremony_venue_name: 'Garden Hall',
        reception_venue_name: 'Reception Hall',
        budget_range: '$5,000-$7,500',
        guest_count: 120,
        inquiry_message: 'Floral design notes',
        source: 'other',
      }),
    ]);
  });

  it('resets validation on close and blocks close while saving', () => {
    const emitted: void[] = [];
    component.close.subscribe((value) => emitted.push(value));
    component.validationError.set('Required');

    component.onClose();

    expect(component.validationError()).toBeNull();
    expect(emitted.length).toBe(1);

    component.validationError.set('Still there');
    component.saving = true;
    component.onClose();

    expect(component.validationError()).toBe('Still there');
    expect(emitted.length).toBe(1);
  });
});
