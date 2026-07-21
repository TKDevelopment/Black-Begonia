import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ProjectPaymentKind,
  ProjectPaymentMethod,
  ProjectPaymentRecord,
} from '../../../../../core/models/project-payment-record';

export interface ProjectPaymentLogPayload {
  obligation_id: string; payment_kind: ProjectPaymentKind; amount: number; received_at: string;
  payment_method: ProjectPaymentMethod; notes?: string | null; suspected_reference?: string | null;
  duplicate_override_reason?: string | null; confirm_overpayment?: boolean;
}

@Component({
  selector: 'app-project-payment-log-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-payment-log-modal.component.html',
  styleUrl: './project-payment-log-modal.component.scss',
})
export class ProjectPaymentLogModalComponent implements OnChanges {
  @Input() open = false;
  @Input() saving = false;
  @Input() obligations: ProjectPaymentRecord[] = [];
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<ProjectPaymentLogPayload>();

  obligation_id = '';
  payment_kind: ProjectPaymentKind = 'deposit';
  amount: number | null = null;
  received_at = new Date().toISOString().slice(0, 10);
  payment_method: ProjectPaymentMethod = 'venmo';
  notes = '';
  suspected_reference = '';
  duplicate_override_reason = '';
  confirm_overpayment = false;
  error = '';

  ngOnChanges(): void {
    if (this.open) {
      this.error = '';
      const first = this.obligations.find((item) => !['paid', 'waived', 'canceled'].includes(item.status)) ?? this.obligations[0];
      this.obligation_id = first?.project_payment_record_id ?? '';
      this.payment_kind = first?.payment_kind ?? 'deposit';
      this.amount = first?.outstanding_amount ?? first?.amount_due ?? null;
    }
  }

  submit(): void {
    this.error = '';

    if (!this.obligation_id) {
      this.error = 'Choose a payment obligation.';
      return;
    }
    if (!this.amount || this.amount <= 0) {
      this.error = 'Enter an amount paid greater than zero.';
      return;
    }
    const receivedDate = new Date(`${this.received_at}T12:00:00`);
    if (!this.received_at || Number.isNaN(receivedDate.getTime()) || receivedDate.getTime() > Date.now() + 300000) {
      this.error = 'Choose a valid payment date that is not in the future.';
      return;
    }
    if (!['stripe','venmo','check','cash','other'].includes(this.payment_method)) {
      this.error = 'Choose a valid payment method.';
      return;
    }

    this.confirm.emit({
      obligation_id: this.obligation_id,
      payment_kind: this.payment_kind,
      amount: this.amount,
      received_at: receivedDate.toISOString(),
      payment_method: this.payment_method,
      notes: this.notes || null,
      suspected_reference: this.suspected_reference || null,
      duplicate_override_reason: this.duplicate_override_reason || null,
      confirm_overpayment: this.confirm_overpayment,
    });
  }

  selectObligation(id: string): void {
    this.obligation_id = id;
    const obligation = this.obligations.find((item) => item.project_payment_record_id === id);
    if (obligation) { this.payment_kind = obligation.payment_kind; this.amount = obligation.outstanding_amount ?? obligation.amount_due; }
  }
}
