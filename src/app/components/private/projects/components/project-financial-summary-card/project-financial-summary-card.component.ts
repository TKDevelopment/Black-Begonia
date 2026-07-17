import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { ProjectPaymentRecord } from '../../../../../core/models/project-payment-record';
import { ProjectProposalInvoiceSnapshot } from '../../../../../core/models/project-proposal-invoice-snapshot';

@Component({
  selector: 'app-project-financial-summary-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './project-financial-summary-card.component.html',
  styleUrl: './project-financial-summary-card.component.scss',
})
export class ProjectFinancialSummaryCardComponent {
  @Input() snapshot: ProjectProposalInvoiceSnapshot | null = null;
  @Input() payments: ProjectPaymentRecord[] = [];

  get deposit(): ProjectPaymentRecord | null {
    return this.payments.find((payment) => payment.payment_kind === 'deposit') ?? null;
  }

  get finalPayment(): ProjectPaymentRecord | null {
    return this.payments.find((payment) => payment.payment_kind === 'final_payment') ?? null;
  }

  get outstandingBalance(): number | null {
    const total = this.snapshot?.total_amount;
    if (total === undefined || total === null) {
      return null;
    }

    const paid = this.payments.reduce((sum, payment) => sum + (payment.amount_paid ?? 0), 0);
    return Math.max(total - paid, 0);
  }

  formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return 'Unavailable';
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }

  formatStatus(value: string | null | undefined): string {
    if (!value) {
      return 'Unavailable';
    }

    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
