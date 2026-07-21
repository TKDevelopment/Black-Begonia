import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import {
  ProjectFinancialSummary,
  ProjectPaymentKind,
} from '../../../../../core/models/project-payment-record';
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
  @Input() summary: ProjectFinancialSummary | null = null;

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

  paymentStatus(kind: ProjectPaymentKind): 'Paid' | 'Unpaid' {
    const obligation = this.summary?.obligations.find(
      (candidate) => candidate.payment_kind === kind,
    );

    return obligation?.status === 'paid' || obligation?.status === 'overpaid'
      ? 'Paid'
      : 'Unpaid';
  }
}
