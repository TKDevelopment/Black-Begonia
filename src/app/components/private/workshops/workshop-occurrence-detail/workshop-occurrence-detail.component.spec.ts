import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';

import { workshopOccurrenceFixture } from '../../../../core/testing/workshop-testing';
import { WorkshopAdminFacadeService } from '../../../../core/supabase/repositories/workshop-admin-facade.service';
import { WorkshopCatalogRepositoryService } from '../../../../core/supabase/repositories/workshop-catalog-repository.service';
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
        'listRescheduleResponses',
        'transitionOccurrence',
        'cancelOccurrence',
        'beginReschedule',
        'expireRescheduleResponses',
        'resolveRescheduleNonresponse',
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
    operations.listRescheduleResponses.and.resolveTo([{
      workshop_reschedule_response_id: 'response-expired',
      workshop_booking_id: 'booking-1',
      source_occurrence_id: 'occurrence-1',
      replacement_occurrence_id: 'occurrence-2',
      replacement_hold_id: 'hold-1',
      protected_quantity: 2,
      response: 'expired',
      response_token_expires_at: '2026-08-10T12:00:00Z',
      responded_at: '2026-08-10T12:00:00Z',
      resolved_by: null,
      resolution_command_key: null,
      created_at: '2026-08-01T12:00:00Z',
    }]);
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
      refundReviews: 1,
      raceReviews: 0,
      closedWaitlistEntries: 0,
    });
    operations.beginReschedule.and.resolveTo({
      replayed: false,
      affectedBookings: 1,
      protectedQuantity: 2,
    });
    operations.expireRescheduleResponses.and.resolveTo({
      replayed: false,
      expiredResponses: 1,
    });
    operations.resolveRescheduleNonresponse.and.resolveTo({
      replayed: false,
      state: 'staff_resolved',
      responseId: 'response-expired',
    });
    const catalog = jasmine.createSpyObj<WorkshopCatalogRepositoryService>(
      'WorkshopCatalogRepositoryService', ['listOccurrences'],
    );
    catalog.listOccurrences.and.resolveTo([
      workshopOccurrenceFixture(),
      workshopOccurrenceFixture({
        workshop_occurrence_id: 'occurrence-2',
        slug: 'replacement-workshop',
        start_at: '2099-09-15T17:00:00.000Z',
      }),
    ]);
    spyOn(window, 'confirm').and.returnValue(true);
    await TestBed.configureTestingModule({
      imports: [WorkshopOccurrenceDetailComponent],
      providers: [
        { provide: WorkshopAdminFacadeService, useValue: facade },
        { provide: WorkshopOperationsRepositoryService, useValue: operations },
        { provide: WorkshopCatalogRepositoryService, useValue: catalog },
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
    expect(component.actionMessage()).toContain('lifecycle updated');
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

  it('tracks expired reschedule responses and resolves them only with confirmation', async () => {
    expect(component.followUpCount()).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Resolve as cancellation');

    await component.resolveNonresponse('response-expired');

    expect(operations.resolveRescheduleNonresponse).toHaveBeenCalledWith(
      'response-expired', jasmine.any(String),
    );
  });

  it('presents a safe invalid-state message for unavailable completion review', async () => {
    operations.transitionOccurrence.and.rejectWith(
      new Error('completion review is not yet available'),
    );

    await component.transition('completed');

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
      'requires completion review',
    );
    expect(fixture.nativeElement.textContent).toContain('Complete after review');
  });
});
