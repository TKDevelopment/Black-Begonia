import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { PublicWorkshopOccurrence } from '../../../core/models/workshop';
import { WorkshopPaymentHandoff } from '../../../core/models/workshop-booking';
import { WebsiteAnalyticsService } from '../../../core/analytics/website-analytics.service';
import { WorkshopPublicRepositoryService } from '../../../core/supabase/repositories/workshop-public-repository.service';
import { WorkshopBookingService } from '../../../core/supabase/services/workshop-booking.service';

type ReservationControlName =
  | 'quantity'
  | 'firstName'
  | 'lastName'
  | 'contactEmail'
  | 'paymentMethod'
  | 'acceptedTerms';

@Component({
  selector: 'app-workshop-reservation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './workshop-reservation.component.html',
  styleUrl: './workshop-reservation.component.scss',
})

export class WorkshopReservationComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly publicRepository = inject(WorkshopPublicRepositoryService);
  private readonly bookingService = inject(WorkshopBookingService);
  private readonly analytics = inject(WebsiteAnalyticsService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  readonly workshop = signal<PublicWorkshopOccurrence | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly handoff = signal<WorkshopPaymentHandoff | null>(null);
  readonly statusAccessCode = signal<string | null>(null);
  readonly invalidTooltips: Partial<Record<ReservationControlName, 'hidden' | 'visible' | 'fading'>> = {};
  private readonly tooltipTimers: Partial<Record<ReservationControlName, ReturnType<typeof setTimeout>>> = {};

  readonly form = this.formBuilder.nonNullable.group({
    quantity: [1, [Validators.required, Validators.min(1)]],
    firstName: ['', [Validators.required, Validators.maxLength(79)]],
    lastName: ['', [Validators.required, Validators.maxLength(79)]],
    contactEmail: ['', [Validators.required, Validators.email, Validators.maxLength(320)]],
    contactPhone: ['', [Validators.maxLength(40)]],
    paymentMethod: ['stripe' as 'stripe' | 'direct_venmo', Validators.required],
    acceptedTerms: [false, Validators.requiredTrue],
  });

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex,nofollow' });
    this.route.paramMap.subscribe((params) => {
      void this.load(
        params.get('seriesSlug') ?? '',
        params.get('workshopDate') ?? '',
      );
    });
  }

  ngOnDestroy(): void {
    Object.values(this.tooltipTimers).forEach((timer) => {
      if (timer) clearTimeout(timer);
    });
  }

  async load(seriesSlug: string, workshopDate: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const workshop = seriesSlug && workshopDate
        ? await this.publicRepository.getByRoute(seriesSlug, workshopDate)
        : null;
      if (!workshop || !this.canReserve(workshop)) {
        this.workshop.set(null);
        this.error.set('This workshop is not currently accepting reservations.');
        return;
      }
      this.workshop.set(workshop);
      this.form.controls.quantity.addValidators(
        Validators.max(workshop.perBookingLimit),
      );
      if (!workshop.stripeEnabled && workshop.venmoEnabled) {
        this.form.controls.paymentMethod.setValue('direct_venmo');
      }
    } catch {
      this.error.set('This workshop could not be loaded right now.');
    } finally {
      this.loading.set(false);
    }
  }

  async submit(): Promise<void> {
    const workshop = this.workshop();
    if (!workshop || this.submitting()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showInvalidTooltips();
      return;
    }
    this.hideInvalidTooltips();
    this.submitting.set(true);
    this.error.set(null);
    try {
      const value = this.form.getRawValue();
      this.analytics.trackWorkshopReservationStart(
        workshop.slug,
        value.quantity,
      );
      const result = await this.bookingService.startReservation({
        occurrenceSlug: workshop.slug,
        quantity: value.quantity,
        contactName: `${value.firstName.trim()} ${value.lastName.trim()}`,
        contactEmail: value.contactEmail,
        contactPhone: value.contactPhone || undefined,
        acceptedTermsVersion: workshop.termsVersion,
        paymentMethod: value.paymentMethod,
      });
      this.handoff.set(result.handoff);
      this.statusAccessCode.set(result.held.bookingToken);
      this.analytics.trackWorkshopCheckoutStart(
        value.paymentMethod,
        value.quantity,
      );
      if (result.handoff.state === 'redirect') {
        this.redirectToStripe(result.handoff.url);
      }
    } catch {
      this.error.set(
        'We could not reserve those seats. Please review the form and try again.',
      );
    } finally {
      this.submitting.set(false);
    }
  }

  redirectToStripe(url: string): void {
    if (/^https:\/\/checkout\.stripe\.com\//.test(url)) {
      this.document.defaultView?.location.assign(url);
    }
  }

  openBookingStatus(): void {
    const accessCode = this.statusAccessCode();
    if (accessCode) {
      this.redirectToStatus(accessCode);
    }
  }

  redirectToStatus(accessCode: string): void {
    const target = `/workshop-booking/status#access=${encodeURIComponent(accessCode)}`;
    this.document.defaultView?.location.assign(target);
  }

  formatMoney(minor: number, currency: string): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency })
      .format(minor / 100);
  }

  selectedSeatCount(): number {
    const quantity = Number(this.form.controls.quantity.value);
    return Number.isInteger(quantity) && quantity > 0 ? quantity : 0;
  }

  orderSubtotalMinor(workshop: PublicWorkshopOccurrence): number {
    return workshop.priceMinor * this.selectedSeatCount();
  }

  orderTaxMinor(workshop: PublicWorkshopOccurrence): number {
    return Math.round(
      this.orderSubtotalMinor(workshop) * workshop.taxRateBasisPoints / 10_000,
    );
  }

  orderTotalMinor(workshop: PublicWorkshopOccurrence): number {
    return this.orderSubtotalMinor(workshop) + this.orderTaxMinor(workshop);
  }

  taxRateLabel(workshop: PublicWorkshopOccurrence): string {
    return `${(workshop.taxRateBasisPoints / 100).toFixed(2).replace(/\.?0+$/, '')}%`;
  }

  formatDate(value: string, timezone: string): string {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: timezone,
    }).format(new Date(value));
  }

  private canReserve(workshop: PublicWorkshopOccurrence): boolean {
    return workshop.lifecycleStatus === 'published_open'
      && ['available', 'limited'].includes(workshop.availability)
      && (workshop.stripeEnabled || workshop.venmoEnabled);
  }

  private showInvalidTooltips(): void {
    const controls: ReservationControlName[] = [
      'quantity', 'firstName', 'lastName', 'contactEmail',
      'paymentMethod', 'acceptedTerms',
    ];
    controls.forEach((name) => {
      const control = this.form.controls[name];
      if (!control.invalid) {
        this.invalidTooltips[name] = 'hidden';
        return;
      }
      this.invalidTooltips[name] = 'visible';
      const existingTimer = this.tooltipTimers[name];
      if (existingTimer) clearTimeout(existingTimer);
      this.tooltipTimers[name] = setTimeout(() => {
        this.invalidTooltips[name] = 'fading';
        this.tooltipTimers[name] = setTimeout(() => {
          this.invalidTooltips[name] = 'hidden';
        }, 400);
      }, 3000);
    });
  }

  private hideInvalidTooltips(): void {
    (Object.keys(this.invalidTooltips) as ReservationControlName[])
      .forEach((name) => this.invalidTooltips[name] = 'hidden');
  }
}
