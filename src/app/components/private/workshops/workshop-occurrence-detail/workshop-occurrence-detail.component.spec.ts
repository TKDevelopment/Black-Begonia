import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';

import { workshopOccurrenceFixture } from '../../../../core/testing/workshop-testing';
import { WorkshopAdminFacadeService } from '../../../../core/supabase/repositories/workshop-admin-facade.service';
import { WorkshopOperationsRepositoryService } from '../../../../core/supabase/repositories/workshop-operations-repository.service';
import {
  WorkshopOccurrenceDetailComponent,
} from './workshop-occurrence-detail.component';

describe('WorkshopOccurrenceDetailComponent operational summary', () => {
  let fixture: ComponentFixture<WorkshopOccurrenceDetailComponent>;
  let component: WorkshopOccurrenceDetailComponent;
  let operations: jasmine.SpyObj<WorkshopOperationsRepositoryService>;

  beforeEach(async () => {
    const facade = jasmine.createSpyObj<WorkshopAdminFacadeService>(
      'WorkshopAdminFacadeService', ['loadOccurrenceDetail'],
    );
    facade.loadOccurrenceDetail.and.resolveTo({
      occurrence: workshopOccurrenceFixture(),
      roster: [
        {
          booking_reference: 'BBW-ONE',
          contact_name: 'Guest',
          active_quantity: 2,
          booking_status: 'confirmed',
          seat_number: 1,
          attendee_name: null,
          attendance_state: 'checked_in',
        },
        {
          booking_reference: 'BBW-ONE',
          contact_name: 'Guest',
          active_quantity: 2,
          booking_status: 'confirmed',
          seat_number: 2,
          attendee_name: null,
          attendance_state: 'expected',
        },
      ],
      waitlist: [],
    });
    operations = jasmine.createSpyObj<WorkshopOperationsRepositoryService>(
      'WorkshopOperationsRepositoryService',
      [
        'getOperationalState',
        'transitionOccurrence',
        'cancelOccurrence',
        'rescheduleOccurrenceSchedule',
        'completeAndArchiveOccurrence',
      ],
    );
    operations.getOperationalState.and.resolveTo({
      occurrenceId: 'occurrence-1',
      lifecycle: 'published_open',
      availability: 'available',
      capacity: 12,
      reservedQuantity: 2,
      remainingQuantity: 10,
      hasWaitingCustomers: false,
      completionReviewRequired: false,
    });
    operations.transitionOccurrence.and.resolveTo({
      replayed: false,
      occurrenceId: 'occurrence-1',
      lifecycle: 'registration_closed',
      availability: 'closed',
      capacity: 12,
      reservedQuantity: 2,
      remainingQuantity: 10,
      hasWaitingCustomers: false,
      completionReviewRequired: false,
    });
    operations.cancelOccurrence.and.resolveTo({
      replayed: false,
      occurrenceId: 'occurrence-1',
      lifecycle: 'cancelled',
      reasonCategory: 'other',
      invalidatedHolds: 2,
      checkoutExpirationsQueued: 1,
      affectedBookings: 1,
      customerNoticesQueued: 1,
      refundRequestsQueued: 1,
      raceReviews: 0,
      closedWaitlistEntries: 0,
    });
    operations.rescheduleOccurrenceSchedule.and.resolveTo({
      replayed: false,
      occurrenceId: 'occurrence-1',
      previousStartAt: '2026-08-15T17:00:00Z',
      previousEndAt: '2026-08-15T19:00:00Z',
      startAt: '2026-10-15T17:00:00Z',
      endAt: '2026-10-15T19:00:00Z',
      customerNoticesQueued: 1,
    });
    operations.completeAndArchiveOccurrence.and.resolveTo({
      replayed: false,
      occurrenceId: 'occurrence-1',
      lifecycle: 'archived',
      customerThankYousQueued: 1,
      recommendationCount: 3,
    });
    spyOn(window, 'confirm').and.returnValue(true);
    await TestBed.configureTestingModule({
      imports: [WorkshopOccurrenceDetailComponent],
      providers: [
        { provide: WorkshopAdminFacadeService, useValue: facade },
        { provide: WorkshopOperationsRepositoryService, useValue: operations },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'occurrence-1' } } },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WorkshopOccurrenceDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders one full-width CRM page shell while retaining the focused form', () => {
    const shells = fixture.nativeElement.querySelectorAll('[data-crm-page-shell]');
    expect(shells.length).toBe(1);
    expect(shells[0].classList).toContain('crm-page-frame');
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
  });

  it('consumes the shared CRM light and dark theme tokens', () => {
    const host = fixture.nativeElement as HTMLElement;
    host.style.setProperty('--crm-page-bg', '#0b0f14');
    host.style.setProperty('--crm-surface', '#12171d');
    host.style.setProperty('--crm-surface-elevated', '#1a2028');
    host.style.setProperty('--crm-text', '#edf2f7');
    host.style.setProperty('--crm-text-strong', '#f8fbff');
    host.style.setProperty('--crm-border', '#2a333e');
    fixture.detectChanges();

    const page = host.querySelector('.detail-page') as HTMLElement;
    const section = host.querySelector('section') as HTMLElement;
    const heading = host.querySelector('h1') as HTMLElement;
    const input = host.querySelector('input') as HTMLElement;

    expect(getComputedStyle(page).backgroundColor).toBe('rgb(11, 15, 20)');
    expect(getComputedStyle(section).backgroundColor).toBe('rgb(18, 23, 29)');
    expect(getComputedStyle(heading).color).toBe('rgb(248, 251, 255)');
    expect(getComputedStyle(input).backgroundColor).toBe('rgb(26, 32, 40)');
  });

  it('deduplicates booking quantities while presenting roster operations', () => {
    expect(component.bookingCount()).toBe(1);
    expect(component.activeSeatCount()).toBe(2);
    expect(component.checkedInCount()).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Open full roster');
    expect(fixture.nativeElement.querySelector('a[href^="/workshops/"]').getAttribute('href'))
      .toBe('/workshops/summer-garden-centerpiece/2026-08-15');
  });

  it('confirms and delegates lifecycle changes through the operations boundary', async () => {
    await component.transition('registration_closed');

    expect(window.confirm).toHaveBeenCalled();
    expect(operations.transitionOccurrence).toHaveBeenCalledWith(
      'occurrence-1', 'registration_closed', jasmine.any(String),
    );
    expect(component.actionMessage()).toContain('registration closed');
  });

  it('previews affected bookings and seats before cancellation', async () => {
    await component.cancelOccurrence('other');

    expect(window.confirm).toHaveBeenCalledWith(
      jasmine.stringMatching(/1 booking.*2 active seat/),
    );
    expect(operations.cancelOccurrence).toHaveBeenCalledWith(
      'occurrence-1', 'other', jasmine.any(String),
    );
  });

  it('reschedules the same occurrence and queues customer confirmation emails', async () => {
    component.rescheduleForm.setValue({
      date: '2026-10-15',
      localStartTime: '13:00',
      localEndTime: '15:00',
      registrationCloseDate: '2026-10-14',
    });

    await component.rescheduleOccurrence();

    expect(operations.rescheduleOccurrenceSchedule).toHaveBeenCalledWith(
      'occurrence-1', '2026-10-15T13:00', '2026-10-15T15:00', -240,
      jasmine.any(String), jasmine.any(String),
    );
    expect(component.actionMessage()).toContain('confirmation email');
  });

  it('presents a safe invalid-state message for unavailable completion review', async () => {
    operations.completeAndArchiveOccurrence.and.rejectWith(
      new Error('completion review is not yet available'),
    );

    await component.completeAndArchive();

    expect(component.actionError()).toBe(
      'This workshop is not ready for completion review.',
    );
  });

  it('surfaces the completion review required for a passed occurrence', () => {
    component.operationalState.set({
      occurrenceId: 'occurrence-1',
      lifecycle: 'registration_closed',
      availability: 'closed',
      completionReviewRequired: true,
      capacity: 12,
      reservedQuantity: 2,
      remainingQuantity: 10,
      hasWaitingCustomers: false,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'ready to complete and archive',
    );
    expect(fixture.nativeElement.textContent).toContain('Complete & Archive');
  });
});
