import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';

import { WorkshopOperationsRepositoryService } from '../../../../core/supabase/repositories/workshop-operations-repository.service';
import { WorkshopFinancialRepositoryService } from '../../../../core/supabase/repositories/workshop-financial-repository.service';
import { WorkshopRosterComponent } from './workshop-roster.component';

describe('WorkshopRosterComponent', () => {
  let fixture: ComponentFixture<WorkshopRosterComponent>;
  let component: WorkshopRosterComponent;
  let operations: jasmine.SpyObj<WorkshopOperationsRepositoryService>;
  let financials: jasmine.SpyObj<WorkshopFinancialRepositoryService>;

  beforeEach(async () => {
    operations = jasmine.createSpyObj<WorkshopOperationsRepositoryService>(
      'WorkshopOperationsRepositoryService',
      [
        'listMinimizedRoster', 'listBookings', 'listAttendeesForBookings', 'listWaitlist',
        'getOperationalState', 'createReservation', 'cancelSeats', 'checkIn',
        'offerWaitlistSeats',
      ],
    );
    financials = jasmine.createSpyObj<WorkshopFinancialRepositoryService>(
      'WorkshopFinancialRepositoryService',
      [
        'listPendingVenmoAttempts', 'recordVenmoReceipt', 'listRefundableCharges',
        'getRefundEligibility', 'requestStripeRefund', 'recordExternalRefund',
      ],
    );
    operations.listMinimizedRoster.and.resolveTo([{
      booking_reference: 'BBW-TEST',
      contact_name: 'Garden Guest',
      active_quantity: 2,
      booking_status: 'confirmed',
      seat_number: 1,
      attendee_name: null,
      attendance_state: 'expected',
    }]);
    operations.listBookings.and.resolveTo([{
      workshop_booking_id: 'booking-1',
      workshop_occurrence_id: 'occurrence-1',
      booking_reference: 'BBW-TEST',
      status_token_expires_at: '2026-10-01T00:00:00Z',
      contact_name: 'Garden Guest',
      contact_email: 'guest@example.test',
      contact_phone: '(555) 555-1212',
      purchased_quantity: 2,
      active_quantity: 2,
      status: 'confirmed',
      payment_state: 'paid',
      price_per_seat_minor_snapshot: 5000,
      subtotal_minor_snapshot: 10000,
      total_minor_snapshot: 10000,
      required_charges_minor_snapshot: 0,
      currency: 'USD',
      terms_snapshot: 'Terms',
      terms_version: 1,
      payment_method: 'stripe',
      confirmed_at: '2026-07-30T00:00:00Z',
      cancelled_at: null,
      checked_in_at: null,
      created_at: '2026-07-30T00:00:00Z',
      updated_at: '2026-07-30T00:00:00Z',
    }]);
    operations.listAttendeesForBookings.and.resolveTo([{
      workshop_attendee_id: 'attendee-1',
      workshop_booking_id: 'booking-1',
      seat_number: 1,
      display_name: null,
      accommodation_details: null,
      attendance_state: 'expected',
      checked_in_at: null,
      checked_in_by: null,
      created_at: '2026-07-30T00:00:00Z',
      updated_at: '2026-07-30T00:00:00Z',
    }]);
    operations.listWaitlist.and.resolveTo([]);
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
    operations.createReservation.and.resolveTo({
      replayed: false, bookingId: 'booking-2', activeQuantity: 1,
    });
    operations.offerWaitlistSeats.and.resolveTo({
      replayed: false, state: 'empty',
    });
    operations.cancelSeats.and.resolveTo({
      replayed: false, bookingId: 'booking-1', activeQuantity: 1,
    });
    operations.checkIn.and.resolveTo({
      replayed: false, bookingId: 'booking-1', attendeeId: 'attendee-1',
      attendanceState: 'checked_in',
    });
    financials.listPendingVenmoAttempts.and.resolveTo([]);
    financials.listRefundableCharges.and.resolveTo([{
      workshop_payment_transaction_id: 'transaction-1',
      workshop_booking_id: 'booking-1',
      workshop_occurrence_id: 'occurrence-1',
      workshop_payment_attempt_id: 'attempt-1',
      transaction_type: 'charge',
      provider: 'stripe',
      provider_transaction_id: 'pi_1',
      payment_reference: 'STRIPE-1',
      amount_minor: 10000,
      currency: 'USD',
      occurred_at: '2026-07-30T00:00:00Z',
      state: 'paid',
      actor_type: 'provider',
      note: null,
      created_at: '2026-07-30T00:00:00Z',
    }]);
    financials.getRefundEligibility.and.resolveTo({
      eligible: true,
      transactionId: 'transaction-1',
      currency: 'USD',
      remainingRefundableMinor: 10000,
      providerChargeId: 'pi_1',
      bookingId: 'booking-1',
      occurrenceId: 'occurrence-1',
      provider: 'stripe',
    });
    financials.requestStripeRefund.and.resolveTo({
      state: 'provider_accepted', requestId: 'refund-1', amountMinor: 5000,
      currency: 'USD',
    });
    financials.recordVenmoReceipt.and.resolveTo({
      replayed: false, state: 'confirmed', bookingId: 'booking-venmo',
    });
    await TestBed.configureTestingModule({
      imports: [WorkshopRosterComponent],
      providers: [
        { provide: WorkshopOperationsRepositoryService, useValue: operations },
        { provide: WorkshopFinancialRepositoryService, useValue: financials },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'occurrence-1' } } },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WorkshopRosterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('confirms a pending direct-Venmo receipt from the roster through the financial command', async () => {
    const pendingBooking = {
      ...component.bookings()[0],
      workshop_booking_id: 'booking-venmo',
      status: 'pending_payment' as const,
      payment_state: 'pending' as const,
      payment_method: 'direct_venmo' as const,
      confirmed_at: null,
    };
    component.bookings.set([pendingBooking]);
    component.venmoAttempts.set([{
      workshop_payment_attempt_id: 'attempt-venmo',
      workshop_booking_id: 'booking-venmo',
      provider: 'direct_venmo',
      reconciliation_reference: 'BBW-HIDDEN-REFERENCE',
      state: 'active',
      amount_minor: 10000,
      currency: 'USD',
      effective_expires_at: '2026-08-16T17:00:00Z',
      created_at: '2026-08-04T17:00:00Z',
    }]);
    fixture.detectChanges();

    const confirmButton = fixture.nativeElement.querySelector(
      '.venmo-confirm-button',
    ) as HTMLButtonElement;
    const actions = confirmButton.closest('.booking-actions') as HTMLElement;
    const actionLabels = Array.from(
      actions.querySelectorAll('button'),
      (button: unknown) => (button as HTMLButtonElement).textContent?.trim(),
    );
    expect(actionLabels).toEqual(['Cancel Seats', 'Confirm Venmo Payment']);
    expect(actions.classList).toContain('gap-2');
    expect(confirmButton.textContent).toContain('Confirm Venmo Payment');
    confirmButton.click();
    fixture.detectChanges();
    const modal = fixture.nativeElement.querySelector(
      '.venmo-confirmation-modal',
    ) as HTMLElement;
    const title = modal.querySelector('#confirm-venmo-title') as HTMLElement;
    const guidance = modal.querySelector('.venmo-confirmation-copy') as HTMLElement;
    expect(modal).not.toBeNull();
    expect(parseFloat(getComputedStyle(title).fontSize)).toBeGreaterThanOrEqual(36);
    expect(parseFloat(getComputedStyle(guidance).marginBottom)).toBeGreaterThanOrEqual(24);

    component.venmoProviderPaymentId = ' VENMO-TRANSACTION-123 ';
    component.venmoAmountDollars = 100;
    component.venmoOccurredAt = '2026-08-04T14:30';
    await component.confirmVenmoPayment();

    expect(financials.recordVenmoReceipt).toHaveBeenCalledWith(
      'BBW-HIDDEN-REFERENCE', 'VENMO-TRANSACTION-123', 10000,
      jasmine.any(String), jasmine.any(String),
    );
    expect(component.actionMessage()).toContain('confirmed');
    expect(component.venmoApprovalBooking()).toBeNull();
  });

  it('loads minimized counts and filters the roster', () => {
    expect(operations.listAttendeesForBookings).toHaveBeenCalledOnceWith(['booking-1']);
    expect(component.activeSeatCount()).toBe(2);
    expect(component.scheduledSeatCount()).toBe(12);
    expect(component.availableSeatCount()).toBe(10);
    expect(component.checkedInCount()).toBe(0);
    component.query.set('missing');
    expect(component.filteredRoster()).toEqual([]);
    component.query.set('garden');
    expect(component.filteredRoster().length).toBe(1);
    expect(component.filteredBookings().length).toBe(1);
  });

  it('shows a single status badge without payment-state subtext', () => {
    const statusCell = fixture.nativeElement.querySelector('.booking-status-cell') as HTMLElement;

    expect(statusCell.querySelector('.status-badge')?.textContent?.trim()).toBe('confirmed');
    expect(statusCell.querySelector('.payment-state')).toBeNull();
    expect(statusCell.textContent?.trim()).toBe('confirmed');
  });

  it('shows a green partially refunded status from the authoritative payment state', () => {
    component.bookings.set([{
      ...component.bookings()[0],
      active_quantity: 2,
      purchased_quantity: 4,
      payment_state: 'partially_refunded',
    }]);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector(
      '.booking-status-cell .status-badge',
    ) as HTMLElement;
    expect(badge.textContent?.trim()).toBe('partially refunded');
    expect(badge.dataset['state']).toBe('partially_refunded');
  });

  it('shows a red refunded status after all seats are released', () => {
    component.bookings.set([{
      ...component.bookings()[0],
      active_quantity: 0,
      purchased_quantity: 4,
      status: 'cancelled',
      payment_state: 'refunded',
    }]);
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('.roster-card tbody tr') as HTMLElement;
    const badge = row.querySelector('.booking-status-cell .status-badge') as HTMLElement;
    expect(row.textContent).toContain('0 of 4 active');
    expect(badge.textContent?.trim()).toBe('refunded');
    expect(badge.dataset['state']).toBe('refunded');
  });

  it('replaces Cancel Seats with Refund Order for a confirmed paid booking', () => {
    const actions = fixture.nativeElement.querySelector('.booking-actions') as HTMLElement;
    const labels = Array.from(actions.querySelectorAll('button'), (button: unknown) =>
      (button as HTMLButtonElement).textContent?.trim());

    expect(labels).toEqual(['Refund Order']);
  });

  it('submits an automatic Stripe seat refund and explains delayed seat release', async () => {
    await component.openRefundModal(component.bookings()[0]);
    fixture.detectChanges();

    const modal = fixture.nativeElement.querySelector('.refund-modal') as HTMLElement;
    expect(modal.textContent).toContain('Stripe processes this refund automatically');
    expect(modal.textContent).toContain('$50.00');
    expect(modal.textContent).toContain('1 of 2 active seats');

    component.refundConfirmation = true;
    operations.listBookings.and.resolveTo([{
      ...component.bookings()[0],
      active_quantity: 1,
      payment_state: 'partially_refunded',
    }]);
    await component.refundSelectedSeats();

    expect(financials.requestStripeRefund).toHaveBeenCalledWith(
      'transaction-1', 5000, 'customer_requested', jasmine.any(String), 1,
    );
    expect(operations.cancelSeats).not.toHaveBeenCalled();
    expect(component.actionMessage()).toContain('Stripe refund requested');
    expect(component.actionMessage()).toContain('verified');
    expect(component.bookings()[0].active_quantity).toBe(1);
    expect(component.bookings()[0].payment_state).toBe('partially_refunded');
  });

  it('records a manual Venmo refund only after the florist confirms it was sent', async () => {
    const booking = {
      ...component.bookings()[0],
      payment_method: 'direct_venmo' as const,
    };
    component.bookings.set([booking]);
    component.refundableCharges.set([{
      ...component.refundableCharges()[0],
      provider: 'direct_venmo' as const,
      provider_transaction_id: 'venmo-charge-1',
    }]);
    financials.getRefundEligibility.and.resolveTo({
      eligible: true,
      transactionId: 'transaction-1',
      currency: 'USD',
      remainingRefundableMinor: 10000,
      providerChargeId: 'venmo-charge-1',
      bookingId: 'booking-1',
      occurrenceId: 'occurrence-1',
      provider: 'direct_venmo',
    });

    await component.openRefundModal(booking);
    fixture.detectChanges();
    const modal = fixture.nativeElement.querySelector('.refund-modal') as HTMLElement;
    expect(modal.textContent).toContain('Send the refund in Venmo first');

    component.refundReference = ' VENMO-REFUND-123 ';
    component.refundOccurredAt = '2026-08-04T14:30';
    component.refundConfirmation = true;
    await component.refundSelectedSeats();

    expect(financials.recordExternalRefund).toHaveBeenCalledWith(
      'transaction-1', 5000, 'VENMO-REFUND-123', 'customer_requested',
      jasmine.any(String), jasmine.any(String), 1,
    );
    expect(component.actionMessage()).toContain('Venmo refund recorded');
  });

  it('excludes expired and cancelled bookings from active seats while retaining pending holds', () => {
    const confirmed = { ...component.bookings()[0], active_quantity: 4 };
    const pending = {
      ...confirmed,
      workshop_booking_id: 'booking-pending',
      status: 'pending_payment' as const,
      payment_state: 'pending' as const,
      active_quantity: 2,
    };
    const expired = {
      ...confirmed,
      workshop_booking_id: 'booking-expired',
      status: 'expired' as const,
      active_quantity: 1,
    };
    const cancelled = {
      ...confirmed,
      workshop_booking_id: 'booking-cancelled',
      status: 'cancelled' as const,
      active_quantity: 3,
    };

    component.bookings.set([confirmed, pending, expired, cancelled]);

    expect(component.activeSeatCount()).toBe(6);
  });

  it('shows scheduled and available seats between active seats and checked in', () => {
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('.metrics span'),
      (item: unknown) => (item as HTMLElement).textContent?.trim(),
    );
    const values = Array.from(
      fixture.nativeElement.querySelectorAll('.metrics strong'),
      (item: unknown) => (item as HTMLElement).textContent?.trim(),
    );

    expect(operations.getOperationalState).toHaveBeenCalledOnceWith('occurrence-1');
    expect(labels).toEqual([
      'Bookings', 'Active seats', 'Scheduled seats',
      'Available seats', 'Checked in', 'Waitlist',
    ]);
    expect(values).toEqual(['1', '2', '12', '10', '0', '0']);
  });

  it('shows booking contact details, seat counts, and status in the roster', () => {
    const roster = fixture.nativeElement.querySelector('.roster-card');
    const headings = Array.from(
      roster.querySelectorAll('th'),
      (heading: unknown) => (heading as HTMLElement).textContent?.trim(),
    );
    expect(roster.textContent).toContain('Garden Guest');
    expect(roster.textContent).toContain('guest@example.test');
    expect(roster.textContent).toContain('(555) 555-1212');
    expect(roster.textContent).toContain('2 of 2 active');
    expect(roster.textContent).toContain('confirmed');
    expect(roster.querySelector('.payment-state')).toBeNull();
    expect(roster.textContent).not.toContain('BBW-TEST');
    expect(headings).toEqual(['Customer', 'Email', 'Phone', 'Seats', 'Status', 'Actions']);
    expect(headings).not.toContain('Reference');
    expect(roster.textContent).not.toContain('Customer bookings');
  });

  it('formats a stored US phone number for display without changing its phone link', () => {
    component.bookings.set([{
      ...component.bookings()[0],
      contact_phone: '+14018714996',
    }]);
    fixture.detectChanges();

    const phone = fixture.nativeElement.querySelector(
      'a[href="tel:+14018714996"]',
    ) as HTMLAnchorElement;
    expect(phone.textContent?.trim()).toBe('(401) 871-4996');
  });

  it('inherits light and dark CRM colors across page, cards, and controls', () => {
    const shell = fixture.nativeElement.parentElement as HTMLElement;
    const page = fixture.nativeElement.querySelector('.roster-page') as HTMLElement;
    const card = fixture.nativeElement.querySelector('.content-card') as HTMLElement;
    const input = fixture.nativeElement.querySelector('.filter-field input') as HTMLInputElement;
    const addReservation = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((item: unknown) =>
      (item as HTMLButtonElement).textContent?.trim() === 'Add Reservation') as HTMLButtonElement;

    shell.classList.add('crm-shell');
    expect(getComputedStyle(page).backgroundColor).toBe('rgb(244, 237, 230)');
    expect(getComputedStyle(card).backgroundColor).toBe('rgb(255, 255, 255)');
    expect(getComputedStyle(addReservation).color).toBe('rgb(255, 255, 255)');

    shell.classList.add('crm-theme-dark');
    expect(getComputedStyle(page).backgroundColor).toBe('rgb(11, 15, 20)');
    expect(getComputedStyle(card).backgroundColor).toBe('rgb(18, 23, 29)');
    expect(getComputedStyle(input).backgroundColor).toBe('rgb(26, 32, 40)');
    expect(getComputedStyle(addReservation).color).toBe('rgb(36, 24, 21)');
  });

  it('places roster filters and export before Add Reservation and filters by booking status', () => {
    const toolbar = fixture.nativeElement.querySelector('.roster-toolbar') as HTMLElement;
    const toolbarText = toolbar.textContent ?? '';

    expect(toolbar.querySelector('select[aria-label="Filter roster by status"]')).not.toBeNull();
    expect(toolbarText.indexOf('Export printable roster')).toBeLessThan(toolbarText.indexOf('Add Reservation'));

    component.statusFilter.set('cancelled');
    expect(component.filteredBookings()).toEqual([]);
    component.statusFilter.set('confirmed');
    expect(component.filteredBookings().length).toBe(1);
  });

  it('keeps Add Reservation in a modal instead of the roster page', () => {
    expect(fixture.nativeElement.querySelector('.reservation-modal')).toBeNull();
    const button = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((item: unknown) => (item as HTMLButtonElement).textContent?.trim() === 'Add Reservation') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(component.reservationModalOpen()).toBeTrue();
    expect(fixture.nativeElement.querySelector('.reservation-modal')).not.toBeNull();
  });

  it('creates a manual reservation without exposing a usable raw status token', async () => {
    component.manualName = ' Guest ';
    component.manualEmail = ' GUEST@EXAMPLE.TEST ';
    component.manualReason = ' phone ';
    await component.createReservation();

    const reservation = operations.createReservation.calls.mostRecent().args[0];
    expect(reservation.statusTokenDigest).toMatch(/^placeholder-/);
    expect(JSON.stringify(reservation)).not.toContain('bookingToken');
    expect(component.actionMessage()).toContain('queued');
  });

  it('queues a bounded waitlist offer without a token argument', async () => {
    await component.offerNext();
    expect(operations.offerWaitlistSeats).toHaveBeenCalledWith(
      'occurrence-1', 1440, jasmine.any(String),
    );
    expect(component.actionMessage()).toContain('empty');
  });

  it('opens a bounded Cancel Seats modal and maps the confirmed quantity to the command', async () => {
    const booking = component.bookings()[0];
    expect(fixture.nativeElement.querySelector('.cancellation-modal')).toBeNull();

    component.openCancellationModal(booking);
    fixture.detectChanges();
    const modal = fixture.nativeElement.querySelector('.cancellation-modal') as HTMLElement;
    const input = modal.querySelector('input[type="number"]') as HTMLInputElement;
    const seatControl = modal.querySelector('.cancellation-seat-control') as HTMLElement;
    const close = modal.querySelector('.crm-destructive-close') as HTMLButtonElement;
    expect(modal).not.toBeNull();
    expect(input.max).toBe('2');
    expect(close).not.toBeNull();
    expect(close.querySelector('svg')).not.toBeNull();
    expect(getComputedStyle(close).borderRadius).not.toBe('50%');
    expect(seatControl.classList).toContain('content-card');
    expect(parseFloat(getComputedStyle(seatControl).marginBottom)).toBeGreaterThan(0);

    component.setCancellationQuantity(2);
    await component.cancelSelectedSeats();

    expect(operations.cancelSeats).toHaveBeenCalledWith(
      'booking-1', 2, 'CRM roster cancellation', jasmine.any(String),
    );
    expect(component.cancellationBooking()).toBeNull();
  });

  it('keeps the booking roster rows compact', () => {
    const firstCell = fixture.nativeElement.querySelector('tbody td') as HTMLElement;

    expect(parseFloat(getComputedStyle(firstCell).paddingTop)).toBeLessThan(12);
  });

  it('clamps cancellation quantities to the booking active-seat bounds', () => {
    const booking = component.bookings()[0];
    component.openCancellationModal(booking);

    component.setCancellationQuantity(0);
    expect(component.cancellationQuantity()).toBe(1);
    component.setCancellationQuantity(99);
    expect(component.cancellationQuantity()).toBe(2);
  });

  it('maps attendee check-in to the explicit roster command', async () => {
    await component.checkIn(component.attendees()[0]);

    expect(operations.checkIn).toHaveBeenCalledWith(
      'attendee-1', jasmine.any(String),
    );
  });

  it('presents waitlist entries as an ordered customer queue', () => {
    component.waitlist.set([{
      workshop_waitlist_entry_id: 'wait-1',
      workshop_occurrence_id: 'occurrence-1',
      contact_name: 'Waiting Guest',
      contact_email: 'waiting@example.test',
      requested_quantity: 2,
      state: 'waiting',
      created_at: '2026-07-30T00:00:00Z',
      updated_at: '2026-07-30T00:00:00Z',
    }]);
    fixture.detectChanges();

    const entry = fixture.nativeElement.querySelector('.waitlist-entry') as HTMLElement;
    expect(entry.textContent).toContain('1');
    expect(entry.textContent).toContain('Waiting Guest');
    expect(entry.textContent).toContain('waiting@example.test');
    expect(entry.textContent).toContain('2 seats requested');
    const waitlistCard = fixture.nativeElement.querySelector('.waitlist-card') as HTMLElement;
    expect(waitlistCard.textContent).not.toContain('Seat availability');
    expect(waitlistCard.textContent).not.toContain('Offer newly available seats');
    expect(waitlistCard.querySelector('.waitlist-title')?.textContent?.trim()).toBe('Waitlist');
  });

  it('exports a printable Word roster without references or secret fields', async () => {
    const createUrl = spyOn(URL, 'createObjectURL').and.returnValue('blob:roster');
    const revokeUrl = spyOn(URL, 'revokeObjectURL');
    const click = spyOn(HTMLAnchorElement.prototype, 'click');

    component.exportRoster();

    const blob = createUrl.calls.mostRecent().args[0] as Blob;
    const documentText = await blob.text();
    expect(blob.type).toBe('application/msword');
    expect(documentText).toContain('Workshop Roster');
    expect(documentText).toContain('Garden Guest');
    expect(documentText).toContain('guest@example.test');
    expect(documentText).toContain('(555) 555-1212');
    expect(documentText).not.toContain('BBW-TEST');
    expect(documentText).not.toContain('status_token');
    expect(click).toHaveBeenCalled();
    expect((click.calls.mostRecent().object as HTMLAnchorElement).download)
      .toBe('workshop-roster-occurrence-1.doc');
    expect(revokeUrl).toHaveBeenCalledWith('blob:roster');
  });

  it('uses reduced top padding for the roster header and content cards', () => {
    const header = fixture.nativeElement.querySelector('.page-header') as HTMLElement;
    const card = fixture.nativeElement.querySelector('.content-card') as HTMLElement;

    expect(parseFloat(getComputedStyle(header).paddingTop))
      .toBeLessThan(parseFloat(getComputedStyle(header).paddingBottom));
    expect(parseFloat(getComputedStyle(card).paddingTop))
      .toBeLessThan(parseFloat(getComputedStyle(card).paddingBottom));
  });
});
