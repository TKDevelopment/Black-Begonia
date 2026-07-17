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

  afterEach(() => {
    document.body.classList.remove('crm-shell', 'crm-theme-dark');
  });

  it('renders create mode when opened', () => {
    component.open = true;
    component.mode = 'create';
    fixture.detectChanges();

    expect(component.title).toBe('Create Lead');
    expect(component.confirmLabel).toBe('Create Lead');
    expect(fixture.nativeElement.textContent).toContain('Create Lead');
    expect(fixture.nativeElement.textContent).not.toContain('Record Focus');
    expect(fixture.nativeElement.textContent).not.toContain('Required For Save');
  });

  it('hydrates edit mode from the provided lead', () => {
    component.open = true;
    component.mode = 'edit';
    component.lead = {
      ...testLead,
      service_type: 'Full-Service Wedding',
      phone: '5550101000',
      planner_name: 'Casey Planner',
      planner_phone: '5550102000',
      guest_count: 120,
      source: 'venue partner',
      status: 'contacted',
      event_start_time: '15:30',
      consultation_scheduled_at: '2026-06-20T14:30:00.000Z',
    };
    component.internalUsers = [{ id: 'user-test-001', email: 'designer@example.test' }];
    component.allowedStatuses = ['contacted', 'consultation_scheduled'];

    component.ngOnChanges({
      open: new SimpleChange(false, true, false),
    });
    fixture.detectChanges();

    expect(component.title).toBe('Edit Lead');
    expect(component.eventType()).toBe('wedding');
    expect(component.serviceType()).toBe('Full-Service Wedding');
    expect(component.firstName()).toBe(testLead.first_name);
    expect(component.phone()).toBe('(555) 010-1000');
    expect(component.plannerName()).toBe('Casey Planner');
    expect(component.plannerPhone()).toBe('(555) 010-2000');
    expect(component.guestCount()).toBe('120');
    expect(component.source()).toBe('venue partner');
    expect(component.status()).toBe('contacted');
    expect(component.eventStartTime()).toBe('15:30');
    expect(component.consultationScheduledAt()).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Workflow');
    expect(fixture.nativeElement.textContent).not.toContain('Assigned User');
    expect(fixture.nativeElement.textContent).toContain('Venue Partner');
  });

  it('uses the CRM dark theme surfaces when dark mode is active', () => {
    document.body.classList.add('crm-shell', 'crm-theme-dark');
    component.open = true;
    component.mode = 'edit';
    component.lead = { ...testLead, service_type: 'full-service wedding' };
    component.ngOnChanges({ open: new SimpleChange(false, true, false) });
    fixture.detectChanges();

    const shell = fixture.nativeElement.querySelector('.lead-modal-shell') as HTMLElement;
    const card = fixture.nativeElement.querySelector('.lead-card') as HTMLElement;
    const input = fixture.nativeElement.querySelector('.lead-field input') as HTMLElement;

    expect(getComputedStyle(shell).backgroundColor).toBe('rgb(11, 15, 20)');
    expect(getComputedStyle(card).backgroundColor).toBe('rgb(18, 23, 29)');
    expect(getComputedStyle(input).backgroundColor).toBe('rgb(26, 32, 40)');
  });

  it('clears invalid service type when switching event type', () => {
    component.open = true;
    component.serviceType.set('Full-Service Wedding');

    component.onEventTypeChange('general');

    expect(component.eventType()).toBe('general');
    expect(component.serviceType()).toBe('');
  });

  it('renders lead source options from the Supabase enum values', () => {
    component.open = true;
    fixture.detectChanges();

    const sourceSelect = Array.from(
      fixture.nativeElement.querySelectorAll('select')
    ).find((select): select is HTMLSelectElement =>
      Array.from((select as HTMLSelectElement).options).some(
        (option) => option.value === 'venue partner'
      )
    );

    expect(sourceSelect).toBeTruthy();
    expect(
      Array.from(sourceSelect!.options).map((option) => option.value)
    ).toEqual([
      'instagram',
      'facebook',
      'google',
      'pinterest',
      'the knot',
      'wedding wire',
      'yelp',
      'venue partner',
      'bridal show',
      'other',
      'website',
    ]);
  });

  it('formats phone fields while typing', () => {
    component.onPhoneInput('5550101000');
    component.onPlannerPhoneInput('(555) 010-2000 ext 99');

    expect(component.phone()).toBe('(555) 010-1000');
    expect(component.plannerPhone()).toBe('(555) 010-2000');

    component.onPhoneInput('5550');

    expect(component.phone()).toBe('(555) 0');

    component.onPhoneInput('+1 (555) 010-1000');

    expect(component.phone()).toBe('(555) 010-1000');
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
    component.plannerPhone.set(' (555) 010-3000 ');
    component.plannerEmail.set(' CASEY@EXAMPLE.TEST ');
    component.email.set(' IRIS@EXAMPLE.TEST ');
    component.phone.set(' (555) 010-1000 ');
    component.preferredContactMethod.set(' email ');
    component.eventDate.set(' 2026-10-24 ');
    component.ceremonyVenueName.set(' Garden Hall ');
    component.ceremonyVenueCity.set(' Austin ');
    component.ceremonyVenueState.set(' TX ');
    component.ceremonyVenueAddress.set(' 100 Garden Way ');
    component.ceremonyVenueZipcode.set(' 78701 ');
    component.ceremonyStartTime.set('16:00');
    component.receptionVenueName.set(' Reception Hall ');
    component.receptionVenueCity.set(' Austin ');
    component.receptionVenueState.set(' TX ');
    component.receptionVenueAddress.set(' 200 Hall Road ');
    component.receptionVenueZipcode.set(' 78702 ');
    component.receptionStartTime.set('18:00');
    component.eventStartTime.set('15:30');
    component.budgetRange.set(' $5,000-$7,500 ');
    component.guestCount.set(120);
    component.inquiryMessage.set(' Floral design notes ');
    component.source.set('website');
    component.status.set('contacted');
    component.declineReason.set(' Not the right fit ');
    component.consultationScheduledAt.set('2026-06-20T10:30');

    component.onConfirm();

    expect(component.validationError()).toBeNull();
    expect(emitted).toEqual([
      jasmine.objectContaining({
        event_type: 'wedding',
        service_type: 'full-service wedding',
        first_name: 'Iris',
        last_name: 'Miller',
        partner_first_name: 'Rowan',
        partner_last_name: 'Lee',
        planner_name: 'Casey Planner',
        planner_phone: '5550103000',
        planner_email: 'casey@example.test',
        email: 'iris@example.test',
        phone: '5550101000',
        preferred_contact_method: 'email',
        event_date: '2026-10-24',
        ceremony_venue_name: 'Garden Hall',
        ceremony_venue_address: '100 Garden Way',
        ceremony_venue_zipcode: '78701',
        reception_venue_name: 'Reception Hall',
        reception_venue_address: '200 Hall Road',
        reception_venue_zipcode: '78702',
        event_start_time: '15:30',
        budget_range: '$5,000-$7,500',
        guest_count: 120,
        inquiry_message: 'Floral design notes',
        source: 'website',
        status: 'contacted',
        decline_reason: 'Not the right fit',
        consultation_scheduled_at: jasmine.any(String),
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
