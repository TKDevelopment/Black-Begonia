import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { WorkshopBookingService } from '../../../core/supabase/services/workshop-booking.service';
import { WorkshopBookingStatusComponent } from './workshop-booking-status.component';

describe('WorkshopBookingStatusComponent', () => {
  let fixture: ComponentFixture<WorkshopBookingStatusComponent>;
  let component: WorkshopBookingStatusComponent;
  let bookingService: jasmine.SpyObj<WorkshopBookingService>;

  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();
    bookingService = jasmine.createSpyObj(
      'WorkshopBookingService',
      [
        'getStatus',
        'getStatusByCheckoutSession',
        'clearPendingAnalyticsOutcome',
        'performCustomerAction',
      ],
    );
    await TestBed.configureTestingModule({
      imports: [WorkshopBookingStatusComponent],
      providers: [
        provideRouter([]),
        { provide: WorkshopBookingService, useValue: bookingService },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('does not offer a return-to-workshop action on the confirmation screen', async () => {
    bookingService.getStatus.and.resolveTo(confirmedStatus());
    createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Return to the workshop');
    expect(fixture.nativeElement.querySelector('.confirmed-status > button')).toBeNull();
  });

  it('shows the confirmed event, seats, accepted terms reminder, and florist contact', async () => {
    bookingService.getStatus.and.resolveTo(confirmedStatus());
    createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Garden Workshop');
    expect(text).toContain('Saturday, August 15, 2026');
    expect(text).toContain('1:00 PM');
    expect(text).toContain('3:00 PM');
    expect(text).toContain('Black Begonia Studio');
    expect(text).toContain('4 seats');
    expect(text).toContain('so excited');
    expect(text).toContain('!');
    expect(text).toContain('Refunds & cancellations');
    expect(text).toContain('Seats are non-refundable within 7 days.');
    expect(text).toContain('Becca is here to help');
    expect(text).toContain('email address or phone number below');
    expect(fixture.nativeElement.querySelector('a[href="mailto:becca@blackbegoniaflorals.com"]'))
      .not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="tel:+14018714996"]'))
      .not.toBeNull();
    const factLabels = Array.from(
      fixture.nativeElement.querySelectorAll('.event-facts dt'),
      (label: Element) => label.textContent?.trim(),
    );
    expect(factLabels).toEqual(['Workshop', 'Location', 'Date', 'Time', 'Seats booked']);
    expect(fixture.nativeElement.querySelectorAll('.event-fact--primary')).toHaveSize(2);
    expect(fixture.nativeElement.querySelectorAll('.event-fact--secondary')).toHaveSize(3);
    const eventFacts = fixture.nativeElement.querySelector('.event-facts') as HTMLElement;
    expect(getComputedStyle(eventFacts).gridTemplateColumns.split(' ')).toHaveSize(6);
    const location = fixture.nativeElement.querySelector('.event-location') as HTMLElement;
    const address = fixture.nativeElement.querySelector('.event-location__address') as HTMLElement;
    expect(location.querySelector('br')).toBeNull();
    expect(address.textContent?.replace(/\s+/g, ' ').trim())
      .toBe('100 Flower Lane, Richmond, VA 23220');
    expect(getComputedStyle(address).whiteSpace).toBe('nowrap');
    expect(getComputedStyle(fixture.nativeElement.querySelector('.confirmed-status')).display)
      .toBe('grid');
  });

  it('gives pending Venmo customers a reference-free 24-hour contact path and workshop button', async () => {
    bookingService.getStatus.and.resolveTo({
      state: 'pending_venmo',
      supportReference: 'BBW-PRIVATE-REFERENCE',
      expiresAt: '2026-08-16T17:00:00.000Z',
    });
    createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Waiting for Venmo confirmation');
    expect(text).toContain('within 24 hours');
    expect(text).not.toContain('Support reference');
    expect(text).not.toContain('BBW-PRIVATE-REFERENCE');
    expect(fixture.nativeElement.querySelector(
      'a[href="mailto:becca@blackbegoniaflorals.com"]',
    )).not.toBeNull();
    expect(fixture.nativeElement.querySelector(
      'a[href="sms:+14018714996"]',
    )).not.toBeNull();
    const pendingLinks = Array.from(
      fixture.nativeElement.querySelectorAll('.pending-contact-links a'),
    ) as HTMLElement[];
    expect(pendingLinks).toHaveSize(2);
    expect(pendingLinks.every((link) => getComputedStyle(link).fontWeight === '500'))
      .toBeTrue();
    expect(pendingLinks.every((link) => getComputedStyle(link).fontFamily.includes('Arial')))
      .toBeTrue();

    const browse = fixture.nativeElement.querySelector('.browse-button') as HTMLAnchorElement;
    expect(browse.getAttribute('href')).toBe('/workshops');
    expect(getComputedStyle(browse).backgroundColor).toBe('rgb(196, 111, 103)');
  });

  it('consumes an emailed access token from the URL fragment and removes it immediately', async () => {
    const token = 'emailed-access-token-abcdefghijklmnopqrstuvwxyz0123456789';
    window.history.replaceState({}, '', `${window.location.pathname}#access=${token}`);
    bookingService.getStatus.and.resolveTo(confirmedStatus());

    createComponent();
    expect(window.location.hash).toBe('');
    await fixture.whenStable();

    expect(bookingService.getStatus).toHaveBeenCalledWith(token);
  });

  it('offers only the access-code fallback for unavailable access', async () => {
    bookingService.getStatus.and.rejectWith(new Error('unavailable'));
    createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.showRecovery()).toBeTrue();
    expect(component.showRescheduleResponse()).toBeFalse();
    expect(fixture.nativeElement.textContent).not.toContain('confirmed');
    expect(fixture.nativeElement.textContent).not.toContain('Lost or expired access?');
    expect(fixture.nativeElement.textContent).not.toContain('Request a new secure link');
    const headings = Array.from(
      fixture.nativeElement.querySelectorAll('form h2'),
      (heading: Element) => heading.textContent?.trim(),
    );
    expect(headings).toEqual(['Already have an access code?']);
    expect(fixture.nativeElement.querySelector('.browse-button')).toBeNull();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('uses the approved workshop photograph behind the secure status card', async () => {
    bookingService.getStatus.and.resolveTo({ state: 'pending_venmo', supportReference: 'hidden', expiresAt: '2026-08-16T17:00:00Z' });
    createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getComputedStyle(fixture.nativeElement.querySelector('.status-page')).backgroundImage)
      .toContain('FizzFritesLadyFingerLounge_Apr3_KCP208.jpg');
  });

  it('presents replacement facts and accepts only with the response code', async () => {
    bookingService.getStatus.and.resolveTo({
      state: 'action_required',
      action: 'reschedule',
      responseState: 'pending',
      responseDeadline: '2026-09-01T12:00:00Z',
      sourceTitle: 'Original Workshop',
      sourceStartAt: '2026-08-15T17:00:00Z',
      replacementTitle: 'Replacement Workshop',
      replacementStartAt: '2026-09-15T17:00:00Z',
      replacementVenue: 'New Studio',
      protectedQuantity: 2,
    });
    bookingService.performCustomerAction.and.resolveTo({
      state: 'accepted',
      replayed: false,
      responseId: 'response-1',
    });
    createComponent();
    await fixture.whenStable();
    fixture.detectChanges();
    component.rescheduleResponseForm.setValue({
      responseCode: 'raw-response-code-abcdefghijklmnopqrstuvwxyz0123456789',
    });

    await component.respondToReschedule('accept');

    expect(bookingService.performCustomerAction).toHaveBeenCalledWith(
      'respond_to_reschedule',
      { response: 'accept' },
      'raw-response-code-abcdefghijklmnopqrstuvwxyz0123456789',
    );
    expect(component.rescheduleMessage()).toContain('transferred');
    expect(fixture.nativeElement.textContent).toContain('Replacement Workshop');
  });

  it('presents decline and expired outcomes without implying automatic money movement', async () => {
    bookingService.getStatus.and.resolveTo({
      state: 'action_required',
      action: 'reschedule',
      responseState: 'pending',
    });
    bookingService.performCustomerAction.and.resolveTo({ state: 'declined' });
    createComponent();
    await fixture.whenStable();
    component.rescheduleResponseForm.setValue({
      responseCode: 'raw-response-code-abcdefghijklmnopqrstuvwxyz0123456789',
    });

    await component.respondToReschedule('decline');

    expect(component.status()?.state).toBe('cancelled');
    expect(component.rescheduleMessage()).toContain('refund due');
    expect(component.rescheduleMessage()).not.toContain('refunded');

    bookingService.performCustomerAction.and.resolveTo({ state: 'expired' });
    component.status.set({ state: 'action_required', action: 'reschedule' });
    component.rescheduleResponseForm.setValue({
      responseCode: 'second-response-code-abcdefghijklmnopqrstuvwxyz0123456789',
    });
    await component.respondToReschedule('accept');
    expect(component.rescheduleError()).toContain('expired');
  });

  it('handles replay and unavailable response outcomes safely', async () => {
    bookingService.getStatus.and.resolveTo({ state: 'unavailable' });
    bookingService.performCustomerAction.and.resolveTo({
      state: 'accepted',
      replayed: true,
    });
    createComponent();
    await fixture.whenStable();
    component.rescheduleResponseForm.setValue({
      responseCode: 'replayed-response-code-abcdefghijklmnopqrstuvwxyz0123456789',
    });

    await component.respondToReschedule('accept');
    expect(component.rescheduleMessage()).toContain('already recorded');

    bookingService.performCustomerAction.and.resolveTo({ state: 'unavailable' });
    component.rescheduleResponseForm.setValue({
      responseCode: 'unavailable-response-code-abcdefghijklmnopqrstuvwxyz01234567',
    });
    await component.respondToReschedule('accept');
    expect(component.rescheduleError()).toContain('unavailable');
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(WorkshopBookingStatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function confirmedStatus() {
    return {
      state: 'confirmed' as const,
      publicWorkshopPath: '/workshops/garden-workshop/2026-08-15',
      workshopTitle: 'Garden Workshop',
      startAt: '2026-08-15T17:00:00.000Z',
      endAt: '2026-08-15T19:00:00.000Z',
      timezone: 'America/New_York',
      venueName: 'Black Begonia Studio',
      addressLine1: '100 Flower Lane',
      addressLine2: null,
      locality: 'Richmond',
      region: 'VA',
      postalCode: '23220',
      activeQuantity: 4,
      termsSnapshot: 'Seats are non-refundable within 7 days.',
    };
  }
});
