import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  WorkshopAttendee,
  WorkshopBooking,
  WorkshopBookingStatus,
  WorkshopOccurrenceOperationalState,
  WorkshopRosterRow,
  WorkshopWaitlistEntry,
} from '../../../../core/models/workshop-booking';
import {
  WorkshopPaymentTransaction,
  WorkshopRefundEligibility,
  WorkshopVenmoPaymentAttempt,
} from '../../../../core/models/workshop-financial';
import { WorkshopFinancialRepositoryService } from '../../../../core/supabase/repositories/workshop-financial-repository.service';
import { WorkshopOperationsRepositoryService } from '../../../../core/supabase/repositories/workshop-operations-repository.service';

@Component({
  selector: 'app-workshop-roster',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './workshop-roster.component.html',
  styleUrl: './workshop-roster.component.scss',
})
export class WorkshopRosterComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly operations = inject(WorkshopOperationsRepositoryService);
  private readonly financials = inject(WorkshopFinancialRepositoryService);

  readonly occurrenceId = this.route.snapshot.paramMap.get('occurrenceId') ?? '';
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionMessage = signal<string | null>(null);
  readonly reservationModalOpen = signal(false);
  readonly reservationBusy = signal(false);
  readonly cancellationBooking = signal<WorkshopBooking | null>(null);
  readonly cancellationBusy = signal(false);
  readonly venmoAttempts = signal<WorkshopVenmoPaymentAttempt[]>([]);
  readonly venmoApprovalBooking = signal<WorkshopBooking | null>(null);
  readonly venmoApprovalBusy = signal(false);
  readonly refundableCharges = signal<WorkshopPaymentTransaction[]>([]);
  readonly refundBooking = signal<WorkshopBooking | null>(null);
  readonly refundCharge = signal<WorkshopPaymentTransaction | null>(null);
  readonly refundEligibility = signal<WorkshopRefundEligibility | null>(null);
  readonly refundLoading = signal(false);
  readonly refundBusy = signal(false);
  readonly query = signal('');
  readonly statusFilter = signal<'all' | WorkshopBookingStatus>('all');
  readonly roster = signal<WorkshopRosterRow[]>([]);
  readonly bookings = signal<WorkshopBooking[]>([]);
  readonly attendees = signal<WorkshopAttendee[]>([]);
  readonly waitlist = signal<WorkshopWaitlistEntry[]>([]);
  readonly operationalState = signal<WorkshopOccurrenceOperationalState | null>(null);

  manualName = '';
  manualEmail = '';
  manualPhone = '';
  manualQuantity = 1;
  manualType: 'manual' | 'complimentary' = 'manual';
  manualReason = '';
  cancellationQuantityValue = 1;
  venmoProviderPaymentId = '';
  venmoAmountDollars = 0;
  venmoOccurredAt = '';
  refundQuantityValue = 1;
  refundReason = 'customer_requested';
  refundReference = '';
  refundOccurredAt = '';
  refundConfirmation = false;
  offerMinutes = 1440;

  readonly bookingStatusOptions: ReadonlyArray<{
    value: WorkshopBookingStatus;
    label: string;
  }> = [
    { value: 'pending_payment', label: 'Pending payment' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'checked_in', label: 'Checked in' },
    { value: 'expired', label: 'Expired' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'payment_disputed', label: 'Payment disputed' },
    { value: 'transfer_action_required', label: 'Transfer action required' },
    { value: 'transferred', label: 'Transferred' },
  ];

  readonly filteredRoster = computed(() => {
    const query = this.query().trim().toLowerCase();
    const status = this.statusFilter();
    return this.roster().filter((row) =>
      (status === 'all' || row.booking_status === status) &&
      (!query || row.contact_name.toLowerCase().includes(query) ||
        (row.attendee_name ?? '').toLowerCase().includes(query)));
  });
  readonly filteredBookings = computed(() => {
    const query = this.query().trim().toLowerCase();
    const status = this.statusFilter();
    return this.bookings().filter((booking) =>
      (status === 'all' || booking.status === status) &&
      (!query || [
        booking.contact_name,
        booking.contact_email ?? '',
        booking.contact_phone ?? '',
        booking.payment_state,
      ].some((value) => value.toLowerCase().includes(query))));
  });
  readonly activeSeatCount = computed(() =>
    this.bookings()
      .filter((booking) => !['expired', 'cancelled'].includes(booking.status))
      .reduce((sum, booking) => sum + booking.active_quantity, 0));
  readonly scheduledSeatCount = computed(() => this.operationalState()?.capacity ?? 0);
  readonly availableSeatCount = computed(() =>
    this.operationalState()?.remainingQuantity ?? 0);
  readonly checkedInCount = computed(() =>
    this.attendees().filter((attendee) => attendee.attendance_state === 'checked_in').length);

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [roster, bookings, waitlist, operationalState] = await Promise.all([
        this.operations.listMinimizedRoster(this.occurrenceId),
        this.operations.listBookings(this.occurrenceId),
        this.operations.listWaitlist(this.occurrenceId),
        this.operations.getOperationalState(this.occurrenceId),
      ]);
      const bookingIds = bookings.map((booking) => booking.workshop_booking_id);
      const [attendees, venmoAttempts, refundableCharges] = await Promise.all([
        this.operations.listAttendeesForBookings(bookingIds),
        this.financials.listPendingVenmoAttempts(bookingIds),
        this.financials.listRefundableCharges(bookingIds),
      ]);
      this.roster.set(roster);
      this.bookings.set(bookings);
      this.attendees.set(attendees);
      this.venmoAttempts.set(venmoAttempts);
      this.refundableCharges.set(refundableCharges);
      this.waitlist.set(waitlist);
      this.operationalState.set(operationalState);
    } catch {
      this.error.set('We could not load this workshop roster.');
    } finally {
      this.loading.set(false);
    }
  }

  async createReservation(): Promise<void> {
    this.actionMessage.set(null);
    this.reservationBusy.set(true);
    try {
      await this.operations.createReservation({
        occurrenceId: this.occurrenceId,
        quantity: this.manualQuantity,
        reservationType: this.manualType,
        statusTokenDigest: `placeholder-${crypto.randomUUID().replaceAll('-', '')}`,
        contactName: this.manualName.trim(),
        contactEmail: this.manualEmail.trim().toLowerCase(),
        contactPhone: this.manualPhone.trim() || undefined,
        reason: this.manualReason.trim(),
      }, crypto.randomUUID());
      this.actionMessage.set('Reservation added. Confirmation delivery is queued.');
      this.closeReservationModal();
      await this.load();
    } catch {
      this.error.set('We could not add that reservation. No seats were changed.');
    } finally {
      this.reservationBusy.set(false);
    }
  }

  openReservationModal(): void {
    this.error.set(null);
    this.closeVenmoApprovalModal();
    this.closeRefundModal();
    this.reservationModalOpen.set(true);
  }

  closeReservationModal(): void {
    this.reservationModalOpen.set(false);
    this.manualName = '';
    this.manualEmail = '';
    this.manualPhone = '';
    this.manualQuantity = 1;
    this.manualType = 'manual';
    this.manualReason = '';
  }

  openCancellationModal(booking: WorkshopBooking): void {
    this.error.set(null);
    this.reservationModalOpen.set(false);
    this.closeVenmoApprovalModal();
    this.closeRefundModal();
    this.cancellationBooking.set(booking);
    this.cancellationQuantityValue = 1;
  }

  closeCancellationModal(): void {
    this.cancellationBooking.set(null);
    this.cancellationQuantityValue = 1;
  }

  cancellationQuantity(): number {
    const maximum = Math.max(this.cancellationBooking()?.active_quantity ?? 1, 1);
    return Math.min(Math.max(Math.trunc(this.cancellationQuantityValue), 1), maximum);
  }

  setCancellationQuantity(value: number | string): void {
    const parsed = Number(value);
    const next = Number.isFinite(parsed) ? Math.trunc(parsed) : 1;
    const maximum = Math.max(this.cancellationBooking()?.active_quantity ?? 1, 1);
    this.cancellationQuantityValue = Math.min(Math.max(next, 1), maximum);
  }

  async cancelSelectedSeats(): Promise<void> {
    const booking = this.cancellationBooking();
    if (!booking) return;
    const quantity = this.cancellationQuantity();
    this.cancellationBusy.set(true);
    this.error.set(null);
    try {
      await this.operations.cancelSeats(
        booking.workshop_booking_id,
        quantity,
        'CRM roster cancellation',
        crypto.randomUUID(),
      );
      this.actionMessage.set(
        `${quantity} seat${quantity === 1 ? '' : 's'} cancelled for ${booking.contact_name}.`,
      );
      this.closeCancellationModal();
      await this.load();
    } catch {
      this.error.set('We could not cancel those seats. No reservation was changed.');
    } finally {
      this.cancellationBusy.set(false);
    }
  }

  venmoAttemptFor(booking: WorkshopBooking): WorkshopVenmoPaymentAttempt | undefined {
    return this.venmoAttempts().find(
      (attempt) => attempt.workshop_booking_id === booking.workshop_booking_id,
    );
  }

  canConfirmVenmoPayment(booking: WorkshopBooking): boolean {
    return booking.payment_method === 'direct_venmo'
      && booking.status === 'pending_payment'
      && ['pending', 'processing'].includes(booking.payment_state)
      && !!this.venmoAttemptFor(booking);
  }

  chargeFor(booking: WorkshopBooking): WorkshopPaymentTransaction | undefined {
    return this.refundableCharges().find(
      (charge) => charge.workshop_booking_id === booking.workshop_booking_id,
    );
  }

  canRefundOrder(booking: WorkshopBooking): boolean {
    return booking.status === 'confirmed'
      && ['paid', 'partially_refunded'].includes(booking.payment_state)
      && booking.active_quantity > 0
      && !!this.chargeFor(booking);
  }

  bookingStatusState(booking: WorkshopBooking): string {
    return ['partially_refunded', 'refunded'].includes(booking.payment_state)
      ? booking.payment_state
      : booking.status;
  }

  bookingStatusLabel(booking: WorkshopBooking): string {
    return this.bookingStatusState(booking).replaceAll('_', ' ');
  }

  async openRefundModal(booking: WorkshopBooking): Promise<void> {
    const charge = this.chargeFor(booking);
    if (!charge || !this.canRefundOrder(booking)) {
      this.error.set('This order does not have an eligible payment to refund.');
      return;
    }
    this.error.set(null);
    this.reservationModalOpen.set(false);
    this.closeCancellationModal();
    this.closeVenmoApprovalModal();
    this.refundBooking.set(booking);
    this.refundCharge.set(charge);
    this.refundEligibility.set(null);
    this.refundQuantityValue = 1;
    this.refundReason = 'customer_requested';
    this.refundReference = '';
    this.refundOccurredAt = localDateTimeValue(new Date());
    this.refundConfirmation = false;
    this.refundLoading.set(true);
    try {
      const eligibility = await this.financials.getRefundEligibility(
        charge.workshop_payment_transaction_id,
      );
      if (!eligibility.eligible || eligibility.remainingRefundableMinor < 1) {
        throw new Error('ineligible');
      }
      this.refundEligibility.set(eligibility);
      this.setRefundQuantity(1);
    } catch {
      this.error.set('This payment is not currently eligible for a refund.');
      this.closeRefundModal();
    } finally {
      this.refundLoading.set(false);
    }
  }

  closeRefundModal(): void {
    this.refundBooking.set(null);
    this.refundCharge.set(null);
    this.refundEligibility.set(null);
    this.refundQuantityValue = 1;
    this.refundReason = 'customer_requested';
    this.refundReference = '';
    this.refundOccurredAt = '';
    this.refundConfirmation = false;
  }

  maximumRefundSeats(): number {
    const booking = this.refundBooking();
    const eligibility = this.refundEligibility();
    if (!booking || !eligibility || booking.price_per_seat_minor_snapshot < 1) return 0;
    return Math.max(0, Math.min(
      booking.active_quantity,
      Math.floor(
        eligibility.remainingRefundableMinor / booking.price_per_seat_minor_snapshot,
      ),
    ));
  }

  refundQuantity(): number {
    const maximum = Math.max(this.maximumRefundSeats(), 1);
    return Math.min(Math.max(Math.trunc(this.refundQuantityValue), 1), maximum);
  }

  setRefundQuantity(value: number | string): void {
    const parsed = Number(value);
    const next = Number.isFinite(parsed) ? Math.trunc(parsed) : 1;
    const maximum = Math.max(this.maximumRefundSeats(), 1);
    this.refundQuantityValue = Math.min(Math.max(next, 1), maximum);
  }

  refundAmountMinor(): number {
    return (this.refundBooking()?.price_per_seat_minor_snapshot ?? 0)
      * this.refundQuantity();
  }

  formatCurrency(amountMinor: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
    }).format(amountMinor / 100);
  }

  async refundSelectedSeats(): Promise<void> {
    const booking = this.refundBooking();
    const charge = this.refundCharge();
    const eligibility = this.refundEligibility();
    const quantity = this.refundQuantity();
    const amountMinor = this.refundAmountMinor();
    if (!booking || !charge || !eligibility || !this.refundConfirmation
      || quantity < 1 || amountMinor > eligibility.remainingRefundableMinor) {
      this.error.set('Review the refund details and confirm before continuing.');
      return;
    }
    this.refundBusy.set(true);
    this.error.set(null);
    try {
      if (charge.provider === 'stripe') {
        await this.financials.requestStripeRefund(
          charge.workshop_payment_transaction_id,
          amountMinor,
          this.refundReason,
          crypto.randomUUID(),
          quantity,
        );
        this.actionMessage.set(
          `Stripe refund requested for ${quantity} ${quantity === 1 ? 'seat' : 'seats'} `
          + `(${this.formatCurrency(amountMinor)}). Seats will be released after Stripe's `
          + 'verified refund confirmation arrives.',
        );
      } else {
        const reference = this.refundReference.trim();
        const occurredAt = new Date(this.refundOccurredAt);
        if (!reference || Number.isNaN(occurredAt.getTime())) {
          this.error.set('Enter the completed Venmo refund transaction ID and sent time.');
          return;
        }
        await this.financials.recordExternalRefund(
          charge.workshop_payment_transaction_id,
          amountMinor,
          reference,
          this.refundReason,
          occurredAt.toISOString(),
          crypto.randomUUID(),
          quantity,
        );
        this.actionMessage.set(
          `Venmo refund recorded for ${quantity} ${quantity === 1 ? 'seat' : 'seats'} `
          + `(${this.formatCurrency(amountMinor)}). The selected seats are now available.`,
        );
      }
      this.closeRefundModal();
      if (charge.provider === 'stripe') {
        const reconciled = await this.waitForStripeRefundReconciliation(
          booking.workshop_booking_id,
          booking.active_quantity - quantity,
        );
        if (!reconciled) {
          this.actionMessage.set(
            `Stripe accepted the ${this.formatCurrency(amountMinor)} refund. `
            + 'The roster is still waiting for Stripe webhook confirmation; refresh shortly.',
          );
        }
      } else {
        await this.load();
      }
    } catch {
      this.error.set(
        'We could not complete that refund. No unverified roster change was applied.',
      );
    } finally {
      this.refundBusy.set(false);
    }
  }

  private async waitForStripeRefundReconciliation(
    bookingId: string,
    expectedActiveQuantity: number,
  ): Promise<boolean> {
    const attempts = 8;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await this.load();
      const booking = this.bookings().find(
        (candidate) => candidate.workshop_booking_id === bookingId,
      );
      if (booking && booking.active_quantity <= expectedActiveQuantity
        && ['partially_refunded', 'refunded'].includes(booking.payment_state)) {
        return true;
      }
      if (attempt < attempts - 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      }
    }
    return false;
  }

  openVenmoApprovalModal(booking: WorkshopBooking): void {
    const attempt = this.venmoAttemptFor(booking);
    if (!attempt) return;
    this.error.set(null);
    this.reservationModalOpen.set(false);
    this.closeCancellationModal();
    this.venmoApprovalBooking.set(booking);
    this.venmoProviderPaymentId = '';
    this.venmoAmountDollars = attempt.amount_minor / 100;
    this.venmoOccurredAt = localDateTimeValue(new Date());
  }

  closeVenmoApprovalModal(): void {
    this.venmoApprovalBooking.set(null);
    this.venmoProviderPaymentId = '';
    this.venmoAmountDollars = 0;
    this.venmoOccurredAt = '';
  }

  async confirmVenmoPayment(): Promise<void> {
    const booking = this.venmoApprovalBooking();
    const attempt = booking ? this.venmoAttemptFor(booking) : undefined;
    const providerPaymentId = this.venmoProviderPaymentId.trim();
    const amountMinor = Math.round(Number(this.venmoAmountDollars) * 100);
    const occurredAt = new Date(this.venmoOccurredAt);
    if (!booking || !attempt || !providerPaymentId || amountMinor < 1
      || Number.isNaN(occurredAt.getTime())) {
      this.error.set('Enter the Venmo transaction ID, amount received, and received time.');
      return;
    }

    this.venmoApprovalBusy.set(true);
    this.error.set(null);
    try {
      const result = await this.financials.recordVenmoReceipt(
        attempt.reconciliation_reference,
        providerPaymentId,
        amountMinor,
        occurredAt.toISOString(),
        crypto.randomUUID(),
      );
      this.actionMessage.set(
        ['confirmed', 'paid'].includes(result.state)
          ? `Venmo payment confirmed for ${booking.contact_name}. The booking is now confirmed.`
          : `Venmo payment recorded for ${booking.contact_name} and sent for financial review. The booking remains pending.`,
      );
      this.closeVenmoApprovalModal();
      await this.load();
    } catch {
      this.error.set(
        'We could not record that Venmo payment. No booking or financial state was changed.',
      );
    } finally {
      this.venmoApprovalBusy.set(false);
    }
  }

  async checkIn(attendee: WorkshopAttendee): Promise<void> {
    await this.operations.checkIn(attendee.workshop_attendee_id, crypto.randomUUID());
    this.actionMessage.set('Attendee checked in.');
    await this.load();
  }

  async offerNext(): Promise<void> {
    const result = await this.operations.offerWaitlistSeats(
      this.occurrenceId,
      this.offerMinutes,
      crypto.randomUUID(),
    );
    this.actionMessage.set(
      result.state === 'active'
        ? `Offer queued for ${result.quantity ?? 0} seat(s).`
        : `Waitlist result: ${result.state.replaceAll('_', ' ')}.`,
    );
    await this.load();
  }

  formatPhone(phone: string | null): string {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    const national = digits.length === 11 && digits.startsWith('1')
      ? digits.slice(1)
      : digits;
    if (national.length !== 10) return phone.trim();
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  }

  exportRoster(): void {
    const rows = this.filteredBookings().map((booking) => `
      <tr>
        <td>${escapeHtml(booking.contact_name)}</td>
        <td>${escapeHtml(booking.contact_email ?? '—')}</td>
        <td>${escapeHtml(booking.contact_phone ?? '—')}</td>
        <td>${booking.active_quantity}</td>
        <td>${escapeHtml(booking.status.replaceAll('_', ' '))}</td>
        <td>${escapeHtml(booking.payment_state.replaceAll('_', ' '))}</td>
        <td class="check-in">&#9744;</td>
      </tr>`).join('');
    const generatedAt = new Date().toLocaleString('en-US');
    const documentContent = `<!doctype html><html><head><meta charset="utf-8">
      <title>Workshop Roster</title><style>
      @page{size:landscape;margin:.55in}body{font-family:Arial,sans-serif;color:#222}
      h1{margin:0 0 8px}p{margin:3px 0 14px;color:#555}table{width:100%;border-collapse:collapse}
      th,td{padding:8px;border:1px solid #888;text-align:left}th{background:#eee}
      .check-in{width:55px;text-align:center;font-size:20px}</style></head><body>
      <h1>Workshop Roster</h1>
      <p>Event ID: ${escapeHtml(this.occurrenceId)}<br>
      Scheduled seats: ${this.scheduledSeatCount()} &nbsp; Available seats: ${this.availableSeatCount()}<br>
      Generated: ${escapeHtml(generatedAt)}</p>
      <table><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Active seats</th>
      <th>Booking status</th><th>Payment status</th><th>Check in</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`;
    const blob = new Blob(['\ufeff', documentContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `workshop-roster-${safeFilenameSegment(this.occurrenceId)}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeFilenameSegment(value: string): string {
  return value.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '') || 'event';
}

function localDateTimeValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
