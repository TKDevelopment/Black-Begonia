import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { WorkshopCustomerStatus } from '../../../core/models/workshop-booking';
import { WorkshopBookingService } from '../../../core/supabase/services/workshop-booking.service';

@Component({
  selector: 'app-workshop-booking-status',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './workshop-booking-status.component.html',
  styleUrl: './workshop-booking-status.component.scss',
})
export class WorkshopBookingStatusComponent implements OnInit {
  private readonly bookingService = inject(WorkshopBookingService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly status = signal<WorkshopCustomerStatus | null>(null);
  readonly showRecovery = signal(false);
  readonly rescheduleMessage = signal<string | null>(null);
  readonly rescheduleError = signal<string | null>(null);
  readonly rescheduleBusy = signal(false);

  readonly accessCodeForm = this.formBuilder.nonNullable.group({
    accessCode: ['', [Validators.required, Validators.minLength(32), Validators.maxLength(256)]],
  });
  readonly rescheduleResponseForm = this.formBuilder.nonNullable.group({
    responseCode: [
      '',
      [Validators.required, Validators.minLength(32), Validators.maxLength(256)],
    ],
  });

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex,nofollow' });
    void this.resolveStatus();
  }

  async resolveStatus(): Promise<void> {
    this.loading.set(true);
    try {
      const emailedAccessCode = this.consumeEmailedAccessCode();
      const checkoutSessionId = this.route.snapshot.queryParamMap.get(
        'checkout_session_id',
      );
      if (checkoutSessionId) {
        await this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true,
        });
      }
      const status = checkoutSessionId
        ? await this.bookingService.getStatusByCheckoutSession(checkoutSessionId)
        : await this.bookingService.getStatus(emailedAccessCode ?? undefined);
      this.status.set(status);
      if (status.state !== 'confirmed') {
        this.bookingService.clearPendingAnalyticsOutcome();
      }
      this.showRecovery.set(
        ['expired', 'unavailable'].includes(status.state),
      );
    } catch {
      this.bookingService.clearPendingAnalyticsOutcome();
      this.status.set({ state: 'unavailable' });
      this.showRecovery.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async useAccessCode(): Promise<void> {
    if (this.accessCodeForm.invalid) {
      this.accessCodeForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    try {
      const status = await this.bookingService.getStatus(
        this.accessCodeForm.getRawValue().accessCode.trim(),
      );
      this.status.set(status);
      this.showRecovery.set(['expired', 'unavailable'].includes(status.state));
      this.accessCodeForm.reset();
    } catch {
      this.status.set({ state: 'unavailable' });
      this.showRecovery.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  showRescheduleResponse(): boolean {
    const current = this.status();
    return current?.state === 'action_required'
      && current.action === 'reschedule';
  }

  showBrowseWorkshops(): boolean {
    const state = this.status()?.state;
    return !!state && state !== 'unavailable';
  }

  formatEventDate(status: ConfirmedWorkshopStatus): string {
    return this.formatDateTime(status.startAt, status.timezone, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatEventTime(status: ConfirmedWorkshopStatus): string {
    const options: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
    };
    return `${this.formatDateTime(status.startAt, status.timezone, options)} – ${
      this.formatDateTime(status.endAt, status.timezone, options)
    }`;
  }

  async respondToReschedule(response: 'accept' | 'decline'): Promise<void> {
    if (this.rescheduleResponseForm.invalid) {
      this.rescheduleResponseForm.markAllAsTouched();
      return;
    }
    this.rescheduleBusy.set(true);
    this.rescheduleMessage.set(null);
    this.rescheduleError.set(null);
    try {
      const result = await this.bookingService.performCustomerAction(
        'respond_to_reschedule',
        { response },
        this.rescheduleResponseForm.getRawValue().responseCode.trim(),
      );
      if (result.state === 'accepted') {
        this.rescheduleMessage.set(
          result.replayed
            ? 'Your replacement workshop acceptance was already recorded.'
            : 'Your seats were transferred to the replacement workshop.',
        );
      } else if (result.state === 'declined') {
        this.status.set({ state: 'cancelled' });
        this.rescheduleMessage.set(
          'Your transfer was declined. The florist will review any refund due.',
        );
      } else if (result.state === 'expired') {
        this.status.set({
          state: 'action_required',
          action: 'reschedule',
          responseState: 'expired',
        });
        this.rescheduleError.set(
          'That response window expired. The florist must resolve the booking.',
        );
      } else {
        this.rescheduleError.set(
          'That response code is unavailable. Request current booking access or contact the florist.',
        );
      }
      if (result.state !== 'unavailable') this.rescheduleResponseForm.reset();
    } catch {
      this.rescheduleError.set(
        'That response could not be recorded. No transfer or refund was performed.',
      );
    } finally {
      this.rescheduleBusy.set(false);
    }
  }

  private consumeEmailedAccessCode(): string | null {
    if (typeof window === 'undefined' || !window.location.hash) return null;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    if (!fragment.has('access')) return null;
    const token = fragment.get('access')?.trim() ?? '';
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`,
    );
    return token.length >= 32 && token.length <= 256 ? token : null;
  }

  private formatDateTime(
    value: string,
    timeZone: string,
    options: Intl.DateTimeFormatOptions,
  ): string {
    try {
      return new Intl.DateTimeFormat('en-US', { ...options, timeZone })
        .format(new Date(value));
    } catch {
      return '';
    }
  }
}

type ConfirmedWorkshopStatus = Extract<
  WorkshopCustomerStatus,
  { state: 'confirmed' }
>;
