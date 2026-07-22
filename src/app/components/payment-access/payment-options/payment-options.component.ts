import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CheckoutHandoff, CustomerPaymentProjection, PaymentMethodChoice } from '../../../core/models/payment-request';
import { CustomerPaymentService } from '../../../core/supabase/services/customer-payment.service';

const SMALL_NUMBERS = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion'];

function spellUnderThousand(value: number): string {
  const words: string[] = [];
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  if (hundreds) words.push(`${SMALL_NUMBERS[hundreds]} hundred`);
  if (remainder < 20) {
    if (remainder) words.push(SMALL_NUMBERS[remainder]);
  } else {
    const ones = remainder % 10;
    words.push(`${TENS[Math.floor(remainder / 10)]}${ones ? `-${SMALL_NUMBERS[ones]}` : ''}`);
  }
  return words.join(' ');
}

function spellDollars(value: number): string {
  if (value === 0) return 'zero';
  const groups: string[] = [];
  let remaining = value;
  let scale = 0;
  while (remaining > 0 && scale < SCALES.length) {
    const group = remaining % 1000;
    if (group) groups.unshift(`${spellUnderThousand(group)}${SCALES[scale] ? ` ${SCALES[scale]}` : ''}`);
    remaining = Math.floor(remaining / 1000);
    scale += 1;
  }
  return groups.join(' ');
}

@Component({
  selector: 'app-payment-options',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-options.component.html',
  styleUrl: './payment-options.component.scss',
})
export class PaymentOptionsComponent implements OnInit, AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly payments = inject(CustomerPaymentService);

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly projection = signal<CustomerPaymentProjection>({ state: 'unavailable' });
  readonly intentionInstructions = signal<string | null>(null);
  readonly confirmationMethod = signal<'cash' | 'check' | null>(null);
  readonly demoCheckDate = new Date();
  readonly token = this.route.snapshot.paramMap.get('token') ?? '';

  async ngOnInit() {
    const projection = await this.payments.resolve(this.token);
    this.projection.set(projection);
    if (projection.intention?.method === 'cash' || projection.intention?.method === 'check') {
      this.confirmationMethod.set(projection.intention.method);
    }
    this.loading.set(false);
  }

  ngAfterViewInit(): void {}

  money(cents: number | undefined) {
    return cents == null
      ? 'Unavailable'
      : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  }

  amountInWords(cents: number | undefined): string {
    if (cents == null || !Number.isFinite(cents) || cents < 0) return 'Amount unavailable';
    const normalized = Math.round(cents);
    const dollars = Math.floor(normalized / 100);
    const fraction = String(normalized % 100).padStart(2, '0');
    const words = spellDollars(dollars);
    return `${words.charAt(0).toUpperCase()}${words.slice(1)} and ${fraction}/100 dollars`;
  }

  checkMemo(): string {
    const purpose = this.projection().purpose === 'deposit'
      ? 'Project deposit'
      : this.projection().purpose === 'final_payment'
        ? 'Final project payment'
        : 'Project payment';
    const eventDate = this.formattedEventDate();
    return eventDate ? `${purpose} - Event ${eventDate}` : `${purpose} - Event date`;
  }

  formattedEventDate(): string | null {
    const value = this.projection().eventDate;
    if (!value) return null;
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }

  enabled(method: PaymentMethodChoice) {
    return this.projection().methods?.includes(method) ?? false;
  }

  async choose(method: PaymentMethodChoice) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const handoff = await this.payments.choose(this.token, method);
      await this.handle(handoff);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Payment option is unavailable.');
    } finally {
      this.busy.set(false);
    }
  }

  private async handle(handoff: CheckoutHandoff) {
    if (handoff.kind === 'redirect') {
      location.assign(handoff.url);
      return;
    }
    if (handoff.kind === 'manual_venmo') {
      this.intentionInstructions.set(handoff.approvedTarget);
      if (handoff.approvedTarget) window.open(handoff.approvedTarget, '_blank', 'noopener,noreferrer');
      this.projection.set({
        ...this.projection(),
        intention: {
          method: 'venmo_business_profile',
          pauseEndsAt: new Date(Date.now() + 604800000).toISOString(),
        },
      });
      return;
    }
    if (handoff.kind === 'intention') {
      this.intentionInstructions.set(handoff.instructions);
      this.confirmationMethod.set(handoff.method);
      this.projection.set({
        ...this.projection(),
        intention: { method: handoff.method, pauseEndsAt: handoff.pauseEndsAt },
      });
      return;
    }

    await this.payments.loadPayPalSdk(handoff.clientId);
    const paypal = (globalThis as any).paypal;
    if (!paypal?.Buttons) throw new Error('Venmo is unavailable on this device.');
    paypal.Buttons({
      fundingSource: paypal.FUNDING.VENMO,
      createOrder: () => handoff.orderId,
      onApprove: async () => {
        await this.payments.captureVenmo(this.token, handoff.attempt);
        void this.router.navigate(['/pay', this.token, 'status'], {
          queryParams: { attempt: handoff.attempt },
        });
      },
      onCancel: () => this.error.set('Venmo approval was canceled. Your balance is still outstanding.'),
      onError: () => this.error.set('Venmo could not be completed. Try another method.'),
    }).render('#venmo-buttons');
  }
}
