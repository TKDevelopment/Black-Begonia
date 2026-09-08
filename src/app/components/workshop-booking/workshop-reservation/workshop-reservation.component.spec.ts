import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Validators } from '@angular/forms';
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
      venmoEnabled: false,
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
      acceptedTerms: false,
    });

    await component.submit();

    expect(component.form.invalid).toBeTrue();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.terms .validation-tooltip')?.textContent)
      .toContain('Accept the Workshop Terms & Conditions');
    expect(fixture.nativeElement.querySelector(
      '[formControlName="contactPhone"] + .validation-tooltip',
    )?.textContent).toContain('Phone number is required');
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
    expect(component.form.controls.contactPhone.hasValidator(Validators.required)).toBeTrue();
    expect(component.form.contains('paymentMethod')).toBeFalse();
    expect(fixture.nativeElement.querySelector('.payment-options')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Payment option');
    expect(fixture.nativeElement.textContent).not.toContain('Venmo');
  });

  it('shows the bounded remaining-seat prompt on the reservation summary', () => {
    expect(fixture.nativeElement.querySelector('.reservation-summary .seat-urgency').textContent)
      .toContain('Only 2 seats remaining');
  });

  it('uses the approved workshop photograph behind the reservation card', () => {
    expect(getComputedStyle(fixture.nativeElement.querySelector('.reservation-page')).backgroundImage)
      .toContain('FizzFritesLadyFingerLounge_Apr3_KCP208.jpg');
  });

  it('shows a live subtotal, tax, and order total for the selected number of seats', () => {
    component.form.controls.quantity.setValue(3);
    fixture.detectChanges();

    const total = fixture.nativeElement.querySelector('.summary-total') as HTMLElement;
    const label = total.querySelector('.summary-total-label') as HTMLElement;
    const amount = total.querySelector('.summary-total-amount') as HTMLElement;
    expect(total.textContent).toContain('Subtotal');
    expect(total.textContent).toContain('$255.00');
    expect(total.textContent).toContain('Tax (RI 7%)');
    expect(total.textContent).toContain('$17.85');
    expect(label.textContent?.trim()).toBe('Total');
    expect(amount.textContent?.trim()).toBe('$272.85');
    expect(total.textContent).not.toContain('seats selected');
    expect(getComputedStyle(total).display).toBe('grid');
    expect(getComputedStyle(label).fontSize).toBe(getComputedStyle(amount).fontSize);
    expect(Number.parseInt(getComputedStyle(label).fontWeight, 10)).toBeGreaterThanOrEqual(600);

    component.form.controls.quantity.setValue(1);
    fixture.detectChanges();
    expect(total.textContent).not.toContain('seat selected');
    expect(amount.textContent?.trim()).toBe('$90.95');
  });

  it('uses the refined summary hierarchy and right-aligned checkout action', () => {
    const summary = fixture.nativeElement.querySelector('.reservation-summary') as HTMLElement;
    const facts = Array.from(
      summary.querySelectorAll<HTMLElement>('.summary-fact'),
    );
    const taxAmount = summary.querySelector(
      '.summary-total-breakdown > div:nth-child(2) dd',
    ) as HTMLElement;
    const totalAmount = summary.querySelector('.summary-total-amount') as HTMLElement;
    const title = summary.querySelector('h1') as HTMLElement;
    const form = fixture.nativeElement.querySelector('.booking-form') as HTMLFormElement;
    const checkout = form.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(facts[0].querySelector('dt')?.textContent?.trim()).toBe('When');
    expect(facts[1].querySelector('dt')?.textContent?.trim()).toBe('Where');
    expect(facts[0].offsetTop).toBe(facts[1].offsetTop);
    expect(facts[1].offsetLeft).toBeGreaterThan(facts[0].offsetLeft);
    expect(totalAmount.closest('.summary-total-final')).not.toBeNull();
    expect(totalAmount.getBoundingClientRect().top)
      .toBeGreaterThan(taxAmount.getBoundingClientRect().top);
    expect(Math.abs(
      totalAmount.getBoundingClientRect().right - taxAmount.getBoundingClientRect().right,
    )).toBeLessThanOrEqual(1);
    expect(Number.parseFloat(getComputedStyle(title).fontSize)).toBeLessThan(40);
    expect(checkout.textContent?.trim()).toBe('Continue to Secure Checkout');
    expect(getComputedStyle(checkout).justifySelf).toBe('end');
    expect(Math.abs(
      checkout.getBoundingClientRect().right
        - (form.getBoundingClientRect().right - Number.parseFloat(getComputedStyle(form).paddingRight)),
    )).toBeLessThanOrEqual(1);
    expect(getComputedStyle(checkout).fontFamily).toContain('Raleway');
    expect(getComputedStyle(checkout).textTransform).toBe('none');
    expect(facts[3].classList).toContain('booking-limit');
  });

  it('defines the phone and larger-screen reservation refinements', () => {
    const componentCss = Array.from(document.querySelectorAll('style'))
      .map((style) => style.textContent ?? '')
      .filter((css) => css.includes('.reservation-panel'))
      .join('')
      .replaceAll(' ', '');

    expect(componentCss).toContain('@media(min-width:961px)');
    expect(componentCss).toContain('.summary-line');
    expect(componentCss).toContain('font-size:1.38rem');
    expect(componentCss).toContain('@media(max-width:600px)');
    expect(componentCss).toContain('.booking-limit');
    expect(componentCss).toContain('display:none');
    expect(componentCss).toContain('margin-top:0.55rem');
    expect(componentCss).toContain('min-height:2.2rem');
  });

  it('hands an exact valid reservation to Stripe without storing the booking token', async () => {
    bookingService.startReservation.and.resolveTo({
      held: {
        state: 'held',
        bookingToken: 'raw-booking-token',
        supportReference: 'BBW-2026-TEST',
        quantity: 2,
        priceMinor: 8500,
        subtotalMinor: 17000,
        taxMinor: 1190,
        taxRateBasisPoints: 700,
        taxRegion: 'RI',
        totalMinor: 18190,
        currency: 'USD',
        effectiveExpiresAt: '2026-10-01T16:30:00Z',
        methods: ['stripe'],
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
      contactPhone: '(555) 555-0100',
      acceptedTerms: true,
    });

    await component.submit();

    expect(bookingService.startReservation).toHaveBeenCalledWith({
      occurrenceSlug: 'garden-workshop',
      quantity: 2,
      contactName: 'Customer Name',
      contactEmail: 'customer@example.test',
      contactPhone: '(555) 555-0100',
      acceptedTermsVersion: 3,
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

  it('does not accept reservations for a legacy Venmo-only occurrence', async () => {
    publicRepository.getByRoute.and.resolveTo(publicWorkshopOccurrenceFixture({
      stripeEnabled: false,
      venmoEnabled: true,
    }));

    await component.load('summer-garden-centerpiece', '2026-08-15');
    fixture.detectChanges();

    expect(component.workshop()).toBeNull();
    expect(component.error()).toBe(
      'This workshop is not currently accepting reservations.',
    );
    expect(fixture.nativeElement.querySelector('.booking-form')).toBeNull();
  });

  it('uses plain loading copy without encoding artifacts', async () => {
    bookingService.startReservation.and.returnValue(new Promise(() => undefined));
    component.form.setValue({
      quantity: 1,
      firstName: 'Customer',
      lastName: 'Name',
      contactEmail: 'customer@example.test',
      contactPhone: '(555) 555-0100',
      acceptedTerms: true,
    });

    void component.submit();
    fixture.detectChanges();

    const submit = fixture.nativeElement.querySelector('.booking-form button[type="submit"]');
    expect(submit.textContent.trim()).toBe('Reserving seats...');
    expect(submit.textContent).not.toContain('Ã');
  });
});
