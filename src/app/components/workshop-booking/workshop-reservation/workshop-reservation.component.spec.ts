import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { WorkshopPublicRepositoryService } from '../../../core/supabase/repositories/workshop-public-repository.service';
import { WorkshopBookingService } from '../../../core/supabase/services/workshop-booking.service';
import { WebsiteAnalyticsService } from '../../../core/analytics/website-analytics.service';
import { publicWorkshopOccurrenceFixture } from '../../../core/testing/workshop-testing';
import { WorkshopReservationComponent } from './workshop-reservation.component';

describe('WorkshopReservationComponent', () => {
  let fixture: ComponentFixture<WorkshopReservationComponent>;
  let component: WorkshopReservationComponent;
  let publicRepository: jasmine.SpyObj<WorkshopPublicRepositoryService>;
  let bookingService: jasmine.SpyObj<WorkshopBookingService>;
  let analytics: jasmine.SpyObj<WebsiteAnalyticsService>;

  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();
    publicRepository = jasmine.createSpyObj(
      'WorkshopPublicRepositoryService',
      ['getByRoute'],
    );
    bookingService = jasmine.createSpyObj(
      'WorkshopBookingService',
      ['startReservation'],
    );
    analytics = jasmine.createSpyObj('WebsiteAnalyticsService', [
      'trackWorkshopReservationStart',
      'trackWorkshopCheckoutStart',
    ]);
    publicRepository.getByRoute.and.resolveTo(publicWorkshopOccurrenceFixture({
      slug: 'garden-workshop',
      stripeEnabled: true,
      venmoEnabled: true,
      perBookingLimit: 4,
      termsVersion: 3,
      remainingSeats: 2,
    }));
    await TestBed.configureTestingModule({
      imports: [WorkshopReservationComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(new Map([
            ['seriesSlug', 'summer-garden-centerpiece'],
            ['workshopDate', '2026-08-15'],
          ])) },
        },
        { provide: WorkshopPublicRepositoryService, useValue: publicRepository },
        { provide: WorkshopBookingService, useValue: bookingService },
        { provide: WebsiteAnalyticsService, useValue: analytics },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WorkshopReservationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('validates quantity, contact, and accepted terms before booking', async () => {
    const termsLink = fixture.nativeElement.querySelector('.terms a') as HTMLAnchorElement;
    expect(termsLink.getAttribute('href')).toBe(
      '/workshops/summer-garden-centerpiece/2026-08-15/terms-and-conditions',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Workshop seats are subject');

    component.form.setValue({
      quantity: 5,
      firstName: '',
      lastName: '',
      contactEmail: 'not-an-email',
      contactPhone: '',
      paymentMethod: 'stripe',
      acceptedTerms: false,
    });

    await component.submit();

    expect(component.form.invalid).toBeTrue();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.terms .validation-tooltip')?.textContent)
      .toContain('Accept the Workshop Terms & Conditions');
    expect(bookingService.startReservation).not.toHaveBeenCalled();
  });

  it('presents name and contact controls in paired rows', () => {
    const nameRow = fixture.nativeElement.querySelector('.name-row');
    const contactRow = fixture.nativeElement.querySelector('.contact-row');

    expect(nameRow.querySelector('[formControlName="firstName"]')).not.toBeNull();
    expect(nameRow.querySelector('[formControlName="lastName"]')).not.toBeNull();
    expect(contactRow.querySelector('[formControlName="contactEmail"]')).not.toBeNull();
    expect(contactRow.querySelector('[formControlName="contactPhone"]')).not.toBeNull();
    expect(contactRow.textContent).not.toContain('(optional)');
  });

  it('shows the bounded remaining-seat prompt on the reservation summary', () => {
    expect(fixture.nativeElement.querySelector('.reservation-summary .seat-urgency').textContent)
      .toContain('Only 2 seats remaining');
  });

  it('uses the approved workshop photograph behind the reservation card', () => {
    expect(getComputedStyle(fixture.nativeElement.querySelector('.reservation-page')).backgroundImage)
      .toContain('FizzFritesLadyFingerLounge_Apr3_KCP208.jpg');
  });

  it('shows a live order total for the selected number of seats', () => {
    component.form.controls.quantity.setValue(3);
    fixture.detectChanges();

    const total = fixture.nativeElement.querySelector('.summary-total') as HTMLElement;
    const label = total.querySelector('.summary-total-label') as HTMLElement;
    const amount = total.querySelector('.summary-total-amount') as HTMLElement;
    expect(label.textContent?.trim()).toBe('Total:');
    expect(amount.textContent?.trim()).toBe('$255.00');
    expect(total.textContent).not.toContain('seats selected');
    expect(getComputedStyle(total).display).toBe('flex');
    expect(getComputedStyle(label).fontSize).toBe(getComputedStyle(amount).fontSize);
    expect(Number.parseInt(getComputedStyle(label).fontWeight, 10)).toBeGreaterThanOrEqual(600);

    component.form.controls.quantity.setValue(1);
    fixture.detectChanges();
    expect(total.textContent).not.toContain('seat selected');
    expect(amount.textContent?.trim()).toBe('$85.00');
  });

  it('hands an exact valid reservation to Stripe without storing the booking token', async () => {
    bookingService.startReservation.and.resolveTo({
      held: {
        state: 'held',
        bookingToken: 'raw-booking-token',
        supportReference: 'BBW-2026-TEST',
        quantity: 2,
        priceMinor: 8500,
        totalMinor: 17000,
        currency: 'USD',
        effectiveExpiresAt: '2026-10-01T16:30:00Z',
        methods: ['stripe', 'direct_venmo'],
      },
      handoff: {
        state: 'redirect',
        method: 'stripe',
        url: 'https://checkout.stripe.com/c/pay/cs_test',
        effectiveExpiresAt: '2026-10-01T16:30:00Z',
      },
    });
    const redirect = spyOn(component, 'redirectToStripe');
    component.form.setValue({
      quantity: 2,
      firstName: 'Customer',
      lastName: 'Name',
      contactEmail: 'customer@example.test',
      contactPhone: '',
      paymentMethod: 'stripe',
      acceptedTerms: true,
    });

    await component.submit();

    expect(bookingService.startReservation).toHaveBeenCalledWith({
      occurrenceSlug: 'garden-workshop',
      quantity: 2,
      contactName: 'Customer Name',
      contactEmail: 'customer@example.test',
      contactPhone: undefined,
      acceptedTermsVersion: 3,
      paymentMethod: 'stripe',
    });
    expect(redirect).toHaveBeenCalledWith(
      'https://checkout.stripe.com/c/pay/cs_test',
    );
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(location.href).not.toContain('raw-booking-token');
    expect(analytics.trackWorkshopReservationStart)
      .toHaveBeenCalledOnceWith('garden-workshop', 2);
    expect(analytics.trackWorkshopCheckoutStart)
      .toHaveBeenCalledOnceWith('stripe', 2);
    expect(publicRepository.getByRoute)
      .toHaveBeenCalledWith('summer-garden-centerpiece', '2026-08-15');
  });

  it('renders direct Venmo instructions and a clean status route', async () => {
    bookingService.startReservation.and.resolveTo({
      held: {
        state: 'held',
        bookingToken: 'raw-booking-token',
        supportReference: 'BBW-2026-TEST',
        quantity: 1,
        priceMinor: 8500,
        totalMinor: 8500,
        currency: 'USD',
        effectiveExpiresAt: '2026-10-02T16:00:00Z',
        methods: ['direct_venmo'],
      },
      handoff: {
        state: 'pending_manual_payment',
        method: 'direct_venmo',
        approvedTarget: 'https://venmo.com/u/approved-business',
        amountMinor: 8500,
        currency: 'USD',
        reference: 'BBW-2026-TEST-A1B2C3',
        effectiveExpiresAt: '2026-10-02T16:00:00Z',
      },
    });
    component.form.setValue({
      quantity: 1,
      firstName: 'Customer',
      lastName: 'Name',
      contactEmail: 'customer@example.test',
      contactPhone: '',
      paymentMethod: 'direct_venmo',
      acceptedTerms: true,
    });

    await component.submit();
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      '.venmo-handoff a[href^="https://venmo.com/"]',
    ) as HTMLAnchorElement;
    expect(link.href).toBe('https://venmo.com/u/approved-business');
    expect(link.target).toBe('_blank');
    expect(fixture.nativeElement.textContent).not.toContain('BBW-2026-TEST-A1B2C3');
    expect(fixture.nativeElement.textContent).toContain(
      'Include the name and email address used for this reservation in your Venmo note',
    );
    expect(fixture.nativeElement.textContent).toContain("Open the florist's Venmo");
    expect(fixture.nativeElement.innerHTML).not.toContain('raw-booking-token');
    const statusButton = fixture.nativeElement.querySelector(
      '.venmo-handoff .status-link',
    ) as HTMLButtonElement;
    expect(statusButton.textContent?.trim()).toBe('I sent the Venmo payment');
    const redirect = spyOn(component, 'redirectToStatus');
    statusButton.click();
    expect(redirect).toHaveBeenCalledOnceWith('raw-booking-token');
  });

  it('uses plain loading copy without encoding artifacts', async () => {
    bookingService.startReservation.and.returnValue(new Promise(() => undefined));
    component.form.setValue({
      quantity: 1,
      firstName: 'Customer',
      lastName: 'Name',
      contactEmail: 'customer@example.test',
      contactPhone: '',
      paymentMethod: 'stripe',
      acceptedTerms: true,
    });

    void component.submit();
    fixture.detectChanges();

    const submit = fixture.nativeElement.querySelector('.booking-form button[type="submit"]');
    expect(submit.textContent.trim()).toBe('Reserving seats...');
    expect(submit.textContent).not.toContain('Ã');
  });
});
